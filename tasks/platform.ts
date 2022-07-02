import { task } from "hardhat/config";

const ADDRESS = "0xf153898Cd4837e8784b459364CdD2876FF0794e8";

const platform = async (hre) => {
    return await hre.ethers.getContractAt("ACDMPlatform", ADDRESS);
}

task("register", "Registeres to the platform")
  .addOptionalParam("referrer", "Address of refferer")
  .setAction(async function ({ referrer }, hre) {
    referrer !== undefined ?
      await (await platform(hre)).register(referrer)
      : await (await platform(hre)).register();
    console.log(`Successfully registered to the platform ${referrer !== undefined ? `with ${referrer} referrer` : ""}`);
  });

task("buy-acdm", "Buys ACDM tokens")
  .setAction(async function (_, hre) {
    await (await platform(hre)).buyACDM();
    console.log(`Successfully bought acdm tokens`);
  });

task("add-order", "Adds order to the platform")
  .addParam("amount", "Amount of the tokens to be added to the order")
  .setAction(async function ({ amount }, hre) {
    await (await platform(hre)).addOrder(amount);
    console.log(`Successfully added ${amount} acdm tokens to the order`);
  })

task("remove-order", "Removes added order")
  .setAction(async function (_, hre) {
    await (await platform(hre)).removeOrder();
    console.log(`Successfully removed order from the platform`);
  })

task("redeem-order", "Reedems order from another user")
  .addParam("from", "Address of the user that sells tokens")
  .setAction(async function ({ from }, hre) {
    await (await platform(hre)).redeemOrder(from);
    console.log(`Successfully bought tokens from ${from} address`);
  });