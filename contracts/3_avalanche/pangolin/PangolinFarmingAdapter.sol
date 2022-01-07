// solhint-disable no-unused-vars
// SPDX-License-Identifier: agpl-3.0

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

/////////////////////////////////////////////////////
/// PLEASE DO NOT USE THIS CONTRACT IN PRODUCTION ///
/////////////////////////////////////////////////////

//  libraries
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";

//  interfaces
import { IPangolinFarmingDeposit } from "../interfaces/IPangolinFarmingDeposit.sol";
import { IHarvestFarm } from "@optyfi/defi-legos/ethereum/harvest.finance/contracts/IHarvestFarm.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IAdapter } from "@optyfi/defi-legos/interfaces/defiAdapters/contracts/IAdapter.sol";
import "@optyfi/defi-legos/interfaces/defiAdapters/contracts/IAdapterInvestLimit.sol";
import { IAdapterHarvestReward } from "@optyfi/defi-legos/interfaces/defiAdapters/contracts/IAdapterHarvestReward.sol";
import { IPangolinRouter } from "@pangolindex/exchange-contracts/contracts/pangolin-periphery/interfaces/IPangolinRouter.sol";
import "hardhat/console.sol";

/**
 * @title Adapter for Harvest.finance protocol
 * @author Opty.fi
 * @dev Abstraction layer to harvest finance's pools
 */

contract PangolinFarmingAdapter is IAdapter, IAdapterHarvestReward, IAdapterInvestLimit {
    using SafeMath for uint256;
    using Address for address;

    /** @notice max deposit value datatypes */
    MaxExposure public maxDepositProtocolMode;

    /**
     * @notice Avalanche V2 router contract address
     */
    address public constant pangolinV2Router = address(0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106);
    address public constant MINICHEF_ADDRESS = 0x1f806f7C8dED893fd3caE279191ad7Aa3798E928;

    // Liquidity provider
    address public constant AVAX_WETH_POOL = 0x7c05d54fc5CB6e4Ad87c6f5db3b807C94bB89c52;
    address public constant AVAX_USDT_POOL = 0xe28984e1EE8D431346D32BeC9Ec800Efb643eef4;
    address public constant AVAX_WBTC_POOL = 0x5764b8D8039C6E32f1e5d8DE8Da05DdF974EF5D3; //
    address public constant AVAX_DAI_POOL = 0xbA09679Ab223C6bdaf44D45Ba2d7279959289AB0; //
    address public constant AVAX_PNG_POOL = 0xd7538cABBf8605BdE1f4901B47B8D42c61DE0367;
    address public constant AVAX_USDC_POOL = 0xbd918Ed441767fe7924e99F6a0E0B568ac1970D9; //
    address public constant USDC_DAI_POOL = 0x221Caccd55F16B5176e14C0e9DBaF9C6807c83c9;
    address public constant USDC_USDT_POOL = 0xc13E562d92F7527c4389Cd29C67DaBb0667863eA;
    address public constant TUSD_DAI_POOL = 0x11cb8967c9CEBC2bC8349ad612301DaC843669ea;
    address public constant MIM_USDC_POOL = 0xE75eD6E50e3e2dc6b06FAf38b943560BD22e343B;

    // vault addresses
    address public constant AVAX_VAULT = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
    address public constant AVAX_WETH_VAULT = 0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB;
    address public constant AVAX_USDT_VAULT = 0xc7198437980c041c805A1EDcbA50c1Ce5db95118;
    address public constant AVAX_WBTC_VAULT = 0x50b7545627a5162F82A992c33b87aDc75187B218;
    address public constant AVAX_DAI_VAULT = 0xd586E7F844cEa2F87f50152665BCbc2C279D8d70;
    address public constant AVAX_USDC_VAULT = 0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664;
    address public constant AVAX_PNG_VAULT = 0x60781C2586D68229fde47564546784ab3fACA982;
    address public constant AVAX_TUSD_VAULT = 0x1C20E891Bab6b1727d14Da358FAe2984Ed9B59EB;
    address public constant AVAX_MIM_VAULT = 0x130966628846BFd36ff31a822705796e8cb8C18D;

    /** @notice Harvest.finance's reward token address */
    address public constant rewardToken = 0x60781C2586D68229fde47564546784ab3fACA982;

    /** @notice max deposit's default value in percentage */
    uint256 public maxDepositProtocolPct; // basis points

    /** @notice  Maps liquidityPool to max deposit value in percentage */
    mapping(address => uint256) public maxDepositPoolPct; // basis points

    /** @notice  Maps liquidityPool to max deposit value in absolute value for a specific token */
    mapping(address => mapping(address => uint256)) public maxDepositAmount;

    constructor() public {
        setMaxDepositProtocolPct(uint256(10000)); // 100% (basis points)
        setMaxDepositProtocolMode(MaxExposure.Pct);
    }

    /**
     * @inheritdoc IAdapterInvestLimit
     */
    function setMaxDepositPoolPct(address _liquidityPool, uint256 _maxDepositPoolPct) external override {
        require(_liquidityPool.isContract(), "!isContract");
        maxDepositPoolPct[_liquidityPool] = _maxDepositPoolPct;
        emit LogMaxDepositPoolPct(maxDepositPoolPct[_liquidityPool], msg.sender);
    }

    /**
     * @inheritdoc IAdapterInvestLimit
     */
    function setMaxDepositAmount(
        address _liquidityPool,
        address _underlyingToken,
        uint256 _maxDepositAmount
    ) external override {
        require(_liquidityPool.isContract(), "!_liquidityPool.isContract()");
        require(_underlyingToken.isContract(), "!_underlyingToken.isContract()");
        maxDepositAmount[_liquidityPool][_underlyingToken] = _maxDepositAmount;
        emit LogMaxDepositAmount(maxDepositAmount[_liquidityPool][_underlyingToken], msg.sender);
    }

    /**
     * @inheritdoc IAdapterInvestLimit
     */
    function setMaxDepositProtocolMode(MaxExposure _mode) public override {
        maxDepositProtocolMode = _mode;
        emit LogMaxDepositProtocolMode(maxDepositProtocolMode, msg.sender);
    }

    /**
     * @inheritdoc IAdapterInvestLimit
     */
    function setMaxDepositProtocolPct(uint256 _maxDepositProtocolPct) public override {
        maxDepositProtocolPct = _maxDepositProtocolPct;
        emit LogMaxDepositProtocolPct(maxDepositProtocolPct, msg.sender);
    }

    /**
     * @inheritdoc IAdapter
     */
    function getDepositAllCodes(
        address payable _vault,
        address _liquidityPool,
        address
    ) public view override returns (bytes[] memory _codes) {
        uint256 _amount = IERC20(_liquidityPool).balanceOf(_vault);

        return getDepositSomeCodes(_vault, _liquidityPool, MINICHEF_ADDRESS, _amount);
    }

    /**
     * @inheritdoc IAdapter
     */
    function getWithdrawAllCodes(
        address payable _vault,
        address _liquidityPool,
        address _depositPool
    ) public view override returns (bytes[] memory _codes) {
        uint256 _redeemAmount = getLiquidityPoolTokenBalance(_vault, _liquidityPool, _depositPool);
        return getWithdrawSomeCodes(_vault, _liquidityPool, _depositPool, _redeemAmount);
    }

    /**
     * @inheritdoc IAdapter
     */
    function getUnderlyingTokens(address _liquidityPool, address)
        public
        view
        override
        returns (address[] memory _underlyingTokens)
    {
        _underlyingTokens = new address[](1);
        // _underlyingTokens[0] = IPangolinFarmingDeposit(_liquidityPool).underlying();
        _underlyingTokens[0] = _liquidityPool;
    }

    /**
     * @inheritdoc IAdapter
     */
    function calculateAmountInLPToken(
        address,
        address _liquidityPool,
        uint256 _depositAmount
    ) public view override returns (uint256) {
        return _depositAmount;
    }

    /**
     * @inheritdoc IAdapter
     */
    function calculateRedeemableLPTokenAmount(
        address payable _vault,
        address _underlyingToken,
        address _liquidityPool,
        uint256 _redeemAmount
    ) public view override returns (uint256 _amount) {
        uint256 _liquidityPoolTokenBalance = getLiquidityPoolTokenBalance(_vault, _underlyingToken, _liquidityPool);
        uint256 _balanceInToken = getAllAmountInToken(_vault, _underlyingToken, _liquidityPool);
        // can have unintentional rounding errors
        _amount = (_liquidityPoolTokenBalance.mul(_redeemAmount)).div(_balanceInToken).add(1);
    }

    /**
     * @inheritdoc IAdapter
     */
    function isRedeemableAmountSufficient(
        address payable _vault,
        address _underlyingToken,
        address _liquidityPool,
        uint256 _redeemAmount
    ) public view override returns (bool) {
        uint256 _balanceInToken = getAllAmountInToken(_vault, _underlyingToken, _liquidityPool);
        return _balanceInToken >= _redeemAmount;
    }

    /**
     * @inheritdoc IAdapterHarvestReward
     */
    function getClaimRewardTokenCode(address payable _vault, address _liquidityPool)
        public
        view
        override
        returns (bytes[] memory _codes)
    {
        uint256 pId = _getPID(IERC20(_liquidityPool));
        _codes = new bytes[](1);
        _codes[0] = abi.encode(MINICHEF_ADDRESS, abi.encodeWithSignature("harvest()", pId, _vault));
    }

    function getRewardBalance(address _vault, address _liquidityPool) public view returns (uint256) {
        uint256 pId = _getPID(IERC20(_liquidityPool));
        return IPangolinFarmingDeposit(MINICHEF_ADDRESS).pendingReward(pId, _vault);
    }

    /**
     * @inheritdoc IAdapterHarvestReward
     */
    function getHarvestAllCodes(
        address payable _vault,
        address _liquidityPool,
        address
    ) public view override returns (bytes[] memory _codes) {
        uint256 _rewardTokenAmount = IERC20(getRewardToken(MINICHEF_ADDRESS)).balanceOf(_vault);
        return getHarvestSomeCodes(_vault, _liquidityPool, MINICHEF_ADDRESS, _rewardTokenAmount);
    }

    /**
     * @inheritdoc IAdapter
     */
    function canStake(address) public view override returns (bool) {
        return true;
    }

    /**
     * @inheritdoc IAdapter
     */
    function getDepositSomeCodes(
        address payable vault,
        address _liquidityPool, // LP token
        address, // MINICHEF_ADDRESS
        uint256 _amount
    ) public view override returns (bytes[] memory _codes) {
        uint256 _depositAmount = _getDepositAmount(MINICHEF_ADDRESS, _liquidityPool, _amount);
        if (_depositAmount > 0) {
            uint256 pId = _getPID(IERC20(_liquidityPool));

            _codes = new bytes[](3);
            _codes[0] = abi.encode(
                _liquidityPool,
                abi.encodeWithSignature("approve(address,uint256)", MINICHEF_ADDRESS, uint256(0))
            );
            _codes[1] = abi.encode(
                _liquidityPool,
                abi.encodeWithSignature("approve(address,uint256)", MINICHEF_ADDRESS, _depositAmount)
            );
            _codes[2] = abi.encode(
                MINICHEF_ADDRESS,
                abi.encodeWithSignature("deposit(uint256,uint256,address)", pId, _depositAmount, vault)
            );
        }
    }

    function _getPID(IERC20 _lpToken) internal view returns (uint256) {
        IERC20[] memory _lpTokens = IPangolinFarmingDeposit(MINICHEF_ADDRESS).lpTokens();
        uint256 len = _lpTokens.length;

        for (uint256 i = 0; i < len; i++) {
            if (_lpTokens[i] == _lpToken) {
                return i;
            }
        }
    }

    /**
     * @inheritdoc IAdapter
     */
    function getWithdrawSomeCodes(
        address payable _vault,
        address _liquidityPool,
        address,
        uint256 _shares
    ) public view override returns (bytes[] memory _codes) {
        if (_shares > 0) {
            uint256 pId = _getPID(IERC20(_liquidityPool));
            _codes = new bytes[](1);
            _codes[0] = abi.encode(
                MINICHEF_ADDRESS,
                abi.encodeWithSignature("withdraw(uint256,uint256,address)", pId, _shares, _vault)
            );
        }
    }

    /**
     * @inheritdoc IAdapter
     */
    function getPoolValue(address _liquidityPool, address) public view override returns (uint256) {
        return IPangolinFarmingDeposit(_liquidityPool).totalAllocPoint();
    }

    /**
     * @inheritdoc IAdapter
     */
    function getLiquidityPoolToken(address, address _liquidityPool) public view override returns (address) {
        return _liquidityPool;
    }

    /**
     * @inheritdoc IAdapter
     */
    function getAllAmountInToken(
        address payable _vault,
        address _underlyingToken,
        address _liquidityPool
    ) public view override returns (uint256) {
        return
            getSomeAmountInToken(
                _underlyingToken,
                _liquidityPool,
                getLiquidityPoolTokenBalance(_vault, _underlyingToken, _liquidityPool)
            );
    }

    /**
     * @inheritdoc IAdapter
     */
    function getLiquidityPoolTokenBalance(
        address payable _vault,
        address _liquidityPool,
        address _depositPool
    ) public view override returns (uint256) {
        uint256 pId = _getPID(IERC20(_liquidityPool));
        return IPangolinFarmingDeposit(_depositPool).userInfo(pId, _vault).amount;
        // return IERC20(_liquidityPool).balanceOf(_depositPool);
    }

    /**
     * @inheritdoc IAdapter
     */
    function getSomeAmountInToken(
        address,
        address _liquidityPool,
        uint256 _liquidityPoolTokenAmount
    ) public view override returns (uint256) {
        return _liquidityPoolTokenAmount;
    }

    /**
     * @inheritdoc IAdapter
     */
    function getRewardToken(address) public view override returns (address) {
        return rewardToken;
    }

    /**
     * @inheritdoc IAdapterHarvestReward
     */
    function getUnclaimedRewardTokenAmount(
        address payable _vault,
        address _liquidityPool,
        address
    ) public view override returns (uint256) {
        return IHarvestFarm(_liquidityPool).earned(_vault);
    }

    /**
     * @inheritdoc IAdapterHarvestReward
     */
    function getHarvestSomeCodes(
        address payable _vault,
        address _underlyingToken,
        address _liquidityPool,
        uint256 _rewardTokenAmount
    ) public view override returns (bytes[] memory _codes) {
        return _getHarvestCodes(_vault, getRewardToken(_liquidityPool), _underlyingToken, _rewardTokenAmount);
    }

    /* solhint-disable no-empty-blocks */

    /**
     * @inheritdoc IAdapterHarvestReward
     */
    function getAddLiquidityCodes(address payable, address) public view override returns (bytes[] memory) {}

    /**
     * @dev Returns the maximum allowed deposit amount considering the percentage limit or the absolute limit
     * @param _liquidityPool Liquidity pool's contract address
     * @param _depositPool Token address acting as underlying Asset for the vault contract
     * @param _amount The amount of the underlying token to be deposited
     * @return Returns the maximum deposit allowed according to _amount and the limits set
     */
    function _getDepositAmount(
        address _liquidityPool,
        address _depositPool,
        uint256 _amount
    ) internal view returns (uint256) {
        uint256 _limit = maxDepositProtocolMode == MaxExposure.Pct
            ? _getMaxDepositAmountByPct(_liquidityPool)
            : maxDepositAmount[_liquidityPool][_depositPool];
        return _amount > _limit ? _limit : _amount;
    }

    /**
     * @dev Returns the maximum allowed deposit amount when the adapter is in percentage mode
     * @param _liquidityPool Liquidity pool's contract address
     * @return Returns the maximum deposit allowed according to _amount and the limits set
     */
    function _getMaxDepositAmountByPct(address _liquidityPool) internal view returns (uint256) {
        uint256 _poolValue = getPoolValue(_liquidityPool, address(0));
        uint256 _poolPct = maxDepositPoolPct[_liquidityPool];
        uint256 _limit = _poolPct == 0
            ? _poolValue.mul(maxDepositProtocolPct).div(uint256(10000))
            : _poolValue.mul(_poolPct).div(uint256(10000));
        return _limit;
    }

    /**
     * @dev Get the codes for harvesting the tokens using uniswap router
     * @param _vault Vault contract address
     * @param _rewardToken Reward token address
     * @param _underlyingToken Token address acting as underlying Asset for the vault contract
     * @param _rewardTokenAmount reward token amount to harvest
     * @return _codes List of harvest codes for harvesting reward tokens
     */
    function _getHarvestCodes(
        address payable _vault,
        address _rewardToken,
        address _underlyingToken,
        uint256 _rewardTokenAmount
    ) internal view returns (bytes[] memory _codes) {
        if (_rewardTokenAmount > 0) {
            uint256[] memory _amounts = IPangolinRouter(pangolinV2Router).getAmountsOut(
                _rewardTokenAmount,
                _getPath(_rewardToken, _underlyingToken)
            );
            if (_amounts[_amounts.length - 1] > 0) {
                _codes = new bytes[](3);
                _codes[0] = abi.encode(
                    _rewardToken,
                    abi.encodeWithSignature("approve(address,uint256)", pangolinV2Router, uint256(0))
                );
                _codes[1] = abi.encode(
                    _rewardToken,
                    abi.encodeWithSignature("approve(address,uint256)", pangolinV2Router, _rewardTokenAmount)
                );
                _codes[2] = abi.encode(
                    pangolinV2Router,
                    abi.encodeWithSignature(
                        "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
                        _rewardTokenAmount,
                        uint256(0),
                        _getPath(_rewardToken, _underlyingToken),
                        _vault,
                        uint256(-1)
                    )
                );
            }
        }
    }

    /**
     * @dev Constructs the path for token swap on Uniswap
     * @param _initialToken The token to be swapped with
     * @param _finalToken The token to be swapped for
     * @return _path The array of tokens in the sequence to be swapped for
     */
    function _getPath(address _initialToken, address _finalToken) internal pure returns (address[] memory _path) {
        address _weth = IPangolinRouter(pangolinV2Router).WAVAX();
        if (_finalToken == _weth) {
            _path = new address[](2);
            _path[0] = _initialToken;
            _path[1] = _weth;
        } else if (_initialToken == _weth) {
            _path = new address[](2);
            _path[0] = _weth;
            _path[1] = _finalToken;
        } else {
            _path = new address[](3);
            _path[0] = _initialToken;
            _path[1] = _weth;
            _path[2] = _finalToken;
        }
    }

    /**
     * @dev Get the underlying token amount equivalent to reward token amount
     * @param _rewardToken Reward token address
     * @param _underlyingToken Token address acting as underlying Asset for the vault contract
     * @param _amount reward token balance amount
     * @return equivalent reward token balance in Underlying token value
     */
    function _getRewardBalanceInUnderlyingTokens(
        address _rewardToken,
        address _underlyingToken,
        uint256 _amount
    ) internal view returns (uint256) {
        uint256[] memory _amountsA = IPangolinRouter(pangolinV2Router).getAmountsOut(
            _amount,
            _getPath(_rewardToken, _underlyingToken)
        );
        return _amountsA[_amountsA.length - 1];
    }
}
