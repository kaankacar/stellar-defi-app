import { NextRequest, NextResponse } from 'next/server';
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

interface UserPosition {
  asset: string;
  supplied: string;
  borrowed: string;
  suppliedValue: number;
  borrowedValue: number;
}

interface UserPositionSummary {
  totalCollateralValue: number;
  totalBorrowedValue: number;
  borrowLimit: number;
  borrowCapacity: number;
  healthFactor: number;
  netAPR: number;
  positions: UserPosition[];
}

// Try to get user positions using direct RPC calls
async function getUserPositionsFromRPC(userAddress: string): Promise<UserPositionSummary | null> {
  const server = new StellarSdk.rpc.Server(RPC_URL);
  const contract = new StellarSdk.Contract(BLEND_POOL_ID);

  try {
    // Build a simulation transaction to call get_positions
    const userScVal = StellarSdk.nativeToScVal(userAddress, { type: 'address' });
    const account = new StellarSdk.Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: StellarSdk.Networks.PUBLIC,
    })
      .addOperation(contract.call('get_positions', userScVal))
      .setTimeout(30)
      .build();

    const response = await server.simulateTransaction(tx);

    if ('result' in response && response.result && response.result.retval) {
      const positionsData = StellarSdk.scValToNative(response.result.retval);

      // Parse positions data
      if (positionsData && typeof positionsData === 'object') {
        const positions: UserPosition[] = [];
        let totalSupplied = 0;
        let totalBorrowed = 0;

        // Process collateral positions
        const collateral = positionsData.collateral || positionsData.supply || [];
        const liabilities = positionsData.liabilities || positionsData.borrow || [];

        // Map reserve indices to asset addresses (simplified - would need full reserve list)
        for (let i = 0; i < collateral.length; i++) {
          const amount = Number(collateral[i] || 0n) / 1e7;
          if (amount > 0) {
            const assetEntries = Object.entries(KNOWN_ASSETS);
            const asset = assetEntries[i % assetEntries.length];
            positions.push({
              asset: asset?.[1]?.name || `Asset ${i}`,
              supplied: amount.toFixed(4),
              borrowed: '0',
              suppliedValue: amount, // Would need oracle price
              borrowedValue: 0,
            });
            totalSupplied += amount;
          }
        }

        for (let i = 0; i < liabilities.length; i++) {
          const amount = Number(liabilities[i] || 0n) / 1e7;
          if (amount > 0) {
            const assetEntries = Object.entries(KNOWN_ASSETS);
            const asset = assetEntries[i % assetEntries.length];
            const existing = positions.find(p => p.asset === asset?.[1]?.name);
            if (existing) {
              existing.borrowed = amount.toFixed(4);
              existing.borrowedValue = amount;
            } else {
              positions.push({
                asset: asset?.[1]?.name || `Asset ${i}`,
                supplied: '0',
                borrowed: amount.toFixed(4),
                suppliedValue: 0,
                borrowedValue: amount,
              });
            }
            totalBorrowed += amount;
          }
        }

        if (positions.length === 0) {
          return null; // No positions
        }

        return {
          totalCollateralValue: totalSupplied,
          totalBorrowedValue: totalBorrowed,
          borrowLimit: totalSupplied * 0.75, // Estimated
          borrowCapacity: totalSupplied * 0.75 - totalBorrowed,
          healthFactor: totalBorrowed > 0 ? totalSupplied / totalBorrowed : Infinity,
          netAPR: 0, // Would need to calculate based on rates
          positions,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to fetch user positions via RPC:', err);
  }

  return null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userAddress = searchParams.get('address');

  if (!userAddress) {
    return NextResponse.json({ error: 'Address parameter required' }, { status: 400 });
  }

  // Validate address format
  if (!userAddress.startsWith('G') || userAddress.length !== 56) {
    return NextResponse.json({ error: 'Invalid Stellar address format' }, { status: 400 });
  }

  try {
    // Try RPC-based position fetching
    const positions = await getUserPositionsFromRPC(userAddress);

    if (positions) {
      return NextResponse.json({
        positions,
        source: 'rpc',
      });
    }

    // No positions found or unable to fetch
    return NextResponse.json({
      positions: null,
      note: 'No positions found or position data unavailable',
    });
  } catch (error) {
    console.error('Failed to load user positions:', error);
    return NextResponse.json({
      positions: null,
      error: 'Unable to fetch positions',
      details: String(error),
    });
  }
}
