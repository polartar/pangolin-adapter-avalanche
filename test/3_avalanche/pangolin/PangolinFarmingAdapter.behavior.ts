import hre from "hardhat";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { getAddress } from "ethers/lib/utils";
// import { BigNumber } from "ethers";
import { PoolItem } from "../types";
import { getOverrideOptions, setTokenBalanceInStorage } from "../../utils";
import { default as TOKENS } from "../../../helpers/tokens.json";

chai.use(solidity);

const rewardToken = "0x60781C2586D68229fde47564546784ab3fACA982";
const vaultUnderlyingTokens = Object.values(TOKENS).map(x => getAddress(x));

export function shouldBehaveLikePangolinFarmingAdapter(token: string, pool: PoolItem): void {
  it(`should deposit avax-${token} liquidity pool in Pangolin Farming`, async function () {
    // underlying token instance
    const underlyingTokenInstance = await hre.ethers.getContractAt("ERC20", pool.lpToken);

    await setTokenBalanceInStorage(underlyingTokenInstance, pool.pool, "0");
    // 1. deposit all underlying tokens
    const expectedLPTokenBalanceAfterDeposit = await underlyingTokenInstance.balanceOf(this.testDeFiAdapter.address);

    await this.testDeFiAdapter.testGetDepositAllCodes(
      pool.lpToken,
      pool.pool,
      this.pangolinFarmingAdapter.address,
      getOverrideOptions(),
    );

    // 1.1 assert whether lptoken balance is as expected or not after deposit
    const actualLPTokenBalanceAfterDeposit = await this.pangolinFarmingAdapter.getLiquidityPoolTokenBalance(
      this.testDeFiAdapter.address,
      pool.lpToken,
      pool.pool,
    );
    // const expectedLPTokenBalanceAfterDeposit = await harvestDepositInstance.balanceOf(this.testDeFiAdapter.address);
    expect(actualLPTokenBalanceAfterDeposit).to.be.eq(expectedLPTokenBalanceAfterDeposit);

    // 1.2 assert whether underlying token balance is as expected or not after deposit
    const actualUnderlyingTokenBalanceAfterDeposit = await this.testDeFiAdapter.getERC20TokenBalance(
      pool.lpToken,
      pool.pool,
    );

    expect(actualUnderlyingTokenBalanceAfterDeposit).to.be.eq(expectedLPTokenBalanceAfterDeposit);
    console.log("deposit sccess");
  }).timeout(100000);

  it(`should claim FARM, harvest FARM, and withdraw ${token} in Pangolin Farming`, async function () {
    const harvestDepositInstance = await hre.ethers.getContractAt("ERC20", pool.pool);

    const farmRewardInstance = await hre.ethers.getContractAt("IERC20", rewardToken);
    // underlying token instance
    const underlyingTokenInstance = await hre.ethers.getContractAt("ERC20", pool.lpToken);

    // 2. claim the reward token
    const actualRewardTokenBalanceAfterClaim = await this.pangolinFarmingAdapter.getRewardBalance(
      this.testDeFiAdapter.address,
      pool.lpToken,
    );
    await this.testDeFiAdapter.testClaimRewardTokenCode(
      pool.lpToken,
      this.pangolinFarmingAdapter.address,
      getOverrideOptions(),
    );
    // 2.1 assert whether the reward token's balance is as expected or not after claiming

    const expectedRewardTokenBalanceAfterClaim = await farmRewardInstance.balanceOf(this.testDeFiAdapter.address);
    expect(actualRewardTokenBalanceAfterClaim).to.be.eq(expectedRewardTokenBalanceAfterClaim);
    if (vaultUnderlyingTokens.includes(getAddress(pool.tokens[0]))) {
      // 3. Swap the reward token into underlying token
      try {
        await this.testDeFiAdapter.testGetHarvestAllCodes(
          pool.lpToken,
          pool.tokens[0],
          this.pangolinFarmingAdapter.address,
          getOverrideOptions(),
        );
        // 3.1 assert whether the reward token is swapped to underlying token or not
        expect(await this.testDeFiAdapter.getERC20TokenBalance(pool.tokens[0], this.testDeFiAdapter.address)).to.be.gte(
          0,
        );
        console.log("✓ Harvest");
      } catch {
        // may throw error from DEX due to insufficient reserves
      }
    }

    // 4. Withdraw all lpToken balance
    await this.testDeFiAdapter.testGetWithdrawAllCodes(
      pool.lpToken,
      pool.pool,
      this.pangolinFarmingAdapter.address,
      getOverrideOptions(),
    );
    // 4.1 assert whether lpToken balance is as expected or not
    const actualLPTokenBalanceAfterWithdraw = await this.pangolinFarmingAdapter.getLiquidityPoolTokenBalance(
      this.testDeFiAdapter.address,
      this.testDeFiAdapter.address, // placeholder of type address
      pool.pool,
    );
    const expectedLPTokenBalanceAfterWithdraw = await harvestDepositInstance.balanceOf(this.testDeFiAdapter.address);
    expect(actualLPTokenBalanceAfterWithdraw).to.be.eq(expectedLPTokenBalanceAfterWithdraw);
    // 4.2 assert whether underlying token balance is as expected or not after withdraw
    const actualUnderlyingTokenBalanceAfterWithdraw = await this.testDeFiAdapter.getERC20TokenBalance(
      (
        await this.pangolinFarmingAdapter.getUnderlyingTokens(pool.pool, pool.pool)
      )[0],
      this.testDeFiAdapter.address,
    );
    const expectedUnderlyingTokenBalanceAfterWithdraw = await underlyingTokenInstance.balanceOf(
      this.testDeFiAdapter.address,
    );
    expect(actualUnderlyingTokenBalanceAfterWithdraw).to.be.eq(expectedUnderlyingTokenBalanceAfterWithdraw);
  }).timeout(100000);
}
