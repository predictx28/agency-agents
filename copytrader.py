"""
DEUS VULT -- Copy Trader
Polls a target Polymarket wallet, mirrors trades, and streams live state
to a browser dashboard via WebSocket.

Run:
    python copytrader.py

Then open: http://localhost:8001
(runs on 8001 so it doesn't clash with server.py on 8000)
"""

import os, time, math, json, asyncio, threading, requests
from datetime import datetime, timezone
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import uvicorn

load_dotenv()

# ── CONFIG ─────────────────────────────────────────────────────────────────────
PRIVATE_KEY        = os.getenv("PRIVATE_KEY", "")
FUNDER_ADDRESS     = os.getenv("FUNDER_ADDRESS", "")
POLYMARKET_ADDRESS = os.getenv("POLYMARKET_ADDRESS", FUNDER_ADDRESS)
DRY_RUN            = os.getenv("DRY_RUN", "true").lower() == "true"
TELEGRAM_TOKEN     = os.getenv("TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID   = os.getenv("TELEGRAM_CHAT_ID", "")

COPY_TARGET    = os.getenv("COPY_TARGET",     "0x732F1c8A9C8D609F916Bcf3c4f5f96D7f3B12b33")
COPY_MIN_USD   = float(os.getenv("COPY_MIN_USD",    "20"))
COPY_MAX_BET   = float(os.getenv("COPY_MAX_BET_USD","50"))
COPY_SLIPPAGE  = float(os.getenv("COPY_SLIPPAGE",   "0.03"))
COPY_SIDE      = os.getenv("COPY_SIDE", "").upper().strip()  # "DOWN", "UP", or "" for both
COPY_SKIP_ASSET      = os.getenv("COPY_SKIP_ASSET", "Ethereum").strip()   # asset title prefix to skip
COPY_MIN_AGE         = float(os.getenv("COPY_MIN_AGE", "6"))                  # skip trades copied under 6s old
COPY_MIN_PRICE       = float(os.getenv("COPY_MIN_PRICE",  "0.30"))           # skip entry price below 30c
COPY_SKIP_BET_MIN    = float(os.getenv("COPY_SKIP_BET_MIN", "35"))           # skip bets in $35-45 dead zone
COPY_SKIP_BET_MAX    = float(os.getenv("COPY_SKIP_BET_MAX", "45"))           # skip bets in $35-45 dead zone

COPY_POLL_SECS = int(os.getenv("COPY_POLL_SECS",    "1"))

HOST_CLOB  = "https://clob.polymarket.com"
HOST_DATA  = "https://data-api.polymarket.com"
CHAIN_ID   = 137
PORT       = 8001

# ── FASTAPI + SHARED STATE ─────────────────────────────────────────────────────
app        = FastAPI()
clients    = []
state_lock = threading.Lock()
_MO_PARAM  = "amount"  # detected at startup
broadcast_queue = asyncio.Queue()

STARTING_BALANCE = float(os.getenv("STARTING_BANKROLL", "10.77"))

state = {
    "running":        False,
    "dry_run":        DRY_RUN,
    "balance":        None,
    "start_balance":  STARTING_BALANCE,
    "wins":           0,
    "losses":         0,
    "pnl":            0.0,
    "total_copied":   0,
    "total_skipped":  0,
    "open_positions": [],
    "last_trade":     None,
    "target":         COPY_TARGET,
    "poll_count":     0,
    "trade_history":  [],   # full settled trade log for table + export
    "logs":           [],
}

# ── LOGGING ────────────────────────────────────────────────────────────────────
def log(msg, tag="INFO"):
    ts    = datetime.now(timezone.utc).strftime("%H:%M:%S")
    entry = {"ts": ts, "msg": msg, "tag": tag}
    print(f"[{ts}] [{tag}] {msg}", flush=True)
    with state_lock:
        state["logs"].insert(0, entry)
        if len(state["logs"]) > 300:
            state["logs"].pop()
    try:
        broadcast_queue.put_nowait({"type": "log", "entry": entry})
    except Exception:
        pass

def telegram(msg):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            json={"chat_id": TELEGRAM_CHAT_ID, "text": msg, "parse_mode": "HTML"},
            timeout=5
        )
    except Exception:
        pass

# ── WEBSOCKET ──────────────────────────────────────────────────────────────────
def get_public_state():
    with state_lock:
        s = dict(state)
        s["logs"] = []
    return s

@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    clients.append(ws)
    try:
        await ws.send_json({"type": "init", "state": {**get_public_state(), "logs": state["logs"]}})
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if ws in clients:
            clients.remove(ws)

@app.post("/start")
async def start_bot():
    with state_lock:
        state["running"] = True
    return {"ok": True}

@app.post("/stop")
async def stop_bot():
    with state_lock:
        state["running"] = False
    return {"ok": True}

@app.get("/trades")
async def get_trades():
    with state_lock:
        return state["trade_history"]

@app.get("/export")
async def export_trades():
    from fastapi.responses import Response
    with state_lock:
        history  = list(state["trade_history"])
        wins_    = state["wins"]
        losses_  = state["losses"]
        pnl_     = state["pnl"]
        balance_ = state["balance"]

    settled  = [t for t in history if t["status"] == "settled"]
    win_list = [t for t in settled if t["result"] == "win"]
    loss_list= [t for t in settled if t["result"] == "loss"]
    total    = len(settled)
    wr       = round(win_list.__len__() / total * 100, 1) if total else 0

    # Per-price-bucket win rates for optimisation
    buckets = {}
    for t in settled:
        b = f"{int(t.get('target_price', t.get('entry_price', 0)) * 100 // 10 * 10)}c-{int(t.get('target_price', t.get('entry_price', 0)) * 100 // 10 * 10 + 10)}c"
        if b not in buckets:
            buckets[b] = {"wins": 0, "losses": 0, "total_pnl": 0}
        if t["result"] == "win":
            buckets[b]["wins"] += 1
        else:
            buckets[b]["losses"] += 1
        buckets[b]["total_pnl"] = round(buckets[b]["total_pnl"] + (t["pnl"] or 0), 4)

    avg_their_bet = round(sum(t.get("their_bet", 0) for t in history) / max(len(history), 1), 2)
    avg_age       = round(sum(t.get("age_at_copy", 0) for t in history) / max(len(history), 1), 1)
    avg_slippage  = round(sum(t.get("slippage", 0) for t in history) / max(len(history), 1) * 100, 2)

    payload = json.dumps({
        "meta": {
            "exported_at":     datetime.now(timezone.utc).isoformat(),
            "export_version":  "2.0",
            "note":            "Send this file for strategy optimisation",
        },
        "config": {
            "copy_target":    COPY_TARGET,
            "copy_min_usd":   COPY_MIN_USD,
            "copy_max_bet":   COPY_MAX_BET,
            "copy_slippage":  COPY_SLIPPAGE,
            "dry_run":        DRY_RUN,
        },
        "summary": {
            "total_trades":    len(history),
            "settled_trades":  total,
            "open_trades":     len(history) - total,
            "wins":            wins_,
            "losses":          losses_,
            "win_rate_pct":    wr,
            "total_pnl":       pnl_,
            "balance":         balance_,
            "avg_their_bet":   avg_their_bet,
            "avg_age_at_copy_s": avg_age,
            "avg_slippage_pct":  avg_slippage,
        },
        "price_bucket_analysis": buckets,
        "trades": history,
    }, indent=2)

    fname = f"copytrader_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
    return Response(
        content=payload,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={fname}"}
    )

async def broadcaster():
    while True:
        try:
            msg = await asyncio.wait_for(broadcast_queue.get(), timeout=0.5)
            dead = []
            for c in clients:
                try:
                    await c.send_json(msg)
                except Exception:
                    dead.append(c)
            for c in dead:
                if c in clients:
                    clients.remove(c)
        except asyncio.TimeoutError:
            if clients:
                try:
                    await clients[0].send_json({"type": "state", "data": get_public_state()})
                except Exception:
                    pass

@app.on_event("startup")
async def startup():
    asyncio.create_task(broadcaster())
    t = threading.Thread(target=bot_loop, daemon=True)
    t.start()

# ── DASHBOARD ──────────────────────────────────────────────────────────────────
DASHBOARD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DEUS VULT \u2014 Copy Trader</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#07080d;--s1:rgba(255,255,255,0.04);--s2:rgba(255,255,255,0.07);--s3:rgba(255,255,255,0.11);
    --b1:rgba(255,255,255,0.07);--b2:rgba(255,255,255,0.13);
    --tx:#dde1ed;--tx2:#7c839a;--tx3:#40455a;
    --grn:#2dd4a0;--grn-d:rgba(45,212,160,0.12);
    --red:#f16b6b;--red-d:rgba(241,107,107,0.12);
    --blu:#5ba0f5;--blu-d:rgba(91,160,245,0.12);
    --amb:#f5b731;--amb-d:rgba(245,183,49,0.12);
    --pur:#9d7ef0;--pur-d:rgba(157,126,240,0.12);
    --r:12px;--r-sm:7px;
    --mono:'DM Mono',monospace;--ui:'Outfit',sans-serif;
  }
  html,body{height:100%;background:var(--bg);color:var(--tx);font-family:var(--ui);font-size:13px}
  body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
    background:radial-gradient(ellipse 60% 40% at 0% 0%,rgba(157,126,240,0.06) 0%,transparent 60%),
               radial-gradient(ellipse 50% 35% at 100% 100%,rgba(45,212,160,0.05) 0%,transparent 60%)}
  ::-webkit-scrollbar{width:3px;height:3px}
  ::-webkit-scrollbar-thumb{background:var(--b2);border-radius:2px}
  #app{position:relative;z-index:1;height:100vh;display:flex;flex-direction:column;overflow:hidden}

  /* ── TOPBAR ── */
  #topbar{display:flex;align-items:center;justify-content:space-between;padding:10px 18px;gap:12px;flex-shrink:0;
    border-bottom:1px solid var(--b1);background:rgba(7,8,13,0.9);backdrop-filter:blur(20px)}
  .tls{display:flex;gap:5px}
  .tl{width:11px;height:11px;border-radius:50%}
  .brand{font-size:14px;font-weight:800;letter-spacing:-0.3px}
  .brand-sub{font-size:9px;color:var(--tx3);letter-spacing:0.6px;text-transform:uppercase;display:flex;align-items:center;gap:5px;margin-top:1px}
  .run-dot{width:7px;height:7px;border-radius:50%;background:var(--red)}
  .pill{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:100px;font-size:9px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase}
  .pill-dry{background:var(--amb-d);color:var(--amb);border:1px solid rgba(245,183,49,0.2)}
  .pill-live{background:var(--red-d);color:var(--red);border:1px solid rgba(241,107,107,0.2);animation:pulse 2s infinite}
  .pill-dot{width:4px;height:4px;border-radius:50%;background:currentColor}
  .conn-dot{width:7px;height:7px;border-radius:50%;background:var(--red)}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  @keyframes blink{0%,100%{opacity:.8}50%{opacity:0}}

  /* ── TAB NAV ── */
  #tabs{display:flex;gap:2px;padding:0 18px;border-bottom:1px solid var(--b1);flex-shrink:0;background:rgba(7,8,13,0.7)}
  .tab{padding:9px 16px;font-size:11px;font-weight:600;color:var(--tx3);cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;letter-spacing:0.2px}
  .tab:hover{color:var(--tx2)}
  .tab.active{color:var(--tx);border-bottom-color:var(--pur)}

  /* ── PANELS ── */
  .panel{display:none;flex:1;overflow:hidden}
  .panel.active{display:flex}

  /* ── OVERVIEW PANEL ── */
  #p-overview{flex-direction:row;overflow:hidden}
  #ov-left{width:300px;flex-shrink:0;border-right:1px solid var(--b1);overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
  #ov-right{flex:1;display:flex;flex-direction:column;overflow:hidden}

  .card{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:13px}
  .card-title{font-size:9px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:var(--tx3);margin-bottom:10px}
  .stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
  .stat{background:var(--s2);border-radius:var(--r-sm);padding:9px 11px}
  .stat-label{font-size:9px;color:var(--tx3);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:3px}
  .stat-val{font-size:19px;font-weight:800;font-family:var(--mono);letter-spacing:-0.5px;font-variant-numeric:tabular-nums}

  .pos-list{display:flex;flex-direction:column;gap:5px;max-height:180px;overflow-y:auto}
  .pos-row{background:var(--s2);border:1px solid var(--b1);border-radius:var(--r-sm);padding:9px}
  .pos-header{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:3px}
  .pos-title{font-size:11px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pos-badge{font-size:8px;font-weight:800;padding:2px 6px;border-radius:4px;text-transform:uppercase;letter-spacing:0.4px;background:var(--grn-d);color:var(--grn);border:1px solid rgba(45,212,160,0.18)}
  .pos-meta{font-size:10px;color:var(--tx3);font-family:var(--mono);display:flex;gap:10px}

  .lt-title{font-size:12px;font-weight:600;margin-bottom:7px;line-height:1.4}
  .lt-grid{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:10px;font-family:var(--mono)}
  .lt-k{color:var(--tx3)}
  .lt-v{color:var(--tx2)}

  /* chart area */
  #chart-area{flex:1;display:flex;flex-direction:column;overflow:hidden;padding:14px;gap:12px}
  #chart-area h3{font-size:10px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:var(--tx3)}
  .chart-wrap{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:14px;flex:1;min-height:0;display:flex;flex-direction:column;gap:8px}
  .chart-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .chart-sm{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:12px;height:180px;display:flex;flex-direction:column}
  .chart-sm canvas{flex:1;min-height:0}
  canvas{width:100%!important}

  /* ── LOG ── */
  #log-wrap{display:flex;flex-direction:column;flex:1;overflow:hidden}
  #log-header{display:flex;align-items:center;justify-content:space-between;padding:9px 16px;border-bottom:1px solid var(--b1);flex-shrink:0}
  #log-area{flex:1;overflow-y:auto;padding:6px 0;font-family:var(--mono);font-size:11px}
  .log-row{display:flex;align-items:baseline;gap:7px;padding:2px 14px;transition:background .1s}
  .log-row:hover{background:var(--s1)}
  .log-ts{color:var(--tx3);flex-shrink:0;font-size:10px;min-width:50px}
  .log-tag-pill{font-size:8px;font-weight:700;padding:1px 5px;border-radius:3px;text-transform:uppercase;letter-spacing:0.4px;flex-shrink:0;min-width:36px;text-align:center}
  .log-msg{color:var(--tx2);flex:1}
  .lp-INFO{background:var(--s2);color:var(--tx3)}
  .lp-TRADE{background:var(--blu-d);color:var(--blu)}
  .lp-WIN{background:var(--grn-d);color:var(--grn)}
  .lp-LOSS{background:var(--red-d);color:var(--red)}
  .lp-WARN{background:var(--amb-d);color:var(--amb)}
  .lp-SYS{background:var(--pur-d);color:var(--pur)}
  .lp-COPY{background:rgba(91,160,245,0.12);color:#93c5fd}
  .tag-WIN .log-msg{color:var(--grn)}
  .tag-LOSS .log-msg{color:var(--red)}
  .tag-COPY .log-msg{color:#93c5fd}
  .cursor-line{display:flex;align-items:center;gap:7px;padding:2px 14px}
  .cursor-blink{width:6px;height:12px;background:var(--grn);border-radius:1px;animation:blink .9s step-end infinite}

  /* ── TRADES PANEL ── */
  #p-trades{flex-direction:column;overflow:hidden}
  #trades-toolbar{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--b1);flex-shrink:0;flex-wrap:wrap}
  .tb-label{font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:0.4px}
  .filter-btn{padding:4px 10px;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer;border:1px solid var(--b1);background:var(--s1);color:var(--tx2);transition:all .15s}
  .filter-btn.active{background:var(--pur-d);border-color:rgba(157,126,240,0.3);color:var(--pur)}
  .export-btn{margin-left:auto;padding:5px 14px;border-radius:7px;font-size:10px;font-weight:700;cursor:pointer;border:1px solid rgba(45,212,160,0.3);background:var(--grn-d);color:var(--grn);transition:all .15s;letter-spacing:0.3px}
  .export-btn:hover{background:rgba(45,212,160,0.2)}
  #trades-table-wrap{flex:1;overflow-y:auto;padding:0 0 8px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  thead th{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--tx3);padding:8px 14px;border-bottom:1px solid var(--b1);text-align:left;position:sticky;top:0;background:rgba(7,8,13,0.95);backdrop-filter:blur(10px)}
  tbody td{padding:9px 14px;border-bottom:1px solid rgba(255,255,255,0.03);font-family:var(--mono);font-size:11px;vertical-align:middle}
  tbody tr:hover td{background:var(--s1)}
  .badge{display:inline-block;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px}
  .b-win{background:var(--grn-d);color:var(--grn);border:1px solid rgba(45,212,160,0.2)}
  .b-loss{background:var(--red-d);color:var(--red);border:1px solid rgba(241,107,107,0.2)}
  .b-open{background:var(--amb-d);color:var(--amb);border:1px solid rgba(245,183,49,0.2)}
  .b-up{background:var(--grn-d);color:var(--grn)}
  .b-down{background:var(--red-d);color:var(--red)}
  .empty-state{text-align:center;padding:48px;color:var(--tx3);font-size:12px}

  /* ── ANALYTICS PANEL ── */
  #p-analytics{flex-direction:column;overflow-y:auto;padding:16px;gap:14px}
  .analytics-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
  .ana-card{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:14px}
  .ana-title{font-size:9px;font-weight:700;letter-spacing:0.7px;text-transform:uppercase;color:var(--tx3);margin-bottom:10px}
  .ana-val{font-size:24px;font-weight:800;font-family:var(--mono);letter-spacing:-0.5px}
  .ana-sub{font-size:10px;color:var(--tx3);margin-top:3px;font-family:var(--mono)}
  .bar-row{display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:10px;font-family:var(--mono)}
  .bar-label{color:var(--tx2);min-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px}
  .bar-track{flex:1;height:6px;background:var(--s3);border-radius:3px;overflow:hidden}
  .bar-fill{height:100%;border-radius:3px;transition:width .4s ease}
  .bar-count{color:var(--tx3);min-width:24px;text-align:right;font-size:9px}
  .insight-row{font-size:11px;color:var(--tx2);padding:6px 0;border-bottom:1px solid var(--b1);display:flex;gap:8px;align-items:flex-start;line-height:1.5}
  .insight-row:last-child{border-bottom:none}
  .insight-icon{flex-shrink:0;font-size:12px}
</style>
</head>
<body>
<div id="app">

  <!-- TOPBAR -->
  <div id="topbar">
    <div style="display:flex;align-items:center;gap:12px">
      <div class="tls">
        <div class="tl" style="background:#ff5f57"></div>
        <div class="tl" style="background:#febc2e"></div>
        <div class="tl" style="background:#28c840"></div>
      </div>
      <div>
        <div class="brand">DEUS VULT &#9876; Copy Trader</div>
        <div class="brand-sub">
          <span id="run-dot" class="run-dot"></span>
          <span id="run-lbl" style="color:var(--tx3)">Stopped</span>
          <span style="color:var(--tx3)">|</span>
          <span id="target-disp" style="color:var(--pur);font-family:var(--mono);font-size:9px">loading...</span>
        </div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px">
      <span id="mode-pill" class="pill pill-dry"><span class="pill-dot"></span><span id="mode-txt">Dry Run</span></span>
      <div style="display:flex;align-items:center;gap:5px">
        <div id="conn-d" class="conn-dot"></div>
        <span id="conn-lbl" style="color:var(--tx3);font-size:10px">Disconnected</span>
      </div>
    </div>
  </div>

  <!-- TABS -->
  <div id="tabs">
    <div class="tab active" onclick="switchTab('overview')">Overview</div>
    <div class="tab" onclick="switchTab('trades')">Trade History</div>
    <div class="tab" onclick="switchTab('analytics')">Analytics</div>
    <div class="tab" onclick="switchTab('log')">Log</div>
  </div>

  <!-- OVERVIEW -->
  <div id="p-overview" class="panel active">
    <div id="ov-left">
      <div class="card">
        <div class="card-title">Performance</div>
        <div class="stats-grid">
          <div class="stat"><div class="stat-label">Balance</div><div class="stat-val" id="s-balance" style="font-size:15px">&#8212;</div></div>
          <div class="stat"><div class="stat-label">ROI</div><div class="stat-val" id="s-roi" style="font-size:15px">&#8212;</div></div>
          <div class="stat"><div class="stat-label">P&amp;L</div><div class="stat-val" id="s-pnl" style="font-size:15px">&#8212;</div></div>
          <div class="stat"><div class="stat-label">Win Rate</div><div class="stat-val" id="s-wr">&#8212;</div></div>
          <div class="stat"><div class="stat-label">Record</div><div class="stat-val" id="s-wl" style="font-size:12px;padding-top:4px">&#8212;</div></div>
          <div class="stat"><div class="stat-label">Trades</div><div class="stat-val" id="s-copied">0</div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Last Copied Trade</div>
        <div id="lt-empty" style="color:var(--tx3);font-size:11px;text-align:center;padding:10px">Waiting...</div>
        <div id="lt-fill" style="display:none">
          <div class="lt-title" id="lt-title">&#8212;</div>
          <div class="lt-grid">
            <span class="lt-k">Outcome</span><span class="lt-v" id="lt-outcome">&#8212;</span>
            <span class="lt-k">Their bet</span><span class="lt-v" id="lt-their">&#8212;</span>
            <span class="lt-k">Our bet</span><span class="lt-v" id="lt-our">&#8212;</span>
            <span class="lt-k">Entry</span><span class="lt-v" id="lt-price">&#8212;</span>
            <span class="lt-k">Slippage</span><span class="lt-v" id="lt-slip">&#8212;</span>
            <span class="lt-k">Time</span><span class="lt-v" id="lt-time">&#8212;</span>
          </div>
        </div>
      </div>

      <div class="card" style="flex:1">
        <div class="card-title">Open Positions (<span id="pos-count">0</span>)</div>
        <div class="pos-list" id="pos-list"><div style="color:var(--tx3);font-size:11px;text-align:center;padding:14px">No open positions</div></div>
      </div>
    </div>

    <div id="chart-area">
      <div class="chart-wrap">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:10px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:var(--tx3)">P&amp;L curve</span>
          <span id="chart-roi-badge" style="font-size:11px;font-weight:700;font-family:var(--mono)">&#8212;</span>
        </div>
        <canvas id="pnlChart"></canvas>
      </div>
      <div class="chart-row">
        <div class="chart-sm">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:var(--tx3);margin-bottom:8px">Win rate by entry price</div>
          <canvas id="priceChart"></canvas>
        </div>
        <div class="chart-sm">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:var(--tx3);margin-bottom:8px">Slippage distribution</div>
          <canvas id="slipChart"></canvas>
        </div>
      </div>
    </div>
  </div>

  <!-- TRADES -->
  <div id="p-trades" class="panel">
    <div id="trades-toolbar">
      <span class="tb-label">Filter:</span>
      <div class="filter-btn active" onclick="setFilter('all',this)">All</div>
      <div class="filter-btn" onclick="setFilter('open',this)">Open</div>
      <div class="filter-btn" onclick="setFilter('win',this)">Wins</div>
      <div class="filter-btn" onclick="setFilter('loss',this)">Losses</div>
      <span id="trade-count" style="font-size:10px;color:var(--tx3);font-family:var(--mono)">0 trades</span>
      <button class="export-btn" onclick="exportTrades()">&#8595; Export JSON</button>
    </div>
    <div id="trades-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Time</th><th>Market</th><th>Outcome</th>
            <th>Their $</th><th>Our $</th><th>Entry</th>
            <th>Slippage</th><th>Age</th><th>Expires</th><th>P&amp;L</th><th>Status</th>
          </tr>
        </thead>
        <tbody id="trades-tbody"></tbody>
      </table>
      <div id="trades-empty" class="empty-state" style="display:none">No trades yet</div>
    </div>
  </div>

  <!-- ANALYTICS -->
  <div id="p-analytics" class="panel" style="flex-direction:column;overflow-y:auto;padding:16px;gap:14px">
    <div class="analytics-grid">
      <div class="ana-card"><div class="ana-title">Avg Win</div><div class="ana-val" id="a-avgwin">&#8212;</div><div class="ana-sub">per winning trade</div></div>
      <div class="ana-card"><div class="ana-title">Avg Loss</div><div class="ana-val" id="a-avgloss">&#8212;</div><div class="ana-sub">per losing trade</div></div>
      <div class="ana-card"><div class="ana-title">Best Trade</div><div class="ana-val" id="a-best">&#8212;</div><div class="ana-sub" id="a-best-title">&#8212;</div></div>
      <div class="ana-card"><div class="ana-title">Worst Trade</div><div class="ana-val" id="a-worst">&#8212;</div><div class="ana-sub" id="a-worst-title">&#8212;</div></div>
      <div class="ana-card"><div class="ana-title">Avg Entry Price</div><div class="ana-val" id="a-avgprice">&#8212;</div><div class="ana-sub">across all trades</div></div>
      <div class="ana-card"><div class="ana-title">Avg Age at Copy</div><div class="ana-val" id="a-avgage">&#8212;</div><div class="ana-sub">seconds after target</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div class="ana-card">
        <div class="ana-title">Win rate by market type</div>
        <div id="a-by-market"></div>
      </div>
      <div class="ana-card">
        <div class="ana-title">Win rate by outcome (UP/DOWN)</div>
        <div id="a-by-side"></div>
      </div>
    </div>
    <div class="ana-card">
      <div class="ana-title">Optimisation insights</div>
      <div id="a-insights"></div>
    </div>
  </div>

  <!-- LOG -->
  <div id="p-log" class="panel">
    <div id="log-wrap">
      <div id="log-header">
        <span style="font-size:11px;font-weight:700">Activity Log</span>
        <span id="log-ct" style="font-size:10px;color:var(--tx3)">0 lines</span>
      </div>
      <div id="log-area"></div>
    </div>
  </div>

</div>
<script>
let logs=[], trades=[], isRunning=false, activeTab='overview', tradeFilter='all';
setInterval(()=>{ if(activeTab==='trades'&&tradeFilter==='open') renderTradesTable(); },1000);
let pnlChart=null, priceChart=null, slipChart=null;
const PORT=""" + str(PORT) + r""";

// ── TABS ──────────────────────────────────────────────────────────────────────
function switchTab(t){
  activeTab=t;
  document.querySelectorAll('.tab').forEach((el,i)=>el.classList.toggle('active',['overview','trades','analytics','log'][i]===t));
  document.querySelectorAll('.panel').forEach(el=>el.classList.remove('active'));
  document.getElementById('p-'+t).classList.add('active');
  if(t==='analytics') renderAnalytics();
  if(t==='trades')    renderTradesTable();
}

// ── WS ────────────────────────────────────────────────────────────────────────
function connect(){
  const ws=new WebSocket("ws://localhost:"+PORT+"/ws");
  ws.onopen=()=>setConn(true);
  ws.onmessage=ev=>{
    const m=JSON.parse(ev.data);
    if(m.type==="init"){logs=m.state.logs||[];trades=m.state.trade_history||[];renderAll();updateState(m.state);}
    else if(m.type==="log"){addLog(m.entry);}
    else if(m.type==="state"){trades=m.data.trade_history||[];updateState(m.data);if(activeTab==='analytics')renderAnalytics();if(activeTab==='trades')renderTradesTable();}
  };
  ws.onclose=()=>{setConn(false);setTimeout(connect,2000);};
  ws.onerror=()=>setConn(false);
}
function setConn(v){
  document.getElementById('conn-d').style.background=v?'var(--grn)':'var(--red)';
  document.getElementById('conn-d').style.animation=v?'pulse 2s infinite':'none';
  document.getElementById('conn-lbl').textContent=v?'Connected':'Disconnected';
  document.getElementById('conn-lbl').style.color=v?'var(--grn)':'var(--tx3)';
}

// ── LOGS ──────────────────────────────────────────────────────────────────────
function makeRow(e){
  const d=document.createElement('div');d.className='log-row tag-'+e.tag;
  d.innerHTML='<span class="log-ts">'+e.ts+'</span><span class="log-tag-pill lp-'+e.tag+'">'+e.tag+'</span><span class="log-msg">'+e.msg+'</span>';
  return d;
}
function renderAll(){const la=document.getElementById('log-area');la.innerHTML='';logs.forEach(l=>la.appendChild(makeRow(l)));appendCursor();document.getElementById('log-ct').textContent=logs.length+' lines';}
function addLog(e){
  logs.unshift(e);if(logs.length>300)logs.pop();
  const la=document.getElementById('log-area'),cr=document.getElementById('cursor-row');if(cr)cr.remove();
  la.insertBefore(makeRow(e),la.firstChild);appendCursor();
  document.getElementById('log-ct').textContent=logs.length+' lines';
}
function appendCursor(){
  let c=document.getElementById('cursor-row');if(c)c.remove();if(!isRunning)return;
  c=document.createElement('div');c.id='cursor-row';c.className='cursor-line';
  c.innerHTML='<span class="log-ts" style="color:var(--tx3)">'+new Date().toLocaleTimeString('en-US',{hour12:false})+'</span><span class="cursor-blink"></span>';
  document.getElementById('log-area').insertBefore(c,document.getElementById('log-area').firstChild);
}

// ── STATE UPDATE ──────────────────────────────────────────────────────────────
function updateState(s){
  isRunning=s.running;
  document.getElementById('mode-pill').className='pill '+(s.dry_run?'pill-dry':'pill-live');
  document.getElementById('mode-txt').textContent=s.dry_run?'Dry Run':'Live';
  const rd=document.getElementById('run-dot'),rl=document.getElementById('run-lbl');
  rd.style.background=s.running?'var(--grn)':'var(--red)';
  rd.style.animation=s.running?'pulse 1.5s infinite':'none';
  rl.textContent=s.running?'Running':'Stopped';
  rl.style.color=s.running?'var(--grn)':'var(--tx3)';
  appendCursor();
  if(s.target)document.getElementById('target-disp').textContent=s.target.slice(0,6)+'...'+s.target.slice(-4);

  const bal=s.balance!=null?parseFloat(s.balance):null;
  const pnl=parseFloat(s.pnl)||0;
  const wins=parseInt(s.wins)||0,losses=parseInt(s.losses)||0,total=wins+losses;
  const wr=total>0?(wins/total*100).toFixed(0):null;
  const startBal=parseFloat(s.start_balance)||10.77;
  const roi=bal!=null?((bal-startBal)/startBal*100):((pnl/startBal)*100);

  const be=document.getElementById('s-balance');
  if(bal!=null){be.textContent='$'+bal.toFixed(2);be.style.color=bal>startBal?'var(--grn)':bal<startBal?'var(--red)':'var(--tx)';}
  const re=document.getElementById('s-roi');
  re.textContent=(roi>=0?'+':'')+roi.toFixed(1)+'%';
  re.style.color=roi>0?'var(--grn)':roi<0?'var(--red)':'var(--tx2)';
  document.getElementById('chart-roi-badge').textContent=(roi>=0?'+':'')+roi.toFixed(1)+'%';
  document.getElementById('chart-roi-badge').style.color=roi>0?'var(--grn)':roi<0?'var(--red)':'var(--tx2)';
  const pe=document.getElementById('s-pnl');
  pe.textContent=(pnl>=0?'+$':'-$')+Math.abs(pnl).toFixed(2);
  pe.style.color=pnl>0?'var(--grn)':pnl<0?'var(--red)':'var(--tx2)';
  const we=document.getElementById('s-wr');
  if(wr!=null){we.textContent=wr+'%';we.style.color=wins>=losses?'var(--grn)':'var(--amb)';}
  document.getElementById('s-wl').textContent=wins+'W / '+losses+'L';
  document.getElementById('s-copied').textContent=s.total_copied||0;

  const lt=s.last_trade;
  if(lt){
    document.getElementById('lt-empty').style.display='none';
    document.getElementById('lt-fill').style.display='block';
    document.getElementById('lt-title').textContent=lt.title||'—';
    document.getElementById('lt-outcome').textContent=lt.outcome||'—';
    document.getElementById('lt-their').textContent='$'+(lt.their_bet||0).toFixed(0);
    document.getElementById('lt-our').textContent='$'+(lt.our_bet||0).toFixed(2);
    document.getElementById('lt-price').textContent=((lt.price||0)*100).toFixed(1)+'c';
    document.getElementById('lt-slip').textContent=((lt.slippage||0)*100).toFixed(1)+'%';
    document.getElementById('lt-time').textContent=lt.time||'—';
  }

  const positions=s.open_positions||[];
  document.getElementById('pos-count').textContent=positions.length;
  const pl=document.getElementById('pos-list');
  if(!positions.length){pl.innerHTML='<div style="color:var(--tx3);font-size:11px;text-align:center;padding:14px">No open positions</div>';}
  else{pl.innerHTML=positions.map(p=>'<div class="pos-row"><div class="pos-header"><div class="pos-title">'+(p.title||'?')+'</div><div class="pos-badge">'+(p.outcome||p.side)+'</div></div><div class="pos-meta"><span>$'+parseFloat(p.cost).toFixed(2)+' @ '+(parseFloat(p.entry_price)*100).toFixed(1)+'c</span><span>'+(p.time||'')+'</span></div></div>').join('');}

  updateCharts(s);
}

// ── CHARTS ────────────────────────────────────────────────────────────────────
const gc={color:'rgba(255,255,255,0.05)'},tc={color:'#40455a',font:{family:"'DM Mono'",size:10}};
function mkCfg(type,data,opts){return{type,data,options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false},...(opts.plugins||{})},scales:opts.scales||{}}};}

function updateCharts(s){
  const settled=trades.filter(t=>t.status==='settled');
  // PnL curve
  let cum=0;
  const pts=settled.map((t,i)=>{cum+=t.pnl||0;return{x:i+1,y:parseFloat(cum.toFixed(4))};});
  if(!pnlChart){
    const ctx=document.getElementById('pnlChart').getContext('2d');
    pnlChart=new Chart(ctx,mkCfg('line',{labels:pts.map(p=>p.x),datasets:[{data:pts.map(p=>p.y),borderColor:'#9d7ef0',borderWidth:1.5,pointRadius:0,fill:true,backgroundColor:'rgba(157,126,240,0.08)',tension:0.3}]},{scales:{x:{display:false},y:{grid:gc,ticks:tc}}}));
  } else {
    pnlChart.data.labels=pts.map(p=>p.x);
    pnlChart.data.datasets[0].data=pts.map(p=>p.y);
    pnlChart.data.datasets[0].borderColor=cum>=0?'#2dd4a0':'#f16b6b';
    pnlChart.data.datasets[0].backgroundColor=cum>=0?'rgba(45,212,160,0.08)':'rgba(241,107,107,0.08)';
    pnlChart.update('none');
  }
  // Entry price win rate buckets
  const buckets={};
  settled.forEach(t=>{const b=Math.floor(parseFloat(t.entry_price)*10)*10;if(!buckets[b])buckets[b]={w:0,l:0};t.result==='win'?buckets[b].w++:buckets[b].l++;});
  const pLabels=Object.keys(buckets).sort((a,b)=>a-b).map(k=>k+'c-'+(parseInt(k)+10)+'c');
  const pWR=Object.keys(buckets).sort((a,b)=>a-b).map(k=>{const v=buckets[k];return v.w+v.l>0?Math.round(v.w/(v.w+v.l)*100):0;});
  const smOpts={responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false}},scales:{x:{grid:gc,ticks:{...tc,maxRotation:0}},y:{grid:gc,ticks:tc}}};
  if(!priceChart){
    const ctx=document.getElementById('priceChart').getContext('2d');
    priceChart=new Chart(ctx,{type:'bar',data:{labels:pLabels,datasets:[{data:pWR,backgroundColor:pWR.map(v=>v>=50?'rgba(45,212,160,0.6)':'rgba(241,107,107,0.6)'),borderRadius:3}]},options:{...smOpts,scales:{...smOpts.scales,y:{...smOpts.scales.y,ticks:{...tc,callback:v=>v+'%'},max:100}}}});
  } else {priceChart.data.labels=pLabels;priceChart.data.datasets[0].data=pWR;priceChart.data.datasets[0].backgroundColor=pWR.map(v=>v>=50?'rgba(45,212,160,0.6)':'rgba(241,107,107,0.6)');priceChart.update('none');}
  // Slippage distribution
  const sSlabs={'0-1%':0,'1-2%':0,'2-3%':0,'3-5%':0,'5%+':0};
  trades.forEach(t=>{const sp=(t.slippage||0)*100;if(sp<1)sSlabs['0-1%']++;else if(sp<2)sSlabs['1-2%']++;else if(sp<3)sSlabs['2-3%']++;else if(sp<5)sSlabs['3-5%']++;else sSlabs['5%+']++;});
  if(!slipChart){
    const ctx=document.getElementById('slipChart').getContext('2d');
    slipChart=new Chart(ctx,{type:'bar',data:{labels:Object.keys(sSlabs),datasets:[{data:Object.values(sSlabs),backgroundColor:'rgba(91,160,245,0.5)',borderRadius:3}]},options:smOpts});
  } else {slipChart.data.datasets[0].data=Object.values(sSlabs);slipChart.update('none');}
}

// ── TRADES TABLE ──────────────────────────────────────────────────────────────
function setFilter(f,el){
  tradeFilter=f;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  renderTradesTable();
}
function getExpiryTs(t){
  const slug=t.slug||'';
  // Timestamped slugs: btc-updown-5m-1773714600, xrp-updown-15m-1773712800, btc-updown-15m-1773710100
  const tsMatch=slug.match(/-(\d{10})$/);
  if(tsMatch){
    const start=parseInt(tsMatch[1]);
    if(slug.includes('-5m-'))  return start+300;
    if(slug.includes('-15m-')) return start+900;
    return start+3600; // fallback
  }
  // Hourly named slugs: need to parse from title
  // e.g. "Bitcoin Up or Down - March 16, 10PM ET" -> 10PM ET = 22:00 ET
  const title=t.title||'';
  const hourMatch=title.match(/(\d{1,2})(?::(\d{2}))?([AP]M)\s*ET/i);
  if(hourMatch){
    let h=parseInt(hourMatch[1]);
    const m=hourMatch[2]?parseInt(hourMatch[2]):0;
    const ampm=hourMatch[3].toUpperCase();
    if(ampm==='PM'&&h!==12) h+=12;
    if(ampm==='AM'&&h===12) h=0;
    // Build date from trade timestamp_utc or date field
    const dateStr=t.date||new Date().toISOString().slice(0,10);
    // ET is UTC-4 (EDT) or UTC-5 (EST) — use UTC-4 for now (Mar = EDT)
    const etOffsetMs=4*3600*1000;
    const d=new Date(dateStr+'T00:00:00Z');
    d.setTime(d.getTime()+h*3600000+m*60000+etOffsetMs);
    return d.getTime()/1000+3600; // hourly market ends 1hr after start
  }
  return null;
}

function fmtCountdown(secsLeft){
  if(secsLeft<=0) return '<span style="color:var(--red);font-size:10px">expired</span>';
  const h=Math.floor(secsLeft/3600);
  const m=Math.floor((secsLeft%3600)/60);
  const s=Math.floor(secsLeft%60);
  const color=secsLeft<300?'var(--red)':secsLeft<1800?'var(--amb)':'var(--grn)';
  if(h>0) return '<span style="color:'+color+';font-size:10px">'+h+'h '+m+'m</span>';
  if(m>0) return '<span style="color:'+color+';font-size:10px">'+m+'m '+s+'s</span>';
  return '<span style="color:var(--red);font-size:10px;font-weight:500">'+s+'s</span>';
}

function renderTradesTable(){
  let filtered=trades;
  if(tradeFilter==='open')filtered=trades.filter(t=>t.status==='open');
  else if(tradeFilter==='win')filtered=trades.filter(t=>t.result==='win');
  else if(tradeFilter==='loss')filtered=trades.filter(t=>t.result==='loss');
  document.getElementById('trade-count').textContent=filtered.length+' trades';
  const tbody=document.getElementById('trades-tbody');
  const empty=document.getElementById('trades-empty');
  if(!filtered.length){tbody.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';
  const nowTs=Date.now()/1000;
  tbody.innerHTML=filtered.map(t=>{
    const res=t.result,pnl=t.pnl;
    const statusBadge=res==='win'?'<span class="badge b-win">Win</span>':res==='loss'?'<span class="badge b-loss">Loss</span>':'<span class="badge b-open">Open</span>';
    const pnlStr=pnl!=null?((pnl>=0?'<span style="color:var(--grn)">+$'+pnl.toFixed(2)+'</span>':'<span style="color:var(--red)">-$'+Math.abs(pnl).toFixed(2)+'</span>')):'<span style="color:var(--tx3)">—</span>';
    const outBadge=t.side==='UP'?'<span class="badge b-up">UP</span>':'<span class="badge b-down">DN</span>';
    let countdownCell='<td></td>';
    if(t.status==='open'){
      const expiry=getExpiryTs(t);
      const secsLeft=expiry?Math.max(0,expiry-nowTs):null;
      countdownCell='<td style="white-space:nowrap">'+(secsLeft!==null?fmtCountdown(secsLeft):'<span style="color:var(--tx3);font-size:10px">—</span>')+'</td>';
    }
    return '<tr><td style="color:var(--tx3);white-space:nowrap">'+t.time+' '+t.date+'</td>'
      +'<td style="color:var(--tx);min-width:200px">'+t.title+'</td>'
      +'<td>'+outBadge+' <span style="color:var(--tx2);font-size:10px">'+t.outcome+'</span></td>'
      +'<td style="color:var(--tx2)">$'+parseFloat(t.their_bet||0).toFixed(0)+'</td>'
      +'<td style="color:var(--tx)">$'+parseFloat(t.our_bet||0).toFixed(2)+'</td>'
      +'<td style="color:var(--amb)">'+((t.entry_price||0)*100).toFixed(1)+'c</td>'
      +'<td style="color:var(--tx3)">'+((t.slippage||0)*100).toFixed(1)+'%</td>'
      +'<td style="color:var(--tx3)">'+parseFloat(t.age_at_copy||0).toFixed(0)+'s</td>'
      +countdownCell
      +'<td>'+pnlStr+'</td>'
      +'<td>'+statusBadge+'</td></tr>';
  }).join('');
}

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
function renderAnalytics(){
  const settled=trades.filter(t=>t.status==='settled');
  if(!settled.length){
    ['a-avgwin','a-avgloss','a-best','a-worst','a-avgprice','a-avgage'].forEach(id=>{document.getElementById(id).textContent='—';});
    document.getElementById('a-insights').innerHTML='<div class="insight-row"><span class="insight-icon">&#128200;</span>No settled trades yet — insights will appear once trades resolve.</div>';
    return;
  }
  const wins=settled.filter(t=>t.result==='win');
  const losses=settled.filter(t=>t.result==='loss');
  const avgWin=wins.length?wins.reduce((s,t)=>s+(t.pnl||0),0)/wins.length:0;
  const avgLoss=losses.length?losses.reduce((s,t)=>s+(t.pnl||0),0)/losses.length:0;
  const best=settled.reduce((a,b)=>(b.pnl||0)>(a.pnl||0)?b:a,settled[0]);
  const worst=settled.reduce((a,b)=>(b.pnl||0)<(a.pnl||0)?b:a,settled[0]);
  const avgPrice=trades.reduce((s,t)=>s+(t.entry_price||0),0)/trades.length;
  const avgAge=trades.reduce((s,t)=>s+(t.age_at_copy||0),0)/trades.length;

  document.getElementById('a-avgwin').textContent='+$'+avgWin.toFixed(2);
  document.getElementById('a-avgwin').style.color='var(--grn)';
  document.getElementById('a-avgloss').textContent='-$'+Math.abs(avgLoss).toFixed(2);
  document.getElementById('a-avgloss').style.color='var(--red)';
  document.getElementById('a-best').textContent='+$'+(best.pnl||0).toFixed(2);
  document.getElementById('a-best').style.color='var(--grn)';
  document.getElementById('a-best-title').textContent=(best.title||'').slice(0,28);
  document.getElementById('a-worst').textContent='$'+(worst.pnl||0).toFixed(2);
  document.getElementById('a-worst').style.color='var(--red)';
  document.getElementById('a-worst-title').textContent=(worst.title||'').slice(0,28);
  document.getElementById('a-avgprice').textContent=(avgPrice*100).toFixed(1)+'c';
  document.getElementById('a-avgage').textContent=avgAge.toFixed(1)+'s';

  // By market type
  const byMkt={};
  settled.forEach(t=>{const k=t.title.split(' ')[0]||'Other';if(!byMkt[k])byMkt[k]={w:0,l:0};t.result==='win'?byMkt[k].w++:byMkt[k].l++;});
  const mkTop=Object.entries(byMkt).sort((a,b)=>(b[1].w+b[1].l)-(a[1].w+a[1].l)).slice(0,5);
  const maxMkt=Math.max(...mkTop.map(([,v])=>v.w+v.l),1);
  document.getElementById('a-by-market').innerHTML=mkTop.map(([k,v])=>{
    const wr=v.w+v.l>0?Math.round(v.w/(v.w+v.l)*100):0;
    return '<div class="bar-row"><div class="bar-label">'+k+'</div><div class="bar-track"><div class="bar-fill" style="width:'+(v.w+v.l)/maxMkt*100+'%;background:'+(wr>=50?'var(--grn)':'var(--red)')+'"></div></div><div class="bar-count">'+wr+'%</div></div>';
  }).join('') || '<div style="color:var(--tx3);font-size:11px">No data</div>';

  // By side
  const bySide={UP:{w:0,l:0},DOWN:{w:0,l:0}};
  settled.forEach(t=>{const k=t.side;if(bySide[k])t.result==='win'?bySide[k].w++:bySide[k].l++;});
  document.getElementById('a-by-side').innerHTML=Object.entries(bySide).map(([k,v])=>{
    const total=v.w+v.l,wr=total?Math.round(v.w/total*100):0;
    return '<div class="bar-row"><div class="bar-label">'+k+'</div><div class="bar-track"><div class="bar-fill" style="width:'+wr+'%;background:'+(wr>=50?'var(--grn)':'var(--red)')+'"></div></div><div class="bar-count">'+wr+'% ('+total+')</div></div>';
  }).join('');

  // Insights
  const insights=[];
  const wr=settled.length?wins.length/settled.length:0;
  if(wr<0.45)insights.push({icon:'&#9888;',text:'Win rate below 45% — consider raising COPY_MIN_USD to filter for higher-conviction trades from the target wallet.'});
  else if(wr>0.65)insights.push({icon:'&#9989;',text:'Strong win rate above 65%. Strategy is working — consider increasing COPY_BET_USD gradually.'});
  if(avgAge>60)insights.push({icon:'&#128337;',text:'Average copy lag is '+avgAge.toFixed(0)+'s. Trades are being picked up late — verify VPN is running and poll interval is 1s.'});
  if(trades.filter(t=>(t.slippage||0)>0.04).length/Math.max(trades.length,1)>0.3)insights.push({icon:'&#128200;',text:'Over 30% of trades have >4% slippage. Target is trading fast-moving markets. Consider COPY_SLIPPAGE=0.08 to capture more trades.'});
  const priceBuckets={};
  settled.forEach(t=>{const b=Math.floor(t.entry_price*10);if(!priceBuckets[b])priceBuckets[b]={w:0,l:0};t.result==='win'?priceBuckets[b].w++:priceBuckets[b].l++;});
  const bestBucket=Object.entries(priceBuckets).filter(([,v])=>v.w+v.l>=3).sort((a,b)=>(b[1].w/(b[1].w+b[1].l))-(a[1].w/(a[1].w+a[1].l)))[0];
  if(bestBucket)insights.push({icon:'&#127919;',text:'Best win rate in the '+(parseInt(bestBucket[0])*10)+'c-'+(parseInt(bestBucket[0])*10+10)+'c price range. Consider narrowing entry prices to this bucket.'});
  const upWR=bySide.UP.w+bySide.UP.l>0?bySide.UP.w/(bySide.UP.w+bySide.UP.l):0;
  const downWR=bySide.DOWN.w+bySide.DOWN.l>0?bySide.DOWN.w/(bySide.DOWN.w+bySide.DOWN.l):0;
  if(Math.abs(upWR-downWR)>0.15)insights.push({icon:'&#128269;',text:upWR>downWR?'UP trades outperforming DOWN by '+(((upWR-downWR)*100).toFixed(0))+'%. Consider filtering to UP only.':'DOWN trades outperforming UP by '+(((downWR-upWR)*100).toFixed(0))+'%. Consider filtering to DOWN only.'});
  if(!insights.length)insights.push({icon:'&#128200;',text:'Not enough data for insights yet. Need at least 10 settled trades to generate recommendations.'});
  document.getElementById('a-insights').innerHTML=insights.map(i=>'<div class="insight-row"><span class="insight-icon">'+i.icon+'</span><span>'+i.text+'</span></div>').join('');
}

// ── EXPORT ────────────────────────────────────────────────────────────────────
async function exportTrades(){
  const r=await fetch('/export');
  const blob=await r.blob();
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='copytrader_trades.json';a.click();
  URL.revokeObjectURL(url);
}

connect();
</script>
</body>
</html>"""


@app.get("/", response_class=HTMLResponse)
async def dashboard():
    return DASHBOARD

# ── TRADING FUNCTIONS ──────────────────────────────────────────────────────────
_session = requests.Session()
_session.headers.update({"Connection": "keep-alive"})

def get_recent_trades(wallet, since_ts=None, limit=5):
    params = {
        "user": wallet, "type": "TRADE", "side": "BUY",
        "limit": limit, "sortBy": "TIMESTAMP", "sortDirection": "DESC",
    }
    if since_ts:
        params["start"] = int(since_ts)
    try:
        r = _session.get(f"{HOST_DATA}/activity", params=params, timeout=5)
        r.raise_for_status()
        data = r.json()
        if not isinstance(data, list):
            log(f"Unexpected API response type: {type(data)} -- {str(data)[:200]}", "WARN")
            return []
        return [t for t in data if float(t.get("usdcSize", 0)) >= COPY_MIN_USD]
    except Exception as e:
        log(f"Data API error: {e}", "WARN")
        return []

def get_live_price(token_id, side="BUY"):
    try:
        r = _session.get(f"{HOST_CLOB}/price",
                         params={"token_id": token_id, "side": side}, timeout=5)
        r.raise_for_status()
        return float(r.json().get("price", 0))
    except Exception:
        return None

def get_usdc_balance(address):
    USDCE = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
    try:
        from eth_abi import encode
        data = "0x70a08231" + encode(["address"], [address]).hex()
        for rpc in ["https://polygon.drpc.org", "https://polygon.meowrpc.com"]:
            try:
                r   = requests.post(rpc, json={"jsonrpc":"2.0","method":"eth_call",
                                    "params":[{"to":USDCE,"data":data},"latest"],"id":1}, timeout=5)
                res = r.json()
                if "result" in res and res["result"] not in (None, "0x", "0x0"):
                    return round(int(res["result"], 16) / 1_000_000, 2)
            except Exception:
                continue
    except Exception:
        pass
    return None

def place_order(clob_client, token_id, price, size_usdc):
    if DRY_RUN:
        log(f"[DRY RUN] Would buy {token_id[:16]}... ${size_usdc:.2f} @ {price:.4f}", "TRADE")
        return {"success": True, "orderID": "DRY_RUN"}
    try:
        from py_clob_client.clob_types import MarketOrderArgs, OrderType
        from py_clob_client.order_builder.constants import BUY
        for attempt, try_price in enumerate([price, price + 0.05, price + 0.10]):
            try_price = round(min(try_price, 0.98), 4)
            try:
                mo     = MarketOrderArgs(token_id=token_id, amount=size_usdc, price=try_price, side=BUY)
                signed = clob_client.create_market_order(mo)
                resp   = clob_client.post_order(signed, OrderType.FOK)
                log(f"Order response (attempt {attempt+1}, price={try_price:.4f}): {resp}", "TRADE")
                return resp
            except Exception as e:
                err = str(e)
                if "fully filled" in err or "no orders found" in err or "no liquidity" in err.lower():
                    log(f"No liquidity at {try_price:.4f}, retrying...", "WARN")
                    continue
                raise
        log("Order failed after 3 attempts", "WARN")
        return None
    except Exception as e:
        import traceback
        log(f"Order error: {e}", "WARN")
        log(f"Order traceback: {traceback.format_exc()}", "WARN")
        return None

def redeem_position(condition_id, token_id, side):
    if DRY_RUN:
        log(f"[DRY RUN] Would redeem {condition_id[:16]}...", "SYS")
        return True
    try:
        import time as _time
        from polymarket_apis.clients.web3_client import PolymarketWeb3Client
        from web3 import Web3
        EOA_ADDR    = Web3.to_checksum_address(FUNDER_ADDRESS)
        RPC         = "https://polygon.drpc.org"
        eoa_client  = PolymarketWeb3Client(PRIVATE_KEY, signature_type=0, rpc_url=RPC)
        safe_client = PolymarketWeb3Client(PRIVATE_KEY, signature_type=2, rpc_url=RPC)
        SAFE_ADDR   = safe_client.address

        # ── Step 1: Transfer winning tokens EOA -> Safe ───────────────────────
        eoa_bal  = eoa_client.get_token_balance(token_id)
        safe_bal = eoa_client.get_token_balance(token_id, SAFE_ADDR)
        if eoa_bal > 0:
            log(f"Transferring {eoa_bal:.4f} tokens EOA -> Safe...", "SYS")
            r = eoa_client.transfer_token(token_id, SAFE_ADDR, eoa_bal)
            if r.status != 1:
                log(f"Token transfer FAILED | tx: {r.tx_hash}", "WARN"); return False
            log(f"Transfer confirmed + | tx: {r.tx_hash[:20]}...", "SYS")
            _time.sleep(3)
        elif safe_bal > 0:
            log(f"Tokens already in Safe ({safe_bal:.4f}) -- skipping transfer", "SYS")
        else:
            log("No winning tokens found in EOA or Safe -- already redeemed?", "SYS")
            return True

        # ── Step 2: Redeem from Safe ──────────────────────────────────────────
        log(f"Redeeming from Safe | condition: {condition_id[:16]}...", "SYS")
        r = safe_client.redeem_position(condition_id=condition_id, amounts=[0, 0], neg_risk=False)
        if r.status != 1:
            log(f"Safe redemption FAILED | tx: {r.tx_hash}", "WARN"); return False
        log(f"Redemption confirmed + | tx: {r.tx_hash[:20]}...", "SYS")
        _time.sleep(3)

        # ── Step 3: Sweep USDC.e from Safe -> EOA (your MetaMask wallet) ─────
        safe_usdc = safe_client.get_usdc_balance()
        if safe_usdc > 0:
            log(f"Sweeping ${safe_usdc:.4f} USDC.e Safe -> EOA...", "SYS")
            r = safe_client.transfer_usdc(EOA_ADDR, safe_usdc)
            if r.status == 1:
                log(f"Sweep confirmed + | ${safe_usdc:.4f} USDC.e returned to wallet | tx: {r.tx_hash[:20]}...", "SYS")
            else:
                log(f"Sweep FAILED -- funds stuck in Safe, run withdraw_to_wallet.py manually", "WARN")
        else:
            log("No USDC.e in Safe after redemption -- may still be processing", "WARN")
        return True
    except Exception as e:
        log(f"Redemption error: {e}", "WARN"); return False

# ── BOT LOOP ───────────────────────────────────────────────────────────────────
def bot_loop():
    log("DEUS VULT -- Copy Trader starting", "SYS")
    log(f"Target: {COPY_TARGET}", "SYS")
    direction_str = f"Direction: {COPY_SIDE}-only | " if COPY_SIDE else ""
    log(f"Min: ${COPY_MIN_USD:.0f} | Max bet: ${COPY_MAX_BET:.0f} | Slippage: {COPY_SLIPPAGE*100:.0f}% | {direction_str}Mode: {'DRY RUN' if DRY_RUN else 'LIVE'}", "SYS")
    log(f"Filters: skip={COPY_SKIP_ASSET or 'none'} | min_price={COPY_MIN_PRICE*100:.0f}c | slip<{COPY_SLIPPAGE*100:.0f}% | skip_bet=${COPY_SKIP_BET_MIN:.0f}-${COPY_SKIP_BET_MAX:.0f} | min_age={COPY_MIN_AGE:.0f}s", "SYS")
    log(f"Mode: {'DRY RUN' if DRY_RUN else 'LIVE TRADING'}", "SYS")

    clob_client = None
    if not DRY_RUN:
        try:
            from py_clob_client.client import ClobClient
            clob_client = ClobClient(HOST_CLOB, key=PRIVATE_KEY, chain_id=CHAIN_ID,
                                     signature_type=0, funder=FUNDER_ADDRESS)
            creds = clob_client.create_or_derive_api_creds()
            clob_client.set_api_creds(creds)
            log("CLOB client ready +", "SYS")
        except Exception as e:
            log(f"CLOB init error: {e}", "WARN")

    # Detect MarketOrderArgs param name once at startup (outside CLOB try block)
    global _MO_PARAM
    try:
        from py_clob_client.clob_types import MarketOrderArgs as _TestMO
        from py_clob_client.order_builder.constants import BUY as _BUY
        _TestMO(token_id="test", amount=1.0, price=0.5, side=_BUY)
        _MO_PARAM = "amount"
    except (TypeError, AttributeError):
        _MO_PARAM = "size"
    log(f"MarketOrderArgs param: '{_MO_PARAM}'", "SYS")

    with state_lock:
        state["running"] = True
        state["target"]  = COPY_TARGET

    seen_txs       = set()
    open_positions = {}
    redeem_queue   = {}
    last_settle    = 0
    last_bal_fetch = 0
    last_seen_ts   = int(time.time())

    log("Warming up -- checking API connectivity...", "SYS")
    # Test the API with no filters first to see if the wallet has ANY activity
    try:
        test_r = _session.get(f"{HOST_DATA}/activity",
                              params={"user": COPY_TARGET, "limit": 5, "sortBy": "TIMESTAMP", "sortDirection": "DESC"},
                              timeout=10)
        test_data = test_r.json()
        if not test_data:
            log(f"WARNING: API returned 0 activity for {COPY_TARGET[:20]}... -- wallet may be inactive or address incorrect", "WARN")
            log("Check: is this the proxy wallet address or EOA? Try visiting polymarket.com/@<address> to confirm", "WARN")
        else:
            log(f"API confirmed: {len(test_data)} recent activities found for target wallet", "SYS")
            for t in test_data[:3]:
                log(f"  Sample: {t.get('type','?')} {t.get('side','')} {t.get('title','?')[:35]} ${t.get('usdcSize','?')}", "SYS")
    except Exception as e:
        log(f"API connectivity check failed: {e}", "WARN")

    warmup = get_recent_trades(COPY_TARGET, limit=50)
    for t in warmup:
        seen_txs.add(t.get("transactionHash", ""))
        ts = t.get("timestamp", 0)
        if ts > last_seen_ts:
            last_seen_ts = ts
    log(f"Warm up done -- {len(seen_txs)} BUY trades >=${COPY_MIN_USD:.0f} in ignore list", "SYS")
    log(f"Polling every {COPY_POLL_SECS}s...", "SYS")
    telegram(f"[BOT] Copy trader started\nTarget: <code>{COPY_TARGET[:20]}...</code>\nMin: ${COPY_MIN_USD:.0f} | {'DRY RUN' if DRY_RUN else 'LIVE'}")

    while True:
        try:
            with state_lock:
                if not state["running"]:
                    time.sleep(1); continue

            now = time.time()

            # Balance refresh every 30s
            if now - last_bal_fetch >= 30:
                bal = get_usdc_balance(FUNDER_ADDRESS)
                if bal is not None:
                    with state_lock:
                        state["balance"] = bal
                last_bal_fetch = now

            # Poll for new trades since last seen timestamp
            trades = get_recent_trades(COPY_TARGET, since_ts=last_seen_ts - 5, limit=10)

            for trade in trades:
                tx_hash  = trade.get("transactionHash", "")
                trade_ts = int(trade.get("timestamp", 0))
                if not tx_hash or tx_hash in seen_txs:
                    continue

                seen_txs.add(tx_hash)
                if trade_ts > last_seen_ts:
                    last_seen_ts = trade_ts

                usd_size  = float(trade.get("usdcSize", 0))
                token_id  = trade.get("asset", "")
                price     = float(trade.get("price", 0))
                side      = "UP" if trade.get("outcomeIndex", 0) == 0 else "DOWN"
                title     = trade.get("title", "Unknown market")
                slug      = trade.get("slug", "")
                condition = trade.get("conditionId", "")
                outcome   = trade.get("outcome", "")
                age_secs  = now - trade_ts

                log(f"NEW | {title[:40]} | {outcome} | ${usd_size:.0f} @ {price:.3f} | age:{age_secs:.0f}s", "INFO")

                if age_secs > 120:
                    log(f"Too old ({age_secs:.0f}s) -- skip", "WARN")
                    with state_lock: state["total_skipped"] += 1
                    continue

                if age_secs < COPY_MIN_AGE:
                    log(f"Too fresh ({age_secs:.0f}s < {COPY_MIN_AGE:.0f}s) -- skip", "INFO")
                    with state_lock: state["total_skipped"] += 1
                    continue

                # Filter 1: skip Ethereum (consistently losing asset across all sessions)
                if COPY_SKIP_ASSET and title.startswith(COPY_SKIP_ASSET):
                    log(f"Asset {COPY_SKIP_ASSET} -- skip", "INFO")
                    with state_lock: state["total_skipped"] += 1
                    continue

                # Filter 2 (new): skip their $35-45 dead zone bets (consistently negative EV)
                if COPY_SKIP_BET_MIN < COPY_SKIP_BET_MAX and COPY_SKIP_BET_MIN <= usd_size < COPY_SKIP_BET_MAX:
                    log(f"Bet ${usd_size:.0f} in dead zone ${COPY_SKIP_BET_MIN:.0f}-${COPY_SKIP_BET_MAX:.0f} -- skip", "INFO")
                    with state_lock: state["total_skipped"] += 1
                    continue

                # Filter 3: skip markets that expire more than 2 hours from now
                market_expiry = None
                ts_match = __import__('re').search(r'-(\d{10})$', slug)
                if ts_match:
                    window_start = int(ts_match.group(1))
                    if '-5m-' in slug:   market_expiry = window_start + 300
                    elif '-15m-' in slug: market_expiry = window_start + 900
                    else:                 market_expiry = window_start + 3600
                else:
                    # Hourly named market — expiry is 1hr after the named hour
                    import re as _re
                    hm = _re.search(r'(\d{1,2})(?::(\d{2}))?([AP]M)\s*ET', title, _re.IGNORECASE)
                    if hm:
                        h = int(hm.group(1)); m = int(hm.group(2) or 0)
                        if hm.group(3).upper() == 'PM' and h != 12: h += 12
                        if hm.group(3).upper() == 'AM' and h == 12: h = 0
                        from datetime import datetime, timezone
                        today = datetime.now(timezone.utc).date()
                        et_offset = 4 * 3600  # EDT = UTC-4
                        market_expiry = int(datetime(today.year, today.month, today.day,
                                           tzinfo=timezone.utc).timestamp()) + h * 3600 + m * 60 + et_offset + 3600
                if market_expiry is not None:
                    secs_to_expiry = market_expiry - now
                    if secs_to_expiry > 7200:
                        log(f"Market expires in {secs_to_expiry//3600:.0f}h {(secs_to_expiry%3600)//60:.0f}m -- >2h, skip", "INFO")
                        with state_lock: state["total_skipped"] += 1
                        continue

                # Skip if target's entry price >= 90c (low value, near certainty)
                if price >= 0.90:
                    log(f"Price {price*100:.1f}c >= 90c -- skip", "INFO")
                    with state_lock: state["total_skipped"] += 1
                    continue

                live_price = get_live_price(token_id)
                if live_price is None:
                    log("No live price -- skip", "WARN")
                    with state_lock: state["total_skipped"] += 1
                    continue

                # Also check live price is under 90c (may have moved since target bought)
                if live_price >= 0.90:
                    log(f"Live price {live_price*100:.1f}c >= 90c -- skip", "INFO")
                    with state_lock: state["total_skipped"] += 1
                    continue

                # Filter 4 (new): skip entry price below 30c (6.2% WR, almost always loses)
                if live_price < COPY_MIN_PRICE:
                    log(f"Live price {live_price*100:.1f}c < {COPY_MIN_PRICE*100:.0f}c min -- skip", "INFO")
                    with state_lock: state["total_skipped"] += 1
                    continue

                slippage = abs(live_price - price) / max(price, 0.001)
                if slippage > COPY_SLIPPAGE:
                    log(f"Slippage {slippage*100:.1f}% > {COPY_SLIPPAGE*100:.0f}% -- skip", "WARN")
                    with state_lock: state["total_skipped"] += 1
                    continue

                bet = 1.00  # fixed $1 per trade

                log(f"*** COPYING *** {title[:35]} | {outcome} | their:${usd_size:.0f} our:${bet:.2f} @ {live_price:.3f}", "COPY")

                placed = False
                if DRY_RUN:
                    log(f"[DRY RUN] Buy ${bet:.2f} {outcome} @ {live_price:.3f}", "TRADE")
                    placed = True
                elif clob_client:
                    resp = place_order(clob_client, token_id, live_price, bet)
                    if resp and (resp.get("success") or resp.get("status") not in ("failed", None)):
                        log(f"Order placed + | {resp.get('orderID','')[:20]}...", "TRADE")
                        placed = True
                    else:
                        log(f"Order failed: {resp}", "WARN")

                if placed:
                    complement = None
                    try:
                        mkt = _session.get(f"{HOST_CLOB}/markets/{condition}", timeout=6).json()
                        for t in mkt.get("tokens", []):
                            if str(t.get("token_id")) != str(token_id):
                                complement = str(t.get("token_id"))
                    except Exception:
                        pass

                    ts_str = datetime.now().strftime("%H:%M:%S")
                    pos = {
                        "title": title, "slug": slug, "condition_id": condition,
                        "token_id": token_id,
                        "up_token":   token_id  if side=="UP"   else complement,
                        "down_token": token_id  if side=="DOWN" else complement,
                        "side": side, "outcome": outcome,
                        "cost": bet, "entry_price": live_price,
                        "shares": bet / live_price, "placed_at": now, "time": ts_str,
                    }
                    open_positions[tx_hash] = pos

                    trade_record = {
                        # ── Identity ──────────────────────────────────────────
                        "id":               tx_hash[:16],
                        "tx_hash":          tx_hash,
                        "date":             datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                        "time":             ts_str,
                        "timestamp_utc":    datetime.now(timezone.utc).isoformat(),
                        # ── Market info ───────────────────────────────────────
                        "title":            title,
                        "slug":             slug,
                        "outcome":          outcome,
                        "side":             side,
                        "condition_id":     condition,
                        "token_id":         token_id,
                        # ── Original signal (target trader) ───────────────────
                        "signal": {
                            "wallet":           COPY_TARGET,
                            "their_bet_usd":    usd_size,
                            "their_price":      price,
                            "their_tx":         tx_hash,
                            "trade_timestamp":  trade_ts,
                            "age_when_copied_s":round(age_secs, 1),
                        },
                        # ── Our execution ─────────────────────────────────────
                        "execution": {
                            "our_bet_usd":      bet,
                            "entry_price":      live_price,
                            "shares":           round(bet / live_price, 4),
                            "slippage":         round(slippage, 4),
                            "slippage_pct":     round(slippage * 100, 2),
                            "price_vs_target":  round(live_price - price, 4),
                            "dry_run":          DRY_RUN,
                        },
                        # ── Result (filled on settlement) ─────────────────────
                        "status":           "open",
                        "result":           None,
                        "pnl":              None,
                        "payout":           None,
                        "settled_at":       None,
                        # ── Flat copies for table/charts (convenience) ────────
                        "their_bet":        usd_size,
                        "our_bet":          bet,
                        "entry_price":      live_price,
                        "target_price":     price,
                        "slippage":         round(slippage, 4),
                        "shares":           round(bet / live_price, 4),
                        "age_at_copy":      round(age_secs, 1),
                    }
                    with state_lock:
                        state["total_copied"] += 1
                        state["last_trade"] = {
                            "title": title, "outcome": outcome,
                            "their_bet": usd_size, "our_bet": bet,
                            "price": live_price, "slippage": slippage, "time": ts_str,
                        }
                        state["trade_history"].insert(0, trade_record)
                        if len(state["trade_history"]) > 500:
                            state["trade_history"].pop()
                        state["open_positions"] = [
                            {k: v for k, v in p.items()
                             if k in ("title","outcome","side","cost","entry_price","shares","time")}
                            for p in open_positions.values()
                        ]
                    # store record ref on position for settlement update
                    pos["trade_record_id"] = tx_hash[:16]

                    # Place limit sell (take profit) at 0.98 immediately after entry
                    if not DRY_RUN and clob_client:
                        try:
                            from py_clob_client.clob_types import LimitOrderArgs, OrderType
                            from py_clob_client.order_builder.constants import SELL
                            TP_PRICE = 0.98
                            tp_args = LimitOrderArgs(
                                token_id  = token_id,
                                price     = TP_PRICE,
                                size      = pos["shares"],
                                side      = SELL,
                                expiration= 0,
                            )
                            tp_signed = clob_client.create_order(tp_args)
                            tp_resp   = clob_client.post_order(tp_signed, OrderType.GTC)
                            log(f"TP order placed @ 0.98 | {pos['shares']:.4f} shares | resp: {tp_resp}", "TRADE")
                            pos["tp_order_id"] = tp_resp.get("orderID", "") if tp_resp else ""
                        except Exception as e:
                            log(f"TP order error: {e}", "WARN")
                    elif DRY_RUN:
                        log(f"[DRY RUN] Would place limit sell @ 0.98 for {pos['shares']:.4f} shares", "TRADE")

                    telegram(f"[COPY] <b>{title[:50]}</b>\n{outcome} | Their: ${usd_size:.0f} | Ours: <b>${bet:.2f}</b> @ {live_price:.3f}")

            # Settlement check every 60s
            if open_positions and now - last_settle >= 60:
                settled = []
                for tx_h, pos in open_positions.items():
                    try:
                        up_p   = get_live_price(pos["up_token"])   if pos.get("up_token")   else None
                        down_p = get_live_price(pos["down_token"]) if pos.get("down_token") else None

                        up_won   = False
                        down_won = False

                        # Primary: CLOB price hit $1
                        if up_p is not None and up_p >= 0.95:
                            up_won = True
                        if down_p is not None and down_p >= 0.95:
                            down_won = True

                        # Fallback: CLOB returns None once market closes — query Gamma API
                        if not up_won and not down_won and pos.get("condition_id"):
                            try:
                                import json as _json
                                gr = _session.get(
                                    f"https://gamma-api.polymarket.com/markets?conditionId={pos['condition_id']}",
                                    timeout=6
                                )
                                gdata = gr.json()
                                if gdata and isinstance(gdata, list):
                                    mkt = gdata[0]
                                    if mkt.get("resolved") or mkt.get("closed"):
                                        res_idx = mkt.get("resolutionIndex")
                                        if res_idx == 0:
                                            up_won = True
                                        elif res_idx == 1:
                                            down_won = True
                                        else:
                                            prices = mkt.get("outcomePrices", [])
                                            if isinstance(prices, str):
                                                prices = _json.loads(prices)
                                            prices = [float(p) for p in prices] if prices else []
                                            if prices and max(prices) >= 0.99:
                                                winner = prices.index(max(prices))
                                                outcomes = mkt.get("outcomes", ["Up","Down"])
                                                if isinstance(outcomes, str):
                                                    outcomes = _json.loads(outcomes)
                                                won_outcome = str(outcomes[winner]).lower() if winner < len(outcomes) else ""
                                                if "up" in won_outcome:   up_won   = True
                                                elif "down" in won_outcome: down_won = True
                                        if up_won or down_won:
                                            log(f"Gamma resolved: {'UP' if up_won else 'DOWN'} | {pos['title'][:35]}", "INFO")
                            except Exception as ge:
                                log(f"Gamma resolution check error: {ge}", "WARN")

                        if not up_won and not down_won: continue
                        our_won = (pos["side"]=="UP" and up_won) or (pos["side"]=="DOWN" and down_won)
                        payout  = pos["shares"] if our_won else 0.0
                        pnl     = round(payout - pos["cost"], 2)
                        tag     = "WIN" if our_won else "LOSS"
                        log(f"Settled {pos['title'][:35]} | {tag} | pnl:{'+' if pnl>=0 else ''}${pnl:.2f}", tag)
                        telegram(f"[{tag}] {pos['title'][:45]}\nPnL: {'+' if pnl>=0 else ''}${pnl:.2f}")
                        with state_lock:
                            if our_won: state["wins"]   += 1
                            else:       state["losses"] += 1
                            state["pnl"] = round(state["pnl"] + pnl, 2)
                            # Update trade record with result
                            rec_id = pos.get("trade_record_id")
                            if rec_id:
                                for rec in state["trade_history"]:
                                    if rec.get("id") == rec_id:
                                        rec["status"]     = "settled"
                                        rec["result"]     = "win" if our_won else "loss"
                                        rec["pnl"]        = pnl
                                        rec["payout"]     = round(payout, 4)
                                        rec["settled_at"] = datetime.now(timezone.utc).isoformat()
                                        # also update flat keys
                                        if rec.get("execution"):
                                            rec["execution"]["result"] = "win" if our_won else "loss"
                                            rec["execution"]["pnl"]    = pnl
                                            rec["execution"]["payout"] = round(payout, 4)
                                        break
                        if our_won and pos.get("condition_id") and pos.get("token_id"):
                            # Queue redemption with a 3-minute delay to allow oracle resolution on-chain
                            # Attempting too early causes "result for condition not received yet"
                            redeem_queue[pos["condition_id"]] = {
                                "retry_at": now + 180, "token_id": pos["token_id"], "side": pos["side"]
                            }
                            log(f"Queued redemption in 3 min | {pos['condition_id'][:16]}...", "SYS")
                        settled.append(tx_h)
                    except Exception as e:
                        log(f"Settlement error: {e}", "WARN")

                for h in settled:
                    del open_positions[h]
                with state_lock:
                    state["open_positions"] = [
                        {k: v for k, v in p.items()
                         if k in ("title","outcome","side","cost","entry_price","shares","time")}
                        for p in open_positions.values()
                    ]

                for cid in [c for c, v in list(redeem_queue.items()) if now >= v["retry_at"]]:
                    ok = redeem_position(cid, redeem_queue[cid]["token_id"], redeem_queue[cid]["side"])
                    if ok:
                        del redeem_queue[cid]
                    else:
                        redeem_queue[cid]["retry_at"] = now + 300  # retry every 5 min
                        log(f"Redemption retry scheduled in 5 min | {cid[:16]}...", "WARN")

                last_settle = now

            try:
                broadcast_queue.put_nowait({"type": "state", "data": get_public_state()})
            except Exception:
                pass

        except KeyboardInterrupt:
            log("Stopped", "SYS"); break
        except Exception as e:
            log(f"Loop error: {e}", "WARN")

        time.sleep(COPY_POLL_SECS)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="warning")
