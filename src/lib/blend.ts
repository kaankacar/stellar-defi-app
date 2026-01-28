import * as StellarSdk from '@stellar/stellar-sdk';
import { config, rpc } from './stellar';

// Blend Protocol mainnet pool addresses
export const BLEND_POOLS = {
  stellar: 'CDVQVKOY2YSXS2IC7KN6MNASSHPAO7UN2UR2ON4OI2SKMFJNVAMDX6DP',
} as const;

// Known asset addresses on mainnet
export const BLEND_ASSETS = {
  USDC: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
  XLM: 'native',
  yUSDC: 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YBVMCMTYF3DQLVVQ6M5P7',
} as const;

export interface MarketData {
  asset: string;
  assetAddress: string;
  supplyAPY: number;
  borrowAPY: number;
  totalSupply: string;
  totalBorrow: string;
  utilization: number;
  collateralFactor: number;
}

export interface UserPosition {
  asset: string;
  supplied: string;
  borrowed: string;
  suppliedValue: number;
  borrowedValue: number;
}

export interface UserPositionSummary {
  totalCollateralValue: number;
  totalBorrowedValue: number;
  borrowLimit: number;
  borrowCapacity: number;
  healthFactor: number;
  netAPR: number;
  positions: UserPosition[];
}

// Known asset addresses for market generation
const KNOWN_ASSETS = [
  { asset: 'USDC', address: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75', share: 0.45, collateralFactor: 85 },
  { asset: 'yUSDC', address: 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YBVMCMTYF3DQLVVQ6M5P7', share: 0.20, collateralFactor: 85 },
  { asset: 'EURC', address: 'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV', share: 0.15, collateralFactor: 85 },
  { asset: 'ETH', address: 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA', share: 0.10, collateralFactor: 75 },
  { asset: 'BTC', address: 'CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4', share: 0.10, collateralFactor: 75 },
];

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  }
  return num.toFixed(2);
}

// Generate markets from DefiLlama TVL data
function generateMarketsFromTVL(tvl: number, borrowed: number): MarketData[] {
  return KNOWN_ASSETS.map(({ asset, address, share, collateralFactor }) => {
    const supply = tvl * share;
    const borrow = borrowed * share;
    const utilization = supply > 0 ? (borrow / supply) * 100 : 0;

    // Estimated APYs based on typical DeFi rates and utilization
    const baseRate = 2;
    const utilizationRate = utilization * 0.1;
    const borrowAPY = baseRate + utilizationRate;
    const supplyAPY = borrowAPY * (utilization / 100) * 0.9;

    return {
      asset,
      assetAddress: address,
      supplyAPY: Math.max(0.5, supplyAPY),
      borrowAPY: Math.max(1, borrowAPY),
      totalSupply: `$${formatNumber(supply)}`,
      totalBorrow: `$${formatNumber(borrow)}`,
      utilization,
      collateralFactor,
    };
  });
}

// Load pool data - tries API route first, falls back to direct DefiLlama call
export async function getPoolData(): Promise<MarketData[]> {
  // Try API route first (works in dev/Vercel)
  try {
    const response = await fetch('/api/blend/markets');
    if (response.ok) {
      const data = await response.json();
      return data.markets;
    }
  } catch {
    // API route not available (static export), fall through to direct call
  }

  // Direct DefiLlama call (works in static export)
  try {
    const response = await fetch('https://api.llama.fi/protocol/blend');
    if (response.ok) {
      const data = await response.json();
      const tvl = data.currentChainTvls?.Stellar || 0;
      const borrowed = data.currentChainTvls?.['Stellar-borrowed'] || 0;
      return generateMarketsFromTVL(tvl, borrowed);
    }
  } catch (error) {
    console.error('Failed to fetch from DefiLlama:', error);
  }

  // Return empty array if all fails
  console.warn('Unable to load market data');
  return [];
}

// Get user positions - simplified for static export
export async function getUserPositions(userAddress: string): Promise<UserPositionSummary | null> {
  // Try API route first
  try {
    const response = await fetch(`/api/blend/positions?address=${userAddress}`);
    if (response.ok) {
      const data = await response.json();
      return data.positions;
    }
  } catch {
    // API route not available
  }

  // For static export, we can't fetch user positions due to CORS
  // Return null to indicate no positions loaded
  return null;
}

// Build a Blend pool request
function buildPoolRequest(
  requestType: number,
  assetAddress: string,
  amount: bigint
): StellarSdk.xdr.ScVal {
  return StellarSdk.xdr.ScVal.scvMap([
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.xdr.ScVal.scvSymbol('address'),
      val: StellarSdk.Address.fromString(assetAddress).toScVal(),
    }),
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.xdr.ScVal.scvSymbol('amount'),
      val: StellarSdk.nativeToScVal(amount, { type: 'i128' }),
    }),
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.xdr.ScVal.scvSymbol('request_type'),
      val: StellarSdk.xdr.ScVal.scvU32(requestType),
    }),
  ]);
}

// Build supply transaction
export async function buildSupplyTransaction(
  userAddress: string,
  assetAddress: string,
  amount: bigint,
  poolId: string = BLEND_POOLS.stellar
): Promise<string> {
  const contract = new StellarSdk.Contract(poolId);

  // RequestType.SupplyCollateral = 0
  const request = buildPoolRequest(0, assetAddress, amount);

  const submitOp = contract.call(
    'submit',
    StellarSdk.Address.fromString(userAddress).toScVal(),
    StellarSdk.Address.fromString(userAddress).toScVal(),
    StellarSdk.Address.fromString(userAddress).toScVal(),
    StellarSdk.xdr.ScVal.scvVec([request])
  );

  const account = await rpc.getAccount(userAddress);
  let tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(submitOp)
    .setTimeout(300)
    .build();

  // Simulate and prepare
  const simulation = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation failed: ${simulation.error}`);
  }

  tx = StellarSdk.rpc.assembleTransaction(tx, simulation).build();
  return tx.toXDR();
}

// Build borrow transaction
export async function buildBorrowTransaction(
  userAddress: string,
  assetAddress: string,
  amount: bigint,
  poolId: string = BLEND_POOLS.stellar
): Promise<string> {
  const contract = new StellarSdk.Contract(poolId);

  // RequestType.Borrow = 4
  const request = buildPoolRequest(4, assetAddress, amount);

  const borrowOp = contract.call(
    'submit',
    StellarSdk.Address.fromString(userAddress).toScVal(),
    StellarSdk.Address.fromString(userAddress).toScVal(),
    StellarSdk.Address.fromString(userAddress).toScVal(),
    StellarSdk.xdr.ScVal.scvVec([request])
  );

  const account = await rpc.getAccount(userAddress);
  let tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(borrowOp)
    .setTimeout(300)
    .build();

  const simulation = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation failed: ${simulation.error}`);
  }

  tx = StellarSdk.rpc.assembleTransaction(tx, simulation).build();
  return tx.toXDR();
}

// Build withdraw transaction
export async function buildWithdrawTransaction(
  userAddress: string,
  assetAddress: string,
  amount: bigint,
  poolId: string = BLEND_POOLS.stellar
): Promise<string> {
  const contract = new StellarSdk.Contract(poolId);

  // RequestType.WithdrawCollateral = 1
  const request = buildPoolRequest(1, assetAddress, amount);

  const withdrawOp = contract.call(
    'submit',
    StellarSdk.Address.fromString(userAddress).toScVal(),
    StellarSdk.Address.fromString(userAddress).toScVal(),
    StellarSdk.Address.fromString(userAddress).toScVal(),
    StellarSdk.xdr.ScVal.scvVec([request])
  );

  const account = await rpc.getAccount(userAddress);
  let tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(withdrawOp)
    .setTimeout(300)
    .build();

  const simulation = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation failed: ${simulation.error}`);
  }

  tx = StellarSdk.rpc.assembleTransaction(tx, simulation).build();
  return tx.toXDR();
}

// Build repay transaction
export async function buildRepayTransaction(
  userAddress: string,
  assetAddress: string,
  amount: bigint,
  poolId: string = BLEND_POOLS.stellar
): Promise<string> {
  const contract = new StellarSdk.Contract(poolId);

  // RequestType.Repay = 5
  const request = buildPoolRequest(5, assetAddress, amount);

  const repayOp = contract.call(
    'submit',
    StellarSdk.Address.fromString(userAddress).toScVal(),
    StellarSdk.Address.fromString(userAddress).toScVal(),
    StellarSdk.Address.fromString(userAddress).toScVal(),
    StellarSdk.xdr.ScVal.scvVec([request])
  );

  const account = await rpc.getAccount(userAddress);
  let tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(repayOp)
    .setTimeout(300)
    .build();

  const simulation = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation failed: ${simulation.error}`);
  }

  tx = StellarSdk.rpc.assembleTransaction(tx, simulation).build();
  return tx.toXDR();
}

// Submit signed transaction
export async function submitBlendTransaction(signedXdr: string): Promise<{ hash: string }> {
  const tx = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    config.networkPassphrase
  ) as StellarSdk.Transaction;

  const response = await rpc.sendTransaction(tx);

  if (response.status === 'ERROR') {
    throw new Error(`Transaction failed: ${response.errorResult}`);
  }

  // Poll for result
  let getResponse = await rpc.getTransaction(response.hash);
  while (getResponse.status === 'NOT_FOUND') {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    getResponse = await rpc.getTransaction(response.hash);
  }

  if (getResponse.status === 'SUCCESS') {
    return { hash: response.hash };
  }

  throw new Error(`Transaction failed: ${getResponse.status}`);
}

// Format amount helpers
export function formatAmount(amount: bigint, decimals: number = 7): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  const fractionStr = fraction.toString().padStart(decimals, '0');
  return `${whole}.${fractionStr}`.replace(/\.?0+$/, '');
}

export function parseAmount(amount: string, decimals: number = 7): bigint {
  const [whole, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedFraction);
}
