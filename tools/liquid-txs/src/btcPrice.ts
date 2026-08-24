export type SpotQuote = {
  price: number;
  source: string;
  fetchedAt: number;
};

async function fromBinance(): Promise<SpotQuote> {
  const res = await fetch(
    "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"
  );
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  const data = (await res.json()) as { price?: string };
  const price = Number(data.price);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Binance inválido");
  return { price, source: "Binance BTCUSDT", fetchedAt: Date.now() };
}

async function fromCoinGecko(): Promise<SpotQuote> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
  );
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = (await res.json()) as { bitcoin?: { usd?: number } };
  const price = Number(data.bitcoin?.usd);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("CoinGecko inválido");
  }
  return { price, source: "CoinGecko BTC/USD", fetchedAt: Date.now() };
}

export async function fetchBtcSpot(): Promise<SpotQuote> {
  try {
    return await fromBinance();
  } catch {
    return await fromCoinGecko();
  }
}
