// SPDX-License-Identifier: No-License
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Counters.sol";
import "./token/SomeToken.sol";

contract DAO {
    using Counters for Counters.Counter;

    struct Voting {
        uint256 startedTime;
        uint128 votesFor;
        uint128 votesAgainst;
        bytes wSignature; // signature for winning case
        bytes lSignature; // Signature for loosing case
        address wTargetContract;
        address lTargetContract;
    }

    mapping(uint256 => Voting) public votings;
    mapping(uint256 => mapping(address => bool)) public voters;
    mapping(address => mapping(uint256 => uint128)) public balances;

    SomeToken public immutable token;

    Counters.Counter private votingsCount;
    uint256 private immutable votingPeriod = 3 days;

    constructor(address _token) {
        token = SomeToken(_token);
    }

    event VotingCreated(
        bytes wSignature,
        bytes lSignature,
        address wTargetContract,
        address lTargetContract,
        uint256 startedTime
    );
    event Voted(uint128 amount, bool voteFor, uint256 indexed votingId);
    event VotingFinished(uint256 indexed votingId, bool won);

    function createVoting(
        bytes memory _wSignature,
        bytes memory _lSignature,
        address _wTargetContract,
        address _lTargetContract
    ) external {
        Voting memory v = votings[votingsCount.current()];
        v = Voting({
            startedTime: block.timestamp,
            votesFor: 0,
            votesAgainst: 0,
            wSignature: _wSignature,
            wTargetContract: _wTargetContract,
            lSignature: _lSignature,
            lTargetContract: _lTargetContract
        });

        emit VotingCreated(
            v.wSignature,
            v.lSignature,
            v.wTargetContract,
            v.lTargetContract,
            v.startedTime
        );
        votingsCount.increment();
    }

    function vote(
        uint128 _amount,
        bool _voteFor,
        uint256 _votingId
    ) external {
        require(
            voters[_votingId][msg.sender] == false,
            "DAO: You have already voted"
        );
        require(_amount != 0, "DAO: Cannot vote with zero tokens");
        require(
            votings[_votingId].startedTime != 0,
            "DAO: Voting with such id does not exist"
        );

        token.transferFrom(msg.sender, address(this), _amount);
        balances[msg.sender][_votingId] = _amount;
        Voting storage voting = votings[_votingId];
        if (_voteFor == true) voting.votesFor += _amount;
        else voting.votesAgainst += _amount;

        emit Voted(_amount, _voteFor, _votingId);
    }

    function finishVoting(uint256 _votingId) external {
        require(
            votings[_votingId].startedTime != 0,
            "DAO: Voting with such id does not exist"
        );
        require(
            votings[_votingId].startedTime + votingPeriod < block.timestamp,
            "DAO: Voting is not finished yet"
        );
        Voting storage voting = votings[_votingId];

        require(
            voting.votesAgainst != voting.votesFor,
            "DAO: 50 / 50 votes are detected"
        );
        if (voting.votesFor > voting.votesAgainst) {
            (bool success, ) = voting.wTargetContract.call{value: 0}(
                voting.wSignature
            );
            require(success, "ERROR call func");
        } else {
            (bool success, ) = voting.lTargetContract.call{value: 0}(
                voting.lSignature
            );
            require(success, "ERROR call func");
        }

        emit VotingFinished(_votingId, voting.votesFor > voting.votesAgainst);
        delete votings[_votingId];
    }
}
