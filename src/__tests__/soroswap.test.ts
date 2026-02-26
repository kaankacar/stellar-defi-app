import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatAmount,
  parseAmount,
  getSwapQuote,
  buildSwapTransaction,
  MAINNET_TOKENS,
  type SwapQuote,
} from '../lib/soroswap';

// ─── formatAmount ────────────────────────────────────────────────────────────

describe('formatAmount', () => {
  it('formats whole number', () => {
    expect(formatAmount(BigInt('10000000'), 7)).toBe('1');
  });

  it('formats fractional amount', () => {
    expect(formatAmount(BigInt('15000000'), 7)).toBe('1.5');
  });

  it('formats zero', () => {
    expect(formatAmount(BigInt('0'), 7)).toBe('0');
  });

  it('accepts string input', () => {
    expect(formatAmount('10000000', 7)).toBe('1');
  });

  it('trims trailing zeros', () => {
    expect(formatAmount(BigInt('100000000'), 7)).toBe('10');
  });

  it('preserves significant decimals', () => {
    expect(formatAmount(BigInt('10000001'), 7)).toBe('1.0000001');
  });
});

// ─── parseAmount ─────────────────────────────────────────────────────────────

describe('parseAmount', () => {
  it('parses whole number', () => {
    expect(parseAmount('1', 7)).toBe(BigInt('10000000'));
  });

  it('parses fractional amount', () => {
    expect(parseAmount('1.5', 7)).toBe(BigInt('15000000'));
  });

  it('parses zero', () => {
    expect(parseAmount('0', 7)).toBe(BigInt('0'));
  });

  it('pads short fractions', () => {
    expect(parseAmount('1.1', 7)).toBe(BigInt('11000000'));
  });

  it('truncates overly long fractions', () => {
    // More than 7 decimal places — only keeps 7
    expect(parseAmount('1.12345678', 7)).toBe(BigInt('11234567'));
  });

  it('round-trips with formatAmount', () => {
    const original = '3.1415926';
    const bigint = parseAmount(original, 7);
    expect(formatAmount(bigint, 7)).toBe(original);
  });
});

// ─── MAINNET_TOKENS ──────────────────────────────────────────────────────────

describe('MAINNET_TOKENS', () => {
  it('has correct XLM address', () => {
    expect(MAINNET_TOKENS.XLM).toBe('native');
  });

  it('has USDC address', () => {
    expect(MAINNET_TOKENS.USDC).toMatch(/^C[A-Z0-9]{55}$/);
  });

  it('has EURC address', () => {
    expect(MAINNET_TOKENS.EURC).toMatch(/^C[A-Z0-9]{55}$/);
  });
});

// ─── getSwapQuote ─────────────────────────────────────────────────────────────

describe('getSwapQuote', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls the Soroswap quote endpoint with correct body', async () => {
    const mockResponse = {
      amountIn: '10000000',
      amountOut: '9800000',
      priceImpact: '0.12',
      routePlan: [
        { swapInfo: { path: ['native', MAINNET_TOKENS.USDC], protocol: 'soroswap' } },
      ],
    };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    await getSwapQuote('native', MAINNET_TOKENS.USDC, '10000000');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.soroswap.finance/quote?network=mainnet',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"assetIn":"native"'),
      })
    );

    const callBody = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(callBody.tradeType).toBe('EXACT_IN');
    expect(callBody.protocols).toContain('soroswap');
    expect(callBody.protocols).toContain('sdex');
  });

  it('maps API response to SwapQuote correctly', async () => {
    const mockResponse = {
      amountIn: '10000000',
      amountOut: '9800000',
      priceImpact: '0.12',
      routePlan: [
        { swapInfo: { path: ['native', MAINNET_TOKENS.USDC], protocol: 'soroswap' } },
      ],
    };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const quote = await getSwapQuote('native', MAINNET_TOKENS.USDC, '10000000');

    expect(quote.amountIn).toBe('10000000');
    expect(quote.amountOut).toBe('9800000');
    expect(quote.priceImpactPct).toBe('0.12');
    expect(quote.protocols).toEqual(['soroswap']);
    expect(quote.rawData).toEqual(mockResponse); // raw data preserved
  });

  it('falls back to amountIn param when API omits it', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ amountOut: '5000000', routePlan: [] }),
    } as Response);

    const quote = await getSwapQuote('native', MAINNET_TOKENS.USDC, '10000000');
    expect(quote.amountIn).toBe('10000000');
  });

  it('throws on non-OK API response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid token pair' }),
    } as Response);

    await expect(
      getSwapQuote('native', MAINNET_TOKENS.USDC, '10000000')
    ).rejects.toThrow('Invalid token pair');
  });

  it('throws on network error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    await expect(
      getSwapQuote('native', MAINNET_TOKENS.USDC, '10000000')
    ).rejects.toThrow('Network error');
  });
});

// ─── buildSwapTransaction ────────────────────────────────────────────────────

describe('buildSwapTransaction', () => {
  const mockQuote: SwapQuote = {
    amountIn: '10000000',
    amountOut: '9800000',
    priceImpactPct: '0.12',
    route: ['native', MAINNET_TOKENS.USDC],
    protocols: ['soroswap'],
    rawData: { some: 'raw', api: 'data' },
  };

  const walletAddress = 'GABJLI6IVPKFLKSRZQW4ZI3YOLBGZIRW57LLRAFLXQ7KYGCN4JTNNCV';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls the Soroswap build endpoint with correct body', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ xdr: 'AAAA...base64xdr...' }),
    } as Response);

    await buildSwapTransaction(mockQuote, walletAddress);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.soroswap.finance/quote/build?network=mainnet',
      expect.objectContaining({ method: 'POST' })
    );

    const callBody = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(callBody.from).toBe(walletAddress);
    expect(callBody.quote).toEqual(mockQuote.rawData); // passes raw data, not parsed
  });

  it('returns the XDR string from the API response', async () => {
    const xdr = 'AAAA_UNSIGNED_XDR_BASE64';
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ xdr }),
    } as Response);

    const result = await buildSwapTransaction(mockQuote, walletAddress);
    expect(result).toBe(xdr);
  });

  it('throws when API returns no XDR', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'ok but no xdr' }),
    } as Response);

    await expect(
      buildSwapTransaction(mockQuote, walletAddress)
    ).rejects.toThrow('No XDR returned from build endpoint');
  });

  it('throws on non-OK API response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    } as Response);

    await expect(
      buildSwapTransaction(mockQuote, walletAddress)
    ).rejects.toThrow('Internal server error');
  });
});
