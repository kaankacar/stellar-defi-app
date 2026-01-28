"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
  ISupportedWallet,
} from "@creit.tech/stellar-wallets-kit";
import { config } from "@/lib/stellar";

export interface WalletState {
  address: string | null;
  connected: boolean;
  walletType: string | null;
  network: WalletNetwork;
}

export interface WalletContextType extends WalletState {
  connect: (walletId?: string) => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<string>;
  kit: StellarWalletsKit | null;
  availableWallets: ISupportedWallet[];
  isLoading: boolean;
  error: string | null;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [kit, setKit] = useState<StellarWalletsKit | null>(null);
  const [state, setState] = useState<WalletState>({
    address: null,
    connected: false,
    walletType: null,
    network: config.networkPassphrase.includes("Test")
      ? WalletNetwork.TESTNET
      : WalletNetwork.PUBLIC,
  });
  const [availableWallets, setAvailableWallets] = useState<ISupportedWallet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize wallet kit on mount
  useEffect(() => {
    const initKit = async () => {
      try {
        const stellarKit = new StellarWalletsKit({
          network: state.network,
          selectedWalletId: FREIGHTER_ID,
          modules: allowAllModules(),
        });
        setKit(stellarKit);

        // Get available wallets
        const wallets = await stellarKit.getSupportedWallets();
        setAvailableWallets(wallets);

        // Check for existing connection in localStorage
        const savedAddress = localStorage.getItem("stellar_address");
        const savedWalletType = localStorage.getItem("stellar_wallet_type");
        if (savedAddress && savedWalletType) {
          setState((prev) => ({
            ...prev,
            address: savedAddress,
            connected: true,
            walletType: savedWalletType,
          }));
        }
      } catch (err) {
        console.error("Failed to initialize wallet kit:", err);
      }
    };

    initKit();
  }, [state.network]);

  const connect = useCallback(
    async (walletId: string = FREIGHTER_ID) => {
      if (!kit) {
        setError("Wallet kit not initialized");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        kit.setWallet(walletId);
        const { address } = await kit.getAddress();

        setState((prev) => ({
          ...prev,
          address,
          connected: true,
          walletType: walletId,
        }));

        // Persist connection
        localStorage.setItem("stellar_address", address);
        localStorage.setItem("stellar_wallet_type", walletId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to connect wallet";
        setError(message);
        console.error("Wallet connection error:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [kit]
  );

  const disconnect = useCallback(() => {
    setState({
      address: null,
      connected: false,
      walletType: null,
      network: state.network,
    });
    localStorage.removeItem("stellar_address");
    localStorage.removeItem("stellar_wallet_type");
    setError(null);
  }, [state.network]);

  const signTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      if (!kit || !state.connected) {
        throw new Error("Wallet not connected");
      }

      const { signedTxXdr } = await kit.signTransaction(xdr, {
        networkPassphrase: config.networkPassphrase,
        address: state.address!,
      });

      return signedTxXdr;
    },
    [kit, state.connected, state.address]
  );

  return (
    <WalletContext.Provider
      value={{
        ...state,
        connect,
        disconnect,
        signTransaction,
        kit,
        availableWallets,
        isLoading,
        error,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
