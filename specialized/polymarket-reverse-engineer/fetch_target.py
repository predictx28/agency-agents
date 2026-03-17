"""
Polymarket Data Fetcher — @k9Q2mX4L8A7ZP3R
============================================
Run this script locally (needs network access to polymarket APIs).
It will produce two files:
  - trades_k9Q2mX4L8A7ZP3R.json   (raw trade history)
  - markets_k9Q2mX4L8A7ZP3R.json  (market metadata for each trade)

Dependencies:
  pip install httpx

Usage:
  python fetch_target.py
"""

import asyncio
import json
import sys
from pathlib import Path

try:
    import httpx
except ImportError:
    sys.exit("Missing dependency: run  pip install httpx  then retry.")

TARGET_USERNAME = "k9Q2mX4L8A7ZP3R"
WALLET_ADDRESS  = "0xd0d6053c3c37e727402d84c14069780d360993aa"

DATA_API  = "https://data-api.polymarket.com"
GAMMA_API = "https://gamma-api.polymarket.com"
HEADERS   = {"User-Agent": "polymarket-re-fetcher/1.0", "Accept": "application/json"}

OUT_TRADES  = f"trades_{TARGET_USERNAME}.json"
OUT_MARKETS = f"markets_{TARGET_USERNAME}.json"


async def probe_endpoints(address: str, client: httpx.AsyncClient):
    """
    Hit every plausible trade endpoint and print what comes back,
    so we can see exactly which ones work.
    """
    candidates = [
        f"{DATA_API}/trades?user={address}&limit=5",
        f"{DATA_API}/activity?user={address}&limit=5",
        f"{DATA_API}/positions?user={address}&limit=5",
        f"{GAMMA_API}/trades?user={address}&limit=5",
        f"{GAMMA_API}/activity?user={address}&limit=5",
    ]
    print("\n  Probing endpoints …")
    working = []
    for url in candidates:
        try:
            r = await client.get(url, headers=HEADERS, timeout=10)
            snippet = r.text[:120].replace("\n", " ")
            print(f"  [{r.status_code}] {url}")
            print(f"         → {snippet}")
            if r.status_code == 200:
                working.append(url)
        except Exception as e:
            print(f"  [ERR] {url} → {e}")
    return working


async def fetch_all_trades(address: str, client: httpx.AsyncClient) -> list[dict]:
    """
    Try every known Polymarket trade endpoint; paginate whichever one
    returns data.
    """
    endpoints = [
        # data-api with 'user' param (primary)
        {"base": f"{DATA_API}/trades",    "param": "user"},
        # data-api activity feed
        {"base": f"{DATA_API}/activity",  "param": "user"},
        # gamma-api fallback with 'user' param
        {"base": f"{GAMMA_API}/trades",   "param": "user"},
    ]

    for ep in endpoints:
        base, param = ep["base"], ep["param"]
        all_trades: list[dict] = []
        offset = 0
        success = False
        while True:
            try:
                r = await client.get(
                    base,
                    params={param: address, "limit": 500, "offset": offset},
                    headers=HEADERS,
                    timeout=30,
                )
                if r.status_code == 404:
                    print(f"  404 on {base} — skipping")
                    break
                r.raise_for_status()
                data = r.json()
                # Some endpoints wrap results in a key
                if isinstance(data, dict):
                    batch = data.get("data") or data.get("results") or data.get("trades") or []
                else:
                    batch = data
                if not batch:
                    break
                all_trades.extend(batch)
                print(f"  [{base}] fetched {len(all_trades)} trades …")
                success = True
                if len(batch) < 500:
                    break
                offset += len(batch)
            except Exception as e:
                print(f"  Error on {base} (offset={offset}): {e}")
                break

        if success and all_trades:
            print(f"  ✓ Using endpoint: {base}  ({len(all_trades)} raw records)")
            # Deduplicate
            seen, unique = set(), []
            for t in all_trades:
                key = (t.get("transactionHash") or t.get("txHash")
                       or t.get("id") or json.dumps(t, sort_keys=True))
                if key not in seen:
                    seen.add(key)
                    unique.append(t)
            return unique

    return []


async def fetch_markets(market_ids: list[str], client: httpx.AsyncClient) -> dict[str, dict]:
    cache: dict[str, dict] = {}
    sem = asyncio.Semaphore(8)

    async def _one(mid: str):
        async with sem:
            for base in (GAMMA_API, DATA_API):
                try:
                    r = await client.get(f"{base}/markets/{mid}",
                                         headers=HEADERS, timeout=15)
                    if r.status_code == 200:
                        cache[mid] = r.json()
                        return
                except Exception:
                    pass
            cache[mid] = {"id": mid, "error": "not_found"}

    await asyncio.gather(*[_one(mid) for mid in market_ids])
    return cache


async def main():
    print(f"\n=== Polymarket Fetcher — @{TARGET_USERNAME} ===")
    print(f"    Wallet: {WALLET_ADDRESS}\n")

    async with httpx.AsyncClient(follow_redirects=True) as client:

        # Probe so we can see what's live
        print("Step 1: Probing available endpoints …")
        await probe_endpoints(WALLET_ADDRESS, client)

        # Fetch trades
        print(f"\nStep 2: Fetching all trades …")
        trades = await fetch_all_trades(WALLET_ADDRESS, client)
        print(f"  Total unique trades: {len(trades)}")

        if not trades:
            print("\nNo trades found across any endpoint.")
            print("Paste the raw first-trade JSON if you can see trades on the profile page.")
            sys.exit(1)

        # Fetch market metadata
        market_ids = list(
            {t.get("market") or t.get("conditionId") or t.get("marketId", "")
             for t in trades} - {""}
        )
        print(f"\nStep 3: Fetching metadata for {len(market_ids)} markets …")
        markets = await fetch_markets(market_ids, client)

        # Save
        meta = {
            "target_username": TARGET_USERNAME,
            "wallet_address":  WALLET_ADDRESS,
            "trade_count":     len(trades),
            "market_count":    len(markets),
        }
        Path(OUT_TRADES).write_text(
            json.dumps({"meta": meta, "trades": trades}, indent=2, default=str))
        Path(OUT_MARKETS).write_text(
            json.dumps({"meta": meta, "markets": markets}, indent=2, default=str))

        print(f"\n✅  {OUT_TRADES}  ({Path(OUT_TRADES).stat().st_size // 1024} KB)")
        print(f"✅  {OUT_MARKETS}  ({Path(OUT_MARKETS).stat().st_size // 1024} KB)")
        print("\nShare both files for the real analysis.")


if __name__ == "__main__":
    asyncio.run(main())
