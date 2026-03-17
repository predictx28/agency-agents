"""
ReplicatedTraderBot — Live/Paper trading bot for @k9Q2mX4L8A7ZP3R strategy replication.

Usage (paper trade):
    python bot.py --bankroll 1000 --paper

Usage (live — requires POLYMARKET_PRIVATE_KEY env var):
    python bot.py --bankroll 1000

After running pipeline.py, pass --params-file output/report_k9Q2mX4L8A7ZP3R.json
to load calibrated parameters automatically.
"""

import argparse
import asyncio
import json
import logging
import os
from pathlib import Path

from pipeline import ReplicatedTraderBot

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("polymarket-bot")


def load_calibrated_params(params_file: Path) -> dict:
    if not params_file.exists():
        log.warning("No params file found at %s — using defaults", params_file)
        return {}
    with open(params_file) as f:
        report = json.load(f)
    params = report.get("calibrated_model_params", {})
    log.info("Loaded calibrated params: %s", params)
    return params


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bankroll",    type=float, default=1000.0)
    parser.add_argument("--paper",       action="store_true", default=True)
    parser.add_argument("--live",        action="store_true", default=False)
    parser.add_argument("--params-file", type=Path, default=Path("output/report_k9Q2mX4L8A7ZP3R.json"))
    parser.add_argument("--max-iter",    type=int,  default=None, help="Stop after N polling cycles")
    args = parser.parse_args()

    paper_trade = not args.live

    private_key = os.getenv("POLYMARKET_PRIVATE_KEY", "")
    if not paper_trade and not private_key:
        log.error("POLYMARKET_PRIVATE_KEY env var required for live trading.")
        return

    calibrated_params = load_calibrated_params(args.params_file)

    bot = ReplicatedTraderBot(
        private_key       = private_key,
        bankroll_usdc     = args.bankroll,
        calibrated_params = calibrated_params,
        max_kelly_fraction = 0.25,   # fractional Kelly — non-negotiable risk control
        paper_trade       = paper_trade,
    )

    log.info(
        "Starting ReplicatedTraderBot | target=%s | bankroll=$%.2f | paper=%s",
        "@k9Q2mX4L8A7ZP3R", args.bankroll, paper_trade,
    )

    asyncio.run(bot.run(max_iterations=args.max_iter))

    # Print trade log summary
    if bot._trade_log:
        print(f"\n{'='*60}")
        print(f"TRADE LOG SUMMARY ({len(bot._trade_log)} signals fired)")
        print(f"{'='*60}")
        for t in bot._trade_log:
            print(
                f"  {'[PAPER]' if t['paper'] else '[LIVE]'} "
                f"{t['outcome']} | {t['question'][:50]} | "
                f"${t['kelly_size_usdc']} @ {t['current_price']} → FV {t['fair_value']}"
            )


if __name__ == "__main__":
    main()
