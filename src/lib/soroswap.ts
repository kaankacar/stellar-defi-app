// Known token addresses on mainnet
export const MAINNET_TOKENS = {
  XLM: 'native',
  USDC: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',   // Circle USDC SAC
  EURC: 'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV',   // Circle EURC SAC
  yUSDC: 'CDOFW7HNKLUZRLFZST4EW7V3AV4JI5IHMT6BPXXSY2IEFZ4NE5TWU2P4', // yUSDC by Ultra Capital
  AQUA: 'CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK',   // AQUA SAC (aqua.network)
  BTC: 'CAO7DDJNGMOYQPRYDY5JVZ5YEK4UQBSMGLAEWRCUOTRMDSBMGWSAATDZ',    // BTC by Ultra Capital
} as const;

export interface SwapQuote {
  amountIn: string;
  amountOut: string;
  priceImpactPct: string;
  route: string[];
  protocols: string[];
  rawData?: unknown; // Raw API response preserved for building transactions
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

// Get a quote for swapping tokens via the Soroswap aggregator API
export async function getSwapQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  slippageBps: number = 50
): Promise<SwapQuote> {
  try {
    const response = await fetch('https://api.soroswap.finance/quote?network=mainnet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assetIn: tokenIn,
        assetOut: tokenOut,
        amount: amountIn,
        tradeType: 'EXACT_IN',
        protocols: ['soroswap', 'phoenix', 'aqua', 'sdex'],
        slippageBps,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error((errorData as { error?: string }).error || `API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      amountIn: data.amountIn || amountIn,
      amountOut: data.amountOut || '0',
      priceImpactPct: data.priceImpact || data.priceImpactPct || '0',
      route: data.routePlan?.flatMap((plan: { swapInfo: { path: string[] } }) => plan.swapInfo.path) || [],
      protocols: data.routePlan?.map((plan: { swapInfo: { protocol: string } }) => plan.swapInfo.protocol) || [],
      rawData: data,
    };
  } catch (error) {
    console.error('Failed to get swap quote:', error);
    throw error;
  }
}

// Build a swap transaction via the Soroswap aggregator API
// Returns an unsigned XDR string ready for wallet signing
export async function buildSwapTransaction(
  quote: SwapQuote,
  fromAddress: string
): Promise<string> {
  try {
    const response = await fetch('https://api.soroswap.finance/quote/build?network=mainnet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quote: quote.rawData,
        from: fromAddress,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error((errorData as { error?: string }).error || `API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.xdr) {
      throw new Error('No XDR returned from build endpoint');
    }

    return data.xdr;
  } catch (error) {
    console.error('Failed to build swap transaction:', error);
    throw error;
  }
}

// Format amount with decimals
export function formatAmount(amount: bigint | string, decimals: number = 7): string {
  const amountBigInt = typeof amount === 'string' ? BigInt(amount) : amount;
  const divisor = BigInt(10 ** decimals);
  const whole = amountBigInt / divisor;
  const fraction = amountBigInt % divisor;
  const fractionStr = fraction.toString().padStart(decimals, '0');
  return `${whole}.${fractionStr}`.replace(/\.?0+$/, '') || '0';
}

// Parse amount string to bigint with decimals
export function parseAmount(amount: string, decimals: number = 7): bigint {
  const [whole, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedFraction);
}
