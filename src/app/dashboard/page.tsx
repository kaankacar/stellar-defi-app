"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useWallet } from "@/contexts/WalletContext";
import { getUserPositions, type UserPositionSummary } from "@/lib/blend";
import { horizon } from "@/lib/stellar";

interface AccountBalance {
  asset: string;
  balance: string;
  assetCode?: string;
}

export default function DashboardPage() {
  const { address, connected } = useWallet();
  const [blendPosition, setBlendPosition] = useState<UserPositionSummary | null>(null);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user data
  const loadUserData = useCallback(async () => {
    if (!connected || !address) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Load account balances from Horizon
      try {
        const account = await horizon.loadAccount(address);
        const accountBalances: AccountBalance[] = account.balances.map((b) => {
          if (b.asset_type === "native") {
            return { asset: "XLM", balance: b.balance };
          }
          return {
            asset: "asset_code" in b ? b.asset_code : "Unknown",
            balance: b.balance,
            assetCode: "asset_code" in b ? b.asset_code : undefined,
          };
        });
        setBalances(accountBalances);
      } catch (err) {
        console.warn("Failed to load account balances:", err);
      }

      // Load Blend positions
      try {
        const positions = await getUserPositions(address);
        setBlendPosition(positions);
      } catch (err) {
        console.warn("Failed to load Blend positions:", err);
      }
    } catch (err) {
      console.error("Failed to load user data:", err);
      setError("Failed to load portfolio data");
    } finally {
      setLoading(false);
    }
  }, [connected, address]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Calculate totals
  const totalSupplied = blendPosition?.totalCollateralValue || 0;
  const totalBorrowed = blendPosition?.totalBorrowedValue || 0;
  const totalValue = totalSupplied - totalBorrowed;
  const netAPY = blendPosition?.netAPR || 0;

  if (!connected) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-400">Please connect your wallet to view your dashboard</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Portfolio Dashboard</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
              Mainnet
            </span>
            <span className="text-sm text-gray-400">
              {address?.slice(0, 8)}...{address?.slice(-8)}
            </span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Portfolio Summary */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-900 rounded-xl p-4 border border-gray-800 animate-pulse">
                <div className="h-4 bg-gray-800 rounded w-20 mb-2"></div>
                <div className="h-8 bg-gray-800 rounded w-24"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="Net Value"
              value={`$${totalValue.toFixed(2)}`}
              change={netAPY > 0 ? `+${netAPY.toFixed(2)}%` : `${netAPY.toFixed(2)}%`}
              positive={netAPY >= 0}
            />
            <StatCard
              title="Supplied"
              value={`$${totalSupplied.toFixed(2)}`}
              change={blendPosition ? `${blendPosition.positions.filter(p => parseFloat(p.supplied) > 0).length} positions` : "0 positions"}
              positive={true}
            />
            <StatCard
              title="Borrowed"
              value={`$${totalBorrowed.toFixed(2)}`}
              change={blendPosition ? `${blendPosition.positions.filter(p => parseFloat(p.borrowed) > 0).length} positions` : "0 positions"}
              positive={false}
            />
            <StatCard
              title="Health Factor"
              value={blendPosition?.healthFactor === Infinity ? "∞" : (blendPosition?.healthFactor.toFixed(2) || "∞")}
              change={blendPosition?.healthFactor && blendPosition.healthFactor > 1.5 ? "Safe" : blendPosition?.healthFactor && blendPosition.healthFactor > 1.1 ? "Moderate" : "Safe"}
              positive={true}
            />
          </div>
        )}

        {/* Wallet Balances */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Wallet Balances</h2>
          {loading ? (
            <div className="animate-pulse space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-800 rounded"></div>
              ))}
            </div>
          ) : balances.length > 0 ? (
            <div className="space-y-3">
              {balances.map((balance, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-3 bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{balance.asset}</span>
                  </div>
                  <span className="font-mono">{parseFloat(balance.balance).toFixed(4)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <p>No balances found</p>
              <p className="text-sm mt-2">Fund your account to get started</p>
            </div>
          )}
        </div>

        {/* Positions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Supply Positions */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4">Supply Positions</h2>
            {loading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-16 bg-gray-800 rounded"></div>
              </div>
            ) : blendPosition?.positions.filter(p => parseFloat(p.supplied) > 0).length ? (
              <div className="space-y-3">
                {blendPosition.positions
                  .filter(p => parseFloat(p.supplied) > 0)
                  .map((position, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-3 bg-gray-800 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{position.asset}</p>
                        <p className="text-sm text-gray-400">{position.supplied} supplied</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${position.suppliedValue.toFixed(2)}</p>
                        <p className="text-sm text-green-500">Earning yield</p>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No supply positions</p>
                <p className="text-sm mt-2">Deposit assets to start earning yield</p>
              </div>
            )}
          </div>

          {/* Borrow Positions */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4">Borrow Positions</h2>
            {loading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-16 bg-gray-800 rounded"></div>
              </div>
            ) : blendPosition?.positions.filter(p => parseFloat(p.borrowed) > 0).length ? (
              <div className="space-y-3">
                {blendPosition.positions
                  .filter(p => parseFloat(p.borrowed) > 0)
                  .map((position, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-3 bg-gray-800 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{position.asset}</p>
                        <p className="text-sm text-gray-400">{position.borrowed} borrowed</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${position.borrowedValue.toFixed(2)}</p>
                        <p className="text-sm text-yellow-500">Accruing interest</p>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No borrow positions</p>
                <p className="text-sm mt-2">Supply collateral to borrow assets</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickAction
              title="Swap"
              description="Exchange tokens"
              href="/swap"
            />
            <QuickAction
              title="Supply"
              description="Earn yield on deposits"
              href="/lend"
            />
            <QuickAction
              title="Borrow"
              description="Borrow against collateral"
              href="/lend"
            />
            <QuickAction
              title="Earn"
              description="One-click strategies"
              href="/earn"
            />
          </div>
        </div>

        {/* Protocol Integration Status */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Integrated Protocols</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <ProtocolStatus name="Blend" />
            <ProtocolStatus name="Soroswap" />
            <ProtocolStatus name="Aquarius" />
            <ProtocolStatus name="Phoenix" />
            <ProtocolStatus name="DeFindex" />
            <ProtocolStatus name="Reflector" />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function StatCard({
  title,
  value,
  change,
  positive = true,
}: {
  title: string;
  value: string;
  change: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className={`text-sm mt-1 ${positive ? "text-green-500" : "text-yellow-500"}`}>
        {change}
      </p>
    </div>
  );
}

function QuickAction({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex flex-col items-center p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
    >
      <span className="font-medium">{title}</span>
      <span className="text-xs text-gray-400 mt-1">{description}</span>
    </a>
  );
}

function ProtocolStatus({ name }: { name: string }) {
  return (
    <div className="p-3 rounded-lg border text-center bg-green-500/10 border-green-500/30">
      <p className="font-medium text-sm">{name}</p>
      <p className="text-xs mt-1 text-green-400">Mainnet</p>
    </div>
  );
}
