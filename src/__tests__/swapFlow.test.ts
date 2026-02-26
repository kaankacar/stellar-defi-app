/**
 * Integration-style tests for the swap flow:
 *   getSwapQuote → buildSwapTransaction → signTransaction → submitTransaction
 *
 * These tests mock fetch and the Stellar RPC to exercise the full pipeline
 * without hitting real network endpoints.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSwapQuote, buildSwapTransaction, MAINNET_TOKENS, XLM_SAC } from '../lib/soroswap';

const WALLET_ADDRESS = 'GABJLI6IVPKFLKSRZQW4ZI3YOLBGZIRW57LLRAFLXQ7KYGCN4JTNNCV';

const MOCK_QUOTE_RESPONSE = {
  amountIn: '10000000',
  amountOut: '9750000',
  priceImpact: '0.25',
  routePlan: [
    { swapInfo: { path: [XLM_SAC, MAINNET_TOKENS.USDC], protocol: 'soroswap' } },
    { swapInfo: { path: [MAINNET_TOKENS.USDC, MAINNET_TOKENS.EURC], protocol: 'phoenix' } },
  ],
};

describe('swap pipeline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('step 1: getSwapQuote returns a valid quote with rawData', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_QUOTE_RESPONSE,
    } as Response);

    const quote = await getSwapQuote(
      'native',
      MAINNET_TOKENS.USDC,
      '10000000'
    );

    expect(quote.amountOut).toBe('9750000');
    expect(quote.priceImpactPct).toBe('0.25');
    expect(quote.protocols).toEqual(['soroswap', 'phoenix']);
    expect(quote.rawData).toBeDefined(); // must be preserved for step 2
  });

  it('step 1: "native" XLM is resolved to XLM SAC in the request', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_QUOTE_RESPONSE,
    } as Response);

    await getSwapQuote('native', MAINNET_TOKENS.USDC, '10000000');

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.assetIn).toBe(XLM_SAC);
  });

  it('step 2: buildSwapTransaction sends the raw quote data to the build API', async () => {
    // First call: quote
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_QUOTE_RESPONSE,
      } as Response)
      // Second call: build
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ xdr: 'UNSIGNED_XDR_123' }),
      } as Response);

    const quote = await getSwapQuote('native', MAINNET_TOKENS.USDC, '10000000');
    const xdr = await buildSwapTransaction(quote, WALLET_ADDRESS);

    // Verify build call used rawData (not the parsed quote)
    const buildCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[1];
    const buildBody = JSON.parse(buildCall[1].body);
    expect(buildBody.from).toBe(WALLET_ADDRESS);
    expect(buildBody.quote).toEqual(MOCK_QUOTE_RESPONSE);

    expect(xdr).toBe('UNSIGNED_XDR_123');
  });

  it('step 2 fails gracefully when build API is unavailable', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_QUOTE_RESPONSE,
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service unavailable' }),
      } as Response);

    const quote = await getSwapQuote('native', MAINNET_TOKENS.USDC, '10000000');
    await expect(buildSwapTransaction(quote, WALLET_ADDRESS)).rejects.toThrow(
      'Service unavailable'
    );
  });

  it('multi-hop route is preserved in quote', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_QUOTE_RESPONSE,
    } as Response);

    const quote = await getSwapQuote('native', MAINNET_TOKENS.EURC, '10000000');

    // Two hops: XLM→USDC via soroswap, USDC→EURC via phoenix
    expect(quote.protocols).toHaveLength(2);
    expect(quote.protocols[0]).toBe('soroswap');
    expect(quote.protocols[1]).toBe('phoenix');
  });

  it('handles API returning priceImpactPct instead of priceImpact field', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...MOCK_QUOTE_RESPONSE,
        priceImpact: undefined,
        priceImpactPct: '0.5',
      }),
    } as Response);

    const quote = await getSwapQuote('native', MAINNET_TOKENS.USDC, '10000000');
    expect(quote.priceImpactPct).toBe('0.5');
  });
});
