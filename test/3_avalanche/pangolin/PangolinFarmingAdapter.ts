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

    await this.signers.admin.sendTransaction({
      to: this.testDeFiAdapter.address,
      value: hre.ethers.utils.parseEther("50"),
      ...getOverrideOptions(),
    });

    // fund TestDeFiAdapter
    await dai.transfer(this.testDeFiAdapter.address, 90, getOverrideOptions());
    await png.transfer(this.testDeFiAdapter.address, 150, getOverrideOptions());
  });

  describe("PangolinFarmingAdapter", function () {
    // shouldBehaveLikePangolinFarmingAdapter("dai", (PangolinFarmingPools as LiquidityPool)["dai"]);
    Object.keys(PangolinFarmingPools).map((token: string) => {
      shouldBehaveLikePangolinFarmingAdapter(token, (PangolinFarmingPools as LiquidityPool)[token]);
    });
  });
});
