import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";
import { ethers, network, waffle } from "hardhat";
import { XXXToken, Staking, DAO } from "../typechain";

describe("Staking", function () {
  const REWARD_PERIOD = 7 * 24 * 60 * 60;
  const LOCK_PERIOD = 7 * 24 * 60 * 60;

  const whiteListLength = 3;
  let whiteListAddresses: Array<string>;
  let leafNodes: Buffer[];
  let merkleTree: MerkleTree;

  let signers: Array<SignerWithAddress>;

  let staking: Staking;
  let token: XXXToken;

  let dao: DAO;

  beforeEach(async function () {
    signers = await ethers.getSigners();

    whiteListAddresses = signers.filter((_, index) => index < whiteListLength).map((signer) => signer.address);
    leafNodes = whiteListAddresses.map((addr) => keccak256(addr));
    merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });

    const TOKEN = await ethers.getContractFactory("XXXToken");
    token = (await TOKEN.deploy()) as XXXToken;
    await token.deployed();

    const DAO = await ethers.getContractFactory("DAO");
    dao = (await DAO.deploy(token.address, merkleTree.getRoot())) as DAO;
    await dao.deployed();
    
    staking = await ethers.getContractAt("Staking", await dao.staking()) as Staking;
  });

  describe("Deployment", function () {
    it("Should set right token", async function () {
      expect(await staking.token()).to.equal(token.address);
      expect(await dao.token()).to.equal(token.address);
    });

    it("Should set right reward period", async function () {
      expect(await staking.rewardPeriod()).to.equal(REWARD_PERIOD);
    });

    it("Should set right staking address", async function () {
      expect(await dao.staking()).to.equal(staking.address);
    })
  });

  describe("Create voting function", function () {
    let signature: string;
    let targetContract: string;

    beforeEach(async function () {
      targetContract = staking.address;
      const iface = new ethers.utils.Interface([{
        "inputs": [
          {
            "internalType": "bytes32",
            "name": "_root",
            "type": "bytes32"
          }
        ],
        "name": "setRoot",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }]);

      signature = iface.encodeFunctionData("setRoot", [merkleTree.getRoot()]);
    });

    it("Should add new voting", async function () {
      expect(await dao.createVoting(signature, targetContract)).to.emit("DAO", "VotingCreated")
        .withArgs(signature, targetContract, (await waffle.provider.getBlock("latest")).timestamp);
    });
  });

  describe("Vote function", function () {
    const id = 0;
    const voteFor = true;

    let signature: string;
    let targetContract: string;

    beforeEach(async function () {
      targetContract = staking.address;
      const iface = new ethers.utils.Interface([{
        "inputs": [
          {
            "internalType": "bytes32",
            "name": "_root",
            "type": "bytes32"
          }
        ],
        "name": "setRoot",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }]);

      signature = iface.encodeFunctionData("setRoot", [merkleTree.getRoot()]);
      await dao.createVoting(signature, targetContract);
    });

    it("Should revert if user has no LP tokens", async function () {
      await expect(dao.vote(voteFor, id)).to.be.revertedWith("DAO: Cannot vote with zero tokens");
    });

    it("Should revert if user already voted", async function () {
      const stakeAmount = 1000;
      await token.mint(signers[0].address, ethers.constants.MaxInt256);
      await token.approve(staking.address, stakeAmount);
      const merkleProof = merkleTree.getHexProof(keccak256(signers[0].address));
      await staking.stake(stakeAmount, merkleProof);
      await dao.vote(true, id);
      await expect(dao.vote(voteFor, id)).to.be.revertedWith("DAO: You have already voted");
    });

    it("Should revert if voting id does not exist", async function () {
      const stakeAmount = 1000;
      await token.mint(signers[0].address, ethers.constants.MaxInt256);
      await token.approve(staking.address, stakeAmount);
      const merkleProof = merkleTree.getHexProof(keccak256(signers[0].address));
      await staking.stake(stakeAmount, merkleProof);
      await expect(dao.vote(voteFor, id + 1)).to.be.revertedWith("DAO: Voting with such id does not exist");
    });

    it("Should vote", async function () {
      const stakeAmount = 1000;
      await token.mint(signers[0].address, ethers.constants.MaxInt256);
      await token.approve(staking.address, stakeAmount);
      const merkleProof = merkleTree.getHexProof(keccak256(signers[0].address));
      await staking.stake(stakeAmount, merkleProof);
      expect(await dao.vote(voteFor, id)).to.emit("DAO", "Voted").withArgs(stakeAmount, voteFor, id);
      const voting = await dao.votings(id);
      expect(voting.votesFor).to.equal(stakeAmount);
    });
  });

  describe("Finish voting function", function () {
    const id = 0;
    const voteFor = true;

    let signature: string;
    let targetContract: string;

    beforeEach(async function () {
      targetContract = staking.address;
      const iface = new ethers.utils.Interface([{
        "inputs": [
          {
            "internalType": "bytes32",
            "name": "_root",
            "type": "bytes32"
          }
        ],
        "name": "setRoot",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }]);

      signature = iface.encodeFunctionData("setRoot", [merkleTree.getRoot()]);
      await dao.createVoting(signature, targetContract);
      const stakeAmount = 1000;
      await token.mint(signers[0].address, ethers.constants.MaxInt256);
      await token.approve(staking.address, stakeAmount);
      const merkleProof = merkleTree.getHexProof(keccak256(signers[0].address));
      await staking.stake(stakeAmount, merkleProof);
      await dao.vote(voteFor, id);
    });

    it("Should revert if voting does not exist", async function () {
      await expect(dao.finishVoting(id + 1)).to.revertedWith("DAO: Voting with such id does not exist");
    });

    it("Should revert if voting is not finished yet", async function () {
      await expect(dao.finishVoting(id)).to.revertedWith("DAO: Voting is not finished yet");
    });

    it("Should finish voting", async function () {
      await network.provider.send("evm_increaseTime", [LOCK_PERIOD + 1]);

      expect(await dao.finishVoting(id)).to.emit("DAO", "VotingFinished")
        .withArgs(id, true);
      const voting = await dao.votings(id);
      expect(voting.startedTime).to.equal(0);
    })
  });

  describe("Stake function", function () {
    const stakeAmount = 1000;

    beforeEach(async function () {
      await token.mint(signers[0].address, ethers.constants.MaxInt256);
    });

    it("Should revert if zero tokens are staked", async function () {
      const merkleProof = merkleTree.getHexProof(keccak256(signers[0].address));
      await expect(staking.stake(0, merkleProof)).to.be.revertedWith(
        "Staking: Cannot stake zero tokens"
      );
    });

    it("Should revert if user tries to stake more than once", async function () {
      await token.approve(staking.address, stakeAmount);
      const merkleProof = merkleTree.getHexProof(keccak256(signers[0].address));
      await staking.stake(stakeAmount, merkleProof);
      await token.approve(staking.address, stakeAmount);
      await expect(staking.stake(stakeAmount, merkleProof)).to.be.revertedWith(
        "Staking: You've already staked"
      );
    });

    it("Should stake the token", async function () {
      await token.approve(staking.address, stakeAmount);
      const merkleProof = merkleTree.getHexProof(keccak256(signers[0].address));
      expect(await staking.stake(stakeAmount, merkleProof))
        .to.emit("Staking", "Staked")
        .withArgs(
          signers[0].address,
          stakeAmount,
          (await waffle.provider.getBlock("latest")).timestamp
        );
      expect(await staking.stakers(signers[0].address)).to.equal(stakeAmount);
    });

    describe("Whitelist", function () {
      it("Should revert if user is not added to the whitelist", async function () {
        await token.mint(signers[whiteListLength].address, ethers.constants.MaxInt256);
        await token.connect(signers[whiteListLength]).approve(staking.address, stakeAmount);

        const merkleProof = merkleTree.getHexProof(keccak256(signers[whiteListLength].address));
        await expect(staking.stake(stakeAmount, merkleProof)).to.be.revertedWith("Staking: You are not added to the whitelist");
      });
    });
  });

  describe("Unstake function", function () {
    const stakeAmount = 1000;

    beforeEach(async function () {
      await token.mint(signers[0].address, ethers.constants.MaxInt256);
    });

    it("Should revert if nothing to unstake", async function () {
      await network.provider.send("evm_increaseTime", [LOCK_PERIOD + 1]);
      await expect(staking.unstake()).to.be.revertedWith(
        "Staking: You've not staked"
      );
    });

    it("Should revert if lock period is not over yet", async function () {
      const targetContract = staking.address;
      const iface = new ethers.utils.Interface([{
        "inputs": [
          {
            "internalType": "bytes32",
            "name": "_root",
            "type": "bytes32"
          }
        ],
        "name": "setRoot",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }]);

      const signature = iface.encodeFunctionData("setRoot", [merkleTree.getRoot()]);

      await dao.createVoting(signature, targetContract);
      await token.approve(staking.address, stakeAmount);

      const merkleProof = merkleTree.getHexProof(keccak256(signers[0].address));
      await staking.stake(stakeAmount, merkleProof);

      await dao.vote(true, 0);

      await expect(staking.unstake()).to.be.revertedWith(
        "Staking: You cannot unstake till you vote"
      );
    });

    it("Should unstake", async function () {
      await token.approve(staking.address, stakeAmount);
      const merkleProof = merkleTree.getHexProof(keccak256(signers[0].address));
      await staking.stake(stakeAmount, merkleProof);
      await network.provider.send("evm_increaseTime", [LOCK_PERIOD + 1]);
      expect(await staking.unstake())
        .to.emit("Staking", "Unstaked")
        .withArgs(
          signers[0].address,
          stakeAmount,
          (await waffle.provider.getBlock("latest")).timestamp
        );
      expect(await staking.stakers(signers[0].address)).to.equal(0);
    });
  });

  describe("Claim function", function () {
    const stakeAmount = 1000;

    beforeEach(async function () {
      await token.mint(signers[0].address, ethers.constants.MaxInt256);
    });

    it("Should revert if reward period is not over yet", async function () {
      await token.approve(staking.address, stakeAmount);
      const merkleProof = merkleTree.getHexProof(keccak256(signers[0].address));
      await staking.stake(stakeAmount, merkleProof);
      await expect(staking.claim()).to.be.revertedWith(
        "Staking: Reward period is not over yet"
      );
    });

    it("Should revert if no stake is found", async function () {
      await token.approve(staking.address, stakeAmount);
      await network.provider.send("evm_increaseTime", [REWARD_PERIOD + 1]);
      await expect(staking.claim()).to.be.revertedWith(
        "Staking: You've not staked"
      );
    });

    it("Should claim the reward", async function () {
      const periods = 1;
      await token.approve(staking.address, stakeAmount);
      const merkleProof = merkleTree.getHexProof(keccak256(signers[0].address));
      await staking.stake(stakeAmount, merkleProof);

      await network.provider.send("evm_increaseTime", [
        REWARD_PERIOD * periods + 1,
      ]);
      expect(await staking.claim())
        .to.emit("Staking", "Claimed")
        .withArgs(
          signers[0].address,
          (stakeAmount * (100 + 3 * periods)) / 100,
          (await staking.rewardPeriod()).add(3 * periods)
        );

      expect(await staking.stakers(signers[0].address)).to.equal(
        (stakeAmount * (100 + 3 * periods)) / 100
      );
    });
  });
});
