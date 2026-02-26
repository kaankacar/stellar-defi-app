# Stellar DeFi Super App

A unified DeFi interface built on the **Stellar blockchain** and **Soroban smart contracts**, deployed as a fully static site on **GitHub Pages**. The app aggregates multiple DeFi protocols into a single dashboard — swap tokens, lend/borrow assets, and track your positions, all from one place.

**Live:** https://kaankacar.github.io/stellar-defi-app/

---

## Features

| Feature | Status | Description |
|---------|--------|-------------|
| **Swap** | Complete | Route token swaps across Soroswap, Phoenix, Aquarius, and Stellar DEX via the Soroswap aggregator API |
| **Lend / Borrow** | Complete | Supply collateral, borrow assets, withdraw, repay, and monitor health factor via Blend Protocol |
| **Earn** | In progress | Browse yield strategies backed by Blend lending pools |
| **Dashboard** | Complete | Aggregate portfolio view — wallet balances, positions, net APY |

---

## Integrations

### Wallets

| Integration | Package | Purpose |
|-------------|---------|---------|
| **Stellar Wallets Kit** | `@creit.tech/stellar-wallets-kit` | Wallet abstraction layer supporting Freighter and other Stellar wallets |
| **Freighter API** | `@stellar/freighter-api` | Direct Freighter browser extension connector |

Wallet state (address, wallet type) is persisted in `localStorage` and managed via a React Context (`WalletContext`).

---

### Stellar Network

| Integration | URL | Purpose |
|-------------|-----|---------|
| **Soroban RPC** | `https://soroban.stellar.org` | Simulate, assemble, submit, and poll Soroban transactions |
| **Horizon API** | `https://horizon.stellar.org` | Fetch account balances and classic Stellar operations |

---

### DeFi Protocols

| Protocol | Contract Address | Purpose |
|----------|-----------------|---------|
| **Blend Protocol** | `CDVQVKOY2YSXS2IC7KN6MNASSHPAO7UN2UR2ON4OI2SKMFJNVAMDX6DP` | Lending and borrowing — supply, borrow, withdraw, repay |
| **Soroswap aggregator** | `api.soroswap.finance` | DEX swap routing — quotes and transaction building |
| **Phoenix** | via Soroswap aggregator | Token swaps via Phoenix DEX |
| **Aquarius** | via Soroswap aggregator | Token swaps via Aquarius AMM |
| **Stellar DEX** | via Soroswap aggregator | Token swaps via the native Stellar DEX (SDEX) |

---

### External APIs

| API | URL | Purpose |
|-----|-----|---------|
| **Soroswap Quote API** | `https://api.soroswap.finance/quote?network=mainnet` | Get best-route swap quote across all DEXs |
| **Soroswap Build API** | `https://api.soroswap.finance/quote/build?network=mainnet` | Build unsigned swap transaction XDR |
| **DefiLlama** | `https://api.llama.fi/protocol/blend` | Blend Protocol TVL and borrow volume for market data |

---

### Supported Tokens (Mainnet)

| Token | Contract Address |
|-------|-----------------|
| XLM | `native` |
| USDC | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |
| EURC | `CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV` |
| yUSDC | `CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YBVMCMTYF3DQLVVQ6M5P7` |
| AQUA | `GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA` |
| BTC | `CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4` |
| ETH | `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, static export) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| State | React Context API |
| Blockchain SDK | `@stellar/stellar-sdk` |
| Wallet Layer | `@creit.tech/stellar-wallets-kit` |
| Deployment | GitHub Actions → GitHub Pages |
| Testing | Vitest |

---

## Project Structure

```
stellar-defi-app/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions: build + deploy to Pages
├── src/
│   ├── app/
│   │   ├── page.tsx            # Landing page
│   │   ├── layout.tsx          # Root layout (WalletProvider)
│   │   ├── dashboard/          # Portfolio overview
│   │   ├── swap/               # Token swap (Soroswap aggregator)
│   │   ├── lend/               # Lending & borrowing (Blend Protocol)
│   │   ├── earn/               # Yield strategies
│   │   └── docs/               # Developer reference
│   ├── components/
│   │   ├── AppLayout.tsx
│   │   ├── ConnectButton.tsx
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   ├── contexts/
│   │   └── WalletContext.tsx   # Global wallet state
│   ├── lib/
│   │   ├── stellar.ts          # Network config, RPC & Horizon clients
│   │   ├── soroswap.ts         # Soroswap aggregator API integration
│   │   ├── blend.ts            # Blend Protocol transaction builders
│   │   └── contracts.ts        # Generic contract helpers
│   └── __tests__/
│       ├── soroswap.test.ts    # Unit tests: utilities + Soroswap API
│       ├── swapFlow.test.ts    # Integration tests: quote→build pipeline
│       ├── dexAggregation.test.ts  # DEX routing, slippage, edge cases
│       └── blend.test.ts       # Blend utilities + pool data
├── .env.production             # NEXT_PUBLIC_STELLAR_NETWORK=mainnet
├── next.config.mjs             # Static export, basePath for GitHub Pages
└── vitest.config.ts
```

---

## How It Works

### Swap Flow

```
1. getSwapQuote(tokenIn, tokenOut, amount)
       → POST api.soroswap.finance/quote   (all 4 DEXs, EXACT_IN)
       → returns quote with amountOut, priceImpact, route, rawData

2. buildSwapTransaction(quote, walletAddress)
       → POST api.soroswap.finance/quote/build
       → returns unsigned XDR

3. signTransaction(xdr)          via Freighter (WalletContext)
       → returns signed XDR

4. submitTransaction(signedXdr)  via Soroban RPC
       → polls until confirmed, returns status
```

### Lending Flow (Blend Protocol)

```
1. buildSupplyTransaction / buildBorrowTransaction
   buildWithdrawTransaction / buildRepayTransaction
       → Build Soroban contract call XDR
       → Simulate + assemble with resource data

2. signTransaction(xdr)          via Freighter

3. submitBlendTransaction(xdr)   via Soroban RPC
```

### Blend RequestTypes

| Action | RequestType |
|--------|-------------|
| Supply collateral | `0` |
| Withdraw collateral | `1` |
| Borrow | `4` |
| Repay | `5` |

---

## Getting Started

### Prerequisites

- Node.js 20+
- [Freighter](https://www.freighter.app/) wallet browser extension (set to **Mainnet**)

### Local Development

```bash
git clone https://github.com/kaankacar/stellar-defi-app
cd stellar-defi-app
npm install
npm run dev
```

Open http://localhost:3000. The dev server defaults to testnet unless you set:

```bash
NEXT_PUBLIC_STELLAR_NETWORK=mainnet npm run dev
```

### Production Build

```bash
npm run build        # outputs to ./out (uses .env.production → mainnet)
```

### Network Config

| Network | Soroban RPC | Horizon |
|---------|------------|---------|
| Mainnet | `https://soroban.stellar.org` | `https://horizon.stellar.org` |
| Testnet | `https://soroban-testnet.stellar.org` | `https://horizon-testnet.stellar.org` |
| Local | `http://localhost:8000/soroban/rpc` | `http://localhost:8000` |

Set via `NEXT_PUBLIC_STELLAR_NETWORK=mainnet|testnet|local`.

---

## Deployment

The app is automatically deployed to GitHub Pages on every push to `main`.

**One-time setup** (already done):
1. In repo settings: **Settings → Pages → Source → GitHub Actions**
2. The workflow (`.github/workflows/deploy.yml`) handles everything else

The workflow:
- Builds with `NEXT_PUBLIC_STELLAR_NETWORK=mainnet`
- Uploads `./out` as a GitHub Pages artifact
- Deploys to https://kaankacar.github.io/stellar-defi-app/

---

## Testing

```bash
npm test           # run all tests once
npm run test:watch # watch mode
```

43+ tests covering:
- `formatAmount` / `parseAmount` round-trips
- `getSwapQuote`: correct endpoint, request body (assetIn/assetOut, EXACT_IN, 4 protocols), response mapping, error paths
- `buildSwapTransaction`: passes raw quote data to build endpoint, returns XDR, error paths
- DEX aggregation: multi-hop routing, slippage bps, price impact classification, edge cases
- `getPoolData`: DefiLlama fallback, market shape validation, empty-state handling

---

## Contributing

Pull requests are welcome. For larger changes please open an issue first.

## License

MIT
