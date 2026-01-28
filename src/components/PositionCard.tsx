"use client";

import { useState } from "react";
import Link from "next/link";

export interface Position {
  asset: string;
  assetIcon: string;
  amount: string;
  valueUsd: string;
  apy?: string;
}

export interface PositionCardProps {
  protocol: string;
  protocolIcon: string;
  type: "supply" | "borrow" | "lp" | "vault" | "strategy";
  totalValueUsd: string;
  healthFactor?: number;
  positions: Position[];
  actionUrl?: string;
}

export function PositionCard({
  protocol,
  protocolIcon,
  type,
  totalValueUsd,
  healthFactor,
  positions,
  actionUrl,
}: PositionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getHealthFactorColor = (hf: number) => {
    if (hf >= 2) return "text-green-500";
    if (hf >= 1.5) return "text-yellow-500";
    return "text-red-500";
  };

  const getHealthFactorLabel = (hf: number) => {
    if (hf >= 2) return "Healthy";
    if (hf >= 1.5) return "Moderate";
    return "At Risk";
  };

  const typeLabel = {
    supply: "Supplied",
    borrow: "Borrowed",
    lp: "LP Position",
    vault: "Vault",
    strategy: "Strategy",
  };

  const typeColor = {
    supply: "bg-green-500/10 text-green-500",
    borrow: "bg-yellow-500/10 text-yellow-500",
    lp: "bg-blue-500/10 text-blue-500",
    vault: "bg-purple-500/10 text-purple-500",
    strategy: "bg-pink-500/10 text-pink-500",
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{protocolIcon}</span>
          <div>
            <h3 className="font-semibold">{protocol}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${typeColor[type]}`}>
              {typeLabel[type]}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-semibold">{totalValueUsd}</p>
            {healthFactor !== undefined && (
              <p className={`text-sm ${getHealthFactorColor(healthFactor)}`}>
                HF: {healthFactor.toFixed(2)} ({getHealthFactorLabel(healthFactor)})
              </p>
            )}
          </div>
          <span
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            ▼
          </span>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-gray-800">
          {/* Position Details */}
          <div className="p-4 space-y-3">
            {positions.map((pos, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-2 border-b border-gray-800 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{pos.assetIcon}</span>
                  <div>
                    <p className="font-medium">{pos.asset}</p>
                    <p className="text-sm text-gray-400">{pos.amount}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{pos.valueUsd}</p>
                  {pos.apy && (
                    <p className="text-sm text-green-500">{pos.apy} APY</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="p-4 bg-gray-800/50 flex gap-2">
            {type === "supply" && (
              <>
                <Link
                  href={actionUrl || "/lend"}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-center font-medium transition-colors"
                >
                  Deposit More
                </Link>
                <button className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors">
                  Withdraw
                </button>
              </>
            )}
            {type === "borrow" && (
              <>
                <button className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-medium transition-colors">
                  Repay
                </button>
                <Link
                  href={actionUrl || "/lend"}
                  className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-center font-medium transition-colors"
                >
                  Borrow More
                </Link>
              </>
            )}
            {(type === "lp" || type === "vault" || type === "strategy") && (
              <>
                <Link
                  href={actionUrl || "/earn"}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-center font-medium transition-colors"
                >
                  Add More
                </Link>
                <button className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors">
                  Withdraw
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
