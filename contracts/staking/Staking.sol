// SPDX-License-Identifier: No-Lisence
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import "../token/XXXToken.sol";

contract Staking is AccessControl {
    bytes32 private constant DAO_ROLE = keccak256("DAO_ROLE");
    address private constant ROUTER01_ADDRESS =
        0xf164fC0Ec4E93095b804a4795bBe1e041497b92a;

    mapping(address => uint256) private _balances;

    uint256 public immutable lockPeriod;
    XXXToken public immutable stakingToken;
    XXXToken public immutable rewardToken;

    uint256 public rewardRate = 3; // percentages
    uint256 public rewardPeriod = 1 weeks;

    mapping(address => uint256) public rewards;
    mapping(address => uint256) public stakedTime;

    constructor(
        address _stakingToken,
        address _rewardToken,
        uint256 _lockPeriod,
        address dao
    ) {
        (stakingToken, rewardToken, lockPeriod) = (
            XXXToken(_stakingToken),
            XXXToken(_rewardToken),
            _lockPeriod
        );
        _grantRole(DAO_ROLE, dao);
    }

    function stake(uint256 _amount) external payable {
        require(_amount != 0, "Staking: Cannot stake zero tokens");
        IUniswapV2Router01(ROUTER01_ADDRESS).addLiquidityETH(
            address(stakingToken),
            _amount,
            1,
            1,
            _msgSender(),
            block.timestamp
        );

        _balances[_msgSender()] += _amount;
    }

    function unstake() external {
        require(
            _balances[_msgSender()] != 0,
            "Staking: You do not have staked tokens"
        );
        require(
            stakedTime[_msgSender()] + lockPeriod < block.timestamp,
            "Staking: Lock period is not over yet"
        );
        IUniswapV2Router01(ROUTER01_ADDRESS).removeLiquidityETH(
            address(stakingToken),
            _balances[_msgSender()],
            1,
            1,
            _msgSender(),
            block.timestamp
        );

        _balances[_msgSender()] = 0;
    }

    function claim() external {
        require(
            stakedTime[_msgSender()] + lockPeriod < block.timestamp,
            "Staking: Lock period is not over yet"
        );

        uint256 periods = (block.timestamp - stakedTime[_msgSender()]) /
            lockPeriod;
        uint256 amount = (periods * _balances[_msgSender()] * rewardRate) / 100;
        rewardToken.transfer(_msgSender(), amount);
    }
}
