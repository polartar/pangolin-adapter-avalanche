import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

import { PangolinFarmingAdapter, PangolinFarmingAdapter__factory } from "../../typechain";

task("deploy-pangolin.farming-adapter").setAction(async function (taskArguments: TaskArguments, { ethers }) {
  const pangolinFarmingAdapterFactory: PangolinFarmingAdapter__factory = await ethers.getContractFactory(
    "PangolinFarmingAdapter",
  );
  const pangolinFarmingAdapter: PangolinFarmingAdapter = <PangolinFarmingAdapter>(
    await pangolinFarmingAdapterFactory.deploy()
  );
  await pangolinFarmingAdapter.deployed();
  console.log("PangolinFarmingAdapter deployed to: ", pangolinFarmingAdapter.address);
});
