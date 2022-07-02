// SPDX-License-Identifier: No-Lisence
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./token/XXXToken.sol";
import "./DAO.sol";

contract Staking is AccessControl {
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");

    XXXToken public immutable token;

    uint128 public immutable rewardPeriod = 1 weeks;
    uint128 private immutable rewardRate = 3;
    address private immutable dao;

    bytes32 public merkleRoot;
    mapping(address => uint128) public stakers;
    mapping(address => uint128) public startedTime;

    constructor(
        address _token,
        bytes32 _merkleRoot,
        address _dao
    ) {
        (token, merkleRoot, dao) = (XXXToken(_token), _merkleRoot, _dao);
        _grantRole(DAO_ROLE, _dao);
    }

    event Staked(address to, uint256 amount, uint256 startedTime);
    event Unstaked(address to, uint256 amount, uint256 startedTime);
    event Claimed(address to, uint256 amount, uint256 startedTime);

    modifier whiteList(bytes32[] calldata _merkleProof) {
        bytes32 leaf = keccak256(abi.encodePacked(_msgSender()));
        require(
            MerkleProof.verify(_merkleProof, merkleRoot, leaf),
            "Staking: You are not added to the whitelist"
        );
        _;
    }

    function stake(uint128 _amount, bytes32[] calldata _merkleProof)
        external
        whiteList(_merkleProof)
    {
        require(_amount != 0, "Staking: Cannot stake zero tokens");
        require(stakers[_msgSender()] == 0, "Staking: You've already staked");

        token.transferFrom(_msgSender(), address(this), _amount);
        stakers[_msgSender()] = _amount;
        startedTime[_msgSender()] = uint128(block.timestamp);

        emit Staked(
            _msgSender(),
            stakers[_msgSender()],
            startedTime[_msgSender()]
        );
    }

    function unstake() external {
        require(stakers[_msgSender()] != 0, "Staking: You've not staked");
        require(
            DAO(dao).lastVotingEndTime(_msgSender()) < block.timestamp,
            "Staking: You cannot unstake till you vote"
        );

        token.transfer(_msgSender(), stakers[_msgSender()]);

        emit Unstaked(
            _msgSender(),
            stakers[_msgSender()],
            startedTime[_msgSender()]
        );

        delete stakers[_msgSender()];
        delete startedTime[_msgSender()];
    }

    function claim() external {
        require(stakers[_msgSender()] != 0, "Staking: You've not staked");
        require(
            startedTime[_msgSender()] + rewardPeriod < block.timestamp,
            "Staking: Reward period is not over yet"
        );

        uint128 time = uint128(block.timestamp);
        uint128 periods = (time - startedTime[_msgSender()]) / rewardPeriod;
        stakers[_msgSender()] +=
            (stakers[_msgSender()] * (rewardRate * periods)) /
            100;
        startedTime[_msgSender()] += periods * rewardPeriod;

        emit Claimed(
            _msgSender(),
            stakers[_msgSender()],
            startedTime[_msgSender()]
        );
    }

    function setRoot(bytes32 _root) external onlyRole(DAO_ROLE) {
        merkleRoot = _root;
    }
}
