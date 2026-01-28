"use client";

import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { useWallet } from "@/contexts/WalletContext";

export default function Home() {
  const { connected } = useWallet();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
          Stellar DeFi Super App
        </h1>
        <p className="text-xl text-gray-400 mb-8">
          Your unified gateway to Stellar DeFi. Swap, lend, earn, and manage all
          your positions in one place.
        </p>

        <div className="flex flex-col items-center gap-6">
          {!connected ? (
            <>
              <p className="text-gray-500">Connect your wallet to get started</p>
              <ConnectButton />
            </>
          ) : (
            <Link
              href="/dashboard"
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              Launch App
            </Link>
          )}
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            icon="🔄"
            title="Swap Aggregation"
            description="Get the best rates across Soroswap, Aquarius, and Phoenix DEXs"
          />
          <FeatureCard
            icon="🏦"
            title="Lending & Borrowing"
            description="Access Blend lending markets with optimized rates"
          />
          <FeatureCard
            icon="💰"
            title="Yield Strategies"
            description="One-click yield optimization across DeFi protocols"
          />
        </div>

        <div className="mt-12 text-sm text-gray-500">
          <p>Powered by Stellar & Soroban</p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
}
