# Stellar DeFi Super App

A unified DeFi interface built on the **Stellar blockchain** and **Soroban smart contracts**. The app aggregates multiple DeFi protocols into a single dashboard, letting users swap tokens, lend and borrow assets, and track yield strategies — all from one place.

---

## Features

| Feature | Description |
|---------|-------------|
| **Swap** | Route token swaps across multiple DEXs via a swap aggregator |
| **Lend / Borrow** | Supply collateral, borrow assets, and monitor health factor via Blend Protocol |
| **Earn** | Browse yield strategies backed by Blend lending pools and DeFindex vaults |
| **Dashboard** | Aggregate portfolio view — wallet balances, supplied/borrowed positions, net APY |

---

## Integrations

### Wallets

| Integration | Package | Purpose |
|-------------|---------|---------|
| **Stellar Wallets Kit** | `@creit.tech/stellar-wallets-kit@^1.3.0` | Wallet abstraction layer supporting Freighter and other Stellar wallets |
| **Freighter API** | `@stellar/freighter-api@^6.0.1` | Direct Freighter browser extension connector |

Wallet state (address, wallet type) is persisted in `localStorage` and managed via a React Context (`WalletContext`).

---

### Stellar Network

| Integration | Package / URL | Purpose |
|-------------|--------------|---------|
| **Stellar SDK** | `@stellar/stellar-sdk@^13.3.0` | Core SDK for transaction building, account management, and Soroban contract calls |
| **Soroban RPC** | `https://soroban.stellar.org` (mainnet) / `https://soroban-testnet.stellar.org` (testnet) | Simulate, assemble, submit, and poll Soroban transactions |
| **Horizon API** | `https://horizon.stellar.org` (mainnet) / `https://horizon-testnet.stellar.org` (testnet) | Fetch account balances and classic Stellar operations |

---

### DeFi Protocols

| Protocol | Contract Address | Integration File | Purpose |
|----------|-----------------|-----------------|---------|
| **Blend Protocol** | `CDVQVKOY2YSXS2IC7KN6MNASSHPAO7UN2UR2ON4OI2SKMFJNVAMDX6DP` | `src/lib/blend.ts` | Lending and borrowing — supply, borrow, withdraw, repay |
| **Soroswap** | Router: `CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH` | `src/lib/soroswap.ts` | DEX swap routing and quote aggregation |
| **Aquarius AMM** | Router: `CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK` | via aggregator | Token swaps via Aquarius liquidity pools |
| **Phoenix** | via aggregator | via aggregator | Token swaps via Phoenix DEX |
| **DeFindex** | Factory: `CDKFHFJIET3A73A2YN4KV7NSV32S6YGQMUFH3DNJXLBWL4SKEGVRNFKI` | `src/lib/defindex.ts` | Yield vaults (integration in progress) |
| **Reflector Oracle** | `CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN` | `src/lib/contracts.ts` | On-chain price feeds for collateral valuation |

---

### External Data APIs

| API | URL | Purpose |
|-----|-----|---------|
| **DefiLlama** | `https://api.llama.fi/protocol/blend` | Fetches Blend Protocol TVL and borrowed volume for market data |

---

### Supported Tokens (Mainnet)

| Token | Contract Address |
|-------|-----------------|
| XLM | native |
| USDC | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |
| EURC | `CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV` |
| yUSDC | `CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YBVMCMTYF3DQLVVQ6M5P7` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| State Management | React Context API + custom hooks |
| Blockchain SDK | `@stellar/stellar-sdk` |
| Wallet Layer | `@creit.tech/stellar-wallets-kit` |
| Build | Static export (`next export`) |

---

## Project Structure

```
stellar-defi-app/
├── src/
│   ├── app/
│   │   ├── page.tsx            # Landing page
│   │   ├── layout.tsx          # Root layout (WalletProvider)
│   │   ├── dashboard/          # Portfolio overview
│   │   ├── swap/               # Token swap interface
│   │   ├── lend/               # Lending & borrowing UI
│   │   ├── earn/               # Yield strategies
│   │   └── docs/               # Developer reference
│   ├── components/
│   │   ├── AppLayout.tsx       # Main layout shell
│   │   ├── ConnectButton.tsx   # Wallet connect/disconnect
│   │   ├── Header.tsx          # Top navigation
│   │   ├── Sidebar.tsx         # Side navigation
│   │   ├── PositionCard.tsx    # DeFi position card
│   │   ├── TransactionModal.tsx
│   │   └── TransactionHistory.tsx
│   ├── contexts/
│   │   └── WalletContext.tsx   # Global wallet state
│   └── lib/
│       ├── stellar.ts          # Network config, RPC & Horizon setup
│       ├── contracts.ts        # Generic Soroban contract helpers
│       ├── soroswap.ts         # Soroswap SDK wrapper & quote logic
│       ├── blend.ts            # Blend Protocol adapter
│       ├── defindex.ts         # DeFindex vault adapter (WIP)
│       └── hooks/
│           └── useContracts.ts # React hook for all contract interactions
├── .env.example
├── next.config.mjs
└── tailwind.config.ts
```

---

## How It Works

### Transaction Flow (Soroban)

Every on-chain action follows this standard flow:

```
1. Build transaction   →  TransactionBuilder + contract.call()
2. Simulate            →  rpc.simulateTransaction()  (estimate resources/fees)
3. Assemble            →  rpc.assembleTransaction()  (attach resource data)
4. Sign                →  wallet.signTransaction(xdr)
5. Submit              →  rpc.sendTransaction()
6. Poll                →  rpc.getTransaction(hash) until confirmed
```

### Lending Operations (Blend Protocol)

| Action | Blend RequestType |
|--------|-----------------|
| Supply collateral | `0` |
| Withdraw collateral | `1` |
| Borrow | `4` |
| Repay | `5` |

### Swap Routing

1. `getSwapQuote(tokenIn, tokenOut, amountIn)` — queries the Soroswap aggregator API
2. Quote returns expected output, price impact %, and route (which DEXs are used)
3. `buildSwapTransaction()` — creates the Soroban XDR for the swap
4. Transaction is signed and submitted via the user's connected wallet

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Stellar-compatible wallet browser extension (e.g., [Freighter](https://www.freighter.app/))

### Install & Run

```bash
git clone https://github.com/kaankacar/stellar-defi-app
cd stellar-defi-app
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
# Network: testnet | mainnet
NEXT_PUBLIC_STELLAR_NETWORK=testnet

# Core Hub Contracts (deploy your own or use existing addresses)
NEXT_PUBLIC_ROUTER_CONTRACT=
NEXT_PUBLIC_REGISTRY_CONTRACT=
NEXT_PUBLIC_AGGREGATOR_CONTRACT=
NEXT_PUBLIC_ORACLE_CONTRACT=

# Protocol Adapter Contracts
NEXT_PUBLIC_BLEND_ADAPTER=
NEXT_PUBLIC_SOROSWAP_ADAPTER=
NEXT_PUBLIC_AQUARIUS_ADAPTER=
NEXT_PUBLIC_DEFINDEX_ADAPTER=
NEXT_PUBLIC_PHOENIX_ADAPTER=
NEXT_PUBLIC_ORBIT_ADAPTER=

# Strategy Contracts
NEXT_PUBLIC_YIELD_STRATEGY=
NEXT_PUBLIC_LEVERAGE_STRATEGY=
NEXT_PUBLIC_LPZAP_STRATEGY=
```

### Network Endpoints (pre-configured)

| Network | Soroban RPC | Horizon |
|---------|------------|---------|
| Mainnet | `https://soroban.stellar.org` | `https://horizon.stellar.org` |
| Testnet | `https://soroban-testnet.stellar.org` | `https://horizon-testnet.stellar.org` |
| Local | `http://localhost:8000/soroban/rpc` | `http://localhost:8000` |

---

## Current Status

| Feature | Status |
|---------|--------|
| Wallet connection (Freighter + others) | Complete |
| Portfolio dashboard | Complete |
| Blend lending / borrowing | Complete |
| Swap quote fetching (Soroswap) | Complete |
| Swap transaction execution | In progress |
| DeFindex yield vaults | In progress |
| Orbit Protocol adapter | Planned |
| Phoenix Protocol adapter | Planned |

---

## Contributing

Pull requests are welcome. For larger changes please open an issue first to discuss your proposed approach.

## License

MIT
