import * as StellarSdk from "@stellar/stellar-sdk";

export type NetworkType = "testnet" | "mainnet" | "local";

export interface NetworkConfig {
  rpcUrl: string;
  horizonUrl: string;
  networkPassphrase: string;
  friendbotUrl: string | null;
}

const configs: Record<NetworkType, NetworkConfig> = {
  testnet: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
    networkPassphrase: StellarSdk.Networks.TESTNET,
    friendbotUrl: "https://friendbot.stellar.org",
  },
  mainnet: {
    rpcUrl: "https://soroban.stellar.org",
    horizonUrl: "https://horizon.stellar.org",
    networkPassphrase: StellarSdk.Networks.PUBLIC,
    friendbotUrl: null,
  },
  local: {
    rpcUrl: "http://localhost:8000/soroban/rpc",
    horizonUrl: "http://localhost:8000",
    networkPassphrase: "Standalone Network ; February 2017",
    friendbotUrl: "http://localhost:8000/friendbot",
  },
};

// Get network from environment variable or default to testnet
const networkEnv = process.env.NEXT_PUBLIC_STELLAR_NETWORK as NetworkType;
export const NETWORK: NetworkType = networkEnv || "testnet";

export const config = configs[NETWORK];

// RPC Client for Soroban interactions
export const rpc = new StellarSdk.rpc.Server(config.rpcUrl);

// Horizon Server for classic Stellar operations
export const horizon = new StellarSdk.Horizon.Server(config.horizonUrl);

// Helper to fund account on testnet
export async function fundAccount(publicKey: string): Promise<void> {
  if (!config.friendbotUrl) {
    throw new Error("Friendbot not available on this network");
  }

  const response = await fetch(`${config.friendbotUrl}?addr=${publicKey}`);
  if (!response.ok) {
    throw new Error(`Failed to fund account: ${response.statusText}`);
  }
}

// Helper to get account info
export async function getAccount(publicKey: string) {
  try {
    return await rpc.getAccount(publicKey);
  } catch {
    // Account might not exist yet
    return null;
  }
}

// Helper to build and simulate a transaction
export async function simulateTransaction(
  transaction: StellarSdk.Transaction
): Promise<StellarSdk.rpc.Api.SimulateTransactionResponse> {
  return await rpc.simulateTransaction(transaction);
}

// Helper to submit a signed transaction
export async function submitTransaction(
  signedXdr: string
): Promise<StellarSdk.rpc.Api.GetTransactionResponse> {
  const transaction = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    config.networkPassphrase
  ) as StellarSdk.Transaction;

  const response = await rpc.sendTransaction(transaction);

  if (response.status === "ERROR") {
    throw new Error(`Transaction failed: ${JSON.stringify(response.errorResult)}`);
  }

  // Poll for result
  let getResponse = await rpc.getTransaction(response.hash);
  while (getResponse.status === "NOT_FOUND") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    getResponse = await rpc.getTransaction(response.hash);
  }

  return getResponse;
}
