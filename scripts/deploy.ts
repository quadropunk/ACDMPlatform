import { ethers } from "hardhat";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

async function main() {
  const ROUND_TIME = 3 * 24 * 60 * 60;

  const ACDM_TOKEN = await ethers.getContractFactory("ACDMToken");
  const acdmToken = await ACDM_TOKEN.deploy();
  await acdmToken.deployed();
  
  console.log(`ACDMToken deployed with ${acdmToken.address} address`);
    
  const XXXTOKEN = await ethers.getContractFactory("XXXToken");
  const xxxToken = await XXXTOKEN.deploy();
  await xxxToken.deployed();

  console.log(`XXXToken deployed with ${xxxToken.address} address`);

  const ACDM_PLATFORM = await ethers.getContractFactory("ACDMPlatform");
  const acdmPlatform = await ACDM_PLATFORM.deploy(acdmToken.address, ROUND_TIME);
  await acdmPlatform.deployed();

  console.log(`ACDMPlatform deployed with ${acdmPlatform.address} address`);

  const signers = await ethers.getSigners();

  const whiteListAddresses = signers.filter((_, index) => index < 5).map((signer) => signer.address);
  const leafNodes = whiteListAddresses.map((addr) => keccak256(addr));
  const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });

  const DAO = await ethers.getContractFactory("DAO");
  const dao = await DAO.deploy(xxxToken.address, merkleTree.getRoot());
  await dao.deployed();

  console.log(`DAO deployed with ${dao.address} address`);
  console.log(`Staking deployed with ${await dao.staking()} address`);
  
  const deployments = await .deployments.all();
  console.log(deployments);

  for (const contract in deployments) {
    if (deployments.hasOwnProperty(contract)) {
      const deployment = deployments[contract];
      console.log(`Verifying ${contract} (${deployment.address})...`);

      await hre.run("verify:verify", {
        address: deployment.address,
        constructorArguments: deployment.args,
        libraries: deployment.libraries
      });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});