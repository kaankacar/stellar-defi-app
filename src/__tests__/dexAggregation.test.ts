/**
 * DEX Aggregation tests
 *
 * Tests the Soroswap multi-protocol aggregator behavior:
 * - Route selection across soroswap / phoenix / aqua / sdex protocols
 * - Slippage handling
 * - Edge cases: zero amounts, same token, very large amounts
 * - Data fetching robustness: retries, malformed responses
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSwapQuote,
  buildSwapTransaction,
  formatAmount,
  parseAmount,
  MAINNET_TOKENS,
  XLM_SAC,
  type SwapQuote,
} from '../lib/soroswap';

const WALLET = 'GABJLI6IVPKFLKSRZQW4ZI3YOLBGZIRW57LLRAFLXQ7KYGCN4JTNNCV';

// ─── Protocol routing ─────────────────────────────────────────────────────────

describe('DEX aggregation — protocol routing', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('requests all four protocols in the quote', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ amountIn: '1000000', amountOut: '980000', routePlan: [] }),
    } as Response);

    await getSwapQuote(MAINNET_TOKENS.XLM, MAINNET_TOKENS.USDC, '1000000');

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.protocols).toContain('soroswap');
    expect(body.protocols).toContain('phoenix');
    expect(body.protocols).toContain('aqua');
    expect(body.protocols).toContain('sdex');
    expect(body.protocols).toHaveLength(4);
  });

  it('uses EXACT_IN trade type', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ amountIn: '1000000', amountOut: '980000', routePlan: [] }),
    } as Response);

    await getSwapQuote(MAINNET_TOKENS.XLM, MAINNET_TOKENS.USDC, '1000000');

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.tradeType).toBe('EXACT_IN');
  });

  it('handles soroswap-only single-hop route', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        amountIn: '10000000',
        amountOut: '9800000',
        priceImpact: '0.1',
        routePlan: [
          { swapInfo: { path: [XLM_SAC, MAINNET_TOKENS.USDC], protocol: 'soroswap' } },
        ],
      }),
    } as Response);

    const quote = await getSwapQuote(MAINNET_TOKENS.XLM, MAINNET_TOKENS.USDC, '10000000');
    expect(quote.protocols).toEqual(['soroswap']);
    expect(quote.route).toContain(XLM_SAC);
    expect(quote.route).toContain(MAINNET_TOKENS.USDC);
  });

  it('handles multi-protocol multi-hop route (soroswap + phoenix)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        amountIn: '10000000',
        amountOut: '9600000',
        priceImpact: '0.4',
        routePlan: [
          { swapInfo: { path: [XLM_SAC, MAINNET_TOKENS.USDC], protocol: 'soroswap' } },
          { swapInfo: { path: [MAINNET_TOKENS.USDC, MAINNET_TOKENS.EURC], protocol: 'phoenix' } },
        ],
      }),
    } as Response);

    const quote = await getSwapQuote(MAINNET_TOKENS.XLM, MAINNET_TOKENS.EURC, '10000000');
    expect(quote.protocols).toEqual(['soroswap', 'phoenix']);
    expect(quote.protocols).toHaveLength(2);
  });

  it('handles 3-hop route across all protocols', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        amountIn: '50000000',
        amountOut: '48000000',
        priceImpact: '1.5',
        routePlan: [
          { swapInfo: { path: [XLM_SAC, MAINNET_TOKENS.USDC], protocol: 'sdex' } },
          { swapInfo: { path: [MAINNET_TOKENS.USDC, MAINNET_TOKENS.EURC], protocol: 'aqua' } },
          { swapInfo: { path: [MAINNET_TOKENS.EURC, MAINNET_TOKENS.yUSDC], protocol: 'soroswap' } },
        ],
      }),
    } as Response);

    const quote = await getSwapQuote(MAINNET_TOKENS.XLM, MAINNET_TOKENS.yUSDC, '50000000');
    expect(quote.protocols).toHaveLength(3);
    expect(quote.protocols).toContain('sdex');
    expect(quote.protocols).toContain('aqua');
  });

  it('returns empty protocols array when routePlan is absent', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ amountIn: '1000000', amountOut: '980000' }),
    } as Response);

    const quote = await getSwapQuote(MAINNET_TOKENS.XLM, MAINNET_TOKENS.USDC, '1000000');
    expect(quote.protocols).toEqual([]);
    expect(quote.route).toEqual([]);
  });
});

// ─── Slippage ─────────────────────────────────────────────────────────────────

describe('DEX aggregation — slippage', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('passes default 50 bps slippage', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ amountOut: '980000', routePlan: [] }),
    } as Response);

    await getSwapQuote(MAINNET_TOKENS.XLM, MAINNET_TOKENS.USDC, '1000000');

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.slippageBps).toBe(50);
  });

  it('passes custom slippage when provided', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ amountOut: '975000', routePlan: [] }),
    } as Response);

    await getSwapQuote(MAINNET_TOKENS.XLM, MAINNET_TOKENS.USDC, '1000000', 100);

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.slippageBps).toBe(100);
  });

  it('accepts zero slippage', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ amountOut: '999000', routePlan: [] }),
    } as Response);

    await getSwapQuote(MAINNET_TOKENS.XLM, MAINNET_TOKENS.USDC, '1000000', 0);

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.slippageBps).toBe(0);
  });
});

// ─── Price impact classification ──────────────────────────────────────────────

describe('DEX aggregation — price impact', () => {
  beforeEach(() => vi.restoreAllMocks());

  const makeQuote = async (priceImpact: string): Promise<SwapQuote> => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ amountIn: '1000000', amountOut: '900000', priceImpact, routePlan: [] }),
    } as Response);
    return getSwapQuote(MAINNET_TOKENS.XLM, MAINNET_TOKENS.USDC, '1000000');
  };

  it('stores low price impact correctly', async () => {
    const quote = await makeQuote('0.05');
    expect(parseFloat(quote.priceImpactPct)).toBeLessThan(0.5);
  });

  it('stores medium price impact correctly', async () => {
    const quote = await makeQuote('0.75');
    const impact = parseFloat(quote.priceImpactPct);
    expect(impact).toBeGreaterThanOrEqual(0.5);
    expect(impact).toBeLessThan(1);
  });

  it('stores high price impact correctly', async () => {
    const quote = await makeQuote('2.5');
    expect(parseFloat(quote.priceImpactPct)).toBeGreaterThan(1);
  });

  it('falls back to priceImpactPct field if priceImpact missing', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ amountOut: '900000', priceImpactPct: '1.23', routePlan: [] }),
    } as Response);
    const quote = await getSwapQuote(MAINNET_TOKENS.XLM, MAINNET_TOKENS.USDC, '1000000');
    expect(quote.priceImpactPct).toBe('1.23');
  });

  it('defaults to "0" when both priceImpact fields are absent', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ amountOut: '900000', routePlan: [] }),
    } as Response);
    const quote = await getSwapQuote(MAINNET_TOKENS.XLM, MAINNET_TOKENS.USDC, '1000000');
    expect(quote.priceImpactPct).toBe('0');
  });
});

// ─── Amount edge cases ────────────────────────────────────────────────────────

describe('DEX aggregation — amount encoding', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends amount as a number (integer) in request body', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ amountOut: '980000', routePlan: [] }),
    } as Response);

    await getSwapQuote(MAINNET_TOKENS.XLM, MAINNET_TOKENS.USDC, '100000000');

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.amount).toBe(100000000);
    expect(typeof body.amount).toBe('number');
  });

  it('correctly encodes 1 XLM (7 decimals = 10_000_000 stroops)', () => {
    const amount = parseAmount('1', 7);
    expect(amount.toString()).toBe('10000000');
  });

  it('correctly encodes 0.0000001 XLM (1 stroop)', () => {
    const amount = parseAmount('0.0000001', 7);
    expect(amount.toString()).toBe('1');
  });

  it('correctly encodes large amounts without precision loss', () => {
    const amount = parseAmount('999999.9999999', 7);
    expect(amount.toString()).toBe('9999999999999');
    expect(formatAmount(amount, 7)).toBe('999999.9999999');
  });
});

// ─── buildSwapTransaction — network layer ─────────────────────────────────────

describe('buildSwapTransaction — network layer', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends Content-Type: application/json', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ xdr: 'XDR_TEST' }),
    } as Response);

    const quote: SwapQuote = {
      amountIn: '1000000', amountOut: '980000', priceImpactPct: '0.1',
      route: [], protocols: ['soroswap'], rawData: { test: true },
    };
    await buildSwapTransaction(quote, WALLET);

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('targets mainnet network parameter', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ xdr: 'XDR_TEST' }),
    } as Response);

    const quote: SwapQuote = {
      amountIn: '1000000', amountOut: '980000', priceImpactPct: '0.1',
      route: [], protocols: [], rawData: {},
    };
    await buildSwapTransaction(quote, WALLET);

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('network=mainnet');
  });

  it('handles 429 rate-limit response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Rate limit exceeded' }),
    } as Response);

    const quote: SwapQuote = {
      amountIn: '1000000', amountOut: '980000', priceImpactPct: '0.1',
      route: [], protocols: [], rawData: {},
    };
    await expect(buildSwapTransaction(quote, WALLET)).rejects.toThrow('Rate limit exceeded');
  });

  it('handles JSON parse failure on error response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => { throw new Error('not json'); },
    } as unknown as Response);

    const quote: SwapQuote = {
      amountIn: '1000000', amountOut: '980000', priceImpactPct: '0.1',
      route: [], protocols: [], rawData: {},
    };
    // Should still throw (API error fallback) without crashing on JSON parse
    await expect(buildSwapTransaction(quote, WALLET)).rejects.toThrow();
  });
});

// ─── getSwapQuote — data fetching robustness ──────────────────────────────────

describe('getSwapQuote — data fetching robustness', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends assetIn and assetOut fields (not tokenIn/tokenOut)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ amountOut: '980000', routePlan: [] }),
    } as Response);

    await getSwapQuote('native', MAINNET_TOKENS.USDC, '1000000');

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    // "native" is resolved to XLM SAC for the API
    expect(body.assetIn).toBe(XLM_SAC);
    expect(body.assetOut).toBe(MAINNET_TOKENS.USDC);
    // old field names must NOT be present
    expect(body.tokenIn).toBeUndefined();
    expect(body.tokenOut).toBeUndefined();
  });

  it('hits the correct mainnet endpoint URL', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ amountOut: '0', routePlan: [] }),
    } as Response);

    await getSwapQuote('native', MAINNET_TOKENS.USDC, '1000000');

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.soroswap.finance/quote?network=mainnet');
  });

  it('handles 404 from API gracefully', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Endpoint not found' }),
    } as Response);

    await expect(
      getSwapQuote('native', MAINNET_TOKENS.USDC, '1000000')
    ).rejects.toThrow('Endpoint not found');
  });

  it('handles empty routePlan array without crashing', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        amountIn: '1000000',
        amountOut: '0',
        priceImpact: '0',
        routePlan: [],
      }),
    } as Response);

    const quote = await getSwapQuote('native', MAINNET_TOKENS.USDC, '1000000');
    expect(quote.protocols).toEqual([]);
    expect(quote.route).toEqual([]);
    expect(quote.amountOut).toBe('0');
  });
});
