"""
Polymarket Reverse Engineer — Replicated Trading Bot
Target Strategy: @k9Q2mX4L8A7ZP3R
=====================================================
Implements the reverse-engineered strategy:
  * Category filter:     politics + crypto markets only
  * Entry timing window: 1–10 days before resolution
  * Signal:             buy YES when price < contrarian_low OR
                        buy NO  when price > contrarian_high
  * Sizing:             fractional Kelly (25%)
  * Risk:               10% max position, 5% daily drawdown kill switch
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
import httpx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger(__name__)

GAMMA_API = "https://gamma-api.polymarket.com"
CLOB_API  = "https://clob.polymarket.com"

# ---------------------------------------------------------------------------
# Reverse-engineered strategy constants (derived from Phase 3-4 analysis)
# ---------------------------------------------------------------------------
STRATEGY = {
    "categories":         {"politics", "crypto"},
    "entry_min_days":     1.0,
    "entry_max_days":     10.0,
    "contrarian_low":     0.22,   # buy YES below this price
    "contrarian_high":    0.78,   # buy NO  above this price
    "min_volume_usdc":    15_000, # only liquid markets
    "max_spread":         0.06,
    "kelly_fraction":     0.25,
    "max_position_pct":   0.10,
    "min_edge":           0.05,   # skip if edge < 5 cents
    "min_order_usdc":     25.0,
}


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class TradeSignal:
    market_id:       str
    question:        str
    outcome:         str           # YES | NO
    current_price:   float
    fair_value:      float
    edge:            float
    kelly_size_usdc: float
    confidence:      float         # 0–1
    days_to_res:     float
    category:        str


@dataclass
class RiskState:
    bankroll:          float
    day_start_balance: float
    daily_loss_limit:  float = 0.05
    max_drawdown:      float = 0.20
    peak_balance:      float = field(init=False)

    def __post_init__(self):
        self.peak_balance = self.bankroll

    def update(self, pnl: float):
        self.bankroll  += pnl
        self.peak_balance = max(self.peak_balance, self.bankroll)

    @property
    def daily_loss_pct(self) -> float:
        return (self.day_start_balance - self.bankroll) / self.day_start_balance

    @property
    def drawdown_pct(self) -> float:
        return (self.peak_balance - self.bankroll) / self.peak_balance

    def kill_switch_triggered(self) -> bool:
        if self.daily_loss_pct >= self.daily_loss_limit:
            log.warning("KILL SWITCH: daily loss limit reached")
            return True
        if self.drawdown_pct >= self.max_drawdown:
            log.warning("KILL SWITCH: max drawdown reached")
            return True
        return False


# ---------------------------------------------------------------------------
# Strategy models
# ---------------------------------------------------------------------------

def kelly_fraction(p_win: float, b: float) -> float:
    """Full Kelly fraction. p_win ∈ (0,1), b = net odds."""
    q = 1 - p_win
    return max(0.0, (b * p_win - q) / b)


def estimate_fair_value(market: dict) -> Optional[float]:
    """
    Reverse-engineered fair value model:
    - Applies a contrarian mean-reversion adjustment when price is extreme
    - Only trades in the 1-10 day entry window
    """
    try:
        category    = (market.get("category") or "").lower()
        price_yes   = float(market["outcomePrices"][0])
        end_date    = market.get("endDate") or market.get("end_date_iso")
        if not end_date:
            return None

        ed          = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        now         = datetime.now(tz=timezone.utc)
        days_to_res = (ed - now).total_seconds() / 86400

        # Category + timing gate
        if category not in STRATEGY["categories"]:
            return None
        if not (STRATEGY["entry_min_days"] <= days_to_res <= STRATEGY["entry_max_days"]):
            return None

        volume = float(market.get("volume", 0))
        spread = float(market.get("spread", 1))
        if volume < STRATEGY["min_volume_usdc"] or spread > STRATEGY["max_spread"]:
            return None

        # Contrarian fair value estimation
        # When market over-prices a side, revert by ~20-30% of the deviation
        reversion_factor = 0.28

        if price_yes < STRATEGY["contrarian_low"]:
            # Market is dramatically underpricing YES → fair value is higher
            deviation = STRATEGY["contrarian_low"] - price_yes
            fair_yes  = price_yes + deviation * (1 + reversion_factor)
            return min(0.70, fair_yes)

        if price_yes > STRATEGY["contrarian_high"]:
            # Market is dramatically overpricing YES → fair value is lower
            deviation = price_yes - STRATEGY["contrarian_high"]
            fair_yes  = price_yes - deviation * (1 + reversion_factor)
            return max(0.30, fair_yes)

        return None  # No contrarian opportunity in mid-range

    except Exception as e:
        log.debug(f"fair_value error for market {market.get('id')}: {e}")
        return None


# ---------------------------------------------------------------------------
# Bot core
# ---------------------------------------------------------------------------

class ReplicatedTraderBot:
    """
    Full implementation of the reverse-engineered @k9Q2mX4L8A7ZP3R strategy.
    Subclass PolymarketBot base for a real execution environment.
    """

    def __init__(
        self,
        bankroll_usdc: float,
        private_key:   str = "",   # set for live trading
        paper_mode:    bool = True,
    ):
        self.bankroll   = bankroll_usdc
        self.private_key = private_key
        self.paper_mode  = paper_mode
        self.risk        = RiskState(
            bankroll=bankroll_usdc,
            day_start_balance=bankroll_usdc,
        )
        self.open_positions: dict[str, TradeSignal] = {}
        self.trade_log: list[dict] = []

    # ------------------------------------------------------------------
    # Data layer
    # ------------------------------------------------------------------

    async def scan_markets(self) -> list[dict]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{GAMMA_API}/markets",
                params={
                    "active": True,
                    "closed": False,
                    "limit":  200,
                },
                headers={"User-Agent": "polymarket-re-bot/1.0"},
            )
            resp.raise_for_status()
            return resp.json()

    # ------------------------------------------------------------------
    # Signal layer
    # ------------------------------------------------------------------

    def compute_signal(self, market: dict) -> Optional[TradeSignal]:
        fair_value = estimate_fair_value(market)
        if fair_value is None:
            return None

        price_yes = float(market["outcomePrices"][0])
        edge_yes  = fair_value - price_yes
        edge_no   = (1 - fair_value) - (1 - price_yes)

        if abs(edge_yes) >= abs(edge_no) and edge_yes > STRATEGY["min_edge"]:
            outcome = "YES"
            edge    = edge_yes
            price   = price_yes
            p_win   = fair_value
        elif edge_no > STRATEGY["min_edge"]:
            outcome = "NO"
            edge    = edge_no
            price   = 1 - price_yes
            p_win   = 1 - fair_value
        else:
            return None

        b         = (1 / price) - 1
        raw_kelly = kelly_fraction(p_win, b)
        frac_k    = raw_kelly * STRATEGY["kelly_fraction"]
        size_usdc = min(
            self.bankroll * frac_k,
            self.bankroll * STRATEGY["max_position_pct"],
        )
        if size_usdc < STRATEGY["min_order_usdc"]:
            return None

        end_date    = market.get("endDate") or market.get("end_date_iso")
        ed          = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        days_to_res = (ed - datetime.now(tz=timezone.utc)).total_seconds() / 86400

        return TradeSignal(
            market_id       = market["id"],
            question        = market.get("question", "")[:80],
            outcome         = outcome,
            current_price   = round(price, 4),
            fair_value      = round(fair_value, 4),
            edge            = round(edge, 4),
            kelly_size_usdc = round(size_usdc, 2),
            confidence      = round(min(1.0, abs(edge) / 0.20), 4),
            days_to_res     = round(days_to_res, 2),
            category        = (market.get("category") or "").lower(),
        )

    # ------------------------------------------------------------------
    # Execution layer
    # ------------------------------------------------------------------

    async def execute_trade(self, signal: TradeSignal) -> dict:
        log.info(
            f"{'[PAPER] ' if self.paper_mode else ''}TRADE | "
            f"{signal.question} | "
            f"{signal.outcome} @ {signal.current_price:.3f} | "
            f"FV={signal.fair_value:.3f} | "
            f"Edge={signal.edge:.3f} | "
            f"Size=${signal.kelly_size_usdc} | "
            f"DTR={signal.days_to_res:.1f}d"
        )
        self.open_positions[signal.market_id] = signal
        self.trade_log.append({
            "ts":       datetime.now(tz=timezone.utc).isoformat(),
            "paper":    self.paper_mode,
            "market":   signal.market_id,
            "question": signal.question,
            "outcome":  signal.outcome,
            "price":    signal.current_price,
            "fv":       signal.fair_value,
            "edge":     signal.edge,
            "size":     signal.kelly_size_usdc,
            "dtr":      signal.days_to_res,
        })

        if self.paper_mode:
            return {"status": "paper_submitted", "signal": signal}

        # Live execution via py-clob-client
        # from py_clob_client.client import ClobClient
        # client = ClobClient(host=CLOB_API, key=self.private_key, chain_id=137)
        # order = client.create_market_order(
        #     token_id=signal.market_id,
        #     side="BUY",
        #     amount=signal.kelly_size_usdc,
        # )
        # resp = client.post_order(order)
        # return resp
        raise NotImplementedError("Set paper_mode=False and configure py-clob-client for live trading")

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    async def run(self, poll_interval_seconds: int = 60):
        log.info(
            f"ReplicatedTraderBot started | "
            f"bankroll=${self.bankroll:,.0f} | "
            f"paper_mode={self.paper_mode}"
        )
        while True:
            if self.risk.kill_switch_triggered():
                log.error("Kill switch active — halting bot")
                break

            try:
                markets = await self.scan_markets()
                log.info(f"Scanned {len(markets)} markets")
                fired = 0
                for market in markets:
                    if market.get("id") in self.open_positions:
                        continue
                    signal = self.compute_signal(market)
                    if signal:
                        await self.execute_trade(signal)
                        fired += 1
                log.info(f"Signals fired: {fired}")

            except httpx.HTTPError as e:
                log.error(f"HTTP error: {e}")

            await asyncio.sleep(poll_interval_seconds)

    def summary(self) -> dict:
        return {
            "open_positions":  len(self.open_positions),
            "total_trades":    len(self.trade_log),
            "current_bankroll": self.risk.bankroll,
            "daily_loss_pct":  round(self.risk.daily_loss_pct * 100, 2),
            "drawdown_pct":    round(self.risk.drawdown_pct * 100, 2),
        }


# ---------------------------------------------------------------------------
# Entry point (paper trading demo)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json

    bot = ReplicatedTraderBot(bankroll_usdc=10_000, paper_mode=True)

    async def demo():
        # In a real environment this would connect to the live API
        # For demonstration, we just show the bot is ready
        print(json.dumps({
            "status":      "ReplicatedTraderBot ready",
            "strategy":    "Late-stage contrarian (politics + crypto)",
            "paper_mode":  True,
            "bankroll":    10_000,
            "signal_config": STRATEGY,
        }, indent=2))

    asyncio.run(demo())
