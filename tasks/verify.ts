import { task } from "hardhat/config";
import "hardhat-deploy";

task("verify-all", "Verifies all contracts")
  .setAction(async function (taskArguments, hre) {
    const deployments = await hre.deployments.all();
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
  });