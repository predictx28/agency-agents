"""
sizer.py — Reverse-engineered sizing and signal engine.

Implements the LP seeding strategy decoded from trades_k9Q2mX4L8A7ZP3R.csv:
  - Size scales linearly with price: size = slope × price + intercept
  - Orders are split into N fragments at the same price level
  - Both Up and Down sides are always targeted on the same market
  - Position is scaled down proportionally when near market exposure limit
"""

import math
from dataclasses import dataclass

from .config import Config
from .market_scanner import Market


@dataclass
class OrderIntent:
    """A single order the bot intends to place."""
    market_id:   str
    question:    str
    outcome:     str          # "Up" or "Down"
    price:       float        # limit price
    size_usdc:   float        # USDC to spend
    fragment_of: int          # which fragment (1..N)
    total_frags: int


def compute_raw_size(price: float, cfg: Config) -> float:
    """
    Apply the reverse-engineered linear sizing rule.
    size_usdc = slope × price + intercept, clamped to [min, max].
    """
    raw = cfg.sizing_slope * price + cfg.sizing_intercept
    return max(cfg.min_order_usdc, min(cfg.max_order_usdc, raw))


def scale_to_limit(
    raw_size: float,
    current_exposure_usdc: float,
    bankroll_usdc: float,
    max_market_exposure_pct: float,
) -> float:
    """
    Scale order size down if we are approaching the per-market exposure cap.
    Returns 0.0 if the cap is already reached.
    """
    cap = bankroll_usdc * max_market_exposure_pct
    headroom = max(0.0, cap - current_exposure_usdc)
    return min(raw_size, headroom)


def build_order_intents(
    market: Market,
    cfg: Config,
    exposure_up_usdc: float = 0.0,
    exposure_down_usdc: float = 0.0,
) -> list[OrderIntent]:
    """
    Generate the full list of OrderIntent objects for both sides of a market.

    For each side (Up / Down):
      1. Compute raw size from the linear rule
      2. Scale down to per-market exposure headroom
      3. Split into cfg.order_fragments fragments
      4. Discard fragments below min_order_usdc

    Returns an empty list if no tradeable signal exists.
    """
    intents: list[OrderIntent] = []

    sides = [
        ("Up",   market.up_price,   exposure_up_usdc),
        ("Down", market.down_price, exposure_down_usdc),
    ]

    for outcome, price, current_exp in sides:
        if not (cfg.min_price <= price <= cfg.max_price):
            continue

        raw_size = compute_raw_size(price, cfg)
        scaled   = scale_to_limit(
            raw_size,
            current_exp,
            cfg.bankroll_usdc,
            cfg.max_market_exposure_pct,
        )

        if scaled < cfg.min_order_usdc:
            continue

        # Split into fragments
        frag_size = scaled / cfg.order_fragments
        if frag_size < cfg.min_order_usdc:
            # If fragments would be too small, use a single order
            intents.append(
                OrderIntent(
                    market_id=market.id,
                    question=market.question,
                    outcome=outcome,
                    price=price,
                    size_usdc=round(scaled, 6),
                    fragment_of=1,
                    total_frags=1,
                )
            )
        else:
            for i in range(cfg.order_fragments):
                intents.append(
                    OrderIntent(
                        market_id=market.id,
                        question=market.question,
                        outcome=outcome,
                        price=price,
                        size_usdc=round(frag_size, 6),
                        fragment_of=i + 1,
                        total_frags=cfg.order_fragments,
                    )
                )

    return intents


def kelly_fraction(p_win: float, price: float, kelly_multiplier: float = 0.25) -> float:
    """
    Fractional Kelly sizing for a binary market.
    p_win:           estimated probability of the outcome resolving in our favour
    price:           current market price of the token
    kelly_multiplier: fraction of full Kelly to use (default 0.25 = quarter Kelly)
    """
    if price <= 0 or price >= 1:
        return 0.0
    b = (1.0 / price) - 1.0          # net odds
    q = 1.0 - p_win
    full_kelly = (b * p_win - q) / b
    return max(0.0, full_kelly * kelly_multiplier)


def total_intent_usdc(intents: list[OrderIntent]) -> float:
    return sum(o.size_usdc for o in intents)
