"""
bot.py — Main async bot loop.

Orchestrates: scan → signal → risk check → execute → log → dashboard
"""

import asyncio
import logging
from typing import Union

from .config import Config
from .market_scanner import Market, fetch_markets
from .monitor import Monitor
from .paper_trader import FillResult, PaperTrader
from .risk import RiskState
from .sizer import OrderIntent, build_order_intents, total_intent_usdc

logger = logging.getLogger(__name__)


class PolymarketLPBot:
    """
    LP Seeding Bot that replicates the reverse-engineered strategy:
      1. Scan all active markets passing the liquidity filter
      2. For each market, generate two-sided BUY intents (Up + Down)
         using the price-proportional sizing rule
      3. Check risk gates before each order
      4. Execute orders (paper or live)
      5. Log fills and print dashboard
    """

    def __init__(
        self,
        cfg: Config,
        executor: Union[PaperTrader, "LiveExecutor"],  # noqa: F821
        risk: RiskState,
        monitor: Monitor,
    ) -> None:
        self.cfg      = cfg
        self.executor = executor
        self.risk     = risk
        self.monitor  = monitor
        self._running = False

    async def run_once(self) -> tuple[int, int, int]:
        """
        Execute one full scan-and-trade cycle.
        Returns (markets_scanned, intents_generated, fills_executed).
        """
        # 1 — Fetch qualifying markets
        try:
            markets = await fetch_markets(self.cfg)
        except Exception as exc:
            logger.error("Market scan failed: %s", exc)
            return 0, 0, 0

        intents_generated = 0
        fills_executed    = 0
        market_prices: dict[str, dict[str, float]] = {}

        for market in markets:
            if self.risk.halted:
                logger.warning("Bot halted — skipping remaining markets")
                break

            # Track current prices for unrealised P&L
            market_prices[market.id] = {
                "Up":   market.up_price,
                "Down": market.down_price,
            }

            # 2 — Generate intents
            intents = build_order_intents(
                market=market,
                cfg=self.cfg,
                exposure_up_usdc=self.risk.exposure_for(market.id, "Up"),
                exposure_down_usdc=self.risk.exposure_for(market.id, "Down"),
            )

            if not intents:
                continue

            intents_generated += len(intents)

            # 3 — Execute each intent
            fills = await self._execute_intents(intents)
            fills_executed += len([f for f in fills if f.success])

            # 4 — Log fills
            self.monitor.log_fills(fills)

            # Small delay between markets to avoid hammering the API
            await asyncio.sleep(0.1)

        return len(markets), intents_generated, fills_executed, market_prices

    async def _execute_intents(self, intents: list[OrderIntent]) -> list[FillResult]:
        fills = []
        for intent in intents:
            if self.risk.halted:
                break
            fill = await self.executor.execute_buy(intent)
            fills.append(fill)
        return fills

    async def run(self) -> None:
        """Main loop: scan → trade → sleep → repeat."""
        self._running = True
        logger.info("Bot started in %s mode", self.cfg.mode.upper())

        while self._running:
            if self.risk.halted:
                logger.critical("Bot halted. Stopping loop.")
                break

            result = await self.run_once()
            if len(result) == 4:
                markets_scanned, intents_gen, fills_exec, prices = result
            else:
                markets_scanned, intents_gen, fills_exec = result
                prices = {}

            self.monitor.print_dashboard(
                markets_scanned=markets_scanned,
                intents_generated=intents_gen,
                fills_this_cycle=fills_exec,
                market_prices=prices,
            )

            await asyncio.sleep(self.cfg.scan_interval_sec)

    def stop(self) -> None:
        self._running = False
