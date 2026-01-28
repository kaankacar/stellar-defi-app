// Known token addresses on mainnet
export const MAINNET_TOKENS = {
  XLM: 'native',
  USDC: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
  EURC: 'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV',
  yUSDC: 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YBVMCMTYF3DQLVVQ6M5P7',
  AQUA: 'GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA',
  BTC: 'CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4',
} as const;

export interface SwapQuote {
  amountIn: string;
  amountOut: string;
  priceImpactPct: string;
  route: string[];
  protocols: string[];
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

// Get a quote for swapping tokens via our API route
export async function getSwapQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  slippageBps: number = 50
): Promise<SwapQuote> {
  try {
    const response = await fetch('/api/soroswap/quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokenIn,
        tokenOut,
        amount: amountIn,
        slippageBps,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      amountIn: data.amountIn || amountIn,
      amountOut: data.amountOut || '0',
      priceImpactPct: data.priceImpactPct || '0',
      route: data.routePlan?.flatMap((plan: { swapInfo: { path: string[] } }) => plan.swapInfo.path) || [],
      protocols: data.routePlan?.map((plan: { swapInfo: { protocol: string } }) => plan.swapInfo.protocol) || [],
    };
  } catch (error) {
    console.error('Failed to get swap quote:', error);
    throw error;
  }
}

// Build a swap transaction (calls our API to build tx server-side)
export async function buildSwapTransaction(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  fromAddress: string,
  slippageBps: number = 50
): Promise<{ xdr: string; quote: SwapQuote }> {
  try {
    const response = await fetch('/api/soroswap/build', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokenIn,
        tokenOut,
        amount: amountIn,
        fromAddress,
        slippageBps,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      xdr: data.xdr,
      quote: {
        amountIn: data.quote?.amountIn || amountIn,
        amountOut: data.quote?.amountOut || '0',
        priceImpactPct: data.quote?.priceImpactPct || '0',
        route: data.quote?.routePlan?.flatMap((plan: { swapInfo: { path: string[] } }) => plan.swapInfo.path) || [],
        protocols: data.quote?.routePlan?.map((plan: { swapInfo: { protocol: string } }) => plan.swapInfo.protocol) || [],
      },
    };
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
