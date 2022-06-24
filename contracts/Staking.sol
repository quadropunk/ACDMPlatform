// SPDX-License-Identifier: No-Lisence
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./token/SomeToken.sol";

contract Staking is AccessControl {
    SomeToken public immutable token;

    uint256 public lockPeriod;
    uint256 public rewardPeriod = 1 weeks;
    mapping(address => uint256) public stakers;
    mapping(address => uint256) public startedTime;

    constructor(address _token) {
        token = SomeToken(_token);
    }

    function stake(uint256 _amount) external {
        require(_amount != 0, "Staking: Cannot stake zero tokens");
        require(stakers[_msgSender()] == 0, "Staking: You've already staked");
        token.transferFrom(_msgSender(), address(this), _amount);
        stakers[_msgSender()] = _amount;
        startedTime[_msgSender()] = block.timestamp;
    }

    function unstake() external {
        require(stakers[_msgSender()] != 0, "Staking: You've not staked");
        require(startedTime[_msgSender()] + lockPeriod < block.timestamp, "Staking: Lock period is still on");
        token.transfer(_msgSender(), stakers[_msgSender()]);
        delete stakers[_msgSender()];
        delete startedTime[_msgSender()];
    }

    function claim() external {
        require(stakers[_msgSender()] != 0, "Staking: You've not staked");
        require(startedTime[_msgSender()] + rewardPeriod < block.timestamp, "Staking: Reward period is not over yet");
        uint256 periods = (block.timestamp - startedTime[_msgSender()]) / rewardPeriod;
        stakers[_msgSender()] *= (100 + 3 * periods) / 100;
        startedTime[_msgSender()] = block.timestamp;
    }
}
