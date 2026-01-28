"use client";

import { ConnectButton } from "./ConnectButton";

export function Header() {
  return (
    <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-white">
          Stellar DeFi Super App
        </h1>
      </div>
      
      <div className="flex items-center gap-4">
        <ConnectButton />
      </div>
    </header>
  );
}
