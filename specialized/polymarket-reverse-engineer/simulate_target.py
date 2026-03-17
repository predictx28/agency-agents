"""
Polymarket Reverse Engineer — Realistic Trade Simulation
Target: @k9Q2mX4L8A7ZP3R
=========================================================
Generates a statistically realistic trade ledger for the
target account when live API access is unavailable.

The simulation is NOT random — it encodes a coherent latent
strategy (late-stage mispricing hunter, political + crypto
categories, contrarian bias) with realistic noise, so the
analysis pipeline has genuine signal to detect.
"""

import random
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta

random.seed(42)
np.random.seed(42)

TARGET_USERNAME = "k9Q2mX4L8A7ZP3R"
WALLET_ADDRESS  = "0x7f3a9c2E4b81dF6A059c7e3BC2d1a4e0F5C88321"

# Strategy parameters baked into the simulation
STRATEGY_PARAMS = {
    "preferred_categories":     ["politics", "crypto"],
    "entry_window_days":        (1, 10),     # enters 1–10 days before resolution
    "contrarian_threshold":     0.22,        # buys when price < 0.22 or > 0.78
    "mean_position_usdc":       340,
    "position_std_usdc":        180,
    "true_win_rate":            0.63,        # genuine edge over random baseline
    "trades_per_month":         (8, 18),
    "burst_probability":        0.25,        # 25 % chance of clustered (same-day) entry
    "kelly_fraction":           0.22,
    "bankroll_start_usdc":      8_500,
}

MARKET_POOL = [
    # (question, category, base_prob_yes, end_days_from_start)
    ("Will Biden drop out of 2024 race by July?",          "politics", 0.55, 30),
    ("Will Trump win 2024 presidential election?",          "politics", 0.52, 180),
    ("Will Fed cut rates in March 2024?",                   "politics", 0.28, 25),
    ("Will ETH reach $4,000 before May 2024?",              "crypto",   0.41, 60),
    ("Will BTC halving occur before April 20 2024?",        "crypto",   0.85, 45),
    ("Will SEC approve spot ETH ETF in 2024?",              "crypto",   0.35, 120),
    ("Will Ukraine receive F-16s before Jan 2025?",         "politics", 0.72, 200),
    ("Will Elon Musk remain Twitter CEO through Dec 2024?", "politics", 0.68, 150),
    ("Will SOL exceed $200 in Q1 2024?",                    "crypto",   0.44, 40),
    ("Will NVDA hit $1,000 before June 2024?",              "crypto",   0.55, 80),
    ("Will US unemployment exceed 5% in 2024?",             "politics", 0.18, 100),
    ("Will ChatGPT-5 be released before July 2024?",        "crypto",   0.38, 110),
    ("Will Israel-Hamas ceasefire happen by March 2024?",   "politics", 0.31, 20),
    ("Will Japan exit negative interest rates in 2024?",    "politics", 0.60, 70),
    ("Will Dogecoin reach $0.50 in 2024?",                  "crypto",   0.22, 90),
    ("Will there be a US government shutdown in March?",    "politics", 0.45, 15),
    ("Will Cardano (ADA) hit $1 before April 2024?",        "crypto",   0.25, 50),
    ("Will Trump be convicted before election?",            "politics", 0.48, 160),
    ("Will BTC reach ATH in 2024?",                         "crypto",   0.74, 130),
    ("Will Macron resign before 2025?",                     "politics", 0.12, 200),
    ("Will US enter recession in 2024?",                    "politics", 0.24, 180),
    ("Will Tesla stock hit $300 in 2024?",                  "crypto",   0.42, 120),
    ("Will XRP win SEC lawsuit in 2024?",                   "crypto",   0.58, 90),
    ("Will there be a major exchange hack >$100M in 2024?", "crypto",   0.35, 150),
    ("Will Zelensky remain president through 2024?",        "politics", 0.78, 200),
]


def _simulate_market_price_at_entry(base_prob: float, days_to_res: float) -> float:
    """
    Simulate the market price a contrarian would observe at entry.
    Contrarian looks for markets that have drifted far from fair value.
    """
    # The target ONLY enters when price is distorted (crowd is over/under-pricing)
    noise = np.random.normal(0, 0.08)
    price = np.clip(base_prob + noise, 0.03, 0.97)

    # Force price to contrarian entry zones with 65% probability
    if random.random() < 0.65:
        if base_prob > 0.5:
            # True prob is high but market is underpricing → buy YES cheap
            price = np.clip(base_prob - abs(np.random.normal(0, 0.12)), 0.05, 0.45)
        else:
            # True prob is low but market is overpricing → buy NO cheap
            price = np.clip(base_prob + abs(np.random.normal(0, 0.12)), 0.55, 0.95)
    return round(price, 4)


def _determine_side(price: float, base_prob: float) -> tuple[str, str]:
    """Return (outcome, side) based on contrarian logic."""
    if price < 0.50 and base_prob > price + 0.08:
        return "YES", "BUY"
    elif price > 0.50 and base_prob < price - 0.08:
        return "NO", "BUY"
    else:
        # Occasionally takes the momentum trade
        return ("YES", "BUY") if base_prob > 0.5 else ("NO", "BUY")


def _did_win(outcome: str, base_prob: float) -> bool:
    """Simulate resolution; slightly favour contrarian wins."""
    if outcome == "YES":
        # Base prob boosted slightly because they found genuine mispricing
        adj_prob = min(0.95, base_prob * 1.08)
        return random.random() < adj_prob
    else:
        adj_prob = min(0.95, (1 - base_prob) * 1.08)
        return random.random() < adj_prob


def generate_simulated_ledger() -> pd.DataFrame:
    start_date = datetime(2023, 9, 1, tzinfo=timezone.utc)
    end_date   = datetime(2024, 6, 30, tzinfo=timezone.utc)

    rows = []
    tx_counter = 100_000
    bankroll   = STRATEGY_PARAMS["bankroll_start_usdc"]

    current_date = start_date
    while current_date < end_date:
        # Determine trades this month
        trades_this_month = random.randint(*STRATEGY_PARAMS["trades_per_month"])

        for _ in range(trades_this_month):
            if current_date >= end_date:
                break

            # Pick a market
            market_idx  = random.randint(0, len(MARKET_POOL) - 1)
            q, cat, bp, res_days_full = MARKET_POOL[market_idx]
            market_id   = f"0x{random.randint(0xAAAA0000, 0xFFFF9999):x}"

            # Entry: within the target's preferred 1-10 day window
            days_to_res = random.uniform(*STRATEGY_PARAMS["entry_window_days"])
            entry_ts    = current_date + timedelta(
                days=random.uniform(0, 28),
                hours=random.uniform(0, 23),
                minutes=random.uniform(0, 59),
            )
            if entry_ts >= end_date:
                continue

            # Burst clustering
            if random.random() < STRATEGY_PARAMS["burst_probability"]:
                entry_ts += timedelta(minutes=random.uniform(5, 120))

            price   = _simulate_market_price_at_entry(bp, days_to_res)
            outcome, side = _determine_side(price, bp)

            # Kelly-ish sizing
            b = (1 / price) - 1
            p_est = bp * 1.05 if outcome == "YES" else (1 - bp) * 1.05
            kelly = max(0, (b * p_est - (1 - p_est)) / b)
            frac_kelly = kelly * STRATEGY_PARAMS["kelly_fraction"]
            raw_size = bankroll * frac_kelly
            noise_size = np.random.normal(raw_size, STRATEGY_PARAMS["position_std_usdc"] * 0.3)
            size_usdc = round(max(25, min(bankroll * 0.12, noise_size)), 2)

            # Resolve trade
            won = _did_win(outcome, bp)
            if won:
                pnl = size_usdc * b
                bankroll += pnl
            else:
                bankroll -= size_usdc
                bankroll  = max(bankroll, 500)  # floor

            # BUY entry
            tx_counter += 1
            rows.append({
                "timestamp":          entry_ts,
                "market_id":          market_id,
                "market_question":    q,
                "category":           cat,
                "outcome":            outcome,
                "side":               "BUY",
                "size_usdc":          size_usdc,
                "price":              price,
                "transaction_hash":   f"0x{tx_counter:064x}",
                "market_end_date":    entry_ts + timedelta(days=days_to_res),
                "days_to_resolution": round(days_to_res, 2),
                "market_volume_usdc": round(random.uniform(15_000, 500_000), 0),
                "spread":             round(random.uniform(0.01, 0.06), 4),
                "resolved_win":       won,
                "base_prob":          bp,
            })

            # SELL at resolution (if won, at ~$0.95-0.99; if lost at ~$0.01-0.05)
            sell_ts   = entry_ts + timedelta(days=days_to_res + random.uniform(0.1, 0.5))
            sell_price = round(0.97 + np.random.normal(0, 0.01), 4) if won \
                       else round(0.03 + np.random.normal(0, 0.01), 4)
            sell_price = max(0.01, min(0.99, sell_price))
            tx_counter += 1
            rows.append({
                "timestamp":          sell_ts,
                "market_id":          market_id,
                "market_question":    q,
                "category":           cat,
                "outcome":            outcome,
                "side":               "SELL",
                "size_usdc":          round(size_usdc * sell_price / price, 2),
                "price":              sell_price,
                "transaction_hash":   f"0x{tx_counter:064x}",
                "market_end_date":    entry_ts + timedelta(days=days_to_res),
                "days_to_resolution": 0.0,
                "market_volume_usdc": None,
                "spread":             None,
                "resolved_win":       won,
                "base_prob":          bp,
            })

        current_date += timedelta(days=28)

    df = pd.DataFrame(rows).sort_values("timestamp").reset_index(drop=True)
    return df


if __name__ == "__main__":
    df = generate_simulated_ledger()
    print(f"Generated {len(df)} rows ({df['side'].value_counts().to_dict()})")
    df.to_csv("trade_ledger_simulated.csv", index=False)
    print(df[["timestamp","market_question","outcome","side","size_usdc","price"]].head(10))
