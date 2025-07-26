// SPDX-License-Identifier: BUSL-1.1

/**
 * @title DiversiFi - LiquidityPool.sol
 * @dev Licensed under Business Source License 1.1.
 *
 * You may not use this code in any production or competing service without
 * written permission from the licensor. The license changes to Apache 2.0
 * on January 1, 2028. See the LICENSE file for full details.
 */

pragma solidity ^0.8.27;
import "hardhat/console.sol";

import "./PoolMath.sol";
import "./DataStructs.sol";
import "./interfaces/ILiquidityPoolAdmin.sol";
import "./interfaces/ILiquidityPoolGetters.sol";
import "./interfaces/ILiquidityPoolWrite.sol";
import "./interfaces/ILiquidityPoolEvents.sol";
import "./interfaces/ILiquidityPoolCallback.sol";
import "./interfaces/IIndexToken.sol";
import "openzeppelin/contracts/security/ReentrancyGuard.sol";
import "openzeppelin/contracts/token/ERC20/IERC20.sol";
import "openzeppelin/contracts/utils/math/SignedMath.sol";

contract LiquidityPool is ReentrancyGuard, ILiquidityPoolAdmin, ILiquidityPoolGetters, 
  ILiquidityPoolWrite, ILiquidityPoolEvents {
  //assets in this pool will be scaled to have this number of decimals
  //must be the same number of decimals as the index token
  uint8 public immutable DECIMAL_SCALE;

  //pool state
  mapping(address => uint256) private specificReservesScaled_; //reserves scaled by 10^DECIMAL_SCALE
  uint256 private totalReservesScaled_; //the sum of all reserves scaled by 10^DECIMAL_SCALE
  struct MigrationSlot {
    uint64 migrationStartTimestamp;
    uint96 migrationStartBalanceMultiplier;
  }
  MigrationSlot private migrationSlot_;

  //related contracts
  IIndexToken private indexToken_;
  address private nextLiquidityPool_;

  //configuration
  address private admin_;
  AssetParams[] private targetAssetParamsList_;//the asset params of all underlying assets that have nonzero target allocations
  AssetParams[] private currentAssetParamsList_;//the asset params of all underlying assets that have nonzero current allocations
  mapping(address => AssetParams) private assetParams_;
  uint256 private mintFeeQ96_ = 0;
  uint256 private burnFeeQ96_ = 0;
  uint256 private equalizationBounty_ = 0;//a bounty paid to callers of swapTowardsTarget or EqualizeToTarget in the form of a discount applied to the swap
  uint256 private maxReservesIncreaseRateQ96_;//maxReserves can be increased by this number * maxReserves every time it is increased via public cooldown

  /*~~~~~~~~~~~~~~~~~~~~~loss prevention measures~~~~~~~~~~~~~~~~~~~~*/
  //admin switches
  bool private isMintEnabled_ = true;//emergency freeze function
  //burning is always enabled because disabling would violate user trust

  //automated max reserves limiting
  uint256 private maxReserves_;//the maximum numerical value of totalScaledReserves
  uint256 private maxReservesIncreaseCooldown_ = 1 days;//the delay before an unpriviledged user can increase the maxReserves again
  uint256 private lastMaxReservesChangeTimestamp_ = 0;

  modifier onlyAdmin {
    require(msg.sender == admin_, "only_admin");
    _;
  }

  modifier mustNotEmigrating {
    require(!isEmigrating(), "pool is emigrating");
    _;
  }

  modifier mustIsEmigrating {
    require(isEmigrating(), "pool is not emigrating");
    _;
  }

  constructor(
    address _admin,
    address _indexToken
    ) {
    indexToken_ = IIndexToken(_indexToken);
    admin_ = _admin;
    DECIMAL_SCALE = indexToken_.decimals();
    maxReserves_ = 1e6 * 10 ** DECIMAL_SCALE; //initial limit is 1 million scaled reserves
    maxReservesIncreaseRateQ96_ = PoolMath.toFixed(1) / 10; //the next limit will be 1/10th larger than the current limit
  }
  
  /*
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~Public Core Functions~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  */

  /// @inheritdoc ILiquidityPoolWrite
  function mint(uint256 _mintAmount, bytes calldata _forwardData) external nonReentrant mustNotEmigrating returns (AssetAmount[] memory inputAmounts) {
    require(isMintEnabled_, "minting disabled");
    indexToken_.mint(
      msg.sender,
      _mintAmount
    );

    //forward data to callback for a flash mint
    if (_forwardData.length != 0) { ILiquidityPoolCallback(msg.sender).dfiV1FlashMintCallback(_forwardData); }

    uint256 fee = PoolMath.fromFixed(_mintAmount * PoolMath.calcCompoundingFeeRate(mintFeeQ96_));
    uint256 trueMintAmount = _mintAmount + fee;
    uint256[] memory scaledReservesList = new uint256[](targetAssetParamsList_.length);
    uint256 totalReservesIncrease = 0;
    inputAmounts = new AssetAmount[](targetAssetParamsList_.length);
    for (uint i = 0; i < targetAssetParamsList_.length; i++) {
      AssetParams memory params = targetAssetParamsList_[i];
      uint256 targetDeposit = PoolMath.fromFixed(
        PoolMath.allocationToFixed(params.targetAllocation) * trueMintAmount
      );
      uint256 trueDeposit = PoolMath.scaleDecimals(targetDeposit, DECIMAL_SCALE, params.decimals) + 1;//round up
      uint256 trueScaledDeposit = PoolMath.scaleDecimals(trueDeposit, params.decimals, DECIMAL_SCALE);
      IERC20(params.assetAddress).transferFrom(msg.sender, address(this), trueDeposit);

      AssetAmount memory assetAmount;
      assetAmount.assetAddress = params.assetAddress;
      assetAmount.amount = trueDeposit;
      inputAmounts[i] = assetAmount;

      totalReservesIncrease += trueScaledDeposit;
      scaledReservesList[i] = specificReservesScaled_[params.assetAddress] + trueScaledDeposit;
      specificReservesScaled_[targetAssetParamsList_[i].assetAddress] = scaledReservesList[i];
    }
    totalReservesScaled_ += totalReservesIncrease;
    checkMaxTotalReservesLimit();
    indexToken_.mint(address(this), fee);

    emit Mint(
      msg.sender,
      _mintAmount,
      scaledReservesList,
      fee
    );
  }

  /// @inheritdoc ILiquidityPoolWrite
  function burn(uint256 _burnAmount, bytes calldata _forwardData) external nonReentrant returns (AssetAmount[] memory outputAmounts) {
    uint256 totalReserveReduction = 0;
    uint256 fee = PoolMath.fromFixed(_burnAmount * burnFeeQ96_);
    uint256 trueBurnAmount = _burnAmount - fee;
    //if burning during a migration, index tokens may be backed by more than 1 unit of reserves,
    //in this case, we must scale up the "true" burn amount proportionally.
    trueBurnAmount = (trueBurnAmount * getMigrationBurnConversionRateQ96()) >> 96;
    uint256[] memory scaledReservesList = new uint256[](currentAssetParamsList_.length);
    outputAmounts = new AssetAmount[](targetAssetParamsList_.length);
    uint256 totalReservesScaled = totalReservesScaled_;
    for (uint i = 0; i < currentAssetParamsList_.length; i++) {
      AssetParams memory params = currentAssetParamsList_[i];
      uint256 currentAllocation = PoolMath.toFixed(specificReservesScaled_[params.assetAddress]) / totalReservesScaled;

      /*
        There is a target scaled transfer amount and a true scaled transfer amount because
        we may not be able to send the exact target transfer amount because of precision loss
        when scaling the transfer amount to the asset's decimals.
      */
      uint256 targetScaledWithdrawal = PoolMath.fromFixed(currentAllocation * trueBurnAmount);
      uint256 trueWithdrawal = PoolMath.scaleDecimals(targetScaledWithdrawal, DECIMAL_SCALE, params.decimals);
      uint256 trueScaledWithdrawal = PoolMath.scaleDecimals(trueWithdrawal, params.decimals, DECIMAL_SCALE);
      IERC20(params.assetAddress).transfer(msg.sender, trueWithdrawal);

      AssetAmount memory assetAmount;
      assetAmount.assetAddress = params.assetAddress;
      assetAmount.amount = trueWithdrawal;
      outputAmounts[i] = assetAmount;

      totalReserveReduction += trueScaledWithdrawal;
      scaledReservesList[i] = specificReservesScaled_[params.assetAddress] - trueScaledWithdrawal;
      specificReservesScaled_[params.assetAddress] = scaledReservesList[i];
    }
    totalReservesScaled_ -= totalReserveReduction;
    indexToken_.transferFrom(msg.sender, address(this), fee);

    //forward data back to the caller for a flash burn
    if (_forwardData.length != 0) { ILiquidityPoolCallback(msg.sender).dfiV1FlashBurnCallback(_forwardData); }

    indexToken_.burnFrom(msg.sender, trueBurnAmount);
    emit Burn(
      msg.sender,
      _burnAmount,
      scaledReservesList,
      fee
    );
  }

  /*
    deposit/withdraw a single asset in exchange for index tokens for the purpose
    of rebalancing the pool after a parameter change.
    only available when target allocation differs from current allocation, and
    the exchange moves the current allocation closer to the target allocation.
  */
  /// @inheritdoc ILiquidityPoolWrite
  function swapTowardsTarget(
    address _asset,
    int256 _delta// the change in reserves from the pool's perspective, positive is a deposit, negative is a withdrawal
  ) external nonReentrant returns (uint256 reservesTransfer, uint256 indexTransfer) {
    AssetParams memory params = assetParams_[_asset];
    uint256 bounty;
    uint256 startingDiscrepency = getTotalReservesDiscrepencyScaled();
    int256 maxDelta = PoolMath.calcMaxIndividualDelta(
      params.targetAllocation,
      specificReservesScaled_[_asset],
      totalReservesScaled_
    );
    if(_delta > 0) { // depositing a reserve asset
      uint256 targetDepositScaled = PoolMath.scaleDecimals(
        uint256(_delta),
        params.decimals,
        DECIMAL_SCALE
      );
      require(int256(targetDepositScaled) <= maxDelta, "deposit exceeds target allocation");
      uint256 trueDeposit = PoolMath.scaleDecimals(
        targetDepositScaled,
        DECIMAL_SCALE,
        params.decimals
      );
      reservesTransfer = trueDeposit;
      IERC20(_asset).transferFrom(msg.sender, address(this), trueDeposit);
      uint256 trueDepositScaled = PoolMath.scaleDecimals(
        trueDeposit,
        params.decimals,
        DECIMAL_SCALE
      );
      specificReservesScaled_[_asset] += trueDepositScaled;
      totalReservesScaled_ += trueDepositScaled;
      checkMaxTotalReservesLimit();
      uint256 endingDiscrepency = getTotalReservesDiscrepencyScaled();
      bounty = PoolMath.calcEqualizationBounty(
        equalizationBounty_, 
        startingDiscrepency, 
        endingDiscrepency
      );
      emit Swap(
        _asset,
        int256(trueDepositScaled),
        bounty
      );
      indexTransfer = trueDepositScaled + bounty;
      indexToken_.mint(
        msg.sender,
        indexTransfer//bounty is awarded as a bonus
      );
      indexToken_.burnFrom(
        address(this),
        bounty
      );
    } else { // withdraw
      uint256 targetWithdrawalScaled = PoolMath.scaleDecimals(
        uint256(_delta * -1),
        params.decimals,
        DECIMAL_SCALE
      );
      require(int256(targetWithdrawalScaled) * -1 >= maxDelta, "withdrawal exceeds target allocation");
      uint256 trueWithdrawal = PoolMath.scaleDecimals(
        targetWithdrawalScaled,
        DECIMAL_SCALE,
        params.decimals
      );
      reservesTransfer = trueWithdrawal;
      IERC20(_asset).transfer(msg.sender, trueWithdrawal);
      uint256 trueWithdrawalScaled = PoolMath.scaleDecimals(
        trueWithdrawal,
        params.decimals,
        DECIMAL_SCALE
      );

      specificReservesScaled_[_asset] -= trueWithdrawalScaled;
      totalReservesScaled_ -= trueWithdrawalScaled;
      uint256 endingDiscrepency = getTotalReservesDiscrepencyScaled();
      bounty = PoolMath.calcEqualizationBounty(
        equalizationBounty_, 
        startingDiscrepency, 
        endingDiscrepency
      );
      if (bounty >= trueWithdrawalScaled) {
        //if the bounty is greater than the withdrawal, don't burn anything from the caller
        //and treat the bounty for this transaction as the amount the caller would have burned
        bounty = trueWithdrawalScaled;
      }
      emit Swap(
        _asset,
        int256(trueWithdrawalScaled) * -1,
        bounty
      );
      indexTransfer = trueWithdrawalScaled - bounty;
      indexToken_.burnFrom(
        msg.sender, 
        indexTransfer //bounty is awarded as a discount
      );
      indexToken_.burnFrom(
        address(this),
        bounty
      );
    }
    equalizationBounty_ -= bounty;
  }

  // the caller exchanges all assets with the pool such that the current allocations match the target allocations when finished
  // also retires assets from the currentAssetParamsList if they are not in the targetAssetParamsList
  /// @inheritdoc ILiquidityPoolWrite
  function equalizeToTarget() external returns (int256[] memory) {
    int256[] memory deltasScaled = getEqualizationVectorScaled();
    int256[] memory actualDeltas = new int256[](deltasScaled.length);
    for(uint i = 0; i < currentAssetParamsList_.length; i++) {
      AssetParams memory params = currentAssetParamsList_[i];
      if(deltasScaled[i] > 0) {// deposit
        uint256 actualDeposit = PoolMath.scaleDecimals(uint256(deltasScaled[i]), DECIMAL_SCALE, params.decimals);
        IERC20(params.assetAddress).transferFrom(
          msg.sender, 
          address(this),
          actualDeposit
        );
        specificReservesScaled_[params.assetAddress] += uint256(deltasScaled[i]);
        actualDeltas[i] = int256(actualDeposit);
      } else {//withdraw
        uint256 actualWithdrawal = PoolMath.scaleDecimals(uint256(-deltasScaled[i]), DECIMAL_SCALE, params.decimals);
        IERC20(params.assetAddress).transfer(
          msg.sender, 
          actualWithdrawal
        );
        specificReservesScaled_[params.assetAddress] -= uint256(deltasScaled[i] * -1);
        actualDeltas[i] = int256(actualWithdrawal) * -1;
      }
    }
    for(uint i = 0; i < currentAssetParamsList_.length; i++) {
      AssetParams memory params = currentAssetParamsList_[i];
      if(params.targetAllocation == 0) {
        //if the target allocation is 0, remove the asset from the currentAssetParamsList
        //and delete it from the assetParams mapping
        delete assetParams_[params.assetAddress];
        for (uint j = i; j < currentAssetParamsList_.length - 1; j++) {
          currentAssetParamsList_[j] = currentAssetParamsList_[j + 1];
        }
        currentAssetParamsList_.pop();
      }
    }
    //send the rest of the equalizationBounty to the caller
    indexToken_.transfer(msg.sender, equalizationBounty_);
    emit Equalization(deltasScaled);
    return actualDeltas;
  }

  /// @inheritdoc ILiquidityPoolWrite
  function withdrawAll() public mustIsEmigrating returns (AssetAmount[] memory outputAmounts) {
    indexToken_.burnFrom(msg.sender, totalReservesScaled_);
    totalReservesScaled_ = 0;
    outputAmounts = new AssetAmount[](targetAssetParamsList_.length);
    uint256[] memory scaledReservesList = new uint256[](currentAssetParamsList_.length);

    for (uint i = 0; i < currentAssetParamsList_.length; i++) {
      AssetParams memory params = currentAssetParamsList_[i];
      uint256 withdrawalAmount = IERC20(params.assetAddress).balanceOf(address(this));
      IERC20(params.assetAddress).transfer(msg.sender, withdrawalAmount);
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

  /// @inheritdoc ILiquidityPoolGetters
  function getMintFeeQ96() external view returns (uint256) {
    return mintFeeQ96_;
  }

  /// @inheritdoc ILiquidityPoolGetters
  function getBurnFeeQ96() external view returns (uint256) {
    return burnFeeQ96_;
  }

  /// @inheritdoc ILiquidityPoolGetters
  function getIsMintEnabled() external view returns (bool) {
    return isMintEnabled_;
  }

  /// @inheritdoc ILiquidityPoolGetters
  function getFeesCollected() public view returns (uint256) {
    return indexToken_.balanceOf(address(this)) - equalizationBounty_;
  }

  /// @inheritdoc ILiquidityPoolGetters
  function getIndexToken() external view returns (address) {
    return address(indexToken_);
  }

  /// @inheritdoc ILiquidityPoolGetters
  function getAdmin() external view returns (address) {
    return admin_;
  }

  /// @inheritdoc ILiquidityPoolGetters
  function getAllAssets() external view returns (address[] memory) {
      address[] memory assetsList = new address[](currentAssetParamsList_.length);
      for (uint i = 0; i < currentAssetParamsList_.length; i++) {
          assetsList[i] = currentAssetParamsList_[i].assetAddress;
      }
      return assetsList;
  }

  /// @inheritdoc ILiquidityPoolGetters
  function getCurrentAssetParams() external view returns (AssetParams[] memory) {
    return currentAssetParamsList_;
  }

  /// @inheritdoc ILiquidityPoolGetters
  function getTargetAssetParams() external view returns (AssetParams[] memory) {
    return targetAssetParamsList_;
  }

  /// @inheritdoc ILiquidityPoolGetters
  function getAssetParams(address asset) external view returns (AssetParams memory) {
    return assetParams_[asset];
  }

  /// @inheritdoc ILiquidityPoolGetters
  function getSpecificReservesScaled(address asset) external view returns (uint256) {
    return specificReservesScaled_[asset];
  }

  /// @inheritdoc ILiquidityPoolGetters
  function getTotalReservesScaled() external view returns (uint256) {
    return totalReservesScaled_;
  }


  /// @inheritdoc ILiquidityPoolGetters
  function getSpecificReserves(address _asset) external view returns (uint256) {
    return PoolMath.scaleDecimals(specificReservesScaled_[_asset], DECIMAL_SCALE, assetParams_[_asset].decimals);
  }

  /// @inheritdoc ILiquidityPoolGetters
  function getMaxReserves() external view returns (uint256) {
    return maxReserves_;
  }

  /// @inheritdoc ILiquidityPoolGetters
  function getMaxReservesIncreaseRateQ96() external view returns (uint256) {
    return maxReservesIncreaseRateQ96_;
  }

  /// @inheritdoc ILiquidityPoolGetters
  function getMaxReservesIncreaseCooldown() external view returns (uint256) {
    return maxReservesIncreaseCooldown_;
  }

  /// @inheritdoc ILiquidityPoolGetters
  function getLastMaxReservesChangeTimestamp() external view returns (uint256) {
    return lastMaxReservesChangeTimestamp_;
  }

  /// @inheritdoc ILiquidityPoolGetters
  function getEqualizationBounty() external view returns (uint256) {
    return equalizationBounty_;
  }

  /// @inheritdoc ILiquidityPoolGetters
  function getIsEqualized() public view returns (bool) {
    //check if the current allocations match the target allocations
    uint256 totalReservesDiscrepencyScaled = getTotalReservesDiscrepencyScaled();

    //total discrepency must be less than one billionth of total reserves to be considered equalized
    uint256 discrepencyToleranceScaled = totalReservesScaled_ / 1_000_000_000;
    return totalReservesDiscrepencyScaled <= discrepencyToleranceScaled;
  }

  /// @inheritdoc ILiquidityPoolGetters
  function getEqualizationVectorScaled() public view returns (int256[] memory deltasScaled) {
    //calculate the deltas required to equalize the current allocations to the target allocations
    deltasScaled = new int256[](currentAssetParamsList_.length);
    for(uint i = 0; i < currentAssetParamsList_.length; i++) {
      AssetParams memory params = currentAssetParamsList_[i];
      uint256 targetReserves = PoolMath.fromFixed(PoolMath.allocationToFixed(params.targetAllocation) * totalReservesScaled_);
      deltasScaled[i] = int256(targetReserves) - int256(specificReservesScaled_[params.assetAddress]);
    }
  }

  /// @inheritdoc ILiquidityPoolGetters
  function getTotalReservesDiscrepencyScaled() public view returns (uint256) {
    uint256 totalReservesDiscrepencyScaled = 0;
    int256[] memory deltasScaled = getEqualizationVectorScaled();
    for(uint i = 0; i < deltasScaled.length; i++) {
      totalReservesDiscrepencyScaled += SignedMath.abs(deltasScaled[i]);
    }
    return totalReservesDiscrepencyScaled;
  }

  /// @inheritdoc ILiquidityPoolGetters
  function getMigrationBurnConversionRateQ96() public view returns (uint256) {
    if (!isEmigrating()) { return PoolMath.toFixed(1); }
    uint256 currentBalanceMultiplier = uint256(indexToken_.balanceMultiplier());
    return (currentBalanceMultiplier << 96) / (migrationSlot_.migrationStartBalanceMultiplier);
  }

  /// @inheritdoc ILiquidityPoolGetters
  function isEmigrating() public view returns (bool) {
    return nextLiquidityPool_ != address(0);
  }

  /*
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~Admin Functions~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  */

  /// @inheritdoc ILiquidityPoolAdmin
  function setAdmin(address _newAdmin) external onlyAdmin mustNotEmigrating {
    admin_ = _newAdmin;
    emit AdminChange(_newAdmin);
  }

  /// @inheritdoc ILiquidityPoolAdmin
  function setMintFeeQ96(uint256 _mintFeeQ96) external onlyAdmin mustNotEmigrating {
    mintFeeQ96_ = _mintFeeQ96;
    emit MintFeeChange(_mintFeeQ96);
  }

  /// @inheritdoc ILiquidityPoolAdmin
  function setBurnFeeQ96(uint256 _burnFeeQ96) external onlyAdmin mustNotEmigrating {
    burnFeeQ96_ = _burnFeeQ96;
    emit BurnFeeChange(_burnFeeQ96);
  }

  /// @inheritdoc ILiquidityPoolAdmin
  function setMaxReserves(uint256 _maxReserves) external onlyAdmin mustNotEmigrating {
    maxReserves_ = _maxReserves;
    lastMaxReservesChangeTimestamp_ = block.timestamp;
    emit MaxReservesChange(_maxReserves, block.timestamp);
  }

  /// @inheritdoc ILiquidityPoolAdmin
  function setMaxReservesIncreaseRateQ96(uint256 _maxReservesIncreaseRateQ96) external onlyAdmin mustNotEmigrating {
    maxReservesIncreaseRateQ96_ = _maxReservesIncreaseRateQ96;
    emit MaxReservesIncreaseRateChange(_maxReservesIncreaseRateQ96);
  }

  /// @inheritdoc ILiquidityPoolAdmin
  function setMaxReservesIncreaseCooldown(uint256 _maxReservesIncreaseCooldown) external onlyAdmin mustNotEmigrating {
    maxReservesIncreaseCooldown_ = _maxReservesIncreaseCooldown;
    emit MaxReservesIncreaseCooldownChange(_maxReservesIncreaseCooldown);
  }

  /// @inheritdoc ILiquidityPoolAdmin
  function setTargetAssetParams(AssetParams[] calldata _params) external onlyAdmin mustNotEmigrating {
    delete targetAssetParamsList_;
    uint88 totalTargetAllocation = 0;
    {//scope reduction
    address[] memory assetAddresses = new address[](_params.length);
    uint88[] memory targetAllocations = new uint88[](_params.length);
    uint8[] memory decimalsList = new uint8[](_params.length);
    for (uint i = 0; i < _params.length; i++) {
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

  /// @inheritdoc ILiquidityPoolAdmin
  function withdrawFees(address _recipient) external onlyAdmin mustNotEmigrating {
    uint256 fees = indexToken_.balanceOf(address(this)) - equalizationBounty_;
    indexToken_.transfer(
      _recipient,
      fees
    );
    emit FeesCollected(fees);
  }

  /// @inheritdoc ILiquidityPoolAdmin
  function setIsMintEnabled(bool _isMintEnabled) external onlyAdmin mustNotEmigrating {
    isMintEnabled_ = _isMintEnabled;
    emit IsMintEnabledChange(_isMintEnabled);
  }

  /// @inheritdoc ILiquidityPoolAdmin
  function increaseEqualizationBounty(uint256 _bountyIncrease) external onlyAdmin mustNotEmigrating {
    require(getFeesCollected() >= _bountyIncrease, "not enough tokens to cover bounty");
    equalizationBounty_ += _bountyIncrease;
    emit EqualizationBountySet(equalizationBounty_);
  }

  /// @inheritdoc ILiquidityPoolAdmin
  function startEmigration(
    address _nextLiquidityPool,
    uint64 balanceMultiplierChangeDelay,
    uint104 balanceMultiplierChangePerSecondQ96
  ) external onlyAdmin mustNotEmigrating {
    nextLiquidityPool_ = _nextLiquidityPool;
    migrationSlot_.migrationStartBalanceMultiplier = indexToken_.balanceMultiplier();
    migrationSlot_.migrationStartTimestamp = uint64(block.timestamp);
    burnFeeQ96_ = 0;

    indexToken_.startMigration(
      _nextLiquidityPool, 
      balanceMultiplierChangeDelay, 
      balanceMultiplierChangePerSecondQ96
    );
  }

  function finishEmigration() external mustIsEmigrating {
    require(nextLiquidityPool_ != address(0), "liquidity pool not migrating");
    require(totalReservesScaled_ == 0, "cannot finish emigration until all reserves have been moved");
    //burn all fees collected by this pool.
    //if there is a deficit, the burned tokens will go towards covering it.
    //if there is a surplus, appropriate tokens will be minted to the next
    //liquidity pool's fees collected upon the migration finishing such that
    //each token is backed 1:1. In this case, the burned tokens will be re-minted immediately
    //we do this instead of transferring them because this contract doesn't have access
    //to the required data to calculate the surplus/deficit.
    indexToken_.burnFrom(address(this), indexToken_.balanceOf(address(this)));
    uint256 finalTotalReservesScaled = ILiquidityPoolGetters(nextLiquidityPool_).getTotalReservesScaled();
    indexToken_.finishMigration(finalTotalReservesScaled);
    delete migrationSlot_;
    nextLiquidityPool_ = address(0);
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
      maxReserves_ += PoolMath.fromFixed(maxReserves_ * maxReservesIncreaseRateQ96_);
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