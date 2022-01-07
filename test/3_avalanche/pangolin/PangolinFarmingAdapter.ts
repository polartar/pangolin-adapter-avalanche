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
    // const DAI_ADDRESS: string = getAddress("0xd586E7F844cEa2F87f50152665BCbc2C279D8d70");
    // const USDC_ADDRESS: string = getAddress("0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664");
    // const DAI_WHALE: string = getAddress("0xd4456Fec7bA0F3daf0A99FE6D90BAbFf1641B63C");
    // const USDC_WHALE: string = getAddress("0xDD21BE69bADB67067b9cea9227cC701551A545c6");
    const AVAX_DAI_LP: string = getAddress("0xbA09679Ab223C6bdaf44D45Ba2d7279959289AB0");
    const AVAX_PNG_LP: string = getAddress("0xd7538cABBf8605BdE1f4901B47B8D42c61DE0367");
    const AVAX_DAI_WHALE: string = getAddress("0xe06142615991dee64ca813085779fadcc70431eb");
    const AVAX_PNG_WHALE: string = getAddress("0xC815A5d9EC71840c21E9AD9090a7879EE23f5aae");
    const signers: SignerWithAddress[] = await hre.ethers.getSigners();
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [AVAX_DAI_WHALE],
    });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [AVAX_PNG_WHALE],
    });

    this.signers.admin = signers[0];
    this.signers.owner = signers[1];
    this.signers.deployer = signers[2];
    this.signers.alice = signers[3];
    this.signers.operator = await hre.ethers.getSigner("0xe456f9A32E5f11035ffBEa0e97D1aAFDA6e60F03");
    this.signers.daiWhale = await hre.ethers.getSigner(AVAX_DAI_WHALE);
    this.signers.pngWhale = await hre.ethers.getSigner(AVAX_PNG_WHALE);

    const dai = await hre.ethers.getContractAt("IERC20", AVAX_DAI_LP, this.signers.daiWhale);
    const png = await hre.ethers.getContractAt("IERC20", AVAX_PNG_LP, this.signers.pngWhale);

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
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [this.testDeFiAdapter.address],
    });
    // fund the whale's wallet with gas
    await this.signers.admin.sendTransaction({
      to: AVAX_DAI_WHALE,
      value: hre.ethers.utils.parseEther("10"),
      ...getOverrideOptions(),
    });

    await this.signers.admin.sendTransaction({
      to: AVAX_PNG_WHALE,
      value: hre.ethers.utils.parseEther("10"),
      ...getOverrideOptions(),
    });

    // impersonate operator
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [this.signers.operator.address],
    });
    await this.signers.admin.sendTransaction({
      to: this.testDeFiAdapter.address,
      value: hre.ethers.utils.parseEther("50"),
      ...getOverrideOptions(),
    });

    // fund TestDeFiAdapter with 500 tokens each
    await dai.transfer(this.testDeFiAdapter.address, 90, getOverrideOptions());
    await png.transfer(this.testDeFiAdapter.address, 150, getOverrideOptions());

    // await hre.network.provider.request({
    //   method: "hardhat_impersonateAccount",
    //   params: [getAddress('0x1f806f7C8dED893fd3caE279191ad7Aa3798E928')],
    // });
    // await hre.network.provider.request({
    //   method: "hardhat_impersonateAccount",
    //   params: [AVAX_DAI_LP],
    // });

    // whitelist TestDeFiAdapter contract into Pangolin's Vaults
    // by impersonating the governance's address
    // const tokenNames = Object.keys(PangolinFarmingPools);
    // for (const tokenName of tokenNames) {
    // const { pool } = (PangolinFarmingPools as LiquidityPool)[tokenName];
    // const pangolinVault = await hre.ethers.getContractAt("IHarvestDeposit", pool);

    // const governance = await pangolinVault.governance();

    // await hre.network.provider.request({
    //   method: "hardhat_impersonateAccount",
    //   params: [0xab7FA2B2985BCcfC13c6D86b1D5A17486ab1e04C],
    // });
    // const harvestController = await hre.ethers.getContractAt(
    //   "IHarvestController",
    //   await pangolinVault.controller(),
    //   await hre.ethers.getSigner(governance),
    // );
    // await this.signers.admin.sendTransaction({
    //   to: governance,
    //   value: hre.ethers.utils.parseEther("1000"),
    //   ...getOverrideOptions(),
    // });
    // await harvestController.addToWhitelist(this.testDeFiAdapter.address, getOverrideOptions());
    // await harvestController.addCodeToWhitelist(this.testDeFiAdapter.address, getOverrideOptions());
    // }
  });

  describe("PangolinFarmingAdapter", function () {
    shouldBehaveLikePangolinFarmingAdapter("dai", (PangolinFarmingPools as LiquidityPool)["dai"]);
    // Object.keys(PangolinFarmingPools).map((token: string) => {
    //   shouldBehaveLikePangolinFarmingAdapter(token, (PangolinFarmingPools as LiquidityPool)[token]);
    // });
  });
});
