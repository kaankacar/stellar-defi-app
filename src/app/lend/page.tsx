"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useWallet } from "@/contexts/WalletContext";
import {
  getPoolData,
  getUserPositions,
  buildSupplyTransaction,
  buildBorrowTransaction,
  buildWithdrawTransaction,
  buildRepayTransaction,
  submitBlendTransaction,
  parseAmount,
  type MarketData,
  type UserPositionSummary,
} from "@/lib/blend";

export default function LendPage() {
  const { connected, address, signTransaction } = useWallet();
  const [activeTab, setActiveTab] = useState<"supply" | "borrow">("supply");
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [userPosition, setUserPosition] = useState<UserPositionSummary | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  // Load market data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const marketData = await getPoolData();
      setMarkets(marketData);

      if (connected && address) {
        const positions = await getUserPositions(address);
        setUserPosition(positions);
      }
    } catch (err) {
      console.error("Failed to load data:", err);
      setError("Failed to load market data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [connected, address]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAction = async (action: "supply" | "borrow" | "withdraw" | "repay") => {
    if (!connected || !address || !selectedMarket || !amount) return;

    setActionLoading(true);
    setError(null);
    setTxStatus(`Building ${action} transaction...`);

    try {
      const amountBigInt = parseAmount(amount);
      let xdr: string;

      switch (action) {
        case "supply":
          xdr = await buildSupplyTransaction(address, selectedMarket.assetAddress, amountBigInt);
          break;
        case "borrow":
          xdr = await buildBorrowTransaction(address, selectedMarket.assetAddress, amountBigInt);
          break;
        case "withdraw":
          xdr = await buildWithdrawTransaction(address, selectedMarket.assetAddress, amountBigInt);
          break;
        case "repay":
          xdr = await buildRepayTransaction(address, selectedMarket.assetAddress, amountBigInt);
          break;
      }

      setTxStatus("Please sign in your wallet...");
      const signedXdr = await signTransaction(xdr);

      setTxStatus("Submitting transaction...");
      const result = await submitBlendTransaction(signedXdr);

      setTxStatus(`${action.charAt(0).toUpperCase() + action.slice(1)} successful! Hash: ${result.hash.slice(0, 8)}...`);
      setAmount("");
      setSelectedMarket(null);

      // Refresh data
      await loadData();

      setTimeout(() => setTxStatus(null), 5000);
    } catch (err: unknown) {
      console.error(`${action} error:`, err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(`${action.charAt(0).toUpperCase() + action.slice(1)} failed: ${errorMessage}`);
      setTxStatus(null);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Lend & Borrow</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
              Mainnet
            </span>
            <span className="text-sm text-gray-400">
              Powered by Blend Protocol
            </span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Transaction Status */}
        {txStatus && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
            {txStatus}
          </div>
        )}

        {/* User Position Summary */}
        {connected && userPosition && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-sm text-gray-400">Your Supplies</p>
              <p className="text-2xl font-bold mt-1">
                ${userPosition.totalCollateralValue.toFixed(2)}
              </p>
              <p className="text-sm text-green-500">
                +{userPosition.netAPR > 0 ? userPosition.netAPR.toFixed(2) : "0"}% APR
              </p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-sm text-gray-400">Your Borrows</p>
              <p className="text-2xl font-bold mt-1">
                ${userPosition.totalBorrowedValue.toFixed(2)}
              </p>
              <p className="text-sm text-gray-500">
                Limit: ${userPosition.borrowLimit.toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-sm text-gray-400">Health Factor</p>
              <p className={`text-2xl font-bold mt-1 ${
                userPosition.healthFactor > 1.5 ? "text-green-500" :
                userPosition.healthFactor > 1.1 ? "text-yellow-500" : "text-red-500"
              }`}>
                {userPosition.healthFactor === Infinity ? "∞" : userPosition.healthFactor.toFixed(2)}
              </p>
              <p className="text-sm text-gray-500">
                {userPosition.healthFactor > 1.5 ? "Safe" :
                 userPosition.healthFactor > 1.1 ? "Moderate" : "At Risk"}
              </p>
            </div>
          </div>
        )}

        {connected && !userPosition && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-sm text-gray-400">Your Supplies</p>
              <p className="text-2xl font-bold mt-1">$0.00</p>
              <p className="text-sm text-green-500">+0% APY</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-sm text-gray-400">Your Borrows</p>
              <p className="text-2xl font-bold mt-1">$0.00</p>
              <p className="text-sm text-red-500">-0% APY</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-sm text-gray-400">Health Factor</p>
              <p className="text-2xl font-bold mt-1 text-green-500">&#8734;</p>
              <p className="text-sm text-gray-500">Safe</p>
            </div>
          </div>
        )}

        {/* Markets Table */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab("supply")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === "supply"
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Supply Markets
              </button>
              <button
                onClick={() => setActiveTab("borrow")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === "borrow"
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Borrow Markets
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <span className="animate-pulse">Loading market data from Blend Protocol...</span>
            </div>
          ) : markets.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No markets available
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr className="text-left text-sm text-gray-400">
                  <th className="px-6 py-3">Asset</th>
                  <th className="px-6 py-3">{activeTab === "supply" ? "Supply APY" : "Borrow APY"}</th>
                  <th className="px-6 py-3">Total {activeTab === "supply" ? "Supply" : "Borrow"}</th>
                  <th className="px-6 py-3">Utilization</th>
                  <th className="px-6 py-3">LTV</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {markets.map((market) => (
                  <tr key={market.assetAddress} className="hover:bg-gray-800/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{market.asset}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={activeTab === "supply" ? "text-green-500" : "text-yellow-500"}>
                        {activeTab === "supply"
                          ? market.supplyAPY.toFixed(2)
                          : market.borrowAPY.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {activeTab === "supply" ? market.totalSupply : market.totalBorrow}
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {market.utilization.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {market.collateralFactor.toFixed(0)}%
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedMarket(market)}
                        disabled={!connected}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                      >
                        {activeTab === "supply" ? "Supply" : "Borrow"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Action Modal */}
        {selectedMarket && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">
                  {activeTab === "supply" ? "Supply" : "Borrow"} {selectedMarket.asset}
                </h2>
                <button
                  onClick={() => {
                    setSelectedMarket(null);
                    setAmount("");
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  &#10005;
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Amount</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="flex-1 bg-gray-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      className="px-4 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700"
                      onClick={() => {/* TODO: Set max balance */}}
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-gray-800 rounded-lg text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{activeTab === "supply" ? "Supply" : "Borrow"} APY</span>
                    <span className={activeTab === "supply" ? "text-green-500" : "text-yellow-500"}>
                      {activeTab === "supply"
                        ? selectedMarket.supplyAPY.toFixed(2)
                        : selectedMarket.borrowAPY.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Collateral Factor</span>
                    <span>{selectedMarket.collateralFactor.toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Utilization</span>
                    <span>{selectedMarket.utilization.toFixed(1)}%</span>
                  </div>
                </div>

                <button
                  onClick={() => handleAction(activeTab)}
                  disabled={actionLoading || !amount}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
                >
                  {actionLoading ? "Processing..." : `${activeTab === "supply" ? "Supply" : "Borrow"} ${selectedMarket.asset}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
