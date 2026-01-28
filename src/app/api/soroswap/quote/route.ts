import { NextRequest, NextResponse } from 'next/server';

const SOROSWAP_API = 'https://api.soroswap.finance';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokenIn, tokenOut, amount, slippageBps = 50 } = body;

    if (!tokenIn || !tokenOut || !amount) {
      return NextResponse.json(
        { error: 'Missing required parameters: tokenIn, tokenOut, amount' },
        { status: 400 }
      );
    }

    // Call Soroswap API server-side with correct format
    // The API uses POST with JSON body, not GET with query params
    const response = await fetch(`${SOROSWAP_API}/quote?network=mainnet`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assetIn: tokenIn,
        assetOut: tokenOut,
        amount: amount.toString(),
        tradeType: 'EXACT_IN',
        slippageBps: slippageBps.toString(),
        protocols: ['soroswap', 'phoenix', 'aqua'],
        parts: 10,
        maxHops: 2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Soroswap API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Soroswap API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const quoteData = await response.json();
    return NextResponse.json(quoteData);
  } catch (error) {
    console.error('Failed to get swap quote:', error);
    return NextResponse.json(
      { error: 'Failed to get quote', details: String(error) },
      { status: 500 }
    );
  }
}
