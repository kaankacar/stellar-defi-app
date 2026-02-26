# Stellar DeFi Super App

A unified DeFi interface built on the **Stellar blockchain** and **Soroban smart contracts**, deployed as a fully static site on **GitHub Pages**. The app aggregates multiple DeFi protocols into a single dashboard — swap tokens, lend/borrow assets, and track your positions with live USD prices, all from one place.

**Live:** https://kaankacar.github.io/stellar-defi-app/

---

## Features

| Feature | Status | Description |
|---------|--------|-------------|
| **Swap** | Complete | Route token swaps across Soroswap, Phoenix, Aquarius, and Stellar DEX; protocol selector lets you choose which DEXs to include |
| **Lend / Borrow** | Complete | Supply collateral, borrow assets, withdraw, repay, and monitor health factor via Blend Protocol |
| **Earn** | Complete | Browse yield strategies backed by Blend lending pools with live on-chain APY and TVL |
| **Dashboard** | Complete | Aggregate portfolio view — wallet balances with live USD prices, Blend positions, net portfolio value |

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
| **Soroban RPC** | `https://rpc.ankr.com/stellar_soroban` | Simulate, assemble, submit, and poll Soroban transactions |
| **Horizon API** | `https://horizon.stellar.org` | Fetch account balances and classic Stellar operations |

---

### DeFi Protocols

| Protocol | Contract / Endpoint | Purpose |
|----------|---------------------|---------|
| **Blend Protocol v1** | `CDVQVKOY2YSXS2IC7KN6MNASSHPAO7UN2UR2ON4OI2SKMFJNVAMDX6DP` | Lending and borrowing — supply, borrow, withdraw, repay |
| **Soroswap aggregator** | `api.soroswap.finance` | DEX swap routing — quotes and transaction building |
| **Phoenix** | via Soroswap aggregator | Token swaps via Phoenix DEX |
| **Aquarius** | via Soroswap aggregator | Token swaps via Aquarius AMM |
| **Stellar DEX** | via Soroswap aggregator | Token swaps via the native Stellar DEX (SDEX) |
| **Reflector Oracle** | `CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN` | On-chain USD price feed for XLM and other assets |

All contract addresses verified on-chain via Stellar Expert.

---

### External APIs

| API | URL | Purpose |
|-----|-----|---------|
| **Soroswap Quote API** | `https://api.soroswap.finance/quote?network=mainnet` | Get best-route swap quote across selected DEXs |
| **Soroswap Build API** | `https://api.soroswap.finance/quote/build?network=mainnet` | Build unsigned swap transaction XDR |
| **DefiLlama** | `https://api.llama.fi/protocol/blend` | Blend Protocol TVL and borrow volume for market data |

---

### Supported Tokens (Mainnet)

| Token | Contract Address |
|-------|-----------------|
| XLM | `native` (SAC: `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA`) |
| USDC | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |
| EURC | `CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV` |
| yUSDC | `CDOFW7HNKLUZRLFZST4EW7V3AV4JI5IHMT6BPXXSY2IEFZ4NE5TWU2P4` |
| AQUA | `CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK` |
| BTC | `CAO7DDJNGMOYQPRYDY5JVZ5YEK4UQBSMGLAEWRCUOTRMDSBMGWSAATDZ` |

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
| Testing | Vitest (79 tests) |

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
│   │   ├── dashboard/          # Portfolio overview with live USD prices
│   │   ├── swap/               # Token swap with protocol selector
│   │   ├── lend/               # Lending & borrowing (Blend Protocol)
│   │   ├── earn/               # Yield strategies (Blend pools)
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
│   │   ├── reflector.ts        # Reflector oracle: live USD price queries
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
1. getSwapQuote(tokenIn, tokenOut, amount, slippageBps, protocols)
       → POST api.soroswap.finance/quote   (selected DEXs, EXACT_IN)
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

### USD Prices (Reflector Oracle)

The dashboard fetches live USD prices from the Reflector oracle via Soroban RPC simulation (read-only, no transaction needed). XLM price is queried using `Asset::Other("XLM")`, with 14 decimal places of precision. Stablecoins (USDC, EURC, yUSDC) are treated as $1.00.

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
| Mainnet | `https://rpc.ankr.com/stellar_soroban` | `https://horizon.stellar.org` |
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
npm test                  # run all 79 unit tests
npm run test:watch        # watch mode
npm run test:integration  # real network tests (requires .env.production)
```

79 unit tests across 4 files covering:
- `formatAmount` / `parseAmount` round-trips (blend + soroswap)
- `getSwapQuote`: correct endpoint, request body (including `protocols` array), response mapping, error paths
- `buildSwapTransaction`: passes raw quote data to build endpoint, returns XDR, handles HTTP errors (429, 503)
- DEX aggregation: single/multi/3-hop routes, slippage bps, price impact classification, amount encoding
- Quote → build pipeline: `rawData` is preserved end-to-end
- `getPoolData`: DefiLlama fallback, market shape validation, utilization bounds, empty-state handling

---

## Contributing

Pull requests are welcome. For larger changes please open an issue first.

## License

MIT
