"use client";

import { TransactionState } from "@/lib/hooks/useContracts";

interface TransactionModalProps {
  state: TransactionState;
  onClose: () => void;
  title?: string;
}

export function TransactionModal({ state, onClose, title = "Transaction" }: TransactionModalProps) {
  if (state.status === "idle") return null;

  const getStatusContent = () => {
    switch (state.status) {
      case "building":
        return {
          icon: "🔨",
          title: "Building Transaction",
          description: "Preparing your transaction...",
          showSpinner: true,
        };
      case "signing":
        return {
          icon: "✍️",
          title: "Awaiting Signature",
          description: "Please sign the transaction in your wallet",
          showSpinner: true,
        };
      case "submitting":
        return {
          icon: "📤",
          title: "Submitting Transaction",
          description: "Broadcasting to the Stellar network...",
          showSpinner: true,
        };
      case "success":
        return {
          icon: "✅",
          title: "Transaction Successful!",
          description: "Your transaction has been confirmed",
          showSpinner: false,
        };
      case "error":
        return {
          icon: "❌",
          title: "Transaction Failed",
          description: state.error || "Something went wrong",
          showSpinner: false,
        };
      default:
        return {
          icon: "⏳",
          title: "Processing",
          description: "Please wait...",
          showSpinner: true,
        };
    }
  };

  const content = getStatusContent();
  const canClose = state.status === "success" || state.status === "error";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-sm border border-gray-800 text-center">
        {/* Close button */}
        {canClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white"
          >
            ✕
          </button>
        )}

        {/* Icon */}
        <div className="text-5xl mb-4">{content.icon}</div>

        {/* Spinner */}
        {content.showSpinner && (
          <div className="mb-4">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {/* Title */}
        <h2 className="text-xl font-bold mb-2">{title}</h2>
        <p className="text-lg font-medium text-gray-300">{content.title}</p>
        <p className="text-sm text-gray-400 mt-1">{content.description}</p>

        {/* Transaction Hash */}
        {state.txHash && (
          <div className="mt-4 p-3 bg-gray-800 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Transaction Hash</p>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${state.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm font-mono break-all"
            >
              {state.txHash.slice(0, 16)}...{state.txHash.slice(-16)}
            </a>
          </div>
        )}

        {/* Action Buttons */}
        {canClose && (
          <div className="mt-6">
            <button
              onClick={onClose}
              className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                state.status === "success"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              {state.status === "success" ? "Done" : "Close"}
            </button>

            {state.status === "error" && (
              <button
                onClick={onClose}
                className="w-full mt-2 py-2 text-blue-400 hover:text-blue-300"
              >
                Try Again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
