import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { ethers, network, waffle } from "hardhat";
import { ACDMPlatform, ACDMToken } from "../typechain";

describe("ACDMPlatform", function () {
  const ROUND_TIME = 3600;

  let signers: Array<SignerWithAddress>;

  let platform: ACDMPlatform;
  let token: ACDMToken;

  beforeEach(async function () {
    signers = await ethers.getSigners();

    const TOKEN = await ethers.getContractFactory("ACDMToken");
    token = (await TOKEN.deploy()) as ACDMToken;
    await token.deployed();

    const PLATFORM = await ethers.getContractFactory("ACDMPlatform");
    platform = (await PLATFORM.deploy(
      token.address,
      ROUND_TIME
    )) as ACDMPlatform;
    await platform.deployed();
    await token.mint(platform.address, ethers.constants.MaxInt256);
  });

  describe("Deployment", function () {
    it("Should set right token", async function () {
      expect(await platform.token()).to.equal(token.address);
    });

    it("Should set right round period", async function () {
      expect(await platform.roundTime()).to.equal(ROUND_TIME);
    });

    it("Should set right round", async function () {
      expect(await platform.round()).to.equal(0);
    });
  });

  describe("Register function", function () {
    it("Should add new user to the platform", async function () {
      expect(await platform["register()"]())
        .to.emit("ACDMPlatform", "Registered")
        .withArgs(
          signers[0].address,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero
        );
    });

    it("Should add new user with one referrer", async function () {
      await platform.connect(signers[1])["register()"]();
      expect(await platform["register(address)"](signers[1].address))
        .to.emit("ACDMPlatform", "Registered")
        .withArgs(
          signers[0].address,
          signers[1].address,
          ethers.constants.AddressZero
        );
    });

    it("Should add new user with two referrers", async function () {
      await platform.connect(signers[1])["register()"]();
      await platform
        .connect(signers[2])
        ["register(address)"](signers[1].address);
      expect(await platform["register(address)"](signers[2].address))
        .to.emit("ACDMPlatform", "Registered")
        .withArgs(signers[0].address, signers[1].address, signers[2].address);
    });

    it("Should revert if referrer is not registered", async function () {
      await expect(
        platform["register(address)"](signers[1].address)
      ).to.be.revertedWith("ACDMPlatform: Given referrer is not registered");
    });

    it("Should revert if user already registered", async function () {
      await platform["register()"]();
      await expect(platform["register()"]()).to.be.revertedWith(
        "ACDMPlatform: You already registered"
      );
    });
  });

  describe("Buy ACDM function", function () {
    const price = ethers.utils.parseEther("0.00001");
    let tokenPrice: BigNumber;

    beforeEach(async function () {
      tokenPrice = await platform.tokenPrice();
    });

    it("Should revert if the price is not normal", async function () {
      await expect(platform.buyACDM({ value: price.sub(1) })).to.revertedWith(
        "ACDMPlatform: Not enough eth to buy"
      );
      await expect(platform.buyACDM({ value: price.add(1) })).to.revertedWith(
        "ACDMPlatform: Enter exact price to not lose extra eth"
      );
    });

    it("Should revert if user is not registered", async function () {
      await expect(platform.buyACDM({ value: price })).to.revertedWith(
        "ACDMPlatform: You're not registered"
      );
    });

    it("Should transfer one token", async function () {
      await platform["register()"]();
      expect(await platform.buyACDM({ value: price }))
        .to.emit("ACDMPlatform", "Bought")
        .withArgs(
          signers[0].address,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          price,
          price.div(tokenPrice)
        );
      expect(await token.balanceOf(signers[0].address)).to.equal(1);
      expect(await waffle.provider.getBalance(platform.address)).to.equal(
        price
      );
    });

    it("Should transfer 5% of the cost to referrer", async function () {
      await platform.connect(signers[1])["register()"]();
      await platform["register(address)"](signers[1].address);

      const prevBalance = await signers[1].getBalance();
      expect(await platform.buyACDM({ value: price }))
        .to.emit("ACDMPlatform", "Bought")
        .withArgs(
          signers[0].address,
          signers[1].address,
          ethers.constants.AddressZero,
          price,
          price.div(tokenPrice)
        );
      expect(await signers[1].getBalance()).to.equal(
        prevBalance.add(price.mul(5).div(100))
      );
      expect(await waffle.provider.getBalance(platform.address)).to.equal(
        price.mul(95).div(100)
      );
    });

    it("Should transfer 3% of the cost to the second", async function () {
      await platform.connect(signers[1])["register()"]();
      await platform
        .connect(signers[2])
        ["register(address)"](signers[1].address);
      await platform["register(address)"](signers[2].address);

      const prevBalance1 = await signers[1].getBalance();
      const prevBalance2 = await signers[2].getBalance();
      expect(await platform.buyACDM({ value: price }))
        .to.emit("ACDMPlatform", "Bought")
        .withArgs(
          signers[0].address,
          signers[2].address,
          signers[1].address,
          price,
          price.div(tokenPrice)
        );
      expect(await signers[2].getBalance()).to.equal(
        prevBalance2.add(price.mul(5).div(100))
      );
      expect(await signers[1].getBalance()).to.equal(
        prevBalance1.add(price.mul(3).div(100))
      );

      expect(await waffle.provider.getBalance(platform.address)).to.equal(
        price.mul(92).div(100)
      );
    });
  });

  describe("Add Order function", async function () {
    const price = ethers.utils.parseEther("0.00001");
    let tokenPrice: BigNumber;

    beforeEach(async function () {
      tokenPrice = await platform.tokenPrice();
      await platform["register()"]();
      await platform.buyACDM({ value: price });
    });

    it("Should revert if trade round is not started yet", async function () {
      await expect(platform.addOrder(price.div(tokenPrice))).to.be.revertedWith(
        "ACDMPlatform: Trade round is not started yet"
      );
    });

    it("Should add new Order", async function () {
      await network.provider.send("evm_increaseTime", [ROUND_TIME + 1]);
      const prevBalance = await token.balanceOf(platform.address);

      await token.approve(platform.address, price.div(tokenPrice));
      expect(await platform.addOrder(price.div(tokenPrice)))
        .to.emit("ACDMPlatform", "OrderAdded")
        .withArgs(signers[0].address, price.div(tokenPrice));
      expect(await platform.orderBook(signers[0].address)).to.equal(1);
      expect(await token.balanceOf(signers[0].address)).to.equal(
        ethers.constants.Zero
      );
      expect(await token.balanceOf(platform.address)).to.equal(
        prevBalance.add(price.div(tokenPrice))
      );
    });
  });

  describe("Remove Order function", function () {
    const price = ethers.utils.parseEther("0.00001");
    let tokenPrice: BigNumber;

    beforeEach(async function () {
      tokenPrice = await platform.tokenPrice();
      await platform["register()"]();
      await platform.buyACDM({ value: price });
      await network.provider.send("evm_increaseTime", [ROUND_TIME + 1]);
      await token.approve(platform.address, 1);
    });

    it("Should revert if there is no order yet", async function () {
      await expect(platform.removeOrder()).to.be.revertedWith(
        "ACDMPlatform: Your order is already empty!"
      );
    });

    it("Should remove order", async function () {
      await platform.addOrder(price.div(tokenPrice));
      expect(await platform.removeOrder())
        .to.emit("ACDMPlatform", "OrderRemoved")
        .withArgs(signers[0].address, price.div(tokenPrice));
      expect(await platform.orderBook(signers[0].address)).to.equal(0);
    });
  });

  describe("Redeem order function", function () {
    const price = ethers.utils.parseEther("0.00001");
    let tokenPrice: BigNumber;

    beforeEach(async function () {
      tokenPrice = await platform.tokenPrice();
      await platform["register()"]();
      await platform.connect(signers[1])["register()"]();
      await platform.buyACDM({ value: price });
      await network.provider.send("evm_increaseTime", [ROUND_TIME + 1]);
      await token.approve(platform.address, 1);
    });

    it("Should revert if order does not exist", async function () {
      await expect(
        platform
          .connect(signers[1])
          .redeemOrder(signers[0].address, { value: price })
      ).to.be.revertedWith("Given user does not have any order");
    });

    it("Should redeem order", async function () {
      await platform.addOrder(price.div(tokenPrice));
      expect(
        await platform
          .connect(signers[1])
          .redeemOrder(signers[0].address, { value: price })
      )
        .to.emit("ACDMPlatform", "OrderRedeemed")
        .withArgs(
          signers[0].address,
          signers[1].address,
          price.div(tokenPrice)
        );

      expect(await token.balanceOf(signers[1].address)).to.equal(
        price.div(tokenPrice)
      );
      expect(await platform.orderBook(signers[0].address)).to.equal(
        ethers.constants.Zero
      );
    });
  });
});
