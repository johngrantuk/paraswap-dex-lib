import { Interface } from "@ethersproject/abi";
import { SwapSide } from "..";
import { AdapterExchangeParam, Address, NumberAsString, SimpleExchangeParam } from "../types";
import { IDex } from "./idex";
import { SimpleExchange } from "./simple-exchange";
import CurveABI from '../abi/Curve.json';
import { BUY_NOT_SUPPORTED_ERRROR } from "../constants";

type CurveData = {
  exchange: string;
  i: string;
  j: string;
  deadline: string;
  underlyingSwap: boolean;
  v3: boolean;
};

type SellCurveParam = [
  i: NumberAsString,
  j: NumberAsString,
  dx: NumberAsString,
  min_dy: NumberAsString
];

type CurveParam = SellCurveParam;

enum CurveSwapFunctions {
  exchange= 'exchange',
  exchange_underlying = 'exchange_underlying'
}

export class Curve extends SimpleExchange
  implements IDex<CurveData, CurveParam> {
    protected dexKey = [
      'curve', 
      'curve3', 
      'swerve', 
      'acryptos', 
      'beltfi', 
      'ellipsis'
    ];
    exchangeRouterInterface: Interface;
    minConversionRate = '1';

    constructor(augustusAddress: Address){
        super(augustusAddress);
        this.exchangeRouterInterface = new Interface(CurveABI);
    }  

    getAdapterParam(srcToken: string, destToken: string, srcAmount: string, destAmount: string, data: CurveData, side: SwapSide): AdapterExchangeParam {
      if(side !== SwapSide.BUY) throw BUY_NOT_SUPPORTED_ERRROR

      let payload
      
      try {
          const { i, j, deadline, underlyingSwap, v3 } = data;
          payload = this.abiCoder.encodeParameter(
            {
              ParentStruct: {
                i: 'int128',
                j: 'int128',
                deadline: 'uint256',
                underlyingSwap: 'bool',
                v3: 'bool',
              },
            },
            { i, j, deadline, underlyingSwap, v3 },
          );
        } catch (e) {
          console.error('Curve Error', e);
          payload = '0x';
        }

      return {
        targetExchange: data.exchange,
        payload,
        networkFee: '0',
      };
    }

    getSimpleParam(srcToken: string, destToken: string, srcAmount: string, destAmount: string, data: CurveData, side: SwapSide): SimpleExchangeParam {
      if(side !== SwapSide.BUY) throw BUY_NOT_SUPPORTED_ERRROR

      const { exchange, i, j, underlyingSwap } = data;
      const defaultArgs = [i, j, srcAmount, this.minConversionRate];
      const swapMethod = underlyingSwap ? CurveSwapFunctions.exchange_underlying : CurveSwapFunctions.exchange;
      const swapData = this.exchangeRouterInterface.encodeFunctionData(swapMethod, defaultArgs);

      return this.buildSimpleParamWithoutWETHConversion(
        srcToken,
        srcAmount,
        destToken,
        destAmount,
        swapData,
        exchange,
      );
    }
  }