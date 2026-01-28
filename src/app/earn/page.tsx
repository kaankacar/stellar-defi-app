"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useWallet } from "@/contexts/WalletContext";
import {
  getAvailableVaults,
  getUserVaultPositions,
  type VaultPosition,
} from "@/lib/defindex";
import { getPoolData } from "@/lib/blend";

// Combined strategies from DeFindex vaults and Blend pools
interface Strategy {
  id: string;
  name: string;
  description: string;
  apy: number;
  tvl: string;
  risk: "Low" | "Medium" | "High";
  protocols: string[];
  type: "vault" | "pool";
  address: string;
  asset: string;
}

export default function EarnPage() {
  const { connected, address } = useWallet();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [userPositions, setUserPositions] = useState<VaultPosition[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [filter, setFilter] = useState<"all" | "low" | "medium" | "high">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load strategies from multiple sources
  const loadStrategies = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const allStrategies: Strategy[] = [];

      // Load DeFindex vaults
      try {
        const vaults = await getAvailableVaults();
        for (const vault of vaults) {
          allStrategies.push({
            id: `vault-${vault.address}`,
            name: vault.name,
            description: vault.description,
            apy: vault.apy,
            tvl: vault.tvl,
            risk: vault.apy > 10 ? "High" : vault.apy > 5 ? "Medium" : "Low",
            protocols: vault.protocols,
            type: "vault",
            address: vault.address,
            asset: vault.asset,
          });
        }
      } catch (err) {
        console.warn("Failed to load DeFindex vaults:", err);
      }

      // Load Blend pools as simple yield strategies
      try {
        const blendMarkets = await getPoolData();
        for (const market of blendMarkets) {
          if (market.supplyAPY > 0) {
            allStrategies.push({
              id: `blend-${market.assetAddress}`,
              name: `${market.asset} Lending`,
              description: `Earn yield by supplying ${market.asset} to Blend Protocol`,
              apy: market.supplyAPY,
              tvl: market.totalSupply,
              risk: market.supplyAPY > 10 ? "High" : market.supplyAPY > 5 ? "Medium" : "Low",
              protocols: ["Blend"],
              type: "pool",
              address: market.assetAddress,
              asset: market.asset,
            });
          }
        }
      } catch (err) {
        console.warn("Failed to load Blend markets:", err);
      }

      // Sort by APY descending
      allStrategies.sort((a, b) => b.apy - a.apy);
      setStrategies(allStrategies);

      // Load user positions if connected
      if (connected && address) {
        try {
          const positions = await getUserVaultPositions(address);
          setUserPositions(positions);
        } catch (err) {
          console.warn("Failed to load user positions:", err);
        }
      }
    } catch (err) {
      console.error("Failed to load strategies:", err);
      setError("Failed to load yield strategies. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [connected, address]);

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);


  const filteredStrategies = strategies.filter(
    (s) => filter === "all" || s.risk.toLowerCase() === filter
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Earn</h1>
          <p className="text-gray-400">Yield strategies powered by Stellar DeFi</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
        )}


        {/* Protocol Status */}
        <div className="p-3 bg-gray-800/50 rounded-lg text-sm flex items-center gap-6">
          <span className="text-gray-400">Data fetched from on-chain contracts</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-green-400">Mainnet</span>
          </span>
        </div>

        {/* User's Active Positions */}
        {connected && userPositions.length > 0 && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4">Your Active Positions</h2>
            <div className="space-y-3">
              {userPositions.map((position) => (
                <div
                  key={position.vaultAddress}
                  className="flex justify-between items-center p-4 bg-gray-800 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{position.vaultName}</p>
                    <p className="text-sm text-gray-400">{position.shares} shares</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${position.value}</p>
                    <p className="text-sm text-green-500">{position.asset}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {connected && userPositions.length === 0 && !loading && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4">Your Active Positions</h2>
            <div className="text-center py-6 text-gray-500">
              <p>No active positions</p>
              <p className="text-sm mt-2">Deposit into a strategy below to start earning</p>
            </div>
          </div>
        )}

        {/* Risk Filter */}
        <div className="flex gap-2">
          {(["all", "low", "medium", "high"] as const).map((risk) => (
            <button
              key={risk}
              onClick={() => setFilter(risk)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === risk
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {risk === "all" ? "All" : `${risk.charAt(0).toUpperCase() + risk.slice(1)} Risk`}
            </button>
          ))}
        </div>

        {/* Strategy Cards */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <span className="animate-pulse">Loading yield strategies from protocols...</span>
          </div>
        ) : filteredStrategies.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No strategies available for this filter
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredStrategies.map((strategy) => (
              <div
                key={strategy.id}
                className="bg-gray-900 rounded-xl p-6 border border-gray-800 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">{strategy.name}</h3>
                    <p className="text-sm text-gray-400 mt-1">{strategy.description}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    strategy.type === "vault"
                      ? "bg-purple-500/20 text-purple-400"
                      : "bg-blue-500/20 text-blue-400"
                  }`}>
                    {strategy.type === "vault" ? "Vault" : "Pool"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-400">APY</p>
                    <p className="text-xl font-bold text-green-500">{strategy.apy.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">TVL</p>
                    <p className="text-xl font-bold">{strategy.tvl}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Risk</p>
                    <p className={`text-xl font-bold ${
                      strategy.risk === "Low" ? "text-green-500" :
                      strategy.risk === "Medium" ? "text-yellow-500" : "text-red-500"
                    }`}>
                      {strategy.risk}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {strategy.protocols.map((protocol) => (
                    <span
                      key={protocol}
                      className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400"
                    >
                      {protocol} &#10003;
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => setSelectedStrategy(strategy)}
                  disabled={!connected}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
                >
                  {connected ? "Deposit" : "Connect Wallet"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Deposit Modal */}
        {selectedStrategy && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{selectedStrategy.name}</h2>
                <button
                  onClick={() => {
                    setSelectedStrategy(null);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  &#10005;
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-400 mb-1">{selectedStrategy.description}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-green-500 font-semibold">{selectedStrategy.apy.toFixed(2)}% APY</span>
                    <span className={`text-sm ${
                      selectedStrategy.risk === "Low" ? "text-green-500" :
                      selectedStrategy.risk === "Medium" ? "text-yellow-500" : "text-red-500"
                    }`}>
                      {selectedStrategy.risk} Risk
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-gray-800 rounded-lg text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Expected APY</span>
                    <span className="text-green-500">{selectedStrategy.apy.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Protocols Used</span>
                    <span>{selectedStrategy.protocols.join(", ")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Asset</span>
                    <span>{selectedStrategy.asset}</span>
                  </div>
                </div>

                <a
                  href="/lend"
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors text-center block"
                >
                  Go to Lend Page to Deposit
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
