/* eslint-disable no-console */
// npx jest src/dex/balancer-v2/balancer-v2-gyroE.test.ts
import dotenv from 'dotenv';
dotenv.config();

import { Interface } from '@ethersproject/abi';
import { BigNumber } from '@ethersproject/bignumber';

import { Tokens } from '../../../tests/constants-e2e';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BalancerV2EventPool } from './balancer-v2';
import { BalancerConfig } from './config';
import { BalancerPoolTypes, PoolState, SubgraphPoolBase } from './types';
import { GyroEPool, GyroEPoolPairData } from './pools/gyro/GyroEPool';
import VaultABI from '../../abi/balancer-v2/vault.json';

import { Contract } from '@ethersproject/contracts';
import { JsonRpcProvider } from '@ethersproject/providers';

const provider = new JsonRpcProvider(process.env.HTTP_PROVIDER_137);
const vaultAddress = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';
const vaultContract = new Contract(vaultAddress, VaultABI, provider);

// Compare retrieve an onchain query result for a single swap
async function queryOnChain(
  blockNumber: number,
  poolId: string,
  kind: 0 | 1,
  assetIn: string,
  assetOut: string,
  amount: BigInt,
): Promise<bigint[]> {
  const funds = {
    sender: '0x0000000000000000000000000000000000000000',
    recipient: '0x0000000000000000000000000000000000000000',
    fromInternalBalance: false,
    toInternalBalance: false,
  };
  const swaps = [
    {
      poolId,
      assetInIndex: 0,
      assetOutIndex: 1,
      amount,
      userData: '0x',
    },
  ];
  const assets = [assetIn, assetOut];
  const deltas = await vaultContract.callStatic.queryBatchSwap(
    kind,
    swaps,
    assets,
    funds,
    {
      blockTag: blockNumber,
    },
  );
  console.log(deltas.toString());
  return [deltas[0].toBigInt(), deltas[1].toBigInt()];
}

describe('BalancerV2', () => {
  const dexKey = 'BalancerV2';
  const network = Network.POLYGON;
  const config = BalancerConfig[dexKey][network];
  const vaultInterface = new Interface(VaultABI);
  const gyroEPool = new GyroEPool(config.vaultAddress, vaultInterface);
  const tokens = Tokens[network];
  let GyroEPoolSg: SubgraphPoolBase;
  let GyroEPoolState: PoolState;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  const balancerPools = new BalancerV2EventPool(
    dexKey,
    network,
    config.vaultAddress,
    config.subgraphURL,
    dexHelper,
    logger,
  );

  describe('GyroE Pool V1', () => {
    describe('Pool Fetching', () => {
      it('should be supported pool type', async function () {
        expect(balancerPools.isSupportedPool('GyroE')).toBe(true);
      });

      it('should fetch GyroE Pool with correct fields from Subgraph', async function () {
        const pools = await balancerPools.fetchAllSubgraphPools();
        // USDC/TUSD
        const GyroEPoolId =
          '0x97469e6236bd467cd147065f77752b00efadce8a0002000000000000000008c0';
        const GyroE = pools.filter(p => p.id === GyroEPoolId);
        expect(GyroE.length).toBe(1);
        GyroEPoolSg = GyroE[0];
        expect(GyroEPoolSg.tokens.length).toBe(2);
        expect(GyroEPoolSg.alpha).not.toBeNull();
        expect(GyroEPoolSg.beta).not.toBeNull();
        expect(GyroEPoolSg.c).not.toBeNull();
        expect(GyroEPoolSg.s).not.toBeNull();
        expect(GyroEPoolSg.lambda).not.toBeNull();
        expect(GyroEPoolSg.tauAlphaX).not.toBeNull();
        expect(GyroEPoolSg.tauAlphaY).not.toBeNull();
        expect(GyroEPoolSg.tauBetaX).not.toBeNull();
        expect(GyroEPoolSg.tauBetaY).not.toBeNull();
        expect(GyroEPoolSg.u).not.toBeNull();
        expect(GyroEPoolSg.v).not.toBeNull();
        expect(GyroEPoolSg.w).not.toBeNull();
        expect(GyroEPoolSg.z).not.toBeNull();
        expect(GyroEPoolSg.dSq).not.toBeNull();
        expect(GyroEPoolSg.poolTypeVersion).toEqual(1);
      });

      it('getOnChainState', async function () {
        const blocknumber = 40068730;
        const state = await balancerPools.getOnChainState(
          [GyroEPoolSg],
          blocknumber,
        );
        GyroEPoolState = state[GyroEPoolSg.address];
        expect(GyroEPoolState.swapFee).toBe(BigInt('200000000000000'));
        expect(GyroEPoolState.tokens[tokens.USDC.address].balance).toBe(
          BigInt('18186193501'),
        );
        expect(
          GyroEPoolState.tokens[tokens.TUSD.address.toLowerCase()].balance,
        ).toBe(BigInt('26629907962671451455387'));
      });

      it('parsePoolPairData', async function () {
        const tokenIn = tokens.USDC.address;
        const tokenOut = tokens.TUSD.address;
        const pairData = gyroEPool.parsePoolPairData(
          GyroEPoolSg,
          GyroEPoolState,
          tokenIn,
          tokenOut,
        );
        expect(pairData.indexIn).toBe(0);
        expect(pairData.indexOut).toBe(1);
        expect(pairData.swapFee).toBe(BigInt('200000000000000'));
        expect(pairData.balances).toStrictEqual([
          BigNumber.from('18186193501000000000000'),
          BigNumber.from('26629907962671451455387'),
        ]);
        expect(pairData.tokenInIsToken0).toBe(true);
      });
    });

    describe('Swap Functions', () => {
      describe('Swap Functions  - 6decimals>18decimals', () => {
        const pairData: GyroEPoolPairData = {
          tokenInIsToken0: true,
          balances: [
            BigNumber.from('18186193501000000000000'),
            BigNumber.from('26629907962671451455387'),
          ],
          indexIn: 0,
          indexOut: 1,
          scalingFactors: [
            1000000000000000000000000000000n,
            1000000000000000000n,
          ],
          swapFee: 200000000000000n,
          gyroDerivedParams: {
            tauAlpha: {
              x: BigNumber.from('-99921684096872623630266893017017590000'),
              y: BigNumber.from('3956898690236155895758568963473897000'),
            },
            tauBeta: {
              x: BigNumber.from('99921684096872623626859806443439160000'),
              y: BigNumber.from('3956898690236155981796108700303143000'),
            },
            u: BigNumber.from('99921684096872623515276234437562470000'),
            v: BigNumber.from('3956898690236155934291169066298950000'),
            w: BigNumber.from('43018769868414623130'),
            z: BigNumber.from('-1703543286789219094'),
            dSq: BigNumber.from('99999999999999999886624093342106120000'),
          },
          gyroParams: {
            alpha: BigNumber.from('980000000000000000'),
            beta: BigNumber.from('1020408163265306122'),
            c: BigNumber.from('707106781186547524'),
            s: BigNumber.from('707106781186547524'),
            lambda: BigNumber.from('2500000000000000000000'),
          },
          tokenRates: [],
          rateProviders: [],
        };

        it('getSwapMaxAmount', async () => {
          const swapMaxAmount = gyroEPool.getSwapMaxAmount(
            pairData,
            SwapSide.SELL,
          );
          expect(swapMaxAmount).toBe(BigInt('26629881332'));
        });

        it('swap', async function () {
          const amountIn = BigInt('13500000');
          const amountOut = gyroEPool.onSell([amountIn], pairData);
          expect(amountOut.length).toBe(1);
          expect(amountOut[0].toString()).toBe('13499365736688193741');
        });
      });

      describe('Swap Functions  - 18decimals>6decimals', () => {
        const pairData: GyroEPoolPairData = {
          tokenInIsToken0: false,
          balances: [
            BigNumber.from('18186193501000000000000'),
            BigNumber.from('26629907962671451455387'),
          ],
          indexIn: 1,
          indexOut: 0,
          scalingFactors: [
            1000000000000000000000000000000n,
            1000000000000000000n,
          ],
          swapFee: 200000000000000n,
          gyroDerivedParams: {
            tauAlpha: {
              x: BigNumber.from('-99921684096872623630266893017017590000'),
              y: BigNumber.from('3956898690236155895758568963473897000'),
            },
            tauBeta: {
              x: BigNumber.from('99921684096872623626859806443439160000'),
              y: BigNumber.from('3956898690236155981796108700303143000'),
            },
            u: BigNumber.from('99921684096872623515276234437562470000'),
            v: BigNumber.from('3956898690236155934291169066298950000'),
            w: BigNumber.from('43018769868414623130'),
            z: BigNumber.from('-1703543286789219094'),
            dSq: BigNumber.from('99999999999999999886624093342106120000'),
          },
          gyroParams: {
            alpha: BigNumber.from('980000000000000000'),
            beta: BigNumber.from('1020408163265306122'),
            c: BigNumber.from('707106781186547524'),
            s: BigNumber.from('707106781186547524'),
            lambda: BigNumber.from('2500000000000000000000'),
          },
          tokenRates: [],
          rateProviders: [],
        };

        it('getSwapMaxAmount', async () => {
          const swapMaxAmount = gyroEPool.getSwapMaxAmount(
            pairData,
            SwapSide.SELL,
          );
          expect(swapMaxAmount).toBe(BigInt('18186175314806499000000'));
        });

        it('swap', async function () {
          const amountIn = BigInt('13500000000000000000');
          const amountOut = gyroEPool.onSell([amountIn], pairData);
          expect(amountOut.length).toBe(1);
          expect(amountOut[0].toString()).toBe('13495227');
        });
      });
    });

    describe('Onchain Compare', () => {
      it('exactIn', async function () {
        const blocknumber = 54571344;
        // USDC/TUSD
        const poolId =
          '0x97469e6236bd467cd147065f77752b00efadce8a0002000000000000000008c0';
        const tokenIn = tokens.USDC.address;
        const tokenOut = tokens.TUSD.address;
        const amountIn = BigInt('1000000');

        const pools = await balancerPools.fetchAllSubgraphPools();
        const poolSg = pools.filter(p => p.id === poolId)[0];
        const state = await balancerPools.getOnChainState(
          [poolSg],
          blocknumber,
        );
        const poolState = state[poolSg.address];

        const pairData = gyroEPool.parsePoolPairData(
          poolSg,
          poolState,
          tokenIn,
          tokenOut,
        );
        const amountOut = gyroEPool.onSell([amountIn], pairData);
        const deltas = await queryOnChain(
          blocknumber,
          poolId,
          0,
          tokenIn,
          tokenOut,
          amountIn,
        );
        expect(amountIn).toEqual(deltas[0]);
        expect(amountOut[0] + deltas[1]).toEqual(0n);
      });
      it('exactOut', async function () {
        const blocknumber = 54571344;
        // USDC/TUSD
        const poolId =
          '0x97469e6236bd467cd147065f77752b00efadce8a0002000000000000000008c0';
        const tokenIn = tokens.USDC.address;
        const tokenOut = tokens.TUSD.address;
        const amountOut = BigInt('2000000000000000000');

        const pools = await balancerPools.fetchAllSubgraphPools();
        const poolSg = pools.filter(p => p.id === poolId)[0];
        const state = await balancerPools.getOnChainState(
          [poolSg],
          blocknumber,
        );
        const poolState = state[poolSg.address];

        const pairData = gyroEPool.parsePoolPairData(
          poolSg,
          poolState,
          tokenIn,
          tokenOut,
        );
        const amountIn = gyroEPool.onBuy([amountOut], pairData);
        const deltas = await queryOnChain(
          blocknumber,
          poolId,
          1,
          tokenIn,
          tokenOut,
          amountOut,
        );
        expect(amountIn[0]).toEqual(deltas[0]);
        expect(amountOut + deltas[1]).toEqual(0n);
      });
    });
  });
});