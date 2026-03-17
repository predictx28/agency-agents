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
GAMMA_API       = "https://gamma-api.polymarket.com"
HEADERS         = {"User-Agent": "polymarket-re-fetcher/1.0", "Accept": "application/json"}
OUT_TRADES      = f"trades_{TARGET_USERNAME}.json"
OUT_MARKETS     = f"markets_{TARGET_USERNAME}.json"


async def resolve_username(username: str, client: httpx.AsyncClient) -> str:
    """Try several endpoint patterns to find the wallet address."""
    attempts = [
        f"{GAMMA_API}/profiles?username={username}",
        f"{GAMMA_API}/users?username={username}",
        f"{GAMMA_API}/profiles/{username}",
    ]
    for url in attempts:
        try:
            r = await client.get(url, headers=HEADERS, timeout=15)
            if r.status_code == 200:
                data = r.json()
                # Handle list or single object
                obj = data[0] if isinstance(data, list) and data else data
                if isinstance(obj, dict):
                    addr = (
                        obj.get("proxyWallet")
                        or obj.get("address")
                        or obj.get("wallet")
                        or obj.get("id")
                    )
                    if addr and addr.startswith("0x"):
                        print(f"  Resolved via {url}")
                        print(f"  Wallet: {addr}")
                        return addr
        except Exception as e:
            print(f"  {url} → {e}")
    return ""


async def fetch_all_trades(address: str, client: httpx.AsyncClient) -> list[dict]:
    """Paginate through all trades for the wallet (maker + taker)."""
    all_trades: list[dict] = []
    for role in ("maker", "taker"):
        offset = 0
        while True:
            try:
                r = await client.get(
                    f"{GAMMA_API}/trades",
                    params={"maker" if role == "maker" else "taker": address,
                            "limit": 500, "offset": offset},
                    headers=HEADERS,
                    timeout=30,
                )
                r.raise_for_status()
                batch = r.json()
                if not batch:
                    break
                all_trades.extend(batch)
                print(f"  {role} trades fetched: {len(all_trades)} total …")
                if len(batch) < 500:
                    break
                offset += len(batch)
            except Exception as e:
                print(f"  Trade fetch error ({role}, offset={offset}): {e}")
                break
    # Deduplicate by transactionHash
    seen = set()
    unique = []
    for t in all_trades:
        key = t.get("transactionHash") or t.get("id") or json.dumps(t, sort_keys=True)
        if key not in seen:
            seen.add(key)
            unique.append(t)
    return unique


async def fetch_markets(market_ids: list[str], client: httpx.AsyncClient) -> dict[str, dict]:
    """Fetch metadata for every unique market in the trade history."""
    cache: dict[str, dict] = {}
    sem = asyncio.Semaphore(8)

    async def _one(mid: str):
        async with sem:
            try:
                r = await client.get(
                    f"{GAMMA_API}/markets/{mid}",
                    headers=HEADERS, timeout=15,
                )
                if r.status_code == 200:
                    cache[mid] = r.json()
                else:
                    cache[mid] = {"id": mid, "error": r.status_code}
            except Exception as e:
                cache[mid] = {"id": mid, "error": str(e)}

    await asyncio.gather(*[_one(mid) for mid in market_ids])
    return cache


async def main():
    print(f"\n=== Polymarket Fetcher — @{TARGET_USERNAME} ===\n")

    async with httpx.AsyncClient(follow_redirects=True) as client:

        # 1. Resolve username → wallet
        print("Step 1: Resolving username to wallet address …")
        address = await resolve_username(TARGET_USERNAME, client)
        if not address:
            print("\nCould not resolve username automatically.")
            address = input("Paste the wallet address manually (0x…): ").strip()
        if not address:
            sys.exit("No wallet address — aborting.")

        # 2. Fetch trades
        print(f"\nStep 2: Fetching trade history for {address} …")
        trades = await fetch_all_trades(address, client)
        print(f"  Total unique trades: {len(trades)}")

        if not trades:
            print("\nNo trades found. Possible reasons:")
            print("  • Username doesn't match any wallet")
            print("  • Wallet has no on-chain trades via Polymarket")
            print("  • API endpoint changed")
            sys.exit(1)

        # 3. Fetch market metadata
        market_ids = list({t.get("market", "") or t.get("conditionId", "") for t in trades} - {""})
        print(f"\nStep 3: Fetching metadata for {len(market_ids)} unique markets …")
        markets = await fetch_markets(market_ids, client)
        print(f"  Markets fetched: {len(markets)}")

        # 4. Save outputs
        meta = {
            "target_username": TARGET_USERNAME,
            "wallet_address":  address,
            "trade_count":     len(trades),
            "market_count":    len(markets),
        }
        payload_trades  = {"meta": meta, "trades": trades}
        payload_markets = {"meta": meta, "markets": markets}

        Path(OUT_TRADES).write_text(json.dumps(payload_trades,  indent=2, default=str))
        Path(OUT_MARKETS).write_text(json.dumps(payload_markets, indent=2, default=str))

        print(f"\n✅  Saved:  {OUT_TRADES}  ({Path(OUT_TRADES).stat().st_size // 1024} KB)")
        print(f"✅  Saved:  {OUT_MARKETS}  ({Path(OUT_MARKETS).stat().st_size // 1024} KB)")
        print("\nShare both files and the analysis pipeline will run on real data.")


if __name__ == "__main__":
    asyncio.run(main())
