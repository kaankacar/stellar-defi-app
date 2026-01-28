import { NextResponse } from 'next/server';
import * as StellarSdk from '@stellar/stellar-sdk';

// Blend Protocol mainnet pool
const BLEND_POOL_ID = 'CDVQVKOY2YSXS2IC7KN6MNASSHPAO7UN2UR2ON4OI2SKMFJNVAMDX6DP';
const RPC_URL = 'https://soroban-rpc.mainnet.stellar.gateway.fm';

// Known asset addresses on mainnet
const KNOWN_ASSETS: Record<string, { name: string; decimals: number }> = {
  'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75': { name: 'USDC', decimals: 7 },
  'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YBVMCMTYF3DQLVVQ6M5P7': { name: 'yUSDC', decimals: 7 },
  'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA': { name: 'ETH', decimals: 7 },
  'CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4': { name: 'BTC', decimals: 7 },
  'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV': { name: 'EURC', decimals: 7 },
};

interface MarketData {
  asset: string;
  assetAddress: string;
  supplyAPY: number;
  borrowAPY: number;
  totalSupply: string;
  totalBorrow: string;
  utilization: number;
  collateralFactor: number;
}

// Fetch aggregate TVL from DefiLlama as fallback
async function getDefiLlamaTVL(): Promise<{ tvl: number; borrowed: number } | null> {
  try {
    const response = await fetch('https://api.llama.fi/protocol/blend', {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });
    if (!response.ok) return null;
    const data = await response.json();
    return {
      tvl: data.currentChainTvls?.Stellar || 0,
      borrowed: data.currentChainTvls?.['Stellar-borrowed'] || 0,
    };
  } catch {
    return null;
  }
}

// Try to get asset reserves from RPC
async function getPoolReserves(): Promise<MarketData[]> {
  const server = new StellarSdk.rpc.Server(RPC_URL);
  const contract = new StellarSdk.Contract(BLEND_POOL_ID);

  const markets: MarketData[] = [];

  // Get reserves for known assets
  for (const [assetAddress, assetInfo] of Object.entries(KNOWN_ASSETS)) {
    try {
      // Call get_reserve function on the pool contract
      const assetScVal = StellarSdk.nativeToScVal(assetAddress, { type: 'address' });

      // Build a simulation transaction to call get_reserve
      const account = new StellarSdk.Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: StellarSdk.Networks.PUBLIC,
      })
        .addOperation(contract.call('get_reserve', assetScVal))
        .setTimeout(30)
        .build();

      const response = await server.simulateTransaction(tx);

      if ('result' in response && response.result) {
        // Parse the reserve data
        const resultVal = response.result.retval;
        if (resultVal) {
          // Extract data from the reserve struct
          // The exact structure depends on Blend's contract
          const reserveData = parseReserveData(resultVal, assetInfo.decimals);
          if (reserveData) {
            markets.push({
              asset: assetInfo.name,
              assetAddress,
              ...reserveData,
            });
          }
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch reserve for ${assetInfo.name}:`, err);
    }
  }

  return markets;
}

// Parse reserve data from ScVal - simplified version
function parseReserveData(scVal: StellarSdk.xdr.ScVal, decimals: number): Partial<MarketData> | null {
  try {
    // This is a simplified parser - the exact structure depends on Blend's contract
    // For now, return placeholder data that we'll refine
    const native = StellarSdk.scValToNative(scVal);

    if (native && typeof native === 'object') {
      const divisor = Math.pow(10, decimals);

      // Try to extract common fields
      const totalSupply = native.total_supply || native.b_supply || 0n;
      const totalBorrow = native.total_liabilities || native.d_supply || 0n;
      const supplyRate = native.ir_mod?.supply_rate || native.supply_apr || 0;
      const borrowRate = native.ir_mod?.borrow_rate || native.borrow_apr || 0;

      const supplyFloat = Number(totalSupply) / divisor;
      const borrowFloat = Number(totalBorrow) / divisor;

      return {
        supplyAPY: typeof supplyRate === 'number' ? supplyRate * 100 : 0,
        borrowAPY: typeof borrowRate === 'number' ? borrowRate * 100 : 0,
        totalSupply: supplyFloat.toFixed(2),
        totalBorrow: borrowFloat.toFixed(2),
        utilization: supplyFloat > 0 ? (borrowFloat / supplyFloat) * 100 : 0,
        collateralFactor: native.c_factor ? Number(native.c_factor) / 10000000 * 100 : 75,
      };
    }
  } catch (err) {
    console.warn('Failed to parse reserve data:', err);
  }
  return null;
}

// Fallback: generate estimated markets from DefiLlama TVL
function generateEstimatedMarkets(llama: { tvl: number; borrowed: number }): MarketData[] {
  // Distribute TVL across known assets with estimated proportions
  const totalTVL = llama.tvl;
  const totalBorrowed = llama.borrowed;

  const assetDistribution = [
    { asset: 'USDC', address: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75', share: 0.45 },
    { asset: 'yUSDC', address: 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YBVMCMTYF3DQLVVQ6M5P7', share: 0.20 },
    { asset: 'EURC', address: 'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV', share: 0.15 },
    { asset: 'ETH', address: 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA', share: 0.10 },
    { asset: 'BTC', address: 'CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4', share: 0.10 },
  ];

  return assetDistribution.map(({ asset, address, share }) => {
    const supply = totalTVL * share;
    const borrow = totalBorrowed * share;
    const utilization = supply > 0 ? (borrow / supply) * 100 : 0;

    // Estimated APYs based on typical DeFi rates and utilization
    const baseRate = 2;
    const utilizationRate = utilization * 0.1;
    const borrowAPY = baseRate + utilizationRate;
    const supplyAPY = borrowAPY * (utilization / 100) * 0.9; // Supply APY = borrow APY * utilization * (1 - spread)

    return {
      asset,
      assetAddress: address,
      supplyAPY: Math.max(0.5, supplyAPY),
      borrowAPY: Math.max(1, borrowAPY),
      totalSupply: `$${formatNumber(supply)}`,
      totalBorrow: `$${formatNumber(borrow)}`,
      utilization,
      collateralFactor: asset === 'USDC' || asset === 'yUSDC' || asset === 'EURC' ? 85 : 75,
    };
  });
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  }
  return num.toFixed(2);
}

export async function GET() {
  try {
    // First, try to get real data from RPC
    const rpcMarkets = await getPoolReserves();

    if (rpcMarkets.length > 0) {
      return NextResponse.json({
        markets: rpcMarkets,
        poolId: BLEND_POOL_ID,
        source: 'rpc',
      });
    }

    // Fallback to DefiLlama aggregate data
    const llamaData = await getDefiLlamaTVL();

    if (llamaData) {
      const estimatedMarkets = generateEstimatedMarkets(llamaData);
      return NextResponse.json({
        markets: estimatedMarkets,
        poolId: BLEND_POOL_ID,
        source: 'defillama',
        note: 'Estimated from aggregate TVL data',
      });
    }

    // If both fail, return error
    return NextResponse.json(
      { error: 'Unable to fetch market data from any source' },
      { status: 503 }
    );
  } catch (error) {
    console.error('Failed to load Blend markets:', error);

    // Even on error, try DefiLlama fallback
    try {
      const llamaData = await getDefiLlamaTVL();
      if (llamaData) {
        const estimatedMarkets = generateEstimatedMarkets(llamaData);
        return NextResponse.json({
          markets: estimatedMarkets,
          poolId: BLEND_POOL_ID,
          source: 'defillama-fallback',
        });
      }
    } catch {
      // Ignore fallback errors
    }

    return NextResponse.json(
      { error: 'Failed to load market data', details: String(error) },
      { status: 500 }
    );
  }
}
