import { Interface } from '@ethersproject/abi';
import { AsyncOrSync } from 'ts-essentials';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  PoolLiquidity,
  Logger,
  NumberAsString,
  DexExchangeParam,
  TransferFeeParams,
} from '../../types';
import {
  SwapSide,
  Network,
  DEST_TOKEN_PARASWAP_TRANSFERS,
  SRC_TOKEN_PARASWAP_TRANSFERS,
} from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork, getBigIntPow } from '../../utils';
import { Context, IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { OSwapData, OSwapPool, OSwapPoolState } from './types';
import {
  SimpleExchange,
  getLocalDeadlineAsFriendlyPlaceholder,
} from '../simple-exchange';
import { OSwapConfig, Adapters, OSWAP_GAS_COST } from './config';
import { OSwapEventPool } from './oswap-pool';
import OSwapABI from '../../abi/oswap/oswap.abi.json';
import ERC4626ABI from '../../abi/ERC4626.json';
import { extractReturnAmountPosition } from '../../executor/utils';
import { applyTransferFee } from '../../lib/token-transfer-fee';
import { uint256ToBigInt } from '../../lib/decoders';
import { isSusdeUsdePool } from './utils';

export class OSwap extends SimpleExchange implements IDex<OSwapData> {
  readonly eventPools: { [id: string]: OSwapEventPool } = {};

  readonly hasConstantPriceLargeAmounts = false;

  // This may change in the future, but currently OSwap does not support native ETH.
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = true;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(OSwapConfig);

  logger: Logger;

  readonly iOSwap: Interface;

  readonly pools: OSwapPool[];

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.iOSwap = new Interface(OSwapABI);

    this.pools = OSwapConfig[dexKey][network].pools;

    // Create an OSwapEventPool per pool, to track each pool's state by subscribing to on-chain events.
    for (const pool of this.pools) {
      this.eventPools[pool.id] = new OSwapEventPool(
        dexKey,
        pool,
        network,
        dexHelper,
        this.logger,
      );
    }
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return null;
  }

  // Returns the pool matching the specified token pair or null if none found.
  // Note: OSwap V1 does not support more than 1 pool per pair.
  getPoolByTokenPair(srcToken: Token, destToken: Token): OSwapPool | null {
    const srcAddress = srcToken.address.toLowerCase();
    const destAddress = destToken.address.toLowerCase();

    // A pair must have 2 different tokens.
    if (srcAddress === destAddress) return null;

    for (const pool of this.pools) {
      if (
        (srcAddress === pool.token0 && destAddress === pool.token1) ||
        (srcAddress === pool.token1 && destAddress === pool.token0)
      ) {
        return pool;
      }
    }
    return null;
  }

  getPoolById(id: string): OSwapPool | null {
    for (const pool of this.pools) {
      if (pool.id === id) return pool;
    }
    return null;
  }

  // Returns a list of pool using the token.
  getPoolsByTokenAddress(tokenAddress: Address): OSwapPool[] {
    const address = tokenAddress.toLowerCase();
    let pools: OSwapPool[] = [];
    for (const pool of this.pools) {
      if (address === pool.token0 || address === pool.token1) {
        pools.push(pool);
      }
    }
    return pools;
  }

  // Returns the list of pool identifiers that can be used
  // for a given swap. poolIdentifiers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${poolAddress} as a poolIdentifier
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const pool = this.getPoolByTokenPair(srcToken, destToken);
    return pool ? [pool.id] : [];
  }

  // Convert amount using pool-specific logic.
  // For sUSDe-USDe pool, uses ERC4626 convertToAssets/convertToShares calculated locally.
  // For other pools, returns the amount as-is.
  convertAmount(
    pool: OSwapPool,
    from: Token,
    amount: bigint,
    state: OSwapPoolState,
  ): bigint {
    if (isSusdeUsdePool(pool.id)) {
      // token0 is USDe (liquidityAsset), token1 is sUSDe (baseAsset, ERC4626 vault)
      // Use ERC4626 conversion formula matching Solidity _convert function
      if (!state.totalAssets || !state.totalShares) {
        this.logger.error(
          `convertAmount: Missing ERC4626 state for pool ${pool.id}`,
        );
        return 0n;
      }

      const totalAssets = BigInt(state.totalAssets);
      const totalShares = BigInt(state.totalShares);

      if (totalAssets === 0n || totalShares === 0n) {
        return 0n;
      }

      const fromAddress = from.address.toLowerCase();
      const isFromUsde = fromAddress === pool.token0.toLowerCase();

      if (isFromUsde) {
        // Converting from USDe (liquidityAsset) to sUSDe (baseAsset): convertToShares
        // Matches: if (token == liquidityAsset) return susde.convertToShares(amount)
        return (amount * totalShares) / totalAssets;
      } else {
        // Converting from sUSDe (baseAsset) to USDe (liquidityAsset): convertToAssets
        // Matches: if (token == baseAsset) return susde.convertToAssets(amount)
        return (amount * totalAssets) / totalShares;
      }
    }

    return amount;
  }

  // Sell: Given "amount" of "from" token, how much of "to" token will be received by the trader.
  // Buy: Given "amount" of "dest" token, how much of "to" token is required from the trader.
  // Note: OSwap traderate is at precision 36.
  private calcPrice(
    pool: OSwapPool,
    state: OSwapPoolState,
    from: Token,
    amount: bigint,
    side: SwapSide,
    checkLiquidity = true,
  ): bigint {
    // For BUY side, amount represents the destination token amount, so we need to convert
    // based on the destination token direction, not the source token.
    // For SELL side, amount represents the source token amount, so we convert based on from.
    let convertedAmount: bigint;
    if (side === SwapSide.BUY && isSusdeUsdePool(pool.id)) {
      // For BUY side on sUSDe-USDe pool, amount is destToken amount
      // We need to convert the opposite direction: if from is USDe, amount is sUSDe, so convert sUSDe->USDe
      const fromAddress = from.address.toLowerCase();
      const isFromUsde = fromAddress === pool.token0.toLowerCase();
      // For BUY: if from is USDe, dest is sUSDe, so we convert sUSDe amount
      // if from is sUSDe, dest is USDe, so we convert USDe amount
      const tokenToConvert = isFromUsde ? pool.token1 : pool.token0;
      convertedAmount = this.convertAmount(
        pool,
        { address: tokenToConvert, decimals: 18 } as Token,
        amount,
        state,
      );
    } else {
      // For SELL side, amount is from token, convert normally
      convertedAmount = this.convertAmount(pool, from, amount, state);
    }

    const rate =
      from.address.toLowerCase() === pool.token0
        ? BigInt(state.traderate0)
        : BigInt(state.traderate1);

    const price =
      side === SwapSide.SELL
        ? (convertedAmount * rate) / getBigIntPow(36)
        : (convertedAmount * getBigIntPow(36)) / rate + 3n;

    if (
      checkLiquidity &&
      !this.hasEnoughLiquidity(pool, state, from, convertedAmount, price, side)
    ) {
      return 0n;
    }

    return price;
  }

  // Returns true if the pool has enough liquidity for the swap. False otherwise.
  hasEnoughLiquidity(
    pool: OSwapPool,
    state: OSwapPoolState,
    from: Token,
    amount: bigint,
    needed: bigint,
    side: SwapSide,
  ): boolean {
    const outstandingWithdrawals =
      BigInt(state.withdrawsQueued) - BigInt(state.withdrawsClaimed);

    if (outstandingWithdrawals > 0n) {
      if (needed + outstandingWithdrawals > BigInt(state.balance0)) {
        return false;
      }
    }

    if (side === SwapSide.SELL) {
      return from.address.toLowerCase() === pool.token0
        ? needed <= BigInt(state.balance1)
        : needed <= BigInt(state.balance0);
    }

    return from.address.toLowerCase() === pool.token0
      ? amount <= BigInt(state.balance1)
      : amount <= BigInt(state.balance0);
  }

  // Returns pool prices for amounts.
  // If limitPools is defined only pools in limitPools
  // should be used. If limitPools is undefined then
  // any pool can be used.
  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
    transferFees: TransferFeeParams = {
      srcFee: 0,
      destFee: 0,
      srcDexFee: 0,
      destDexFee: 0,
    },
  ): Promise<null | ExchangePrices<OSwapData>> {
    try {
      // Get the pool to use.
      const pool = this.getPoolByTokenPair(srcToken, destToken);
      if (!pool) return null;

      // Make sure the pool meets the optional limitPools filter.
      if (limitPools && !limitPools.includes(pool.id)) return null;

      const eventPool = this.eventPools[pool.id];

      if (!eventPool) {
        this.logger.error(`OSwap pool ${pool.id}: No EventPool found.`);

        return null;
      }

      const state = await eventPool.getStateOrGenerate(blockNumber);

      // Calculate the prices
      const unitAmount = getBigIntPow(18);
      const unitPrice = this.calcPrice(
        pool,
        state,
        srcToken,
        unitAmount,
        side,
        false,
      );

      const prices = amounts.map(amount =>
        this.calcPrice(pool, state, srcToken, amount, side),
      );

      const [unitPriceWithFee, ...pricesWithFee] = applyTransferFee(
        [unitPrice, ...prices],
        side,
        side === SwapSide.SELL ? transferFees.srcFee : transferFees.destFee,
        side === SwapSide.SELL
          ? SRC_TOKEN_PARASWAP_TRANSFERS
          : DEST_TOKEN_PARASWAP_TRANSFERS,
      );

      return [
        {
          prices: pricesWithFee,
          unit: unitPriceWithFee,
          data: {
            pool: pool.address,
            path: [srcToken.address, destToken.address],
          },
          exchange: this.dexKey,
          poolIdentifiers: [pool.id],
          gasCost: OSWAP_GAS_COST,
          poolAddresses: [pool.address],
        },
      ];
    } catch (e) {
      this.logger.error(
        `Error_getPricesVolume ${srcToken.address || srcToken.symbol}, ${
          destToken.address || destToken.symbol
        }, ${side}:`,
        e,
      );

      return null;
    }
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<OSwapData>): number | number[] {
    return (
      CALLDATA_GAS_COST.DEX_OVERHEAD +
      // ParentStruct header
      CALLDATA_GAS_COST.OFFSET_SMALL +
      // ParentStruct -> path[] header
      CALLDATA_GAS_COST.OFFSET_SMALL +
      // ParentStruct -> path length
      CALLDATA_GAS_COST.LENGTH_SMALL +
      // ParentStruct -> path[0]
      CALLDATA_GAS_COST.ADDRESS +
      // ParentStruct -> path[1]
      CALLDATA_GAS_COST.ADDRESS +
      // ParentStruct -> receiver header
      CALLDATA_GAS_COST.OFFSET_SMALL +
      // ParentStruct -> receiver
      CALLDATA_GAS_COST.ADDRESS
    );
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: OSwapData,
    side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: data.pool,
      payload: '',
      networkFee: '0',
    };
  }

  // Encode call data used by simpleSwap like routers
  // Used for simpleSwap & simpleBuy
  getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: OSwapData,
    side: SwapSide,
    _: Context,
    executorAddress: Address,
  ): DexExchangeParam {
    let method: string;
    let args: any;
    let returnAmountPos: number | undefined = undefined;

    const deadline = getLocalDeadlineAsFriendlyPlaceholder();
    if (side === SwapSide.SELL) {
      method = 'swapExactTokensForTokens';
      returnAmountPos = extractReturnAmountPosition(
        this.iOSwap,
        method,
        'amounts',
        1,
      );
      args = [srcAmount, destAmount, data.path, recipient, deadline];
    } else {
      method = 'swapTokensForExactTokens';
      args = [destAmount, srcAmount, data.path, recipient, deadline];
    }

    const swapData = this.iOSwap.encodeFunctionData(method, args);

    return {
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: true,
      exchangeData: swapData,
      targetExchange: data.pool,
      returnAmountPos,
    };
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    return Promise.resolve();
  }

  // Returns a list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    // Get the list of pools using the token.
    const pools = this.getPoolsByTokenAddress(tokenAddress);
    if (!pools.length) return [];

    const results = await Promise.all<PoolLiquidity>(
      pools.map(async pool => {
        // Get the pool's balance and its USD value.
        const eventPool = this.eventPools[pool.id];
        const blockNumber =
          await this.dexHelper.web3Provider.eth.getBlockNumber();
        const state = await eventPool.getStateOrGenerate(blockNumber);

        const usd0 = await this.dexHelper.getTokenUSDPrice(
          { address: pool.token0, decimals: 18 },
          BigInt(state.balance0),
        );
        const usd1 = await this.dexHelper.getTokenUSDPrice(
          { address: pool.token1, decimals: 18 },
          BigInt(state.balance1),
        );

        // Get the other token in the pair.
        const pairedToken =
          pool.token0 === tokenAddress.toLowerCase()
            ? { address: pool.token1, decimals: 18 }
            : { address: pool.token0, decimals: 18 };

        return {
          exchange: this.dexKey,
          address: pool.address,
          connectorTokens: [pairedToken],
          liquidityUSD: usd0 + usd1,
        };
      }),
    );
    return results
      .filter(r => r)
      .sort((a, b) => a.liquidityUSD - b.liquidityUSD)
      .slice(0, limit);
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {}
}
