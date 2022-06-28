import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, network, waffle } from "hardhat";
import { SomeToken, Staking } from "../typechain";

describe("Staking", function () {
  const REWARD_PERIOD = 7 * 24 * 60 * 60;
  const LOCK_PERIOD = 7 * 24 * 60 * 60;

  let signers: Array<SignerWithAddress>;
  let staking: Staking;
  let token: SomeToken;

  beforeEach(async function () {
    signers = await ethers.getSigners();

    const TOKEN = await ethers.getContractFactory("SomeToken");
    token = (await TOKEN.deploy()) as SomeToken;

    const STAKING = await ethers.getContractFactory("Staking");
    staking = (await STAKING.deploy(token.address)) as Staking;
  });

  describe("Deployment", function () {
    it("Should set right token", async function () {
      expect(await staking.token()).to.equal(token.address);
    });

    it("Should set right reward period", async function () {
      expect(await staking.rewardPeriod()).to.equal(REWARD_PERIOD);
    });

    it("Should set right lock period", async function () {
      expect(await staking.lockPeriod()).to.equal(LOCK_PERIOD);
    });
  });

  describe("Stake function", function () {
    const stakeAmount = 1000;

    beforeEach(async function () {
      await token.mint(signers[0].address, ethers.constants.MaxInt256);
    });
    it("Should revert if zero tokens are staked", async function () {
      await expect(staking.stake(0)).to.be.revertedWith(
        "Staking: Cannot stake zero tokens"
      );
    });

    it("Should revert if user tries to stake more than once", async function () {
      await token.approve(staking.address, stakeAmount);
      await staking.stake(stakeAmount);
      await token.approve(staking.address, stakeAmount);
      await expect(staking.stake(stakeAmount)).to.be.revertedWith(
        "Staking: You've already staked"
      );
    });

    it("Should stake the token", async function () {
      await token.approve(staking.address, stakeAmount);
      expect(await staking.stake(stakeAmount))
        .to.emit("Staking", "Staked")
        .withArgs(
          signers[0].address,
          stakeAmount,
          (await waffle.provider.getBlock("latest")).timestamp
        );
      expect(await staking.stakers(signers[0].address)).to.equal(stakeAmount);
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
      await token.approve(staking.address, stakeAmount);
      await staking.stake(stakeAmount);
      await expect(staking.unstake()).to.be.revertedWith(
        "Staking: Lock period is still on"
      );
    });

    it("Should unstake", async function () {
      await token.approve(staking.address, stakeAmount);
      await staking.stake(stakeAmount);
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
      await staking.stake(stakeAmount);
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
      await staking.stake(stakeAmount);

      await network.provider.send("evm_increaseTime", [
        REWARD_PERIOD * periods + 1,
      ]);
      expect(await staking.claim())
        .to.emit("Staking", "Claimed")
        .withArgs(
          signers[0].address,
          (stakeAmount * (100 + 3 * periods)) / 100,
          (await waffle.provider.getBlock("latest")).timestamp
        );

      expect(await staking.stakers(signers[0].address)).to.equal(
        (stakeAmount * (100 + 3 * periods)) / 100
      );
    });
  });
});
