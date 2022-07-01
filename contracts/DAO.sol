// SPDX-License-Identifier: No-License
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Counters.sol";
import "./Staking.sol";
import "./token/XXXToken.sol";

contract DAO {
    using Counters for Counters.Counter;

    struct Voting {
        uint256 startedTime;
        uint128 votesFor;
        uint128 votesAgainst;
        bytes signature;
        address targetContract;
    }

    XXXToken public immutable token;
    address public immutable staking;
    uint256 private immutable votingPeriod = 3 days;

    Counters.Counter private votingsCount;

    mapping(uint256 => Voting) public votings;
    mapping(address => uint256) public lastVotingEndTime;
    mapping(uint256 => mapping(address => bool)) public voters;
    mapping(address => mapping(uint256 => uint128)) public balances;

    constructor(address _token, bytes32 _merkleRoot) {
        token = XXXToken(_token);
        Staking stakingContract = new Staking(_token, _merkleRoot, address(this));
        staking = address(stakingContract);
    }

    event VotingCreated(
        bytes signature,
        address targetContract,
        uint256 startedTime
    );
    event Voted(uint128 amount, bool voteFor, uint256 indexed votingId);
    event VotingFinished(uint256 indexed votingId, bool won);

    modifier whiteList(bytes32[] calldata _merkleProof) {
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        require(
            MerkleProof.verify(_merkleProof, Staking(staking).merkleRoot(), leaf),
            "DAO: You are not added to the whitelist"
        );
        _;
    }

    function createVoting(
        bytes memory _signature,
        address _targetContract
    ) external {
        votings[votingsCount.current()] = Voting({
            startedTime: block.timestamp,
            votesFor: 0,
            votesAgainst: 0,
            signature: _signature,
            targetContract: _targetContract
        });

        emit VotingCreated(
            votings[votingsCount.current()].signature,
            votings[votingsCount.current()].targetContract,
            votings[votingsCount.current()].startedTime
        );
        votingsCount.increment();
    }

    function vote(
        bool _voteFor,
        uint256 _votingId
    ) external {
        require(
            voters[_votingId][msg.sender] == false,
            "DAO: You have already voted"
        );
        require(Staking(staking).stakers(msg.sender) != 0, "DAO: Cannot vote with zero tokens");
        require(
            votings[_votingId].startedTime != 0,
            "DAO: Voting with such id does not exist"
        );

        uint128 amount = Staking(staking).stakers(msg.sender);
        balances[msg.sender][_votingId] = amount;
        Voting storage voting = votings[_votingId];

        if (_voteFor == true) voting.votesFor += amount;
        else voting.votesAgainst += amount;

        lastVotingEndTime[msg.sender] = voting.startedTime + votingPeriod;
        voters[_votingId][msg.sender] = true;

        emit Voted(amount, _voteFor, _votingId);
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
            (bool success, ) = voting.targetContract.call{value: 0}(
                voting.signature
            );
            require(success, "ERROR call func");
        }

        emit VotingFinished(_votingId, voting.votesFor > voting.votesAgainst);
        delete votings[_votingId];
    }
}
