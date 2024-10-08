// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IMasterPenpie {

    function deposit(address _stakingToken, uint256 _amount) external;

    function depositFor(address _stakingToken, address _for, uint256 _amount) external;

    function withdraw(address _stakingToken, uint256 _amount) external;
    
    function multiclaim(address[] calldata _stakingTokens) external ; 

    function stakingInfo(address _stakingToken,address _user) external view returns (uint256 stakedAmount, uint256 availableAmount) ;

    function pendingTokens(address _stakingToken,address _user,address _rewardToken)external view returns (uint256 pendingPenpie,address bonusTokenAddress,string memory bonusTokenSymbol,uint256 pendingBonusToken) ;

}