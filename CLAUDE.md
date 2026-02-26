# CLAUDE.md — Stellar DeFi Super App

Project context and hard-won knowledge for Claude Code. Read this before making changes.

---

## Project Overview

Next.js static export deployed to GitHub Pages. Aggregates Stellar DeFi protocols (Soroswap, Blend, Reflector) into a single interface for swapping, lending/borrowing, and yield strategies.

- **Repo:** https://github.com/kaankacar/stellar-defi-app
- **Live:** https://kaankacar.github.io/stellar-defi-app/
- **Local:** `/Users/kaan/defisuper`
- **Network:** Stellar mainnet (`NEXT_PUBLIC_STELLAR_NETWORK=mainnet` in `.env.production`)

---

## Architecture

```
Next.js App Router  →  static export (output: 'export')
   ↓
src/lib/          ←  all blockchain/API logic (no React)
src/app/          ←  page components (use client)
src/contexts/     ←  WalletContext (wallet state)
src/components/   ←  shared UI
src/__tests__/    ←  vitest unit tests
```

**Key constraint:** `output: 'export'` means no server-side rendering, no API routes, no dynamic routes. Everything runs in the browser.

---

## basePath Gotcha (Critical)

```javascript
// next.config.mjs
basePath: process.env.NODE_ENV === 'production' ? '/stellar-defi-app' : '',
```

In production, `basePath = '/stellar-defi-app'`. This means:

- **Always use `<Link href="/swap">` from `"next/link"`, never `<a href="/swap">`.**
- Raw `<a>` tags ignore basePath and will navigate to `kaankacar.github.io/swap` (404) instead of `kaankacar.github.io/stellar-defi-app/swap`.
- Next.js `<Link>` and `useRouter` automatically prepend basePath.
- External links (e.g. `href="https://..."`) are fine as plain `<a>` tags.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/stellar.ts` | RPC + Horizon clients, `submitTransaction()`, `config`, `rpc`, `horizon` exports |
| `src/lib/soroswap.ts` | Soroswap aggregator API: `getSwapQuote()`, `buildSwapTransaction()`, `formatAmount()`, `parseAmount()` |
| `src/lib/blend.ts` | Blend Protocol: `getPoolData()`, `getUserPositions()`, `buildSupplyTransaction()`, etc. |
| `src/lib/reflector.ts` | Reflector oracle: `getTokenPrices()` — live USD prices via Soroban RPC simulation |
| `src/lib/contracts.ts` | Contract addresses + generic helpers (`invokeContract`, `i128ToScVal`, etc.) |
| `src/lib/defindex.ts` | DeFindex vault integration (vaults + user positions) |
| `src/contexts/WalletContext.tsx` | Global wallet state: `address`, `connected`, `signTransaction()` |
| `src/app/dashboard/page.tsx` | Portfolio overview — balances, USD values, Blend positions, Quick Actions |
| `src/app/swap/page.tsx` | Token swap — Soroswap aggregator with protocol selector |
| `src/app/lend/page.tsx` | Lend / borrow — Blend Protocol UI |
| `src/app/earn/page.tsx` | Yield strategies — Blend pool cards |
| `.env.production` | `NEXT_PUBLIC_STELLAR_NETWORK=mainnet`, `NEXT_PUBLIC_SOROSWAP_API_KEY` |
| `next.config.mjs` | `output: 'export'`, basePath, assetPrefix |
| `.github/workflows/deploy.yml` | GitHub Actions: build → GitHub Pages |

---

## Soroban RPC

**Working mainnet endpoint:** `https://rpc.ankr.com/stellar_soroban`

`https://soroban.stellar.org` redirects to Stellar docs — it is **not** a valid RPC endpoint. Never use it.

Used in `src/lib/stellar.ts` (for the app) and hardcoded separately in `src/lib/blend.ts` (`BLEND_NETWORK.rpc`) because the Blend SDK takes its own network config object.

---

## Soroswap API

**Authentication:** `Authorization: Bearer sk_...` header. Key in `.env.production` as `NEXT_PUBLIC_SOROSWAP_API_KEY`.

### XLM token address
The API does **not** accept `"native"` for XLM. Use the XLM SAC address:
```
CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA
```
This is exported as `XLM_SAC` from `src/lib/soroswap.ts`. The internal `resolveTokenForApi()` function maps `"native"` → XLM_SAC automatically. `MAINNET_TOKENS.XLM` stays `"native"` for Stellar SDK/Horizon usage.

### Quote endpoint
```
POST https://api.soroswap.finance/quote?network=mainnet
{
  assetIn:    <SAC address>,
  assetOut:   <SAC address>,
  amount:     Number(amountIn),   // integer, NOT string
  tradeType:  'EXACT_IN',
  protocols:  ['soroswap', 'phoenix', 'aqua', 'sdex'],  // subset allowed
  parts:      10,
  slippageBps: 50
}
```

### Build endpoint
```
POST https://api.soroswap.finance/quote/build?network=mainnet
{
  quote: rawApiResponse,   // the full response from /quote, stored in SwapQuote.rawData
  from:  walletAddress
}
→ { xdr: string }   // unsigned XDR
```

The build endpoint simulates the transaction on-chain — it requires a funded real mainnet account as `from`. Cannot use a random/unfunded keypair.

### `getSwapQuote` signature
```typescript
getSwapQuote(tokenIn, tokenOut, amountIn, slippageBps = 50, protocols = ['soroswap', 'phoenix', 'aqua', 'sdex'])
```
The `protocols` param was added to support the swap page protocol selector. All existing callers work unchanged (backward compatible).

---

## Blend Protocol (SDK)

**Pool v1:** `CDVQVKOY2YSXS2IC7KN6MNASSHPAO7UN2UR2ON4OI2SKMFJNVAMDX6DP` (has XLM + USDC)

### SDK usage
```typescript
import { PoolV1 } from '@blend-capital/blend-sdk';
const pool = await PoolV1.load(BLEND_NETWORK, POOL_ID);
```

### Value scaling
| Field | Scale | Example |
|-------|-------|---------|
| `reserve.estSupplyApy` | decimal fraction | `0.0054` = 5.4% → multiply by 100 for % |
| `reserve.estBorrowApy` | decimal fraction | same |
| `reserve.data.bRate` / `dRate` | 1e9 | `1_000_000_000` = 1.0 |
| `reserve.config.c_factor` | 1e7 | `9_500_000` = 95% collateral factor |

### Current APYs (conservative pool params, low borrowing demand)
- USDC: ~0.54% supply, ~0.88% borrow (77% utilization)
- XLM: ~0.10% borrow (<5% utilization)

These are correct — the formula `reserve.estSupplyApy * 100` is right.

### Testing the Blend SDK
Blend SDK uses `stellar-sdk`'s internal HTTP client — **global fetch mocks don't affect it**. To mock in unit tests, spy on the SDK directly:
```typescript
vi.spyOn(PoolV1, 'load').mockResolvedValue(mockPool);
```

### Blend RequestTypes
| Action | RequestType |
|--------|-------------|
| Supply collateral | `0` |
| Withdraw collateral | `1` |
| Borrow | `4` |
| Repay | `5` |

---

## Reflector Oracle

**Contract:** `CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN`

Prices are fetched via **Soroban RPC simulation** — read-only, no transaction fee, no signature needed.

### Asset ScVal encoding
```typescript
// XLM: Asset::Other(Symbol)
ScVec([ScvSymbol('Other'), ScvSymbol('XLM')])

// SAC tokens: Asset::Stellar(Address)
ScVec([ScvSymbol('Stellar'), addr.toScVal()])
```

### Price decoding
```typescript
const native = StellarSdk.scValToNative(sim.result.retval);
const priceUSD = Number(native.price) / 10 ** 14;  // 14 decimal places
```

### Simulation source account
Any funded mainnet account can be used as the simulation source — it is never charged. We use:
`GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN`

The function returns `null` gracefully on any error; callers use `?? 0`.

---

## Dashboard — USD Price Logic

```typescript
// Prices loaded in parallel with balances
const [balancesResult, blendResult, pricesResult] = await Promise.allSettled([
  horizon.loadAccount(address),
  getUserPositions(address),
  getTokenPrices(),   // from reflector.ts
]);

// Net value = wallet holdings + Blend supplied − Blend borrowed
const walletUsdValue = balances.reduce((sum, b) => sum + parseFloat(b.balance) * (prices[b.asset] ?? 0), 0);
const totalValue = walletUsdValue + totalSupplied - totalBorrowed;
```

---

## Token Amounts

All Stellar token amounts use **7 decimal places** (1 XLM = 10_000_000 stroops).

Utilities in `src/lib/soroswap.ts`:
```typescript
parseAmount("1.5", 7)   // → BigInt("15000000")
formatAmount(15000000n, 7)  // → "1.5"
```

The Soroswap API expects `amount: Number(amountIn)` where `amountIn` is the raw integer (e.g. `15000000` for 1.5 XLM). Do not pass a decimal string.

---

## Testing

```bash
npm test                   # 79 unit tests, no network, fast
npm run test:watch         # watch mode
npm run test:integration   # ~10 tests hitting real mainnet APIs (loads .env.production)
```

Test files:
- `src/__tests__/soroswap.test.ts` — quote/build API, utilities, error paths
- `src/__tests__/swapFlow.test.ts` — quote→build pipeline, rawData preservation
- `src/__tests__/dexAggregation.test.ts` — routing, slippage, multi-hop, edge cases
- `src/__tests__/blend.test.ts` — pool data, APY scaling, DefiLlama fallback

All 79 unit tests must pass before committing (`npm test`).

---

## Deployment

Push to `main` → GitHub Actions automatically builds and deploys.

```yaml
# .github/workflows/deploy.yml (summary)
- npm ci
- npm run build   # uses .env.production (mainnet)
- upload ./out as GitHub Pages artifact
- deploy to https://kaankacar.github.io/stellar-defi-app/
```

**One-time repo setting:** Settings → Pages → Source → **GitHub Actions** (not "Deploy from branch").

---

## Mainnet Contract Addresses (Reference)

| Name | Address |
|------|---------|
| Blend Pool v1 | `CDVQVKOY2YSXS2IC7KN6MNASSHPAO7UN2UR2ON4OI2SKMFJNVAMDX6DP` |
| Reflector Oracle | `CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN` |
| XLM SAC | `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA` |
| USDC SAC | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |
| EURC SAC | `CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV` |
| yUSDC | `CDOFW7HNKLUZRLFZST4EW7V3AV4JI5IHMT6BPXXSY2IEFZ4NE5TWU2P4` |
| Soroswap Router | `CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH` |
| Soroswap Aggregator | `CAYP3UWLJM7ZPTUKL6R6BFGTRWLZ46LRKOXTERI2K6BIJAWGYY62TXTO` |

---

## Common Pitfalls

1. **`<a href>` vs `<Link href>`** — Always use `next/link` for internal navigation. Raw `<a>` breaks in production (basePath not prepended).

2. **RPC URL** — `https://rpc.ankr.com/stellar_soroban` only. `https://soroban.stellar.org` is not an RPC endpoint.

3. **XLM "native" vs SAC** — Soroswap API requires the SAC address. Stellar SDK / Horizon uses `"native"`. The `resolveTokenForApi()` helper handles the mapping.

4. **Soroswap `amount` field** — Must be `Number(amountIn)` (integer), not a string. A string will cause the API to return incorrect results or an error.

5. **Blend SDK mocking** — `vi.fn()` on `fetch` won't intercept Blend SDK calls. Use `vi.spyOn(PoolV1, 'load')`.

6. **Static export limitations** — No `getServerSideProps`, no API routes, no image optimization. Use `images: { unoptimized: true }` and only `generateStaticParams` for dynamic routes.

7. **`Promise.allSettled` for parallel data loading** — Use this when loading multiple independent data sources (balances, prices, Blend positions) so one failure doesn't block the others.
