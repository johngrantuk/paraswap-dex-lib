import dotenv from 'dotenv';
dotenv.config();

import { BalancerV2 } from './balancer-v2';
import { DummyDexHelper } from '../../dex-helper';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, SwapSide, ProviderURL, MAX_INT } from '../../constants';
import { OptimizedBalancerV2Data, SwapTypes, BalancerV2Data } from './types';
import { JsonRpcProvider } from '@ethersproject/providers';
import VaultABI from '../../abi/balancer-v2/vault.json';
import { Contract } from '@ethersproject/contracts';
import { ExchangePrices, PoolPrices, Token } from '../../types';

jest.setTimeout(50 * 1000);

const network = Network.MAINNET;
const vaultAddress = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';
const tokens = Tokens[Network.MAINNET];
const holders = Holders[Network.MAINNET];
let vaultContract: Contract;
let balancer: BalancerV2;
let blocknumber: number;

// getPricesVolume with option to remove specified tokens from limit param
async function getPrices(
  balancer: BalancerV2,
  blocknumber: number,
  from: Token,
  to: Token,
  amounts: bigint[],
  poolsToRemove?: string[],
): Promise<null | ExchangePrices<BalancerV2Data>> {
  const pools = await balancer.getPoolIdentifiers(
    from,
    to,
    SwapSide.SELL,
    blocknumber,
  );

  const allowedPools = poolsToRemove
    ? pools.filter(pool => {
        return !poolsToRemove.includes(pool);
      })
    : pools;

  const prices = await balancer.getPricesVolume(
    from,
    to,
    amounts,
    SwapSide.SELL,
    blocknumber,
    allowedPools,
  );
  return prices;
}

// Compare calculated price to queryBatchSwap call using swaps created in params
async function compareOnChain(
  p: PoolPrices<any>,
  amount: BigInt,
  fromAddr: string,
  toAddr: string,
  holder: string,
  swapType: SwapTypes,
) {
  // Get balancers params
  const data: OptimizedBalancerV2Data = {
    swaps: [
      {
        poolId: p.data.poolId,
        amount: amount.toString(),
      },
    ],
  };
  // [swapType, swaps[], assets, funds, limits[], timeout]
  const param = balancer.getBalancerParam(
    fromAddr,
    toAddr,
    '', // These aren't used
    '',
    data,
    swapType === SwapTypes.SwapExactIn ? SwapSide.SELL : SwapSide.BUY,
  );
  const funds = {
    sender: holder,
    recipient: holder,
    fromInternalBalance: false,
    toInternalBalance: false,
  };
  // console.log(param[1]);
  // console.log(param[2]);
  // query result onchain
  const deltas = await vaultContract.callStatic.queryBatchSwap(
    swapType,
    param[1], // swaps
    param[2], // assets
    funds,
  );
  console.log(`Amount in: ${amount.toString()}`);
  console.log(`Prices: ${p.prices.toString()}`);
  console.log(`Query result deltas: ${deltas.toString()}`);
  expect(deltas[0].toString()).toEqual(amount.toString());
  expect(deltas[1].toString()).toEqual((p.prices[1] * BigInt(-1)).toString());
}

describe('Debug', () => {
  beforeAll(async () => {
    const provider = new JsonRpcProvider(ProviderURL[network]);
    vaultContract = new Contract(vaultAddress, VaultABI, provider);
    const dexHelper = new DummyDexHelper(Network.MAINNET);
    blocknumber = await dexHelper.provider.getBlockNumber();
    balancer = new BalancerV2(Network.MAINNET, 'BalancerV2', dexHelper);
    await balancer.setupEventPools(blocknumber);
  });

  describe('test pricing vs onchain', () => {
    describe('calculated prices should match queryBatchSwap delta', () => {
      it('AMON>USDC', async () => {
        const swapType = SwapTypes.SwapExactIn;
        const from = tokens['AMON'];
        const to = tokens['USDC'];
        const holder = holders['AMON'];
        const amount = BigInt('5000000000000000000000');

        // fetch calculated prices to compare
        const prices = await getPrices(balancer, blocknumber, from, to, [
          BigInt('0'),
          amount,
        ]);
        expect(prices).not.toBeNull();
        if (!prices) return;
        for (let p of prices)
          await compareOnChain(
            p,
            amount,
            from.address,
            to.address,
            holder,
            swapType,
          );
      });
    });
  });
});
