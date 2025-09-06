// SPDX-License-Identifier: BUSL-1.1

/**
 * @title DiversiFi - ReserveManagerV1.sol
 * @dev Licensed under Business Source License 1.1.
 *
 * You may not use this code in any production or competing service without
 * written permission from the licensor. The license changes to Apache 2.0
 * on January 1, 2028. See the LICENSE file for full details.
 */

pragma solidity ^0.8.27;

import "./ReserveMath.sol";
import "./DataStructs.sol";
import "./interfaces/IReserveManagerAdmin.sol";
import "./interfaces/IReserveManagerGetters.sol";
import "./interfaces/IReserveManagerWrite.sol";
import "./interfaces/IReserveManagerEvents.sol";
import "./interfaces/IReserveManagerCallback.sol";
import "./interfaces/IIndexToken.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract ReserveManagerV1 is AccessControl, IReserveManagerAdmin, IReserveManagerGetters, 
  IReserveManagerWrite, IReserveManagerEvents {
  using SafeERC20 for IERC20;
  //assets in this reserve manager will be scaled to have this number of decimals
  //must be the same number of decimals as the index token
  uint8 public immutable DECIMAL_SCALE;
  bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
  bytes32 public constant MAINTAINER_ROLE = keccak256("MAINTAINER_ROLE");

  //reserve manager state
  mapping(address => uint256) private specificReservesScaled_; //reserves scaled by 10^DECIMAL_SCALE
  uint256 private totalReservesScaled_; //the sum of all reserves scaled by 10^DECIMAL_SCALE
  struct MigrationSlot {
    uint64 migrationStartTimestamp;
    uint96 migrationStartBalanceDivisor;
  }
  MigrationSlot private migrationSlot_;

  //related contracts
  IIndexToken private indexToken_;
  address private nextReserveManager_;

  //configuration
  AssetParams[] private targetAssetParamsList_;//the asset params of all underlying assets that have nonzero target allocations
  AssetParams[] private currentAssetParamsList_;//the asset params of all underlying assets that have nonzero current allocations
  mapping(address => AssetParams) private assetParams_;
  uint256 private mintFeeQ96_ = 0;
  uint256 private compoundingMintFeeQ96_ = 0;//cached value, see ReserveMath.calcCompoundingFeeRate for details
  uint256 private burnFeeQ96_ = 0;
  uint256 private equalizationBounty_ = 0;//a bounty paid to callers of swapTowardsTarget or EqualizeToTarget in the form of a discount applied to the swap
  bool private allowUnsafeBurn_ = false;//unsafe burning refers to burning where underlying token transfers are allowed to fail

  /*~~~~~~~~~~~~~~~~~~~~~loss prevention measures~~~~~~~~~~~~~~~~~~~~*/
  //admin switches
  bool private isMintEnabled_ = true;//emergency freeze function
  //burning is always enabled because disabling would violate user trust

  //automated max reserves limiting
  uint256 private maxReserves_;//the maximum numerical value of totalScaledReserves
  uint256 private maxReservesIncreaseRateQ96_;//maxReserves can be increased by this number * maxReserves every time it is increased via public cooldown
  uint256 private maxReservesIncreaseCooldown_ = 1 hours;//the delay before an unpriviledged user can increase the maxReserves again
  uint256 private lastMaxReservesChangeTimestamp_ = 0;

  modifier mustNotEmigrating {
    require(!isEmigrating(), "reserve manager is emigrating");
    _;
  }

  modifier mustIsEmigrating {
    require(isEmigrating(), "reserve manager is not emigrating");
    _;
  }

  modifier onlyAdmin() {
    require(hasRole(ADMIN_ROLE, msg.sender), "only admin can call this function");
    _;
  }

  modifier onlyMaintainer() {
    require(hasRole(MAINTAINER_ROLE, msg.sender), "only maintainer can call this function");
    _;
  }

  constructor(
    address _admin,
    address _maintainer,
    address _indexToken,
    uint256 _mintFeeQ96,
    uint256 _burnFeeQ96,
    uint256 _maxReserves,
    uint256 _maxReservesIncreaseRateQ96,
    AssetParams[] memory _assetParams
  ) {
    indexToken_ = IIndexToken(_indexToken);
    _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, ADMIN_ROLE);
    _grantRole(ADMIN_ROLE, _admin);
    _grantRole(MAINTAINER_ROLE, _maintainer);
    _grantRole(ADMIN_ROLE, msg.sender);
    setTargetAssetParams(_assetParams);
    if (_admin != msg.sender) {
      _revokeRole(ADMIN_ROLE, msg.sender);
    }
    DECIMAL_SCALE = indexToken_.decimals();
    maxReserves_ = _maxReserves;
    maxReservesIncreaseRateQ96_ = _maxReservesIncreaseRateQ96;
    mintFeeQ96_ = _mintFeeQ96;
    compoundingMintFeeQ96_ = ReserveMath.calcCompoundingFeeRate(_mintFeeQ96);
    burnFeeQ96_ = _burnFeeQ96;
  }
  
  /*
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~Public Core Functions~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  */

  /// @inheritdoc IReserveManagerWrite
  function mint(uint256 _mintAmount, bytes calldata _forwardData) external mustNotEmigrating {
    require(isMintEnabled_, "minting disabled");
    indexToken_.mint(
      msg.sender,
      _mintAmount
    );

    //forward data to callback for a flash mint
    if (_forwardData.length != 0) { IReserveManagerCallback(msg.sender).dfiV1FlashMintCallback(_forwardData); }

    uint256 fee = ReserveMath.fromFixed(_mintAmount * compoundingMintFeeQ96_);
    uint256 trueMintAmount = _mintAmount + fee;
    uint256[] memory scaledReservesList = new uint256[](targetAssetParamsList_.length);
    uint256 totalReservesIncrease = 0;
    for (uint i = 0; i < targetAssetParamsList_.length; i++) {
      AssetParams memory params = targetAssetParamsList_[i];
      uint256 targetDepositScaled = ReserveMath.fromFixed(
        ReserveMath.allocationToFixed(params.targetAllocation) * trueMintAmount
      );
      uint256 trueDeposit = ReserveMath.scaleDecimals(targetDepositScaled, DECIMAL_SCALE, params.decimals) + 1;//round up
      uint256 trueDepositScaled = ReserveMath.scaleDecimals(trueDeposit, params.decimals, DECIMAL_SCALE);
      IERC20(params.assetAddress).safeTransferFrom(msg.sender, address(this), trueDeposit);

      totalReservesIncrease += trueDepositScaled;
      scaledReservesList[i] = specificReservesScaled_[params.assetAddress] + trueDepositScaled;
      specificReservesScaled_[targetAssetParamsList_[i].assetAddress] = scaledReservesList[i];
    }
    totalReservesScaled_ += totalReservesIncrease;
    checkMaxTotalReservesLimit();

    emit Mint(
      msg.sender,
      _mintAmount,
      scaledReservesList,
      fee
    );
  }

  /// @inheritdoc IReserveManagerWrite
  function burn(uint256 _burnAmount, bool _unsafe, bytes calldata _forwardData) external {
    uint256 totalReserveReduction = 0;
    uint256 fee = ReserveMath.fromFixed(_burnAmount * burnFeeQ96_);
    uint256 trueBurnAmount = _burnAmount - fee;
    //if burning during a migration, index tokens may be backed by more than 1 unit of reserves,
    //in this case, we must scale up the "true" burn amount proportionally.
    trueBurnAmount = (trueBurnAmount * getMigrationBurnConversionRateQ96()) >> 96;
    uint256[] memory scaledReservesList = new uint256[](currentAssetParamsList_.length);
    uint256 totalReservesScaled = totalReservesScaled_;
    for (uint i = 0; i < currentAssetParamsList_.length; i++) {
      AssetParams memory params = currentAssetParamsList_[i];
      uint256 currentAllocation = ReserveMath.toFixed(specificReservesScaled_[params.assetAddress]) / totalReservesScaled;

      /*
        There is a target scaled transfer amount and a true scaled transfer amount because
        we may not be able to send the exact target transfer amount because of precision loss
        when scaling the transfer amount to the asset's decimals.
      */
      uint256 targetWithdrawalScaled = ReserveMath.fromFixed(currentAllocation * trueBurnAmount);
      uint256 trueWithdrawal = ReserveMath.scaleDecimals(targetWithdrawalScaled, DECIMAL_SCALE, params.decimals);
      uint256 trueWithdrawalScaled = ReserveMath.scaleDecimals(trueWithdrawal, params.decimals, DECIMAL_SCALE);
      if (_unsafe && allowUnsafeBurn_) {
        try IERC20(params.assetAddress).transfer(msg.sender, trueWithdrawal) {} catch {}
      } else {
        IERC20(params.assetAddress).safeTransfer(msg.sender, trueWithdrawal);
      }

      totalReserveReduction += trueWithdrawalScaled;
      scaledReservesList[i] = specificReservesScaled_[params.assetAddress] - trueWithdrawalScaled;
      specificReservesScaled_[params.assetAddress] = scaledReservesList[i];
    }
    totalReservesScaled_ -= totalReserveReduction;

    //forward data back to the caller for a flash burn
    if (_forwardData.length != 0) { IReserveManagerCallback(msg.sender).dfiV1FlashBurnCallback(_forwardData); }

    indexToken_.burnFrom(msg.sender, _burnAmount);
    emit Burn(
      msg.sender,
      _burnAmount,
      scaledReservesList,
      fee
    );
  }

  /*
    deposit/withdraw a single asset in exchange for index tokens for the purpose
    of rebalancing the reserve manager after a parameter change.
    only available when target allocation differs from current allocation, and
    the exchange moves the current allocation closer to the target allocation.
  */
  /// @inheritdoc IReserveManagerWrite
  function swapTowardsTarget(
    address _asset,
    int256 _delta// the change in reserves from the reserve manager's perspective, positive is a deposit, negative is a withdrawal
  ) external mustNotEmigrating returns (uint256 reservesTransfer, uint256 indexTransfer) {
    AssetParams memory params = assetParams_[_asset];
    uint256 bounty;
    uint256 startingDiscrepency = getTotalReservesDiscrepencyScaled();
    int256 maxDelta = ReserveMath.calcMaxIndividualDelta(
      params.targetAllocation,
      specificReservesScaled_[_asset],
      totalReservesScaled_
    );
    if(_delta > 0) { // depositing a reserve asset
      uint256 targetDepositScaled = ReserveMath.scaleDecimals(
        uint256(_delta),
        params.decimals,
        DECIMAL_SCALE
      );
      require(int256(targetDepositScaled) <= maxDelta, "deposit exceeds target allocation");
      uint256 trueDeposit = ReserveMath.scaleDecimals(
        targetDepositScaled,
        DECIMAL_SCALE,
        params.decimals
      );
      reservesTransfer = trueDeposit;
      uint256 trueDepositScaled = ReserveMath.scaleDecimals(
        trueDeposit,
        params.decimals,
        DECIMAL_SCALE
      );
      specificReservesScaled_[_asset] += trueDepositScaled;
      totalReservesScaled_ += trueDepositScaled;
      checkMaxTotalReservesLimit();
      uint256 endingDiscrepency = getTotalReservesDiscrepencyScaled();
      bounty = ReserveMath.calcEqualizationBounty(
        equalizationBounty_, 
        startingDiscrepency, 
        endingDiscrepency
      );
      equalizationBounty_ -= bounty;
      emit Swap(
        _asset,
        int256(trueDepositScaled),
        bounty
      );
      indexTransfer = trueDepositScaled + bounty; // bounty is awarded as a bonus
      indexToken_.mint(
        msg.sender,
        indexTransfer
      );
      IERC20(_asset).safeTransferFrom(msg.sender, address(this), trueDeposit);
    } else { // withdraw
      uint256 targetWithdrawalScaled = ReserveMath.scaleDecimals(
        uint256(_delta * -1),
        params.decimals,
        DECIMAL_SCALE
      );
      require(int256(targetWithdrawalScaled) * -1 >= maxDelta, "withdrawal exceeds target allocation");
      uint256 trueWithdrawal = ReserveMath.scaleDecimals(
        targetWithdrawalScaled,
        DECIMAL_SCALE,
        params.decimals
      );
      reservesTransfer = trueWithdrawal;
      uint256 trueWithdrawalScaled = ReserveMath.scaleDecimals(
        trueWithdrawal,
        params.decimals,
        DECIMAL_SCALE
      );
      specificReservesScaled_[_asset] -= trueWithdrawalScaled;
      totalReservesScaled_ -= trueWithdrawalScaled;
      uint256 endingDiscrepency = getTotalReservesDiscrepencyScaled();
      bounty = ReserveMath.calcEqualizationBounty(
        equalizationBounty_, 
        startingDiscrepency, 
        endingDiscrepency
      );
      if (bounty >= trueWithdrawalScaled) {
        // if the bounty is greater than the withdrawal, don't burn anything from the caller
        // and treat the bounty for this transaction as the amount the caller would have burned
        bounty = trueWithdrawalScaled;
      }
      equalizationBounty_ -= bounty;
      emit Swap(
        _asset,
        int256(trueWithdrawalScaled) * -1,
        bounty
      );
      indexTransfer = trueWithdrawalScaled - bounty; // bounty is awarded as a discount
      indexToken_.burnFrom(
        msg.sender, 
        indexTransfer 
      );
      IERC20(_asset).safeTransfer(msg.sender, trueWithdrawal);
    }
  }

  // the caller exchanges all assets with the reserve manager such that the current allocations match the target allocations when finished
  // also retires assets from the currentAssetParamsList if they are not in the targetAssetParamsList
  /// @inheritdoc IReserveManagerWrite
  function equalizeToTarget() external mustNotEmigrating returns (int256[] memory) {
    require(!getIsEqualized(), "reserve manager is already equalized");
    int256[] memory deltasScaled = getEqualizationVectorScaled();
    int256[] memory actualDeltas = new int256[](deltasScaled.length);
    totalReservesScaled_ = 0;
    for(uint i = 0; i < currentAssetParamsList_.length; i++) {
      AssetParams memory params = currentAssetParamsList_[i];
      if(deltasScaled[i] > 0) {// deposit
        uint256 actualDeposit = ReserveMath.scaleDecimals(uint256(deltasScaled[i]), DECIMAL_SCALE, params.decimals) + 1;
        IERC20(params.assetAddress).safeTransferFrom(
          msg.sender, 
          address(this),
          actualDeposit
        );
        uint256 actualDepositScaled = ReserveMath.scaleDecimals(actualDeposit, params.decimals, DECIMAL_SCALE);
        specificReservesScaled_[params.assetAddress] += actualDepositScaled;
        actualDeltas[i] = int256(actualDeposit);
      } else {//withdraw
        uint256 actualWithdrawal = ReserveMath.scaleDecimals(uint256(-deltasScaled[i]), DECIMAL_SCALE, params.decimals);
        IERC20(params.assetAddress).safeTransfer(
          msg.sender, 
          actualWithdrawal
        );
        uint256 actualWithdrawalScaled = ReserveMath.scaleDecimals(actualWithdrawal, params.decimals, DECIMAL_SCALE);
        specificReservesScaled_[params.assetAddress] -= actualWithdrawalScaled;
        actualDeltas[i] = int256(actualWithdrawal) * -1;
      }
      totalReservesScaled_ += specificReservesScaled_[params.assetAddress];
    }
    AssetParams[] memory tempCurrentParams = new AssetParams[](currentAssetParamsList_.length);
    for(uint i = 0; i < currentAssetParamsList_.length; i++) {
      AssetParams memory params = currentAssetParamsList_[i];
      //if the target allocation is 0, remove the asset from the currentAssetParamsList
      //and delete it from the assetParams mapping
      if(params.targetAllocation == 0) {
        delete assetParams_[params.assetAddress];
      }
      tempCurrentParams[i] = params;
    }
    delete currentAssetParamsList_;
    for(uint i = 0; i < tempCurrentParams.length; i++) {
      if (tempCurrentParams[i].targetAllocation != 0) {
        currentAssetParamsList_.push(tempCurrentParams[i]);
      }
    }

    //send the rest of the equalizationBounty to the caller
    indexToken_.mint(msg.sender, equalizationBounty_);
    equalizationBounty_ = 0;
    emit Equalization(deltasScaled);
    return actualDeltas;
  }

  /// @inheritdoc IReserveManagerWrite
  function withdrawAll(bool _unsafe) public mustIsEmigrating returns (AssetAmount[] memory outputAmounts) {
    indexToken_.burnFrom(msg.sender, totalReservesScaled_);
    totalReservesScaled_ = 0;
    outputAmounts = new AssetAmount[](currentAssetParamsList_.length);
    uint256[] memory scaledReservesList = new uint256[](currentAssetParamsList_.length);

    for (uint i = 0; i < currentAssetParamsList_.length; i++) {
      AssetParams memory params = currentAssetParamsList_[i];
      uint256 withdrawalAmount = IERC20(params.assetAddress).balanceOf(address(this));
      if (_unsafe && allowUnsafeBurn_) {
        try IERC20(params.assetAddress).transfer(msg.sender, withdrawalAmount) {} catch {}
      } else {
        IERC20(params.assetAddress).safeTransfer(msg.sender, withdrawalAmount);
      }
      AssetAmount memory assetAmount;
      assetAmount.assetAddress = params.assetAddress;
      assetAmount.amount = withdrawalAmount;
      outputAmounts[i] = assetAmount;
      specificReservesScaled_[params.assetAddress] = 0;
      scaledReservesList[i] = 0;
    }

    emit Burn(msg.sender, totalReservesScaled_, scaledReservesList, 0);
    return outputAmounts;
  }

  /*
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~Public Getters~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  */

  /// @inheritdoc IReserveManagerGetters
  function getMintFeeQ96() external view returns (uint256) {
    return mintFeeQ96_;
  }

  /// @inheritdoc IReserveManagerGetters
  function getCompoundingMintFeeQ96() external view returns (uint256) {
    return compoundingMintFeeQ96_;
  }

  /// @inheritdoc IReserveManagerGetters
  function getBurnFeeQ96() external view returns (uint256) {
    return burnFeeQ96_;
  }

  /// @inheritdoc IReserveManagerGetters
  function getIsMintEnabled() external view returns (bool) {
    return isMintEnabled_;
  }

  /// @inheritdoc IReserveManagerGetters
  function getSurplus() public view returns (int256) {
    return int256(totalReservesScaled_) - int256(indexToken_.totalSupply()) - int256(equalizationBounty_);
  }

  /// @inheritdoc IReserveManagerGetters
  function getIndexToken() external view returns (address) {
    return address(indexToken_);
  }

  /// @inheritdoc IReserveManagerGetters
  function getAllAssets() external view returns (address[] memory) {
      address[] memory assetsList = new address[](currentAssetParamsList_.length);
      for (uint i = 0; i < currentAssetParamsList_.length; i++) {
          assetsList[i] = currentAssetParamsList_[i].assetAddress;
      }
      return assetsList;
  }

  /// @inheritdoc IReserveManagerGetters
  function getCurrentAssetParams() external view returns (AssetParams[] memory) {
    return currentAssetParamsList_;
  }

  /// @inheritdoc IReserveManagerGetters
  function getTargetAssetParams() external view returns (AssetParams[] memory) {
    return targetAssetParamsList_;
  }

  /// @inheritdoc IReserveManagerGetters
  function getAssetParams(address asset) external view returns (AssetParams memory) {
    return assetParams_[asset];
  }

  /// @inheritdoc IReserveManagerGetters
  function getSpecificReservesScaled(address asset) external view returns (uint256) {
    return specificReservesScaled_[asset];
  }

  /// @inheritdoc IReserveManagerGetters
  function getTotalReservesScaled() external view returns (uint256) {
    return totalReservesScaled_;
  }


  /// @inheritdoc IReserveManagerGetters
  function getSpecificReserves(address _asset) external view returns (uint256) {
    return ReserveMath.scaleDecimals(specificReservesScaled_[_asset], DECIMAL_SCALE, assetParams_[_asset].decimals);
  }

  /// @inheritdoc IReserveManagerGetters
  function getMaxReserves() external view returns (uint256) {
    return maxReserves_;
  }

  /// @inheritdoc IReserveManagerGetters
  function getMaxReservesIncreaseRateQ96() external view returns (uint256) {
    return maxReservesIncreaseRateQ96_;
  }

  /// @inheritdoc IReserveManagerGetters
  function getMaxReservesIncreaseCooldown() external view returns (uint256) {
    return maxReservesIncreaseCooldown_;
  }

  /// @inheritdoc IReserveManagerGetters
  function getLastMaxReservesChangeTimestamp() external view returns (uint256) {
    return lastMaxReservesChangeTimestamp_;
  }

  /// @inheritdoc IReserveManagerGetters
  function getEqualizationBounty() external view returns (uint256) {
    return equalizationBounty_;
  }

  /// @inheritdoc IReserveManagerGetters
  function getIsEqualized() public view returns (bool) {
    //check if the current allocations match the target allocations
    uint256 totalReservesDiscrepencyScaled = getTotalReservesDiscrepencyScaled();

    //total discrepency must be less than one billionth of total reserves to be considered equalized
    uint256 discrepencyToleranceScaled = totalReservesScaled_ / 1_000_000_000;
    return totalReservesDiscrepencyScaled <= discrepencyToleranceScaled;
  }

  /// @inheritdoc IReserveManagerGetters
  function getEqualizationVectorScaled() public view returns (int256[] memory deltasScaled) {
    //calculate the deltas required to equalize the current allocations to the target allocations
    deltasScaled = new int256[](currentAssetParamsList_.length);
    for(uint i = 0; i < currentAssetParamsList_.length; i++) {
      AssetParams memory params = currentAssetParamsList_[i];
      uint256 targetReserves = ReserveMath.fromFixed(ReserveMath.allocationToFixed(params.targetAllocation) * totalReservesScaled_);
      deltasScaled[i] = int256(targetReserves) - int256(specificReservesScaled_[params.assetAddress]);
    }
  }

  /// @inheritdoc IReserveManagerGetters
  function getTotalReservesDiscrepencyScaled() public view returns (uint256) {
    uint256 totalReservesDiscrepencyScaled = 0;
    int256[] memory deltasScaled = getEqualizationVectorScaled();
    for(uint i = 0; i < deltasScaled.length; i++) {
      totalReservesDiscrepencyScaled += ReserveMath.abs(deltasScaled[i]);
    }
    return totalReservesDiscrepencyScaled;
  }

  /// @inheritdoc IReserveManagerGetters
  function getMigrationBurnConversionRateQ96() public view returns (uint256) {
    if (!isEmigrating()) { return ReserveMath.toFixed(1); }
    uint256 currentbalanceDivisor = uint256(indexToken_.balanceDivisor());
    return (currentbalanceDivisor << 96) / (migrationSlot_.migrationStartBalanceDivisor);
  }

  /// @inheritdoc IReserveManagerGetters
  function isEmigrating() public view returns (bool) {
    return nextReserveManager_ != address(0);
  }

  /// @inheritdoc IReserveManagerGetters
  function getAllowUnsafeBurn() public view returns (bool) {
    return allowUnsafeBurn_;
  }

  /*
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~Admin Functions~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  */

  /// @inheritdoc IReserveManagerAdmin
  function setMintFeeQ96(uint256 _mintFeeQ96) external onlyAdmin() mustNotEmigrating {
    mintFeeQ96_ = _mintFeeQ96;
    compoundingMintFeeQ96_ = ReserveMath.calcCompoundingFeeRate(_mintFeeQ96);
    emit MintFeeChange(_mintFeeQ96, compoundingMintFeeQ96_);
  }

  /// @inheritdoc IReserveManagerAdmin
  function setBurnFeeQ96(uint256 _burnFeeQ96) external onlyAdmin() mustNotEmigrating {
    burnFeeQ96_ = _burnFeeQ96;
    emit BurnFeeChange(_burnFeeQ96);
  }

  /// @inheritdoc IReserveManagerAdmin
  function setMaxReserves(uint256 _maxReserves) external onlyMaintainer() mustNotEmigrating {
    maxReserves_ = _maxReserves;
    lastMaxReservesChangeTimestamp_ = block.timestamp;
    emit MaxReservesChange(_maxReserves, block.timestamp);
  }

  /// @inheritdoc IReserveManagerAdmin
  function setMaxReservesIncreaseRateQ96(uint256 _maxReservesIncreaseRateQ96) external onlyMaintainer() mustNotEmigrating {
    maxReservesIncreaseRateQ96_ = _maxReservesIncreaseRateQ96;
    emit MaxReservesIncreaseRateChange(_maxReservesIncreaseRateQ96);
  }

  /// @inheritdoc IReserveManagerAdmin
  function setMaxReservesIncreaseCooldown(uint256 _maxReservesIncreaseCooldown) external onlyMaintainer() mustNotEmigrating {
    maxReservesIncreaseCooldown_ = _maxReservesIncreaseCooldown;
    emit MaxReservesIncreaseCooldownChange(_maxReservesIncreaseCooldown);
  }

  /// @inheritdoc IReserveManagerAdmin
  function setTargetAssetParams(AssetParams[] memory _params) public onlyAdmin() mustNotEmigrating {
    delete targetAssetParamsList_;
    for (uint i = 0; i < _params.length; i++) {
      for (uint j = 0; j < _params.length; j++) {
        if (i == j) {
          continue;
        }
        require(_params[i].assetAddress != _params[j].assetAddress, "duplicate asset");
      }
    }
    uint88 totalTargetAllocation = 0;
    {//scope reduction
    address[] memory assetAddresses = new address[](_params.length);
    uint88[] memory targetAllocations = new uint88[](_params.length);
    uint8[] memory decimalsList = new uint8[](_params.length);
    for (uint i = 0; i < _params.length; i++) {
      require(_params[i].assetAddress != address(indexToken_), "index not allowed");
      require(IIndexToken(_params[i].assetAddress).decimals() == _params[i].decimals, "decimal mismatch");
      assetAddresses[i] = _params[i].assetAddress;
      targetAllocations[i] = _params[i].targetAllocation;
      decimalsList[i] = _params[i].decimals;
      assetParams_[_params[i].assetAddress] = _params[i];
      targetAssetParamsList_.push(_params[i]);
      totalTargetAllocation += _params[i].targetAllocation;
      insertOrReplaceCurrentAssetParams(_params[i]);
    }
    emit TargetAssetParamsChange(assetAddresses,targetAllocations, decimalsList);
    }

    // if an asset is in the current list, but not in the target list, its allocation is implied to be zero
    for (uint iC = 0; iC < currentAssetParamsList_.length; iC++) {
      bool inTargetList = false;
      for (uint iT = 0; iT < _params.length; iT++) {
        if( _params[iT].assetAddress == currentAssetParamsList_[iC].assetAddress) {
          inTargetList = true;
        }
      }
      if(!inTargetList) {
        //update the current list to reflect the zero allocation
        currentAssetParamsList_[iC].targetAllocation = 0;
        //update asset params map to reflect the zero allocation
        assetParams_[currentAssetParamsList_[iC].assetAddress].targetAllocation = 0;
      }
    }
    require(totalTargetAllocation == type(uint88).max, "total target allocation must be 1");
  }

  /// @inheritdoc IReserveManagerAdmin
  function setIsMintEnabled(bool _isMintEnabled) external onlyMaintainer() mustNotEmigrating {
    isMintEnabled_ = _isMintEnabled;
    emit IsMintEnabledChange(_isMintEnabled);
  }

  /// @inheritdoc IReserveManagerAdmin
  function increaseEqualizationBounty(uint256 _bountyIncrease) external onlyAdmin() mustNotEmigrating {
    require(getSurplus() >= int256(_bountyIncrease), "not enough tokens to cover bounty");
    equalizationBounty_ += _bountyIncrease;
    emit EqualizationBountySet(equalizationBounty_);
  }

  /// @inheritdoc IReserveManagerAdmin
  function startEmigration(address _nextReserveManager) external mustNotEmigrating {
    require(msg.sender == address(indexToken_), "emigration start call must come from index token");
    nextReserveManager_ = _nextReserveManager;
    migrationSlot_.migrationStartBalanceDivisor = indexToken_.balanceDivisor();
    migrationSlot_.migrationStartTimestamp = uint64(block.timestamp);
    burnFeeQ96_ = 0;
  }

  /// @inheritdoc IReserveManagerAdmin
  function finishEmigration() external mustIsEmigrating {
    require(msg.sender == address(indexToken_), "emigration finish call must come from index token");
    require(totalReservesScaled_ == 0, "cannot finish emigration until all reserves have been moved");
    //burn index tokens that may have been accidentally transferred to this address
    indexToken_.burnFrom(address(this), indexToken_.balanceOf(address(this)));
    delete migrationSlot_;
    nextReserveManager_ = address(0);
  }

  /// since this action is not particularly useful to observers, and is only meant to be called in 
  /// emergency recovery situations, it emits no events
  function setAllowUnsafeBurn(bool _allowUnsafeBurn) external onlyAdmin {
    allowUnsafeBurn_ = _allowUnsafeBurn;
  }

  /*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~Helper Functions~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

  /**
   * @dev checks that totalReservesScaled_ is below maxReserves_ and attempts to increase maxReserves_ if the
   * increase functionality is not on cooldown. Reverts if it is on cooldown, or if totalScaledReserves_ is still
   * greater than maxReserves_ after increase. Sets increase functionality on cooldown if maxReserves_ was increased
   */
  function checkMaxTotalReservesLimit() private {
    //check if max reserves limit has been violated
    if (totalReservesScaled_ > maxReserves_) {
      //check if max reserves increase is on cooldown
      require(lastMaxReservesChangeTimestamp_ + maxReservesIncreaseCooldown_ <= block.timestamp, "max reserves limit");
      //update the max reserves if it isn't on cooldown
      lastMaxReservesChangeTimestamp_ = block.timestamp;
      maxReserves_ += ReserveMath.fromFixed(maxReserves_ * maxReservesIncreaseRateQ96_);
      require(maxReserves_ >= totalReservesScaled_, "max reserves limit");
      emit MaxReservesChange(
        maxReserves_,
        block.timestamp
      );
    }
  }

  /**
   * @dev if the asset is not in the current params list, add it
   * if it is in the current params list, update it
  */
  function insertOrReplaceCurrentAssetParams(AssetParams memory _params) private {
    bool isInCurrentParamsList = false;
    for (uint i = 0; i < currentAssetParamsList_.length; i++) {
      if (_params.assetAddress == currentAssetParamsList_[i].assetAddress) {
        isInCurrentParamsList = true;
        currentAssetParamsList_[i] = _params;
        break;
      }
    }
    if (!isInCurrentParamsList) {
      currentAssetParamsList_.push(_params);
    }
  }
}