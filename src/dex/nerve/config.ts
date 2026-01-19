import { SwapSide } from '@paraswap/core';
import { DexParams } from './types';
import { AdapterMappings, DexConfigMap } from '../../types';
import { Network } from '../../constants';
import nervePoolABI from '../../abi/nerve/nerve-pool.json';
import axialPoolABI from '../../abi/nerve/axial-pool.json';
import ironV2PoolABI from '../../abi/nerve/iron-v2-pool.json';

export const threePoolName = 'ThreePool';

// The order of the coins must be places with the same indexes as in contracts
export const NerveConfig: DexConfigMap<DexParams> = {
  Nerve: {
    [Network.BSC]: {
      poolConfigs: {
        [threePoolName]: {
          name: threePoolName,
          address: '0x1B3771a66ee31180906972580adE9b81AFc5fCDc',
          coins: [
            {
              address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // 0 - BUSD
              decimals: 18,
            },
            {
              address: '0x55d398326f99059fF775485246999027B3197955', // 1 - USDT
              decimals: 18,
            },
            {
              address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // 2 - USDC
              decimals: 18,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0xf2511b5E4FB0e5E2d123004b672BA14850478C14',
            decimals: 18,
          },
        },
        BTC: {
          name: 'BTC',
          address: '0x6C341938bB75dDe823FAAfe7f446925c66E6270c',
          coins: [
            {
              address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', // 0 - bBTC
              decimals: 18,
            },
            {
              address: '0x54261774905f3e6E9718f2ABb10ed6555cae308a', // 1 - anyBTC
              decimals: 8,
            },
          ],
          isMetapool: false,
          isUSDPool: false,
          lpToken: {
            address: '0xD1D5Af92C606C6F2eC59D453f57A6FCc188D7dB5',
            decimals: 18,
          },
        },
        ETH: {
          name: 'ETH',
          address: '0x146CD24dCc9f4EB224DFd010c5Bf2b0D25aFA9C0',
          coins: [
            {
              address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', // 0 - bETH
              decimals: 18,
            },
            {
              address: '0x6F817a0cE8F7640Add3bC0c1C2298635043c2423', // 1 - anyETH
              decimals: 18,
            },
          ],
          isMetapool: false,
          isUSDPool: false,
          lpToken: {
            address: '0x0d283BF16A9bdE49cfC48d8dc050AF28b71bdD90',
            decimals: 18,
          },
        },
        // fUSDT: {
        //   name: 'fUSDT',
        //   address: '0xd0fBF0A224563D5fFc8A57e4fdA6Ae080EbCf3D3',
        //   coins: [
        //     '0x049d68029688eAbF473097a2fC38ef61633A3C7A', // 0 - fUSDT
        //     '0xf2511b5E4FB0e5E2d123004b672BA14850478C14', // 1 - 3Pool-LP
        //   ],
        //   isMetapool: true,
        //   lpTokenAddress: '0x2e91A0CECf28c5E518bB2E7fdcd9F8e2cd511c10',
        // },
        // UST: {
        //   name: 'UST',
        //   address: '0x2dcCe1586b1664f41C72206900e404Ec3cA130e0',
        //   coins: [
        //     '0x23396cF899Ca06c4472205fC903bDB4de249D6fC', // 0 - wUST
        //     '0xf2511b5E4FB0e5E2d123004b672BA14850478C14', // 1 - 3Pool-LP
        //   ],
        //   isMetapool: true,
        //   lpTokenAddress: '0x35Ce243e0DC9eD77e3C348Bb2742095F78e1Cb70',
        // },
        // rUSD: {
        //   name: 'rUSD',
        //   address: '0x0eafaa7ed9866c1f08ac21dd0ef3395e910f7114',
        //   coins: [
        //     '0x07663837218A003e66310a01596af4bf4e44623D', // 0 - rUSD
        //     '0xf2511b5E4FB0e5E2d123004b672BA14850478C14', // 1 - 3Pool-LP
        //   ],
        //   isMetapool: true,
        //   lpTokenAddress: '0x870ee4d19c12A789c61de69E3E5eFb42383E4434',
        // },
      },
      abi: nervePoolABI,
    },
  },
  IronV2: {
    [Network.POLYGON]: {
      poolConfigs: {
        IS3USD_POLYGON: {
          name: 'IS3USD_POLYGON',
          address: '0x837503e8A8753ae17fB8C8151B8e6f586defCb57',
          coins: [
            {
              address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // 0 - USDC
              decimals: 6,
            },
            {
              address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // 1 - USDT
              decimals: 6,
            },
            {
              address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', // 2 - DAI
              decimals: 18,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0xb4d09ff3dA7f9e9A2BA029cb0A81A989fd7B8f17',
            decimals: 18,
          },
        },
      },
      abi: ironV2PoolABI,
    },
  },
  Synapse: {
    [Network.MAINNET]: {
      poolConfigs: {
        stableSwapPool: {
          name: 'stableSwapPool',
          address: '0x1116898dda4015ed8ddefb84b6e8bc24528af2d8',
          coins: [
            {
              address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // 0 - DAI
              decimals: 18,
            },
            {
              address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // 1 - USDC
              decimals: 6,
            },
            {
              address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // 2 - USDT
              decimals: 6,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0x1B84765dE8B7566e4cEAF4D0fD3c5aF52D3DdE4F',
            decimals: 18,
          },
        },
      },
      abi: axialPoolABI,
    },
    [Network.BSC]: {
      poolConfigs: {
        USDPool: {
          name: 'USDPool',
          address: '0x938afafb36e8b1ab3347427eb44537f543475cf9',
          coins: [
            {
              address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // 0 - BUSD
              decimals: 18,
            },
            {
              address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // 1 - USDC
              decimals: 18,
            },
            {
              address: '0x55d398326f99059fF775485246999027B3197955', // 2 - BSC-USD
              decimals: 18,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0xF0b8B631145d393a767b4387d08Aa09969b2dFed',
            decimals: 18,
          },
        },
        nUSDPoolV2: {
          name: 'nUSDPoolV2',
          address: '0x28ec0B36F0819ecB5005cAB836F4ED5a2eCa4D13',
          coins: [
            {
              address: '0x23b891e5C62E0955ae2bD185990103928Ab817b3', // 0 - nUSD
              decimals: 18,
            },
            {
              address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // 1 - BUSD
              decimals: 18,
            },
            {
              address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // 2 - USDC
              decimals: 18,
            },
            {
              address: '0x55d398326f99059fF775485246999027B3197955', // 3 - BSC-USD
              decimals: 18,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0xa4b7Bc06EC817785170C2DbC1dD3ff86CDcdcc4C',
            decimals: 18,
          },
        },
      },
      abi: axialPoolABI,
    },
    [Network.POLYGON]: {
      poolConfigs: {
        USDPool: {
          name: 'USDPool',
          address: '0x3f52E42783064bEba9C1CFcD2E130D156264ca77',
          coins: [
            {
              address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', // 0 - DAI
              decimals: 18,
            },
            {
              address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // 1 - USDC
              decimals: 6,
            },
            {
              address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // 2 - USDT
              decimals: 6,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0x128A587555d1148766ef4327172129B50EC66E5D',
            decimals: 18,
          },
        },
        nUSDPoolV2: {
          name: 'nUSDPoolV2',
          address: '0x85fCD7Dd0a1e1A9FCD5FD886ED522dE8221C3EE5',
          coins: [
            {
              address: '0xB6c473756050dE474286bED418B77Aeac39B02aF', // 0 - nUSD
              decimals: 18,
            },

            {
              address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', // 1 - DAI
              decimals: 18,
            },
            {
              address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // 2 - USDC
              decimals: 6,
            },
            {
              address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // 3 - USDT
              decimals: 6,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0x7479e1Bc2F2473f9e78c89B4210eb6d55d33b645',
            decimals: 18,
          },
        },
      },
      abi: axialPoolABI,
    },
    [Network.AVALANCHE]: {
      poolConfigs: {
        AaveETHPool: {
          name: 'AaveETHPool',
          address: '0x77a7e60555bC18B4Be44C181b2575eee46212d44',
          coins: [
            {
              address: '0x19E1ae0eE35c0404f835521146206595d37981ae', // 0 - nETH
              decimals: 18,
            },
            {
              address: '0x53f7c5869a859F0AeC3D334ee8B4Cf01E3492f21', // 1 - avWETH
              decimals: 18,
            },
          ],
          isMetapool: false,
          isUSDPool: false,
          lpToken: {
            address: '0x5dF1dB940dd8fEE0e0eB0C8917cb50b4dfaDF98c',
            decimals: 18,
          },
        },
        USDPool: {
          name: 'USDPool',
          address: '0xE55e19Fb4F2D85af758950957714292DAC1e25B2',
          coins: [
            {
              address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70', // 0 - DAI.e
              decimals: 18,
            },
            {
              address: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664', // 1 - USDC.e
              decimals: 6,
            },
            {
              address: '0xc7198437980c041c805A1EDcbA50c1Ce5db95118', // 2 - USDT.e
              decimals: 6,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0x55904F416586b5140A0f666CF5AcF320AdF64846',
            decimals: 18,
          },
        },
        nUSDV2: {
          name: 'nUSDV2',
          address: '0xED2a7edd7413021d440b09D654f3b87712abAB66',
          coins: [
            {
              address: '0xCFc37A6AB183dd4aED08C204D1c2773c0b1BDf46', // 0 - nUSD
              decimals: 18,
            },
            {
              address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70', // 1 - DAI.e
              decimals: 18,
            },
            {
              address: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664', // 2 - USDC.e
              decimals: 6,
            },
            {
              address: '0xc7198437980c041c805A1EDcbA50c1Ce5db95118', // 3 - USDT.e
              decimals: 6,
            },
          ],
          isMetapool: false,
          isUSDPool: true,
          lpToken: {
            address: '0xCA87BF3ec55372D9540437d7a86a7750B42C02f4',
            decimals: 18,
          },
        },
      },
      abi: axialPoolABI,
    },
  },
};

export const NERVE_GAS_COST = 200 * 1000;

export const Adapters: Record<number, AdapterMappings> = {
  [Network.BSC]: {
    [SwapSide.SELL]: [{ name: 'BscAdapter01', index: 4 }],
  },
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [{ name: 'AvalancheAdapter01', index: 3 }],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter01', index: 7 }],
  },
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter02', index: 8 }],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter01', index: 8 }],
  },
};
