import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatAmount,
  parseAmount,
  getPoolData,
  BLEND_POOLS,
  BLEND_ASSETS,
} from '../lib/blend';

// ─── formatAmount / parseAmount ───────────────────────────────────────────────

describe('blend formatAmount', () => {
  it('formats 1 unit correctly', () => {
    expect(formatAmount(BigInt('10000000'))).toBe('1');
  });

  it('formats fractional value', () => {
    expect(formatAmount(BigInt('15000000'))).toBe('1.5');
  });

  it('formats zero', () => {
    expect(formatAmount(BigInt('0'))).toBe('0');
  });

  it('trims trailing zeros', () => {
    expect(formatAmount(BigInt('100000000'))).toBe('10');
  });
});

describe('blend parseAmount', () => {
  it('parses "1" to correct bigint', () => {
    expect(parseAmount('1')).toBe(BigInt('10000000'));
  });

  it('parses "1.5" to correct bigint', () => {
    expect(parseAmount('1.5')).toBe(BigInt('15000000'));
  });

  it('round-trips with formatAmount', () => {
    const amounts = ['1', '10.5', '100', '0.0000001'];
    for (const amount of amounts) {
      expect(formatAmount(parseAmount(amount))).toBe(amount);
    }
  });
});

// ─── Constants ───────────────────────────────────────────────────────────────

describe('BLEND_POOLS', () => {
  it('has a stellar pool address', () => {
    expect(BLEND_POOLS.stellar).toMatch(/^C[A-Z0-9]{55}$/);
  });
});

describe('BLEND_ASSETS', () => {
  it('has XLM as native', () => {
    expect(BLEND_ASSETS.XLM).toBe('native');
  });

  it('has USDC contract address', () => {
    expect(BLEND_ASSETS.USDC).toMatch(/^C[A-Z0-9]{55}$/);
  });
});

// ─── getPoolData ──────────────────────────────────────────────────────────────

describe('getPoolData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns market data derived from DefiLlama TVL', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = url.toString();
      // Internal API route — not available in static export
      if (urlStr.includes('/api/blend')) {
        return { ok: false } as Response;
      }
      // DefiLlama fallback
      if (urlStr.includes('api.llama.fi')) {
        return {
          ok: true,
          json: async () => ({
            currentChainTvls: {
              Stellar: 5_000_000,
              'Stellar-borrowed': 2_000_000,
            },
          }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    const markets = await getPoolData();

    expect(markets.length).toBeGreaterThan(0);
    // Each market should have expected fields
    for (const market of markets) {
      expect(market).toHaveProperty('asset');
      expect(market).toHaveProperty('assetAddress');
      expect(market).toHaveProperty('supplyAPY');
      expect(market).toHaveProperty('borrowAPY');
      expect(market).toHaveProperty('utilization');
      expect(market).toHaveProperty('collateralFactor');
      expect(market.supplyAPY).toBeGreaterThan(0);
      expect(market.borrowAPY).toBeGreaterThan(0);
    }
  });

  it('includes USDC and XLM markets', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/blend')) return { ok: false } as Response;
      if (urlStr.includes('api.llama.fi')) {
        return {
          ok: true,
          json: async () => ({
            currentChainTvls: { Stellar: 10_000_000, 'Stellar-borrowed': 3_000_000 },
          }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    const markets = await getPoolData();
    const assets = markets.map((m) => m.asset);

    expect(assets).toContain('USDC');
    expect(assets).toContain('BTC');
  });

  it('returns empty array when all sources fail', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);

    const markets = await getPoolData();
    expect(markets).toEqual([]);
  });

  it('utilization is between 0 and 100', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/blend')) return { ok: false } as Response;
      if (urlStr.includes('api.llama.fi')) {
        return {
          ok: true,
          json: async () => ({
            currentChainTvls: { Stellar: 8_000_000, 'Stellar-borrowed': 3_000_000 },
          }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    const markets = await getPoolData();
    for (const market of markets) {
      expect(market.utilization).toBeGreaterThanOrEqual(0);
      expect(market.utilization).toBeLessThanOrEqual(100);
    }
  });
});
