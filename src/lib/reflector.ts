import * as StellarSdk from '@stellar/stellar-sdk';
import { rpc, config } from './stellar';

const REFLECTOR = 'CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN';
const PRICE_DECIMALS = 14;
// Any funded mainnet account works as simulation source (never charged)
const SIM_SOURCE = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

export async function getTokenPrices(): Promise<Record<string, number>> {
  const xlmPrice = await queryLastPrice('XLM');
  return {
    XLM:   xlmPrice ?? 0,
    USDC:  1.0,
    EURC:  1.0,
    yUSDC: 1.0,
  };
}

async function queryLastPrice(symbol: string): Promise<number | null> {
  try {
    const account = await rpc.getAccount(SIM_SOURCE);
    const contract = new StellarSdk.Contract(REFLECTOR);

    // Build Asset::Other ScVal: ScVec([Symbol("Other"), Symbol(symbol)])
    const assetScVal = StellarSdk.xdr.ScVal.scvVec([
      StellarSdk.xdr.ScVal.scvSymbol('Other'),
      StellarSdk.xdr.ScVal.scvSymbol(symbol),
    ]);

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(contract.call('lastprice', assetScVal))
      .setTimeout(30)
      .build();

    const sim = await rpc.simulateTransaction(tx);

    if (StellarSdk.rpc.Api.isSimulationError(sim)) {
      console.warn(`Reflector simulation error for ${symbol}:`, sim.error);
      return null;
    }

    if (!sim.result?.retval) {
      return null;
    }

    const native = StellarSdk.scValToNative(sim.result.retval);
    if (!native || native.price === undefined) {
      return null;
    }

    return Number(native.price) / 10 ** PRICE_DECIMALS;
  } catch (err) {
    console.warn(`Failed to query Reflector price for ${symbol}:`, err);
    return null;
  }
}
