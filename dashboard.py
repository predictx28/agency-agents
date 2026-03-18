"""
dashboard.py — Real-time Polymarket LP Bot dashboard.

Run alongside the bot:
    pip install streamlit plotly
    streamlit run dashboard.py

Opens automatically in your browser at http://localhost:8501
Auto-refreshes every 5 seconds.
"""

import time
from pathlib import Path

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

# ── Page config ──────────────────────────────────────────────
st.set_page_config(
    page_title="Polymarket LP Bot",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="collapsed",
)

LOG_FILE = "bot_trades.csv"
REFRESH_SEC = 5

# ── Header ────────────────────────────────────────────────────
st.title("🧠 Polymarket LP Bot — Live Dashboard")
st.caption(f"Reading from `{LOG_FILE}` · Auto-refreshes every {REFRESH_SEC}s")

# ── Load data ─────────────────────────────────────────────────
@st.cache_data(ttl=REFRESH_SEC)
def load_trades(path: str) -> pd.DataFrame:
    if not Path(path).exists():
        return pd.DataFrame()
    try:
        df = pd.read_csv(path, parse_dates=["timestamp"])
        df = df[df["success"] == True]
        return df.sort_values("timestamp").reset_index(drop=True)
    except Exception:
        return pd.DataFrame()


df = load_trades(LOG_FILE)

# ── Empty state ───────────────────────────────────────────────
if df.empty:
    st.info(
        "No trades yet. Make sure the bot is running (`python run_bot.py`) "
        "and that `bot_trades.csv` exists in the same folder."
    )
    time.sleep(REFRESH_SEC)
    st.rerun()

# ── Derived columns ───────────────────────────────────────────
buys  = df[df["side"] == "BUY"]
sells = df[df["side"] == "SELL"]

total_deployed  = buys["size_usdc"].sum()
total_retrieved = sells["size_usdc"].sum()
net_exposure    = total_deployed - total_retrieved
realised_pnl    = total_retrieved - buys.loc[
    buys.index.isin(sells.index), "size_usdc"
].sum() if not sells.empty else 0.0

# Cumulative deployed over time
df_buys = buys.copy()
df_buys["cum_deployed"] = df_buys["size_usdc"].cumsum()

# Per-market exposure
mkt_exp = (
    buys.groupby("market_id")["size_usdc"].sum()
    - sells.groupby("market_id")["size_usdc"].sum().reindex(
        buys["market_id"].unique(), fill_value=0
    )
).reset_index()
mkt_exp.columns = ["market_id", "net_usdc"]
mkt_exp["market_short"] = mkt_exp["market_id"].astype(str).str[:14] + "…"
mkt_exp = mkt_exp.sort_values("net_usdc", ascending=False).head(20)

# ── KPI Row ───────────────────────────────────────────────────
k1, k2, k3, k4, k5 = st.columns(5)

k1.metric("Total Trades",      f"{len(df):,}")
k2.metric("Deployed (USDC)",   f"${total_deployed:,.2f}")
k3.metric("Retrieved (USDC)",  f"${total_retrieved:,.2f}")
k4.metric("Open Exposure",     f"${net_exposure:,.2f}")
k5.metric("Markets Active",    f"{df['market_id'].nunique():,}")

st.divider()

# ── Charts row ────────────────────────────────────────────────
col_left, col_right = st.columns(2)

with col_left:
    st.subheader("Cumulative Capital Deployed")
    fig = px.area(
        df_buys,
        x="timestamp",
        y="cum_deployed",
        labels={"cum_deployed": "USDC", "timestamp": ""},
        color_discrete_sequence=["#7C3AED"],
    )
    fig.update_layout(margin=dict(l=0, r=0, t=10, b=0), height=280)
    st.plotly_chart(fig, use_container_width=True)

with col_right:
    st.subheader("Orders by Outcome")
    outcome_counts = df.groupby(["side", "outcome"]).size().reset_index(name="count")
    fig2 = px.bar(
        outcome_counts,
        x="outcome",
        y="count",
        color="side",
        barmode="group",
        color_discrete_map={"BUY": "#7C3AED", "SELL": "#F59E0B"},
        labels={"count": "Orders", "outcome": ""},
    )
    fig2.update_layout(margin=dict(l=0, r=0, t=10, b=0), height=280)
    st.plotly_chart(fig2, use_container_width=True)

# ── Market exposure bar ───────────────────────────────────────
st.subheader("Top 20 Markets by Open Exposure (USDC)")
fig3 = px.bar(
    mkt_exp,
    x="market_short",
    y="net_usdc",
    color="net_usdc",
    color_continuous_scale="Purples",
    labels={"net_usdc": "USDC", "market_short": "Market ID"},
)
fig3.update_layout(
    margin=dict(l=0, r=0, t=10, b=0),
    height=260,
    coloraxis_showscale=False,
)
st.plotly_chart(fig3, use_container_width=True)

# ── Price distribution ────────────────────────────────────────
col3, col4 = st.columns(2)

with col3:
    st.subheader("Entry Price Distribution")
    fig4 = px.histogram(
        buys,
        x="fill_price",
        nbins=40,
        color_discrete_sequence=["#7C3AED"],
        labels={"fill_price": "Fill Price", "count": "Orders"},
    )
    fig4.update_layout(margin=dict(l=0, r=0, t=10, b=0), height=260)
    st.plotly_chart(fig4, use_container_width=True)

with col4:
    st.subheader("Order Size Distribution")
    fig5 = px.histogram(
        buys,
        x="size_usdc",
        nbins=40,
        color_discrete_sequence=["#F59E0B"],
        labels={"size_usdc": "Size (USDC)", "count": "Orders"},
    )
    fig5.update_layout(margin=dict(l=0, r=0, t=10, b=0), height=260)
    st.plotly_chart(fig5, use_container_width=True)

# ── Hourly activity ───────────────────────────────────────────
st.subheader("Hourly Trade Activity")
df["hour"] = df["timestamp"].dt.floor("h")
hourly = df.groupby("hour").agg(
    trades=("side", "count"),
    volume=("size_usdc", "sum"),
).reset_index()
fig6 = go.Figure()
fig6.add_bar(x=hourly["hour"], y=hourly["trades"], name="Trades", marker_color="#7C3AED")
fig6.add_scatter(
    x=hourly["hour"], y=hourly["volume"],
    name="Volume (USDC)", yaxis="y2",
    line=dict(color="#F59E0B", width=2),
)
fig6.update_layout(
    yaxis=dict(title="Trades"),
    yaxis2=dict(title="Volume (USDC)", overlaying="y", side="right"),
    legend=dict(orientation="h"),
    margin=dict(l=0, r=0, t=10, b=0),
    height=260,
)
st.plotly_chart(fig6, use_container_width=True)

# ── Recent trades table ───────────────────────────────────────
st.subheader("Recent Trades")
display_cols = ["timestamp", "side", "outcome", "price", "fill_price", "size_usdc", "tokens", "market_id"]
available = [c for c in display_cols if c in df.columns]
recent = df[available].tail(50).sort_values("timestamp", ascending=False)
recent["market_id"] = recent["market_id"].astype(str).str[:20] + "…"

st.dataframe(
    recent.style.apply(
        lambda row: [
            "background-color: #1e1b4b" if row["side"] == "BUY"
            else "background-color: #451a03"
            for _ in row
        ],
        axis=1,
    ),
    use_container_width=True,
    height=400,
)

# ── Footer / auto-refresh ─────────────────────────────────────
st.caption(f"Last updated: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}")
time.sleep(REFRESH_SEC)
st.rerun()
