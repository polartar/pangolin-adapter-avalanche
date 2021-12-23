import hre from "hardhat";
import { Artifact } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { getAddress } from "ethers/lib/utils";
import { PangolinFarmingAdapter } from "../../../typechain";
import { TestDeFiAdapter } from "../../../typechain/TestDeFiAdapter";
import { LiquidityPool, Signers } from "../types";
import { shouldBehaveLikePangolinFarmingAdapter } from "./PangolinFarmingAdapter.behavior";
import { default as PangolinFarmingPools } from "./pangolin.farming-pools.json";
import { IPangolinRouter } from "../../../typechain";
import { getOverrideOptions } from "../../utils";

const { deployContract } = hre.waffle;

describe("Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;
    const DAI_ADDRESS: string = getAddress("0xd586E7F844cEa2F87f50152665BCbc2C279D8d70");
    const AVAX_ADDRESS: string = getAddress("0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7");
    const DAI_WHALE: string = getAddress("0xe456f9A32E5f11035ffBEa0e97D1aAFDA6e60F03");
    const AVAX_WHALE: string = getAddress("0xe456f9A32E5f11035ffBEa0e97D1aAFDA6e60F03");
    const signers: SignerWithAddress[] = await hre.ethers.getSigners();
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DAI_WHALE],
    });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [AVAX_WHALE],
    });
    this.signers.admin = signers[0];
    this.signers.owner = signers[1];
    this.signers.deployer = signers[2];
    this.signers.alice = signers[3];
    this.signers.daiWhale = await hre.ethers.getSigner(DAI_WHALE);
    this.signers.avaxWhale = await hre.ethers.getSigner(AVAX_WHALE);
    const dai = await hre.ethers.getContractAt("IERC20", DAI_ADDRESS, this.signers.daiWhale);
    const avax = await hre.ethers.getContractAt("IERC20", AVAX_ADDRESS, this.signers.avaxWhale);

    // get the PangolinV2Router contract instance
    this.pangolinV2Router = <IPangolinRouter>(
      await hre.ethers.getContractAt("IPangolinRouter", "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106")
    );

    // deploy Pangolin Farming Adapter
    const pangolinFarmingAdapterArtifact: Artifact = await hre.artifacts.readArtifact("PangolinFarmingAdapter");
    this.pangolinFarmingAdapter = <PangolinFarmingAdapter>(
      await deployContract(this.signers.deployer, pangolinFarmingAdapterArtifact, [], getOverrideOptions())
    );

    // deploy TestDeFiAdapter Contract
    const testDeFiAdapterArtifact: Artifact = await hre.artifacts.readArtifact("TestDeFiAdapter");
    this.testDeFiAdapter = <TestDeFiAdapter>(
      await deployContract(this.signers.deployer, testDeFiAdapterArtifact, [], getOverrideOptions())
    );
    // fund the whale's wallet with gas
    await this.signers.admin.sendTransaction({
      to: DAI_WHALE,
      value: hre.ethers.utils.parseEther("100"),
      ...getOverrideOptions(),
    });
    await this.signers.admin.sendTransaction({
      to: AVAX_WHALE,
      value: hre.ethers.utils.parseEther("100"),
      ...getOverrideOptions(),
    });

    // fund TestDeFiAdapter with 10000 tokens each
    console.log(await dai.balanceOf(this.signers.admin.address));
    await dai.transfer(this.testDeFiAdapter.address, hre.ethers.utils.parseEther("10000"), getOverrideOptions());
    await avax.transfer(this.testDeFiAdapter.address, hre.ethers.utils.parseUnits("10000", 6), getOverrideOptions());

    // whitelist TestDeFiAdapter contract into Pangolin's Vaults
    // by impersonating the governance's address
    const tokenNames = Object.keys(PangolinFarmingPools);
    for (const tokenName of tokenNames) {
      const { pool } = (PangolinFarmingPools as LiquidityPool)[tokenName];
      const pangolinVault = await hre.ethers.getContractAt("IHarvestDeposit", pool);
      const governance = await pangolinVault.governance();
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [governance],
      });
      const harvestController = await hre.ethers.getContractAt(
        "IHarvestController",
        await pangolinVault.controller(),
        await hre.ethers.getSigner(governance),
      );
      await this.signers.admin.sendTransaction({
        to: governance,
        value: hre.ethers.utils.parseEther("1000"),
        ...getOverrideOptions(),
      });
      await harvestController.addToWhitelist(this.testDeFiAdapter.address, getOverrideOptions());
      await harvestController.addCodeToWhitelist(this.testDeFiAdapter.address, getOverrideOptions());
    }
  });

  describe("PangolinFarmingAdapter", function () {
    Object.keys(PangolinFarmingPools).map((token: string) => {
      shouldBehaveLikePangolinFarmingAdapter(token, (PangolinFarmingPools as LiquidityPool)[token]);
    });
  });
});
