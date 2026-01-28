"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import * as contracts from "@/lib/contracts";

export interface TransactionState {
  status: "idle" | "building" | "signing" | "submitting" | "success" | "error";
  txHash?: string;
  error?: string;
}

export function useContracts() {
  const { address, signTransaction, connected } = useWallet();
  const [txState, setTxState] = useState<TransactionState>({ status: "idle" });

  const executeTransaction = useCallback(
    async (buildTx: () => Promise<{ toXDR(): string }>) => {
      if (!connected || !address) {
        setTxState({ status: "error", error: "Wallet not connected" });
        return null;
      }

      try {
        setTxState({ status: "building" });
        const tx = await buildTx();

        setTxState({ status: "signing" });
        const signedXdr = await signTransaction(tx.toXDR());

        setTxState({ status: "submitting" });
        const result = await contracts.submitTransaction(signedXdr);

        if (result.status === "SUCCESS") {
          setTxState({ status: "success", txHash: result.txHash });
          return result;
        } else {
          setTxState({ status: "error", error: "Transaction failed" });
          return null;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setTxState({ status: "error", error: message });
        return null;
      }
    },
    [address, connected, signTransaction]
  );

  const resetState = useCallback(() => {
    setTxState({ status: "idle" });
  }, []);

  // Swap functions
  const swap = useCallback(
    async (tokenIn: string, tokenOut: string, amountIn: bigint, minAmountOut: bigint) => {
      if (!address) return null;
      return executeTransaction(() =>
        contracts.SwapAggregatorContract.swap(address, tokenIn, tokenOut, amountIn, minAmountOut)
      );
    },
    [address, executeTransaction]
  );

  // Lending functions
  const deposit = useCallback(
    async (asset: string, amount: bigint) => {
      if (!address) return null;
      return executeTransaction(() =>
        contracts.BlendAdapterContract.deposit(address, asset, amount)
      );
    },
    [address, executeTransaction]
  );

  const withdraw = useCallback(
    async (asset: string, amount: bigint) => {
      if (!address) return null;
      return executeTransaction(() =>
        contracts.BlendAdapterContract.withdraw(address, asset, amount)
      );
    },
    [address, executeTransaction]
  );

  const borrow = useCallback(
    async (asset: string, amount: bigint) => {
      if (!address) return null;
      return executeTransaction(() =>
        contracts.BlendAdapterContract.borrow(address, asset, amount)
      );
    },
    [address, executeTransaction]
  );

  const repay = useCallback(
    async (asset: string, amount: bigint) => {
      if (!address) return null;
      return executeTransaction(() =>
        contracts.BlendAdapterContract.repay(address, asset, amount)
      );
    },
    [address, executeTransaction]
  );

  // Strategy functions
  const depositToStrategy = useCallback(
    async (asset: string, amount: bigint) => {
      if (!address) return null;
      return executeTransaction(() =>
        contracts.YieldStrategyContract.deposit(address, asset, amount)
      );
    },
    [address, executeTransaction]
  );

  const withdrawFromStrategy = useCallback(
    async (asset: string, amount: bigint) => {
      if (!address) return null;
      return executeTransaction(() =>
        contracts.YieldStrategyContract.withdraw(address, asset, amount)
      );
    },
    [address, executeTransaction]
  );

  return {
    txState,
    resetState,
    swap,
    deposit,
    withdraw,
    borrow,
    repay,
    depositToStrategy,
    withdrawFromStrategy,
    isConnected: connected,
  };
}
