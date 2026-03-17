"""
Polymarket Reverse Engineer — Behavioral Fingerprinting & Strategy Analysis
Target: @k9Q2mX4L8A7ZP3R
=============================================================================
Phase 2–3: Statistical fingerprinting, hypothesis testing, alpha decomposition.
"""

import numpy as np
import pandas as pd
from scipy import stats
from typing import Optional


# ---------------------------------------------------------------------------
# Helper: separate BUY records (one row per opened position)
# ---------------------------------------------------------------------------

def buys_only(df: pd.DataFrame) -> pd.DataFrame:
    return df[df["side"] == "BUY"].copy()


# ---------------------------------------------------------------------------
# Phase 2 — Behavioral Fingerprinting
# ---------------------------------------------------------------------------

def timing_analysis(df: pd.DataFrame) -> dict:
    b = buys_only(df)
    dtr = b["days_to_resolution"].dropna()
    return {
        "mean_days_to_res":   round(dtr.mean(), 2),
        "median_days_to_res": round(dtr.median(), 2),
        "pct_within_7d":      round((dtr <= 7).mean() * 100, 1),
        "pct_within_3d":      round((dtr <= 3).mean() * 100, 1),
        "pct_over_14d":       round((dtr > 14).mean() * 100, 1),
        "timing_histogram":   {str(k): int(v) for k, v in dtr.value_counts(bins=10, sort=False).items()},
    }


def category_breakdown(df: pd.DataFrame) -> pd.DataFrame:
    b = buys_only(df)
    # Attach win/loss from resolved_win column if present
    if "resolved_win" in b.columns:
        grp = b.groupby("category").agg(
            trade_count  = ("size_usdc", "count"),
            total_usdc   = ("size_usdc", "sum"),
            win_rate     = ("resolved_win", "mean"),
            avg_price    = ("price", "mean"),
            avg_dtr      = ("days_to_resolution", "mean"),
        ).reset_index()
        grp["win_rate"] = grp["win_rate"].round(4)
    else:
        grp = b.groupby("category").agg(
            trade_count = ("size_usdc", "count"),
            total_usdc  = ("size_usdc", "sum"),
            avg_price   = ("price", "mean"),
            avg_dtr     = ("days_to_resolution", "mean"),
        ).reset_index()
    grp["avg_price"] = grp["avg_price"].round(4)
    grp["avg_dtr"]   = grp["avg_dtr"].round(2)
    grp["total_usdc"] = grp["total_usdc"].round(2)
    return grp.sort_values("total_usdc", ascending=False)


def position_sizing_analysis(df: pd.DataFrame) -> dict:
    b = buys_only(df)
    sizes = b["size_usdc"]
    return {
        "mean_size":   round(sizes.mean(), 2),
        "median_size": round(sizes.median(), 2),
        "std_size":    round(sizes.std(), 2),
        "min_size":    round(sizes.min(), 2),
        "max_size":    round(sizes.max(), 2),
        "size_vs_price_corr": round(
            b["size_usdc"].corr(b["price"].apply(lambda p: abs(p - 0.5))), 4
        ),
        "note": "Positive corr → sizes with conviction (Kelly-like). Negative → contrarian.",
    }


def directional_bias(df: pd.DataFrame) -> dict:
    b = buys_only(df)
    yes_count = (b["outcome"] == "YES").sum()
    no_count  = (b["outcome"] == "NO").sum()
    total     = len(b)
    # Binomial test: is YES% significantly different from 50%?
    binom = stats.binomtest(yes_count, total, 0.5, alternative="two-sided")
    return {
        "yes_pct":   round(yes_count / total * 100, 1),
        "no_pct":    round(no_count  / total * 100, 1),
        "yes_count": int(yes_count),
        "no_count":  int(no_count),
        "binomial_p": round(binom.pvalue, 5),
        "significant_bias": binom.pvalue < 0.05,
    }


def price_entry_distribution(df: pd.DataFrame) -> dict:
    b = buys_only(df)
    prices = b["price"]
    return {
        "mean_entry_price":           round(prices.mean(), 4),
        "median_entry_price":         round(prices.median(), 4),
        "pct_below_20c":              round((prices < 0.20).mean() * 100, 1),
        "pct_below_30c":              round((prices < 0.30).mean() * 100, 1),
        "pct_above_70c":              round((prices > 0.70).mean() * 100, 1),
        "pct_above_80c":              round((prices > 0.80).mean() * 100, 1),
        "extreme_entry_pct":          round(((prices < 0.25) | (prices > 0.75)).mean() * 100, 1),
        "contrarian_signal_strength": round(abs(prices.mean() - 0.5), 4),
    }


def holding_period_analysis(df: pd.DataFrame) -> dict:
    buys  = df[df["side"] == "BUY"][["market_id", "timestamp"]].rename(columns={"timestamp": "buy_ts"})
    sells = df[df["side"] == "SELL"][["market_id", "timestamp"]].rename(columns={"timestamp": "sell_ts"})
    merged = buys.merge(sells, on="market_id", how="inner")
    merged["holding_days"] = (merged["sell_ts"] - merged["buy_ts"]).dt.total_seconds() / 86400
    hp = merged["holding_days"].clip(lower=0)
    return {
        "mean_holding_days":   round(hp.mean(), 2),
        "median_holding_days": round(hp.median(), 2),
        "pct_held_to_res":     round((hp > 0.9).mean() * 100, 1),
    }


def burst_trading_analysis(df: pd.DataFrame) -> dict:
    b = buys_only(df).set_index("timestamp").sort_index()
    b["date"] = b.index.date
    trades_per_day = b.groupby("date").size()
    burst_days = (trades_per_day > 2).sum()
    return {
        "mean_trades_per_day":  round(trades_per_day.mean(), 2),
        "max_trades_in_one_day": int(trades_per_day.max()),
        "burst_days_count":     int(burst_days),
        "burst_days_pct":       round(burst_days / len(trades_per_day) * 100, 1),
    }


# ---------------------------------------------------------------------------
# Phase 3 — Strategy Hypothesis Testing
# ---------------------------------------------------------------------------

def _bootstrap_win_rate(wins: np.ndarray, n_bootstrap: int = 10_000) -> tuple[float, float]:
    """95% CI for win rate via bootstrapping."""
    boot = [np.random.choice(wins, size=len(wins), replace=True).mean()
            for _ in range(n_bootstrap)]
    return float(np.percentile(boot, 2.5)), float(np.percentile(boot, 97.5))


def test_hypothesis_a_information_edge(df: pd.DataFrame) -> dict:
    """Early entries significantly more accurate than late entries."""
    b = buys_only(df)
    if "resolved_win" not in b.columns:
        return {"error": "resolved_win column required"}

    early = b[b["days_to_resolution"] <= 7]["resolved_win"].values
    late  = b[b["days_to_resolution"] > 7]["resolved_win"].values
    if len(early) < 5 or len(late) < 5:
        return {"result": "insufficient data"}

    tstat, pval = stats.ttest_ind(early, late, alternative="two-sided")
    ci_early = _bootstrap_win_rate(early)
    return {
        "hypothesis":         "A — Information Edge (early > late accuracy)",
        "early_win_rate":     round(early.mean(), 4),
        "late_win_rate":      round(late.mean(), 4),
        "early_n":            len(early),
        "late_n":             len(late),
        "t_statistic":        round(tstat, 4),
        "p_value":            round(pval, 5),
        "early_win_rate_95ci": (round(ci_early[0], 4), round(ci_early[1], 4)),
        "supported":          pval < 0.05 and early.mean() > late.mean(),
    }


def test_hypothesis_b_mispricing(df: pd.DataFrame) -> dict:
    """Trader buys when price deviates significantly from base rate."""
    b = buys_only(df)
    if "base_prob" not in b.columns:
        # Proxy: look for large price deviations from 50¢
        extreme_entries = b[(b["price"] < 0.25) | (b["price"] > 0.75)]
        pct_extreme = len(extreme_entries) / len(b)
        # Chi-square: expected ~16% at extremes under uniform distribution
        observed = [len(extreme_entries), len(b) - len(extreme_entries)]
        expected_pct = 0.16
        expected = [len(b) * expected_pct, len(b) * (1 - expected_pct)]
        chi2, pval = stats.chisquare(observed, f_exp=expected)
        return {
            "hypothesis":        "B — Mispricing Exploitation",
            "pct_extreme_entry": round(pct_extreme * 100, 1),
            "chi2_statistic":    round(chi2, 4),
            "p_value":           round(pval, 5),
            "supported":         pval < 0.05 and pct_extreme > 0.25,
        }

    # If base_prob is available (simulation)
    b = b.copy()
    b["mispricing"] = abs(b["base_prob"] - b["price"])
    misprice_wins  = b[b["resolved_win"] == True]["mispricing"].values
    misprice_losses = b[b["resolved_win"] == False]["mispricing"].values
    tstat, pval = stats.ttest_ind(misprice_wins, misprice_losses, alternative="greater")
    return {
        "hypothesis":              "B — Mispricing Exploitation",
        "avg_mispricing_on_wins":  round(misprice_wins.mean(), 4),
        "avg_mispricing_on_losses":round(misprice_losses.mean(), 4),
        "t_statistic":             round(tstat, 4),
        "p_value":                 round(pval, 5),
        "supported":               pval < 0.05,
    }


def test_hypothesis_c_market_making(df: pd.DataFrame) -> dict:
    """Trader posts both sides of same market → market making."""
    b = buys_only(df)
    both_sides = (
        b.groupby("market_id")["outcome"]
        .nunique()
        .reset_index()
        .rename(columns={"outcome": "sides_traded"})
    )
    pct_both = (both_sides["sides_traded"] > 1).mean()
    return {
        "hypothesis":     "C — Liquidity Provision / Market Making",
        "pct_both_sides": round(pct_both * 100, 1),
        "avg_position_size": round(b["size_usdc"].mean(), 2),
        "supported":      pct_both > 0.3 and b["size_usdc"].mean() < 100,
    }


def test_hypothesis_d_momentum(df: pd.DataFrame) -> dict:
    """Trades cluster in short time windows → momentum / news reactive."""
    b = buys_only(df).set_index("timestamp").sort_index()
    inter_trade_hours = (
        b.index.to_series().diff().dt.total_seconds().dropna() / 3600
    )
    pct_within_2h = (inter_trade_hours < 2).mean()
    pct_within_1d = (inter_trade_hours < 24).mean()
    return {
        "hypothesis":        "D — Momentum / News Catalyst",
        "pct_trades_within_2h": round(pct_within_2h * 100, 1),
        "pct_trades_within_24h": round(pct_within_1d * 100, 1),
        "median_inter_trade_hours": round(inter_trade_hours.median(), 1),
        "supported":         pct_within_2h > 0.35,
    }


def test_hypothesis_e_arbitrage(df: pd.DataFrame) -> dict:
    """Correlated positions across related markets simultaneously."""
    b = buys_only(df)
    # Proxy: same category, same day, different market → potential correlation trading
    b = b.copy()
    b["date"] = pd.to_datetime(b["timestamp"]).dt.date
    same_day_multi = b.groupby(["date", "category"])["market_id"].nunique()
    pct_multimarket = (same_day_multi > 1).mean()
    return {
        "hypothesis":        "E — Arbitrage / Cross-Market",
        "pct_multimarket_days": round(pct_multimarket * 100, 1),
        "supported":          pct_multimarket > 0.25,
    }


# ---------------------------------------------------------------------------
# Phase 4 — Performance Statistics
# ---------------------------------------------------------------------------

def performance_stats(df: pd.DataFrame) -> dict:
    buys_df  = buys_only(df)
    sells_df = df[df["side"] == "SELL"]
    total_in  = buys_df["size_usdc"].sum()
    total_out = sells_df["size_usdc"].sum()
    net_pnl   = total_out - total_in
    roi       = net_pnl / total_in if total_in > 0 else 0

    win_rate = None
    if "resolved_win" in buys_df.columns:
        win_rate = round(buys_df["resolved_win"].mean() * 100, 1)

    # Monthly P&L for Sharpe
    buys_df2 = buys_df.copy()
    buys_df2["month"] = pd.to_datetime(buys_df2["timestamp"]).dt.to_period("M")
    monthly_pnl = buys_df2.groupby("month").apply(
        lambda g: g[g["resolved_win"] == True]["size_usdc"].sum() * 0.9
                - g[g["resolved_win"] == False]["size_usdc"].sum()
        if "resolved_win" in g.columns else 0,
        include_groups=False
    )
    sharpe = monthly_pnl.mean() / monthly_pnl.std() * np.sqrt(12) \
             if monthly_pnl.std() > 0 else float("nan")

    return {
        "total_trades":       len(buys_df),
        "total_invested_usdc": round(total_in, 2),
        "total_returned_usdc": round(total_out, 2),
        "net_pnl_usdc":       round(net_pnl, 2),
        "roi_pct":            round(roi * 100, 2),
        "win_rate_pct":       win_rate,
        "annualized_sharpe":  round(sharpe, 3) if not np.isnan(sharpe) else None,
        "unique_markets":     int(buys_df["market_id"].nunique()),
        "date_range": (
            str(pd.to_datetime(df["timestamp"]).min().date()),
            str(pd.to_datetime(df["timestamp"]).max().date()),
        ),
    }


def alpha_decomposition(df: pd.DataFrame, n_simulations: int = 5_000) -> dict:
    """
    Decompose returns into skill vs luck using Monte Carlo simulation.
    Null: trades are placed randomly (no edge). Compare actual ROI distribution
    against null to estimate alpha fraction.
    """
    b = buys_only(df).copy()
    if "resolved_win" not in b.columns:
        return {"error": "resolved_win required"}

    actual_wr = b["resolved_win"].mean()
    n         = len(b)
    b_odds    = ((1 / b["price"]) - 1)
    avg_odds  = b_odds.mean()

    null_wins = np.random.binomial(n, 0.5, size=n_simulations) / n
    percentile_rank = (null_wins < actual_wr).mean() * 100

    # p-value: how often does random beat actual win rate?
    pval = stats.binomtest(int(actual_wr * n), n, 0.5, alternative="greater").pvalue
    alpha_pct = max(0, (actual_wr - 0.5) / 0.5)

    return {
        "actual_win_rate":         round(actual_wr, 4),
        "random_baseline_win_rate": 0.5,
        "percentile_vs_random":    round(percentile_rank, 1),
        "binomial_p_value":        round(pval, 6),
        "estimated_alpha_fraction": round(alpha_pct, 4),
        "skill_vs_luck_note": (
            f"Win rate of {actual_wr:.1%} is at the {percentile_rank:.0f}th percentile "
            f"vs a random baseline. p={pval:.4f}. "
            f"Estimated {alpha_pct:.1%} of performance attributable to genuine edge."
        ),
    }


def replicability_score(hypotheses: dict) -> dict:
    """Grade how automatable the detected strategy is (1–10)."""
    score = 5  # baseline
    notes = []

    if hypotheses.get("B", {}).get("supported"):
        score += 2
        notes.append("+2 Mispricing rule is purely quantitative (automatable)")
    if hypotheses.get("A", {}).get("supported"):
        score += 1
        notes.append("+1 Timing rule is clear (entry window detectable)")
    if hypotheses.get("D", {}).get("supported"):
        score -= 1
        notes.append("-1 News-reaction component requires NLP pipeline")
    if hypotheses.get("C", {}).get("supported"):
        score -= 2
        notes.append("-2 Market-making strategy depends on live order book")

    score = max(1, min(10, score))
    return {
        "replicability_score": score,
        "out_of": 10,
        "notes": notes,
        "verdict": (
            "High replicability — rule-based strategy suitable for automation"
            if score >= 7
            else "Moderate — some manual judgement required"
            if score >= 5
            else "Low — strategy has complex discretionary components"
        ),
    }
