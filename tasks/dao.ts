import { task } from "hardhat/config";

const ADDRESS = "0x72d25828E75B9528AC4B71fBd7Ab16429785756f";

const dao = async (hre) => {
  return await hre.ethers.getContractAt("DAO", ADDRESS);
}

task("create-voting", "Creates new voting")
  .addParam("signature", "Signature")
  .addParam("target-contract", "Address of executing contract")
  .setAction(async function ({ signature, targetContract }, hre) {
    await (await dao(hre)).createVoting(signature, targetContract);
    console.log(`Voting with ${signature} signature and ${targetContract} contract address is created`);
  });

task("vote", "Votes for voting by id")
  .addParam("vote-for", "True if votes for, false if votes against")
  .addParam("voting-id", "Id of voting")
  .setAction(async function ({ voteFor, votingId }, hre) {
    await (await dao(hre)).vote(voteFor, votingId);
    console.log(`Voted ${voteFor ? "for" : "against"} the ${votingId} voting`);
  });

task("finish-voting", "Finished voting")
  .addParam("voting-id", "Id of the voting to be finished")
  .setAction(async function ({ votingId }, hre) {
    await (await dao(hre)).finishVoting(votingId);
    console.log(`Voting with ${votingId} is finished`);
  });