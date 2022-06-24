// SPDX-License-Identifier: No-License
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Counters.sol";
import "./token/SomeToken.sol":

contract DAO {
    using Counters for Counters.Counter;

    struct Voting {
        uint256 startedTime;
        uint128 votesFor;
        uint128 votesAgainst;
    }

    Counters.Counter private votingsCount;
    uint256 private votingPeriod = 3 days;

    SomeToken public token;
    mapping(uint256 => Voting) public votings;
    mapping(uint256 => mapping(address => bool)) public voters;
    mapping(address => mapping(uint256 => uint128)) public balances;

    constructor(address _token) {
        token = SomeToken(_token);
    }

    function deposit(uint256 _amount) external {
        require(_amount != 0, "DAO: Cannot deposit zero tokens");
        token.transfer(_msgSender(), _amount);
    }

    function createVoting() external {
        votings[votingsCount.current()] = Voting({
            startedTime: block.timestamp,
            votesFor: 0,
            votesAgainst: 0
        });
        votingsCount.increment();
    }

    function vote(uint128 _amount, bool _voteFor, uint256 _votingId) external {
        require(voters[_votingId][msg.sender] == false, "DAO: You have already voted");
        require(_amount != 0, "DAO: Cannot vote with zero tokens");
        require(votings[_votingId].startedTime != 0, "DAO: Voting with such id does not exist");

        token.transferFrom(_msgSender(), address(this), _amount);
        balances[msg.sender][_votingId] = _amount;
        Voting storage voting = votings[_votingId];
        if (_voteFor == true)
            voting.votesFor += _amount;
        else
            voting.votesAgainst += _amount;
    }

    function finishVoting(uint256 _votingId) external {
        require(votings[_votingId].startedTime != 0, "DAO: Voting with such id does not exist");
        require(votings[_votingId].startedTime + votingPeriod < block.timestamp, "DAO: Voting is not finished yet");
        Voting storage voting = votings[_votingId];

        require(voting.votesAgainst != voting.votesFor, "DAO: 50 / 50 votes are detected");
        bool won = voting.votesFor > voting.votesAgainst;
        if (won == true) {
            // Give commission to owner
        }
        else {
            // Buy LPTokens for ETH on uniswap and then burn them
        }

        delete votings[_votingId];
    }
}