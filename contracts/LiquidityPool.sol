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

import "./LiquidityToken.sol";
import "openzeppelin/contracts/security/ReentrancyGuard.sol";
import "openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./PoolMath.sol";
import "./DataStructs.sol";
import "./ILiquidityPool.sol";


contract LiquidityPool is ReentrancyGuard, ILiquidityPool {
  //assets in this pool will be scaled to have this number of decimals
  //must be the same number of decimals as the liquidity token
  uint8 public immutable DECIMAL_SCALE;

  //pool state
  uint256 private feesCollected_ = 0;
  mapping(address => uint256) private specificReservesScaled_; //reserves scaled by 10^DECIMAL_SCALE
  uint256 private totalReservesScaled_; //the sum of all reserves scaled by 10^DECIMAL_SCALE

  //related contracts
  LiquidityToken private liquidityToken_;

  //configuration
  address private admin_;
  AssetParams[] private assetParamsList_;
  mapping(address => AssetParams) private assetParams_;
  uint256 private mintFeeQ128_ = 0;
  uint256 private burnFeeQ128_ = 0;
  uint256 private maxReservesIncreaseRateQ128_;//maxReservesLimit can be increased by this number * maxReservesLimit every time it is increased via public cooldown

  /*~~~~~~~~~~~~~~~~~~~~~loss prevention measures~~~~~~~~~~~~~~~~~~~~*/
  //admin switches
  bool private isMintEnabled_ = true;//emergency freeze function
  //burning is always enabled because disabling would violate user trust

  //automated max reserves limiting
  uint256 private maxReserves_;//the maximum numerical value of totalScaledReserves
  uint256 private maxReservesIncreaseCooldown_ = 1 days;//the delay before an unpriviledged user can increase the maxReservesLimit again
  uint256 private lastLimitChangeTimestamp_ = 0;

  constructor(
    address _admin,
    address _liquidityToken
    ) {
    liquidityToken_ = LiquidityToken(_liquidityToken);
    admin_ = _admin;
    DECIMAL_SCALE = LiquidityToken(_liquidityToken).decimals();
    maxReserves_ = 1e6 * DECIMAL_SCALE; //initial limit is 1 million scaled reserves
    maxReservesIncreaseRateQ128_ = PoolMath.toFixed(1) / 10; //the next limit will be 1/10th larger than the current limit
  }

  // emitted when a user mints the liquidity token directly in exchange
  // for depositing every asset in the pool at the same time
  // we can't track the deltas of each asset in this event.
  // they can be calculated by multiplying the mintAmount plus fees paid
  // by the targetAllocation of each asset 
  event Mint(
    address   indexed recipient,
    uint256   mintAmount,
    uint256[] scaledReserves,
    uint256   feesPaid
  );

  // emitted when a user burns the liquidity token directly
  // to redeem every asset in the pool at the same time
  // we can't track the deltas of each asset in this event.
  // they can be calculated by multiplying the burn amount 
  // minus feePaid by the current allocations of each asset
  event Burn(
    address   indexed recipient,
    uint256   burnAmount,
    uint256[] scaledReserves,
    uint256   feesPaid
  );

  event MintFeeChange(
    uint256 mintFeeQ128_
  );

  event BurnFeeChange(
    uint256 burnFeeQ128_
  );

  event AssetParamsChange(
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
    uint256[] memory scaledReservesList = new uint256[](assetParamsList_.length);
    uint256 totalReservesIncrease = 0;
    for (uint i = 0; i < assetParamsList_.length; i++) {
      AssetParams memory params = assetParamsList_[i];
      uint256 targetDeposit = PoolMath.fromFixed(
        PoolMath.allocationToFixed(params.targetAllocation) * trueMintAmount
      );
      uint256 trueDeposit = PoolMath.scaleDecimals(targetDeposit, DECIMAL_SCALE, params.decimals);
      uint256 trueScaledDeposit = PoolMath.scaleDecimals(trueDeposit, params.decimals, DECIMAL_SCALE);
      IERC20(params.assetAddress).transferFrom(msg.sender, address(this), trueDeposit);
      totalReservesIncrease += trueScaledDeposit;
      scaledReservesList[i] = specificReservesScaled_[params.assetAddress] + trueScaledDeposit;
      specificReservesScaled_[assetParamsList_[i].assetAddress] = scaledReservesList[i];
    }
    totalReservesScaled_ += totalReservesIncrease;
    checkMaxTotalReservesLimit();

    liquidityToken_.mint(
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
    liquidityToken_.burnFrom(msg.sender, _burnAmount);
    uint256 totalReserveReduction = 0;
    uint256 fee = PoolMath.fromFixed(_burnAmount * burnFeeQ128_);
    uint256 trueBurnAmount = _burnAmount - fee;
    uint256[] memory scaledReservesList = new uint256[](assetParamsList_.length);
    for (uint i = 0; i < assetParamsList_.length; i++) {
      AssetParams memory params = assetParamsList_[i];
      uint256 reserveProportion = PoolMath.toFixed(specificReservesScaled_[params.assetAddress]) / totalReservesScaled_;

      /*
        There is a target scaled transfer amount and a true scaled transfer amount because
        we may not be able to send the exact target transfer amount because of precision loss
        when scaling the transfer amount to the asset's decimals.
      */
      uint256 targetScaledTransferAmount = PoolMath.fromFixed(reserveProportion * trueBurnAmount);
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
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~Public Getters~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  */

  function getMaxReserves() external view returns (uint256) {
    return maxReserves_;
  }

  function getMaxReservesIncreaseRateQ128() external view returns (uint256) {
    return maxReservesIncreaseRateQ128_;
  }

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
    return feesCollected_;
  }

  function getLiquidityToken() external view returns (address) {
    return address(liquidityToken_);
  }

  function getAdmin() external view returns (address) {
    return admin_;
  }

function getAllAssets() external view returns (address[] memory) {
    address[] memory assetsList = new address[](assetParamsList_.length);
    for (uint i = 0; i < assetParamsList_.length; i++) {
        assetsList[i] = assetParamsList_[i].assetAddress;
    }
    return assetsList;
}


  function getAllAssetParams() external view returns (AssetParams[] memory) {
    return assetParamsList_;
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

  function getMaxReservesIncreaseCooldown() external view returns (uint256) {
    return maxReservesIncreaseCooldown_;
  }

  function getLastLimitChangeTimestamp() external view returns (uint256) {
    return lastLimitChangeTimestamp_;
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

  function setMaxReservesIncreaseCooldown(uint256 _maxReservesIncreaseCooldown) external onlyAdmin {
    maxReservesIncreaseCooldown_ = _maxReservesIncreaseCooldown;
    emit MaxReservesIncreaseCooldownChange(_maxReservesIncreaseCooldown);
  }

  function setMaxReservesIncreaseRateQ128(uint256 _maxReservesIncreaseRateQ128) external onlyAdmin {
    maxReservesIncreaseRateQ128_ = _maxReservesIncreaseRateQ128;
    emit MaxReservesIncreaseRateChange(_maxReservesIncreaseRateQ128);
  }

  function setMaxReserves(uint256 _maxReserves) external onlyAdmin {
    maxReserves_ = _maxReserves;
    lastLimitChangeTimestamp_ = block.timestamp;
    emit MaxReservesChange(_maxReserves);
  }

  function setAssetParams(AssetParams[] calldata _params) external onlyAdmin {
    delete assetParamsList_;
    for (uint i = 0; i < _params.length; i++) {
      assetParams_[_params[i].assetAddress] = _params[i];
      assetParamsList_.push(_params[i]);
      emit AssetParamsChange(
        _params[i].assetAddress,
        _params[i].targetAllocation,
        _params[i].decimals
      );
    }
  }

  function withdrawFees(address _recipient) external onlyAdmin {
    uint256 fees = feesCollected_ - 1;
    feesCollected_ = 1;
    liquidityToken_.mint(
      _recipient,
      fees
    );
    emit FeesCollected(fees);
  }


  function setIsMintEnabled(bool _isMintEnabled) external onlyAdmin {
    isMintEnabled_ = _isMintEnabled;
    emit IsMintEnabledChange(_isMintEnabled);
  }

  //transfer assets that have been inappropriately deposited
  function recoverFunds(address _asset, address _recipient, uint256 _amount) external onlyAdmin {
    if(_asset == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) {
      //transfer Ether
      (bool success, ) = _recipient.call{value: _amount}("");
      require(success, "Ether transfer failed");
    } else {
      uint8 tokenDecimals = assetParams_[_asset].decimals;
      uint256 expectedBalance = PoolMath.scaleDecimals(specificReservesScaled_[_asset], DECIMAL_SCALE, tokenDecimals);
      uint256 trueBalance = IERC20(_asset).balanceOf(address(this));
      uint256 diff = trueBalance - expectedBalance;
      require(_amount <= diff, "recovery larger than excess");
      IERC20(_asset).transfer(_recipient, _amount);
    }
  }

  /*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~Helper Functions~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

  function checkMaxTotalReservesLimit() private {
    //check if limit has been violated
    if (totalReservesScaled_ > maxReserves_) {
      //check if limit increase is on cooldown
      require(lastLimitChangeTimestamp_ + maxReservesIncreaseCooldown_ <= block.timestamp, "max reserves limit");
      //update the limit if it isn't on cooldown
      lastLimitChangeTimestamp_ = block.timestamp;
      maxReserves_ += PoolMath.fromFixed(maxReserves_ * maxReservesIncreaseRateQ128_);
      emit MaxReservesChange(
        maxReserves_
      );
    }
  }
}
