import { task } from "hardhat/config";

const ADDRESS = "0xC03C16c5752C8e6357138c7D08d9E9bACe7dd8eE";

const staking = async (hre) => {
    return await hre.ethers.getContractAt("Staking", ADDRESS);
}

task("stake", "Stakes xxx tokens")
  .addParam("amount", "Amount of tokens to be staked")
  .addParam("merkle-proof", "")
  .setAction(async function ({ amount, merkleProof }, hre) {
    await(await staking(hre)).stake(amount, merkleProof);
    console.log(`You staked ${amount}`);
  });

task("unstake", "Unstakes all tokens")
  .setAction(async function (_, hre) {
    await(await staking(hre)).unstake();
    console.log(`You unstaked`);
  });

  task("claim", "Claims reward")
    .setAction(async function (_, hre) {
      await(await staking(hre)).claim();
      console.log(`You claimed reward`);
    });