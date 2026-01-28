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

// Load pool data via API route (server-side to avoid CORS)
export async function getPoolData(): Promise<MarketData[]> {
  try {
    const response = await fetch('/api/blend/markets');
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data.markets;
  } catch (error) {
    console.error('Failed to load pool data:', error);
    throw error;
  }
}

// Get user positions via API route (server-side to avoid CORS)
export async function getUserPositions(userAddress: string): Promise<UserPositionSummary | null> {
  try {
    const response = await fetch(`/api/blend/positions?address=${userAddress}`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data.positions;
  } catch (error) {
    console.error('Failed to load user positions:', error);
    return null;
  }
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
