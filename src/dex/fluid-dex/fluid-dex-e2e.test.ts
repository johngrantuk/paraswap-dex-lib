/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { generateConfig } from '../../config';
import { CollateralReserves, DebtReserves, DexLimits } from './types';
import { DummyDexHelper } from '../../dex-helper/index';
import { FluidDex } from './fluid-dex';
import { adjustTestSwapOutAmount } from './utils';

function testForNetwork(
  network: Network,
  dexKey: string,
  tokenASymbol: string,
  tokenBSymbol: string,
  tokenAAmount: string,
  tokenBAmount: string,
) {
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );

  const tokens = Tokens[network];
  const holders = Holders[network];
  let adjustedTokenAAmount = tokenAAmount;
  let adjustedTokenBAmount = tokenBAmount;

  // Create FluidDex instance to check reserves
  const dexHelper = new DummyDexHelper(network);
  const fluidDex = new FluidDex(network, dexKey, dexHelper);

  const sideToContractMethods = new Map([
    [SwapSide.SELL, [ContractMethod.swapExactAmountIn]],
    [SwapSide.BUY, [ContractMethod.swapExactAmountOut]],
  ]);

  describe(`${network}`, () => {
    sideToContractMethods.forEach((contractMethods, side) =>
      describe(`${side}`, () => {
        contractMethods.forEach((contractMethod: string) => {
          describe(`${contractMethod}`, () => {
            it(`${tokenBSymbol} -> ${tokenASymbol}`, async () => {
              await fluidDex.initializePricing(await provider.getBlockNumber());
              if (contractMethod === ContractMethod.swapExactAmountOut) {
                adjustedTokenBAmount = adjustTestSwapOutAmount(
                  BigInt(tokenBAmount),
                  tokens[tokenBSymbol].decimals,
                );
              }

              try {
                const pricesB2A = await fluidDex.getPricesVolume(
                  tokens[tokenBSymbol],
                  tokens[tokenASymbol],
                  [BigInt(adjustedTokenBAmount)],
                  side,
                  await provider.getBlockNumber(),
                );
                console.log(
                  `price check ${tokenBSymbol} -> ${tokenASymbol}`,
                  pricesB2A,
                );
              } catch (e: any) {
                console.log(`Skipping ${tokenBSymbol} -> ${tokenASymbol}`);
                const errorMessages = [
                  'TokenReservesTooLow',
                  'InvalidCollateralReserves',
                  'No pools are enabled',
                  'DebtReservesTooLow',
                  'DebtLimitReached',
                  'WithdrawLimitReached',
                  'OracleUpdateHugeSwapDiff',
                ];
                if (
                  errorMessages.some(errorMessage =>
                    e.message.includes(errorMessage),
                  )
                ) {
                  return;
                }
              }

              await testE2E(
                tokens[tokenBSymbol],
                tokens[tokenASymbol],
                holders[tokenBSymbol],
                adjustedTokenBAmount,
                side,
                dexKey,
                contractMethod as ContractMethod,
                network,
                provider,
              );
            });

            it(`${tokenASymbol} -> ${tokenBSymbol}`, async () => {
              // Check prices before running test
              try {
                await fluidDex.initializePricing(
                  await provider.getBlockNumber(),
                );

                if (contractMethod === ContractMethod.swapExactAmountOut) {
                  adjustedTokenAAmount = adjustTestSwapOutAmount(
                    BigInt(tokenAAmount),
                    tokens[tokenASymbol].decimals,
                  );
                }

                const pricesA2B = await fluidDex.getPricesVolume(
                  tokens[tokenASymbol],
                  tokens[tokenBSymbol],
                  [BigInt(adjustedTokenAAmount)],
                  side,
                  await provider.getBlockNumber(),
                );
                console.log(
                  `price check ${tokenASymbol} -> ${tokenBSymbol}`,
                  pricesA2B,
                );
              } catch (e: any) {
                console.log(`Skipping ${tokenASymbol} -> ${tokenBSymbol}`);
                const errorMessages = [
                  'TokenReservesTooLow',
                  'InvalidCollateralReserves',
                  'No pools are enabled',
                  'DebtReservesTooLow',
                  'DebtLimitReached',
                  'WithdrawLimitReached',
                  'OracleUpdateHugeSwapDiff',
                ];
                if (
                  errorMessages.some(errorMessage =>
                    e.message.includes(errorMessage),
                  )
                ) {
                  return;
                }
              }

              await testE2E(
                tokens[tokenASymbol],
                tokens[tokenBSymbol],
                holders[tokenASymbol],
                adjustedTokenAAmount,
                side,
                dexKey,
                contractMethod as ContractMethod,
                network,
                provider,
              );
            });
          });
        });
      }),
    );
  });
}

describe('FluidDex E2E', () => {
  const dexKey = 'FluidDex';

  describe('Mainnet', () => {
    const network = Network.MAINNET;

    describe('failing:FLUID -> ETH', () => {
      const tokenASymbol: string = 'FLUID';
      const tokenBSymbol: string = 'ETH';
      const tokenAAmount: string = '160097047322810379';
      const tokenBAmount: string = '79923068733005505624';

      testForNetwork(
        network,
        dexKey,
        tokenASymbol,
        tokenBSymbol,
        tokenAAmount,
        tokenBAmount,
      );
    });

    describe('ETH -> wstETH', () => {
      const tokenASymbol: string = 'wstETH';
      const tokenBSymbol: string = 'ETH';

      const tokenAAmount: string = '100000000000000';
      const tokenBAmount: string = '100000000000000';

      testForNetwork(
        network,
        dexKey,
        tokenASymbol,
        tokenBSymbol,
        tokenAAmount,
        tokenBAmount,
      );
    });

    describe('USDC -> USDT', () => {
      const tokenASymbol: string = 'USDC';
      const tokenBSymbol: string = 'USDT';

      const tokenAAmount: string = '10000';
      const tokenBAmount: string = '1000000';

      testForNetwork(
        network,
        dexKey,
        tokenASymbol,
        tokenBSymbol,
        tokenAAmount,
        tokenBAmount,
      );
    });
  });

  describe('Arbitrum', () => {
    const network = Network.ARBITRUM;

    describe('ETH -> wstETH', () => {
      const tokenASymbol: string = 'wstETH';
      const tokenBSymbol: string = 'ETH';

      const tokenAAmount: string = '1000000000000000';
      const tokenBAmount: string = '1000000000000000';

      testForNetwork(
        network,
        dexKey,
        tokenASymbol,
        tokenBSymbol,
        tokenAAmount,
        tokenBAmount,
      );
    });

    describe('ETH -> weETH', () => {
      const tokenBSymbol: string = 'ETH';
      const tokenASymbol: string = 'weETH';

      const tokenAAmount: string = '1000000000000000';
      const tokenBAmount: string = '1000000000000000';

      testForNetwork(
        network,
        dexKey,
        tokenASymbol,
        tokenBSymbol,
        tokenAAmount,
        tokenBAmount,
      );
    });
  });
});

function NewColReservesOne(): CollateralReserves {
  return {
    token0RealReserves: BigInt(20000000006000000),
    token1RealReserves: BigInt(20000000000500000),
    token0ImaginaryReserves: BigInt(389736659726997981),
    token1ImaginaryReserves: BigInt(389736659619871949),
  };
}

function NewDebtReservesOne(): DebtReserves {
  return {
    token0Debt: BigInt(1e18),
    token1Debt: BigInt(1e18),
    token0RealReserves: BigInt(9486832995556050),
    token1RealReserves: BigInt(9486832993079885),
    token0ImaginaryReserves: BigInt(184868330099560759),
    token1ImaginaryReserves: BigInt(184868330048879109),
  };
}

const centerPriceTight: bigint = 3401944443797854601871360n;
const centerPriceWide: bigint = 1190081051944310368000000000n;

const limitsTight: DexLimits = {
  withdrawableToken0: {
    available: 456740438880263n,
    expandsTo: 711907234052361388866n,
    expandsDuration: 600n,
  },
  withdrawableToken1: {
    available: 825179383432029n,
    expandsTo: 711907234052361388866n,
    expandsDuration: 600n,
  },
  borrowableToken0: {
    available: 941825058374170n,
    expandsTo: 711907234052361388866n,
    expandsDuration: 600n,
  },
  borrowableToken1: {
    available: 941825058374170n,
    expandsTo: 711907234052361388866n,
    expandsDuration: 600n,
  },
};

const limitsWide: DexLimits = {
  withdrawableToken0: {
    available: BigInt(34242332879776515083099999),
    expandsTo: BigInt(34242332879776515083099999),
    expandsDuration: 0n,
  },
  withdrawableToken1: {
    available: BigInt(34242332879776515083099999),
    expandsTo: BigInt(34242332879776515083099999),
    expandsDuration: 22n,
  },
  borrowableToken0: {
    available: BigInt(34242332879776515083099999),
    expandsTo: BigInt(34242332879776515083099999),
    expandsDuration: 0n,
  },
  borrowableToken1: {
    available: BigInt(34242332879776515083099999),
    expandsTo: BigInt(34242332879776515083099999),
    expandsDuration: 308n,
  },
};

const ErrInsufficientBorrowable = new Error('DebtLimitReached');
const ErrInsufficientMaxPrice = new Error('OracleUpdateHugeSwapDiff');
const ErrInsufficientReserve = new Error('DebtReservesTooLow');

describe('TestPoolSimulator_SwapInLimits', () => {
  const network = Network.MAINNET;
  const dexHelper = new DummyDexHelper(network);
  const dexKey = 'FluidDex';
  const fluidDex = new FluidDex(network, dexKey, dexHelper);

  it('when limits hit', () => {
    let outAmt;
    try {
      outAmt = fluidDex.swapInAdjusted(
        true,
        BigInt(1e15),
        NewColReservesOne(),
        NewDebtReservesOne(),
        100n,
        18,
        limitsTight,
        BigInt(centerPriceTight),
        Math.floor(Date.now() / 1000) - 10,
      );
      expect(outAmt).toEqual(0n);
    } catch (err: any) {
      expect(err.message).toEqual(ErrInsufficientBorrowable.message);
    }
  });

  it('when expanded', () => {
    const outAmt = fluidDex.swapInAdjusted(
      true,
      BigInt(1e15),
      NewColReservesOne(),
      NewDebtReservesOne(),
      100n,
      18,
      limitsTight,
      BigInt(centerPriceTight),
      Math.floor(Date.now() / 1000) - 6000,
    );
    expect(outAmt?.toString()).toEqual('998163044346107');
  });

  it('when price diff hit', () => {
    let outAmt;
    try {
      outAmt = fluidDex.swapInAdjusted(
        true,
        BigInt(3e16),
        NewColReservesOne(),
        NewDebtReservesOne(),
        100n,
        18,
        limitsWide,
        BigInt(centerPriceWide),
        Math.floor(Date.now() / 1000) - 10,
      );
      expect(outAmt).toEqual(0n);
    } catch (err: any) {
      expect(err.message).toEqual(ErrInsufficientMaxPrice.message);
    }
  });

  it('when reserves limit is hit', () => {
    let outAmt;
    try {
      outAmt = fluidDex.swapInAdjusted(
        true,
        BigInt(5e16),
        NewColReservesOne(),
        NewDebtReservesOne(),
        100n,
        18,
        limitsWide,
        BigInt(centerPriceWide),
        Math.floor(Date.now() / 1000) - 10,
      );
      expect(outAmt).toEqual(0n);
    } catch (err: any) {
      expect(err.message).toEqual(ErrInsufficientReserve.message);
    }
  });
});
