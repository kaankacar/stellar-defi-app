"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";

interface Transaction {
  id: string;
  type: "swap" | "supply" | "withdraw" | "borrow" | "repay" | "deposit" | "strategy";
  status: "success" | "pending" | "failed";
  timestamp: number;
  assets: {
    in?: { symbol: string; amount: string };
    out?: { symbol: string; amount: string };
  };
  txHash: string;
  protocol?: string;
}

// Mock data for demonstration - in production, fetch from contract events or indexer
const MOCK_TRANSACTIONS: Transaction[] = [];

export function TransactionHistory() {
  const { address, connected } = useWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (connected && address) {
      fetchTransactions();
    } else {
      setTransactions([]);
    }
  }, [connected, address]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      // TODO: In production, query contract events or use an indexer
      // For now, use mock data
      await new Promise((resolve) => setTimeout(resolve, 500));
      setTransactions(MOCK_TRANSACTIONS);
      setHasMore(false);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    // TODO: Implement pagination with page tracking
    await fetchTransactions();
  };

  const getTypeIcon = (type: Transaction["type"]) => {
    switch (type) {
      case "swap":
        return "🔄";
      case "supply":
        return "📥";
      case "withdraw":
        return "📤";
      case "borrow":
        return "💳";
      case "repay":
        return "💰";
      case "deposit":
        return "🏦";
      case "strategy":
        return "⚡";
      default:
        return "📋";
    }
  };

  const getTypeLabel = (type: Transaction["type"]) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getStatusColor = (status: Transaction["status"]) => {
    switch (status) {
      case "success":
        return "text-green-500";
      case "pending":
        return "text-yellow-500";
      case "failed":
        return "text-red-500";
    }
  };

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!connected) {
    return null;
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800">
      <div className="p-4 border-b border-gray-800 flex justify-between items-center">
        <h2 className="text-lg font-semibold">Recent Activity</h2>
        {transactions.length > 0 && (
          <button
            onClick={fetchTransactions}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Refresh
          </button>
        )}
      </div>

      <div className="divide-y divide-gray-800">
        {loading && transactions.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-2xl mb-2">📋</p>
            <p>No transactions yet</p>
            <p className="text-sm mt-1">
              Your activity will appear here after your first transaction
            </p>
          </div>
        ) : (
          transactions.map((tx) => (
            <div
              key={tx.id}
              className="p-4 hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getTypeIcon(tx.type)}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{getTypeLabel(tx.type)}</span>
                      {tx.protocol && (
                        <span className="text-xs px-2 py-0.5 bg-gray-800 rounded text-gray-400">
                          {tx.protocol}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400">
                      {tx.assets.in && (
                        <span>
                          {tx.assets.in.amount} {tx.assets.in.symbol}
                        </span>
                      )}
                      {tx.assets.in && tx.assets.out && <span> → </span>}
                      {tx.assets.out && (
                        <span>
                          {tx.assets.out.amount} {tx.assets.out.symbol}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`text-sm font-medium ${getStatusColor(tx.status)}`}>
                    {tx.status === "success" && "✓ "}
                    {tx.status === "pending" && "⏳ "}
                    {tx.status === "failed" && "✗ "}
                    {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatTimestamp(tx.timestamp)}
                  </p>
                </div>
              </div>

              <div className="mt-2">
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${tx.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 font-mono"
                >
                  {tx.txHash.slice(0, 8)}...{tx.txHash.slice(-8)} ↗
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {hasMore && (
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={loadMore}
            disabled={loading}
            className="w-full py-2 text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
