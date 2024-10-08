// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISmartPendleConvertor {

    function maxSwapAmount() external view returns (uint256);

    function convert(uint256 _amountIn,uint256 _convertRatio,uint256 _minRec,uint256 _mode) external returns (uint256 obtainedMPendleAmount);

    function estimateTotalConversion(uint256 _amount,uint256 _convertRatio) external view returns (uint256 minimumEstimatedTotal);

    function smartConvert(
        uint256 _amountIn,
        uint256 _mode
    ) external returns (uint256 obtainedMPendleAmount) ;

    function mPendleOFT() external view returns (address);
    
    function router() external view returns (address);

    function masterPenpie() external view returns (address);

    function pendleMPendlePool() external view returns (address);
    
    function pendleAsset() external view returns (address);
    
    function currentRatio() external view returns (uint256);

    function buybackThreshold() external view returns (uint256);
}