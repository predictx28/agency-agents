"""
Polymarket Reverse Engineer — Data Acquisition Pipeline
Target: @k9Q2mX4L8A7ZP3R
=========================================================
Fetches raw trade data from Polymarket Gamma API and Polygon
on-chain event logs, normalises to canonical schema.
"""

import asyncio
import logging
from dataclasses import dataclass, asdict
from typing import Optional
import httpx
import pandas as pd
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

GAMMA_API = "https://gamma-api.polymarket.com"
CLOB_API  = "https://clob.polymarket.com"

TARGET_USERNAME = "k9Q2mX4L8A7ZP3R"


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

@dataclass
class NormalizedTrade:
    timestamp:          pd.Timestamp
    market_id:          str
    market_question:    str
    category:           str
    outcome:            str        # YES | NO
    side:               str        # BUY | SELL
    size_usdc:          float
    price:              float
    transaction_hash:   str
    market_end_date:    Optional[pd.Timestamp]
    days_to_resolution: Optional[float]   # at time of trade
    market_volume_usdc: Optional[float]
    spread:             Optional[float]


# ---------------------------------------------------------------------------
# Live fetchers (requires network access to gamma-api.polymarket.com)
# ---------------------------------------------------------------------------

async def resolve_username_to_address(username: str) -> str:
    """Resolve a Polymarket username handle to an EVM wallet address."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{GAMMA_API}/profiles",
            params={"username": username},
            headers={"User-Agent": "polymarket-re-agent/1.0"},
        )
        resp.raise_for_status()
        data = resp.json()
        if not data:
            raise ValueError(f"No profile found for username '{username}'")
        address = data[0]["proxyWallet"] or data[0]["address"]
        log.info(f"Resolved {username} → {address}")
        return address


async def fetch_raw_trades(wallet_address: str, limit: int = 1000) -> list[dict]:
    """Pull all trades for a wallet from Gamma API (paginated)."""
    trades = []
    offset = 0
    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            resp = await client.get(
                f"{GAMMA_API}/trades",
                params={
                    "maker":  wallet_address,
                    "limit":  min(limit, 500),
                    "offset": offset,
                },
                headers={"User-Agent": "polymarket-re-agent/1.0"},
            )
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                break
            trades.extend(batch)
            log.info(f"Fetched {len(trades)} trades so far …")
            if len(batch) < 500:
                break
            offset += len(batch)
    log.info(f"Total raw trades fetched: {len(trades)}")
    return trades


async def fetch_market_metadata(market_id: str) -> dict:
    """Fetch single market detail from Gamma API."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{GAMMA_API}/markets/{market_id}",
            headers={"User-Agent": "polymarket-re-agent/1.0"},
        )
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# Normalisation
# ---------------------------------------------------------------------------

def _days_to_res(trade_ts: pd.Timestamp, end_date: Optional[str]) -> Optional[float]:
    if not end_date:
        return None
    try:
        ed = pd.Timestamp(end_date, tz="UTC")
        return (ed - trade_ts).total_seconds() / 86400
    except Exception:
        return None


def normalize_trades(raw_trades: list[dict], market_cache: dict[str, dict]) -> pd.DataFrame:
    """Convert raw Gamma API trade dicts to canonical NormalizedTrade records."""
    records = []
    for t in raw_trades:
        mid  = t.get("market", "")
        meta = market_cache.get(mid, {})
        end  = meta.get("endDate") or meta.get("end_date_iso")
        ts   = pd.Timestamp(t["timestamp"], tz="UTC")
        records.append(NormalizedTrade(
            timestamp          = ts,
            market_id          = mid,
            market_question    = t.get("title") or meta.get("question", ""),
            category           = meta.get("category", "unknown"),
            outcome            = t.get("outcome", ""),
            side               = t.get("side", ""),
            size_usdc          = float(t.get("usdcSize", 0)),
            price              = float(t.get("price", 0)),
            transaction_hash   = t.get("transactionHash", ""),
            market_end_date    = pd.Timestamp(end, tz="UTC") if end else None,
            days_to_resolution = _days_to_res(ts, end),
            market_volume_usdc = float(meta.get("volume", 0)) if meta.get("volume") else None,
            spread             = float(meta.get("spread", 0)) if meta.get("spread") else None,
        ))
    df = pd.DataFrame([asdict(r) for r in records])
    df.sort_values("timestamp", inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

async def build_trade_ledger(username: str) -> pd.DataFrame:
    """End-to-end: username → clean normalised DataFrame."""
    address    = await resolve_username_to_address(username)
    raw_trades = await fetch_raw_trades(address)
    if not raw_trades:
        raise RuntimeError(f"No trades found for {address}")

    # Fetch unique market metadata
    market_ids    = list({t["market"] for t in raw_trades})
    market_cache  = {}
    sem           = asyncio.Semaphore(10)

    async def _fetch(mid: str):
        async with sem:
            try:
                market_cache[mid] = await fetch_market_metadata(mid)
            except Exception as e:
                log.warning(f"Failed to fetch market {mid}: {e}")

    await asyncio.gather(*[_fetch(mid) for mid in market_ids])
    df = normalize_trades(raw_trades, market_cache)
    log.info(f"Ledger built: {len(df)} rows, {df['market_id'].nunique()} unique markets")
    return df


if __name__ == "__main__":
    df = asyncio.run(build_trade_ledger(TARGET_USERNAME))
    df.to_csv("trade_ledger_raw.csv", index=False)
    print(df.head())
