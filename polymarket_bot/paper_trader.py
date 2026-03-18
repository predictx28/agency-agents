"""
paper_trader.py — Simulated order execution for paper trading mode.

Simulates fills at the requested limit price with a configurable
slippage model. Records all activity to the risk state and trade log
without touching real capital.
"""

import asyncio
import logging
import random
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from .config import Config
from .risk import RiskState
from .sizer import OrderIntent

logger = logging.getLogger(__name__)


@dataclass
class FillResult:
    success: bool
    market_id: str
    outcome: str
    price: float
    size_usdc: float
    tokens: float
    fill_price: float        # simulated actual fill (slight slippage)
    side: str                # "BUY" or "SELL"
    timestamp: str
    reason: str = ""         # rejection reason if not success


class PaperTrader:
    """
    Simulates order execution for paper trading.
    Applies a small random slippage (±0.5 cents) to the fill price
    to model real market conditions.
    """

    SLIPPAGE_SIGMA = 0.005   # std dev of normal slippage in price units

    def __init__(self, cfg: Config, risk: RiskState) -> None:
        self.cfg  = cfg
        self.risk = risk
        self._fills: list[FillResult] = []

    async def execute_buy(self, intent: OrderIntent) -> FillResult:
        """Simulate filling a BUY limit order."""
        await asyncio.sleep(self.cfg.order_delay_sec)   # rate limiting

        allowed, reason = self.risk.can_trade(
            intent.market_id, intent.outcome, intent.size_usdc
        )
        if not allowed:
            logger.debug("Paper BUY blocked: %s", reason)
            return self._rejected(intent, "BUY", reason)

        fill_price = self._simulate_fill(intent.price, side="buy")
        tokens     = intent.size_usdc / fill_price if fill_price > 0 else 0.0

        self.risk.record_buy(intent.market_id, intent.outcome, intent.size_usdc, fill_price)

        result = FillResult(
            success=True,
            market_id=intent.market_id,
            outcome=intent.outcome,
            price=intent.price,
            size_usdc=intent.size_usdc,
            tokens=tokens,
            fill_price=fill_price,
            side="BUY",
            timestamp=_now(),
        )
        self._fills.append(result)
        logger.info(
            "[PAPER] BUY  %-8s  %-55s  price=%.4f  fill=%.4f  $%.2f",
            intent.outcome,
            intent.question[:55],
            intent.price,
            fill_price,
            intent.size_usdc,
        )
        return result

    async def execute_sell(
        self,
        market_id: str,
        question: str,
        outcome: str,
        tokens: float,
        price: float,
    ) -> FillResult:
        """Simulate filling a SELL limit order."""
        await asyncio.sleep(self.cfg.order_delay_sec)

        fill_price  = self._simulate_fill(price, side="sell")
        size_usdc   = tokens * fill_price

        self.risk.record_sell(market_id, outcome, size_usdc, fill_price)

        result = FillResult(
            success=True,
            market_id=market_id,
            outcome=outcome,
            price=price,
            size_usdc=size_usdc,
            tokens=tokens,
            fill_price=fill_price,
            side="SELL",
            timestamp=_now(),
        )
        self._fills.append(result)
        logger.info(
            "[PAPER] SELL %-8s  %-55s  price=%.4f  fill=%.4f  $%.2f",
            outcome,
            question[:55],
            price,
            fill_price,
            size_usdc,
        )
        return result

    def _simulate_fill(self, price: float, side: str) -> float:
        """Apply small random slippage: buys fill slightly higher, sells lower."""
        noise = random.gauss(0, self.SLIPPAGE_SIGMA)
        if side == "buy":
            return max(0.001, min(0.999, price + abs(noise)))
        else:
            return max(0.001, min(0.999, price - abs(noise)))

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

    @property
    def fills(self) -> list[FillResult]:
        return list(self._fills)

    def total_fills(self) -> int:
        return len([f for f in self._fills if f.success])

    def total_buy_usdc(self) -> float:
        return sum(f.size_usdc for f in self._fills if f.success and f.side == "BUY")

    def total_sell_usdc(self) -> float:
        return sum(f.size_usdc for f in self._fills if f.success and f.side == "SELL")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
