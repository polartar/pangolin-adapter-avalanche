// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

struct PoolInfo {
    uint128 accRewardPerShare;
    uint64 lastRewardTime;
    uint64 allocPoint;
}
// interface IERC20 {
//     function totalSupply() external view returns (uint256);
//     function balanceOf(address account) external view returns (uint256);
//     function allowance(address owner, address spender) external view returns (uint256);
//     function approve(address spender, uint256 amount) external returns (bool);
//     event Transfer(address indexed from, address indexed to, uint256 value);
//     event Approval(address indexed owner, address indexed spender, uint256 value);

//     // EIP 2612
//     function permit(
//         address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s
//     ) external;
// }
struct UserInfo {
    uint256 amount;
    int256 rewardDebt;
}

interface IPangolinFarmingDeposit {
    function deposit(uint256 _amount) external;

    function rewardPerSecond() external view returns (uint256);

    function decimals() external view returns (uint256);

    function totalAllocPoint() external view returns (uint256);

    function poolInfos() external view returns (PoolInfo[] memory);

    function poolInfo(uint256 pid) external view returns (PoolInfo memory);

    function balanceOf(address account) external view returns (uint256);

    function withdraw(
        uint256 pid,
        uint256 amount,
        address to
    ) external;

    function lpTokens() external view returns (IERC20[] memory);

    function userInfo(uint256, address) external view returns (UserInfo memory);

    function pendingReward(uint256, address) external view returns (uint256);
}
