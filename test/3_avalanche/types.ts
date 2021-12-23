import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Fixture } from "ethereum-waffle";
import { PangolinFarmingAdapter } from "../../typechain/PangolinFarmingAdapter";
import { IPangolinRouter } from "../../typechain/IPangolinRouter";
import { TestDeFiAdapter } from "../../typechain/TestDeFiAdapter";

export interface Signers {
  admin: SignerWithAddress;
  owner: SignerWithAddress;
  deployer: SignerWithAddress;
  alice: SignerWithAddress;
  bob: SignerWithAddress;
  charlie: SignerWithAddress;
  dave: SignerWithAddress;
  eve: SignerWithAddress;
  daiWhale: SignerWithAddress;
  avaxWhale: SignerWithAddress;
  wethWhale: SignerWithAddress;
}

export interface PoolItem {
  pool: string;
  lpToken: string;
  stakingPool?: string;
  rewardTokens?: string[];
  tokens: string[];
  swap?: string;
}

export interface LiquidityPool {
  [name: string]: PoolItem;
}

declare module "mocha" {
  export interface Context {
    harvestFinanceAdapter: PangolinFarmingAdapter;
    testDeFiAdapter: TestDeFiAdapter;
    pangolinRouter: IPangolinRouter;
    loadFixture: <T>(fixture: Fixture<T>) => Promise<T>;
    signers: Signers;
  }
}
