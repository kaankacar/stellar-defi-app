import * as StellarSdk from "@stellar/stellar-sdk";
import { config, rpc } from "./stellar";

// ====================================================
// Our DeFi Hub contract addresses (deployed by us)
// ====================================================
export interface ContractAddresses {
  router: string;
  registry: string;
  swapAggregator: string;
  oracle: string;
  adapters: {
    blend: string;
    soroswap: string;
    aquarius: string;
    defindex: string;
    orbit: string;
    phoenix: string;
  };
  strategies: {
    oneClickYield: string;
    leveragedYield: string;
    lpZap: string;
  };
}

const defaultAddresses: ContractAddresses = {
  router: process.env.NEXT_PUBLIC_ROUTER_CONTRACT || "",
  registry: process.env.NEXT_PUBLIC_REGISTRY_CONTRACT || "",
  swapAggregator: process.env.NEXT_PUBLIC_AGGREGATOR_CONTRACT || "",
  oracle: process.env.NEXT_PUBLIC_ORACLE_CONTRACT || "",
  adapters: {
    blend: process.env.NEXT_PUBLIC_BLEND_ADAPTER || "",
    soroswap: process.env.NEXT_PUBLIC_SOROSWAP_ADAPTER || "",
    aquarius: process.env.NEXT_PUBLIC_AQUARIUS_ADAPTER || "",
    defindex: process.env.NEXT_PUBLIC_DEFINDEX_ADAPTER || "",
    orbit: process.env.NEXT_PUBLIC_ORBIT_ADAPTER || "",
    phoenix: process.env.NEXT_PUBLIC_PHOENIX_ADAPTER || "",
  },
  strategies: {
    oneClickYield: process.env.NEXT_PUBLIC_YIELD_STRATEGY || "",
    leveragedYield: process.env.NEXT_PUBLIC_LEVERAGE_STRATEGY || "",
    lpZap: process.env.NEXT_PUBLIC_LPZAP_STRATEGY || "",
  },
};

export const contractAddresses = defaultAddresses;

// ====================================================
// Real Protocol Mainnet Addresses
// These are the actual deployed contracts on Stellar mainnet
// ====================================================
export const PROTOCOL_ADDRESSES = {
  // Soroswap DEX
  soroswap: {
    router: "CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH",
    factory: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
    aggregator: "CAYP3UWLJM7ZPTUKL6R6BFGTRWLZ46LRKOXTERI2K6BIJAWGYY62TXTO",
  },
  // Blend Protocol v2
  blend: {
    poolFactory: "CDSYOAVXFY7SM5S64IZPPPYB4GVGGLMQVFREPSQQEZVIWXX5R23G4QSU",
    backstop: "CAQQR5SWBXKIGZKPBZDH3KM5GQ5GUTPKB7JAFCINLZBC5WXPJKRG3IM7",
    emitter: "CCOQM6S7ICIUWA225O5PSJWUBEMXGFSSW2PQFO6FP4DQEKMS5DASRGRR",
    blndToken: "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
    cometPool: "CAS3FL6TLZKDGGSISDBWGGPXT3NRR4DYTZD7YOD3HMYO6LTJUVGRVEAM",
  },
  // Aquarius AMM
  aquarius: {
    router: "CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK",
  },
  // DeFindex Yield Vaults
  defindex: {
    factory: "CDKFHFJIET3A73A2YN4KV7NSV32S6YGQMUFH3DNJXLBWL4SKEGVRNFKI",
  },
  // Reflector Oracle
  reflector: {
    oracle: "CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN",
  },
  // Soroswap Aggregator Adapters (for routing)
  aggregatorAdapters: {
    soroswap: "CC6KQUATUBCIFZRDJL5X5PHCYGOHLPHKZQPUOTZTQTASGU5AUQ6DS7SC",
    phoenix: "CCEBUGFV3D73OMV7MUXXA43AREY53MUHVD5SMUM7YZODNGY4NZBA2TSC",
    aqua: "CDHDUKHFZB6FORHEBZCNYI3GGVNVOLEITSGI7OKU4UIQND5QG75KGSRR",
  },
} as const;

// Generic contract client factory
export function createContractClient(contractId: string) {
  return new StellarSdk.Contract(contractId);
}

// Helper to invoke a contract method
export async function invokeContract(
  sourceAddress: string,
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[]
): Promise<StellarSdk.Transaction> {
  const account = await rpc.getAccount(sourceAddress);
  const contract = new StellarSdk.Contract(contractId);

  let transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(180)
    .build();

  // Simulate to get resource estimates
  const simulation = await rpc.simulateTransaction(transaction);

  if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation failed: ${simulation.error}`);
  }

  // Assemble with proper resources
  transaction = StellarSdk.rpc.assembleTransaction(
    transaction,
    simulation
  ).build();

  return transaction;
}

// Helper to convert native values to ScVal
export function toScVal(
  value: unknown,
  type?: string
): StellarSdk.xdr.ScVal {
  return StellarSdk.nativeToScVal(value, type ? { type } : undefined);
}

// Helper to convert Address string to ScVal
export function addressToScVal(address: string): StellarSdk.xdr.ScVal {
  return StellarSdk.Address.fromString(address).toScVal();
}

// Helper to convert i128 to ScVal
export function i128ToScVal(amount: bigint): StellarSdk.xdr.ScVal {
  return StellarSdk.nativeToScVal(amount, { type: "i128" });
}

// Submit signed transaction and wait for result
export async function submitTransaction(
  signedXdr: string
): Promise<StellarSdk.rpc.Api.GetTransactionResponse> {
  const tx = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    config.networkPassphrase
  );

  const response = await rpc.sendTransaction(tx);

  if (response.status === "ERROR") {
    throw new Error(`Transaction failed: ${response.errorResult?.toXDR("base64")}`);
  }

  // Wait for transaction to be confirmed
  let result = await rpc.getTransaction(response.hash);
  while (result.status === "NOT_FOUND") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    result = await rpc.getTransaction(response.hash);
  }

  return result;
}

// Router contract helpers
export const RouterContract = {
  async executeSingle(
    userAddress: string,
    adapter: string,
    action: string,
    asset: string,
    amount: bigint
  ) {
    return invokeContract(userAddress, contractAddresses.router, "execute_single", [
      addressToScVal(adapter),
      StellarSdk.nativeToScVal(action, { type: "symbol" }),
      addressToScVal(userAddress),
      addressToScVal(asset),
      i128ToScVal(amount),
    ]);
  },
};

// SwapAggregator contract helpers
export const SwapAggregatorContract = {
  async getQuotes(
    userAddress: string,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint
  ) {
    return invokeContract(userAddress, contractAddresses.swapAggregator, "get_quotes", [
      addressToScVal(tokenIn),
      addressToScVal(tokenOut),
      i128ToScVal(amountIn),
    ]);
  },

  async swap(
    userAddress: string,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    minAmountOut: bigint
  ) {
    return invokeContract(userAddress, contractAddresses.swapAggregator, "swap", [
      addressToScVal(userAddress),
      addressToScVal(tokenIn),
      addressToScVal(tokenOut),
      i128ToScVal(amountIn),
      i128ToScVal(minAmountOut),
    ]);
  },
};

// Registry contract helpers
export const RegistryContract = {
  async listStrategies(userAddress: string) {
    return invokeContract(userAddress, contractAddresses.registry, "list_strategies", []);
  },

  async getStrategy(userAddress: string, id: number) {
    return invokeContract(userAddress, contractAddresses.registry, "get_strategy", [
      StellarSdk.nativeToScVal(id, { type: "u32" }),
    ]);
  },
};

// Blend adapter helpers
export const BlendAdapterContract = {
  async deposit(userAddress: string, asset: string, amount: bigint) {
    return invokeContract(userAddress, contractAddresses.adapters.blend, "deposit", [
      addressToScVal(userAddress),
      addressToScVal(asset),
      i128ToScVal(amount),
    ]);
  },

  async withdraw(userAddress: string, asset: string, amount: bigint) {
    return invokeContract(userAddress, contractAddresses.adapters.blend, "withdraw", [
      addressToScVal(userAddress),
      addressToScVal(asset),
      i128ToScVal(amount),
    ]);
  },

  async borrow(userAddress: string, asset: string, amount: bigint) {
    return invokeContract(userAddress, contractAddresses.adapters.blend, "borrow", [
      addressToScVal(userAddress),
      addressToScVal(asset),
      i128ToScVal(amount),
    ]);
  },

  async repay(userAddress: string, asset: string, amount: bigint) {
    return invokeContract(userAddress, contractAddresses.adapters.blend, "repay", [
      addressToScVal(userAddress),
      addressToScVal(asset),
      i128ToScVal(amount),
    ]);
  },

  async getPosition(userAddress: string) {
    return invokeContract(userAddress, contractAddresses.adapters.blend, "get_position", [
      addressToScVal(userAddress),
    ]);
  },
};

// Strategy contract helpers
export const YieldStrategyContract = {
  async deposit(userAddress: string, asset: string, amount: bigint) {
    return invokeContract(userAddress, contractAddresses.strategies.oneClickYield, "deposit", [
      addressToScVal(userAddress),
      addressToScVal(asset),
      i128ToScVal(amount),
    ]);
  },

  async withdraw(userAddress: string, asset: string, amount: bigint) {
    return invokeContract(userAddress, contractAddresses.strategies.oneClickYield, "withdraw", [
      addressToScVal(userAddress),
      addressToScVal(asset),
      i128ToScVal(amount),
    ]);
  },
};
