"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useWallet } from "@/contexts/WalletContext";
import {
  getSwapQuote,
  formatAmount,
  parseAmount,
  MAINNET_TOKENS,
  type SwapQuote,
} from "@/lib/soroswap";

const TOKENS = [
  { symbol: "XLM", name: "Stellar Lumens", address: "native", decimals: 7 },
  { symbol: "USDC", name: "USD Coin", address: MAINNET_TOKENS.USDC, decimals: 7 },
  { symbol: "EURC", name: "Euro Coin", address: MAINNET_TOKENS.EURC, decimals: 7 },
  { symbol: "yUSDC", name: "Blend USDC", address: MAINNET_TOKENS.yUSDC, decimals: 7 },
];

export default function SwapPage() {
  const { connected, address } = useWallet();
  const [fromToken, setFromToken] = useState(TOKENS[0]);
  const [toToken, setToToken] = useState(TOKENS[1]);
  const [fromAmount, setFromAmount] = useState("");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  // Debounced quote fetching
  const fetchQuote = useCallback(async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setQuote(null);
      return;
    }

    setQuoteLoading(true);
    setError(null);

    try {
      const amountIn = parseAmount(fromAmount, fromToken.decimals).toString();

      // Get quote from our API
      const quoteResult = await getSwapQuote(
        fromToken.address,
        toToken.address,
        amountIn
      );
      setQuote(quoteResult);
    } catch (err) {
      console.error("Quote error:", err);
      setError("Unable to fetch quote. Please try using Soroswap directly at app.soroswap.finance");
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [fromAmount, fromToken, toToken]);

  // Fetch quote when inputs change
  useEffect(() => {
    const timer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount("");
    setQuote(null);
  };

  const handleSwap = async () => {
    if (!connected || !address || !quote || !fromAmount) return;

    setLoading(true);
    setError(null);
    setTxStatus("Swap functionality coming soon...");

    // For now, just show that we have the quote
    // Full transaction building would require the Soroswap SDK server-side
    setTimeout(() => {
      setTxStatus(null);
      setLoading(false);
    }, 2000);
  };

  const formattedOutput = quote
    ? formatAmount(quote.amountOut, toToken.decimals)
    : "";

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center">Swap</h1>

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          {/* From Token */}
          <div className="mb-2">
            <label className="text-sm text-gray-400 mb-2 block">From</label>
            <div className="flex gap-2">
              <TokenSelector
                token={fromToken}
                tokens={TOKENS}
                onSelect={(t) => {
                  setFromToken(t);
                  setQuote(null);
                }}
                excludeToken={toToken}
              />
              <input
                type="number"
                placeholder="0.00"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="flex-1 bg-gray-800 rounded-lg px-4 py-3 text-right text-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center -my-2 relative z-10">
            <button
              onClick={handleSwapTokens}
              className="p-2 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors"
            >
              <span className="text-xl">&#x21C5;</span>
            </button>
          </div>

          {/* To Token */}
          <div className="mt-2">
            <label className="text-sm text-gray-400 mb-2 block">To</label>
            <div className="flex gap-2">
              <TokenSelector
                token={toToken}
                tokens={TOKENS}
                onSelect={(t) => {
                  setToToken(t);
                  setQuote(null);
                }}
                excludeToken={fromToken}
              />
              <div className="flex-1 bg-gray-800 rounded-lg px-4 py-3 text-right text-xl font-medium">
                {quoteLoading ? (
                  <span className="text-gray-500 animate-pulse">Loading...</span>
                ) : (
                  <span className={formattedOutput ? "text-white" : "text-gray-500"}>
                    {formattedOutput || "0.00"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quote Info */}
          {quote && fromAmount && (
            <div className="mt-4 p-3 bg-gray-800 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Rate</span>
                <span>
                  1 {fromToken.symbol} ={" "}
                  {(parseFloat(quote.amountOut) / parseFloat(quote.amountIn) || 0).toFixed(6)}{" "}
                  {toToken.symbol}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-400">Price Impact</span>
                <span
                  className={
                    parseFloat(quote.priceImpactPct) > 1
                      ? "text-red-500"
                      : parseFloat(quote.priceImpactPct) > 0.5
                      ? "text-yellow-500"
                      : "text-green-500"
                  }
                >
                  {parseFloat(quote.priceImpactPct).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-400">Route</span>
                <span>{quote.protocols.join(" → ") || "Direct"}</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Transaction Status */}
          {txStatus && (
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 text-sm">
              {txStatus}
            </div>
          )}

          {/* Swap Button */}
          <button
            onClick={handleSwap}
            disabled={!connected || !fromAmount || !quote || loading}
            className="w-full mt-4 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
          >
            {loading
              ? "Processing..."
              : !connected
              ? "Connect Wallet"
              : !fromAmount
              ? "Enter Amount"
              : !quote
              ? "Getting Quote..."
              : "Swap"}
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Swap Aggregation</h2>
          <p className="text-gray-400 text-sm">
            This interface uses the Soroswap aggregator which routes through multiple DEXs
            including Soroswap, Phoenix, Aquarius, and Stellar DEX to find the best rate.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Soroswap", "Phoenix", "Aquarius", "Stellar DEX"].map((dex) => (
              <span
                key={dex}
                className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-400"
              >
                {dex}
              </span>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-gray-500 text-xs">
              For the best swap experience, you can also use{" "}
              <a
                href="https://app.soroswap.finance"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Soroswap directly
              </a>
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
}

function TokenSelector({
  token,
  tokens,
  onSelect,
  excludeToken,
}: {
  token: Token;
  tokens: Token[];
  onSelect: (token: Token) => void;
  excludeToken?: Token;
}) {
  const [open, setOpen] = useState(false);
  const availableTokens = tokens.filter((t) => t.address !== excludeToken?.address);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-gray-800 rounded-lg px-4 py-3 hover:bg-gray-700 transition-colors min-w-32"
      >
        <span className="font-medium">{token.symbol}</span>
        <span className="text-gray-400">&#9660;</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full mt-2 left-0 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50">
            {availableTokens.map((t) => (
              <button
                key={t.address}
                onClick={() => {
                  onSelect(t);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg"
              >
                <div className="text-left">
                  <p className="font-medium">{t.symbol}</p>
                  <p className="text-xs text-gray-400">{t.name}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
