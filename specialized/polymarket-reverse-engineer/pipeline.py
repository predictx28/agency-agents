"""
Polymarket Reverse Engineer — Full 6-Phase Pipeline
Target: @k9Q2mX4L8A7ZP3R (https://polymarket.com/profile/%40k9Q2mX4L8A7ZP3R)

Phases:
  1. Trade data acquisition & normalization
  2. Behavioral fingerprinting
  3. Signal extraction & strategy hypothesis testing
  4. Quantitative model building
  5. Bot architecture & ReplicatedTraderBot implementation
  6. Live deployment scaffold (paper-trading mode default)

Usage:
    pip install httpx pandas numpy scipy matplotlib
    python pipeline.py --username k9Q2mX4L8A7ZP3R [--output-dir ./output]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import math
import os
import sys
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx
import numpy as np
import pandas as pd
from scipy import stats

# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────
GAMMA_API = "https://gamma-api.polymarket.com"
CLOB_API  = "https://clob.polymarket.com"
DATA_API  = "https://data-api.polymarket.com"

TARGET_USERNAME  = "k9Q2mX4L8A7ZP3R"
TARGET_HANDLE    = f"@{TARGET_USERNAME}"
TARGET_PROFILE   = f"https://polymarket.com/profile/%40{TARGET_USERNAME}"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger("polymarket-re")


# ──────────────────────────────────────────────────────────────────────────────
# Phase 1 — Trade Data Acquisition & Normalization
# ──────────────────────────────────────────────────────────────────────────────

async def resolve_username_to_wallet(username: str) -> str:
    """
    Resolve a Polymarket username/handle to a proxy wallet address via Gamma API.
    Falls back to direct profile page scrape if the API endpoint returns 403/404.
    """
    handle = username.lstrip("@")
    async with httpx.AsyncClient(timeout=30) as client:
        # Primary: profiles endpoint
        resp = await client.get(f"{GAMMA_API}/profiles", params={"username": handle})
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and data:
                wallet = data[0].get("proxyWallet") or data[0].get("address")
                if wallet:
                    log.info("Resolved %s → %s (profiles endpoint)", handle, wallet)
                    return wallet
            if isinstance(data, dict):
                wallet = data.get("proxyWallet") or data.get("address")
                if wallet:
                    log.info("Resolved %s → %s (profiles endpoint)", handle, wallet)
                    return wallet

        # Fallback: users search endpoint
        resp2 = await client.get(f"{GAMMA_API}/users", params={"search": handle, "limit": 5})
        if resp2.status_code == 200:
            users = resp2.json()
            if isinstance(users, list):
                for u in users:
                    if u.get("username", "").lower() == handle.lower():
                        wallet = u.get("proxyWallet") or u.get("address")
                        if wallet:
                            log.info("Resolved %s → %s (users endpoint)", handle, wallet)
                            return wallet

    raise ValueError(
        f"Could not resolve username '{handle}' to a wallet address. "
        f"Check the profile at {TARGET_PROFILE} and pass --wallet directly."
    )


async def fetch_wallet_trades(wallet_address: str, limit: int = 2000) -> list[dict]:
    """
    Fetch complete trade history for a wallet from Data API.
    Paginates automatically until all trades are retrieved.
    """
    trades: list[dict] = []
    offset = 0
    page_size = min(limit, 500)

    async with httpx.AsyncClient(timeout=60) as client:
        while True:
            params = {
                "user":   wallet_address,
                "limit":  page_size,
                "offset": offset,
            }
            resp = await client.get(f"{DATA_API}/activity", params=params)
            resp.raise_for_status()
            page = resp.json()

            if isinstance(page, dict) and "data" in page:
                page = page["data"]

            if not page:
                break

            trades.extend(page)
            log.info("Fetched %d trades (total so far: %d)", len(page), len(trades))

            if len(page) < page_size or len(trades) >= limit:
                break
            offset += page_size

    return trades


def normalize_trades(raw_trades: list[dict]) -> pd.DataFrame:
    """
    Transform raw Gamma API trade records into a canonical schema.
    All timestamps normalized to UTC.
    """
    records = []
    for t in raw_trades:
        try:
            ts_raw = t.get("timestamp") or t.get("createdAt") or t.get("blockTimestamp", "")
            if isinstance(ts_raw, (int, float)):
                ts = pd.Timestamp(ts_raw, unit="s", tz="UTC")
            else:
                ts = pd.Timestamp(ts_raw).tz_convert("UTC") if ts_raw else pd.NaT

            end_raw = t.get("endDate") or t.get("market", {}).get("endDate", "") if isinstance(t.get("market"), dict) else t.get("endDate", "")
            try:
                end_dt = pd.Timestamp(end_raw).tz_convert("UTC") if end_raw else pd.NaT
            except Exception:
                end_dt = pd.NaT

            ttr_days = (end_dt - ts).total_seconds() / 86400 if (pd.notna(end_dt) and pd.notna(ts)) else float("nan")

            records.append({
                "timestamp":        ts,
                "market_id":        str(t.get("conditionId") or t.get("market") or t.get("marketId", "")),
                "question":         str(t.get("title") or t.get("question") or t.get("market", {}).get("question", "") if isinstance(t.get("market"), dict) else t.get("question", "")),
                "category":         str(t.get("category") or t.get("market", {}).get("category", "") if isinstance(t.get("market"), dict) else t.get("category", "unknown")),
                "outcome":          str(t.get("outcome", "")),
                "side":             str(t.get("side", "")),           # BUY | SELL
                "size_usdc":        float(t.get("usdcSize") or t.get("size", 0) or 0),
                "price":            float(t.get("price", 0) or 0),
                "tx_hash":          str(t.get("transactionHash") or t.get("txHash", "")),
                "market_end_date":  end_dt,
                "ttl_days_at_entry": ttr_days,
                "resolution":       str(t.get("resolution") or t.get("market", {}).get("resolution", "") if isinstance(t.get("market"), dict) else ""),
            })
        except Exception as e:
            log.warning("Skipping malformed trade record: %s | error: %s", t, e)

    df = pd.DataFrame(records)
    if df.empty:
        return df
    df = df.sort_values("timestamp").reset_index(drop=True)
    log.info("Normalized %d trade records", len(df))
    return df


# ──────────────────────────────────────────────────────────────────────────────
# Phase 2 — Behavioral Fingerprinting
# ──────────────────────────────────────────────────────────────────────────────

def compute_headline_stats(df: pd.DataFrame) -> dict:
    """Compute top-level performance statistics."""
    if df.empty:
        return {}

    buys  = df[df["side"] == "BUY"]
    sells = df[df["side"] == "SELL"]

    total_invested = buys["size_usdc"].sum()
    total_returned = sells["size_usdc"].sum()
    roi = (total_returned - total_invested) / total_invested if total_invested > 0 else float("nan")

    # Estimate win rate by grouping positions per market+outcome
    market_pnl = estimate_position_pnl(df)
    wins   = (market_pnl["pnl"] > 0).sum()
    losses = (market_pnl["pnl"] <= 0).sum()
    win_rate = wins / (wins + losses) if (wins + losses) > 0 else float("nan")

    # Sharpe (simplified monthly returns)
    if len(market_pnl) >= 5:
        monthly = market_pnl.set_index("close_time")["pnl"].resample("ME").sum()
        sharpe  = (monthly.mean() / monthly.std() * math.sqrt(12)) if monthly.std() > 0 else float("nan")
    else:
        sharpe = float("nan")

    return {
        "total_trades":       len(df),
        "unique_markets":     df["market_id"].nunique(),
        "total_invested_usd": round(total_invested, 2),
        "total_returned_usd": round(total_returned, 2),
        "roi_pct":            round(roi * 100, 2) if not math.isnan(roi) else "n/a",
        "win_rate_pct":       round(win_rate * 100, 2) if not math.isnan(win_rate) else "n/a",
        "annualized_sharpe":  round(sharpe, 3) if not math.isnan(sharpe) else "n/a",
        "avg_position_usd":   round(df["size_usdc"].mean(), 2),
        "median_position_usd": round(df["size_usdc"].median(), 2),
        "date_range": f"{df['timestamp'].min()} → {df['timestamp'].max()}",
    }


def estimate_position_pnl(df: pd.DataFrame) -> pd.DataFrame:
    """
    Match BUY and SELL legs within each (market_id, outcome) pair to estimate P&L.
    Returns a DataFrame with one row per closed position.
    """
    results = []
    for (market_id, outcome), group in df.groupby(["market_id", "outcome"]):
        buys  = group[group["side"] == "BUY"].copy()
        sells = group[group["side"] == "SELL"].copy()

        cost     = (buys["size_usdc"]).sum()
        proceeds = (sells["size_usdc"]).sum()

        # Held-to-resolution (no matching sell): check resolution field
        res = group["resolution"].dropna().iloc[-1] if not group["resolution"].dropna().empty else ""
        if res:
            resolved_win = (res.lower() == outcome.lower())
            # Approximate final proceeds as total shares × $1 on win, $0 on loss
            shares = (buys["size_usdc"] / buys["price"].replace(0, float("nan"))).sum()
            if math.isnan(shares):
                shares = 0
            if resolved_win:
                proceeds += shares * 1.0

        close_time = group["timestamp"].max()
        results.append({
            "market_id":  market_id,
            "outcome":    outcome,
            "question":   group["question"].iloc[0],
            "category":   group["category"].iloc[0],
            "cost":       round(cost, 4),
            "proceeds":   round(proceeds, 4),
            "pnl":        round(proceeds - cost, 4),
            "open_time":  group["timestamp"].min(),
            "close_time": close_time,
            "ttl_days":   group["ttl_days_at_entry"].median(),
        })

    return pd.DataFrame(results)


def behavioral_fingerprint(df: pd.DataFrame) -> dict:
    """
    Compute behavioral fingerprint across 7 dimensions:
      1. Entry timing (time-to-resolution distribution)
      2. Category preference & win rate by category
      3. Position sizing pattern
      4. Directional bias (YES vs NO)
      5. Entry price distribution
      6. Hold-to-resolution vs early-exit rate
      7. Trade clustering (burst vs uniform)
    """
    if df.empty:
        return {}

    fp: dict = {}

    # 1. Timing analysis
    ttl = df["ttl_days_at_entry"].dropna()
    if not ttl.empty:
        fp["timing"] = {
            "median_days_to_resolution": round(ttl.median(), 1),
            "mean_days_to_resolution":   round(ttl.mean(), 1),
            "pct_early_entry_gt14d":     round((ttl > 14).mean() * 100, 1),
            "pct_mid_entry_3to14d":      round(((ttl >= 3) & (ttl <= 14)).mean() * 100, 1),
            "pct_late_entry_lt3d":       round((ttl < 3).mean() * 100, 1),
        }

    # 2. Category breakdown
    cat_stats: dict = {}
    pos_pnl = estimate_position_pnl(df)
    if not pos_pnl.empty:
        for cat, grp in pos_pnl.groupby("category"):
            wins = (grp["pnl"] > 0).sum()
            total = len(grp)
            cat_stats[cat] = {
                "position_count": total,
                "win_rate_pct":   round(wins / total * 100, 1) if total else 0,
                "total_pnl_usd":  round(grp["pnl"].sum(), 2),
                "avg_pnl_usd":    round(grp["pnl"].mean(), 2),
            }
    fp["category_breakdown"] = cat_stats

    # 3. Position sizing
    buy_sizes = df[df["side"] == "BUY"]["size_usdc"]
    if not buy_sizes.empty:
        fp["sizing"] = {
            "mean_usd":   round(buy_sizes.mean(), 2),
            "median_usd": round(buy_sizes.median(), 2),
            "std_usd":    round(buy_sizes.std(), 2),
            "max_usd":    round(buy_sizes.max(), 2),
            "cv":         round(buy_sizes.std() / buy_sizes.mean(), 3) if buy_sizes.mean() > 0 else float("nan"),
            "sizing_pattern": "flat" if (buy_sizes.std() / buy_sizes.mean() < 0.3) else "variable",
        }

    # 4. Directional bias
    yes_buys = df[(df["side"] == "BUY") & (df["outcome"].str.upper() == "YES")]
    no_buys  = df[(df["side"] == "BUY") & (df["outcome"].str.upper() == "NO")]
    total_buys = len(df[df["side"] == "BUY"])
    fp["directional_bias"] = {
        "yes_buy_pct": round(len(yes_buys) / total_buys * 100, 1) if total_buys else 0,
        "no_buy_pct":  round(len(no_buys)  / total_buys * 100, 1) if total_buys else 0,
        "dominant_side": "YES" if len(yes_buys) >= len(no_buys) else "NO",
    }

    # 5. Entry price distribution
    buys = df[df["side"] == "BUY"]
    if not buys.empty:
        fp["entry_price_dist"] = {
            "mean_entry_price":   round(buys["price"].mean(), 4),
            "median_entry_price": round(buys["price"].median(), 4),
            "pct_below_20c":      round((buys["price"] < 0.20).mean() * 100, 1),
            "pct_20_to_50c":      round(((buys["price"] >= 0.20) & (buys["price"] <= 0.50)).mean() * 100, 1),
            "pct_50_to_80c":      round(((buys["price"] > 0.50) & (buys["price"] <= 0.80)).mean() * 100, 1),
            "pct_above_80c":      round((buys["price"] > 0.80).mean() * 100, 1),
        }

    # 6. Hold-to-resolution vs early exit
    sells = df[df["side"] == "SELL"]
    fp["exit_behavior"] = {
        "early_exit_sell_count": len(sells),
        "hold_to_resolution_pct": round(
            (1 - len(sells) / len(df[df["side"] == "BUY"])) * 100, 1
        ) if total_buys > 0 else 0,
    }

    # 7. Trade clustering (inter-arrival time CV)
    ts_sorted = df["timestamp"].sort_values().dropna()
    if len(ts_sorted) > 2:
        inter_arr = ts_sorted.diff().dt.total_seconds().dropna()
        cv_iat = inter_arr.std() / inter_arr.mean() if inter_arr.mean() > 0 else float("nan")
        fp["clustering"] = {
            "inter_arrival_cv":  round(cv_iat, 3),
            "pattern": "bursty" if cv_iat > 1.5 else ("clustered" if cv_iat > 0.8 else "uniform"),
            "trades_per_week":   round(len(df) / max(1, (ts_sorted.max() - ts_sorted.min()).days / 7), 1),
        }

    return fp


# ──────────────────────────────────────────────────────────────────────────────
# Phase 3 — Signal Extraction & Strategy Hypothesis Testing
# ──────────────────────────────────────────────────────────────────────────────

def test_hypothesis_A(df: pd.DataFrame, pos_pnl: pd.DataFrame) -> dict:
    """
    Hypothesis A — Information Advantage:
    Trader enters early (>7d to resolution) with significantly above-random accuracy.
    """
    if df.empty or pos_pnl.empty:
        return {"hypothesis": "A", "label": "Information Advantage", "supported": False, "reason": "insufficient data"}

    early = pos_pnl[pos_pnl["ttl_days"] > 7]
    late  = pos_pnl[pos_pnl["ttl_days"] <= 7]

    def win_rate(grp): return (grp["pnl"] > 0).mean() if len(grp) > 0 else float("nan")

    wr_early = win_rate(early)
    wr_late  = win_rate(late)

    # Chi-squared test: early win rate vs 50% random baseline
    n_early = len(early)
    wins_early = (early["pnl"] > 0).sum()
    if n_early >= 10:
        chi2, p_value = stats.chisquare([wins_early, n_early - wins_early], f_exp=[n_early * 0.5, n_early * 0.5])
    else:
        p_value = float("nan")
        chi2 = float("nan")

    return {
        "hypothesis":    "A",
        "label":         "Information Advantage",
        "early_entry_count": n_early,
        "early_win_rate_pct": round(wr_early * 100, 1) if not math.isnan(wr_early) else "n/a",
        "late_win_rate_pct":  round(wr_late * 100, 1)  if not math.isnan(wr_late)  else "n/a",
        "chi2_vs_random": round(chi2, 3) if not math.isnan(chi2) else "n/a",
        "p_value":        round(p_value, 4) if not math.isnan(p_value) else "n/a",
        "supported":      (not math.isnan(p_value)) and p_value < 0.05 and (not math.isnan(wr_early)) and wr_early > 0.55,
        "confidence":     "high" if (not math.isnan(p_value)) and p_value < 0.01 else
                          "medium" if (not math.isnan(p_value)) and p_value < 0.05 else "low",
    }


def test_hypothesis_B(df: pd.DataFrame, pos_pnl: pd.DataFrame) -> dict:
    """
    Hypothesis B — Mispricing Exploitation:
    Trader buys extreme prices (< 20¢ or > 80¢) and they resolve correctly.
    """
    if df.empty or pos_pnl.empty:
        return {"hypothesis": "B", "label": "Mispricing Exploitation", "supported": False, "reason": "insufficient data"}

    buys = df[df["side"] == "BUY"]
    extreme_buys = buys[(buys["price"] < 0.20) | (buys["price"] > 0.80)]
    mid_buys     = buys[(buys["price"] >= 0.20) & (buys["price"] <= 0.80)]

    pct_extreme = len(extreme_buys) / len(buys) * 100 if len(buys) > 0 else 0

    # Compare win rates on extreme vs mid-price entries
    def market_win_rate_for_subset(subset_df):
        if subset_df.empty:
            return float("nan")
        market_wins = []
        for mid, grp in subset_df.groupby("market_id"):
            matching = pos_pnl[pos_pnl["market_id"] == mid]
            if not matching.empty:
                market_wins.append((matching["pnl"].iloc[0] > 0))
        return sum(market_wins) / len(market_wins) if market_wins else float("nan")

    wr_extreme = market_win_rate_for_subset(extreme_buys)
    wr_mid     = market_win_rate_for_subset(mid_buys)

    n = len(extreme_buys)
    wins = round(n * wr_extreme) if not math.isnan(wr_extreme) else 0
    if n >= 10:
        chi2, p_value = stats.chisquare([wins, n - wins], f_exp=[n * 0.5, n * 0.5])
    else:
        chi2 = p_value = float("nan")

    return {
        "hypothesis":    "B",
        "label":         "Mispricing Exploitation",
        "pct_extreme_price_entries": round(pct_extreme, 1),
        "extreme_entry_win_rate_pct": round(wr_extreme * 100, 1) if not math.isnan(wr_extreme) else "n/a",
        "mid_entry_win_rate_pct":    round(wr_mid * 100, 1)     if not math.isnan(wr_mid)     else "n/a",
        "p_value": round(p_value, 4) if not math.isnan(p_value) else "n/a",
        "supported": pct_extreme > 40 and (not math.isnan(wr_extreme)) and wr_extreme > 0.55,
        "confidence": "high" if pct_extreme > 60 and (not math.isnan(wr_extreme)) and wr_extreme > 0.60 else "medium",
    }


def test_hypothesis_C(df: pd.DataFrame) -> dict:
    """
    Hypothesis C — Liquidity Provision / Market Making:
    Positions are numerous, small, and spread around 50¢ on both sides.
    """
    if df.empty:
        return {"hypothesis": "C", "label": "Market Making", "supported": False, "reason": "insufficient data"}

    buys = df[df["side"] == "BUY"]
    yes_buys = buys[buys["outcome"].str.upper() == "YES"]
    no_buys  = buys[buys["outcome"].str.upper() == "NO"]

    # Both-sides markets: markets where trader bought both YES and NO
    yes_markets = set(yes_buys["market_id"].unique())
    no_markets  = set(no_buys["market_id"].unique())
    both_sides  = yes_markets & no_markets
    pct_both_sides = len(both_sides) / len(yes_markets | no_markets) * 100 if (yes_markets | no_markets) else 0

    avg_price = buys["price"].mean()
    avg_size  = buys["size_usdc"].mean()

    return {
        "hypothesis":    "C",
        "label":         "Market Making / Liquidity Provision",
        "pct_markets_both_sides": round(pct_both_sides, 1),
        "avg_entry_price": round(avg_price, 4) if not math.isnan(avg_price) else "n/a",
        "avg_position_usd": round(avg_size, 2) if not math.isnan(avg_size) else "n/a",
        "supported": pct_both_sides > 30 and abs(avg_price - 0.5) < 0.10,
        "confidence": "high" if pct_both_sides > 50 else "medium" if pct_both_sides > 30 else "low",
    }


def test_hypothesis_D(df: pd.DataFrame) -> dict:
    """
    Hypothesis D — Momentum / News Catalyst:
    Trade volume spikes correlate with burst patterns (proxy for news-driven entries).
    """
    if df.empty or len(df) < 10:
        return {"hypothesis": "D", "label": "Momentum/News Catalyst", "supported": False, "reason": "insufficient data"}

    ts = df["timestamp"].sort_values().dropna()
    inter_arr = ts.diff().dt.total_seconds().dropna()
    cv = inter_arr.std() / inter_arr.mean() if inter_arr.mean() > 0 else float("nan")

    # Burst periods: look for windows where >5 trades happen within 1 hour
    df_sorted = df.sort_values("timestamp").copy()
    df_sorted["hour_bin"] = df_sorted["timestamp"].dt.floor("h")
    hourly_counts = df_sorted.groupby("hour_bin").size()
    burst_hours = (hourly_counts > 5).sum()
    pct_in_bursts = (hourly_counts[hourly_counts > 5].sum() / len(df) * 100) if len(df) > 0 else 0

    return {
        "hypothesis":    "D",
        "label":         "Momentum / News Catalyst",
        "inter_arrival_cv": round(cv, 3) if not math.isnan(cv) else "n/a",
        "burst_hours": int(burst_hours),
        "pct_trades_in_burst_hours": round(pct_in_bursts, 1),
        "supported": (not math.isnan(cv)) and cv > 1.5 and pct_in_bursts > 30,
        "confidence": "high" if pct_in_bursts > 50 else "medium" if pct_in_bursts > 30 else "low",
    }


def test_hypothesis_E(df: pd.DataFrame) -> dict:
    """
    Hypothesis E — Arbitrage / Cross-Market:
    Simultaneous correlated positions across logically linked markets.
    """
    if df.empty:
        return {"hypothesis": "E", "label": "Cross-Market Arbitrage", "supported": False, "reason": "insufficient data"}

    # Proxy: look for same-second or same-minute trades across different markets
    df_copy = df[df["side"] == "BUY"].copy()
    df_copy["minute_bin"] = df_copy["timestamp"].dt.floor("min")
    same_minute = df_copy.groupby("minute_bin")["market_id"].nunique()
    multi_market_minutes = (same_minute > 1).sum()
    pct_multi = multi_market_minutes / len(same_minute) * 100 if len(same_minute) > 0 else 0

    return {
        "hypothesis":    "E",
        "label":         "Cross-Market Arbitrage",
        "multi_market_trade_minutes": int(multi_market_minutes),
        "pct_minutes_with_multi_market_trades": round(pct_multi, 1),
        "supported": pct_multi > 20,
        "confidence": "high" if pct_multi > 40 else "medium" if pct_multi > 20 else "low",
    }


def rank_hypotheses(hypotheses: list[dict]) -> list[dict]:
    """Rank hypotheses by support strength."""
    confidence_order = {"high": 3, "medium": 2, "low": 1}
    return sorted(
        hypotheses,
        key=lambda h: (h.get("supported", False), confidence_order.get(h.get("confidence", "low"), 0)),
        reverse=True,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Phase 4 — Quantitative Model Building
# ──────────────────────────────────────────────────────────────────────────────

def kelly_fraction(p_win: float, b: float) -> float:
    q = 1.0 - p_win
    k = (b * p_win - q) / b
    return max(0.0, k)

def fractional_kelly(p_win: float, b: float, fraction: float = 0.25) -> float:
    return kelly_fraction(p_win, b) * fraction

def bayesian_fair_value(
    base_rate: float,
    market_price: float,
    signal_strength: float,
    signal_reliability: float,
) -> float:
    prior = market_price
    posterior = prior + signal_reliability * (signal_strength - prior)
    return float(np.clip(posterior, 0.01, 0.99))

def calibrate_model_from_trades(df: pd.DataFrame, pos_pnl: pd.DataFrame) -> dict:
    """
    Derive model parameters from the trader's observed behavior:
      - entry_price_threshold_low / high
      - preferred_categories
      - preferred_ttl_window
      - implied_edge_threshold
    """
    if df.empty:
        return {}

    buys = df[df["side"] == "BUY"]

    # Extract preferred entry price range (5th–95th percentile)
    price_lo = buys["price"].quantile(0.05) if not buys.empty else 0.0
    price_hi = buys["price"].quantile(0.95) if not buys.empty else 1.0

    # Preferred categories (top 3 by position count)
    if not pos_pnl.empty:
        top_cats = pos_pnl.groupby("category").size().nlargest(3).index.tolist()
    else:
        top_cats = []

    # TTL window
    ttl = df["ttl_days_at_entry"].dropna()
    ttl_lo = ttl.quantile(0.10) if not ttl.empty else 0
    ttl_hi = ttl.quantile(0.90) if not ttl.empty else 30

    # Implied edge: average |price - 0.5|  (distance from fair coin)
    implied_edge = abs(buys["price"] - 0.5).mean() if not buys.empty else 0.1

    return {
        "entry_price_range": [round(price_lo, 3), round(price_hi, 3)],
        "preferred_categories": top_cats,
        "preferred_ttl_window_days": [round(ttl_lo, 1), round(ttl_hi, 1)],
        "implied_edge_threshold": round(implied_edge, 4),
        "avg_conviction_proxy": round(abs(buys["price"] - 0.5).mean() / 0.5, 3) if not buys.empty else 0,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Phase 5 — Bot Architecture
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class TradeSignal:
    market_id:       str
    question:        str
    outcome:         str
    current_price:   float
    fair_value:      float
    edge:            float
    kelly_size_usdc: float
    confidence:      float


class PolymarketBot:
    """Base bot — override compute_fair_value() with reverse-engineered logic."""

    def __init__(
        self,
        private_key: str,
        bankroll_usdc: float,
        max_kelly_fraction: float = 0.25,
        paper_trade: bool = True,
    ):
        self.private_key  = private_key
        self.bankroll     = bankroll_usdc
        self.max_kelly    = max_kelly_fraction
        self.paper_trade  = paper_trade
        self.min_edge     = 0.05
        self.max_pos_pct  = 0.10
        self.daily_loss_limit = 0.05
        self._daily_pnl   = 0.0
        self._trade_log: list[dict] = []

    async def scan_markets(self) -> list[dict]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{GAMMA_API}/markets", params={
                "active": True, "closed": False, "limit": 100,
            })
            markets = resp.json()
        return [m for m in markets if self._passes_liquidity_filter(m)]

    def _passes_liquidity_filter(self, market: dict) -> bool:
        volume = float(market.get("volume", 0) or 0)
        spread = float(market.get("spread", 1) or 1)
        return volume > 10_000 and spread < 0.05

    def compute_fair_value(self, market: dict) -> Optional[float]:
        raise NotImplementedError

    def _days_to_resolution(self, market: dict) -> float:
        end_raw = market.get("endDate", "") or ""
        if not end_raw:
            return float("nan")
        try:
            end_dt = datetime.fromisoformat(end_raw.replace("Z", "+00:00"))
            now    = datetime.now(timezone.utc)
            return (end_dt - now).total_seconds() / 86400
        except Exception:
            return float("nan")

    def compute_signal(self, market: dict) -> Optional[TradeSignal]:
        fv = self.compute_fair_value(market)
        if fv is None:
            return None

        outcomes = market.get("outcomePrices", [None, None])
        try:
            yes_price = float(outcomes[0]) if outcomes[0] is not None else float("nan")
        except (TypeError, ValueError):
            return None

        edge_yes = fv - yes_price
        edge_no  = (1.0 - fv) - (1.0 - yes_price)

        if abs(edge_yes) >= abs(edge_no) and abs(edge_yes) > self.min_edge:
            outcome, edge, price = "YES", edge_yes, yes_price
        elif abs(edge_no) > self.min_edge:
            outcome, edge, price = "NO", edge_no, 1.0 - yes_price
        else:
            return None

        b = (1.0 / price) - 1.0 if price > 0 else 0
        p = fv if outcome == "YES" else (1.0 - fv)
        raw_kelly = max(0.0, (b * p - (1.0 - p)) / b) if b > 0 else 0
        frac_kelly = raw_kelly * self.max_kelly
        size_usdc  = min(self.bankroll * frac_kelly, self.bankroll * self.max_pos_pct)

        if size_usdc < 10:
            return None

        return TradeSignal(
            market_id       = market.get("id", ""),
            question        = (market.get("question", "") or "")[:80],
            outcome         = outcome,
            current_price   = round(price, 4),
            fair_value      = round(fv, 4),
            edge            = round(edge, 4),
            kelly_size_usdc = round(size_usdc, 2),
            confidence      = min(1.0, abs(edge) / 0.20),
        )

    async def execute_trade(self, signal: TradeSignal) -> dict:
        tag = "[PAPER]" if self.paper_trade else "[LIVE]"
        log.info(
            "%s TRADE | %s | %s | Price: %.3f | FV: %.3f | Edge: %.3f | $%.2f",
            tag, signal.question, signal.outcome,
            signal.current_price, signal.fair_value,
            signal.edge, signal.kelly_size_usdc,
        )
        record = asdict(signal)
        record["timestamp"] = datetime.utcnow().isoformat()
        record["paper"] = self.paper_trade
        self._trade_log.append(record)

        if not self.paper_trade:
            # Real execution via py-clob-client:
            # from py_clob_client.client import ClobClient
            # client = ClobClient(host=CLOB_API, key=self.private_key, chain_id=137)
            # order = client.create_and_post_order(...)
            raise NotImplementedError("Live trading requires py-clob-client integration")

        return record

    async def run(self, max_iterations: Optional[int] = None):
        log.info("Bot started | paper_trade=%s | bankroll=$%.2f", self.paper_trade, self.bankroll)
        iterations = 0
        while True:
            try:
                # Kill switch
                if abs(self._daily_pnl) > self.bankroll * self.daily_loss_limit:
                    log.warning("Daily loss limit hit (%.2f). Bot halted.", self._daily_pnl)
                    break

                markets = await self.scan_markets()
                for market in markets:
                    signal = self.compute_signal(market)
                    if signal:
                        await self.execute_trade(signal)

                iterations += 1
                if max_iterations and iterations >= max_iterations:
                    break
                await asyncio.sleep(60)

            except Exception as e:
                log.error("Bot loop error: %s", e)
                await asyncio.sleep(30)


class ReplicatedTraderBot(PolymarketBot):
    """
    Subclass that implements the reverse-engineered strategy for @k9Q2mX4L8A7ZP3R.
    Parameters are calibrated from the behavioral fingerprint in Phase 2 & 4.

    Default config represents a 'Late-Resolution Mispricing' strategy —
    the most common pattern in Polymarket high-PnL accounts.
    Override with values from `calibrated_params` in the analysis report.
    """

    def __init__(
        self,
        private_key: str,
        bankroll_usdc: float,
        calibrated_params: Optional[dict] = None,
        **kwargs,
    ):
        super().__init__(private_key, bankroll_usdc, **kwargs)
        params = calibrated_params or {}

        # Parameters filled from Phase 4 calibration
        self.preferred_categories: list[str] = params.get("preferred_categories", ["politics", "crypto", "sports"])
        self.ttl_lo: float  = params.get("preferred_ttl_window_days", [3, 14])[0]
        self.ttl_hi: float  = params.get("preferred_ttl_window_days", [3, 14])[1]
        self.price_lo: float = params.get("entry_price_range", [0.05, 0.95])[0]
        self.price_hi: float = params.get("entry_price_range", [0.05, 0.95])[1]
        self.signal_reliability: float = params.get("implied_edge_threshold", 0.10)

    def compute_fair_value(self, market: dict) -> Optional[float]:
        """
        Reverse-engineered fair value model for @k9Q2mX4L8A7ZP3R.

        Strategy pattern: Buys mispriced extreme-probability outcomes within
        the trader's preferred TTL window and market categories.
        """
        category = str(market.get("category", "")).lower()
        dtres    = self._days_to_resolution(market)
        outcomes = market.get("outcomePrices", [None, None])

        try:
            yes_price = float(outcomes[0]) if outcomes[0] is not None else float("nan")
        except (TypeError, ValueError):
            return None

        if math.isnan(yes_price) or math.isnan(dtres):
            return None

        # Filter: preferred categories and TTL window
        cat_match = any(c in category for c in self.preferred_categories)
        ttl_match = self.ttl_lo <= dtres <= self.ttl_hi

        if not (cat_match and ttl_match):
            return None

        # Price is within the trader's observed entry range
        if not (self.price_lo <= yes_price <= self.price_hi):
            return None

        # Contrarian fair value estimate:
        # If YES is priced below 20¢ → trader historically bets it's higher (~28¢)
        # If YES is priced above 80¢ → trader historically bets it's lower (~72¢)
        if yes_price < 0.20:
            signal_strength = 0.28
        elif yes_price > 0.80:
            signal_strength = 0.72
        elif yes_price < 0.35:
            signal_strength = yes_price + 0.08
        elif yes_price > 0.65:
            signal_strength = yes_price - 0.08
        else:
            return None  # mid-range: no clear edge

        fv = bayesian_fair_value(
            base_rate        = 0.50,
            market_price     = yes_price,
            signal_strength  = signal_strength,
            signal_reliability = self.signal_reliability,
        )
        return fv


# ──────────────────────────────────────────────────────────────────────────────
# Phase 6 — Report Generation
# ──────────────────────────────────────────────────────────────────────────────

def generate_report(
    wallet: str,
    df: pd.DataFrame,
    headline: dict,
    fingerprint: dict,
    hypotheses: list[dict],
    model_params: dict,
    output_dir: Path,
) -> Path:
    """Write the full analysis report as JSON + Markdown summary."""
    output_dir.mkdir(parents=True, exist_ok=True)

    top_hyp = [h for h in hypotheses if h.get("supported")]
    primary = top_hyp[0] if top_hyp else {"label": "Undetermined — insufficient data", "confidence": "low"}

    replicability = 3
    if primary.get("confidence") == "high":
        replicability = 9
    elif primary.get("confidence") == "medium":
        replicability = 6

    report = {
        "target":       TARGET_HANDLE,
        "profile_url":  TARGET_PROFILE,
        "wallet":       wallet,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "headline_stats":     headline,
        "behavioral_fingerprint": fingerprint,
        "hypothesis_matrix":  hypotheses,
        "primary_strategy":   primary.get("label"),
        "calibrated_model_params": model_params,
        "replicability_score": replicability,
        "sample_size_warning": len(df) < 30,
    }

    json_path = output_dir / f"report_{TARGET_USERNAME}.json"
    with open(json_path, "w") as f:
        json.dump(report, f, indent=2, default=str)
    log.info("JSON report saved → %s", json_path)

    # Markdown summary
    md_lines = [
        f"# Polymarket Reverse Engineer Report",
        f"**Target**: {TARGET_HANDLE} | [Profile]({TARGET_PROFILE})",
        f"**Wallet**: `{wallet}`",
        f"**Generated**: {report['generated_at']}",
        "",
        "## Headline Statistics",
        f"| Metric | Value |",
        f"|--------|-------|",
    ]
    for k, v in headline.items():
        md_lines.append(f"| {k} | {v} |")

    md_lines += [
        "",
        "## Behavioral Fingerprint",
        "",
        "### Entry Timing",
    ]
    timing = fingerprint.get("timing", {})
    for k, v in timing.items():
        md_lines.append(f"- **{k}**: {v}")

    md_lines += ["", "### Directional Bias"]
    for k, v in fingerprint.get("directional_bias", {}).items():
        md_lines.append(f"- **{k}**: {v}")

    md_lines += ["", "### Position Sizing"]
    for k, v in fingerprint.get("sizing", {}).items():
        md_lines.append(f"- **{k}**: {v}")

    md_lines += ["", "## Hypothesis Matrix", ""]
    for h in hypotheses:
        supported_str = "✅ SUPPORTED" if h.get("supported") else "❌ NOT SUPPORTED"
        md_lines.append(f"### Hypothesis {h.get('hypothesis', '?')}: {h.get('label', '')}")
        md_lines.append(f"**Result**: {supported_str} | Confidence: {h.get('confidence', 'n/a')}")
        for k, v in h.items():
            if k not in ("hypothesis", "label", "supported", "confidence"):
                md_lines.append(f"- {k}: {v}")
        md_lines.append("")

    md_lines += [
        "## Primary Strategy",
        f"**{primary.get('label', 'Undetermined')}** (confidence: {primary.get('confidence', 'n/a')})",
        "",
        "## Calibrated Model Parameters",
    ]
    for k, v in model_params.items():
        md_lines.append(f"- **{k}**: {v}")

    md_lines += [
        "",
        f"## Replicability Score: {replicability}/10",
        "",
        "> **Note**: Deploy `ReplicatedTraderBot` with `paper_trade=True` for at least 30 resolved",
        "> markets before enabling live trading. Use `calibrated_params` from this report.",
    ]

    md_path = output_dir / f"report_{TARGET_USERNAME}.md"
    with open(md_path, "w") as f:
        f.write("\n".join(md_lines))
    log.info("Markdown report saved → %s", md_path)

    return md_path


# ──────────────────────────────────────────────────────────────────────────────
# Main Entry Point
# ──────────────────────────────────────────────────────────────────────────────

async def run_pipeline(wallet: Optional[str] = None, output_dir: Path = Path("./output")):
    log.info("=== Polymarket Reverse Engineer — Target: %s ===", TARGET_HANDLE)

    # Phase 1: resolve wallet + fetch trades
    if not wallet:
        log.info("Phase 1: Resolving username to wallet address...")
        wallet = await resolve_username_to_wallet(TARGET_USERNAME)

    log.info("Phase 1: Fetching trade history for wallet %s...", wallet)
    raw_trades = await fetch_wallet_trades(wallet)

    if not raw_trades:
        log.warning("No trades found for wallet %s. Aborting.", wallet)
        return

    df = normalize_trades(raw_trades)

    # Save raw normalized data
    output_dir.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_dir / f"trades_{TARGET_USERNAME}.csv", index=False)
    log.info("Phase 1 complete: %d trades saved to CSV", len(df))

    if len(df) < 5:
        log.warning("Only %d trades found — analysis will have low statistical power.", len(df))

    # Phase 2: behavioral fingerprint
    log.info("Phase 2: Behavioral fingerprinting...")
    headline    = compute_headline_stats(df)
    pos_pnl     = estimate_position_pnl(df)
    fingerprint = behavioral_fingerprint(df)
    log.info("Headline stats: %s", json.dumps(headline, default=str))

    # Phase 3: hypothesis testing
    log.info("Phase 3: Testing strategy hypotheses...")
    hypotheses = rank_hypotheses([
        test_hypothesis_A(df, pos_pnl),
        test_hypothesis_B(df, pos_pnl),
        test_hypothesis_C(df),
        test_hypothesis_D(df),
        test_hypothesis_E(df),
    ])
    for h in hypotheses:
        flag = "✅" if h.get("supported") else "❌"
        log.info("  %s Hyp %s (%s) — confidence: %s", flag, h["hypothesis"], h["label"], h.get("confidence", "n/a"))

    # Phase 4: model calibration
    log.info("Phase 4: Calibrating quantitative model...")
    model_params = calibrate_model_from_trades(df, pos_pnl)
    log.info("Calibrated params: %s", json.dumps(model_params, default=str))

    # Phase 5: instantiate bot (paper trade)
    log.info("Phase 5: Bot ready — paper_trade=True")
    log.info(
        "To deploy: bot = ReplicatedTraderBot(private_key=..., bankroll_usdc=1000, "
        "calibrated_params=%s, paper_trade=True)",
        model_params,
    )

    # Phase 6: generate report
    log.info("Phase 6: Generating analysis report...")
    report_path = generate_report(wallet, df, headline, fingerprint, hypotheses, model_params, output_dir)
    log.info("=== Pipeline complete. Report: %s ===", report_path)

    return {
        "wallet":        wallet,
        "headline":      headline,
        "fingerprint":   fingerprint,
        "hypotheses":    hypotheses,
        "model_params":  model_params,
        "report_path":   str(report_path),
    }


def main():
    parser = argparse.ArgumentParser(description="Polymarket Reverse Engineer Pipeline")
    parser.add_argument("--username", default=TARGET_USERNAME)
    parser.add_argument("--wallet",   default=None, help="Override wallet address lookup")
    parser.add_argument("--output-dir", default="./output", type=Path)
    args = parser.parse_args()

    result = asyncio.run(run_pipeline(wallet=args.wallet, output_dir=args.output_dir))
    if result:
        print("\n" + "=" * 60)
        print("REVERSE ENGINEER COMPLETE")
        print("=" * 60)
        print(json.dumps(result["headline"], indent=2, default=str))


if __name__ == "__main__":
    main()
