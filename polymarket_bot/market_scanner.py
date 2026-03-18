"""
market_scanner.py — Polls the Polymarket Gamma API for active markets
and returns those that pass the liquidity / spread filter.
"""

import asyncio
import logging
from dataclasses import dataclass
from typing import Optional

import httpx

from .config import Config

logger = logging.getLogger(__name__)

GAMMA_API = "https://gamma-api.polymarket.com"
_TIMEOUT  = httpx.Timeout(15.0)


@dataclass
class Market:
    id: str
    question: str
    category: str
    yes_price: float      # price of the "Up" / YES token
    no_price: float       # price of the "Down" / NO token
    spread: float         # best_ask_yes - best_bid_yes (approx)
    volume_usdc: float
    liquidity_usdc: float
    active: bool

    @property
    def up_price(self) -> float:
        return self.yes_price

    @property
    def down_price(self) -> float:
        # Down price is complement in binary market
        return round(1.0 - self.yes_price, 6)


def _parse_market(raw: dict) -> Optional[Market]:
    """Parse a raw Gamma API market dict into a Market object."""
    try:
        outcome_prices = raw.get("outcomePrices", [])
        if not outcome_prices or len(outcome_prices) < 2:
            return None

        yes_price = float(outcome_prices[0])
        no_price  = float(outcome_prices[1])

        # Derive spread from best bid/ask if available, else use price gap
        best_ask = raw.get("bestAsk")
        best_bid = raw.get("bestBid")
        if best_ask and best_bid:
            spread = float(best_ask) - float(best_bid)
        else:
            spread = abs(yes_price - (1.0 - no_price))  # fallback

        volume    = float(raw.get("volume",    raw.get("volumeNum",    0)) or 0)
        liquidity = float(raw.get("liquidity", raw.get("liquidityNum", 0)) or 0)

        return Market(
            id=raw["id"],
            question=raw.get("question", raw.get("title", "")),
            category=raw.get("category", "unknown"),
            yes_price=yes_price,
            no_price=no_price,
            spread=spread,
            volume_usdc=volume,
            liquidity_usdc=liquidity,
            active=bool(raw.get("active", True)),
        )
    except (KeyError, TypeError, ValueError) as exc:
        logger.debug("Failed to parse market %s: %s", raw.get("id", "?"), exc)
        return None


async def fetch_markets(cfg: Config) -> list[Market]:
    """
    Fetch active markets from Gamma API and return those passing
    the volume and spread filters defined in cfg.
    """
    markets: list[Market] = []
    offset = 0
    limit  = 100

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        while True:
            try:
                resp = await client.get(
                    f"{GAMMA_API}/markets",
                    params={
                        "active":  "true",
                        "closed":  "false",
                        "limit":   limit,
                        "offset":  offset,
                    },
                )
                resp.raise_for_status()
                batch = resp.json()
            except httpx.HTTPError as exc:
                logger.warning("Gamma API error (offset=%d): %s", offset, exc)
                break

            if not batch:
                break

            for raw in batch:
                mkt = _parse_market(raw)
                if mkt and _passes_filter(mkt, cfg):
                    markets.append(mkt)

            if len(batch) < limit:
                break
            offset += limit
            await asyncio.sleep(0.2)   # be polite to the API

    logger.info("Scanner found %d qualifying markets", len(markets))
    return markets


def _passes_filter(mkt: Market, cfg: Config) -> bool:
    if not mkt.active:
        return False
    if mkt.volume_usdc < cfg.min_market_volume_usdc:
        return False
    if mkt.spread > cfg.max_spread:
        return False
    if not (cfg.min_price <= mkt.yes_price <= cfg.max_price):
        return False
    return True
