export type SpotQuote = {
  price: number;
  source: string;
  fetchedAt: number;
};

const SIDESWAP_WS_URL = "wss://api.sideswap.io/json-rpc-ws";
/** Asset ids públicos da Liquid Network (L-BTC / Tether USDt). */
const LBTC_ASSET_ID =
  "6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526";
const USDT_ASSET_ID =
  "ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd";

type SideswapOrder = { trade_dir?: string; price?: number };

/** Preço real do par que negociamos (L-BTC/USDt na SideSwap) — mais fiel que um proxy BTC/USDT externo. */
function fromSideswap(timeoutMs = 6000): Promise<SpotQuote> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let ws: WebSocket;
    try {
      ws = new WebSocket(SIDESWAP_WS_URL);
    } catch (e) {
      reject(e instanceof Error ? e : new Error("SideSwap WS indisponível"));
      return;
    }
    const orders: SideswapOrder[] = [];

    const finish = (err: Error | null, price?: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* noop */
      }
      if (err || price == null) {
        reject(err || new Error("Sem preço da SideSwap"));
      } else {
        resolve({ price, source: "SideSwap L-BTC/USDt", fetchedAt: Date.now() });
      }
    };

    const timer = setTimeout(() => {
      const sells = orders
        .filter((o) => o.trade_dir === "Sell" && Number(o.price) > 0)
        .sort((a, b) => Number(a.price) - Number(b.price));
      const buys = orders
        .filter((o) => o.trade_dir === "Buy" && Number(o.price) > 0)
        .sort((a, b) => Number(b.price) - Number(a.price));
      if (sells[0] && buys[0]) {
        finish(null, (Number(sells[0].price) + Number(buys[0].price)) / 2);
      } else {
        finish(new Error("Timeout SideSwap"));
      }
    }, timeoutMs);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          id: 1,
          method: "market",
          params: {
            subscribe: {
              asset_pair: { base: LBTC_ASSET_ID, quote: USDT_ASSET_ID },
            },
          },
        })
      );
    };

    ws.onmessage = (ev) => {
      let msg: {
        result?: { subscribe?: { orders?: SideswapOrder[] } };
        params?: { market_price?: { last_price?: number; ind_price?: number } };
      };
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      const snapshotOrders = msg.result?.subscribe?.orders;
      if (Array.isArray(snapshotOrders)) orders.push(...snapshotOrders);

      const mp = msg.params?.market_price;
      if (mp) {
        const price = Number(mp.last_price ?? mp.ind_price);
        if (Number.isFinite(price) && price > 0) finish(null, price);
      }
    };

    ws.onerror = () => finish(new Error("Falha ao conectar na SideSwap"));
    ws.onclose = () => finish(new Error("SideSwap fechou sem preço"));
  });
}

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
    return await fromSideswap();
  } catch {
    try {
      return await fromBinance();
    } catch {
      return await fromCoinGecko();
    }
  }
}
