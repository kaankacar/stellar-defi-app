"use client";

import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";

const sections = [
  { id: "getting-started", title: "Getting Started" },
  { id: "sdk", title: "SDK Usage" },
  { id: "contracts", title: "Contract Architecture" },
  { id: "adapters", title: "Adding Adapters" },
  { id: "strategies", title: "Creating Strategies" },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("getting-started");

  return (
    <AppLayout>
      <div className="flex gap-8">
        {/* Sidebar Navigation */}
        <aside className="w-48 flex-shrink-0">
          <nav className="sticky top-6 space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeSection === section.id
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`}
              >
                {section.title}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 max-w-3xl">
          <h1 className="text-3xl font-bold mb-8">Developer Documentation</h1>

          {activeSection === "getting-started" && <GettingStarted />}
          {activeSection === "sdk" && <SdkUsage />}
          {activeSection === "contracts" && <ContractArchitecture />}
          {activeSection === "adapters" && <AddingAdapters />}
          {activeSection === "strategies" && <CreatingStrategies />}
        </main>
      </div>
    </AppLayout>
  );
}

function GettingStarted() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">Getting Started</h2>

      <div className="prose prose-invert max-w-none">
        <p className="text-gray-300">
          The Stellar DeFi Hub provides a unified interface for interacting with multiple
          DeFi protocols on Stellar/Soroban. This guide will help you integrate with our
          contracts and SDK.
        </p>

        <h3 className="text-xl font-semibold mt-6 mb-3">Installation</h3>
        <CodeBlock language="bash">{`npm install @stellar-defi-hub/sdk @stellar/stellar-sdk`}</CodeBlock>

        <h3 className="text-xl font-semibold mt-6 mb-3">Quick Start</h3>
        <CodeBlock language="typescript">{`import { DeFiHubClient } from '@stellar-defi-hub/sdk';

// Initialize with testnet contracts
const client = new DeFiHubClient('testnet', {
  router: 'CABC...',
  registry: 'CDEF...',
  swapAggregator: 'CGHI...',
  // ... see deployments/testnet.json for addresses
});

// Get best swap rate
const quotes = await client.getSwapQuotes(
  xlmAddress,
  usdcAddress,
  BigInt(1000_0000000)
);

console.log('Best rate via:', quotes.bestQuote.dexName);`}</CodeBlock>

        <h3 className="text-xl font-semibold mt-6 mb-3">Contract Addresses</h3>
        <p className="text-gray-300">
          After deployment, contract addresses are stored in <code className="bg-gray-800 px-1 rounded">deployments/testnet.json</code>.
          Load these into your app via environment variables or import directly.
        </p>
      </div>
    </section>
  );
}

function SdkUsage() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">SDK Usage</h2>

      <div className="prose prose-invert max-w-none">
        <h3 className="text-xl font-semibold mt-6 mb-3">Swap Aggregation</h3>
        <p className="text-gray-300">
          Get the best swap rates across Soroswap, Phoenix, and Aquarius DEXs:
        </p>
        <CodeBlock language="typescript">{`// Get quotes from all DEXs
const quotes = await client.getSwapQuotes(tokenIn, tokenOut, amount);

// Build and sign swap transaction
const tx = await client.buildSwapTransaction(
  userAddress,
  tokenIn,
  tokenOut,
  amountIn,
  minAmountOut
);
const signedXdr = await wallet.signTransaction(tx.toXDR());
const result = await client.submitTransaction(signedXdr);`}</CodeBlock>

        <h3 className="text-xl font-semibold mt-6 mb-3">Lending & Borrowing</h3>
        <CodeBlock language="typescript">{`// Check position
const position = await client.getLendingPosition(userAddress);
console.log('Health Factor:', position.healthFactor / 10000);

// Supply collateral
const supplyTx = await client.buildSupplyTransaction(
  userAddress, asset, amount
);

// Borrow against collateral
const borrowTx = await client.buildBorrowTransaction(
  userAddress, asset, amount
);`}</CodeBlock>

        <h3 className="text-xl font-semibold mt-6 mb-3">Yield Strategies</h3>
        <CodeBlock language="typescript">{`// List strategies
const strategies = await client.getStrategies();

// Deposit into yield optimizer
const tx = await client.buildYieldDepositTransaction(
  userAddress, asset, amount
);

// Open leveraged position
const leverageTx = await client.buildLeveragePositionTransaction(
  userAddress,
  collateralAsset,
  collateralAmount,
  borrowAsset,
  20000 // 2x leverage
);`}</CodeBlock>
      </div>
    </section>
  );
}

function ContractArchitecture() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">Contract Architecture</h2>

      <div className="prose prose-invert max-w-none">
        <p className="text-gray-300">
          The DeFi Hub uses a modular architecture with protocol adapters and a central router.
        </p>

        <div className="bg-gray-800 p-4 rounded-lg my-6 font-mono text-sm">
          <pre>{`┌─────────────────────────────────────────┐
│              Router Contract             │
│  - execute_single(adapter, action, ...) │
│  - execute_batch(steps[])               │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐
│ Blend  │ │Soroswap│ │Phoenix │
│Adapter │ │Adapter │ │Adapter │
└────────┘ └────────┘ └────────┘`}</pre>
        </div>

        <h3 className="text-xl font-semibold mt-6 mb-3">Core Contracts</h3>
        <ul className="list-disc list-inside text-gray-300 space-y-2">
          <li><strong>Router</strong>: Entry point for all actions, supports batching</li>
          <li><strong>Registry</strong>: Stores strategy metadata and addresses</li>
          <li><strong>SwapAggregator</strong>: Queries DEXs and routes to best price</li>
          <li><strong>Oracle</strong>: Provides price feeds from Reflector</li>
        </ul>

        <h3 className="text-xl font-semibold mt-6 mb-3">IAdapter Interface</h3>
        <p className="text-gray-300">All protocol adapters implement a common interface:</p>
        <CodeBlock language="rust">{`pub trait IAdapter {
    fn deposit(env: Env, user: Address, asset: Address, amount: i128)
        -> Result<i128, AdapterError>;

    fn withdraw(env: Env, user: Address, asset: Address, amount: i128)
        -> Result<i128, AdapterError>;

    fn get_position(env: Env, user: Address) -> Position;
}`}</CodeBlock>
      </div>
    </section>
  );
}

function AddingAdapters() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">Adding New Adapters</h2>

      <div className="prose prose-invert max-w-none">
        <p className="text-gray-300">
          To integrate a new protocol, create an adapter contract that implements
          the IAdapter interface.
        </p>

        <h3 className="text-xl font-semibold mt-6 mb-3">Step 1: Create Crate</h3>
        <CodeBlock language="bash">{`mkdir contracts/adapters/myprotocol
cd contracts/adapters/myprotocol
cargo init --lib`}</CodeBlock>

        <h3 className="text-xl font-semibold mt-6 mb-3">Step 2: Implement Contract</h3>
        <CodeBlock language="rust">{`#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env};
use defi_hub_core::{AdapterError, Position};

#[contract]
pub struct MyProtocolAdapter;

#[contractimpl]
impl MyProtocolAdapter {
    pub fn initialize(env: Env, admin: Address, protocol_address: Address) {
        // Store config
    }

    pub fn deposit(
        env: Env,
        user: Address,
        asset: Address,
        amount: i128
    ) -> Result<i128, AdapterError> {
        user.require_auth();
        // Call underlying protocol
        // Emit event
        Ok(amount)
    }

    pub fn withdraw(
        env: Env,
        user: Address,
        asset: Address,
        amount: i128
    ) -> Result<i128, AdapterError> {
        user.require_auth();
        // Call underlying protocol
        Ok(amount)
    }

    pub fn get_position(env: Env, user: Address) -> Position {
        // Query protocol for user's position
        Position { supplied: 0, borrowed: 0, collateral: 0, health_factor: 0 }
    }
}`}</CodeBlock>

        <h3 className="text-xl font-semibold mt-6 mb-3">Step 3: Register with Router</h3>
        <CodeBlock language="bash">{`stellar contract invoke --id $ROUTER_ID -- \\
  register_adapter --name "MyProtocol" --address $ADAPTER_ID`}</CodeBlock>
      </div>
    </section>
  );
}

function CreatingStrategies() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">Creating Strategies</h2>

      <div className="prose prose-invert max-w-none">
        <p className="text-gray-300">
          Strategies compose multiple adapter calls into single transactions for
          users seeking automated DeFi positions.
        </p>

        <h3 className="text-xl font-semibold mt-6 mb-3">Strategy Pattern</h3>
        <CodeBlock language="rust">{`#[contract]
pub struct MyStrategy;

#[contractimpl]
impl MyStrategy {
    pub fn deposit(
        env: Env,
        user: Address,
        asset: Address,
        amount: i128,
    ) -> Result<DepositResult, AdapterError> {
        user.require_auth();

        // 1. Find best yield source
        let best_protocol = find_best_yield(&env);

        // 2. Call protocol adapter
        let adapter_client = BlendAdapterClient::new(&env, &blend_address);
        adapter_client.deposit(&user, &asset, &amount)?;

        // 3. Track user allocation
        store_allocation(&env, &user, &best_protocol, amount);

        // 4. Emit event
        env.events().publish(("deposit", user), (asset, amount));

        Ok(DepositResult { ... })
    }
}`}</CodeBlock>

        <h3 className="text-xl font-semibold mt-6 mb-3">Register Strategy</h3>
        <CodeBlock language="bash">{`stellar contract invoke --id $REGISTRY_ID -- \\
  register_strategy \\
    --name "MyStrategy" \\
    --description "Automated yield optimization" \\
    --risk_level 2 \\
    --contract_address $STRATEGY_ID`}</CodeBlock>
      </div>
    </section>
  );
}

function CodeBlock({ children, language }: { children: string; language: string }) {
  return (
    <pre className="bg-gray-800 p-4 rounded-lg overflow-x-auto">
      <code className={`language-${language} text-sm`}>{children}</code>
    </pre>
  );
}
