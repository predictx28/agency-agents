"""
executor.py — Live order execution via the Polymarket CLOB API.

Requires:
    pip install py-clob-client

Official docs: https://github.com/Polymarket/py-clob-client

The ClobClient handles:
  - EIP-712 order signing with your private key
  - Submission to the Polymarket CLOB
  - Order status polling

Set BOT_MODE=live in .env to activate this executor.
ALWAYS paper trade first.
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from .config import Config
from .paper_trader import FillResult
from .risk import RiskState
from .sizer import OrderIntent

logger = logging.getLogger(__name__)

# ── Conditional import (py-clob-client may not be installed) ──────────────────
try:
    from py_clob_client.client import ClobClient
    from py_clob_client.clob_types import (
        ApiCreds,
        MarketOrderArgs,
        OrderArgs,
        OrderType,
    )
    from py_clob_client.constants import POLYGON
    _CLOB_AVAILABLE = True
except ImportError:
    _CLOB_AVAILABLE = False
    logger.warning(
        "py-clob-client not installed. Live trading unavailable. "
        "Run: pip install py-clob-client"
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class LiveExecutor:
    """
    Submits real limit orders to the Polymarket CLOB.
    Requires a funded Polygon wallet with USDC approved to the CTF Exchange.
    """

    def __init__(self, cfg: Config, risk: RiskState) -> None:
        if not _CLOB_AVAILABLE:
            raise RuntimeError(
                "py-clob-client is not installed. "
                "Install it with: pip install py-clob-client"
            )
        if not cfg.private_key:
            raise ValueError("POLYMARKET_PRIVATE_KEY is not set.")

        self.cfg  = cfg
        self.risk = risk

        # Initialise CLOB client
        # The client signs orders with your private key using EIP-712
        self._client = ClobClient(
            host="https://clob.polymarket.com",
            chain_id=POLYGON,
            key=cfg.private_key,
        )
        # Derive API credentials from the wallet (creates them on first call)
        try:
            self._creds: ApiCreds = self._client.create_or_derive_api_creds()
            self._client.set_api_creds(self._creds)
            logger.info("CLOB client authenticated: %s", self._creds.api_key[:8] + "…")
        except Exception as exc:
            raise RuntimeError(f"CLOB authentication failed: {exc}") from exc

    async def execute_buy(self, intent: OrderIntent) -> FillResult:
        """Submit a BUY limit order to the Polymarket CLOB."""
        allowed, reason = self.risk.can_trade(
            intent.market_id, intent.outcome, intent.size_usdc
        )
        if not allowed:
            logger.warning("Live BUY blocked: %s", reason)
            return self._rejected(intent, "BUY", reason)

        # Convert USDC size to token count at limit price
        token_amount = int((intent.size_usdc / intent.price) * 1_000_000)  # micro-USDC

        try:
            order_args = OrderArgs(
                price=intent.price,
                size=token_amount,
                side="BUY",
                token_id=self._resolve_token_id(intent.market_id, intent.outcome),
            )
            resp = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._client.create_and_post_order(order_args),
            )
            order_id = resp.get("orderID", "unknown")
            logger.info(
                "[LIVE ] BUY  %-8s  %-55s  price=%.4f  $%.2f  order_id=%s",
                intent.outcome, intent.question[:55],
                intent.price, intent.size_usdc, order_id,
            )
            self.risk.record_buy(intent.market_id, intent.outcome, intent.size_usdc, intent.price)
            return FillResult(
                success=True,
                market_id=intent.market_id,
                outcome=intent.outcome,
                price=intent.price,
                size_usdc=intent.size_usdc,
                tokens=token_amount / 1_000_000,
                fill_price=intent.price,
                side="BUY",
                timestamp=_now(),
            )
        except Exception as exc:
            logger.error("Live BUY failed: %s", exc)
            return self._rejected(intent, "BUY", str(exc))

    async def execute_sell(
        self,
        market_id: str,
        question: str,
        outcome: str,
        tokens: float,
        price: float,
    ) -> FillResult:
        """Submit a SELL limit order to the Polymarket CLOB."""
        token_amount = int(tokens * 1_000_000)
        size_usdc    = tokens * price

        try:
            order_args = OrderArgs(
                price=price,
                size=token_amount,
                side="SELL",
                token_id=self._resolve_token_id(market_id, outcome),
            )
            resp = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._client.create_and_post_order(order_args),
            )
            order_id = resp.get("orderID", "unknown")
            logger.info(
                "[LIVE ] SELL %-8s  %-55s  price=%.4f  $%.2f  order_id=%s",
                outcome, question[:55], price, size_usdc, order_id,
            )
            self.risk.record_sell(market_id, outcome, size_usdc, price)
            return FillResult(
                success=True,
                market_id=market_id,
                outcome=outcome,
                price=price,
                size_usdc=size_usdc,
                tokens=tokens,
                fill_price=price,
                side="SELL",
                timestamp=_now(),
            )
        except Exception as exc:
            logger.error("Live SELL failed: %s", exc)
            return FillResult(
                success=False,
                market_id=market_id,
                outcome=outcome,
                price=price,
                size_usdc=size_usdc,
                tokens=tokens,
                fill_price=price,
                side="SELL",
                timestamp=_now(),
                reason=str(exc),
            )

    def _resolve_token_id(self, market_id: str, outcome: str) -> str:
        """
        Resolve the ERC-1155 token ID for a given market and outcome.
        On Polymarket, each outcome is a distinct conditional token.
        You can look up token IDs from the Gamma API market data.
        """
        # In a full implementation, cache token IDs from market data:
        #   market["clobTokenIds"][0]  → YES/Up token
        #   market["clobTokenIds"][1]  → NO/Down token
        # For now, return the market_id as a placeholder.
        # TODO: populate from market scanner data
        raise NotImplementedError(
            "Token ID resolution not yet implemented. "
            "Fetch from Gamma API: market['clobTokenIds'][0 or 1]"
        )

    def _rejected(self, intent: OrderIntent, side: str, reason: str) -> FillResult:
        return FillResult(
            success=False,
            market_id=intent.market_id,
            outcome=intent.outcome,
            price=intent.price,
            size_usdc=intent.size_usdc,
            tokens=0.0,
            fill_price=intent.price,
            side=side,
            timestamp=_now(),
            reason=reason,
        )
