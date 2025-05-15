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
  address[] private assetsList_;
  mapping(address => AssetParams) private assetParams_;
  uint256 private mintFeeQ128_ = 0;
  uint256 private burnFeeQ128_ = 0;
  uint256 private maxReservesLimitRatioQ128_;

  /*~~~~~~~~~~~~~~~~~~~~~loss prevention measures~~~~~~~~~~~~~~~~~~~~*/
  //admin switches
  bool private isSwapEnabled_ = true;//emergency freeze function
  bool private isDirectMintEnabled_ = true;//emergency freeze function
  bool private isDepositEnabled_ = true;//emergency freeze function
  //burning is always enabled because disabling would violate user trust

  //automated max reserves limiting
  uint256 private maxReservesLimit_;//the maximum numerical value of totalScaledReserves
  uint256 private publicLimitIncreaseCooldown_ = 1 days;//the delay before an unpriviledged user can increase the maxReservesLimit again
  uint256 private lastLimitChangeTimestamp_ = 0;

  constructor(
    address _admin,
    address _liquidityToken,
    uint256 _initialMaxReservesLimit,
    uint256 _maxReservesLimitRatioQ128
    ) {
    liquidityToken_ = LiquidityToken(_liquidityToken);
    admin_ = _admin;
    DECIMAL_SCALE = LiquidityToken(_liquidityToken).decimals();
    maxReservesLimit_ = _initialMaxReservesLimit;
    maxReservesLimitRatioQ128_ = _maxReservesLimitRatioQ128;
  }

  event Deposit(
    address indexed sender,
    address indexed recipient,
    address depositAsset,
    uint256 depositAmount,
    uint256 mintAmount,
    uint256 feesPaid
  );

  event Withdraw(
    address indexed sender,
    address indexed recipient,
    address withdrawAsset,
    uint256 withdrawAmount,
    uint256 burnAmount,
    uint256 feesPaid
  );

  // emitted when a user mints the liquidity token directly in exchange
  // for depositing every asset in the pool at the same time
  // we can't track the deltas of each asset in this event.
  // they can be calculated by multiplying the mintAmount plus fees paid
  // by the targetAllocation of each asset 
  event Mint(
    address indexed recipient,
    uint256 mintAmount,
    uint256 feesPaid
  );

  // emitted when a user burns the liquidity token directly
  // to redeem every asset in the pool at the same time
  // we can't track the deltas of each asset in this event.
  // they can be calculated by multiplying the burn amount 
  // minus feePaid by the current allocations of each asset
  event Burn(
    address indexed recipient,
    uint256 burnAmount,
    uint256 feesPaid
  );

  event Swap(
    address indexed sender,
    address indexed recipient,
    address inputAsset,
    address outputAsset,
    int256 deltaInputScaled,
    int256 deltaOutputScaled,
    uint256 feesPaid
  );

  event ParamsUpdate(
    address indexed asset,
    uint32 targetAllocation,
    uint32 maxAllocation
  );

  event TickUpdate(
    address indexed asset,
    uint8 tickIndex,
    uint32 allocation,
    uint16 price,
    uint16 increaseFee,
    uint32 priceSlope
  );

  event EmergencyFreezeUpdate(
    bool isSwapEnabled,
    bool isDirectMintEnabled,
    bool isDepositEnabled
  );

  event MaxReservesLimitChange(
    uint256 maxReservesLimit
  );

  event PublicLimitIncraseCooldownChanged(
    uint256 publicLimitIncreaseCooldown
  );
  /*
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~Public Core Functions~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    These functions select the appropriate underlying action function and perform input/output checks
  */

  function swapGivenIn(
    address _recipient,
    address _inputAsset,
    address _outputAsset,
    uint256 _inputAmount,
    uint256 _minOutput
  ) external returns (uint256 output, uint256 fee) {
    require(_inputAsset != _outputAsset, "input/output assets are the same");
    if (_inputAsset == address(liquidityToken_)) {
      (output, fee) = handleWithdrawalGivenBurn(_outputAsset, _inputAmount, _recipient);
    } else if (_outputAsset == address(liquidityToken_)) {
      (output, fee) = handleMintGivenDeposit(_inputAsset, _inputAmount, _recipient);
    } else {
      (output, fee) = handleSwapUnderlyingGivenIn(_inputAsset, _outputAsset, _inputAmount, _recipient);
    }
    require(output >= _minOutput, "insufficient output");
  }

  function swapGivenOut(
    address _recipient,
    address _inputAsset,
    address _outputAsset,
    uint256 _outputAmount,
    uint256 _maxInput
  ) external returns (uint256 input, uint256 fee) {
    require(_inputAsset != _outputAsset, "input/output assets are the same");
    if (_inputAsset == address(liquidityToken_)) {
      (input, fee) = handleBurnGivenWithdraw(_outputAsset, _outputAmount, _recipient);
    } else if (_outputAsset == address(liquidityToken_)) {
      (input, fee) = handleDepositGivenMint(_inputAsset, _outputAmount, _recipient);
    } else {
      (input, fee) = handleSwapUnderlyingGivenOut(_inputAsset, _outputAsset, _outputAmount, _recipient);
    }
    require(input <= _maxInput, "too much input");
    return (input, fee);
  }

  /*
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~Public Getters~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  */

  function getMaxReservesLimit() external view returns (uint256) {
    return maxReservesLimit_;
  }

  function getMaxReservesLimitRatioQ128() external view returns (uint256) {
    return maxReservesLimitRatioQ128_;
  }

  function getMintFeeQ128() external view returns (uint256) {
    return mintFeeQ128_;
  }

  function getBurnFeeQ128() external view returns (uint256) {
    return burnFeeQ128_;
  }

  function getIsSwapEnabled() external view returns (bool) {
    return isSwapEnabled_;
  }

  function getIsDirectMintEnabled() external view returns (bool) {
    return isDirectMintEnabled_;
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
    return assetsList_;
  }

  function getAsset(uint index) external view returns (address) {
    return assetsList_[index];
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

  function getPriceQ128(address _asset) external view returns (uint256) {
    uint256 specificReservesScaled = specificReservesScaled_[_asset];
    AssetParams memory assetParams = assetParams_[_asset];
    uint tickLowerBoundIndex = PoolMath.getTickLowerBoundIndex(assetParams, specificReservesScaled, totalReservesScaled_);
    TickData memory tickData = assetParams.tickData[tickLowerBoundIndex];
    return PoolMath.calcPrice(tickData, specificReservesScaled, totalReservesScaled_);
  }

  function getLowerTick(address _asset) external view returns (TickData memory) {
    uint256 totalReservesScaled = totalReservesScaled_;
    uint256 specificReservesScaled = specificReservesScaled_[_asset];
    uint i = PoolMath.getTickLowerBoundIndex(assetParams_[_asset], specificReservesScaled, totalReservesScaled);
    return assetParams_[_asset].tickData[i];
  }

  /*
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~Admin Functions~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  */

  modifier onlyAdmin {
    require(msg.sender == admin_, "only_admin");
    _;
  }

  function setMintFeeQ128(uint256 _mintFeeQ128) external onlyAdmin {
    mintFeeQ128_ = _mintFeeQ128;
  }

  function setBurnFeeQ128(uint256 _burnFeeQ128) external onlyAdmin {
    burnFeeQ128_ = _burnFeeQ128;
  }

  function setPublicLimitIncreaseCooldown(uint256 _publicLimitIncreaseCooldown) external onlyAdmin {
    publicLimitIncreaseCooldown_ = _publicLimitIncreaseCooldown;
    emit PublicLimitIncraseCooldownChanged(_publicLimitIncreaseCooldown);
  }

  function setAssetParams(address[] calldata assetAddresses, AssetParams[] calldata _params) external onlyAdmin {
    for (uint i = 0; i < assetsList_.length; i++) {
      delete assetParams_[assetsList_[i]];
    }
    delete assetsList_;
    for (uint i = 0; i < _params.length; i++) {
      assetsList_.push(assetAddresses[i]);
      assetParams_[assetAddresses[i]] = _params[i];
    }
  }

  function withdrawFees(address _recipient) external onlyAdmin {
    uint256 fees = feesCollected_ - 1;
    //check that all tokens are liquidity by 1 unit of totalReserves.
    //it may be possible to 
    uint256 totalLiquidityTokens = fees + liquidityToken_.totalSupply();
    //If there is a defecit, use fees to pay it before withdrawal
    if(totalReservesScaled_  < totalLiquidityTokens) {
      uint256 shortfall = totalLiquidityTokens - totalReservesScaled_;
      require(shortfall <= fees, "insufficient fees to cover shortfall");
      fees -= shortfall;
    }
    feesCollected_ = 1;
    liquidityToken_.mint(
      _recipient,
      fees
    );
  }

  function setIsSwapEnabled(bool _isSwapEnabled) external onlyAdmin {
    isSwapEnabled_ = _isSwapEnabled;
    emit EmergencyFreezeUpdate(_isSwapEnabled, isDirectMintEnabled_, isDepositEnabled_);
  }

  function setIsDirectMintEnabled(bool _isDirectMintEnabled) external onlyAdmin {
    isDirectMintEnabled_ = _isDirectMintEnabled;
    emit EmergencyFreezeUpdate(isSwapEnabled_, _isDirectMintEnabled, isDepositEnabled_);
  }

    function setIsDepositEnabled(bool _isDepositEnabled) external onlyAdmin {
    isDepositEnabled_ = _isDepositEnabled;
    emit EmergencyFreezeUpdate(isSwapEnabled_, isDirectMintEnabled_, _isDepositEnabled);
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

  /*
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~Bootstrapping Functions~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    These functions are only intended to be used in situations where liquidity is very low,
    so the normal deposit/withdraw functions are not realistically usable
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  */

  function mint(uint256 _mintAmount, address _recipient) external nonReentrant {
    require(isDirectMintEnabled_, "direct minting disabled");
    require(isDepositEnabled_, "deposits disabled");
    uint256 fee = PoolMath.fromFixed(_mintAmount * PoolMath.calcCompoundingFeeRate(mintFeeQ128_));
    uint256 trueMintAmount = _mintAmount + fee;
    for (uint i = 0; i < assetsList_.length; i++) {
      address asset = assetsList_[i];
      AssetParams memory params = assetParams_[asset];
      uint256 targetDeposit = PoolMath.fromFixed(
        PoolMath.allocationToFixed(params.targetAllocation) * trueMintAmount
      );
      uint256 trueDeposit = PoolMath.scaleDecimals(targetDeposit, DECIMAL_SCALE, params.decimals);
      uint256 trueScaledDeposit = PoolMath.scaleDecimals(trueDeposit, params.decimals, DECIMAL_SCALE);
      IERC20(asset).transferFrom(msg.sender, address(this), trueDeposit);
      totalReservesScaled_ += trueScaledDeposit;
      specificReservesScaled_[asset] += trueScaledDeposit;
    }

    checkMaxTotalReservesLimit();

    liquidityToken_.mint(
      _recipient,
      _mintAmount
    );

    feesCollected_ += fee;

    emit Mint(
      _recipient,
      _mintAmount,
      fee
    );
  }

  function burn(uint256 _burnAmount) external nonReentrant {
    liquidityToken_.burnFrom(msg.sender, _burnAmount);
    uint256 totalReserveReduction = 0;
    uint256 fee = PoolMath.fromFixed(_burnAmount * burnFeeQ128_);
    uint256 trueBurnAmount = _burnAmount - fee;
    for (uint i = 0; i < assetsList_.length; i++) {
      address asset = assetsList_[i];
      uint256 reserveProportion = PoolMath.toFixed(specificReservesScaled_[asset]) / totalReservesScaled_;

      /*
        There is a target scaled transfer amount and a true scaled transfer amount because
        we may not be able to send the exact target transfer amount because of precision loss
        due to rounding.
      */
      uint256 targetScaledTransferAmount = PoolMath.fromFixed(reserveProportion * trueBurnAmount);
      uint256 trueTransferAmount = PoolMath.scaleDecimals(targetScaledTransferAmount, DECIMAL_SCALE, assetParams_[asset].decimals);
      uint256 trueScaledTransferAmount = PoolMath.scaleDecimals(trueTransferAmount, assetParams_[asset].decimals, DECIMAL_SCALE);

      IERC20(asset).transfer(msg.sender, trueTransferAmount);
      totalReserveReduction += trueScaledTransferAmount;
      specificReservesScaled_[asset] -= trueScaledTransferAmount;
    }
    totalReservesScaled_ -= totalReserveReduction;

    emit Burn(
      msg.sender,
      _burnAmount,
      fee
    );
  }

  /*
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~Private/Internal Functions~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  */

  function handleMintGivenDeposit(
    address _depositAsset,
    uint256 _depositAmount,
    address _recipient
  ) internal returns (uint256 mintAmount, uint256 fee) {
    //prepare values
    AssetParams memory params = assetParams_[_depositAsset];
    uint256 depositAmountScaled = PoolMath.scaleDecimals(_depositAmount, params.decimals, DECIMAL_SCALE);
    uint256 specificReservesScaled = specificReservesScaled_[_depositAsset];
    uint256 totalReservesScaled = totalReservesScaled_;
    //compute deposit
    (mintAmount, fee) = PoolMath.computeMintGivenDeposit(
      params,
      depositAmountScaled,
      specificReservesScaled,
      totalReservesScaled
    );

    //check new allocations
    specificReservesScaled += depositAmountScaled;
    totalReservesScaled += depositAmountScaled;
    checkAllocationsDeposit(
      _depositAsset,
      params.maxAllocation,
      specificReservesScaled,
      totalReservesScaled
    );

    //update storage
    specificReservesScaled_[_depositAsset] = specificReservesScaled;
    totalReservesScaled_ = totalReservesScaled;

    checkMaxTotalReservesLimit();

    //transfer tokens
    IERC20(_depositAsset).transferFrom(msg.sender, address(this), _depositAmount);
    liquidityToken_.mint(_recipient, mintAmount);
    feesCollected_ += fee;

    //emit event
    emit Deposit(
      msg.sender,
      _recipient,
      _depositAsset,
      _depositAmount,
      mintAmount,
      fee
    );
  }

  function handleDepositGivenMint(
    address _depositAsset,
    uint256 _mintAmount,
    address _recipient
  ) internal returns (uint256 depositAmount, uint256 fee) {
    //prepare values
    AssetParams memory params = assetParams_[_depositAsset];
    uint256 specificReservesScaled = specificReservesScaled_[_depositAsset];
    uint256 totalReservesScaled = totalReservesScaled_;

    //compute deposit
    uint256 depositAmountScaled;
    (depositAmountScaled, fee) = PoolMath.computeDepositGivenMint(
      params, 
      _mintAmount,
      specificReservesScaled,
      totalReservesScaled
    );

    //check new allocations
    specificReservesScaled += depositAmountScaled;
    totalReservesScaled += depositAmountScaled;
    checkAllocationsDeposit(
      _depositAsset,
      params.maxAllocation,
      specificReservesScaled,
      totalReservesScaled
    );

    //update storage
    specificReservesScaled_[_depositAsset] = specificReservesScaled;
    totalReservesScaled_ = totalReservesScaled;

    checkMaxTotalReservesLimit();

    //transfer tokens
    depositAmount = PoolMath.scaleDecimals(depositAmountScaled, DECIMAL_SCALE, params.decimals);
    IERC20(_depositAsset).transferFrom(msg.sender, address(this), depositAmount);
    liquidityToken_.mint(_recipient, _mintAmount);
    feesCollected_ += fee;

    //emit event
    emit Deposit(
      msg.sender,
      _recipient,
      _depositAsset,
      depositAmount,
      _mintAmount,
      fee
    );
  }

  function handleBurnGivenWithdraw(
    address _withdrawAsset,
    uint256 _withdrawAmount,
    address _recipient
  ) internal returns (uint256 burnAmount, uint256 fee) {
    //prepare values
    AssetParams memory params = assetParams_[_withdrawAsset];
    uint256 withdrawAmountScaled = PoolMath.scaleDecimals(_withdrawAmount, params.decimals, DECIMAL_SCALE);
    uint256 specificReservesScaled = specificReservesScaled_[_withdrawAsset];
    uint256 totalReservesScaled = totalReservesScaled_;

    //compute deposit
    (burnAmount, fee) = PoolMath.computeBurnGivenWithdrawal(
      params, 
      withdrawAmountScaled,
      specificReservesScaled,
      totalReservesScaled
    );

    //check new allocations
    specificReservesScaled -= withdrawAmountScaled;
    totalReservesScaled -= withdrawAmountScaled;
    checkAllocationsWithdraw(
      _withdrawAsset,
      params.minAllocation,
      specificReservesScaled,
      totalReservesScaled
    );

    //update storage
    specificReservesScaled_[_withdrawAsset] = specificReservesScaled;
    totalReservesScaled_ = totalReservesScaled;

    //transfer tokens
    IERC20(_withdrawAsset).transfer(_recipient, _withdrawAmount);
    liquidityToken_.burnFrom(msg.sender, burnAmount);
    feesCollected_ += fee;

    //emit event
    emit Withdraw(
      msg.sender,
      _recipient,
      _withdrawAsset,
      _withdrawAmount,
      burnAmount,
      fee
    );
  }

  function handleWithdrawalGivenBurn(
    address _withdrawAsset,
    uint256 _burnAmount,
    address _recipient
  ) internal returns (uint256 withdrawAmount, uint256 fee) {
    //prepare values
    AssetParams memory params = assetParams_[_withdrawAsset];
    uint256 specificReservesScaled = specificReservesScaled_[_withdrawAsset];
    uint256 totalReservesScaled = totalReservesScaled_;
    
    //compute withdrawal
    uint256 withdrawAmountScaled;
    (withdrawAmountScaled, fee) = PoolMath.computeWithdrawalGivenBurn(
      params, 
      _burnAmount,
      specificReservesScaled,
      totalReservesScaled
    );

    //check new allocations
    specificReservesScaled -= withdrawAmountScaled;
    totalReservesScaled -= withdrawAmountScaled;
    checkAllocationsWithdraw(
      _withdrawAsset,
      params.minAllocation,
      specificReservesScaled,
      totalReservesScaled
    );

    //update storage
    specificReservesScaled_[_withdrawAsset] = specificReservesScaled;
    totalReservesScaled_ = totalReservesScaled;

    //transfer tokens
    withdrawAmount = PoolMath.scaleDecimals(withdrawAmountScaled, DECIMAL_SCALE, params.decimals);
    IERC20(_withdrawAsset).transfer(msg.sender, withdrawAmount);
    liquidityToken_.burnFrom(_recipient, _burnAmount);
    feesCollected_ += fee;

    //emit event
    emit Withdraw(
      msg.sender,
      _recipient,
      _withdrawAsset,
      withdrawAmount,
      _burnAmount,
      fee
    );
  }

  function handleSwapUnderlyingGivenIn(
    address _inputAsset,
    address _outputAsset,
    uint256 _inputAmount,
    address _recipient
  ) internal returns (uint256, /* outputAmount */ uint256 /* fee */) {
    //prepare values
    AssetParams memory inputAssetParams = assetParams_[_inputAsset];
    AssetParams memory outputAssetParams = assetParams_[_outputAsset];
    uint256 inputReservesScaled = specificReservesScaled_[_inputAsset];
    uint256 outputReservesScaled = specificReservesScaled_[_outputAsset];
    uint256 inputAmountScaled = PoolMath.scaleDecimals(_inputAmount, inputAssetParams.decimals, DECIMAL_SCALE);

    //compute swap
    (uint256 outputAmountScaled, uint256 fee) = PoolMath.computeSwapUnderlyingGivenIn(
      inputAssetParams,
      outputAssetParams,
      inputAmountScaled,
      inputReservesScaled,
      outputReservesScaled,
      totalReservesScaled_
    );

    //check new allocations
    inputReservesScaled += inputAmountScaled;
    outputReservesScaled -= outputAmountScaled;
    //totalReservesScaled storage variable must be updated first because
    //there is not enough stack space to create a cached version
    totalReservesScaled_ += inputAmountScaled - outputAmountScaled;
    checkAllocationsSwap(
      inputReservesScaled,
      outputReservesScaled,
      totalReservesScaled_,
      inputAssetParams.maxAllocation,
      outputAssetParams.minAllocation
    );

    //update storage
    specificReservesScaled_[_inputAsset] = inputReservesScaled;
    specificReservesScaled_[_outputAsset] = outputReservesScaled;
    feesCollected_ += fee;

    //transfer tokens
    uint256 outputAmount = PoolMath.scaleDecimals(outputAmountScaled, DECIMAL_SCALE, outputAssetParams.decimals);
    IERC20(_inputAsset).transferFrom(msg.sender, address(this), _inputAmount);
    IERC20(_outputAsset).transfer(_recipient, outputAmount);

    //emit swap event
    emit Swap(
      msg.sender,
      _recipient,
      _inputAsset,
      _outputAsset,
      int256(inputAmountScaled),
      -int256(outputAmountScaled),
      fee
    );

    return (outputAmount, fee);
  }

  function handleSwapUnderlyingGivenOut(
    address _inputAsset,
    address _outputAsset,
    uint256 _outputAmount,
    address _recipient
  ) internal returns (uint256, /* inputAmount */ uint256 /* fee */) {
    //prepare values
    AssetParams memory inputAssetParams = assetParams_[_inputAsset];
    AssetParams memory outputAssetParams = assetParams_[_outputAsset];
    uint256 inputReservesScaled = specificReservesScaled_[_inputAsset];
    uint256 outputReservesScaled = specificReservesScaled_[_outputAsset];
    uint256 outputAmountScaled = PoolMath.scaleDecimals(_outputAmount, outputAssetParams.decimals, DECIMAL_SCALE);

    //compute swap
    (uint256 inputAmountScaled, uint256 fee) = PoolMath.computeSwapUnderlyingGivenOut(
      inputAssetParams,
      outputAssetParams,
      outputAmountScaled,
      inputReservesScaled,
      outputReservesScaled,
      totalReservesScaled_
    );

    //check new allocations
    inputReservesScaled += inputAmountScaled;
    outputReservesScaled -= outputAmountScaled;
    //totalReservesScaled storage variable must be updated first because
    //there is not enough stack space to create a cached version
    totalReservesScaled_ += inputAmountScaled - outputAmountScaled;
    checkAllocationsSwap(
      inputReservesScaled,
      outputReservesScaled,
      totalReservesScaled_,
      inputAssetParams.maxAllocation,
      outputAssetParams.minAllocation
    );

    //update storage
    specificReservesScaled_[_inputAsset] = inputReservesScaled;
    specificReservesScaled_[_outputAsset] = outputReservesScaled;
    feesCollected_ += fee;

    //transfer tokens
    uint256 inputAmount = PoolMath.scaleDecimals(inputAmountScaled, DECIMAL_SCALE, inputAssetParams.decimals);
    IERC20(_inputAsset).transferFrom(msg.sender, address(this), inputAmount);
    IERC20(_outputAsset).transfer(_recipient, _outputAmount);

    //emit swap event
    emit Swap(
      msg.sender,
      _recipient,
      _inputAsset,
      _outputAsset,
      int256(inputAmountScaled),
      -int256(outputAmountScaled),
      fee
    );

    return (inputAmount, fee);
  }

  /*
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~Allocation Checks~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    These functions are used to check the allocations of the pool after a deposit/withdrawal/swap
    to ensure that they are within the limits set by the assetParams.
    They are called from the handleDeposit/handleWithdraw/handleSwap functions.
  */

  //prepares data for allocation checks via PoolMath.allocationCheck()
  function checkAllocationsDeposit(
    address _depositAsset,
    uint32 _depositAssetMaxAllocation,
    uint256 _depositAssetReservesScaled,
    uint256 _totalReservesScaled
  ) private view {
    //check the max allocation of the asset whose allocation is increasing
    PoolMath.maxAllocationCheck(
      _depositAssetMaxAllocation,
      _depositAssetReservesScaled,
      _totalReservesScaled
    );

    //check the min allocation of all other assets
    for (uint i = 0; i < assetsList_.length; i++) {
      address asset = assetsList_[i];
      if (asset != _depositAsset) {
        PoolMath.minAllocationCheck(
          assetParams_[asset].minAllocation,
          specificReservesScaled_[asset],
          _totalReservesScaled
        );
      }
    }
  }

    //prepares data for allocation checks via PoolMath.allocationCheck()
  function checkAllocationsWithdraw(
    address _withdrawAsset,
    uint32 _withdrawAssetMinAllocation,
    uint256 _withdrawAssetReservesScaled,
    uint256 _totalReservesScaled
  ) private view {
    //check the min allocation of the asset whose allocation is decreasing
    PoolMath.minAllocationCheck(
      _withdrawAssetMinAllocation,
      _withdrawAssetReservesScaled,
      _totalReservesScaled
    );

    //check the max allocation of all other assets
    for (uint i = 0; i < assetsList_.length; i++) {
      address asset = assetsList_[i];
      if (asset != _withdrawAsset) {
        PoolMath.maxAllocationCheck(
          assetParams_[asset].maxAllocation,
          specificReservesScaled_[asset],
          _totalReservesScaled
        );
      }
    }
  }

  function checkAllocationsSwap(
    uint256 _inputAssetReservesScaled,
    uint256 _outputAssetReservesScaled,
    uint256 _totalReservesScaled,
    uint32 _inputAssetMaxAllocation,
    uint32 _outputAssetMinAllocation
  ) private pure {
    //check the max allocation of the asset whose allocation is increasing
    PoolMath.maxAllocationCheck(
      _inputAssetMaxAllocation,
      _inputAssetReservesScaled,
      _totalReservesScaled
    );

    //check the min allocation of the asset whose allocation is decreasing
    PoolMath.minAllocationCheck(
      _outputAssetMinAllocation,
      _outputAssetReservesScaled,
      _totalReservesScaled
    );
  }

  function checkMaxTotalReservesLimit() private {
    //check if limit has been violated
    if (totalReservesScaled_ > maxReservesLimit_) {
      //check if limit increase is on cooldown
      require(lastLimitChangeTimestamp_ + publicLimitIncreaseCooldown_ <= block.timestamp, "max reserves limit");
      //update the limit if it isn't on cooldown
      lastLimitChangeTimestamp_ = block.timestamp;
      maxReservesLimit_ += PoolMath.fromFixed(maxReservesLimit_ * maxReservesLimitRatioQ128_);
      emit MaxReservesLimitChange(
        maxReservesLimit_
      );
    }
  }
}
