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

import "./IndexToken.sol";
import "openzeppelin/contracts/security/ReentrancyGuard.sol";
import "openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./PoolMath.sol";
import "./DataStructs.sol";
import "./ILiquidityPool.sol";
import "hardhat/console.sol";


contract LiquidityPool is ReentrancyGuard, ILiquidityPool {
  //assets in this pool will be scaled to have this number of decimals
  //must be the same number of decimals as the index token
  uint8 public immutable DECIMAL_SCALE;

  //pool state
  uint256 private feesCollected_ = 0;
  mapping(address => uint256) private specificReservesScaled_; //reserves scaled by 10^DECIMAL_SCALE
  uint256 private totalReservesScaled_; //the sum of all reserves scaled by 10^DECIMAL_SCALE

  //related contracts
  IndexToken private indexToken_;

  //configuration
  address private admin_;
  AssetParams[] private targetAssetParamsList_;//the asset params of all underlying assets that have nonzero target allocations
  AssetParams[] private currentAssetParamsList_;//the asset params of all underlying assets that have nonzero current allocations
  mapping(address => AssetParams) private assetParams_;
  uint256 private mintFeeQ128_ = 0;
  uint256 private burnFeeQ128_ = 0;
  uint256 private maxReservesIncreaseRateQ128_;//maxReserves can be increased by this number * maxReserves every time it is increased via public cooldown

  /*~~~~~~~~~~~~~~~~~~~~~loss prevention measures~~~~~~~~~~~~~~~~~~~~*/
  //admin switches
  bool private isMintEnabled_ = true;//emergency freeze function
  //burning is always enabled because disabling would violate user trust

  //automated max reserves limiting
  uint256 private maxReserves_;//the maximum numerical value of totalScaledReserves
  uint256 private maxReservesIncreaseCooldown_ = 1 days;//the delay before an unpriviledged user can increase the maxReserves again
  uint256 private lastMaxReservesChangeTimestamp_ = 0;

  constructor(
    address _admin,
    address _indexToken
    ) {
    indexToken_ = IndexToken(_indexToken);
    admin_ = _admin;
    DECIMAL_SCALE = IndexToken(_indexToken).decimals();
    maxReserves_ = 1e6 * 10 ** DECIMAL_SCALE; //initial limit is 1 million scaled reserves
    maxReservesIncreaseRateQ128_ = PoolMath.toFixed(1) / 10; //the next limit will be 1/10th larger than the current limit
    feesCollected_ = 1;//gas optimization
  }

  // emitted when a user mints the index token directly in exchange
  // for depositing every asset in the pool at the same time
  // the updated scaled reserves of each asset are included in the scaledReserves array
  // the array is indexed by order of the ***********TARGETAssetParamsList_***********
  // NOTE THAT THIS ARRAY IS NOT NECESSARILY INDEXED IN THE SAME ORDER AS THE ARRAY EMITTED BY THE BURN() EVENT
  event Mint(
    address   indexed recipient,
    uint256   mintAmount,
    uint256[] scaledReserves,
    uint256   feesPaid
  );

  // emitted when a user burns the index token directly
  // to redeem every asset in the pool at the same time
  // the updated scaled reserves of each asset are included in the scaledReserves array
  // the array is indexed by order of the ***********CURRENTAssetParamsList_***********
  // NOTE THAT THIS ARRAY IS NOT NECESSARILY INDEXED IN THE SAME ORDER AS THE ARRAY EMITTED BY THE MINT() EVENT
  event Burn(
    address   indexed recipient,
    uint256   burnAmount,
    uint256[] scaledReserves,
    uint256   feesPaid
  );

  event Swap(
    address indexed asset,
    int256 delta //the change in reserves from the pool's perspective, positive is a deposit, negative is a withdrawal
  );

  event MintFeeChange(
    uint256 mintFeeQ128_
  );

  event BurnFeeChange(
    uint256 burnFeeQ128_
  );

  event TargetAssetParamsChange(
    address indexed asset,
    uint88 targetAllocation,
    uint8 decimals
  );

  event CurrentAssetParamsChange(
    address indexed asset,
    uint88 targetAllocation,
    uint8 decimals
  );

  event IsMintEnabledChange(
    bool isMintEnabled
  );

  event MaxReservesChange(
    uint256 maxReserves
  );

  event MaxReservesIncreaseCooldownChange(
    uint256 publicMaxReservesIncreaseCooldown
  );

  event MaxReservesIncreaseRateChange(
    uint256 maxReservesIncreaseRateQ128_
  );

  event FeesCollected(
    uint256 feesCollected
  );

  event AdminChange(
    address admin
  );
  
  /*
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~Public Core Functions~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  */

  function mint(uint256 _mintAmount, address _recipient) external nonReentrant {
    require(isMintEnabled_, "minting disabled");
    uint256 fee = PoolMath.fromFixed(_mintAmount * PoolMath.calcCompoundingFeeRate(mintFeeQ128_));
    uint256 trueMintAmount = _mintAmount + fee;
    uint256[] memory scaledReservesList = new uint256[](targetAssetParamsList_.length);
    uint256 totalReservesIncrease = 0;
    for (uint i = 0; i < targetAssetParamsList_.length; i++) {
      AssetParams memory params = targetAssetParamsList_[i];
      uint256 targetDeposit = PoolMath.fromFixed(
        PoolMath.allocationToFixed(params.targetAllocation) * trueMintAmount
      );
      uint256 trueDeposit = PoolMath.scaleDecimals(targetDeposit, DECIMAL_SCALE, params.decimals);
      uint256 trueScaledDeposit = PoolMath.scaleDecimals(trueDeposit, params.decimals, DECIMAL_SCALE);
      IERC20(params.assetAddress).transferFrom(msg.sender, address(this), trueDeposit);
      totalReservesIncrease += trueScaledDeposit;
      scaledReservesList[i] = specificReservesScaled_[params.assetAddress] + trueScaledDeposit;
      specificReservesScaled_[targetAssetParamsList_[i].assetAddress] = scaledReservesList[i];
    }
    totalReservesScaled_ += totalReservesIncrease;
    checkMaxTotalReservesLimit();

    indexToken_.mint(
      _recipient,
      _mintAmount
    );

    feesCollected_ += fee;

    emit Mint(
      _recipient,
      _mintAmount,
      scaledReservesList,
      fee
    );
  }

  function burn(uint256 _burnAmount) external nonReentrant {
    indexToken_.burnFrom(msg.sender, _burnAmount);
    uint256 totalReserveReduction = 0;
    uint256 fee = PoolMath.fromFixed(_burnAmount * burnFeeQ128_);
    uint256 trueBurnAmount = _burnAmount - fee;
    uint256[] memory scaledReservesList = new uint256[](currentAssetParamsList_.length);
    for (uint i = 0; i < currentAssetParamsList_.length; i++) {
      AssetParams memory params = currentAssetParamsList_[i];
      uint256 currentAllocation = PoolMath.toFixed(specificReservesScaled_[params.assetAddress]) / totalReservesScaled_;

      /*
        There is a target scaled transfer amount and a true scaled transfer amount because
        we may not be able to send the exact target transfer amount because of precision loss
        when scaling the transfer amount to the asset's decimals.
      */
      uint256 targetScaledTransferAmount = PoolMath.fromFixed(currentAllocation * trueBurnAmount);
      uint256 trueTransferAmount = PoolMath.scaleDecimals(targetScaledTransferAmount, DECIMAL_SCALE, params.decimals);
      uint256 trueScaledTransferAmount = PoolMath.scaleDecimals(trueTransferAmount, params.decimals, DECIMAL_SCALE);

      IERC20(params.assetAddress).transfer(msg.sender, trueTransferAmount);
      totalReserveReduction += trueScaledTransferAmount;
      scaledReservesList[i] = specificReservesScaled_[params.assetAddress] - trueScaledTransferAmount;
    }
    totalReservesScaled_ -= totalReserveReduction;
    feesCollected_ += fee;

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
  function swapTowardsTarget(
    address _asset,
    int256 _delta// the change in reserves from the pool's perspective, positive is a deposit, negative is a withdrawal
  ) external nonReentrant {
    AssetParams memory params = assetParams_[_asset];
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
      require(targetDepositScaled <= uint256(maxDelta), "deposit exceeds target allocation");
      uint256 trueDeposit = PoolMath.scaleDecimals(
        targetDepositScaled,
        DECIMAL_SCALE,
        params.decimals
      );
      IERC20(_asset).transferFrom(msg.sender, address(this), trueDeposit);
      uint256 trueDepositScaled = PoolMath.scaleDecimals(
        trueDeposit,
        params.decimals,
        DECIMAL_SCALE
      );
      specificReservesScaled_[_asset] += trueDepositScaled;
      totalReservesScaled_ += trueDepositScaled;
      indexToken_.mint(
        msg.sender,
        trueDepositScaled
      );
    } else { // withdraw
      uint256 targetDepositScaled = PoolMath.scaleDecimals(
        uint256(_delta * -1),
        params.decimals,
        DECIMAL_SCALE
      );    
      require(targetDepositScaled <= uint256(maxDelta * -1), "withdraw exceeds target allocation");
      uint256 trueWithdrawal = PoolMath.scaleDecimals(
        targetDepositScaled,
        DECIMAL_SCALE,
        params.decimals
      );
      IERC20(_asset).transfer(msg.sender, trueWithdrawal);
      uint256 trueWithdrawalScaled = PoolMath.scaleDecimals(
        trueWithdrawal,
        params.decimals,
        DECIMAL_SCALE
      );
      specificReservesScaled_[_asset] -= trueWithdrawalScaled;
      totalReservesScaled_ -= trueWithdrawalScaled;
      indexToken_.burnFrom(msg.sender, trueWithdrawalScaled);
    }
    emit Swap(
      _asset,
      _delta
    );
  }

  // the caller exchanges all assets with the pool such that the current allocations match the target allocations when finished
  // also retires assets from the currentAssetParamsList if they were removed completely by this action
  function equalizeToTarget(bool _execute) external returns (int256[] memory deltas) {
    //calculate the deltas required to equalize the current allocations to the target allocations
    deltas = new int256[](currentAssetParamsList_.length);
    for(uint i = 0; i < currentAssetParamsList_.length; i++) {
      AssetParams memory params = currentAssetParamsList_[i];
      int256 targetReserves = int256(PoolMath.allocationToFixed(params.targetAllocation)) * int256(totalReservesScaled_);
      deltas[i] = targetReserves - int256(specificReservesScaled_[params.assetAddress]);
    }

    //actually execute the transfers instead of just calculating the deltas
    if(_execute) {
      for(uint i = 0; i < currentAssetParamsList_.length; i++) {
        AssetParams memory params = currentAssetParamsList_[i];
        if(deltas[i] > 0) {// deposit
          IERC20(params.assetAddress).transferFrom(
            msg.sender, 
            address(this), 
            PoolMath.scaleDecimals(uint256(deltas[i]), DECIMAL_SCALE, params.decimals)
          );
          specificReservesScaled_[params.assetAddress] += uint256(deltas[i]);
        } else {//withdraw
          IERC20(params.assetAddress).transfer(
            msg.sender, 
            PoolMath.scaleDecimals(uint256(-deltas[i]), DECIMAL_SCALE, params.decimals)
          );
          specificReservesScaled_[params.assetAddress] -= uint256(deltas[i] * -1);
        }
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
    }
    return deltas;
  }


  /*
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~Public Getters~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  */

  function getMintFeeQ128() external view returns (uint256) {
    return mintFeeQ128_;
  }

  function getBurnFeeQ128() external view returns (uint256) {
    return burnFeeQ128_;
  }

  function getIsMintEnabled() external view returns (bool) {
    return isMintEnabled_;
  }

  function getFeesCollected() external view returns (uint256) {
    return feesCollected_ - 1;
  }

  function getIndexToken() external view returns (address) {
    return address(indexToken_);
  }

  function getAdmin() external view returns (address) {
    return admin_;
  }

  function getAllAssets() external view returns (address[] memory) {
      address[] memory assetsList = new address[](currentAssetParamsList_.length);
      for (uint i = 0; i < currentAssetParamsList_.length; i++) {
          assetsList[i] = currentAssetParamsList_[i].assetAddress;
      }
      return assetsList;
  }

  function getCurrentAssetParams() external view returns (AssetParams[] memory) {
    return currentAssetParamsList_;
  }

  function getTargetAssetParams() external view returns (AssetParams[] memory) {
    return targetAssetParamsList_;
  }

  function getAssetParams(address asset) external view returns (AssetParams memory) {
    return assetParams_[asset];
  }

  function getSpecificReservesScaled(address asset) external view returns (uint256) {
    return specificReservesScaled_[asset];
  }

  function getTotalReservesScaled() external view returns (uint256) {
    return totalReservesScaled_;
  }

  //returns the actual reserves of _asset in atomic units
  function getSpecificReserves(address _asset) external view returns (uint256) {
    return PoolMath.scaleDecimals(specificReservesScaled_[_asset], DECIMAL_SCALE, assetParams_[_asset].decimals);
  }

  function getMaxReserves() external view returns (uint256) {
    return maxReserves_;
  }

  function getMaxReservesIncreaseRateQ128() external view returns (uint256) {
    return maxReservesIncreaseRateQ128_;
  }

  function getMaxReservesIncreaseCooldown() external view returns (uint256) {
    return maxReservesIncreaseCooldown_;
  }

  function getLastMaxReservesChangeTimestamp() external view returns (uint256) {
    return lastMaxReservesChangeTimestamp_;
  }

  /*
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~Admin Functions~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  */

  modifier onlyAdmin {
    require(msg.sender == admin_, "only_admin");
    _;
  }

  function setAdmin(address _newAdmin) external onlyAdmin {
    admin_ = _newAdmin;
    emit AdminChange(_newAdmin);
  }

  function setMintFeeQ128(uint256 _mintFeeQ128) external onlyAdmin {
    mintFeeQ128_ = _mintFeeQ128;
    emit MintFeeChange(_mintFeeQ128);
  }

  function setBurnFeeQ128(uint256 _burnFeeQ128) external onlyAdmin {
    burnFeeQ128_ = _burnFeeQ128;
    emit BurnFeeChange(_burnFeeQ128);
  }

  function setMaxReserves(uint256 _maxReserves) external onlyAdmin {
    maxReserves_ = _maxReserves;
    lastMaxReservesChangeTimestamp_ = block.timestamp;
    emit MaxReservesChange(_maxReserves);
  }

  function setMaxReservesIncreaseRateQ128(uint256 _maxReservesIncreaseRateQ128) external onlyAdmin {
    maxReservesIncreaseRateQ128_ = _maxReservesIncreaseRateQ128;
    emit MaxReservesIncreaseRateChange(_maxReservesIncreaseRateQ128);
  }

  function setMaxReservesIncreaseCooldown(uint256 _maxReservesIncreaseCooldown) external onlyAdmin {
    maxReservesIncreaseCooldown_ = _maxReservesIncreaseCooldown;
    emit MaxReservesIncreaseCooldownChange(_maxReservesIncreaseCooldown);
  }

  function setTargetAssetParams(AssetParams[] calldata _params) external onlyAdmin {
    delete targetAssetParamsList_;
    AssetParams[] memory currentParamsList = currentAssetParamsList_;
    uint88 totalTargetAllocation = 0;
    for (uint i = 0; i < _params.length; i++) {
      assetParams_[_params[i].assetAddress] = _params[i];
      targetAssetParamsList_.push(_params[i]);
      emit TargetAssetParamsChange(
        _params[i].assetAddress,
        _params[i].targetAllocation,
        _params[i].decimals
      );
      totalTargetAllocation += _params[i].targetAllocation;
      //if the asset is not in the current params list, add it
      if (!assetIsInParamsList(_params[i].assetAddress, currentParamsList)) {
        currentAssetParamsList_.push(_params[i]);
        emit CurrentAssetParamsChange(
          _params[i].assetAddress,
          _params[i].targetAllocation,
          _params[i].decimals
        );
      }
    }
    require(totalTargetAllocation == type(uint88).max, "total target allocation must be 1");
  }

  function withdrawFees(address _recipient) external onlyAdmin {
    uint256 fees = feesCollected_ - 1;
    feesCollected_ = 1;
    indexToken_.mint(
      _recipient,
      fees
    );
    emit FeesCollected(fees);
  }


  function setIsMintEnabled(bool _isMintEnabled) external onlyAdmin {
    isMintEnabled_ = _isMintEnabled;
    emit IsMintEnabledChange(_isMintEnabled);
  }

  /*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~Helper Functions~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

  function checkMaxTotalReservesLimit() private {
    //check if max reserves limit has been violated
    if (totalReservesScaled_ > maxReserves_) {
      //check if max reserves increase is on cooldown
      require(lastMaxReservesChangeTimestamp_ + maxReservesIncreaseCooldown_ <= block.timestamp, "max reserves limit");
      //update the max reserves if it isn't on cooldown
      lastMaxReservesChangeTimestamp_ = block.timestamp;
      maxReserves_ += PoolMath.fromFixed(maxReserves_ * maxReservesIncreaseRateQ128_);
      require(maxReserves_ >= totalReservesScaled_, "max reserves limit");
      emit MaxReservesChange(
        maxReserves_
      );
    }
  }

  function assetIsInParamsList(address _asset, AssetParams[] memory _assetParams) private pure returns (bool) {
    for (uint i = 0; i < _assetParams.length; i++) {
      if (_assetParams[i].assetAddress == _asset) {
        return true;
      }
    }
    return false;
  }
}