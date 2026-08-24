"""
Cliente do Macro Dashboard (rodolforomao.com.br).

Reutiliza o mesmo proxy.php + séries FRED do site:
  https://rodolforomao.com.br/macro-dashboard

Não embute a API key no código — lê de:
  1) FRED_API_KEY / REACT_APP_FRED_API_KEY (env)
  2) .env local do projeto analyses_btc
  3) .env do site em MACRO_SITE_ENV (default path conhecido)
"""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

PROXY_BASE_DEFAULT = "https://rodolforomao.com.br/proxy.php"
SITE_ENV_DEFAULT = Path(
    "/home/black/enviroment/code/production/ultrahost/rodolforomao/.env"
)
LOCAL_ENV = Path(__file__).resolve().parents[1] / ".env"

# Séries alinhadas ao MacroDash (Dollar / Markets / Liquidity / Alerts)
SERIES_IDS = [
    "SP500",
    "DTWEXBGS",  # Broad USD (proxy DXY no site)
    "VIXCLS",
    "DGS10",
    "T10Y2Y",
    "BAMLH0A0HYM2",  # HY OAS
    "WALCL",
    "WTREGEN",
    "RRPONTSYD",
]


@dataclass
class MacroSiteBundle:
    source: str
    as_of: str
    spx_last: float
    spx_1m_pct: float
    dollar_last: float
    dollar_1m_pct: float  # DTWEXBGS
    vix_last: float
    vix_1m_chg: float  # pontos, não %
    dgs10_last: float
    t10y2y_last: float
    hy_oas_last: float
    net_liq_last: float | None
    net_liq_4w_pct: float | None
    btc_dominance_pct: float
    btc_ath: float | None
    btc_price_cg: float | None
    btc_change_7d: float | None
    raw_series_meta: dict = field(default_factory=dict)


def _read_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def load_fred_key() -> str:
    for k in ("FRED_API_KEY", "REACT_APP_FRED_API_KEY"):
        if os.environ.get(k):
            return os.environ[k].strip()
    for path in (LOCAL_ENV, Path(os.environ.get("MACRO_SITE_ENV", SITE_ENV_DEFAULT))):
        env = _read_env_file(path)
        for k in ("FRED_API_KEY", "REACT_APP_FRED_API_KEY"):
            if env.get(k):
                return env[k]
    raise RuntimeError(
        "FRED API key não encontrada. Defina FRED_API_KEY ou aponte MACRO_SITE_ENV "
        "para o .env do macro-dashboard."
    )


def proxy_base() -> str:
    return os.environ.get("MACRO_PROXY_BASE", PROXY_BASE_DEFAULT).rstrip("?")


def _get_json(url: str, timeout: int = 40) -> dict:
    req = urllib.request.Request(
        url, headers={"User-Agent": "analyses-btc-macro-site/1.0", "Accept": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def fetch_fred_series(series_id: str, start: str, api_key: str | None = None) -> list[dict]:
    key = api_key or load_fred_key()
    q = urllib.parse.urlencode(
        {
            "source": "fred",
            "series_id": series_id,
            "api_key": key,
            "observation_start": start,
        }
    )
    data = _get_json(f"{proxy_base()}?{q}")
    if data.get("error_code") or data.get("error_message"):
        raise RuntimeError(data.get("error_message") or str(data.get("error_code")))
    obs = []
    for o in data.get("observations") or []:
        if o.get("value") in (".", "", None):
            continue
        obs.append({"date": o["date"], "value": float(o["value"])})
    return obs


def fetch_coingecko(path: str) -> dict:
    if not path.startswith("/"):
        path = "/" + path
    q = urllib.parse.urlencode({"source": "coingecko", "path": path})
    return _get_json(f"{proxy_base()}?{q}")


def _pct_change(series: list[dict], lookback: int) -> float | None:
    if len(series) < lookback + 1:
        return None
    a = series[-(lookback + 1)]["value"]
    b = series[-1]["value"]
    if a == 0:
        return None
    return (b - a) / abs(a) * 100.0


def _approx_1m_points(series: list[dict]) -> int:
    """~21 trading days for daily series."""
    return min(21, max(1, len(series) - 1))


def calc_net_liquidity(
    walcl: list[dict], wtregen: list[dict], rrpon: list[dict]
) -> list[dict]:
    """Mesma fórmula do MacroDash: WALCL − TGA − RRP×1000."""
    tga_map = {d["date"]: d["value"] for d in wtregen}
    rr_sorted = sorted(rrpon, key=lambda x: x["date"])
    rr_idx = 0
    last_rr = 0.0
    out = []
    for w in walcl:
        if w["date"] not in tga_map:
            continue
        while rr_idx < len(rr_sorted) and rr_sorted[rr_idx]["date"] <= w["date"]:
            last_rr = rr_sorted[rr_idx]["value"] * 1000.0
            rr_idx += 1
        out.append({"date": w["date"], "value": w["value"] - tga_map[w["date"]] - last_rr})
    return out


def collect_macro_site(start_days: int = 120) -> MacroSiteBundle:
    start = (datetime.now(timezone.utc) - timedelta(days=start_days)).strftime("%Y-%m-%d")
    key = load_fred_key()
    series: dict[str, list[dict]] = {}
    meta: dict[str, str] = {}
    for sid in SERIES_IDS:
        try:
            series[sid] = fetch_fred_series(sid, start, key)
            if series[sid]:
                meta[sid] = series[sid][-1]["date"]
        except Exception as e:
            series[sid] = []
            meta[sid] = f"err:{e}"

    spx = series.get("SP500") or []
    usd = series.get("DTWEXBGS") or []
    vix = series.get("VIXCLS") or []
    dgs10 = series.get("DGS10") or []
    t10y2y = series.get("T10Y2Y") or []
    hy = series.get("BAMLH0A0HYM2") or []

    net = calc_net_liquidity(
        series.get("WALCL") or [],
        series.get("WTREGEN") or [],
        series.get("RRPONTSYD") or [],
    )
    # Net liq is weekly → 4 weeks ≈ 1 month
    net_4w = _pct_change(net, 4) if len(net) > 4 else None

    dom = 0.0
    ath = None
    px = None
    chg7 = None
    try:
        glob = fetch_coingecko("/global")
        dom = float(glob["data"]["market_cap_percentage"]["btc"])
    except Exception:
        pass
    try:
        info = fetch_coingecko(
            "/coins/bitcoin?localization=false&tickers=false"
            "&community_data=false&developer_data=false"
        )
        md = info["market_data"]
        px = float(md["current_price"]["usd"])
        ath = float(md["ath"]["usd"])
        chg7 = float(md.get("price_change_percentage_7d") or 0)
    except Exception:
        pass

    def last(s):
        return s[-1]["value"] if s else 0.0

    spx_lb = _approx_1m_points(spx)
    usd_lb = _approx_1m_points(usd)
    vix_lb = _approx_1m_points(vix)

    return MacroSiteBundle(
        source="rodolforomao.com.br/proxy.php (FRED+CoinGecko)",
        as_of=datetime.now(timezone.utc).isoformat(),
        spx_last=last(spx),
        spx_1m_pct=_pct_change(spx, spx_lb) or 0.0,
        dollar_last=last(usd),
        dollar_1m_pct=_pct_change(usd, usd_lb) or 0.0,
        vix_last=last(vix),
        vix_1m_chg=(last(vix) - vix[-(vix_lb + 1)]["value"]) if len(vix) > vix_lb else 0.0,
        dgs10_last=last(dgs10),
        t10y2y_last=last(t10y2y),
        hy_oas_last=last(hy),
        net_liq_last=net[-1]["value"] if net else None,
        net_liq_4w_pct=net_4w,
        btc_dominance_pct=dom,
        btc_ath=ath,
        btc_price_cg=px,
        btc_change_7d=chg7,
        raw_series_meta=meta,
    )
