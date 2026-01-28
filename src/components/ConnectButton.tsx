"use client";

import { useWallet } from "@/contexts/WalletContext";
import { useState } from "react";

export function ConnectButton() {
  const {
    connected,
    address,
    connect,
    disconnect,
    availableWallets,
    isLoading,
    error
  } = useWallet();
  const [showWalletList, setShowWalletList] = useState(false);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  if (connected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">
          {formatAddress(address)}
        </span>
        <button
          onClick={disconnect}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowWalletList(!showWalletList)}
        disabled={isLoading}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {isLoading ? "Connecting..." : "Connect Wallet"}
      </button>

      {showWalletList && !isLoading && (
        <div className="absolute right-0 mt-2 w-64 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50">
          <div className="p-2">
            <h3 className="text-sm font-semibold text-gray-400 px-2 py-1">
              Select Wallet
            </h3>
            {availableWallets.map((wallet) => (
              <button
                key={wallet.id}
                onClick={async () => {
                  await connect(wallet.id);
                  setShowWalletList(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <span className="font-medium">{wallet.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="absolute mt-2 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
