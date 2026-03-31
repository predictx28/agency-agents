// v042049
import React, { useState, useRef, useCallback, useEffect, useMemo, createContext, useContext } from "react";

// ─── Error Boundary — catches crashes and shows reload button ─────────────────
class AppErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("App crash:", error, info); }
  render() {
    if (this.state.hasError) return (
      <div style={{position:"fixed",inset:0,background:"#0A1628",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,fontFamily:"'Inter',sans-serif"}}>
        <div style={{fontSize:48,marginBottom:16}}>⚠️</div>
        <div style={{color:"#FFFFFF",fontSize:18,fontWeight:700,marginBottom:8}}>Something went wrong</div>
        <div style={{color:"rgba(255,255,255,0.3)",fontSize:12,marginBottom:8,textAlign:"center",maxWidth:320,wordBreak:"break-all"}}>{this.state.error?.message}</div>
        <div style={{color:"rgba(255,255,255,0.15)",fontSize:10,marginBottom:24,textAlign:"center",maxWidth:320,wordBreak:"break-all",fontFamily:"monospace"}}>{this.state.error?.stack?.split('\n').slice(0,3).join(' | ')}</div>
        <button onClick={()=>{this.setState({hasError:false,error:null});window.location.reload();}} style={{background:"#3B82F6",border:"none",borderRadius:14,color:"#fff",fontSize:14,fontWeight:700,padding:"12px 32px",cursor:"pointer"}}>Reload App</button>
      </div>
    );
    return this.props.children;
  }
}

// Supabase sync — no-op stub (wire up supabase.js separately when ready)
function useSupabaseSyncSafe() {
  return {
    session: true, user: null, loading: false, synced: false,
    syncBalance:()=>{}, syncBet:()=>{}, syncResolvedMarket:()=>{},
    syncPropAccount:()=>{}, syncToggleWatchlist:()=>{}, syncProfile:()=>{},
    syncPushNotif:()=>{}, syncMarkNotifsRead:()=>{}, syncPayoutRequest:()=>{},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// THEME SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
const ThemeContext = createContext(null);
const useTheme = () => useContext(ThemeContext);

const PredictionsContext = createContext([]);
const usePredictions = () => useContext(PredictionsContext);

const DARK_THEME = {
  isDark: true,
  bg:        "#0A1628",
  bgCard:    "#0D1F3C",
  bgInput:   "#152540",
  bgSubtle:  "#060D1A",
  bgSheet:   "#0D1F3C",
  bgOverlay: "#0A1628",
  bgHover:   "rgba(59,130,246,0.06)",
  border:    "#1E3A5F",
  borderSub: "rgba(255,255,255,0.06)",
  borderMed: "#1E3A5F",
  text:      "#FFFFFF",
  textSub:   "rgba(255,255,255,0.6)",
  textMuted: "rgba(255,255,255,0.4)",
  textFaint: "rgba(255,255,255,0.2)",
  navBg:     "#070F1E",
  navBorder: "#1E3A5F",
  navActive: "#3B82F6",
  navInactive:"rgba(255,255,255,0.35)",
  handleBar: "rgba(255,255,255,0.12)",
  skeletonBg:"#152540",
  toggleOff:  "#1E3A5F",
};

const LIGHT_THEME = {
  isDark: false,
  // Backgrounds
  bg:        "#f0f4f8",
  bgCard:    "#ffffff",
  bgInput:   "rgba(0,0,0,0.04)",
  bgSubtle:  "#f5f8fc",
  bgSheet:   "#ffffff",
  bgOverlay: "#f0f4f8",
  bgHover:   "rgba(0,0,0,0.04)",
  // Borders
  border:    "#e2e8f0",
  borderSub: "rgba(0,0,0,0.06)",
  borderMed: "#cbd5e1",
  // Text
  text:      "#0f172a",
  textSub:   "rgba(15,23,42,0.55)",
  textMuted: "rgba(15,23,42,0.38)",
  textFaint: "rgba(15,23,42,0.2)",
  // Nav
  navBg:     "#ffffff",
  navBorder: "#e2e8f0",
  navActive: "#3B82F6",
  navInactive:"#94a3b8",
  // Sheet drag handle
  handleBar: "rgba(0,0,0,0.12)",
  // Misc
  skeletonBg:"#e2e8f0",
  toggleOff:  "#d1d5db",
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & DATA
// ─────────────────────────────────────────────────────────────────────────────
const PREDICTIONS = [
  { id:1, title:"Will Bitcoin hit $150k by Dec 2025?", category:"CRYPTO", yesPct:72, pool:"$4.8M", poolRaw:4800000, bettors:"185.2K", daysLeft:"312d", trend:"+200.0%", trendDir:"up", hot:true, likes:"287K", comments:"142K", shares:"98.5K", creator:{name:"CryptoOracle",handle:"cryptooracle",verified:true,avatar:"🔮",color:"#F4C430"}, img:"https://picsum.photos/seed/bitcoin/800/600", accent:"#F4C430", chartData:[3,5,8,6,9,11,8,7,9,10,8,6,7,8,9], allTimeHigh:"11%",allTimeLow:"2%",avgVol:"5.4%",volatility:"6.0pts" },
  { id:2, title:"Will Argentina win the 2026 World Cup? 🏆", category:"SPORTS", yesPct:57, pool:"$3.2M", poolRaw:3200000, bettors:"48.3K", daysLeft:"187d", trend:"+42.0%", trendDir:"up", hot:true, likes:"24.1K", comments:"8.3K", shares:"3.1K", creator:{name:"SportsPulse",handle:"sportspulse",verified:true,avatar:"⚽",color:"#7c4dcc"}, img:"https://picsum.photos/seed/soccer/800/600", accent:"#7c4dcc", chartData:[4,5,7,6,8,9,8,7,9,8,7,8,9,10,9], allTimeHigh:"10%",allTimeLow:"3%",avgVol:"6.2%",volatility:"4.8pts" },
  { id:3, title:"Will Elon Musk run for president in 2028? 🇺🇸", category:"POLITICS", yesPct:8, pool:"$5.1M", poolRaw:5100000, bettors:"71.8K", daysLeft:"920d", trend:"-15.0%", trendDir:"down", hot:false, likes:"112K", comments:"45.8K", shares:"22.1K", creator:{name:"PoliticsPulse",handle:"politicspulse",verified:true,avatar:"🏛",color:"#f93d3d"}, img:"https://picsum.photos/seed/politics/800/600", accent:"#f93d3d", chartData:[12,10,9,8,7,9,8,7,6,5,6,7,6,5,8], allTimeHigh:"18%",allTimeLow:"5%",avgVol:"9.3%",volatility:"8.1pts" },
  { id:4, title:"Will the US confirm alien existence before 2027? 👽", category:"CONSPIRACY", yesPct:31, pool:"$3.2M", poolRaw:3200000, bettors:"42.1K", daysLeft:"652d", trend:"+88.0%", trendDir:"up", hot:true, likes:"42.1K", comments:"15.9K", shares:"11.2K", creator:{name:"PoliticsPulse",handle:"politicspulse",verified:true,avatar:"🏛",color:"#7c4dcc"}, img:"https://picsum.photos/seed/space/800/600", accent:"#7c4dcc", chartData:[2,3,4,3,5,6,5,7,8,7,9,10,9,11,12], allTimeHigh:"12%",allTimeLow:"1%",avgVol:"5.8%",volatility:"9.5pts" },
  { id:5, title:"Will OpenAI release GPT-5 before July 2025? 🤖", category:"TECH", yesPct:73, pool:"$6.2M", poolRaw:6200000, bettors:"310.1K", daysLeft:"128d", trend:"+55.0%", trendDir:"up", hot:true, likes:"421K", comments:"198K", shares:"156K", creator:{name:"TechInsider",handle:"techinsider",verified:true,avatar:"🤖",color:"#00c9a7"}, img:"https://picsum.photos/seed/aitech/800/600", accent:"#00c9a7", chartData:[2,4,6,9,11,8,10,13,11,12,10,9,11,12,13], allTimeHigh:"13%",allTimeLow:"2%",avgVol:"8.1%",volatility:"9.2pts" },
  { id:6, title:"Will the Fed cut rates 3+ times in 2025?", category:"FINANCE", yesPct:51, pool:"$2.1M", poolRaw:2100000, bettors:"92.4K", daysLeft:"280d", trend:"+12.0%", trendDir:"up", hot:false, likes:"104K", comments:"67K", shares:"41K", creator:{name:"MarketWatch",handle:"marketwatch",verified:false,avatar:"📈",color:"#3B82F6"}, img:"https://picsum.photos/seed/finance/800/600", accent:"#3B82F6", chartData:[4,5,6,5,7,8,7,6,8,7,6,5,6,7,8], allTimeHigh:"8%",allTimeLow:"1%",avgVol:"4.2%",volatility:"3.5pts" },
  { id:7, title:"Will Taylor Swift announce a new album in 2025?", category:"ENTERTAINMENT", yesPct:64, pool:"$1.9M", poolRaw:1900000, bettors:"221.0K", daysLeft:"200d", trend:"+31.0%", trendDir:"up", hot:true, likes:"512K", comments:"309K", shares:"201K", creator:{name:"PopCulture",handle:"popculture",verified:false,avatar:"🎤",color:"#F4C430"}, img:"https://picsum.photos/seed/concert/800/600", accent:"#F4C430", chartData:[5,6,7,8,9,8,9,10,11,10,12,13,12,14,13], allTimeHigh:"14%",allTimeLow:"4%",avgVol:"9.0%",volatility:"5.2pts" },
  { id:8, title:"Will Solana flip Ethereum in market cap in 2025?", category:"CRYPTO", yesPct:18, pool:"$1.4M", poolRaw:1400000, bettors:"78.3K", daysLeft:"312d", trend:"+340.0%", trendDir:"up", hot:false, likes:"88K", comments:"44K", shares:"29K", creator:{name:"CryptoOracle",handle:"cryptooracle",verified:true,avatar:"🔮",color:"#5c37a6"}, img:"https://picsum.photos/seed/crypto2/800/600", accent:"#5c37a6", chartData:[1,2,1,2,3,2,3,4,3,2,3,4,5,4,3], allTimeHigh:"5%",allTimeLow:"1%",avgVol:"2.8%",volatility:"7.8pts" },
];

// More predictions including resolved ones
const MORE_PREDICTIONS = [
  { id:9,  title:"Will Apple release a foldable iPhone in 2025? 📱", category:"TECH", yesPct:22, pool:"$890K", poolRaw:890000, bettors:"54.1K", daysLeft:"280d", trend:"-5.0%", trendDir:"down", hot:false, likes:"67K", comments:"28K", shares:"14K", creator:{name:"TechInsider",handle:"techinsider",verified:true,avatar:"🤖",color:"#00c9a7"}, img:"https://picsum.photos/seed/iphone/800/600", accent:"#00c9a7", chartData:[3,4,3,4,3,2,3,2,2,3,2,2,3,2,2], allTimeHigh:"8%",allTimeLow:"2%",avgVol:"3.1%",volatility:"2.1pts" },
  { id:10, title:"Will the S&P 500 hit 7,000 before end of 2025?", category:"FINANCE", yesPct:61, pool:"$3.1M", poolRaw:3100000, bettors:"128.4K", daysLeft:"312d", trend:"+28.0%", trendDir:"up", hot:true, likes:"198K", comments:"87K", shares:"55K", creator:{name:"MarketWatch",handle:"marketwatch",verified:false,avatar:"📈",color:"#3B82F6"}, img:"https://picsum.photos/seed/stocks/800/600", accent:"#3B82F6", chartData:[5,6,7,6,8,9,8,9,10,9,11,10,11,12,11], allTimeHigh:"12%",allTimeLow:"4%",avgVol:"7.8%",volatility:"5.0pts" },
  { id:11, title:"Will Kanye West release a new album in 2025? 🎵", category:"ENTERTAINMENT", yesPct:44, pool:"$1.2M", poolRaw:1200000, bettors:"89.2K", daysLeft:"250d", trend:"+15.0%", trendDir:"up", hot:false, likes:"312K", comments:"190K", shares:"88K", creator:{name:"PopCulture",handle:"popculture",verified:false,avatar:"🎤",color:"#F4C430"}, img:"https://picsum.photos/seed/music2/800/600", accent:"#F4C430", chartData:[3,4,5,4,5,6,5,4,5,6,5,4,5,4,5], allTimeHigh:"8%",allTimeLow:"2%",avgVol:"4.5%",volatility:"3.8pts" },
  { id:12, title:"Will Ethereum hit $10k by 2026? Ξ", category:"CRYPTO", yesPct:39, pool:"$2.7M", poolRaw:2700000, bettors:"102.3K", daysLeft:"380d", trend:"+62.0%", trendDir:"up", hot:true, likes:"155K", comments:"72K", shares:"41K", creator:{name:"CryptoOracle",handle:"cryptooracle",verified:true,avatar:"🔮",color:"#4e3f9e"}, img:"https://picsum.photos/seed/ethereum/800/600", accent:"#4e3f9e", chartData:[2,3,4,3,5,4,5,6,5,6,7,6,7,8,7], allTimeHigh:"9%",allTimeLow:"2%",avgVol:"5.5%",volatility:"6.2pts" },
];

const RESOLVED_PREDICTIONS = [
  { id:101, title:"Will Donald Trump win the 2024 US election? 🇺🇸", category:"POLITICS", outcome:"YES", yesPct:68, noYes:32, pool:"$18.4M", poolRaw:18400000, bettors:"1.2M", resolvedDate:"Nov 6, 2024", creator:{name:"PoliticsPulse",handle:"politicspulse",verified:true,avatar:"🏛",color:"#f93d3d"}, img:"https://picsum.photos/seed/election/600/400", accent:"#f93d3d", userBet:null, payout:null },
  { id:102, title:"Will Bitcoin reach $100k before Jan 2025? ₿", category:"CRYPTO", outcome:"YES", yesPct:71, noYes:29, pool:"$9.2M", poolRaw:9200000, bettors:"412K", resolvedDate:"Dec 5, 2024", creator:{name:"CryptoOracle",handle:"cryptooracle",verified:true,avatar:"🔮",color:"#F4C430"}, img:"https://picsum.photos/seed/bitcoin/600/400", accent:"#F4C430", userBet:"YES", payout:14.20 },
  { id:103, title:"Will the Fed cut rates in Dec 2024?", category:"FINANCE", outcome:"NO", yesPct:44, noYes:56, pool:"$4.1M", poolRaw:4100000, bettors:"188K", resolvedDate:"Dec 18, 2024", creator:{name:"MarketWatch",handle:"marketwatch",verified:false,avatar:"📈",color:"#3B82F6"}, img:"https://picsum.photos/seed/finance/600/400", accent:"#3B82F6", userBet:"NO", payout:8.40 },
];

const ALL_PREDICTIONS = [...PREDICTIONS, ...MORE_PREDICTIONS];

// ─────────────────────────────────────────────────────────────────────────────
// POLYMARKET API INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────
const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_WS   = "wss://ws-subscriptions-clob.polymarket.com/ws/";

const CATEGORY_MAP = {
  // Crypto
  crypto:              "CRYPTO",
  cryptocurrency:      "CRYPTO",
  bitcoin:             "CRYPTO",
  ethereum:            "CRYPTO",
  defi:                "CRYPTO",
  nft:                 "CRYPTO",
  web3:                "CRYPTO",
  // Politics
  politics:            "POLITICS",
  "us-politics":       "POLITICS",
  "global-politics":   "POLITICS",
  elections:           "POLITICS",
  election:            "POLITICS",
  government:          "POLITICS",
  news:                "POLITICS",
  world:               "POLITICS",
  geopolitics:         "POLITICS",
  // Sports
  sports:              "SPORTS",
  soccer:              "SPORTS",
  football:            "SPORTS",
  basketball:          "SPORTS",
  tennis:              "SPORTS",
  baseball:            "SPORTS",
  mma:                 "SPORTS",
  golf:                "SPORTS",
  nfl:                 "SPORTS",
  nba:                 "SPORTS",
  nhl:                 "SPORTS",
  mlb:                 "SPORTS",
  esports:             "SPORTS",
  // Tech
  science:             "TECH",
  technology:          "TECH",
  tech:                "TECH",
  ai:                  "TECH",
  "artificial-intelligence": "TECH",
  space:               "TECH",
  // Finance
  finance:             "FINANCE",
  economics:           "FINANCE",
  stocks:              "FINANCE",
  "business-finance":  "FINANCE",
  economy:             "FINANCE",
  // Entertainment
  entertainment:       "ENTERTAINMENT",
  culture:             "ENTERTAINMENT",
  music:               "ENTERTAINMENT",
  film:                "ENTERTAINMENT",
  tv:                  "ENTERTAINMENT",
  celebrity:           "ENTERTAINMENT",
  awards:              "ENTERTAINMENT",
  // Other
  climate:             "TECH",
  health:              "FINANCE",
  science:             "TECH",
};

// Category detection based purely on title — tags are always empty from Polymarket
function categoryFromTitle(title) {
  const t = (title || "").toLowerCase();

  // SPORTS — check FIRST because team matchups like "X vs. Y" are most common
  // Covers: NBA, NHL, NFL, MLB, soccer, tennis, golf, MMA, cricket, rugby
  if (
    // Direct team matchup pattern "Team vs. Team" or "Team vs Team"
    /\bvs\.?\s/.test(t) ||
    // Spread / over-under betting lines
    /\bspread\b|\bo\/u\b|\bover\/under\b/.test(t) ||
    // League names
    /premier league|champions league|la liga|bundesliga|serie a|ligue 1|europa league|conference league/.test(t) ||
    /\bnfl\b|\bnba\b|\bnhl\b|\bmlb\b|\bnba\b|\bufc\b|\bmma\b|\bnascar\b|\bpga\b|\batp\b|\bwta\b/.test(t) ||
    /\bf1\b|formula 1|formula one|motogp|indycar/.test(t) ||
    // Tournaments & events
    /super bowl|world series|stanley cup|march madness|wimbledon|\bus open\b|french open|australian open|the masters|world cup|euro 2|copa america|\bafcon\b|\brugby world cup\b|\bipl\b|\bnrl\b|\bafl\b|grand slam|grand prix|tour de france|ryder cup/.test(t) ||
    /\bolympic|\bfifa\b|\buefa\b|\bcricket\b|\brugby\b|\bboxing\b|\bwrestling\b|\bwwe\b/.test(t) ||
    // Win/qualify questions about sports teams
    /will .+ win the .+(league|cup|championship|series|title|trophy|open|gp|grand prix|bowl)/i.test(t) ||
    /will .+ qualify for|will .+ be relegated|will .+ make the playoffs/.test(t) ||
    // Player names commonly on Polymarket
    /lebron|stephen curry|luka|giannis|jokic|mahomes|lamar jackson|josh allen|patrick mahomes|messi|ronaldo|mbappe|haaland|neymar|djokovic|alcaraz|sinner|scheffler|mcilroy/.test(t)
  ) return "SPORTS";

  // CRYPTO — very specific terms
  if (
    /bitcoin|\bbtc\b|ethereum|\beth\b|\bsol\b|solana|\bxrp\b|ripple|\bdoge\b|dogecoin|\bbnb\b|\bada\b|cardano|\bavax\b|avalanche|\bmatic\b|polygon|\barb\b|arbitrum|chainlink|\blink\b|uniswap|coinbase|binance|kraken|crypto|blockchain|defi|\bnft\b|web3|altcoin|stablecoin|\busdc\b|\busdt\b|tether|staking|halving|memecoin|\bpepe\b|\bshib\b/.test(t)
  ) return "CRYPTO";

  // FINANCE — specific financial instruments, not generic "rate" or "market"
  if (
    /\bfed\b|federal reserve|\bfomc\b|interest rate|rate hike|rate cut|\bbps\b|basis point/.test(t) ||
    /crude oil|\bwti\b|\bbrent\b|\bcl\b commodity|oil price|natural gas|\bopec\b/.test(t) ||
    /\bs&p\b|s&p 500|\bspx\b|nasdaq|dow jones|\bnikkei\b|\bftse\b|\bdax\b|\bcac\b/.test(t) ||
    /gold price|silver price|\bxau\b|\bxag\b|treasury yield|bond yield/.test(t) ||
    /\bcpi\b|\bgdp\b|inflation rate|unemployment rate|\bpce\b|recession/.test(t) ||
    /warren buffett|berkshire|blackrock|jpmorgan|goldman sachs/.test(t) ||
    /earnings report|quarterly results|revenue miss|\bipo\b stock/.test(t)
  ) return "FINANCE";

  // TECH
  if (
    /\bai\b|\bgpt\b|\bllm\b|\bagi\b|openai|anthropic|deepmind|gemini|chatgpt|copilot/.test(t) ||
    /nvidia|\bamd\b chip|\bintel\b chip|semiconductor|microchip|chip ban/.test(t) ||
    /spacex|\bnasa\b|starship|starlink|\bblue origin\b/.test(t) ||
    /\biphone\b|\bipad\b|apple watch|vision pro|macbook|\bios \d/.test(t) ||
    /cybersecurity|data breach|\bhack\b|ransomware|quantum computing/.test(t) ||
    /self.driving|autonomous vehicle|\bev\b sales|electric vehicle|tesla model/.test(t)
  ) return "TECH";

  // ENTERTAINMENT
  if (
    /\boscar\b|academy award|\bgrammy\b|\bemmy\b|golden globe|\bbafta\b/.test(t) ||
    /box office|movie gross|film release|\bnetflix\b|\bhbo\b|disney\+|\bspotify\b/.test(t) ||
    /\balbum\b|\btour\b.*concert|\bbillboard\b|music chart/.test(t) ||
    /taylor swift|beyonce|kanye|\bdrake\b music|rihanna|lady gaga|bad bunny|\bvma\b/.test(t)
  ) return "ENTERTAINMENT";

  // POLITICS — last before fallback
  if (
    /\belection\b|\bvote\b|\bvoting\b|\bballot\b|\bpoll\b/.test(t) ||
    /\bpresident\b|\bsenator\b|\bcongress\b|\bparliament\b|prime minister|chancellor/.test(t) ||
    /approval rating|democrat|republican|\blabour\b|conservative party/.test(t) ||
    /\btrump\b|\bbiden\b|\bharris\b|\bmacron\b|\bputin\b|\bzelensky\b|\bstarmer\b/.test(t) ||
    /geopolit|\bsanction\b|\btariff\b|\bnato\b|\bimpeach\b|\blegislat/.test(t) ||
    /\bwar\b|\bceasefire\b|\bstrike\b.*iran|iran.*strike|\binvade\b|\bregime\b/.test(t) ||
    /will .+ win the .+(election|nomination|primary|seat|vote)/i.test(t) ||
    /will .+ become .+(president|prime minister|chancellor)/i.test(t)
  ) return "POLITICS";

  return "POLITICS";
}

const CATEGORY_ACCENT = {
  CRYPTO:        "#F4C430",
  POLITICS:      "#f93d3d",
  SPORTS:        "#7c4dcc",
  TECH:          "#00c9a7",
  FINANCE:       "#3B82F6",
  ENTERTAINMENT: "#F4C430",
  CONSPIRACY:    "#00E5FF",
};

function mapPolymarketMarket(m, idx) {
  // Parse outcome prices — Polymarket returns "[\"0.72\",\"0.28\"]" as a string
  let yesPct = 50;
  try {
    const prices = JSON.parse(m.outcomePrices || "[]");
    yesPct = Math.round(parseFloat(prices[0] || 0.5) * 100);
  } catch (_) {}

  // Pool size
  const poolRaw = parseFloat(m.volume || m.volumeNum || 0);
  const pool = poolRaw >= 1e6
    ? "$" + (poolRaw / 1e6).toFixed(1) + "M"
    : poolRaw >= 1e3
    ? "$" + (poolRaw / 1e3).toFixed(0) + "K"
    : "$" + poolRaw.toFixed(0);

  // Days left
  let daysLeft = "—";
  if (m.endDate) {
    const diff = Math.max(0, Math.round((new Date(m.endDate) - Date.now()) / 86400000));
    daysLeft = diff + "d";
  }

  // Category — title keywords take priority since Polymarket tags are unreliable
  const titleCat = categoryFromTitle(m.question || m.title);
  const tagSlugs = (m.tags || []).map(t => (t.slug || t.label || "").toLowerCase());
  const mappedTag = tagSlugs.map(s => CATEGORY_MAP[s]).find(Boolean);
  // Only use tag if title scan returned generic POLITICS fallback
  const category = titleCat !== "POLITICS" ? titleCat : (mappedTag || "POLITICS");

  // Bettors
  const bettorsRaw = parseInt(m.uniqueTraders || m.numTraders || 0);
  const bettors = bettorsRaw >= 1e6
    ? (bettorsRaw/1e6).toFixed(1)+"M"
    : bettorsRaw >= 1e3
    ? (bettorsRaw/1e3).toFixed(1)+"K"
    : String(bettorsRaw);

  // Chart data — generate synthetic sparkline from price history if unavailable
  const chartData = Array.from({length:15},(_,i) =>
    Math.max(1, Math.min(99, yesPct + (Math.random()-0.5)*8))
  ).map(Math.round);

  // Image — use direct URL (S3 allows cross-origin reads, proxy was causing failures)
  const rawImg = m.image || m.icon || m.eventImage || m.event?.image || null;
  const img = rawImg || null; // null = show SVG gradient fallback

  return {
    id:          m.id || `pm_${idx}`,
    polyId:      m.id,
    conditionId: m.conditionId,
    clobTokenIds: (() => { try { const c = m.clobTokenIds; if (Array.isArray(c)) return c; if (typeof c === 'string') return JSON.parse(c); return []; } catch { return []; } })(),
    title:       m.question || m.title || "Untitled market",
    category,
    yesPct,
    pool,
    poolRaw,
    bettors,
    daysLeft,
    trend:       "+0.0%",
    trendDir:    "up",
    hot:         poolRaw > 500000,
    likes:       bettors,
    comments:    "—",
    shares:      "—",
    creator: {
      name:     "Polymarket",
      handle:   "polymarket",
      verified: true,
      avatar:   "🔮",
      color:    CATEGORY_ACCENT[category] || "#3B82F6",
    },
    img,
    accent:      CATEGORY_ACCENT[category] || "#3B82F6",
    chartData,
    allTimeHigh: yesPct+5+"%",
    allTimeLow:  Math.max(1,yesPct-10)+"%",
    avgVol:      "—",
    volatility:  "—",
    endDate:     m.endDate,
  };
}

// Hook: fetch live markets via Claude API (proxy for sandbox CORS restrictions)
// The artifact sandbox blocks direct external fetches, so we ask Claude to
// fetch Polymarket data and return it as structured JSON.
function usePolymarketMarkets() {
  const [markets, setMarkets]   = useState(null);
  const [error,   setError]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [prices,  setPrices]    = useState({}); // polyId -> yesPct live price
  const lockedRef           = React.useRef({}); // polyId -> { yesPct, winner } locked at resolution
  const resolvedOutcomesRef = React.useRef({}); // marketId -> { winner } from server

  // Full market fetch every 15s (new windows open every 5min)
  useEffect(() => {
    let cancelled = false;
    async function fetchMarkets() {
      try {
        setLoading(true);
        const res = await fetch('/api/markets?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const now = Date.now();
        // Handle both old array format and new {markets, resolutions} format
        const raw = Array.isArray(data) ? data : (data.markets || []);
        // Store official resolutions from server
        if (data.resolutions && !Array.isArray(data)) {
          Object.assign(resolvedOutcomesRef.current, data.resolutions);
        }
        const mapped = raw
          .filter(m => (m.question || m.title) || m.is5min)
          .filter(m => !m.endDate || new Date(m.endDate) > (m.is5min ? now - 300000 : now))
          .filter(m => m.active !== false && m.closed !== true)
          .map(m => m.is5min ? {
            ...m,
            trend: "+0.0%", trendDir: "up", likes: "0", comments: "—", shares: "—",
            allTimeHigh: m.yesPct+5+"%", allTimeLow: Math.max(1,m.yesPct-10)+"%",
            avgVol: "—", volatility: "—",
            chartData: Array.from({length:15},()=>Math.round(45+Math.random()*10)),
            creator: { name:"Polymarket", handle:"polymarket", verified:true, avatar:"◈", color: m.accent||"#F7931A" },
          } : mapPolymarketMarket(m));
        setMarkets(mapped);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Price polling — two tracks:
  // Track 1: Browser → Gamma API every 2s (live prices, fast)
  // Track 2: Browser → /api/prices every 15s (resolution detection, server-side)
  const marketsRef = React.useRef(markets);
  useEffect(() => { marketsRef.current = markets; }, [markets]);

  useEffect(() => {
    let cancelled = false;

    async function pollPrices() {
      const mks = marketsRef.current;
      if (!mks) return;
      const fiveMin = mks.filter(m => m.is5min && m.polyId);
      if (!fiveMin.length) return;
      try {
        // Pass both polyIds (for resolution) and token_ids (for live CLOB price)
        const ids = fiveMin.map(m => m.polyId).join(',');
        const tokenIds = fiveMin
          .map(m => (Array.isArray(m.clobTokenIds) ? m.clobTokenIds[0] : null))
          .filter(Boolean)
          .join(',');
        const url = `/api/prices?ids=${ids}${tokenIds ? '&token_ids='+tokenIds : ''}&t=${Date.now()}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const data = await res.json();

        const locked = lockedRef.current;
        const newPrices = {};

        fiveMin.forEach(m => {
          // Already resolved — keep locked final price (100 or 0)
          if (locked[m.polyId]) {
            newPrices[m.polyId] = locked[m.polyId].yesPct;
            return;
          }

          const info = data[m.polyId];

          // Official resolution — lock permanently
          if (info?.winner) {
            const finalPct = info.winner === 'YES' ? 100 : 0;
            locked[m.polyId] = { yesPct: finalPct, winner: info.winner };
            newPrices[m.polyId] = finalPct;
            return;
          }

          // Live price — use CLOB midpoint (fresher) or Gamma outcomePrices
          const tokenId = Array.isArray(m.clobTokenIds) ? m.clobTokenIds[0] : null;
          const clobInfo = tokenId ? data[`token_${tokenId}`] : null;
          const rawPrice = clobInfo?.yesPct ?? info?.yesPct;
          if (rawPrice != null) newPrices[m.polyId] = rawPrice;
        });
        if (Object.keys(newPrices).length > 0 && !cancelled) {
          setPrices(prev => ({ ...prev, ...newPrices }));
        }
      } catch(e) {}
    }

    pollPrices();
    const id = setInterval(pollPrices, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, []); // empty deps — runs once, uses ref for latest markets

  // Merge live prices — prices state already has correct values (reset-ignored)
  const marketsWithPrices = useMemo(() => {
    if (!markets) return null;
    return markets.map(m => {
      if (!m.is5min) return m;
      const liveYesPct = prices[m.polyId];
      if (liveYesPct == null) return m;
      return { ...m, yesPct: liveYesPct, noPct: 100 - liveYesPct };
    });
  }, [markets, prices]);

  return { markets: marketsWithPrices, error, loading, lockedRef, resolvedOutcomesRef };
}

// Hook: subscribe to live price updates via Polymarket WebSocket
function usePolymarketPrices(tokenIds, onPriceUpdate) {
  useEffect(() => {
    if (!tokenIds || tokenIds.length === 0) return;
    let ws;
    let reconnectTimer;

    function connect() {
      try {
        ws = new WebSocket(CLOB_WS);

        ws.onopen = () => {
          // Subscribe to market channel for each token
          ws.send(JSON.stringify({
            auth: {},
            markets: tokenIds.map(id => ({ condition_id: id })),
            type: "Market",
          }));
        };

        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            // Polymarket sends price updates as array of {asset_id, price}
            if (Array.isArray(msg)) {
              msg.forEach(update => {
                if (update.asset_id && update.price !== undefined) {
                  const yesPct = Math.round(parseFloat(update.price) * 100);
                  onPriceUpdate(update.asset_id, yesPct);
                }
              });
            }
          } catch (_) {}
        };

        ws.onerror = () => {};
        ws.onclose = () => {
          // Reconnect after 5s
          reconnectTimer = setTimeout(connect, 5000);
        };
      } catch (_) {}
    }

    connect();
    return () => {
      if (ws) ws.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [tokenIds?.join(",")]);
}

const DAILY_CHALLENGE = {
  pred: PREDICTIONS[0],
  bonus: 3.00,
  streak: 4,
  endsIn: "08:42:11",
};

const SORT_OPTIONS = [
  { id:"hot",      label:"Hottest" },
  { id:"pool",     label:"Biggest Pool" },
  { id:"closing",  label:"Closing Soon", red:true },
  { id:"newest",   label:"Newest" },
  { id:"volatile", label:"Most Volatile" },
];

const AD_CARDS = [
  { id:"ad1", sponsor:"PredictSwipe", tagline:"PROP FIRM CHALLENGE", headline:"Trade With Firm Capital", sub:"Pass the challenge. Keep 80% of profits.", cta:"Start Challenge →", bg:"#0a1000", accent:"#F4C430", icon:"🏦", isPropFirm:true },
];

const CATEGORY_META = {
  ALL:    { icon:"⚡", color:"#FFFFFF" },
  CRYPTO: { icon:"₿",  color:"#F4C430" },
  SPORTS: { icon:"🌐", color:"#7c4dcc" },
  POLITICS:{ icon:"🏛",color:"#f93d3d" },
  CONSPIRACY:{ icon:"👁",color:"#7c4dcc" },
  TECH:   { icon:"⚙️",  color:"#00c9a7" },
  FINANCE:{ icon:"💹", color:"#3B82F6" },
  ENTERTAINMENT:{ icon:"🎬",color:"#F4C430" },
};

const INITIAL_COMMENTS = {
  1: [
    { id:1, user:"moon_chad", avatar:"🌙", text:"$150k is conservative. We're going to $200k easy.", likes:142, ts:"2h ago", betId:"BET-1-M0ON42", thesis:"Bitcoin halving cycle historically produces 4-6x gains from pre-halving prices. We were at $69k pre-halving. Simple math: $280k target.", replies:[] },
    { id:2, user:"beargang", avatar:"🐻", text:"Cope. BTC hasn't broken ATH in months.", likes:38, ts:"3h ago", betId:null, thesis:null, replies:[
      { id:21, user:"moon_chad", avatar:"🌙", text:"@beargang Check the on-chain metrics. Exchange reserves at 5-year low. Accumulation happening silently.", likes:88, ts:"2h ago", replies:[] }
    ]},
    { id:3, user:"satoshi_x", avatar:"⚡", text:"On-chain metrics looking extremely bullish rn. Accumulation phase complete.", likes:219, ts:"4h ago", betId:"BET-1-SATP99", thesis:"UTXO age bands showing long-term holders haven't moved coins in 12+ months. Supply shock incoming.", replies:[] },
    { id:4, user:"hodlgang", avatar:"💎", text:"Bought more at $85k. Thank me later.", likes:88, ts:"5h ago", betId:null, thesis:null, replies:[] },
  ],
  2: [
    { id:1, user:"goat_hunter", avatar:"🐐", text:"Messi will carry them again no doubt.", likes:201, ts:"1h ago", betId:null, thesis:null, replies:[] },
    { id:2, user:"brazil_fan99", avatar:"🇧🇷", text:"Brazil will take it. Watch.", likes:77, ts:"2h ago", betId:null, thesis:null, replies:[
      { id:22, user:"goat_hunter", avatar:"🐐", text:"@brazil_fan99 Brazil hasn't won since 2002. Argentina have the squad depth.", likes:44, ts:"1h ago", replies:[] }
    ]},
  ],
  3: [
    { id:1, user:"truth_seeker", avatar:"👁", text:"They've been hiding this for decades. It's already confirmed.", likes:312, ts:"6h ago", betId:null, thesis:null, replies:[] },
    { id:2, user:"skeptic99", avatar:"🤔", text:"Source: trust me bro", likes:188, ts:"7h ago", betId:null, thesis:null, replies:[] },
  ],
};

// Extra comments for more predictions
Object.assign(INITIAL_COMMENTS, {
  5: [
    { id:1, user:"ai_watcher", avatar:"🤖", text:"GPT-5 benchmarks already leaked internally. It's coming Q1.", likes:441, ts:"30m ago", betId:"BET-5-AIW001", thesis:"Insider source at OpenAI confirmed pre-release testing started. Model card already written. Q1 is locked in.", replies:[
      { id:11, user:"skeptic_dev", avatar:"💻", text:"@ai_watcher Every quarter for 2 years: 'it's coming this quarter'", likes:89, ts:"25m ago", replies:[] }
    ]},
    { id:2, user:"skeptic_dev", avatar:"💻", text:"They said the same about GPT-4.5. I'll believe it when I see it.", likes:112, ts:"1h ago", betId:null, thesis:null, replies:[] },
    { id:3, user:"techbro99", avatar:"🚀", text:"Sam Altman literally teased it on X last week lol", likes:289, ts:"2h ago", betId:null, thesis:null, replies:[] },
  ],
  7: [
    { id:1, user:"swiftie4ever", avatar:"🩷", text:"She literally hinted at a new era in her last Insta. 100% YES.", likes:822, ts:"10m ago", betId:"BET-7-SW4EVR", thesis:"Instagram post had 13 hidden easter eggs referencing new album titles. Confirmed by Taylor Nation account.", replies:[
      { id:12, user:"musiccritic", avatar:"🎵", text:"@swiftie4ever Easter eggs are a stretch but the production team rumours are credible", likes:44, ts:"8m ago", replies:[] }
    ]},
    { id:2, user:"musiccritic", avatar:"🎵", text:"She just finished an 18-month world tour. Give the woman a break.", likes:201, ts:"45m ago", betId:null, thesis:null, replies:[] },
  ],
  2: [
    { id:1, user:"goat_hunter", avatar:"🐐", text:"Messi will carry them again no doubt.", likes:201, ts:"1h ago", betId:null, thesis:null, replies:[] },
    { id:2, user:"brazil_fan99", avatar:"🇧🇷", text:"Brazil will take it. Watch.", likes:77, ts:"2h ago", betId:null, thesis:null, replies:[
      { id:23, user:"footy_stats", avatar:"⚽", text:"@brazil_fan99 Argentina's squad depth is a real concern post-Messi era though.", likes:134, ts:"1h ago", replies:[] }
    ]},
  ],
});

const CREATOR_PROFILES = {
  cryptooracle: { name:"CryptoOracle", handle:"cryptooracle", verified:true, avatar:"🔮", color:"#F4C430", bio:"On-chain analyst. 6 years trading crypto. I call the pumps before they happen 👀", followers:"48.2K", following:"312", predictions:24, accuracy:"71%", totalVolume:"$28.4M", joined:"Jan 2023" },
  sportspulse:  { name:"SportsPulse",  handle:"sportspulse",  verified:true, avatar:"⚽", color:"#7c4dcc", bio:"Professional sports data analyst. Premier League, NFL, NBA covered. Stats don't lie.", followers:"31.4K", following:"201", predictions:41, accuracy:"68%", totalVolume:"$14.2M", joined:"Mar 2023" },
  politicspulse:{ name:"PoliticsPulse",handle:"politicspulse",verified:true, avatar:"🏛", color:"#f93d3d", bio:"Political forecasting. Former pollster. I've called 8/10 major elections since 2020.", followers:"62.1K", following:"88",  predictions:19, accuracy:"74%", totalVolume:"$31.8M", joined:"Aug 2022" },
  techinsider:  { name:"TechInsider",  handle:"techinsider",  verified:true, avatar:"🤖", color:"#00c9a7", bio:"Tech journalist. FAANG insider contacts. I cover AI, hardware, and product launches.", followers:"27.9K", following:"155", predictions:31, accuracy:"65%", totalVolume:"$18.1M", joined:"Jun 2023" },
  marketwatch:  { name:"MarketWatch",  handle:"marketwatch",  verified:false, avatar:"📈", color:"#3B82F6", bio:"Finance nerd. Macro trading, Fed watching, rates obsessed. DM for alpha.", followers:"19.3K", following:"290", predictions:28, accuracy:"61%", totalVolume:"$9.7M",  joined:"Nov 2023" },
  popculture:   { name:"PopCulture",   handle:"popculture",   verified:false, avatar:"🎤", color:"#F4C430", bio:"Entertainment industry insider. Music, movies, awards. First to break the real news.", followers:"44.7K", following:"512", predictions:22, accuracy:"58%", totalVolume:"$7.2M",  joined:"Feb 2024" },
};

const NOTIFICATIONS = [
  { id:1, type:"win",    icon:"🏆", title:"You won!", body:"Your YES bet on BTC $150k paid out $14.20", time:"2m ago",  unread:true  },
  { id:2, type:"follow", icon:"👤", title:"New follower", body:"@satoshi_x started following you", time:"14m ago", unread:true  },
  { id:3, type:"odds",   icon:"📈", title:"Odds shifted", body:"BTC $150k YES moved from 68% → 72%", time:"1h ago",  unread:true  },
  { id:4, type:"resolve",icon:"✅", title:"Prediction resolved", body:"Fed rate cut: NO resolved correctly", time:"3h ago",  unread:false },
  { id:5, type:"follow", icon:"👤", title:"New follower", body:"@degenmode started following you", time:"5h ago",  unread:false },
  { id:6, type:"comment",icon:"💬", title:"New comment", body:"@cryptooracle replied to your bet", time:"6h ago",  unread:false },
  { id:7, type:"odds",   icon:"📉", title:"Odds shifted", body:"Alien existence YES dropped 31% → 28%", time:"1d ago",  unread:false },
  { id:8, type:"win",    icon:"🏆", title:"You won!", body:"Your NO bet on Elon president paid out $8.40", time:"2d ago",  unread:false },
];

const TRANSACTIONS = [
  { id:1, type:"CREDIT",  icon:"🎁", note:"Welcome bonus",           amount:+10.00, date:"Today" },
  { id:2, type:"PAYOUT",  icon:"🏆", note:"Won: Fed rate cut NO",     amount:+8.40,  date:"Today" },
  { id:3, type:"DEBIT",   icon:"🎯", note:"Bet YES: BTC $150k",       amount:-1.00,  date:"Today" },
  { id:4, type:"DEBIT",   icon:"🎯", note:"Bet YES: Argentina WC",    amount:-1.00,  date:"Yesterday" },
  { id:5, type:"PAYOUT",  icon:"🏆", note:"Won: Messi retires NO",    amount:+6.20,  date:"Yesterday" },
  { id:6, type:"DEPOSIT", icon:"💳", note:"Deposit via card",         amount:+25.00, date:"Feb 20" },
  { id:7, type:"DEBIT",   icon:"🎯", note:"Bet NO: Elon president",   amount:-1.00,  date:"Feb 19" },
  { id:8, type:"RAKE",    icon:"🏠", note:"House rake (resolved)",     amount:-0.25,  date:"Feb 18" },
];

const LEADERBOARD = [
  { rank:1, user:"satoshi_x",     profit:4820, wins:31, total:38, badge:"🥇", color:"#F4C430" },
  { rank:2, user:"alpha_trader",  profit:3210, wins:27, total:35, badge:"🥈", color:"rgba(255,255,255,0.62)" },
  { rank:3, user:"degenmode",     profit:2990, wins:22, total:30, badge:"🥉", color:"#C97A28" },
  { rank:4, user:"mr_prediction", profit:1870, wins:19, total:28, badge:"4",  color:"rgba(255,255,255,0.32)" },
  { rank:5, user:"yolo_labs",     profit:1240, wins:15, total:24, badge:"5",  color:"rgba(255,255,255,0.32)" },
  { rank:6, user:"deus_vult",     profit:980,  wins:13, total:21, badge:"6",  color:"#3B82F6", isMe:true },
  { rank:7, user:"moonboy99",     profit:760,  wins:11, total:19, badge:"7",  color:"rgba(255,255,255,0.32)" },
  { rank:8, user:"beargang",      profit:640,  wins:10, total:18, badge:"8",  color:"rgba(255,255,255,0.32)" },
];

// ─────────────────────────────────────────────────────────────────────────────
// TINY UTILS
// ─────────────────────────────────────────────────────────────────────────────
const fmtPool = n => n>=1e6?"$"+((n/1e6).toFixed(1))+"M":"$"+((n/1e3).toFixed(0))+"K";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// PRED IMAGE — inline SVG, zero network requests
// ─────────────────────────────────────────────────────────────────────────────
const PRED_VISUALS = {
  CRYPTO:        { bg1:"#0E1A2E", bg2:"#0A1628", accent:"#F4C430", icon:"₿" },
  FINANCE:       { bg1:"#0A1A2E", bg2:"#07101E", accent:"#3B82F6", icon:"$" },
  POLITICS:      { bg1:"#1A0E1A", bg2:"#0E080E", accent:"#EF4444", icon:"⚖" },
  TECH:          { bg1:"#0A1A2E", bg2:"#07101E", accent:"#38BDF8", icon:"⬡" },
  ENTERTAINMENT: { bg1:"#1A0E2A", bg2:"#0E081A", accent:"#A78BFA", icon:"★" },
  SPORTS:        { bg1:"#0E102A", bg2:"#08091E", accent:"#7C3AED", icon:"◉" },
  CONSPIRACY:    { bg1:"#0A1A14", bg2:"#06100E", accent:"#10B981", icon:"◈" },
  ALL:           { bg1:"#0D1F3C", bg2:"#0A1628", accent:"rgba(59,130,246,0.6)", icon:"◎" },
};

function PredImage({ pred, style={} }) {
  const cat = pred?.category || "ALL";
  const v = PRED_VISUALS[cat] || PRED_VISUALS.ALL;
  const accent = pred?.accent || v.accent;
  const id = pred?.id || 0;
  const uid = "p"+(id)+(cat.slice(0,2));
  const [imgFailed, setImgFailed] = useState(false);

  // Use real image if available and not already failed
  const hasRealImg = !imgFailed && pred?.img && pred.img.startsWith("http");

  // Deterministic positions from id
  const cx1 = 20 + (id * 37) % 50;
  const cy1 = 10 + (id * 53) % 50;
  const cx2 = 40 + (id * 71) % 50;
  const cy2 = 30 + (id * 43) % 50;
  const r1  = 30 + (id * 17) % 30;
  const r2  = 20 + (id * 23) % 25;

  return (
    <div style={{
      overflow:"hidden",
      background:v.bg1,
      flexShrink:0,
      position:"relative",
      ...style,
    }}>
      {hasRealImg ? (
        // SwiftUI-style: category gradient bg + deeply blurred oversized image behind
        // + sharp rounded image card floating in the upper-center
        <>
          {/* Layer 1: deep blurred background — fills card, heavily darkened */}
          <img
            src={pred.img}
            alt=""
            aria-hidden="true"
            style={{
              position:"absolute",inset:"-20%",width:"140%",height:"140%",
              objectFit:"cover",objectPosition:"center",
              filter:"blur(40px) brightness(0.28) saturate(1.8)",
            }}
          />
          {/* Layer 2: subtle category colour tint over blur */}
          <div style={{
            position:"absolute",inset:0,
            background:"radial-gradient(ellipse at 50% 30%, "+accent+"28 0%, transparent 70%)",
          }}/>
          {/* Layer 3: the actual image as a floating rounded card, upper-center */}
          <div style={{
            position:"absolute",
            top:"12%",left:"50%",transform:"translateX(-50%)",
            width:"52%",aspectRatio:"1/1",
            borderRadius:28,
            overflow:"hidden",
            boxShadow:"0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)",
          }}>
            <img
              src={pred.img}
              alt={pred.title}
              onError={()=>setImgFailed(true)}
              style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center",display:"block"}}
            />
          </div>
        </>
      ) : (
        // SVG gradient fallback
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="100%" height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
          style={{position:"absolute",inset:0,width:"100%",height:"100%"}}
        >
          <defs>
            <radialGradient id={"g1"+uid} cx={cx1+"%"} cy={cy1+"%"} r="55%">
              <stop offset="0%" stopColor={accent} stopOpacity="0.35"/>
              <stop offset="100%" stopColor={v.bg1} stopOpacity="0"/>
            </radialGradient>
            <radialGradient id={"g2"+uid} cx={cx2+"%"} cy={cy2+"%"} r="45%">
              <stop offset="0%" stopColor={accent} stopOpacity="0.15"/>
              <stop offset="100%" stopColor={v.bg2} stopOpacity="0"/>
            </radialGradient>
          </defs>
          <rect width="100" height="100" fill={v.bg1}/>
          <rect width="100" height="100" fill={v.bg2} opacity="0.6"/>
          <rect width="100" height="100" fill={"url(#g1"+uid+")"}/>
          <rect width="100" height="100" fill={"url(#g2"+uid+")"}/>
          {[20,40,60,80].map(n=>(
            <g key={n}>
              <line x1="0" y1={n} x2="100" y2={n} stroke={accent} strokeOpacity="0.06" strokeWidth="0.5"/>
              <line x1={n} y1="0" x2={n} y2="100" stroke={accent} strokeOpacity="0.06" strokeWidth="0.5"/>
            </g>
          ))}
          <circle cx={cx1} cy={cy1} r={r1} fill="none" stroke={accent} strokeOpacity="0.15" strokeWidth="0.8"/>
          <circle cx={cx1} cy={cy1} r={r1*0.6} fill="none" stroke={accent} strokeOpacity="0.1" strokeWidth="0.5"/>
          <circle cx={cx2} cy={cy2} r={r2} fill="none" stroke={accent} strokeOpacity="0.1" strokeWidth="0.6"/>
          <text x="50" y="50" textAnchor="middle" dominantBaseline="middle"
            fontSize="28" fill={accent} opacity="0.18" fontFamily="system-ui, sans-serif">{v.icon}</text>
          <text x="50" y="78" textAnchor="middle" dominantBaseline="middle"
            fontSize="7" fill={accent} opacity="0.25" fontFamily="system-ui, sans-serif"
            fontWeight="700" letterSpacing="2">{cat}</text>
        </svg>
      )}
    </div>
  );
}

function Sparkline({ data, color, width=40, height=14 }) {
  const safe = Array.isArray(data) && data.length > 0 ? data : [50,50];
  const min=Math.min(...safe), max=Math.max(...safe), range=max-min||1;
  const pts=safe.map((v,i)=>((i/(safe.length-1))*width)+","+(height-((v-min)/range)*height)).join(" ");
  return (
    <svg width={width} height={height} style={{overflow:"visible",display:"block",flexShrink:0}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}

function FullChart({ data, color, isLive=false }) {
  const safe = Array.isArray(data) && data.length > 1 ? data : [50,50];
  const min=Math.min(...safe), max=Math.max(...safe), range=max-min||1;
  const W=300, H=110;
  const pts=safe.map((v,i)=>[(i/(safe.length-1))*W, H-((v-min)/range)*H]);
  const pathD=pts.map((p,i)=>(i===0?"M":"L")+(p[0].toFixed(1))+","+(p[1].toFixed(1))).join(" ");
  const areaD=(pathD+" L"+W+","+H+" L0,"+H+" Z");
  const last=pts[pts.length-1], [lx,ly]=last;
  const gidKey = color.replace(/[^a-z0-9]/gi,"");
  const gid="g"+gidKey+"x";
  // X-axis labels: "Start" → "Now" for live, months for mock
  const xLabels = isLive ? ["Start","25%","50%","75%","Now"] : ["Sep","Oct","Nov","Dec","Jan","Feb"];
  return (
    <svg width="100%" viewBox="0 0 300 136" style={{overflow:"visible"}}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      {[0,0.33,0.66,1].map((t,i)=>{
        const y=H-t*H; const val=Math.round(min+t*range);
        return <g key={i}><line x1={0} y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.051)" strokeWidth="1"/><text x={2} y={y-3} fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="Inter">{val}%</text></g>;
      })}
      <path d={areaD} fill={"url(#"+gid+")"}/>
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      {/* Current price dot at end */}
      <circle cx={lx} cy={ly} r="5" fill={color} stroke="#0F2040" strokeWidth="2"/>
      <line x1={lx} y1={0} x2={lx} y2={H} stroke={color} strokeWidth="1" strokeDasharray="4,3" opacity="0.5"/>
      <rect x={Math.min(lx-20, W-42)} y={ly-24} width={42} height={17} rx={5} fill="#1A2D4A"/>
      <text x={Math.min(lx-20, W-42)+21} y={ly-12} fill="#fff" fontSize="9" textAnchor="middle" fontFamily="Inter">{data[data.length-1]}%</text>
      {xLabels.map((m,i)=><text key={i} x={(i/(xLabels.length-1))*W} y={H+20} fill="rgba(255,255,255,0.267)" fontSize="8" textAnchor="middle" fontFamily="Inter">{m}</text>)}
    </svg>
  );
}

// Live countdown for markets ending within 24 hours
function useCountdown(endDateRaw) {
  const [timeStr, setTimeStr] = useState(null);
  useEffect(() => {
    if (!endDateRaw) return;
    const update = () => {
      const diff = new Date(endDateRaw) - Date.now();
      if (diff <= 0) { setTimeStr("Ended"); return; }
      if (diff > 86400000) { setTimeStr(null); return; } // >1 day, don't show timer
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeStr(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => { clearInterval(interval); };
  }, [endDateRaw]);
  return timeStr;
}

function CountdownOrDays({ daysLeft, endDateRaw }) {
  const timer = useCountdown(endDateRaw);
  if (timer) {
    return (
      <span style={{color:"#F4C430",fontSize:10,fontFamily:"'Inter',sans-serif",lineHeight:1,fontWeight:700,letterSpacing:0.3}}>
        ⏱ {timer}
      </span>
    );
  }
  return (
    <span style={{color:"rgba(255,255,255,0.4)",fontSize:10,fontFamily:"'Inter',sans-serif",lineHeight:1}}>
      {daysLeft} Remain
    </span>
  );
}

function YesNoBtn({ label, pct, voted, onClick, size="lg", poolRaw=1000000 }) {
  const isYes=label==="YES", isVoted=voted===label, otherVoted=voted&&!isVoted;
  const h=size==="sm"?44:56;
  const price = Math.max(1, Math.min(99, pct)) / 100;
  const returnPct = Math.round((1 / price - 1) * 0.98 * 100);
  // Polymarket-style: green for YES, red for NO
  const yesGrad = "linear-gradient(135deg,#22C55E 0%,#16A34A 100%)";
  const noGrad  = "linear-gradient(135deg,#EF4444 0%,#DC2626 100%)";
  const yesBg   = isVoted ? yesGrad : "rgba(34,197,94,0.10)";
  const noBg    = isVoted ? noGrad  : "rgba(239,68,68,0.10)";
  const yesBorder = isVoted ? "none" : "1.5px solid rgba(34,197,94,0.4)";
  const noBorder  = isVoted ? "none" : "1.5px solid rgba(239,68,68,0.4)";
  const yesIcon = isVoted ? "✓" : "✓";
  const noIcon  = isVoted ? "✕" : "✕";
  return (
    <button onClick={onClick} disabled={!!voted} style={{
      flex:1, height:h, borderRadius:10,
      border:isYes?yesBorder:noBorder,
      cursor:voted?"default":"pointer",
      background:isYes?yesBg:noBg,
      color:isVoted?"#fff":(isYes?"#22C55E":"#EF4444"),
      fontFamily:"'Inter',sans-serif",
      display:"flex", flexDirection:"row", alignItems:"center", justifyContent:"center", gap:6,
      boxShadow:isVoted?(isYes?"0 4px 16px rgba(34,197,94,0.35)":"0 4px 16px rgba(239,68,68,0.35)"):"none",
      opacity:otherVoted?0.3:1, transition:"all 0.18s ease", padding:"0 12px",
      position:"relative", overflow:"hidden",
    }}>
      <span style={{fontSize:size==="sm"?14:16,fontWeight:700,opacity:0.9}}>{isYes?yesIcon:noIcon}</span>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:0}}>
        <span style={{fontSize:size==="sm"?11:12,fontWeight:700,letterSpacing:0.3,lineHeight:1.2}}>{label}</span>
        <span style={{fontSize:size==="sm"?13:15,fontWeight:900,lineHeight:1.2}}>{pct}%</span>
      </div>
      {/* Bottom fill bar */}
      <div style={{position:"absolute",bottom:0,left:0,height:2,width:pct+"%",
        background:isYes?"rgba(34,197,94,0.7)":"rgba(239,68,68,0.7)",
        borderRadius:"0 2px 0 0",transition:"width 1.2s cubic-bezier(0.4,0,0.2,1)"}}/>
    </button>
  );
}

function Sheet({ children, onClose, title }) {
  const t = useTheme();
  const [vis,setVis]=useState(false);
  useEffect(()=>{ requestAnimationFrame(()=>setVis(true)); },[]);
  const close=()=>{ setVis(false); setTimeout(onClose,300); };
  return (
    <div style={{position:"absolute",inset:0,zIndex:400,display:"flex",flexDirection:"column",justifyContent:"flex-end"}} onClick={close}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(12px)",opacity:vis?1:0,transition:"opacity 0.3s"}}/>
      <div style={{position:"relative",background:"#0D1F3C",borderRadius:"22px 22px 0 0",maxHeight:"92vh",overflowY:"auto",transform:vis?"translateY(0)":"translateY(100%)",transition:"transform 0.38s cubic-bezier(0.22,1,0.36,1)",boxShadow:"0 -8px 50px rgba(0,0,0,0.8), 0 -1px 0 #1E3A5F",border:"1px solid #1E3A5F",borderBottom:"none"}} onClick={e=>e.stopPropagation()}>
        <div style={{position:"sticky",top:0,background:"#0D1F3C",padding:"12px 20px 10px",zIndex:1,borderBottom:"1px solid rgba(30,58,95,0.6)"}}>
          <div style={{width:36,height:4,background:"rgba(59,130,246,0.25)",borderRadius:99,margin:"0 auto 12px"}}/>
          {title && <div style={{color:"#FFFFFF",fontWeight:700,fontSize:16,fontFamily:"'Inter',sans-serif",letterSpacing:0.1}}>{title}</div>}
        </div>
        <div style={{padding:"12px 20px 52px"}}>{children}</div>
      </div>
    </div>
  );
}

function Avatar({ src, emoji, color, size=36 }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:Math.round(size*0.28), flexShrink:0,
      background:"linear-gradient(135deg, "+(color||"#1A2D4A")+"dd, "+(color||"#1A2D4A")+"88)",
      backdropFilter:"blur(12px)",
      border:"1px solid rgba(255,255,255,0.12)",
      boxShadow:"0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size*0.44, position:"relative", overflow:"hidden",
    }}>
      {/* Glass shine */}
      <div style={{position:"absolute",top:0,left:0,right:0,height:"45%",background:"linear-gradient(180deg,rgba(255,255,255,0.12),transparent)",borderRadius:Math.round(size*0.28)+"px "+Math.round(size*0.28)+"px 0 0",pointerEvents:"none"}}/>
      <span style={{position:"relative",zIndex:1}}>{emoji||"👤"}</span>
    </div>
  );
}

function Badge({ children, color="#3B82F6" }) {
  return <span style={{background:color+"15",color,borderRadius:6,padding:"3px 9px",fontSize:10,fontWeight:700,fontFamily:"'Inter',sans-serif",letterSpacing:0.2}}>{children}</span>;
}

function OverlayHeader({ title, onBack, icon, onSearch, onNotifs, notifCount=0 }) {
  const t = useTheme();
  return (
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",flexShrink:0,background:"#070F1E",borderBottom:"1px solid #1E3A5F"}}>
      <button onClick={onBack} style={{width:34,height:34,borderRadius:8,background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.25)",color:"#93C5FD",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {icon && <div style={{display:"flex",alignItems:"center",justifyContent:"center",opacity:0.8}}>{icon}</div>}
      <span style={{flex:1,color:"#FFFFFF",fontWeight:700,fontSize:16,fontFamily:"'Inter',sans-serif",letterSpacing:-0.2}}>{title}</span>
    </div>
  );
}

function SectionLabel({ children }) {
  const t = useTheme();
  return <div style={{color:t.textMuted,fontSize:10,letterSpacing:2,fontFamily:"'Inter',sans-serif",fontWeight:700,marginBottom:10,marginTop:4,textTransform:"uppercase"}}>{children}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// BET MODAL — choose amount + thesis
// ─────────────────────────────────────────────────────────────────────────────
function BetModal({ pred, position, onConfirm, onClose, balance, quickBetPresets=[1,5,10,25], maxBetSetting=100 }) {
  const t = useTheme();
  const [amount, setAmount] = useState(quickBetPresets[0]||1);
  const [thesis, setThesis] = useState("");
  const [step, setStep] = useState("bet"); // "bet" | "confirmed"
  const [betId] = useState(()=>"BET-"+(pred.id)+"-"+(Date.now().toString(36).toUpperCase().slice(-6)));
  const [copied, setCopied] = useState(false);

  const yesPct   = pred.yesPct;
  const noYes    = 100 - yesPct;
  const sidePct  = position==="YES" ? yesPct : noYes;
  // Polymarket model: shares = cost / price, each winning share pays $1
  const sharePrice   = sidePct / 100;                          // e.g. 0.40 for 40%
  const shares       = sharePrice > 0 ? parseFloat((amount / sharePrice).toFixed(4)) : 0;
  const maxPayout    = shares;                                  // $1 per share if win
  const potentialWin = parseFloat((maxPayout - amount).toFixed(2)); // profit if win

  // Effective max: lesser of balance, maxBetSetting
  const effectiveMax = Math.min(balance, maxBetSetting);
  const overBalance = amount > balance;
  const overMax = amount > maxBetSetting;
  const canBet = amount > 0 && !overBalance && !overMax;

  const copyBetId = () => {
    navigator.clipboard?.writeText(betId).catch(()=>{});
    setCopied(true);
    setTimeout(()=>setCopied(false), 2000);
  };

  const handleConfirm = () => {
    if (!canBet) return;
    onConfirm(amount, thesis, shares, sharePrice);
    setStep("confirmed");
  };

  const handleShare = () => {
    const msg = "I just bet "+position+" on \""+pred.title+"\" — "+sidePct+"% odds. Bet ID: "+betId+(thesis?"\n\nMy thesis: "+thesis:"")+" on PredictSwipe";
    navigator.share ? navigator.share({ title:"My PredictSwipe Bet", text:msg }) : navigator.clipboard?.writeText(msg);
  };

  if (step==="confirmed") {
    const shareMsg = "I just bet "+position+" on \""+pred.title+"\" — "+sidePct+"% odds. Bet ID: "+betId+(thesis?"\n\nThesis: "+thesis:"")+"\n\n👉 predictswipe.app/bet/"+betId;
    const shareUrl = "https://predictswipe.app/bet/"+(betId);
    const encodedMsg = encodeURIComponent(shareMsg);
    const encodedUrl = encodeURIComponent(shareUrl);

    const SHARE_CHANNELS = [
      { label:"Discord",   icon:"🎮", color:"#5865F2", action:()=>{ navigator.clipboard?.writeText(shareMsg); } },
      { label:"Telegram",  icon:"✈️", color:"#0088cc", action:()=>window.open("https://t.me/share/url?url="+(encodedUrl)+"&text="+(encodedMsg)) },
      { label:"X / Twitter",icon:"𝕏", color:"#000",   action:()=>window.open("https://twitter.com/intent/tweet?text="+(encodedMsg)) },
      { label:"Facebook",  icon:"👤", color:"#1877F2", action:()=>window.open("https://www.facebook.com/sharer/sharer.php?u="+(encodedUrl)) },
      { label:"iMessage",  icon:"💬", color:"#34C759", action:()=>window.open("sms:?body="+(encodedMsg)) },
      { label:"Messenger", icon:"💙", color:"#0099FF", action:()=>window.open("fb-messenger://share?link="+(encodedUrl)) },
      { label:"Instagram", icon:"📸", color:"#E1306C", action:()=>{ navigator.clipboard?.writeText(shareMsg); } },
      { label:"WhatsApp",  icon:"📱", color:"#25D366", action:()=>window.open("https://wa.me/?text="+(encodedMsg)) },
    ];

    const copyLink = () => {
      navigator.clipboard?.writeText(shareUrl).catch(()=>{});
      setCopied(true);
      setTimeout(()=>setCopied(false), 2500);
    };

    return (
      <Sheet onClose={onClose} title="Position Confirmed">
        {/* BetID — shown first, prominent */}
        <div style={{background:"rgba(20,158,99,0.08)",border:"1px solid rgba(59,130,246,0.25)",borderRadius:14,padding:"14px 16px",marginBottom:16}}>
          <div style={{color:"rgba(255,255,255,0.35)",fontSize:9,fontFamily:"'Inter',sans-serif",letterSpacing:1.5,marginBottom:8}}>POSITION ID</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
            <div style={{color:"#FFFFFF",fontSize:16,fontWeight:900,fontFamily:"'Inter',sans-serif",letterSpacing:1.5}}>{betId}</div>
            <button onClick={copyLink} style={{background:copied?"#3B82F6":"rgba(255,255,255,0.08)",border:"1px solid "+(copied?"#3B82F6":"rgba(255,255,255,0.15)"),borderRadius:99,color:copied?"#fff":"rgba(255,255,255,0.6)",fontSize:11,fontWeight:700,padding:"6px 14px",cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.25s",whiteSpace:"nowrap",flexShrink:0}}>
              {copied?"✓ Copied":"Copy"}
            </button>
          </div>
        </div>

        <div style={{textAlign:"center",paddingBottom:16}}>
          <div style={{width:60,height:60,borderRadius:"50%",background:position==="YES"?"rgba(34,197,94,0.15)":"rgba(249,61,61,0.12)",border:"2px solid "+(position==="YES"?"#22C55E":"#f93d3d"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 10px"}}>
            {position==="YES"?"✅":"❌"}
          </div>
          <div style={{color:"#FFFFFF",fontSize:20,fontWeight:900,fontFamily:"'Inter',sans-serif",marginBottom:3}}>${amount.toFixed(2)} · {position}</div>
          <div style={{color:"rgba(255,255,255,0.32)",fontSize:13,fontFamily:"'Inter',sans-serif",marginBottom:0,lineHeight:1.4}}>{pred.title.slice(0,55)}{pred.title.length>55?"…":""}</div>
        </div>

        {/* Thesis */}
        {thesis && (
          <div style={{background:"rgba(0,229,255,0.06)",border:"1px solid rgba(0,229,255,0.133)",borderRadius:12,padding:"12px 14px",marginBottom:16,textAlign:"left"}}>
            <div style={{color:"#00E5FF",fontSize:9,fontFamily:"'Inter',sans-serif",letterSpacing:1,marginBottom:4}}>YOUR THESIS</div>
            <div style={{color:"rgba(255,255,255,0.72)",fontSize:13,fontFamily:"'Inter',sans-serif",lineHeight:1.5}}>{thesis}</div>
          </div>
        )}

        {/* Share on socials */}
        <div style={{color:"rgba(255,255,255,0.22)",fontSize:9,fontFamily:"'Inter',sans-serif",letterSpacing:1.5,marginBottom:10}}>SHARE YOUR BET</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
          {SHARE_CHANNELS.map(ch=>(
            <button key={ch.label} onClick={ch.action} style={{background:(ch.color)+"18",border:"1px solid "+(ch.color)+"33",borderRadius:14,padding:"10px 4px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,transition:"transform 0.15s"}} onMouseDown={e=>e.currentTarget.style.transform="scale(0.93)"} onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}>
              <span style={{fontSize:20}}>{ch.icon}</span>
              <span style={{color:"rgba(255,255,255,0.42)",fontSize:8,fontFamily:"'Inter',sans-serif",textAlign:"center",lineHeight:1.2}}>{ch.label}</span>
            </button>
          ))}
        </div>

        {/* Copy direct link row */}
        <div style={{display:"flex",alignItems:"center",gap:8,background:"#0F2040",border:"1px solid #1A2D4A",borderRadius:12,padding:"10px 14px",marginBottom:16}}>
          <span style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>predictswipe.app/bet/{betId}</span>
          <button onClick={copyLink} style={{background:copied?"#3B82F6":"#1A2D4A",border:"1px solid "+(copied?"#3B82F6":"#1A2D4A"),borderRadius:8,color:copied?"#000":"#6a8090",fontSize:11,fontWeight:700,padding:"5px 10px",cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.2s",flexShrink:0,whiteSpace:"nowrap"}}>
            {copied?"Copied!":"Copy Link"}
          </button>
        </div>

        <button onClick={onClose} style={{width:"100%",background:"none",border:"1px solid #1A2D4A",borderRadius:12,color:"rgba(255,255,255,0.32)",fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif",padding:"12px",letterSpacing:0.5}}>
          DONE
        </button>
      </Sheet>
    );
  }

  return (
      <Sheet onClose={onClose} title="Take a Position">
        {/* Header: position label + market title */}
        <div style={{textAlign:"center",paddingBottom:16}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:position==="YES"?"rgba(34,197,94,0.12)":"rgba(249,61,61,0.1)",border:"1px solid "+(position==="YES"?"rgba(34,197,94,0.3)":"rgba(249,61,61,0.25)"),borderRadius:99,padding:"6px 18px",marginBottom:12}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:position==="YES"?"#22C55E":"#f93d3d"}}/>
            <span style={{color:position==="YES"?"#22C55E":"#f93d3d",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif",letterSpacing:0.5}}>Your Position: {position}</span>
          </div>
          <div style={{color:"rgba(255,255,255,0.45)",fontSize:13,fontFamily:"'Inter',sans-serif",lineHeight:1.4,maxWidth:280,margin:"0 auto"}}>{pred.title.slice(0,60)}{pred.title.length>60?"…":""}</div>
        </div>

        {/* Quick bet presets */}
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          {quickBetPresets.slice(0,4).map(v=>{
            const capped = Math.min(v, effectiveMax);
            const disabled = capped <= 0 || balance <= 0;
            const isSelected = amount === capped && !disabled;
            return (
              <button key={v} onClick={()=>!disabled&&setAmount(capped)} disabled={disabled} style={{flex:1,height:44,borderRadius:12,border:"1px solid "+(disabled?"rgba(255,255,255,0.06)":isSelected?"rgba(255,255,255,0.6)":"rgba(59,130,246,0.4)"),background:isSelected?"rgba(255,255,255,0.1)":"transparent",color:disabled?"rgba(255,255,255,0.15)":isSelected?"#ffffff":"rgba(59,130,246,0.85)",fontSize:14,fontWeight:700,cursor:disabled?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.15s"}}>
                ${v}
              </button>
            );
          })}
        </div>

        {/* Custom amount input */}
        <div style={{position:"relative",marginBottom:6}}>
          <span style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,0.4)",fontFamily:"'Inter',sans-serif",fontSize:16}}>$</span>
          <input type="number" value={amount} min={0.01} step={0.01}
            onChange={e=>setAmount(parseFloat(e.target.value)||0)}
            style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid "+(overBalance||overMax?"#f93d3d":"rgba(255,255,255,0.1)"),borderRadius:14,padding:"14px 60px 14px 32px",color:"#FFFFFF",fontSize:18,fontFamily:"'Inter',sans-serif",outline:"none"}}/>
          <button onClick={()=>setAmount(effectiveMax)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"rgba(255,255,255,0.08)",border:"none",borderRadius:8,color:"rgba(255,255,255,0.4)",fontSize:11,padding:"4px 8px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>MAX</button>
        </div>
        {overBalance && <div style={{color:"#f93d3d",fontSize:11,fontFamily:"'Inter',sans-serif",marginBottom:8,paddingLeft:4}}>⚠ Exceeds balance (${balance.toFixed(2)})</div>}
        {overMax && !overBalance && <div style={{color:"#F4C430",fontSize:11,fontFamily:"'Inter',sans-serif",marginBottom:8,paddingLeft:4}}>⚠ Over max bet (${maxBetSetting}) — adjust in Settings</div>}

        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16,paddingLeft:4}}>
          <span style={{color:"rgba(255,255,255,0.3)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>Balance: <span style={{color:balance<5?"#f93d3d":"#3B82F6"}}>${balance.toFixed(2)}</span></span>
          <span style={{color:"rgba(255,255,255,0.3)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>Max: ${effectiveMax.toFixed(0)}</span>
        </div>

        {/* Payout breakdown — Polymarket share model */}
        <div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,padding:"14px 16px",marginBottom:16}}>
          {[
            ["Cost",          "$"+Number(amount).toFixed(2),                          "rgba(255,255,255,0.6)"],
            ["Share price",   "$"+sharePrice.toFixed(3)+" ("+sidePct+"% "+position+")", "rgba(255,255,255,0.35)"],
            ["Shares",        shares.toFixed(2)+" shares",                             "rgba(255,255,255,0.5)"],
            ["Win payout",    "$"+maxPayout.toFixed(2)+" (+$"+potentialWin.toFixed(2)+")", "#3B82F6"],
            ["Loss",          "-$"+Number(amount).toFixed(2),                          "#f93d3d"],
          ].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
              <span style={{color:"rgba(255,255,255,0.35)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>{l}</span>
              <span style={{color:c,fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{v}</span>
            </div>
          ))}
        </div>

        {/* Thesis — below odds panel */}
        <div style={{marginBottom:20}}>
          <div style={{color:"rgba(255,255,255,0.25)",fontSize:10,fontFamily:"'Inter',sans-serif",letterSpacing:1.5,marginBottom:8}}>SHARE YOUR REASONING (OPTIONAL)</div>
          <textarea value={thesis} onChange={e=>setThesis(e.target.value)} placeholder="Why are you taking this position? Visible to others on resolution." rows={2}
            style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"12px 14px",color:"#FFFFFF",fontSize:13,fontFamily:"'Inter',sans-serif",resize:"none",outline:"none",lineHeight:1.5}}/>
        </div>

        <button onClick={handleConfirm} disabled={!canBet} style={{
          width:"100%",
          background:!canBet?"rgba(255,255,255,0.06)":position==="YES"?"linear-gradient(135deg,#3B82F6,#1D6ED8)":"linear-gradient(135deg,#f93d3d,#c42b2b)",
          border:"none",borderRadius:12,
          color:!canBet?"rgba(255,255,255,0.2)":"#fff",
          fontSize:15,fontWeight:800,padding:"16px",
          cursor:canBet?"pointer":"not-allowed",
          fontFamily:"'Inter',sans-serif",
          boxShadow:canBet?"0 4px 24px "+(position==="YES"?"rgba(59,130,246,0.5)":"rgba(239,68,68,0.4)"):"none",
          transition:"all 0.2s",letterSpacing:0.3,
        }}>
          {!canBet&&overBalance?"Insufficient Balance":"Confirm Position · "+(position)+" · $"+(Number(amount).toFixed(2))}
        </button>
      </Sheet>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMENTS SHEET
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// COMMENTS SHEET — threaded replies + bet ID lookup
// ─────────────────────────────────────────────────────────────────────────────
function CommentItem({ c, depth=0, likedIds, onLike, onReply }) {
  const [showReplies, setShowReplies] = useState(true);
  const hasReplies = c.replies && c.replies.length > 0;
  return (
    <div style={{marginLeft: depth > 0 ? 36 : 0}}>
      <div style={{display:"flex",gap:10,marginBottom:12,position:"relative"}}>
        {depth > 0 && <div style={{position:"absolute",left:-24,top:0,bottom:-12,width:1,background:"#1A2D4A"}}/>}
        <Avatar emoji={c.avatar||"👤"} color={depth>0?"#1A2D4A":"#1A2D4A"} size={depth>0?28:34}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
            <span style={{color:c.isMe?"#3B82F6":"#fff",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>@{c.user}</span>
            {c.isMe && <span style={{color:"#3B82F6",fontSize:9,fontFamily:"'Inter',sans-serif",border:"1px solid rgba(59,130,246,0.267)",borderRadius:99,padding:"1px 6px"}}>YOU</span>}
            {c.betId && <span style={{color:"#00E5FF",fontSize:9,fontFamily:"'Inter',sans-serif",background:"rgba(0,229,255,0.08)",border:"1px solid rgba(0,229,255,0.133)",borderRadius:99,padding:"1px 6px"}}>🎯 {c.betId}</span>}
            <span style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>{c.ts}</span>
          </div>
          {c.thesis && (
            <div style={{background:"rgba(0,229,255,0.05)",border:"1px solid rgba(0,229,255,0.094)",borderRadius:8,padding:"6px 10px",marginBottom:6}}>
              <div style={{color:"#00E5FF",fontSize:8,fontFamily:"'Inter',sans-serif",letterSpacing:1,marginBottom:2}}>THESIS</div>
              <p style={{color:"rgba(255,255,255,0.62)",fontSize:12,lineHeight:1.4,fontFamily:"'Inter',sans-serif",margin:0}}>{c.thesis}</p>
            </div>
          )}
          <p style={{color:"rgba(255,255,255,0.72)",fontSize:14,lineHeight:1.4,fontFamily:"'Inter',sans-serif",marginBottom:8,wordBreak:"break-word"}}>{c.text}</p>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <button onClick={()=>onLike(c.id)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:4,padding:0}}>
              <span style={{fontSize:16}}>{likedIds.includes(c.id)?"❤️":"🤍"}</span>
              <span style={{color:"rgba(255,255,255,0.3)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>{(c.likes||0)+(likedIds.includes(c.id)?1:0)}</span>
            </button>
            <button onClick={()=>onReply(c.id, c.user)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif",padding:0,display:"flex",alignItems:"center",gap:3}}>
              <span style={{fontSize:12}}>↩</span> Reply
            </button>
            {hasReplies && (
              <button onClick={()=>setShowReplies(s=>!s)} style={{background:"none",border:"none",cursor:"pointer",color:"#00E5FF",fontSize:11,fontFamily:"'Inter',sans-serif",padding:0}}>
                {showReplies ? "▾ "+(c.replies.length)+" replies" : "▸ "+(c.replies.length)+" replies"}
              </button>
            )}
          </div>
        </div>
      </div>
      {hasReplies && showReplies && c.replies.map(r=>(
        <CommentItem key={r.id} c={r} depth={depth+1} likedIds={likedIds} onLike={onLike} onReply={onReply}/>
      ))}
    </div>
  );
}

function CommentsSheet({
  pred, onClose }) {
  const t = useTheme();
  const seedComments = (INITIAL_COMMENTS[pred.id] || []).map(c=>({
    ...c,
    replies: c.replies || [],
    betId: c.betId || null,
    thesis: c.thesis || null,
  }));
  const [comments, setComments] = useState(seedComments);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null); // {id, user}
  const [betIdSearch, setBetIdSearch] = useState("");
  const [likedIds, setLikedIds] = useState([]);
  const [searchResult, setSearchResult] = useState(null);
  const textRef = useRef(null);

  const totalCount = comments.reduce((s,c)=>s+(c.replies?.length||0),0) + comments.length;

  const handleLike = (id) => {
    setLikedIds(ids => ids.includes(id) ? ids.filter(i=>i!==id) : [...ids,id]);
  };

  const handleReply = (parentId, user) => {
    setReplyTo({id: parentId, user});
    setText("@"+(user)+" ");
    setTimeout(()=>textRef.current?.focus(), 100);
  };

  const submit = () => {
    if (!text.trim()) return;
    const newComment = {
      id: Date.now(),
      user: "deus_vult",
      avatar: "⚡",
      text: text.trim(),
      likes: 0,
      ts: "Just now",
      replies: [],
      isMe: true,
    };
    if (replyTo) {
      setComments(cs => cs.map(c => c.id===replyTo.id ? {...c, replies:[...(c.replies||[]), newComment]} : c));
    } else {
      setComments(cs => [newComment, ...cs]);
    }
    setText("");
    setReplyTo(null);
  };

  const handleBetSearch = () => {
    if (!betIdSearch.trim()) return;
    // Mock: find any bet comment with matching ID
    const found = comments.find(c => c.betId && c.betId.includes(betIdSearch.trim().toUpperCase()));
    setSearchResult(found || "NOT_FOUND");
  };

  return (
    <Sheet onClose={onClose}>
      {/* Header with back button */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <button onClick={onClose} style={{width:34,height:34,borderRadius:10,background:"rgba(255,255,255,0.07)",border:"none",color:"rgba(255,255,255,0.6)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <span style={{fontSize:20,lineHeight:1,color:"#FFFFFF",fontWeight:300}}>‹</span>
        </button>
        <div>
          <div style={{color:"#FFFFFF",fontWeight:700,fontSize:16,fontFamily:"'Inter',sans-serif"}}>Comments</div>
          <div style={{color:"rgba(255,255,255,0.3)",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:1}}>{totalCount} {totalCount===1?"comment":"comments"}</div>
        </div>
      </div>
      {/* Bet ID lookup */}
      <div style={{background:"#0F2040",border:"1px solid #1A2D4A",borderRadius:12,padding:"10px 12px",marginBottom:16}}>
        <div style={{color:"rgba(255,255,255,0.22)",fontSize:9,fontFamily:"'Inter',sans-serif",letterSpacing:1,marginBottom:6}}>🔍 FIND A BET BY ID</div>
        <div style={{display:"flex",gap:8}}>
          <input value={betIdSearch} onChange={e=>setBetIdSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleBetSearch()} placeholder="Paste Bet ID e.g. BET-5-ABC123" style={{flex:1,background:"#0F2040",border:"1px solid #1A2D4A",borderRadius:8,padding:"8px 10px",color:"#FFFFFF",fontSize:12,fontFamily:"'Inter',sans-serif",outline:"none"}}/>
          <button onClick={handleBetSearch} style={{background:"#3B82F6",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:700,padding:"8px 12px",cursor:"pointer",fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap"}}>Find</button>
        </div>
        {searchResult && searchResult!=="NOT_FOUND" && (
          <div style={{background:"rgba(20,158,99,0.06)",border:"1px solid rgba(59,130,246,0.133)",borderRadius:8,padding:"8px 10px",marginTop:8}}>
            <div style={{color:"#3B82F6",fontSize:10,fontFamily:"'Inter',sans-serif",marginBottom:3}}>✓ Found bet by @{searchResult.user}</div>
            {searchResult.thesis && <div style={{color:"rgba(255,255,255,0.62)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>{searchResult.thesis}</div>}
          </div>
        )}
        {searchResult==="NOT_FOUND" && <div style={{color:"#f93d3d",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:6}}>No bet found with that ID</div>}
      </div>

      {comments.length===0
        ? <p style={{color:"rgba(255,255,255,0.42)",textAlign:"center",padding:"30px 0",fontFamily:"'Inter',sans-serif",fontSize:12}}>No comments yet. Be first!</p>
        : comments.map(c => (
          <CommentItem key={c.id} c={c} depth={0} likedIds={likedIds} onLike={handleLike} onReply={handleReply}/>
        ))
      }

      {/* Sticky compose box at bottom — Instagram/TikTok style */}
      <div style={{position:"sticky",bottom:0,background:"#0A1628",paddingTop:10,paddingBottom:8,borderTop:"1px solid rgba(255,255,255,0.06)",marginTop:16}}>
        {replyTo && (
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,padding:"5px 10px",background:"rgba(0,229,255,0.06)",borderRadius:8}}>
            <span style={{color:"#00E5FF",fontSize:11,fontFamily:"'Inter',sans-serif"}}>↩ Replying to @{replyTo.user}</span>
            <button onClick={()=>{setReplyTo(null);setText("");}} style={{background:"none",border:"none",color:"rgba(255,255,255,0.32)",cursor:"pointer",fontSize:14,lineHeight:1}}>✕</button>
          </div>
        )}
        <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
          <Avatar emoji="⚡" color="#3B82F6" size={32}/>
          <div style={{flex:1}}>
            <textarea ref={textRef} value={text} onChange={e=>setText(e.target.value)}
              placeholder={replyTo?"Reply to @"+(replyTo.user)+"...":"Add a comment…"} rows={1}
              style={{width:"100%",background:"#0F2040",border:"1px solid #1A2D4A",borderRadius:20,padding:"9px 14px",color:"#FFFFFF",fontSize:13,fontFamily:"'Inter',sans-serif",resize:"none",outline:"none",lineHeight:1.4}}/>
          </div>
          <button onClick={submit} style={{background:text.trim()?"#3B82F6":"#1A2D4A",border:"none",borderRadius:20,color:text.trim()?"#000":"rgba(255,255,255,0.22)",fontSize:12,fontWeight:700,padding:"9px 16px",cursor:text.trim()?"pointer":"default",fontFamily:"'Inter',sans-serif",transition:"all 0.2s",flexShrink:0,whiteSpace:"nowrap"}}>
            {replyTo?"Reply":"Post"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL SHEET
// ─────────────────────────────────────────────────────────────────────────────
function DetailSheet({
  pred, onClose }) {
  const t = useTheme();
  const betId = "MKT-"+(String(pred.id).padStart(4,"0"))+"-"+(pred.category.slice(0,3).toUpperCase());
  const [copied, setCopied] = useState(false);
  const copyId = () => { navigator.clipboard?.writeText(betId).catch(()=>{}); setCopied(true); setTimeout(()=>setCopied(false), 2000); };

  // Fetch live price history from Polymarket CLOB via our proxy
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const tokenId = pred.clobTokenIds?.[0];
  useEffect(() => {
    if (!tokenId) return;
    setHistoryLoading(true);
    fetch(`/api/history?tokenId=${tokenId}`)
      .then(r => r.json())
      .then(data => {
        // CLOB returns [{t: timestamp, p: price}, ...]
        const raw = Array.isArray(data) ? data : data.history || [];
        // Keep timestamps alongside prices for real x-axis
        const step = Math.max(1, Math.floor(raw.length / 60));
        const pts = raw
          .filter((_, i) => i % step === 0)
          .map(pt => ({ t: pt.t, p: Math.round(parseFloat(pt.p || pt.price || 0) * 100) }))
          .filter(pt => pt.p > 0 && pt.p < 100);
        if (pts.length >= 2) setHistoryData(pts);
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [tokenId]);

  const chartPoints = historyData ? historyData.map(d=>d.p) : pred.chartData;
  const isLiveChart = !!historyData;

  // Compute trend from history
  const trendPct = isLiveChart && chartPoints.length >= 2
    ? ((chartPoints[chartPoints.length-1] - chartPoints[0]) / chartPoints[0] * 100).toFixed(1)
    : null;
  const trendDir = trendPct !== null ? (parseFloat(trendPct) >= 0 ? "up" : "down") : pred.trendDir;
  const trendLabel = trendPct !== null ? (parseFloat(trendPct) >= 0 ? "+" : "") + trendPct + "%" : pred.trend;

  return (
    <Sheet onClose={onClose}>
      {/* Header row: back button + category */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <button onClick={onClose} style={{width:34,height:34,borderRadius:10,background:"rgba(255,255,255,0.07)",border:"none",color:"rgba(255,255,255,0.6)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <span style={{fontSize:20,lineHeight:1,color:"#FFFFFF",fontWeight:300}}>‹</span>
        </button>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:14}}>{CATEGORY_META[pred.category]?.icon||"📊"}</span>
          <span style={{color:pred.accent||"#3B82F6",fontSize:11,fontWeight:700,letterSpacing:1.5,fontFamily:"'Inter',sans-serif"}}>{pred.category}</span>
        </div>
        {isLiveChart && <div style={{marginLeft:"auto",background:"rgba(20,158,99,0.15)",border:"1px solid rgba(59,130,246,0.3)",borderRadius:20,padding:"2px 8px",display:"flex",alignItems:"center",gap:4}}>
          <div style={{width:4,height:4,borderRadius:"50%",background:"#3B82F6",animation:"pulse 1.5s infinite"}}/>
          <span style={{color:"rgba(59,130,246,0.9)",fontSize:9,fontWeight:700,fontFamily:"'Inter',sans-serif",letterSpacing:1}}>LIVE CHART</span>
        </div>
        }
      </div>

      <h2 style={{color:"#FFFFFF",fontSize:19,fontWeight:800,lineHeight:1.3,marginBottom:18,fontFamily:"'Inter',sans-serif"}}>{pred.title}</h2>
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:22}}>
        <div>
          <div style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif",marginBottom:4}}>Current</div>
          <div style={{display:"flex",alignItems:"baseline",gap:8}}>
            <span style={{color:"#FFFFFF",fontSize:44,fontWeight:900,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{pred.yesPct}%</span>
            <span style={{color:"#3B82F6",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>YES</span>
          </div>
        </div>
        <div style={{background:trendDir==="up"?"rgba(59,130,246,0.12)":"rgba(249,61,61,0.12)",border:"1px solid "+(trendDir==="up"?"rgba(59,130,246,0.267)":"rgba(249,61,61,0.267)"),borderRadius:10,padding:"8px 14px",textAlign:"right"}}>
          <div style={{color:trendDir==="up"?"#3B82F6":"#f93d3d",fontWeight:700,fontSize:15,fontFamily:"'Inter',sans-serif"}}>{trendDir==="up"?"↗":"↘"} {trendLabel}</div>
          <div style={{color:"rgba(255,255,255,0.25)",fontSize:10,fontFamily:"'Inter',sans-serif",marginTop:2}}>{isLiveChart ? "lifetime change" : "6-month change"}</div>
        </div>
      </div>
      <div style={{background:"#0F2040",borderRadius:16,padding:"16px 14px",marginBottom:22,position:"relative"}}>
        {historyLoading && <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:16,background:"rgba(13,31,60,0.8)",zIndex:2}}>
          <span style={{color:"rgba(255,255,255,0.4)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>Loading chart...</span>
        </div>
        }
        <FullChart data={chartPoints} color={pred.accent} isLive={isLiveChart}/>
      </div>
      <SectionLabel>KEY STATISTICS</SectionLabel>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:22}}>
        {[{icon:"↗",c:"#3B82F6",val:pred.allTimeHigh,label:"All-Time High"},{icon:"↘",c:"#f93d3d",val:pred.allTimeLow,label:"All-Time Low"},{icon:"📊",c:"#7c4dcc",val:pred.avgVol,label:"6M Average"},{icon:"〰",c:"#7c4dcc",val:pred.volatility,label:"Volatility"}].map((s,i)=>(
          <div key={i} style={{background:"#0F2040",borderRadius:14,padding:"16px 14px"}}>
            <div style={{fontSize:20,marginBottom:8,color:s.c}}>{s.icon}</div>
            <div style={{color:"#FFFFFF",fontSize:24,fontWeight:800,fontFamily:"'Inter',sans-serif"}}>{s.val}</div>
            <div style={{color:"rgba(255,255,255,0.3)",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>
      {[["🟢","Total Pool",pred.pool],["👥","Bettors",pred.bettors],["🟠","Time Remaining",pred.daysLeft],["📈","Trend",pred.trendDir==="up"?"Bullish":"Bearish"]].map(([icon,label,val],i)=>(
        <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:18}}>{icon}</span><span style={{color:"rgba(255,255,255,0.42)",fontSize:14,fontFamily:"'Inter',sans-serif"}}>{label}</span></div>
          <span style={{color:"#FFFFFF",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{val}</span>
        </div>
      ))}

      {/* Bet ID */}
      <div style={{marginTop:20,background:"rgba(20,158,99,0.06)",borderRadius:14,padding:"14px 16px"}}>
        <div style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontFamily:"'Inter',sans-serif",fontWeight:600,letterSpacing:1.5,marginBottom:8}}>MARKET ID</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
          <span style={{color:"#3B82F6",fontSize:15,fontWeight:800,fontFamily:"'Inter',sans-serif",letterSpacing:1}}>{betId}</span>
          <button onClick={copyId} style={{background:copied?"#3B82F6":"rgba(59,130,246,0.12)",border:"none",borderRadius:10,color:copied?"#000":"#3B82F6",fontSize:11,fontWeight:700,padding:"7px 14px",cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.2s",whiteSpace:"nowrap",flexShrink:0}}>
            {copied?"✓ Copied":"Copy"}
          </button>
        </div>
        <div style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif",marginTop:6}}>predictswipe.app/market/{betId}</div>
      </div>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BET CONFIRMED OVERLAY
// ─────────────────────────────────────────────────────────────────────────────
function BetConfirmed({ position, amount, onDone, betId, pred }) {
  const [copied, setCopied] = useState(false);
  const id = betId || ("BET-"+(Date.now().toString(36).toUpperCase().slice(-6)));
  const copyId = () => {
    navigator.clipboard?.writeText(id).catch(()=>{});
    setCopied(true);
    setTimeout(()=>setCopied(false), 2000);
  };
  return (
    <div style={{position:"absolute",inset:0,zIndex:500,background:"rgba(0,0,0,0.92)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:0,animation:"fadeIn 0.2s ease",padding:"0 28px"}}>
      {/* Tick */}
      <div style={{width:72,height:72,borderRadius:"50%",background:position==="YES"?"rgba(34,197,94,0.2)":"rgba(249,61,61,0.2)",border:"2px solid "+(position==="YES"?"#22C55E":"#f93d3d"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,animation:"popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)",marginBottom:14}}>
        {position==="YES"?"✅":"❌"}
      </div>
      <div style={{color:"#FFFFFF",fontSize:28,fontWeight:900,fontFamily:"'Inter',sans-serif",lineHeight:1,marginBottom:4}}>${Number(amount).toFixed(2)}</div>
      <div style={{color:"rgba(255,255,255,0.4)",fontSize:13,fontFamily:"'Inter',sans-serif",letterSpacing:1,marginBottom:24}}>Position: {position}</div>

      {/* BetID */}
      <div style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:14,padding:"14px 16px",marginBottom:20}}>
        <div style={{color:"rgba(255,255,255,0.3)",fontSize:9,fontFamily:"'Inter',sans-serif",letterSpacing:1.5,marginBottom:8}}>POSITION ID</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
          <div style={{color:"#FFFFFF",fontSize:15,fontWeight:900,fontFamily:"'Inter',sans-serif",letterSpacing:1.5}}>{id}</div>
          <button onClick={copyId} style={{background:copied?"#3B82F6":"rgba(255,255,255,0.08)",border:"1px solid "+(copied?"#3B82F6":"rgba(255,255,255,0.15)"),borderRadius:99,color:copied?"#fff":"rgba(255,255,255,0.55)",fontSize:11,fontWeight:700,padding:"6px 14px",cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.2s",whiteSpace:"nowrap",flexShrink:0}}>
            {copied?"✓ Copied":"Copy"}
          </button>
        </div>
      </div>

      <button onClick={onDone} style={{width:"100%",background:"linear-gradient(135deg,#3B82F6,#1D6ED8)",border:"none",borderRadius:10,color:"#fff",fontSize:15,fontWeight:700,padding:"15px",cursor:"pointer",fontFamily:"'Inter',sans-serif",boxShadow:"0 4px 16px rgba(59,130,246,0.4)",letterSpacing:0.3}}>
        Done
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PREDICTION CARD (FULL SCREEN)
// ─────────────────────────────────────────────────────────────────────────────

// ─── 5-Minute Market Badge with live countdown ────────────────────────────────
function FiveMinBadge({ endDate, secsLeft: initialSecs }) {
  const calcSecs = () => endDate
    ? Math.max(0, Math.round((new Date(endDate).getTime() - Date.now()) / 1000))
    : (initialSecs || 0);
  const [secs, setSecs] = useState(calcSecs);
  useEffect(() => {
    setSecs(calcSecs());
    const id = setInterval(() => setSecs(calcSecs()), 1000);
    return () => clearInterval(id);
  }, [endDate]);
  const mins    = Math.floor(secs / 60);
  const s       = secs % 60;
  const danger  = secs <= 30 && secs > 0;
  const urgent  = secs < 60 && secs > 30;
  const color   = secs === 0 ? "#f93d3d" : danger ? "#f93d3d" : urgent ? "#F4C430" : "#3B82F6";
  // Show PENDING when timer is 0 and price is near 50% (market settling)
  const isPending = secs === 0;
  const pendingColor = "#00E5FF";
  return (
    <>
      {danger && <style>{`@keyframes dangerpulse{0%{opacity:1;transform:scale(1);}50%{opacity:0.6;transform:scale(1.08);}100%{opacity:1;transform:scale(1);}}`}</style>}
      {isPending && <style>{`@keyframes pendingpulse{0%{opacity:0.4;}50%{opacity:1;}100%{opacity:0.4;}}`}</style>}
      <div style={{
        display:"inline-flex", alignItems:"center", gap:4,
        background: (isPending ? pendingColor : color)+"22",
        border:"2px solid "+(isPending ? pendingColor : color),
        borderRadius:20, padding:"2px 8px", fontSize:9, fontWeight:900,
        fontFamily:"'Inter',sans-serif",
        color: isPending ? pendingColor : color,
        letterSpacing:0.5,
        animation: isPending ? "pendingpulse 1.2s ease-in-out infinite" : danger ? "dangerpulse 0.6s ease-in-out infinite" : "none",
      }}>
        {isPending ? "⏳ PENDING" : "⚡ " + (mins > 0 ? mins+"m "+String(s).padStart(2,"0")+"s" : String(s).padStart(2,"0")+"s")}
      </div>
    </>
  );
}

function PredCard({ pred, userVote, onVote, following, onFollow, balance, isWatched, onToggleWatch, propAccounts=[], maxBetSetting=100 }) {
  // Compute prop-aware balance and max bet up front
  const _activeProp = (propAccounts||[]).find(a => a.status==="active"||a.status==="funded");
  const _activeTier = _activeProp ? PROP_TIERS.find(t => t.id===_activeProp.tierId) : null;
  const propBalance    = _activeTier ? _activeTier.balance : balance;
  const propMaxBet     = _activeTier ? _activeTier.maxBet  : maxBetSetting;

  const [showDetail, setShowDetail] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showBetModal, setShowBetModal] = useState(null);
  const [showConfirm, setShowConfirm] = useState(null);
  const [liked, setLiked] = useState(false);
  const [localYesPct, setLocalYesPct] = useState(pred.yesPct);
  const [driftDir, setDriftDir] = useState(0);
  const [flashPos, setFlashPos] = useState(null); // "YES"|"NO" — brief highlight before modal

  // Sync to real Polymarket price when pred.yesPct updates from live feed
  useEffect(() => {
    setLocalYesPct(prev => {
      const next = pred.yesPct;
      if (next === prev) return prev;
      // Show direction indicator based on real price change
      setDriftDir(next > prev ? 1 : -1);
      setTimeout(() => setDriftDir(0), 2000);
      return next;
    });
  }, [pred.yesPct]);

  const noYes = Math.round(100 - localYesPct);
  const yesRounded = Math.round(localYesPct);

  const handleVoteIntent = (pos) => {
    if (userVote) return;
    setFlashPos(pos);
    setTimeout(() => { setFlashPos(null); setShowBetModal(pos); }, 500);
  };

  const handleBetConfirm = (amount, thesis, shares, sharePrice) => {
    const pos = showBetModal;
    setShowBetModal(null);
    onVote(pred.id, pos, amount, shares, sharePrice);
    setLocalYesPct(p => pos==="YES" ? Math.min(99,p+1) : Math.max(1,p-1));
    setShowConfirm({ pos, amount, betId:"BET-"+(pred?.id||"")+"-"+(Date.now().toString(36).toUpperCase().slice(-6)) });
  };

  return (
    <div style={{position:"relative",width:"100%",height:"100%",overflow:"hidden",background:"#0A1628"}}>
      <PredImage pred={pred} style={{position:"absolute",inset:0,width:"100%",height:"100%"}}/>
      {/* Gradient: strong at bottom for text legibility, fades to clear at top */}
      <div style={{position:"absolute",inset:0,background:"linear-gradient(to top, rgba(7,15,30,0.98) 0%, rgba(7,15,30,0.85) 28%, rgba(7,15,30,0.3) 55%, transparent 100%)"}}/>
      {/* Click flash — trailing glow sweep */}
      {flashPos && (
        <div style={{position:"absolute",inset:0,zIndex:5,pointerEvents:"none",
          background:flashPos==="YES"
            ?"linear-gradient(90deg, transparent 0%, rgba(34,197,94,0.15) 40%, rgba(34,197,94,0.28) 70%, transparent 100%)"
            :"linear-gradient(270deg, transparent 0%, rgba(239,68,68,0.15) 40%, rgba(239,68,68,0.28) 70%, transparent 100%)",
          animation:"flashSweep 0.5s ease-out forwards"
        }}/>
      )}

      {/* TOP: category removed from here — now shown in bottom row next to pool */}

      {/* RIGHT ACTIONS — TikTok position, no borders, pure icon + label */}
      <div style={{position:"absolute",right:14,bottom:68,zIndex:10,display:"flex",flexDirection:"column",alignItems:"center",gap:24}}>

        {/* Like */}
        <TikTokAction
          active={liked} activeColor="#f93d3d"
          count={liked ? addK(parseNum(pred.likes)+1) : pred.likes}
          onClick={()=>setLiked(l=>!l)}
          icon={
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.08C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.53L12 21.35z"
                fill={liked?"#f93d3d":"none"} stroke={liked?"#f93d3d":"#fff"} strokeWidth="1.5"/>
            </svg>
          }
        />

        {/* Comment */}
        <TikTokAction count={pred.comments} onClick={()=>setShowComments(true)}
          icon={
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
                stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
            </svg>
          }
        />

        {/* Share */}
        <TikTokAction count={pred.shares} onClick={()=>setShowShare(true)}
          icon={
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="18" cy="5" r="3" stroke="#fff" strokeWidth="1.5"/>
              <circle cx="6" cy="12" r="3" stroke="#fff" strokeWidth="1.5"/>
              <circle cx="18" cy="19" r="3" stroke="#fff" strokeWidth="1.5"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke="#fff" strokeWidth="1.5"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke="#fff" strokeWidth="1.5"/>
            </svg>
          }
        />

        {/* Bookmark */}
        <TikTokAction active={isWatched} activeColor="#3B82F6"
          count={isWatched?"Saved":"Save"} onClick={()=>onToggleWatch&&onToggleWatch(pred.id)}
          icon={
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z"
                stroke={isWatched?"#3B82F6":"rgba(255,255,255,0.9)"}
                fill={isWatched?"rgba(59,130,246,0.15)":"none"}
                strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
        />

        {/* Hot pill */}
        {pred.hot && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <div style={{
              width:44,height:44,borderRadius:12,
              background:"rgba(244,196,48,0.12)",
              border:"1px solid rgba(244,196,48,0.3)",
              backdropFilter:"blur(8px)",
              display:"flex",alignItems:"center",justifyContent:"center",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2c0 3-2 5-2 8a2 2 0 004 0c0-1-.5-2-1-2.5 0 1.5-.5 2.5-1 2.5C12 8 14 6 14 2c-1 1-2 2-2 4V2z" fill="#F4C430" opacity="0.9"/>
                <path d="M8 17a4 4 0 008 0c0-1.5-1-3-2-3.5.3 1-.2 2-.5 2.5C13 14.5 12 13 12 11c-2 2-4 3.5-4 6z" fill="#ffa07a"/>
              </svg>
            </div>
            <span style={{color:"#F4C430",fontSize:9,fontWeight:700,fontFamily:"'Inter',sans-serif",letterSpacing:0.5,textShadow:"0 1px 6px rgba(0,0,0,0.9)"}}>HOT</span>
          </div>
        )}
      </div>

      {/* BOTTOM — no username/follow, just content */}
      <div style={{position:"absolute",bottom:0,left:0,right:72,padding:"0 16px 20px",zIndex:10}}>
        {/* Pool + deadline row */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          {/* Pool + days stacked */}
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:"#3B82F6",boxShadow:"0 0 5px #3B82F6",flexShrink:0}}/>
              <div style={{display:"flex",flexDirection:"column",gap:1}}>
                <span style={{color:"rgba(255,255,255,0.65)",fontSize:10,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{pred.pool} Pool</span>
                <CountdownOrDays daysLeft={pred.daysLeft} endDateRaw={pred.endDate}/>
              </div>
            </div>
          </div>
          {/* Category pill — next to pool */}
          <div style={{display:"flex",alignItems:"center",gap:4,background:"rgba(10,22,40,0.55)",borderRadius:20,padding:"3px 10px",backdropFilter:"blur(12px)"}}>
            <span style={{fontSize:11}}>{CATEGORY_META[pred.category]?.icon}</span>
            <span style={{color:"rgba(255,255,255,0.7)",fontSize:9,fontFamily:"'Inter',sans-serif",letterSpacing:1,fontWeight:700}}>{pred.category}</span>
          </div>
          <span style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontFamily:"'Inter',sans-serif",marginLeft:"auto"}}>👥 {pred.bettors}</span>
        </div>

        {pred.hot&&(
          <div style={{display:"inline-flex",alignItems:"center",gap:4,background:"rgba(255,107,53,0.18)",borderRadius:20,padding:"2px 9px",marginBottom:7}}>
            <span style={{fontSize:9}}>🔥</span>
            <span style={{color:"#F4C430",fontSize:8,fontWeight:700,letterSpacing:2,fontFamily:"'Inter',sans-serif"}}>TRENDING</span>
          </div>
        )}
        <h2 style={{color:"#FFFFFF",fontSize:21,fontWeight:800,lineHeight:1.3,fontFamily:"'Inter',sans-serif",marginBottom:12,textShadow:"0 2px 16px rgba(0,0,0,0.9)"}}>{pred.title}</h2>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:7,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(6px)",borderRadius:20,padding:"5px 12px"}}>
            <Sparkline data={pred.chartData} color={driftDir===1?"#22C55E":driftDir===-1?"#EF4444":"rgba(255,255,255,0.42)"} width={38} height={13}/>
            <span style={{color:driftDir===1?"#22C55E":driftDir===-1?"#EF4444":"rgba(255,255,255,0.75)",fontWeight:700,fontSize:12,fontFamily:"'Inter',sans-serif",transition:"color 0.4s"}}>{yesRounded}% YES {driftDir===1?"▲":driftDir===-1?"▼":""}</span>
          </div>
          <button onClick={()=>setShowDetail(true)} style={{marginLeft:"auto",background:"rgba(255,255,255,0.07)",border:"none",borderRadius:20,color:"rgba(255,255,255,0.5)",fontSize:11,cursor:"pointer",padding:"5px 11px",fontFamily:"'Inter',sans-serif",backdropFilter:"blur(4px)"}}>Details ›</button>
        </div>
        <div style={{display:"flex",gap:10}}>
          <YesNoBtn label="YES" pct={yesRounded} voted={userVote} onClick={()=>handleVoteIntent("YES")}/>
          <YesNoBtn label="NO" pct={noYes} voted={userVote} onClick={()=>handleVoteIntent("NO")}/>
        </div>
      </div>

      {showBetModal&&<BetModal pred={{...pred,yesPct:yesRounded}} position={showBetModal}
        balance={propBalance} maxBetSetting={propMaxBet}
        onConfirm={handleBetConfirm} onClose={()=>setShowBetModal(null)}/>}
      {showConfirm&&<BetConfirmed position={showConfirm.pos} amount={showConfirm.amount} betId={showConfirm.betId} onDone={()=>setShowConfirm(null)}/>}
      {showDetail&&<DetailSheet pred={{...pred,yesPct:yesRounded}} onClose={()=>setShowDetail(false)}/>}
      {showComments&&<CommentsSheet pred={pred} onClose={()=>setShowComments(false)}/>}
      {showShare&&<div style={{position:"fixed",inset:0,zIndex:200,maxWidth:430,margin:"0 auto"}}><ShareCardModal pred={{...pred,yesPct:yesRounded}} onClose={()=>setShowShare(false)}/></div>}
    </div>
  );
}

// Borderless TikTok-style action — pure icon + shadow label, no box
function TikTokAction({ icon, count, onClick, active=false, activeColor="#fff" }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseDown={()=>setPressed(true)} onMouseUp={()=>setPressed(false)}
      onTouchStart={()=>setPressed(true)} onTouchEnd={()=>setPressed(false)}
      style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer",
        transform:pressed?"scale(0.84)":"scale(1)",
        transition:"transform 0.14s cubic-bezier(0.34,1.56,0.64,1)",userSelect:"none"}}
    >
      <div style={{
        width:48,height:48,display:"flex",alignItems:"center",justifyContent:"center",
        filter:"drop-shadow(0 2px 8px rgba(0,0,0,0.7))",
      }}>
        {icon}
      </div>
      <span style={{
        color:active ? activeColor : "rgba(255,255,255,0.9)",
        fontSize:12,fontWeight:600,fontFamily:"'Inter',sans-serif",
        textShadow:"0 1px 8px rgba(0,0,0,1)",letterSpacing:0,
        transition:"color 0.2s",
      }}>{count}</span>
    </div>
  );
}

function parseNum(s){ if(!s)return 0; const n=parseFloat(s); return s.includes("K")?n*1000:s.includes("M")?n*1e6:n; }
function addK(n){ return n>=1e6?((n/1e6).toFixed(1))+"M":n>=1000?((n/1000).toFixed(1))+"K":String(n); }

// ─────────────────────────────────────────────────────────────────────────────
// AD CARD
// ─────────────────────────────────────────────────────────────────────────────
function AdCard({ data, onSkip, onOpenPropFirm }) {
  const [cd,setCd]=useState(3);
  useEffect(()=>{ if(cd===0)return; const t=setTimeout(()=>setCd(c=>c-1),1000); return()=>clearTimeout(t); },[cd]);
  const handleCta = (e) => { e.stopPropagation(); if(data.isPropFirm && onOpenPropFirm) { onOpenPropFirm(); } };
  return (
    <div style={{width:"100%",height:"100%",position:"relative",background:data.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 30%, "+(data.accent)+"22 0%, transparent 65%)"}}/>
      {/* Gold shimmer line */}
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,"+data.accent+",transparent)"}}/>
      <div style={{position:"absolute",top:16,left:16,background:"rgba(255,255,255,0.07)",borderRadius:6,padding:"3px 10px",fontSize:10,color:"rgba(255,255,255,0.32)",letterSpacing:2}}>SPONSORED</div>
      <button onClick={cd===0?onSkip:undefined} style={{position:"absolute",top:14,right:14,background:"rgba(255,255,255,0.06)",border:"1px solid #1A2D4A",borderRadius:8,color:cd>0?"rgba(255,255,255,0.22)":"rgba(255,255,255,0.72)",cursor:cd>0?"default":"pointer",fontSize:12,padding:"5px 13px",fontFamily:"'Inter',sans-serif"}}>
        {cd>0?"Skip "+(cd)+"s":"Skip →"}
      </button>
      <div style={{fontSize:90,marginBottom:16,filter:"drop-shadow(0 0 40px "+(data.accent)+"66)"}}>{data.icon}</div>
      <div style={{color:data.accent,fontSize:11,letterSpacing:3,fontFamily:"'Inter',sans-serif",marginBottom:8,fontWeight:700}}>{data.tagline}</div>
      <h2 style={{color:"#FFFFFF",fontSize:30,fontWeight:900,fontFamily:"'Inter',sans-serif",textAlign:"center",marginBottom:10,lineHeight:1.1,padding:"0 24px"}}>{data.headline}</h2>
      <p style={{color:"rgba(255,255,255,0.42)",fontSize:14,marginBottom:16,textAlign:"center",padding:"0 32px",fontFamily:"'Inter',sans-serif"}}>{data.sub}</p>
      {data.isPropFirm && (
        <div style={{display:"flex",gap:24,marginBottom:32}}>
          {[["$10K","Starter"],["$50K","Pro"],["$100K","Elite"]].map(([amt,tier])=>(
            <div key={tier} style={{textAlign:"center"}}>
              <div style={{color:data.accent,fontSize:16,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{amt}</div>
              <div style={{color:"rgba(255,255,255,0.4)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>{tier}</div>
            </div>
          ))}
        </div>
      )}
      <button onClick={handleCta} style={{background:"linear-gradient(135deg,"+data.accent+",#b8960c)",color:"#000",border:"none",borderRadius:99,padding:"16px 48px",fontSize:15,fontWeight:900,cursor:"pointer",fontFamily:"'Inter',sans-serif",boxShadow:"0 0 40px "+(data.accent)+"66"}}>{data.cta}</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FEED
// ─────────────────────────────────────────────────────────────────────────────
function buildFeed(mode, following, preds){
  const src = mode==="following"
    ? preds.filter(p=>following.includes(p.creator.handle))
    : mode==="trending"
    ? [...preds].filter(p=>p.hot).concat(preds.filter(p=>!p.hot))
    : preds;
  const feed=[];
  src.forEach((p,i)=>{ feed.push({type:"pred",data:p}); if((i+1)%5===0) feed.push({type:"ad",data:AD_CARDS[Math.floor(i/5)%AD_CARDS.length]}); });
  if (feed.length===0) feed.push({type:"empty"});
  return feed;
}

// ─────────────────────────────────────────────────────────────────────────────
// INLINE SELL VIEW — transparent, lives inside PnlDropdown overlay
// ─────────────────────────────────────────────────────────────────────────────
function InlineSellView({ bet, market, acctId, propAccounts, onSellBet, onBack, onClose }) {
  const currYesPct  = market?.yesPct ?? bet?.entryPct ?? 50;
  const currPrice   = bet?.pos==="YES" ? currYesPct/100 : (100-currYesPct)/100;
  const totalShares = bet?.shares > 0 ? bet.shares : (bet?.stake / Math.max(0.01, bet?.sharePrice||0.5));
  const [sellPct, setSellPct]     = useState(100);
  const [selling, setSelling]     = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const sharesToSell = parseFloat((totalShares * sellPct / 100).toFixed(4));
  const grossVal     = sharesToSell * currPrice;
  const sellValue    = parseFloat((grossVal * 0.99).toFixed(2));
  const costBasis    = parseFloat(((bet?.stake||0) * sellPct / 100).toFixed(2));
  const pnl          = parseFloat((sellValue - costBasis).toFixed(2));
  const sidePrice    = bet?.pos==="YES" ? Math.round(currYesPct) : Math.round(100-currYesPct);

  const handleSell = () => {
    const result = { soldValue: sellValue, sellPct, sharesToSell };
    const accountId = acctId || (propAccounts||[]).find(a=>(a.bets||[]).some(b=>String(b.predId)===String(bet?.predId)))?.id;

    if (onSellBet && accountId) {
      onSellBet(accountId, result, bet, true);
    } else {
    }
    setSelling(true);
    setTimeout(()=>{ setSelling(false); setConfirmed(true); }, 800);
  };

  const handleDone = () => {
    if (sellPct >= 100 && onClose) {
      onClose(); // full sell — close entire dropdown
    } else {
      onBack(); // partial sell — back to positions list
    }
  };

  return (
    <div style={{position:"absolute",inset:0,zIndex:200,display:"flex",flexDirection:"column",animation:"pnlFadeIn 0.15s ease-out"}}>      <button onClick={onBack} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",fontSize:11,fontFamily:"'Inter',sans-serif",padding:"8px 14px 4px",cursor:"pointer",textAlign:"left",letterSpacing:0.5}}>
        ← Back
      </button>
      <div style={{padding:"0 14px 10px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{color:"#FFFFFF",fontSize:12,fontWeight:600,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{bet?.title||bet?.predId}</div>
        <div style={{display:"flex",gap:8,marginTop:4,alignItems:"center"}}>
          <span style={{color:bet?.pos==="YES"?"#22C55E":"#f93d3d",fontSize:10,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{bet?.pos}</span>
          <span style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>{sidePrice}¢ · {totalShares.toFixed(2)} shares</span>
        </div>
      </div>

      {confirmed ? (
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8}}>
          <div style={{color:"#3B82F6",fontSize:22,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{sellPct<100?"Partial Sold":"Position Sold"}</div>
          <div style={{color:"rgba(255,255,255,0.4)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>${sellValue.toFixed(2)} returned</div>
          <button onClick={handleDone} style={{marginTop:12,background:"none",border:"1px solid rgba(59,130,246,0.4)",borderRadius:10,padding:"8px 24px",color:"#3B82F6",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>Done</button>
        </div>
      ) : (
        <div style={{flex:1,display:"flex",flexDirection:"column",padding:"10px 14px",gap:12,overflowY:"auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
            {[25,50,75,100].map(p=>(
              <button key={p} onClick={()=>setSellPct(p)} style={{background:"none",border:"1px solid "+(sellPct===p?"rgba(59,130,246,0.5)":"rgba(255,255,255,0.1)"),borderRadius:8,padding:"6px 0",color:sellPct===p?"#3B82F6":"rgba(255,255,255,0.35)",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                {p}%
              </button>
            ))}
          </div>
          <input type="range" min="1" max="100" value={sellPct} onChange={e=>setSellPct(parseInt(e.target.value))}
            style={{width:"100%",accentColor:"#3B82F6",cursor:"pointer"}}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[
              {l:"SHARES",     v:sharesToSell.toFixed(2)+" / "+totalShares.toFixed(2)},
              {l:"SELL VALUE", v:"$"+sellValue.toFixed(2)},
              {l:"COST",       v:"$"+costBasis.toFixed(2)},
              {l:"P&L",        v:(pnl>=0?"+":"-")+"$"+Math.abs(pnl).toFixed(2), c:pnl>=0?"#3B82F6":"#f93d3d"},
            ].map(s=>(
              <div key={s.l} style={{borderBottom:"1px solid rgba(255,255,255,0.06)",paddingBottom:6}}>
                <div style={{color:s.c||"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{s.v}</div>
                <div style={{color:"rgba(255,255,255,0.3)",fontSize:8,fontFamily:"'Inter',sans-serif",letterSpacing:1,marginTop:2}}>{s.l}</div>
              </div>
            ))}
          </div>
          <button onClick={handleSell} disabled={selling} style={{width:"100%",background:"none",border:"none",padding:"8px 0",color:selling?"rgba(255,255,255,0.2)":"#f93d3d",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif",cursor:selling?"default":"pointer",marginTop:"auto",textAlign:"left",letterSpacing:0.3}}>
            {selling ? "Processing…" : `Sell ${sellPct<100?sellPct+"% · ":""}$${sellValue.toFixed(2)} →`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PNL DROPDOWN — Open / Closed positions panel
// ─────────────────────────────────────────────────────────────────────────────
function PnlDropdown({ propAccounts, votes, ALL_PREDS, propPnl, pnlColor, onClose, onOpenPropFirm, onSellBet }) {
  const [posTab, setPosTab]       = React.useState("open");
  const [sellSheet, setSellSheet] = React.useState(null);
  // Always derive fresh from propAccounts so resolved/sold bets disappear immediately
  const openPropBets   = (propAccounts||[]).flatMap(a=>(a.bets||[]).filter(b=>!b.resolved));
  const closedPropBets = (propAccounts||[]).flatMap(a=>(a.bets||[]).filter(b=>b.resolved));

  return (
    <>
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Header — hidden when sell open */}
      {!sellSheet && <div style={{padding:"8px 14px 10px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",flexDirection:"column",gap:2}}>
          <span style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>Positions</span>
          <button onClick={()=>{onClose();onOpenPropFirm&&onOpenPropFirm();}} style={{background:"none",border:"none",padding:0,color:"rgba(255,255,255,0.35)",fontSize:10,fontFamily:"'Inter',sans-serif",cursor:"pointer",textAlign:"left",letterSpacing:0.3}}>
            Manage All Positions →
          </button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end"}}>
            <span style={{color:pnlColor,fontSize:14,fontWeight:900,fontFamily:"'Inter',sans-serif",textShadow:"0 0 12px "+pnlColor+"88"}}>{propPnl>=0?"+":"-"}${Math.abs(propPnl).toFixed(2)}</span>
            <span style={{color:"rgba(255,255,255,0.3)",fontSize:8,fontFamily:"'Inter',sans-serif",letterSpacing:1}}>NET P&L</span>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",padding:"4px",cursor:"pointer",color:"rgba(255,255,255,0.4)",fontSize:16,lineHeight:1,fontFamily:"'Inter',sans-serif",textShadow:"0 0 8px rgba(249,61,61,0.7)"}}>
            ✕
          </button>
        </div>
      </div>
      }

      {/* Tabs */}
      {!sellSheet && <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
        {[["open","Open ("+openPropBets.length+")"],["closed","Closed ("+closedPropBets.length+")"]].map(([id,label])=>(
          <button key={id} onClick={()=>setPosTab(id)} style={{flex:1,background:"none",border:"none",borderBottom:"none",padding:"8px 0",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:10,fontWeight:posTab===id?700:500,color:posTab===id?"#FFFFFF":"rgba(255,255,255,0.35)",display:"flex",flexDirection:"column",alignItems:"center",gap:4,transition:"color 0.15s"}}>
              <span>{label}</span>
              <div style={{width:posTab===id?16:0,height:2,borderRadius:99,background:"#3B82F6",transition:"width 0.2s cubic-bezier(0.4,0,0.2,1)"}}/>
            </button>
        ))}
      </div>}

      {/* Open positions */}
      {!sellSheet && <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden"}}>
      {posTab==="open" && (
        openPropBets.length===0 ? (
          <div style={{padding:"20px 14px",textAlign:"center",color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>No open positions</div>
        ) : (
          <div style={{maxHeight:260,overflowY:"auto"}}>
            {openPropBets.map((bet,i) => {
              const market     = ALL_PREDS.find(p=>String(p.id)===String(bet.predId)||String(p.polyId)===String(bet.predId));
              const endMs      = market?.endDate ? new Date(market.endDate).getTime()
                               : bet.endDate     ? new Date(bet.endDate).getTime()
                               : 0;
              const isResolving = endMs > 0 && endMs < Date.now() && !bet.resolved;
              const marketGone  = !market;
              // Use lastKnownPct (stored before market reset) when resolving/gone
              const currYesPct = (isResolving || marketGone)
                ? (bet.lastKnownPct ?? bet.entryPct ?? 50)
                : (market.yesPct ?? bet.entryPct ?? 50);
              const currPrice  = bet.pos==="YES" ? currYesPct/100 : (100-currYesPct)/100;
              const shares     = bet.shares > 0 ? bet.shares : (bet.stake / Math.max(0.01, bet.sharePrice||0.5));
              const currVal    = shares * currPrice;
              const livePnl    = parseFloat((currVal - bet.stake).toFixed(2));
              const sellValue  = parseFloat((currVal * 0.99).toFixed(2));
              const pnlC       = livePnl >= 0 ? "#3B82F6" : "#f93d3d";
              const acct       = (propAccounts||[]).find(a=>(a.bets||[]).some(b=>b.predId===bet.predId));
              return (
                 <div key={i} style={{padding:"8px 14px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                     <div style={{flex:1,minWidth:0}}>
                       <div style={{color:"#c8dae8",fontSize:11,fontWeight:600,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{bet.title||bet.predId}</div>
                       <div style={{display:"flex",gap:5,marginTop:2,alignItems:"center"}}>
                         <span style={{color:bet.pos==="YES"?"#22C55E":"#f93d3d",fontSize:9,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{bet.pos}</span>
                         <span style={{color:"rgba(255,255,255,0.25)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>${(bet.stake||0).toFixed(2)}</span>
                         {acct?.funded && <span style={{color:"#F4C430",fontSize:8,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>FUNDED</span>}
                         {isResolving && <span style={{color:"#00E5FF",fontSize:8,fontWeight:700,fontFamily:"'Inter',sans-serif",letterSpacing:0.5,animation:"pulse 1s infinite"}}>⏳ RESOLVING</span>}
                       </div>
                     </div>
                     <div style={{textAlign:"right",flexShrink:0}}>
                       <div style={{color:pnlC,fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{livePnl>=0?"+":"-"}${Math.abs(livePnl).toFixed(2)}</div>
                       <div style={{color:"rgba(255,255,255,0.25)",fontSize:8,fontFamily:"'Inter',sans-serif",marginTop:1}}>{bet.pos==="YES" ? Math.round(currYesPct) : Math.round(100-currYesPct)}¢</div>
                     </div>
                   </div>
                   {isResolving ? (
                     <div style={{width:"100%",marginTop:4,padding:"4px 0",color:"rgba(0,229,255,0.7)",fontSize:9,fontWeight:600,fontFamily:"'Inter',sans-serif",letterSpacing:0.5}}>
                       ⏳ Awaiting settlement…
                     </div>
                   ) : (
                     <button onClick={()=>setSellSheet({bet,market,acctId:acct?.id})} style={{background:"none",border:"none",padding:"3px 0",color:"rgba(249,61,61,0.7)",fontSize:9,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:0.3}}>
                       Sell · ${sellValue.toFixed(2)} →
                     </button>
                   )}
                 </div>
              );
            })}
          </div>
        )
      )}

      {/* Closed positions */}
      {posTab==="closed" && (
        closedPropBets.length===0 ? (
          <div style={{padding:"20px 14px",textAlign:"center",color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>No closed positions</div>
        ) : (
          <div style={{maxHeight:260,overflowY:"auto"}}>
            {closedPropBets.slice(-8).reverse().map((bet,i) => {
              const pnl  = bet.pnlDelta || 0;
              const pnlC = bet.won ? "#3B82F6" : "#f93d3d";
              return (
                <div key={i} style={{padding:"9px 14px",borderBottom:"1px solid rgba(255,255,255,0.04)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:"rgba(255,255,255,0.42)",fontSize:11,fontWeight:600,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{bet.title||bet.predId}</div>
                    <div style={{display:"flex",gap:5,marginTop:2,alignItems:"center"}}>
                      <span style={{color:"rgba(255,255,255,0.3)",fontSize:9,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{bet.pos}</span>
                      <span style={{color:"rgba(255,255,255,0.2)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>${(bet.stake||0).toFixed(2)}</span>
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{color:pnlC,fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{bet.won?"+":"-"}${Math.abs(pnl).toFixed(2)}</div>
                    <div style={{color:pnlC,fontSize:8,fontFamily:"'Inter',sans-serif",marginTop:1,opacity:0.7}}>{bet.soldEarly?"SOLD":bet.won?"WON":"LOST"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      </div>
      }
      {/* end flex tab content */}
    </div>

    {sellSheet && (
      <InlineSellView
        bet={sellSheet.bet}
        market={sellSheet.market}
        acctId={sellSheet.acctId}
        propAccounts={propAccounts}
        onSellBet={onSellBet}
        onBack={()=>setSellSheet(null)}
        onClose={onClose}
      />
    )}
    </>
  );
}


function Feed({
votes, onVote, following, onFollow, balance, watchlist, onToggleWatch, onOpenWallet, onOpenPropFirm, propAccounts=[], maxBetSetting=100, onSellBet, showPnlOverlay=false }) {
  const ALL_PREDS = usePredictions();
  const [mode, setMode] = useState("foryou");
  const [showFomo, setShowFomo] = useState(false);
  const [showPnlDropdown, setShowPnlDropdown] = useState(false);

  // Live P&L vars — computed at render time for HUD and dropdown
  const openPropBets = (propAccounts||[]).flatMap(a=>(a.bets||[]).filter(b=>!b.resolved));
  // Live P&L = resolved pnlDelta + unrealised from open bets at current market price
  const resolvedPnl  = (propAccounts||[]).flatMap(a=>a.bets||[]).filter(b=>b.resolved).reduce((s,b)=>s+(b.pnlDelta||0),0);
  const unrealisedPnl = openPropBets.reduce((s,bet)=>{
    const market    = ALL_PREDS.find(p=>String(p.id)===String(bet.predId)||String(p.polyId)===String(bet.predId));
    const endMs     = market?.endDate ? new Date(market.endDate).getTime()
                    : bet.endDate     ? new Date(bet.endDate).getTime() : 0;
    const resolving = endMs > 0 && endMs < Date.now();
    const marketGone = !market;
    const shouldFreeze = resolving || marketGone;
    // Priority: lastKnownPct (stored before reset) > live market > entryPct
    const currPct   = shouldFreeze
      ? (bet.lastKnownPct ?? bet.entryPct ?? 50)
      : (market.yesPct ?? bet.entryPct ?? 50);
    const currPrice = bet.pos==="YES" ? currPct/100 : (100-currPct)/100;
    const shares    = bet.shares>0 ? bet.shares : (bet.stake/Math.max(0.01,bet.sharePrice||0.5));
    return s + (shares*currPrice - bet.stake);
  }, 0);
  const propPnl = parseFloat((resolvedPnl + unrealisedPnl).toFixed(2));
  // openPropBets includes resolving bets (resolved:false) — count stays accurate during settlement
  const openCount    = openPropBets.length;
  const pnlColor     = propPnl >= 0 ? "#22C55E" : "#f93d3d";
  const scrollRef = useRef(null);
  const feed = useMemo(()=>buildFeed(mode,following,ALL_PREDS),[mode,following,ALL_PREDS]);
  const hasPropAccount = (propAccounts||[]).length > 0;

  // Show FOMO banner — only if no prop account and not shown in last 10 min
  useEffect(()=>{
    if(hasPropAccount) return;
    const lastShown = parseInt(safeGet("propFomoLastShown", "0") || "0");
    const tenMin = 10 * 60 * 1000;
    if(Date.now() - lastShown < tenMin) return;
    const t = setTimeout(()=>setShowFomo(true), 3000);
    return ()=>clearTimeout(t);
  },[hasPropAccount]);

  // Reset scroll position when tab changes
  useEffect(()=>{
    if(scrollRef.current) scrollRef.current.scrollTop = 0;
  },[mode]);

  // Track which card is in view via IntersectionObserver on dots
  const [visIdx, setVisIdx] = useState(0);
  useEffect(()=>{
    const container = scrollRef.current;
    if(!container) return;
    const onScroll = ()=>{
      const h = container.clientHeight;
      const idx = Math.round(container.scrollTop / h);
      setVisIdx(idx);
    };
    container.addEventListener("scroll", onScroll, {passive:true});
    return ()=>container.removeEventListener("scroll", onScroll);
  },[feed]);

  return (
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>

      {/* ── TOP HUD — Polymarket style ── */}
      <div style={{position:"absolute",top:0,left:0,right:0,zIndex:20,pointerEvents:"none",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"18px 12px 0",background:"linear-gradient(to bottom,rgba(7,15,30,0.7) 0%,transparent 100%)"}}>
        {/* Polymarket-style category pill tabs */}
        <div style={{display:"flex",alignItems:"center",gap:4,pointerEvents:"all",background:"rgba(10,22,40,0.85)",backdropFilter:"blur(20px)",borderRadius:22,padding:"4px 5px",border:"1px solid rgba(30,58,95,0.8)",boxShadow:"0 4px 20px rgba(0,0,0,0.5)"}}>
          {[["foryou","For You"],["trending","Live"],["following","Following"]].map(([id,label],i)=>(
            <button key={id} onClick={()=>setMode(id)} style={{
              background:mode===id?"#3B82F6":"none",
              border:"none",padding:"5px 13px",cursor:"pointer",
              borderRadius:18,
              transition:"all 0.2s cubic-bezier(0.4,0,0.2,1)",
              display:"flex",alignItems:"center",gap:5,
              boxShadow:mode===id?"0 2px 8px rgba(59,130,246,0.4)":"none",
            }}>
              {id==="trending" && <div style={{width:5,height:5,borderRadius:"50%",background:mode===id?"#fff":"#EF4444",boxShadow:mode!==id?"0 0 5px #EF4444":"none",flexShrink:0}}/>}
              <span style={{
                color:mode===id?"#FFFFFF":"rgba(255,255,255,0.5)",
                fontSize:12,fontWeight:mode===id?700:500,
                fontFamily:"'Inter',sans-serif",letterSpacing:0.1,
                whiteSpace:"nowrap",
              }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Left gradient — makes P&L readable over any card image */}
      {showPnlOverlay && <div style={{position:"absolute",top:0,bottom:0,left:0,width:90,zIndex:15,pointerEvents:"none",background:"linear-gradient(to right,rgba(0,0,0,0.45) 0%,transparent 100%)"}}/>}
      {/* ── LIVE P&L — home tab only, integrated into left gradient ── */}
      {showPnlOverlay && <>
      
      <div style={{position:"absolute",top:"50%",left:0,transform:"translateY(-50%)",zIndex:300,pointerEvents:"all"}}>
        {/* P&L trigger */}
        <button onClick={()=>setShowPnlDropdown(v=>!v)}
          style={{
            background:"none",border:"none",cursor:"pointer",padding:"8px 14px 8px 12px",
            display:"flex",alignItems:"center",gap:8,
            transform: showPnlDropdown ? "translateX(calc(-100% - 10px))" : "translateX(0)",
            transition:"transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s",
            opacity: showPnlDropdown ? 0 : 1,
            pointerEvents: showPnlDropdown ? "none" : "all",
          }}>
          {/* Colour indicator bar */}
          <div style={{width:3,height:32,borderRadius:2,background:propPnl===0?"rgba(255,255,255,0.2)":pnlColor,boxShadow:propPnl!==0?`0 0 8px ${pnlColor}88`:"none",flexShrink:0}}/>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start"}}>
            <span style={{
              color: propPnl===0 ? "rgba(255,255,255,0.5)" : pnlColor,
              fontSize:15,fontWeight:800,fontFamily:"'Inter',sans-serif",lineHeight:1,
              textShadow:"0 1px 12px rgba(0,0,0,0.9)",letterSpacing:-0.3,
            }}>
              {propPnl===0 ? "$0.00" : (propPnl>0?"+":"-")+"$"+Math.abs(propPnl).toFixed(2)}
            </span>
            <span style={{
              color:"rgba(255,255,255,0.35)",fontSize:9,fontFamily:"'Inter',sans-serif",
              letterSpacing:1,marginTop:3,textShadow:"0 1px 8px rgba(0,0,0,0.9)",
            }}>
              {openCount > 0 ? openCount+" OPEN →" : "NO POSITIONS →"}
            </span>
          </div>
        </button>

      </div>

      {/* Dropdown — fills the unused space left of action buttons */}
      {showPnlDropdown && (
        <>
          <style>{`@keyframes pnlFadeIn{from{opacity:0}to{opacity:1}}`}</style>
          <div style={{
            position:"absolute",
            top:"38%", bottom:"32%",
            left:16, right:72,
            zIndex:300,
            animation:"pnlFadeIn 0.2s ease-out",
            pointerEvents:"all",
            display:"flex",flexDirection:"column",
          }}>
            <PnlDropdown
              propAccounts={propAccounts} votes={votes} ALL_PREDS={ALL_PREDS}
              propPnl={propPnl} pnlColor={pnlColor}
              onClose={()=>setShowPnlDropdown(false)}
              onOpenPropFirm={onOpenPropFirm}
              onSellBet={onSellBet}
            />
          </div>
        </>
      )}
      </>}

      {/* ── TRUE TIKTOK SNAP SCROLL ── */}
      <div
        ref={scrollRef}
        style={{
          flex:1,
          overflowY:"scroll",
          scrollSnapType:"y mandatory",
          WebkitOverflowScrolling:"touch",
          scrollbarWidth:"none",
          msOverflowStyle:"none",
        }}
      >
        {feed.map((item, i) => (
          <div key={i} style={{
            height:"100%",
            minHeight:"100%",
            width:"100%",
            scrollSnapAlign:"start",
            scrollSnapStop:"always",
            flexShrink:0,
            position:"relative",
            overflow:"hidden",
          }}>
            {item.type==="pred" && <PredCard pred={item.data} userVote={votes[item.data.id]?.pos} onVote={onVote} following={following.includes(item.data.creator.handle)} onFollow={onFollow} balance={balance} isWatched={watchlist.includes(item.data.id)} onToggleWatch={onToggleWatch} propAccounts={propAccounts} maxBetSetting={maxBetSetting}/>}
            {item.type==="ad" && <AdCard data={item.data} onOpenPropFirm={onOpenPropFirm} onSkip={()=>{
              if(scrollRef.current){
                scrollRef.current.scrollBy({top: scrollRef.current.clientHeight, behavior:"smooth"});
              }
            }}/>}
            {item.type==="empty" && (
              <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,background:"#0A1628",padding:24}}>
                <div style={{fontSize:56,opacity:0.2}}>👥</div>
                <h3 style={{color:"#FFFFFF",fontFamily:"'Inter',sans-serif",fontSize:20,fontWeight:800,textAlign:"center"}}>Follow creators<br/>to see their predictions</h3>
                <button onClick={()=>setMode("foryou")} style={{background:"#3B82F6",border:"none",borderRadius:99,color:"#fff",fontSize:14,fontWeight:800,padding:"12px 32px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Browse For You</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Scroll progress dots */}
      <div style={{position:"absolute",right:5,top:"50%",transform:"translateY(-50%)",display:"flex",flexDirection:"column",gap:5,zIndex:15,pointerEvents:"none"}}>
        {feed.slice(0,14).map((_,i)=>(
          <div key={i} style={{width:i===visIdx?3:2,height:i===visIdx?20:4,borderRadius:99,background:i===visIdx?"#fff":"rgba(255,255,255,0.2)",transition:"all 0.3s"}}/>
        ))}
      </div>

      {/* Prop Firm FOMO popup */}
      {showFomo && <PropFomoBanner onOpenPropFirm={onOpenPropFirm||(() =>{})} onClose={()=>{ safeSet("propFomoLastShown", Date.now()); setShowFomo(false); }}/>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME
// ─────────────────────────────────────────────────────────────────────────────
const CATS_LIST=[{id:"ALL",...CATEGORY_META.ALL,label:"All"},...Object.entries(CATEGORY_META).filter(([k])=>k!=="ALL").map(([id,v])=>({id,label:id.charAt(0)+id.slice(1).toLowerCase(),...v}))];

function HomeCard({
  pred, userVote, onVote, following, onFollow, balance, onOpenComments, onOpenCreator, quickBetPresets=[1,5,10,25], maxBetSetting=100 }) {
  const t = useTheme();
  const [local,setLocal]=useState(pred.yesPct);
  const [showBet,setShowBet]=useState(null);
  const [showConfirm,setShowConfirm]=useState(null);
  const [showDetail,setShowDetail]=useState(false);
  const [liked,setLiked]=useState(false);
  const [copied,setCopied]=useState(false);
  const no=100-local;

  const handleBetConfirm=(amount, thesis, shares, sharePrice)=>{
    setShowBet(null);
    onVote(pred.id,showBet,amount,shares,sharePrice);
    setLocal(p=>showBet==="YES"?Math.min(99,p+1):Math.max(1,p-1));
    setShowConfirm({pos:showBet,amount,betId:"BET-"+(pred?.id||"")+"-"+(Date.now().toString(36).toUpperCase().slice(-6))});
  };

  const handleShare=()=>{
    const msg="Check out this prediction: \""+(pred.title)+"\" — "+(local)+"% YES on PredictSwipe";
    navigator.share?navigator.share({title:"PredictSwipe",text:msg}):navigator.clipboard?.writeText(msg);
  };

  return (
    <div style={{background:t.bgCard,borderRadius:16,overflow:"hidden",border:"1px solid "+(pred.is5min?(pred.accent||"#F7931A")+"66":"#1E3A5F"),position:"relative",boxShadow:pred.is5min?"0 0 12px "+(pred.accent||"#F7931A")+"22":"0 2px 16px rgba(0,0,0,0.3)"}}>
      {/* Image banner */}
      <div style={{position:"relative",height:175}}>
        <PredImage pred={pred} style={{width:"100%",height:"100%"}}/>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to top, rgba(10,22,40,0.96) 0%, rgba(10,22,40,0.5) 45%, transparent 100%)"}}/>
        {/* Top badges */}
        <div style={{position:"absolute",top:10,left:10,right:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(7,15,30,0.75)",backdropFilter:"blur(8px)",borderRadius:20,padding:"4px 10px",border:"1px solid rgba(30,58,95,0.6)"}}>
            <span style={{fontSize:10}}>{CATEGORY_META[pred.category]?.icon}</span>
            <span style={{color:"rgba(255,255,255,0.8)",fontSize:10,fontFamily:"'Inter',sans-serif",letterSpacing:0.8,fontWeight:600}}>{pred.category}</span>
          </div>
          {pred.hot&&<div style={{background:"rgba(244,196,48,0.15)",border:"1px solid rgba(244,196,48,0.3)",borderRadius:20,padding:"4px 10px",display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:10}}>🔥</span><span style={{color:"#F4C430",fontSize:10,fontFamily:"'Inter',sans-serif",fontWeight:700}}>HOT</span></div>}
        </div>
        {/* Bottom stats on image */}
        <div style={{position:"absolute",bottom:10,left:10,right:10}}>
          <h3 style={{color:"#fff",fontSize:14,fontWeight:800,lineHeight:1.3,fontFamily:"'Inter',sans-serif",marginBottom:8,textShadow:"0 1px 4px rgba(0,0,0,0.8)"}}>{pred.title}</h3>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{color:"#22C55E",fontSize:13,fontWeight:800,fontFamily:"'Inter',sans-serif"}}>{local}%</span>
              <span style={{color:"rgba(255,255,255,0.4)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>chance</span>
              <Sparkline data={pred.chartData} color="#22C55E" width={36} height={14}/>
            </div>
            <button onClick={()=>setShowDetail(true)} style={{background:"rgba(59,130,246,0.2)",border:"1px solid rgba(59,130,246,0.4)",borderRadius:8,color:"#93C5FD",fontSize:10,fontWeight:700,padding:"4px 10px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Details ›</button>
          </div>
        </div>
      </div>
      {/* Card body */}
      <div style={{padding:"12px 12px 14px"}}>
        {/* Creator row */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div onClick={()=>onOpenCreator&&onOpenCreator(pred.creator.handle)} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer"}}>
            <Avatar emoji={pred.creator.avatar} color={pred.creator.color} size={26}/>
            <div style={{display:"flex",alignItems:"center",gap:3}}>
              <span style={{color:t.textSub,fontSize:11,fontWeight:600,fontFamily:"'Inter',sans-serif"}}>@{pred.creator.handle}</span>
              {pred.creator.verified&&<span style={{color:"#60A5FA",fontSize:10}}>✓</span>}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{color:t.textMuted,fontSize:11,fontFamily:"'Inter',sans-serif"}}>{pred.pool}</span>
            <button onClick={()=>onFollow(pred.creator.handle)} style={{background:"transparent",border:"1px solid #1E3A5F",borderRadius:14,color:following?"rgba(255,255,255,0.4)":"rgba(255,255,255,0.7)",fontSize:10,padding:"3px 10px",cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.2s"}}>
              {following?"Following":"Follow"}
            </button>
          </div>
        </div>
        {/* YES/NO bet buttons — Polymarket style */}
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          <YesNoBtn label="YES" pct={local} voted={userVote?.pos} onClick={()=>!userVote&&setShowBet("YES")} size="sm"/>
          <YesNoBtn label="NO" pct={no} voted={userVote?.pos} onClick={()=>!userVote&&setShowBet("NO")} size="sm"/>
        </div>
        {/* Social row */}
        <div style={{display:"flex",gap:0,borderTop:"1px solid rgba(30,58,95,0.5)",paddingTop:8}}>
          {[
            {icon:liked?"♥":"♡", val:liked?addK(parseNum(pred.likes)+1):pred.likes, action:()=>setLiked(l=>!l), color:liked?"#EF4444":"rgba(255,255,255,0.4)"},
            {icon:"◎", val:pred.comments, action:()=>onOpenComments(pred), color:"rgba(255,255,255,0.4)"},
            {icon:"↗", val:pred.shares, action:handleShare, color:"rgba(255,255,255,0.4)"},
          ].map(({icon,val,action,color})=>(
            <button key={icon} onClick={action} style={{flex:1,background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4,padding:"5px 0"}}>
              <span style={{fontSize:14,color}}>{icon}</span>
              <span style={{color:"rgba(255,255,255,0.35)",fontSize:10,fontFamily:"'Inter',sans-serif",fontWeight:500}}>{val}</span>
            </button>
          ))}
        </div>
      </div>
      {showBet&&<BetModal pred={{...pred,yesPct:local}} position={showBet} balance={balance} onConfirm={handleBetConfirm} onClose={()=>setShowBet(null)} quickBetPresets={quickBetPresets} maxBetSetting={maxBetSetting}/>}
      {showConfirm&&<BetConfirmed position={showConfirm.pos} amount={showConfirm.amount} betId={showConfirm.betId} onDone={()=>setShowConfirm(null)}/>}
      {showDetail&&<DetailSheet pred={{...pred,yesPct:local}} onClose={()=>setShowDetail(false)}/>}
    </div>
  );
}

function PropFomoBanner({ onOpenPropFirm, onClose }) {
  const [vis, setVis] = useState(false);
  const [endDate] = useState(()=>{
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toLocaleDateString("en-AU",{day:"numeric",month:"short"});
  });
  useEffect(()=>{ requestAnimationFrame(()=>setVis(true)); },[]);
  const close = ()=>{ setVis(false); setTimeout(onClose, 350); };

  return (
    <div
      onClick={close}
      style={{position:"fixed",inset:0,zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center",background:vis?"rgba(0,0,0,0.72)":"transparent",backdropFilter:vis?"blur(4px)":"none",transition:"background 0.35s,backdrop-filter 0.35s"}}
    >
      <div
        onClick={e=>e.stopPropagation()}
        style={{width:"100%",maxWidth:430,background:"#080D1C",borderRadius:"24px 24px 0 0",border:"1px solid #152033",padding:"0 0 36px",transform:vis?"translateY(0)":"translateY(100%)",transition:"transform 0.42s cubic-bezier(0.22,1,0.36,1)",overflow:"hidden"}}
      >
        {/* Panel header */}
        <div style={{background:"#0C1930",padding:"16px 22px 18px",borderBottom:"1px solid #152033"}}>
          {/* Drag handle */}
          <div style={{width:36,height:3,background:"rgba(255,255,255,0.1)",borderRadius:99,margin:"0 auto 16px"}}/>

          {/* Promo pill */}
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(201,162,39,0.1)",border:"1px solid rgba(201,162,39,0.22)",borderRadius:99,padding:"4px 12px",marginBottom:14}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:"#C9A227"}}/>
            <span style={{color:"#C9A227",fontSize:10,fontWeight:700,fontFamily:"'Inter',sans-serif",letterSpacing:0.8}}>Promotional pricing — ends {endDate}</span>
          </div>

          {/* Headline */}
          <div style={{fontSize:26,fontWeight:900,fontFamily:"'Inter',sans-serif",lineHeight:1.1,marginBottom:2}}>
            <span style={{color:"#ffffff"}}>Trade with </span><span style={{color:"#3B82F6"}}>$10,000</span>
          </div>
          <div style={{color:"rgba(255,255,255,0.5)",fontSize:13,fontFamily:"'Inter',sans-serif",fontWeight:500}}>
            Start from $49
          </div>
        </div>

        {/* Body */}
        <div style={{padding:"20px 22px 0"}}>

          {/* Price block */}
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:18}}>
            <div>
              <div style={{color:"#5C6B7A",fontSize:16,fontFamily:"'Inter',sans-serif",fontWeight:600,textDecoration:"line-through",lineHeight:1}}>$49</div>
              <div style={{color:"#E6EDF3",fontSize:36,fontWeight:900,fontFamily:"'Inter',sans-serif",lineHeight:1.1}}>$39</div>
            </div>
            <div style={{flex:1}}>
              <div style={{background:"rgba(201,162,39,0.1)",border:"1px solid rgba(201,162,39,0.2)",borderRadius:8,padding:"6px 12px",display:"inline-block"}}>
                <span style={{color:"#C9A227",fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif",letterSpacing:0.5}}>20% Promotional Discount</span>
              </div>
            </div>
          </div>

          {/* Minimal info line */}
          <div style={{color:"rgba(255,255,255,0.28)",fontSize:11,fontFamily:"'Inter',sans-serif",marginBottom:22,lineHeight:1.5}}>
            847 active challengers · 3 funded today · 90% profit split
          </div>

          {/* CTA */}
          <button
            onClick={()=>{ close(); onOpenPropFirm(); }}
            style={{width:"100%",height:52,borderRadius:12,background:"#1D4ED8",border:"none",color:"#ffffff",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:0.3,transition:"opacity 0.2s"}}
          >
            Start Funding Challenge →
          </button>

          {/* Dismiss */}
          <button
            onClick={close}
            style={{width:"100%",background:"none",border:"none",color:"rgba(255,255,255,0.2)",fontSize:11,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:1,marginTop:12,padding:"4px 0"}}
          >
            NOT NOW
          </button>
        </div>
      </div>
    </div>
  );
}

function HomePage({ votes, onVote, following, onFollow, balance, onOpenCreator, onOpenParlay, onOpenCategory, quickBetPresets=[], maxBetSetting=100, propAccounts=[], onOpenPropFirm }) {
  const ALL_PREDS = usePredictions();
  const [cat, setCat] = useState("ALL");
  const [view, setView] = useState("trending"); // "trending"|"discover"|"following"
  const [openComments, setOpenComments] = useState(null);
  const [showFomoBanner, setShowFomoBanner] = useState(false);
  // Show prop FOMO banner — throttled to once per 10 min, skip if has prop account
  useEffect(()=>{
    const hasProp = propAccounts && (propAccounts||[]).length > 0;
    if(hasProp) return;
    const lastShown = parseInt(safeGet("propFomoLastShown", "0") || "0");
    if(Date.now() - lastShown < 10 * 60 * 1000) return;
    const t = setTimeout(()=>setShowFomoBanner(true), 4000);
    return ()=>clearTimeout(t);
  },[]);

  const filtered = cat==="ALL" ? ALL_PREDS : ALL_PREDS.filter(p=>p.category===cat);
  const discover = [...ALL_PREDS].sort((a,b)=>a.poolRaw-b.poolRaw);
  const followingFeed = ALL_PREDS.filter(p=>following.includes(p.creator.handle));

  // Trending hashtags with live drift
  const [hashtagPcts, setHashtagPcts] = useState([72,58,41,89,63,35,77,50]);
  useEffect(()=>{
    const id = setInterval(()=>{
      setHashtagPcts(p=>p.map(v=>Math.min(99,Math.max(1,v+(Math.random()-0.48)*3))));
    }, 4200);
    return ()=>clearInterval(id);
  },[]);
  const hashtags = [
    ["#Bitcoin",0,"CRYPTO"],["#FedRate",1,"FINANCE"],["#GPT5",2,"TECH"],["#WorldCup",3,"SPORTS"],
    ["#Election",4,"POLITICS"],["#AlienUAP",5,"CONSPIRACY"],["#ETH",6,"CRYPTO"],["#NVIDIA",7,"TECH"],
  ];

  // TikTok-style smooth scroll ref
  const scrollRef = useRef(null);

  const cards = view==="trending" ? filtered : view==="discover" ? discover : followingFeed;

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:"#0A1628",position:"relative"}}>
      {/* ── STICKY HEADER — Polymarket style ── */}
      <div style={{background:"#070F1E",position:"relative",zIndex:10,flexShrink:0}}>
        {/* Top logo + auth bar */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px 8px",borderBottom:"1px solid #1E3A5F"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:30,height:30,background:"linear-gradient(135deg,#3B82F6,#1D6ED8)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,boxShadow:"0 2px 12px rgba(59,130,246,0.5)"}}>⚡</div>
            <span style={{color:"#FFFFFF",fontWeight:800,fontSize:16,fontFamily:"'Inter',sans-serif",letterSpacing:-0.5}}>PredictSwipe</span>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <button onClick={()=>{}} style={{background:"transparent",border:"1px solid #1E3A5F",borderRadius:8,color:"rgba(255,255,255,0.7)",fontSize:12,fontWeight:600,padding:"5px 12px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Log In</button>
            <button onClick={()=>{}} style={{background:"#3B82F6",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:700,padding:"5px 12px",cursor:"pointer",fontFamily:"'Inter',sans-serif",boxShadow:"0 2px 8px rgba(59,130,246,0.4)"}}>Sign Up</button>
          </div>
        </div>
        {/* Polymarket-style tab bar: LIVE | All | New | Politics | Sports */}
        <div
          style={{display:"flex",gap:0,overflowX:"auto",padding:"0 10px",scrollbarWidth:"none",WebkitOverflowScrolling:"touch",msOverflowStyle:"none",borderBottom:"1px solid #1E3A5F"}}
          onTouchStart={e=>e.stopPropagation()}
          onTouchMove={e=>e.stopPropagation()}
        >
          {/* LIVE tab */}
          <button onClick={()=>setView("trending")} style={{flexShrink:0,background:"none",border:"none",padding:"10px 12px 8px",cursor:"pointer",position:"relative",display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:"#EF4444",boxShadow:"0 0 6px #EF4444",flexShrink:0}}/>
            <span style={{color:view==="trending"?"#FFFFFF":"rgba(255,255,255,0.45)",fontSize:13,fontWeight:view==="trending"?700:500,fontFamily:"'Inter',sans-serif"}}>LIVE</span>
            {view==="trending" && <div style={{position:"absolute",bottom:0,left:"15%",right:"15%",height:2,borderRadius:"2px 2px 0 0",background:"#3B82F6"}}/>}
          </button>
          {/* Category tabs */}
          {[["trending","All"],["discover","New"],["following","Following"],...CATS_LIST.slice(1,5).map(c=>[c.id,c.label])].map(([id,label],i)=>{
            const active = i===0?view==="trending":i===1?view==="discover":i===2?view==="following":cat===id;
            const onClick = i===0?()=>setView("trending"):i===1?()=>setView("discover"):i===2?()=>setView("following"):()=>{setView("trending");setCat(id);};
            return (
              <button key={id+i} onClick={onClick} style={{flexShrink:0,background:"none",border:"none",padding:"10px 12px 8px",cursor:"pointer",position:"relative"}}>
                <span style={{color:active?"#FFFFFF":"rgba(255,255,255,0.45)",fontSize:13,fontWeight:active?700:500,fontFamily:"'Inter',sans-serif"}}>{label}</span>
                {active && <div style={{position:"absolute",bottom:0,left:"15%",right:"15%",height:2,borderRadius:"2px 2px 0 0",background:"#3B82F6"}}/>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT — smooth TikTok-style ── */}
      <div ref={scrollRef} style={{flex:1,overflowY:"scroll",scrollSnapType:"y mandatory",scrollBehavior:"smooth",WebkitOverflowScrolling:"touch"}}>

        {/* ── TRENDING & DISCOVER share same card layout ── */}
        {(view==="trending"||view==="discover") && (
          <div style={{padding:"0 0 100px"}}>
            {/* Prop Firm CTA — BIG button */}
            <div style={{padding:"12px 14px 0"}}>
              <button onClick={onOpenPropFirm} style={{width:"100%",background:"linear-gradient(135deg,#1a1500,#1f1800)",border:"1px solid rgba(244,196,48,0.25)",borderRadius:18,padding:"16px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,position:"relative",overflow:"hidden",textAlign:"left",animation:"propGlow 6s ease-in-out infinite"}}>
                <div style={{position:"absolute",top:0,right:0,width:120,height:"100%",background:"radial-gradient(ellipse at 100% 50%,rgba(244,196,48,0.1),transparent 70%)"}}/>
                <div style={{width:52,height:52,borderRadius:16,background:"rgba(244,196,48,0.15)",border:"1px solid rgba(244,196,48,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>
                  {(propAccounts||[]).some(a=>a.funded)?"💰":(propAccounts||[]).length>0?"📊":"🏦"}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:"#F4C430",fontSize:9,fontFamily:"'Inter',sans-serif",fontWeight:700,letterSpacing:1,marginBottom:3}}>WORLD'S FIRST PREDICTION PROP FIRM</div>
                  <div style={{color:"#FFFFFF",fontSize:15,fontWeight:900,fontFamily:"'Inter',sans-serif",lineHeight:1.2}}>
                    {(propAccounts||[]).length>0 ? ((propAccounts||[]).length)+" Active Account"+((propAccounts||[]).length>1?"s":"")+" · View Dashboard" : "Get Funded — Keep 90% of Profits"}
                  </div>
                  <div style={{color:"rgba(255,255,255,0.3)",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:3}}>
                    {(propAccounts||[]).length>0 ? ((propAccounts||[]).filter(a=>a.funded).length)+" funded · Copy trader ready" : "From $49 · Up to $10K account · Beta open"}
                  </div>
                </div>
                <div style={{background:"#F4C430",borderRadius:99,padding:"8px 14px",flexShrink:0}}>
                  <span style={{color:"#0F1720",fontSize:12,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{(propAccounts||[]).length>0?"VIEW":"JOIN"}</span>
                </div>
              </button>
            </div>

            {view==="trending" && (
              <>
                <div style={{padding:"12px 14px 0"}}>
                  <DailyChallengeBanner onBet={(pred,pos)=>{}} />
                </div>
                {/* Trending hashtags */}
                <div style={{padding:"4px 14px 0"}}>
                  <SectionLabel>🔥 TRENDING TOPICS</SectionLabel>
                  <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10,scrollbarWidth:"none"}}>
                    {hashtags.map(([tag,idx,catId])=>{
                      const pct = hashtagPcts[idx];
                      const meta = CATEGORY_META[catId]||CATEGORY_META.CRYPTO;
                      return (
                        <div key={tag} style={{flexShrink:0,background:"#0F2040",border:"1px solid "+(meta.color)+"22",borderRadius:14,padding:"10px 12px",minWidth:88,cursor:"pointer"}}>
                          <div style={{color:"#FFFFFF",fontSize:11,fontWeight:800,fontFamily:"'Inter',sans-serif",marginBottom:4}}>{tag}</div>
                          <div style={{height:3,background:"#1A2D4A",borderRadius:99,overflow:"hidden",marginBottom:4}}>
                            <div style={{height:"100%",width:(pct)+"%",background:meta.color,borderRadius:99,transition:"width 0.6s ease"}}/>
                          </div>
                          <div style={{color:meta.color,fontSize:9,fontFamily:"'Inter',sans-serif",fontWeight:700}}>{Math.round(pct)}% YES</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {view==="discover" && (
              <div style={{padding:"12px 14px 0"}}>
                <SectionLabel>FEATURED CREATORS</SectionLabel>
                <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:10,scrollbarWidth:"none"}}>
                  {Object.values(CREATOR_PROFILES).map(c=>(
                    <div key={c.handle} onClick={()=>onOpenCreator&&onOpenCreator(c.handle)} style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:"pointer",width:68}}>
                      <div style={{width:54,height:54,borderRadius:"50%",background:c.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,border:"2px solid rgba(255,255,255,0.1)"}}>{c.avatar}</div>
                      <div style={{textAlign:"center"}}>
                        <div style={{color:"#FFFFFF",fontSize:9,fontWeight:700,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:68}}>@{c.handle}</div>
                        <div style={{color:"#3B82F6",fontSize:8,fontFamily:"'Inter',sans-serif",marginTop:1}}>{c.accuracy}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <SectionLabel>HIDDEN GEMS · LOW POOL</SectionLabel>
              </div>
            )}

            {/* Cards — smooth scroll snap */}
            <div style={{padding:"8px 14px 0"}}>
              {cards.map((pred,i)=>(
                <div key={pred.id} style={{scrollSnapAlign:"start",marginBottom:14}}>
                  <HomeCard pred={pred} userVote={votes[pred.id]} onVote={onVote} following={following.includes(pred.creator.handle)} onFollow={onFollow} balance={balance} onOpenComments={setOpenComments} onOpenCreator={onOpenCreator} quickBetPresets={quickBetPresets} maxBetSetting={maxBetSetting}/>
                </div>
              ))}
              {cards.length===0 && (
                <div style={{textAlign:"center",padding:"60px 0",color:"rgba(255,255,255,0.42)",fontFamily:"'Inter',sans-serif"}}>
                  <div style={{fontSize:48,marginBottom:16,opacity:0.3}}>👥</div>
                  <div style={{color:"rgba(255,255,255,0.32)",fontSize:14}}>Follow creators to see their bets here</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── FOLLOWING TAB ── */}
        {view==="following" && (
          <div style={{padding:"0 0 100px"}}>
            {followingFeed.length===0 ? (
              <div style={{textAlign:"center",padding:"80px 24px 0"}}>
                <div style={{fontSize:56,marginBottom:16,opacity:0.2}}>👥</div>
                <div style={{color:"#FFFFFF",fontSize:18,fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:8}}>No one to follow yet</div>
                <div style={{color:"rgba(255,255,255,0.22)",fontSize:13,fontFamily:"'Inter',sans-serif",marginBottom:24}}>Follow creators to see their predictions here</div>
                <button onClick={()=>setView("discover")} style={{background:"#3B82F6",border:"none",borderRadius:99,color:"#fff",fontSize:14,fontWeight:800,padding:"12px 28px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Discover Creators →</button>
              </div>
            ) : (
              <div style={{padding:"8px 14px 0"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0 12px"}}>
                  <div style={{color:"#3B82F6",fontSize:10,fontFamily:"'Inter',sans-serif",fontWeight:700}}>{followingFeed.length} PREDICTIONS FROM PEOPLE YOU FOLLOW</div>
                </div>
                {followingFeed.map(pred=>(
                  <div key={pred.id} style={{scrollSnapAlign:"start",marginBottom:14}}>
                    <HomeCard pred={pred} userVote={votes[pred.id]} onVote={onVote} following={following.includes(pred.creator.handle)} onFollow={onFollow} balance={balance} onOpenComments={setOpenComments} onOpenCreator={onOpenCreator} quickBetPresets={quickBetPresets} maxBetSetting={maxBetSetting}/>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {openComments&&<div style={{position:"fixed",inset:0,zIndex:100,maxWidth:430,margin:"0 auto"}}><CommentsSheet pred={openComments} onClose={()=>setOpenComments(null)}/></div>}
      {showFomoBanner && <PropFomoBanner onOpenPropFirm={onOpenPropFirm||(() =>{})} onClose={()=>{ safeSet("propFomoLastShown", Date.now()); setShowFomoBanner(false); }}/>}
    </div>

  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH
// ─────────────────────────────────────────────────────────────────────────────
function SearchPage({
votes, onVote, balance, onOpenCreator }) {
  const ALL_PREDS = usePredictions();
  const [q,setQ]=useState("");
  const [active,setActive]=useState("ALL");
  const [detailPred, setDetailPred] = useState(null);
  const results=useMemo(()=>{
    const ql=q.toLowerCase();
    return ALL_PREDS.filter(p=>{
      const matchCat=active==="ALL"||p.category===active;
      const matchQ=!ql||p.title.toLowerCase().includes(ql)||p.category.toLowerCase().includes(ql)||p.creator.handle.toLowerCase().includes(ql);
      return matchCat&&matchQ;
    });
  },[q,active]);

  const trending=ALL_PREDS.filter(p=>p.hot).slice(0,3);

  return (
    <div style={{height:"100%",overflowY:"auto",background:"#0A1628"}}>
      <div style={{padding:"20px 16px 0",position:"sticky",top:0,background:"#0A1628",zIndex:10}}>
        <h2 style={{fontSize:20,fontWeight:900,color:"#FFFFFF",fontFamily:"'Inter',sans-serif",marginBottom:14}}>🔍 Search</h2>
        <div style={{position:"relative",marginBottom:12}}>
          <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:16,opacity:0.3}}>🔍</span>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search predictions, categories, creators..." style={{width:"100%",background:"#1A2D4A",border:"1px solid #1A2D4A",borderRadius:14,padding:"13px 14px 13px 40px",color:"#FFFFFF",fontSize:14,fontFamily:"'Inter',sans-serif",outline:"none"}}/>
          {q&&<button onClick={()=>setQ("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"rgba(255,255,255,0.32)",fontSize:18,cursor:"pointer"}}>✕</button>}
        </div>
        <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:12,scrollbarWidth:"none"}}>
          {CATS_LIST.map(c=>(
            <button key={c.id} onClick={()=>setActive(c.id)} style={{flexShrink:0,background:active===c.id?c.color:"#1A2D4A",border:"1px solid "+(active===c.id?c.color:"rgba(255,255,255,0.42)"),borderRadius:20,padding:"5px 12px",cursor:"pointer",color:active===c.id?"#000":"#6a8090",fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",gap:4,transition:"all 0.2s"}}>
              <span>{c.icon}</span>{c.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:"4px 16px 100px"}}>
        {!q&&active==="ALL"&&(
          <>
            <SectionLabel>🔥 TRENDING SEARCHES</SectionLabel>
            {["Bitcoin $150k","World Cup 2026","GPT-5 release","Alien disclosure","Fed rate cuts"].map(t=>(
              <button key={t} onClick={()=>setQ(t)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",background:"none",border:"none",cursor:"pointer",padding:"11px 0",borderBottom:"1px solid #0F2040"}}>
                <span style={{fontSize:14,opacity:0.4}}>🔥</span>
                <span style={{color:"rgba(255,255,255,0.72)",fontSize:14,fontFamily:"'Inter',sans-serif"}}>{t}</span>
              </button>
            ))}
            <div style={{height:20}}/>
            <SectionLabel>TOP CREATORS</SectionLabel>
            {[...new Map(ALL_PREDS.map(p=>[p.creator.handle,p.creator])).values()].map(c=>(
              <div key={c.handle} onClick={()=>onOpenCreator&&onOpenCreator(c.handle)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #0F2040",cursor:"pointer"}}>
                <Avatar emoji={c.avatar} color={c.color} size={42}/>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <span style={{color:"#FFFFFF",fontWeight:700,fontSize:14,fontFamily:"'Inter',sans-serif"}}>@{c.handle}</span>
                    {c.verified&&<span style={{color:"#00E5FF",fontSize:12}}>✓</span>}
                  </div>
                  <span style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>{c.name}</span>
                </div>
                <span style={{color:"rgba(255,255,255,0.42)",fontSize:16}}>›</span>
              </div>
            ))}
          </>
        )}

        {(q||active!=="ALL")&&(
          <>
            <div style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif",marginBottom:12,letterSpacing:1}}>{results.length} RESULT{results.length!==1?"S":""}</div>
            {results.length===0
              ? <div style={{textAlign:"center",padding:"40px 0",color:"rgba(255,255,255,0.42)",fontFamily:"'Inter',sans-serif",fontSize:13}}>No predictions found</div>
              : results.map(pred=>(
                <div key={pred.id} onClick={()=>setDetailPred(pred)} style={{background:"#0F2040",borderRadius:14,padding:"14px",marginBottom:10,display:"flex",gap:12,cursor:"pointer"}}>
                  <PredImage pred={pred} style={{width:64,height:64,borderRadius:10}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
                      <Badge color={CATEGORY_META[pred.category]?.color||"rgba(255,255,255,0.42)"}>{pred.category}</Badge>
              {pred.is5min && <Badge color={pred.accent||"#F7931A"}>5MIN ⚡</Badge>}
            {pred.is5min && pred.secsLeft != null && (
              <FiveMinBadge endDate={pred.endDate} secsLeft={pred.secsLeft}/>
            )}
                      {pred.hot&&<Badge color="#F4C430">HOT</Badge>}
                    </div>
                    <div style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif",lineHeight:1.3,marginBottom:6}}>{pred.title}</div>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <span style={{color:"#3B82F6",fontSize:11,fontFamily:"'Inter',sans-serif",fontWeight:700}}>{pred.yesPct}% YES</span>
                      <span style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>Pool: {pred.pool}</span>
                    </div>
                  </div>
                </div>
              ))
            }
          </>
        )}
      </div>
      {detailPred && <MarketDetailSheet pred={detailPred} votes={votes} onVote={onVote} balance={balance} onClose={()=>setDetailPred(null)}/>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────
function NotificationsPage({ liveNotifs=[], onMarkRead, setLiveNotifs,
  onClearAll }) {
  const t = useTheme();
  const [notifs,setNotifs]=useState(NOTIFICATIONS);
  // Merge live resolution notifs with static ones
  const allNotifs = [...liveNotifs, ...notifs];
  const unreadCount = allNotifs.filter(n=>!n.read).length;
  const [filter,setFilter]=useState("all"); // "all" | "unread" | "wins"
  const markRead=id=>{setNotifs(ns=>ns.map(n=>n.id===id?{...n,read:true,unread:false}:n));setLiveNotifs&&setLiveNotifs(ns=>ns.map(n=>n.id===id?{...n,read:true}:n));};
  const dismiss=id=>{setNotifs(ns=>ns.filter(n=>n.id!==id));if(setLiveNotifs)setLiveNotifs(ns=>ns.filter(n=>n.id!==id));};
  const markAll=()=>{setNotifs(ns=>ns.map(n=>({...n,read:true,unread:false})));if(onMarkRead)onMarkRead();};

  const typeColors={ win:"#3B82F6", follow:"#00E5FF", odds:"#F4C430", resolve:"#7c4dcc", comment:"#7c4dcc" };
  const ctaMap = {
    win: {label:"Claim +$8.40", color:"#3B82F6"},
    follow: {label:"Follow back", color:"#00E5FF"},
    odds: {label:"View market", color:"#F4C430"},
    resolve: {label:"See result", color:"#7c4dcc"},
    comment: {label:"Reply", color:"#7c4dcc"},
  };

  const visible = allNotifs.filter(n =>
    filter==="all" ? true :
    filter==="unread" ? !n.read :
    n.type==="win" || n.type==="resolve"
  );

  return (
    <div style={{height:"100%",overflowY:"auto",background:t.bgOverlay}}>
      <div style={{padding:"16px 16px 0",position:"sticky",top:0,background:"#0A1628",zIndex:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div>
            <span style={{color:"rgba(255,255,255,0.3)",fontSize:11,fontFamily:"'Inter',sans-serif",letterSpacing:1}}>{unreadCount>0?(unreadCount)+" UNREAD":"ALL CAUGHT UP"}</span>
          </div>
          {unreadCount>0&&<button onClick={markAll} style={{background:"none",border:"1px solid #1A2D4A",borderRadius:20,color:"rgba(255,255,255,0.42)",fontSize:11,padding:"5px 12px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Mark all read</button>}
        </div>
        {/* Filter tabs */}
        <div style={{display:"flex",gap:0,background:"#0F2040",borderRadius:12,padding:3,marginBottom:4}}>
          {[["all","All"],["unread","Unread"],["wins","Wins"]].map(([id,label])=>(
            <button key={id} onClick={()=>setFilter(id)} style={{flex:1,background:filter===id?"#1A2D4A":"transparent",border:"none",borderRadius:10,color:filter===id?"#fff":"rgba(255,255,255,0.32)",fontSize:12,fontWeight:700,padding:"7px 0",cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.2s"}}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{padding:"8px 16px 100px"}}>
        {visible.length===0 && <EmptyState icon="🔔" msg={filter==="unread"?"No unread notifications":"No wins yet — keep betting!"}/>}
        {visible.map(n=>(
          <div key={n.id} onClick={()=>markRead(n.id)} style={{display:"flex",gap:12,padding:"14px 12px",marginBottom:6,borderRadius:16,background:!n.read?"#0F2040":"transparent",border:!n.read?"1px solid #1A2D4A":"1px solid transparent",cursor:"pointer",transition:"all 0.2s",position:"relative"}}>
            {/* dismiss button */}
            <button onClick={e=>{e.stopPropagation();dismiss(n.id);}} style={{position:"absolute",top:8,right:8,background:"none",border:"none",color:"rgba(255,255,255,0.42)",fontSize:14,cursor:"pointer",padding:"2px 6px"}}>✕</button>

            <div style={{width:44,height:44,borderRadius:"50%",background:(typeColors[n.type]||"#1A2D4A")+"22",border:"1px solid "+(typeColors[n.type]||"#1A2D4A")+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
              {n.icon}
            </div>
            <div style={{flex:1,paddingRight:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:3}}>
                <span style={{color:"#FFFFFF",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{n.title}</span>
                <span style={{color:"rgba(255,255,255,0.2)",fontSize:11,fontFamily:"'Inter',sans-serif",flexShrink:0,marginLeft:8}}>{n.time}</span>
              </div>
              <p style={{color:"rgba(255,255,255,0.42)",fontSize:13,fontFamily:"'Inter',sans-serif",lineHeight:1.4,marginBottom:n.unread?8:0}}>{n.body}</p>
              {n.unread && ctaMap[n.type] && (
                <button onClick={e=>{e.stopPropagation();markRead(n.id);}} style={{background:(ctaMap[n.type].color)+"18",border:"1px solid "+(ctaMap[n.type].color)+"44",borderRadius:20,padding:"5px 12px",color:ctaMap[n.type].color,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                  {ctaMap[n.type].label}
                </button>
              )}
            </div>
            {n.unread&&<div style={{width:7,height:7,borderRadius:"50%",background:"#3B82F6",flexShrink:0,marginTop:6}}/>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WALLET
// ─────────────────────────────────────────────────────────────────────────────
function WalletPage({
  balance, votes, onAddBalance, resolvedBets={} }) {
  const ALL_PREDS = usePredictions();
  const t = useTheme();
  const [showDeposit,setShowDeposit]=useState(false);
  const [showWithdraw,setShowWithdraw]=useState(false);
  const [depositAmt,setDepositAmt]=useState(25);
  const [deposited,setDeposited]=useState(false);
  const [expandedTxn,setExpandedTxn]=useState(null);
  const userTxns=[...TRANSACTIONS,...Object.entries(votes||{}).map(([id,v],i)=>({
    id:"v"+(i),type:"DEBIT",icon:"🎯",
    note:"Bet "+(v.pos)+": "+(ALL_PREDS.find(p=>p.id===parseInt(id))?.title?.slice(0,40)||"Market"),
    detail: "You bet "+(v.pos)+" with $"+(v.amount?.toFixed(2)||"1.00")+" · Market resolves in "+(ALL_PREDS.find(p=>p.id===parseInt(id))?.daysLeft||"TBD"),
    amount:-v.amount,date:"Today"
  }))];
  const totalWon=userTxns.filter(t=>t.type==="PAYOUT").reduce((s,t)=>s+t.amount,0);
  const totalBet=Math.abs(userTxns.filter(t=>t.type==="DEBIT").reduce((s,t)=>s+t.amount,0));
  const netPnL = totalWon - totalBet;
  // Real win rate from resolved bets (passed in)
  const allResolved = Object.entries(votes||{}).filter(([id]) => resolvedBets && resolvedBets[id]);
  const realWins = allResolved.filter(([id,v]) => resolvedBets[id] === v.pos).length;
  const realWinRate = allResolved.length > 0 ? Math.round(realWins/allResolved.length*100) : null;

  const doDeposit = () => { onAddBalance && onAddBalance(depositAmt); setDeposited(true); };

  return (
    <div style={{height:"100%",overflowY:"auto",background:t.bgOverlay}}>
      <div style={{padding:"28px 16px 0"}}>

        {/* Balance hero card */}
        <div style={{background:"linear-gradient(135deg,#0a1f0a,#0d2617)",borderRadius:22,padding:"24px",marginBottom:14,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:-40,right:-40,width:150,height:150,borderRadius:"50%",background:"radial-gradient(circle,rgba(59,130,246,0.12),transparent)"}}/>
          <div style={{color:"rgba(255,255,255,0.35)",fontSize:11,fontFamily:"'Inter',sans-serif",fontWeight:600,marginBottom:6,letterSpacing:1}}>AVAILABLE BALANCE</div>
          <div style={{color:"#FFFFFF",fontSize:50,fontWeight:900,fontFamily:"'Inter',sans-serif",lineHeight:1,marginBottom:4}}>${balance.toFixed(2)}</div>
          <div style={{color:"rgba(59,130,246,0.7)",fontSize:12,fontFamily:"'Inter',sans-serif",marginBottom:20}}>Demo credits · No real money</div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>{setShowDeposit(true);setDeposited(false);}} style={{flex:1,background:"#3B82F6",border:"none",borderRadius:14,color:"#fff",fontSize:14,fontWeight:700,padding:"13px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Add Funds</button>
            <button onClick={()=>setShowWithdraw(true)} style={{flex:1,background:"rgba(255,255,255,0.07)",border:"none",borderRadius:14,color:"rgba(255,255,255,0.6)",fontSize:14,fontWeight:700,padding:"13px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Withdraw</button>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20}}>
          {[
            ["Won","$"+totalWon.toFixed(2),"#3B82F6"],
            ["Wagered","$"+totalBet.toFixed(2),"rgba(255,255,255,0.85)"],
            ["Net P&L",(netPnL>=0?"+":"")+netPnL.toFixed(2),(netPnL>=0?"#3B82F6":"#f93d3d")],
            ["Win Rate",realWinRate!==null?(realWinRate+"%"):"—","#F4C430"]
          ].map(([l,v,c])=>(
            <div key={l} style={{background:"#0F2040",borderRadius:16,padding:"14px"}}>
              <div style={{color:c,fontSize:22,fontWeight:800,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{v}</div>
              <div style={{color:"rgba(255,255,255,0.3)",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:5}}>{l}</div>
            </div>
          ))}
        </div>

        {/* Transactions */}
        <SectionLabel>Transaction History</SectionLabel>
        {userTxns.map(t=>(
          <div key={t.id}>
            <div onClick={()=>setExpandedTxn(expandedTxn===t.id?null:t.id)}
              style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",cursor:"pointer"}}>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <div style={{width:38,height:38,borderRadius:12,background:t.amount>0?"rgba(59,130,246,0.12)":"rgba(249,61,61,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{t.icon}</div>
                <div>
                  <div style={{color:"rgba(255,255,255,0.8)",fontSize:13,fontFamily:"'Inter',sans-serif",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.note}</div>
                  <div style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:2}}>{t.date}</div>
                </div>
              </div>
              <span style={{color:t.amount>0?"#3B82F6":"rgba(249,61,61,0.85)",fontWeight:700,fontFamily:"'Inter',sans-serif",fontSize:14}}>{t.amount>0?"+":""}{t.amount.toFixed(2)}</span>
            </div>
            {expandedTxn===t.id && (
              <div style={{background:"#0F2040",borderRadius:12,padding:"12px 14px",margin:"4px 0 8px"}}>
                <div style={{color:"rgba(255,255,255,0.45)",fontSize:12,fontFamily:"'Inter',sans-serif",lineHeight:1.6}}>{t.detail||"Transaction completed."}</div>
              </div>
            )}
          </div>
        ))}
        <div style={{height:100}}/>
      </div>

      {/* Deposit Modal */}
      {showDeposit&&(
        <div style={{position:"fixed",inset:0,zIndex:100,maxWidth:430,margin:"0 auto"}}>
          <Sheet onClose={()=>setShowDeposit(false)} title="Add Funds">
            {deposited ? (
              <div style={{textAlign:"center",padding:"20px 0 10px"}}>
                <div style={{fontSize:56,marginBottom:12}}>🎉</div>
                <h3 style={{color:"#3B82F6",fontSize:24,fontWeight:800,fontFamily:"'Inter',sans-serif",marginBottom:8}}>+${depositAmt} Added!</h3>
                <p style={{color:"rgba(255,255,255,0.4)",fontSize:13,fontFamily:"'Inter',sans-serif",marginBottom:24}}>Your balance has been topped up.</p>
                <button onClick={()=>setShowDeposit(false)} style={{background:"#3B82F6",border:"none",borderRadius:14,color:"#fff",fontSize:14,fontWeight:700,padding:"14px 40px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Done</button>
              </div>
            ) : (<>
              <SectionLabel>Select Amount</SectionLabel>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:20}}>
                {[10,25,50,100,250,500].map(v=>(
                  <button key={v} onClick={()=>setDepositAmt(v)} style={{background:depositAmt===v?"rgba(59,130,246,0.15)":"rgba(255,255,255,0.05)",border:depositAmt===v?"1px solid rgba(59,130,246,0.4)":"none",borderRadius:14,padding:"14px 0",color:depositAmt===v?"#3B82F6":"rgba(255,255,255,0.6)",fontSize:17,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.15s"}}>${v}</button>
                ))}
              </div>
              <PaymentModal
                amount={depositAmt}
                description={"Deposit $"+depositAmt+" to PredictSwipe Wallet"}
                buttonLabel="Deposit Funds"
                onSuccess={()=>{ onAddBalance&&onAddBalance(depositAmt); setDeposited(true); }}
                onCancel={()=>setShowDeposit(false)}
              />
            </>)}
          </Sheet>
        </div>
      )}
      {showWithdraw&&(
        <div style={{position:"fixed",inset:0,zIndex:100,maxWidth:430,margin:"0 auto"}}>
          <Sheet onClose={()=>setShowWithdraw(false)} title="Withdraw Funds">
            <WithdrawalFlow
              amount={Math.min(balance, balance * 0.95)}
              splitPct={100}
              pnl={balance}
              onDone={(amt)=>{ setShowWithdraw(false); }}
            />
          </Sheet>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROP FIRM FUNDED BOARD — live leaderboard of funded traders
// ─────────────────────────────────────────────────────────────────────────────
const FUNDED_TRADERS_SEED = [
  { rank:1, user:"satoshi_x",    avatar:"⚡", tier:"$10K", pnl:2840,  wins:14, pcts:92, badge:"🏆", payout:"$2,556",  daysLeft:4,  accountType:"PredictTest" },
  { rank:2, user:"alpha_whale",  avatar:"🐋", tier:"$10K", pnl:1920,  wins:11, pcts:88, badge:"🥈", payout:"$1,728",  daysLeft:12, accountType:"PredictDirect" },
  { rank:3, user:"degenmode",    avatar:"🔥", tier:"$5K",  pnl:1410,  wins:9,  pcts:78, badge:"🥉", payout:"$1,269",  daysLeft:7,  accountType:"PredictTest" },
  { rank:4, user:"moon_hunter",  avatar:"🌙", tier:"$5K",  pnl:980,   wins:7,  pcts:71, badge:"4",  payout:"$882",    daysLeft:18, accountType:"PredictDirect" },
  { rank:5, user:"yolo_labs",    avatar:"🚀", tier:"$1K",  pnl:640,   wins:6,  pcts:75, badge:"5",  payout:"$576",    daysLeft:3,  accountType:"PredictTest" },
  { rank:6, user:"crypto_seer",  avatar:"🔮", tier:"$1K",  pnl:420,   wins:5,  pcts:68, badge:"6",  payout:"$378",    daysLeft:21, accountType:"PredictDirect" },
];

function PropFirmFundedBoard({ onOpenPropFirm }) {
  const [traders, setTraders] = useState(FUNDED_TRADERS_SEED);
  const [lastUpdated, setLastUpdated] = useState("just now");
  const [pulse, setPulse] = useState(false);

  // Live PnL drift every 5s
  useEffect(()=>{
    const t = setInterval(()=>{
      setTraders(ts => ts.map(t=>({
        ...t,
        pnl: Math.max(0, t.pnl + (Math.random()-0.35) * (t.tier==="$10K"?80:t.tier==="$5K"?40:15)),
        wins: t.pnl > 0 ? t.wins : t.wins,
      })).sort((a,b)=>b.pnl-a.pnl).map((t,i)=>({...t,rank:i+1})));
      setPulse(true);
      setLastUpdated("just now");
      setTimeout(()=>setPulse(false), 600);
    }, 5000);
    return ()=>clearInterval(t);
  },[]);

  return (
    <div style={{marginTop:28}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:pulse?"#3B82F6":"#0d8a56",boxShadow:pulse?"0 0 8px #3B82F6":"none",transition:"all 0.3s"}}/>
            <span style={{color:"#FFFFFF",fontSize:16,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>🏦 Funded Traders Board</span>
          </div>
          <div style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif",marginTop:2,marginLeft:16}}>LIVE · Updated {lastUpdated}</div>
        </div>
        <button onClick={onOpenPropFirm} style={{background:"#F4C430",border:"none",borderRadius:20,color:"#0F1720",fontSize:11,fontWeight:700,padding:"5px 12px",cursor:"pointer",fontFamily:"'Inter',sans-serif",animation:"propGlow 6s ease-in-out infinite"}}>Get Funded →</button>
      </div>

      {/* Column headers */}
      <div style={{display:"grid",gridTemplateColumns:"28px 1fr 70px 60px",gap:8,padding:"0 14px",marginBottom:6}}>
        {["#","TRADER","P&L","SPLIT"].map(h=>(
          <div key={h} style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif",letterSpacing:1}}>{h}</div>
        ))}
      </div>

      {traders.map((t,i)=>{
        const payoutAmt = (t.pnl * 0.9).toFixed(0);
        const isTop3 = t.rank <= 3;
        return (
          <div key={t.user} style={{background:isTop3?"linear-gradient(135deg,#0A1628,#0F2040)":"#0F2040",borderRadius:14,border:"1px solid "+(isTop3?"rgba(59,130,246,0.133)":"#1A2D4A"),padding:"12px 14px",marginBottom:8,display:"grid",gridTemplateColumns:"28px 1fr 70px 60px",gap:8,alignItems:"center",transition:"all 0.4s"}}>
            <div style={{color:isTop3?"#3B82F6":"rgba(255,255,255,0.22)",fontSize:isTop3?16:12,fontFamily:"'Inter',sans-serif",fontWeight:700,textAlign:"center"}}>
              {t.rank<=3?["🥇","🥈","🥉"][t.rank-1]:t.rank}
            </div>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                <span style={{fontSize:14}}>{t.avatar}</span>
                <span style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>@{t.user}</span>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <span style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif",background:"#0F2040",borderRadius:99,padding:"1px 6px"}}>{t.tier}</span>
                <span style={{color:"rgba(255,255,255,0.32)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>{t.accountType}</span>
                {t.daysLeft <= 7 && <span style={{color:"#F4C430",fontSize:9,fontFamily:"'Inter',sans-serif"}}>⏱ {t.daysLeft}d left</span>}
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{color:"#3B82F6",fontSize:13,fontWeight:800,fontFamily:"'Inter',sans-serif",transition:"color 0.3s"}}>+${Math.round(t.pnl).toLocaleString()}</div>
              <div style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>{t.wins} wins</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{color:"#7c4dcc",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>${payoutAmt}</div>
              <div style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>90%</div>
            </div>
          </div>
        );
      })}

      {/* CTA footer */}
      <div style={{background:"linear-gradient(135deg,#0F2040,#0F2040)",borderRadius:14,border:"1px solid rgba(59,130,246,0.133)",padding:"14px 16px",marginTop:4,display:"flex",alignItems:"center",gap:12}}>
        <div style={{flex:1}}>
          <div style={{color:"#3B82F6",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:2}}>Your name could be here</div>
          <div style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>Start from $49 · Keep 90% · Leaderboard updated live</div>
        </div>
        <button onClick={onOpenPropFirm} style={{background:"#F4C430",border:"none",borderRadius:99,color:"#0F1720",fontSize:12,fontWeight:900,padding:"9px 16px",cursor:"pointer",fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap",animation:"propGlow 6s ease-in-out infinite"}}>Join →</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RANKING
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// LEADERBOARD USER PROFILE MODAL
// ─────────────────────────────────────────────────────────────────────────────
function LeaderboardUserSheet({ user, onClose, following, onFollow }) {
  const t = useTheme();
  const ALL_PREDS = usePredictions();
  const [vis, setVis] = useState(false);
  const isFollowing = following.includes(user.user);

  useEffect(() => { requestAnimationFrame(() => setVis(true)); }, []);
  const close = () => { setVis(false); setTimeout(onClose, 320); };

  const winRate = Math.round(user.wins / user.total * 100);
  const avgProfit = (user.profit / user.total).toFixed(0);
  const colors = ["#F4C430","rgba(255,255,255,0.62)","#C97A28","rgba(255,255,255,0.32)","rgba(255,255,255,0.32)","#3B82F6","rgba(255,255,255,0.32)","rgba(255,255,255,0.32)"];
  const rankColor = colors[user.rank-1] || "rgba(255,255,255,0.32)";

  const recentBets = ALL_PREDS.slice(0, 3).map((p, i) => ({
    title: p.title,
    pos: i % 2 === 0 ? "YES" : "NO",
    result: i === 0 ? "WIN" : i === 1 ? "WIN" : "PENDING",
    amount: [42, 88, 25][i],
  }));

  const statBlocks = [
    ["Win Rate", winRate + "%", "#3B82F6"],
    ["Total Profit", "+$" + user.profit.toLocaleString(), "#F4C430"],
    ["Avg/Bet", "+$" + avgProfit, "#00E5FF"],
    ["Bets", user.total, "rgba(255,255,255,0.4)"],
  ];

  return (
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}
      onClick={close}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(8px)",opacity:vis?1:0,transition:"opacity 0.3s"}}/>
      <div onClick={e=>e.stopPropagation()} style={{
        position:"relative",background:"#0A1628",borderRadius:"28px 28px 0 0",
        maxHeight:"85vh",overflowY:"auto",
        transform:vis?"translateY(0)":"translateY(100%)",
        transition:"transform 0.35s cubic-bezier(0.22,1,0.36,1)",
        boxShadow:"0 -8px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{display:"flex",justifyContent:"center",padding:"12px 0 4px"}}>
          <div style={{width:36,height:4,borderRadius:99,background:"rgba(255,255,255,0.15)"}}/>
        </div>

        {/* Profile hero */}
        <div style={{padding:"16px 20px 0",display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center"}}>
          <div style={{width:80,height:80,borderRadius:26,background:"rgba(255,255,255,0.07)",border:"2px solid "+rankColor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,marginBottom:12}}>
            {user.rank === 1 ? "🥇" : user.rank === 2 ? "🥈" : user.rank === 3 ? "🥉" : "👤"}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <span style={{color:"#FFFFFF",fontSize:20,fontWeight:800,fontFamily:"'Inter',sans-serif"}}>@{user.user}</span>
            <div style={{background:rankColor+"25",border:"1px solid "+rankColor+"60",borderRadius:99,padding:"2px 10px"}}>
              <span style={{color:rankColor,fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>#{user.rank}</span>
            </div>
          </div>
          <div style={{color:"rgba(255,255,255,0.35)",fontSize:12,fontFamily:"'Inter',sans-serif",marginBottom:16}}>
            Prediction trader · {user.wins} wins from {user.total} bets
          </div>

          {/* Follow button */}
          {!user.isMe && (
            <button onClick={()=>onFollow(user.user)} style={{
              padding:"10px 36px",borderRadius:99,
              background:isFollowing?"transparent":"#3B82F6",
              border:"1px solid "+(isFollowing?"rgba(255,255,255,0.2)":"#3B82F6"),
              color:isFollowing?"rgba(255,255,255,0.5)":"#fff",
              fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif",
              cursor:"pointer",marginBottom:20,
              transition:"all 0.2s",
            }}>
              {isFollowing ? "Following" : "Follow"}
            </button>
          )}
        </div>

        {/* Stats grid */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,padding:"0 16px 16px"}}>
          {statBlocks.map(([label,val,color])=>(
            <div key={label} style={{background:"rgba(255,255,255,0.04)",borderRadius:14,padding:"12px 8px",textAlign:"center"}}>
              <div style={{color,fontSize:16,fontWeight:800,fontFamily:"'Inter',sans-serif",marginBottom:3}}>{val}</div>
              <div style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>{label}</div>
            </div>
          ))}
        </div>

        {/* Performance bar */}
        <div style={{margin:"0 16px 16px",background:"rgba(255,255,255,0.04)",borderRadius:14,padding:"14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <span style={{color:"rgba(255,255,255,0.5)",fontSize:11,fontFamily:"'Inter',sans-serif",letterSpacing:1}}>WIN RATE</span>
            <span style={{color:"#3B82F6",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{winRate}%</span>
          </div>
          <div style={{height:6,background:"rgba(255,255,255,0.08)",borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",width:winRate+"%",background:"linear-gradient(90deg,#2F805A,#3B82F6)",borderRadius:99}}/>
          </div>
        </div>

        {/* Recent bets */}
        <div style={{padding:"0 16px 40px"}}>
          <div style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontFamily:"'Inter',sans-serif",letterSpacing:1,marginBottom:10}}>RECENT BETS</div>
          {recentBets.map((b,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:"#FFFFFF",fontSize:12,fontWeight:600,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.title}</div>
                <div style={{display:"flex",gap:6,marginTop:3}}>
                  <span style={{color:b.pos==="YES"?"#22C55E":"#f93d3d",fontSize:10,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{b.pos}</span>
                  <span style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>${b.amount}</span>
                </div>
              </div>
              <div style={{
                background:b.result==="WIN"?"rgba(59,130,246,0.15)":b.result==="PENDING"?"rgba(244,196,48,0.1)":"rgba(249,61,61,0.12)",
                border:"1px solid "+(b.result==="WIN"?"rgba(59,130,246,0.3)":b.result==="PENDING"?"rgba(244,196,48,0.25)":"rgba(249,61,61,0.25)"),
                borderRadius:99,padding:"3px 10px",
              }}>
                <span style={{color:b.result==="WIN"?"#3B82F6":b.result==="PENDING"?"#F4C430":"#f93d3d",fontSize:10,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{b.result}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RankingPage({
  onOpenCreator, onOpenTournament, onOpenPropFirm, propAccount, propAccounts=[], onOpenPropAnalytics, following=[], onFollow,
  votes={}, resolvedBets={}, profileData }) {
  const ALL_PREDS = usePredictions();
  const t = useTheme();
  const [period,setPeriod]=useState("weekly");
  const [selectedUser, setSelectedUser] = useState(null);

  // Weekly filter: bets placed in last 7 days
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyVotes = period === "weekly"
    ? Object.fromEntries(Object.entries(votes||{}).filter(([,v]) => (v.placedAt||0) >= weekAgo))
    : period === "monthly"
    ? Object.fromEntries(Object.entries(votes||{}).filter(([,v]) => (v.placedAt||0) >= Date.now() - 30*24*60*60*1000))
    : votes;

  // Build real P&L from resolved bets for the active period
  const periodResolved = Object.entries(weeklyVotes).filter(([id]) => resolvedBets[id]);
  const myWins = periodResolved.filter(([id, v]) => resolvedBets[id] === v.pos).length;
  const myTotal = periodResolved.length;
  const myProfit = periodResolved.reduce((sum, [id, v]) => {
    const won = resolvedBets[id] === v.pos;
    const market = ALL_PREDS.find(p => p.id === parseInt(id));
    if (won && market) {
      const odds = v.pos === "YES" ? market.yesPct/100 : (100-market.yesPct)/100;
      return sum + (v.amount||1) * (1/odds) * 0.98 - (v.amount||1);
    }
    return won ? sum + (v.amount||1) * 7 : sum - (v.amount||1);
  }, 0);

  const myName = profileData?.name || "you";
  // Keep mock users but inject real user data — when real users join, swap mocks for them
  const dynamicBoard = LEADERBOARD.map(r =>
    r.isMe ? { ...r, user: myName, profit: Math.max(0, Math.round(myProfit)), wins: myWins || r.wins, total: Math.max(myTotal, r.total) } : r
  ).sort((a,b) => b.profit - a.profit).map((r,i) => ({...r, rank:i+1}));

  return (
    <>
    <div style={{height:"100%",overflowY:"auto",background:t.bgOverlay}}>
      <div style={{padding:"22px 16px 0",position:"sticky",top:0,background:"#0A1628",zIndex:10}}>
        <h2 style={{fontSize:20,fontWeight:800,color:"#FFFFFF",fontFamily:"'Inter',sans-serif",marginBottom:14}}>Rankings</h2>
        <div style={{display:"flex",gap:6,marginBottom:4}}>
          {["weekly","monthly","alltime"].map(p=>(
            <button key={p} onClick={()=>setPeriod(p)} style={{background:period===p?"#3B82F6":"rgba(255,255,255,0.06)",border:"none",borderRadius:20,color:period===p?"#000":"rgba(255,255,255,0.45)",fontSize:12,fontWeight:600,padding:"7px 14px",cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.18s"}}>
              {p==="alltime"?"All time":p.charAt(0).toUpperCase()+p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:"14px 16px 100px"}}>
        {/* Tournament CTA */}
        <div onClick={onOpenTournament} style={{background:"linear-gradient(135deg,#100E06,#141414)",borderRadius:18,padding:"16px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,marginBottom:10,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 80% 50%,rgba(244,196,48,0.1),transparent 70%)"}}/>
          <div style={{width:48,height:48,borderRadius:14,background:"rgba(244,196,48,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🏆</div>
          <div style={{flex:1}}>
            <div style={{color:"#FFFFFF",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:2}}>Weekly Championship</div>
            <div style={{color:"#F4C430",fontSize:12,fontFamily:"'Inter',sans-serif",fontWeight:600}}>$2,500 pool · 847 players · 72h left</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="rgba(244,196,48,0.5)" strokeWidth="2" strokeLinecap="round"/></svg>
        </div>

        {/* Prop Firm CTA */}
        <div onClick={onOpenPropFirm} style={{background:"linear-gradient(135deg,#1a1500,#1f1800)",borderRadius:18,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,marginBottom:20,position:"relative",overflow:"hidden",border:"1px solid rgba(244,196,48,0.25)",animation:"propGlow 6s ease-in-out infinite"}}>
          <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 80% 50%,rgba(244,196,48,0.1),transparent 70%)"}}/>
          <div style={{width:44,height:44,borderRadius:14,background:"rgba(244,196,48,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
            {(propAccounts||[]).some(a=>a.funded)?"💰":(propAccounts||[]).length>0?"📊":"🏦"}
          </div>
          <div style={{flex:1}}>
            <div style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:2}}>
              {(propAccounts||[]).length>1?((propAccounts||[]).length)+" Active Prop Accounts"
               :(propAccounts||[]).some(a=>a.funded)?"Funded Account Active"
               :(propAccounts||[]).length>0?"My Challenge"
               :"Get Funded — From $49"}
            </div>
            <div style={{color:"#F4C430",fontSize:11,fontFamily:"'Inter',sans-serif",fontWeight:600}}>
              {(propAccounts||[]).length>0?"90% profit split · Withdraw anytime":"World's first prediction market prop firm"}
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="rgba(244,196,48,0.6)" strokeWidth="2" strokeLinecap="round"/></svg>
        </div>

        {/* Podium */}
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"center",gap:8,marginBottom:16}}>
          {[dynamicBoard[1]||LEADERBOARD[1],dynamicBoard[0]||LEADERBOARD[0],dynamicBoard[2]||LEADERBOARD[2]].map((r,i)=>{
            const heights=[96,126,82];
            const colors=["#C0C0C0","#F4C430","#CD7F32"];
            const labels=["2nd","1st","3rd"];
            return (
              <div key={r.rank} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                <div style={{width:38,height:38,borderRadius:13,background:(colors[i])+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{r.isMe?"😎":"👤"}</div>
                <span style={{color:"rgba(255,255,255,0.55)",fontSize:10,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>@{r.user.slice(0,8)}</span>
                <span style={{color:"#3B82F6",fontSize:12,fontWeight:800,fontFamily:"'Inter',sans-serif"}}>+${r.profit.toLocaleString()}</span>
                <div style={{width:"100%",height:heights[i],background:(colors[i])+"10",borderRadius:"10px 10px 0 0",display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:8}}>
                  <span style={{color:colors[i],fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{labels[i]}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Leaderboard list */}
        {dynamicBoard.map(r=>(
          <div key={r.rank} onClick={()=>setSelectedUser(r)} style={{background:r.isMe?"rgba(59,130,246,0.06)":"#0F2040",borderRadius:14,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12,border:r.isMe?"1px solid rgba(59,130,246,0.18)":"none",cursor:"pointer"}}>
            <div style={{width:28,textAlign:"center",fontSize:r.rank<=3?18:13,color:r.rank===1?"#F4C430":r.rank===2?"#C0C0C0":r.rank===3?"#CD7F32":"rgba(255,255,255,0.25)",fontWeight:700,flexShrink:0}}>
              {r.rank<=3?["🥇","🥈","🥉"][r.rank-1]:r.rank}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{color:r.isMe?"#3B82F6":"#fff",fontWeight:700,fontSize:14,fontFamily:"'Inter',sans-serif"}}>@{r.user}</span>
                {r.isMe&&<Badge color="#3B82F6">You</Badge>}
              </div>
              <div style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:2}}>{r.wins}/{r.total} correct · {Math.round(r.wins/r.total*100)}% win rate</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{color:"#3B82F6",fontWeight:800,fontSize:14,fontFamily:"'Inter',sans-serif"}}>+${r.profit.toLocaleString()}</div>
              <div style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>{r.total} bets</div>
            </div>
          </div>
        ))}

        {/* PropFirm funded board */}
        <PropFirmFundedBoard onOpenPropFirm={onOpenPropFirm}/>
      </div>
    </div>
    {selectedUser && <LeaderboardUserSheet user={selectedUser} onClose={()=>setSelectedUser(null)} following={following} onFollow={onFollow||(() => {})}/>}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// SELL POSITION SHEET
// ─────────────────────────────────────────────────────────────────────────────
function SellPositionSheet({ pred, vote, onClose }) {
  const staked     = parseFloat((vote.amount||1).toFixed(2));
  const currPct    = pred?.yesPct ?? 50;
  const currPrice  = vote.pos==="YES" ? currPct/100 : (100-currPct)/100;
  const totalShares = (vote.shares > 0) ? vote.shares
                    : (vote.sharePrice > 0 ? staked/vote.sharePrice : staked/0.5);

  const [sellPct, setSellPct]     = useState(100); // % of shares to sell
  const [confirmed, setConfirmed] = useState(false);
  const [selling, setSelling]     = useState(false);

  const sharesToSell = parseFloat((totalShares * sellPct / 100).toFixed(4));
  const grossValue   = parseFloat((sharesToSell * currPrice).toFixed(2));
  const sellValue    = parseFloat((grossValue * 0.99).toFixed(2));
  const costBasis    = parseFloat((staked * sellPct / 100).toFixed(2));
  const pnl          = parseFloat((sellValue - costBasis).toFixed(2));

  const handleSell = () => {
    setSelling(true);
    setTimeout(()=>{ setSelling(false); setConfirmed(true); }, 1200);
  };
  const handleDone = () => onClose({ soldValue: sellValue, sellPct, sharesToSell });

  const PRESETS = [25, 50, 75, 100];

  return (
    <Sheet onClose={onClose} title="Sell Position">
      {/* Market info */}
      <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:16,padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
        <PredImage pred={pred} style={{width:48,height:48,borderRadius:12}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{color:"#ffffff",fontSize:13,fontWeight:600,fontFamily:"'Inter',sans-serif",lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{pred.title}</div>
          <div style={{display:"flex",gap:8,marginTop:5,alignItems:"center"}}>
            <div style={{background:vote.pos==="YES"?"rgba(34,197,94,0.15)":"rgba(249,61,61,0.12)",border:"1px solid "+(vote.pos==="YES"?"rgba(34,197,94,0.3)":"rgba(249,61,61,0.25)"),borderRadius:6,padding:"2px 8px"}}>
              <span style={{color:vote.pos==="YES"?"#22C55E":"#f93d3d",fontSize:10,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{vote.pos}</span>
            </div>
            <span style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>{currPct}% · {totalShares.toFixed(2)} shares</span>
          </div>
        </div>
      </div>

      {confirmed ? (
        <div style={{textAlign:"center",padding:"24px 0"}}>
          <div style={{fontSize:48,marginBottom:12}}>✅</div>
          <div style={{color:"#ffffff",fontSize:20,fontWeight:900,fontFamily:"'Inter',sans-serif",marginBottom:4}}>{sellPct < 100 ? "Partial Sell" : "Position Sold"}</div>
          <div style={{color:"rgba(255,255,255,0.4)",fontSize:13,fontFamily:"'Inter',sans-serif",marginBottom:24}}>${sellValue.toFixed(2)} returned · {sharesToSell.toFixed(2)} shares sold</div>
          <button onClick={handleDone} style={{width:"100%",background:"none",border:"1px solid rgba(59,130,246,0.4)",borderRadius:14,color:"#3B82F6",fontSize:15,fontWeight:700,padding:"15px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Done</button>
        </div>
      ) : (
        <>
          {/* Partial sell slider */}
          <div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,padding:"14px 16px",marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{color:"#FFFFFF",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>Shares to sell</span>
              <span style={{color:"#3B82F6",fontSize:13,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{sharesToSell.toFixed(2)} <span style={{color:"rgba(255,255,255,0.3)",fontSize:10}}>/ {totalShares.toFixed(2)}</span></span>
            </div>
            {/* Preset buttons */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:12}}>
              {PRESETS.map(p=>(
                <button key={p} onClick={()=>setSellPct(p)} style={{background:"none",border:"1px solid "+(sellPct===p?"rgba(59,130,246,0.5)":"rgba(255,255,255,0.1)"),borderRadius:8,padding:"6px 0",color:sellPct===p?"#3B82F6":"rgba(255,255,255,0.35)",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                  {p}%
                </button>
              ))}
            </div>
            {/* Slider */}
            <input type="range" min="1" max="100" value={sellPct} onChange={e=>setSellPct(parseInt(e.target.value))}
              style={{width:"100%",accentColor:"#3B82F6",cursor:"pointer"}}
            />
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
              <span style={{color:"rgba(255,255,255,0.2)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>1%</span>
              <span style={{color:"rgba(255,255,255,0.2)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>100%</span>
            </div>
          </div>

          {/* P&L breakdown */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
            {[
              {label:"COST BASIS",  val:"$"+costBasis.toFixed(2),                            color:"#c8dae8"},
              {label:"SHARES",      val:sharesToSell.toFixed(2)+" @ "+Math.round(currPct)+"¢", color:"#c8dae8"},
              {label:"SELL VALUE",  val:"$"+sellValue.toFixed(2),                            color:"#ffffff"},
              {label:"P&L",         val:(pnl>=0?"+":"-")+"$"+Math.abs(pnl).toFixed(2),      color:pnl>=0?"#3B82F6":"#f93d3d"},
              {label:"FEE",         val:"1%",                                                 color:"rgba(255,255,255,0.3)"},
            ].map(s=>(
              <div key={s.label} style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
                <div style={{color:s.color,fontSize:14,fontWeight:800,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{s.val}</div>
                <div style={{color:"rgba(255,255,255,0.25)",fontSize:8,fontFamily:"'Inter',sans-serif",marginTop:4,letterSpacing:0.5}}>{s.label}</div>
              </div>
            ))}
          </div>

          <button onClick={handleSell} disabled={selling} style={{width:"100%",background:"none",border:"1px solid "+(selling?"rgba(255,255,255,0.1)":"rgba(249,61,61,0.4)"),borderRadius:14,color:selling?"rgba(255,255,255,0.3)":"#f93d3d",fontSize:15,fontWeight:700,padding:"15px",cursor:selling?"default":"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.2s",marginBottom:10}}>
            {selling ? "Processing…" : `Sell ${sellPct < 100 ? sellPct+"% · " : ""}$${sellValue.toFixed(2)}`}
          </button>
          <button onClick={()=>onClose(null)} style={{width:"100%",background:"none",border:"none",color:"rgba(255,255,255,0.3)",fontSize:13,fontWeight:500,padding:"13px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
            Keep Position
          </button>
        </>
      )}
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// P&L HISTOGRAM — interactive daily P&L bar chart with hover tooltip
// ─────────────────────────────────────────────────────────────────────────────
function PnLHistogram({ days, maxAbs }) {
  const [hovered, setHovered] = React.useState(null);
  const barH = 80;

  return (
    <div style={{marginBottom:14}}>
      <div style={{color:"rgba(255,255,255,0.3)",fontSize:9,fontFamily:"'Inter',sans-serif",letterSpacing:1.5,marginBottom:10}}>DAILY P&L</div>
      <div style={{position:"relative",height:barH+40,display:"flex",alignItems:"flex-end",gap:3,paddingBottom:20}}>
        {/* Zero line */}
        <div style={{position:"absolute",bottom:20,left:0,right:0,height:1,background:"rgba(255,255,255,0.1)"}}/>

        {days.map((d,i) => {
          const pct    = Math.abs(d.pnl) / maxAbs;
          const h      = Math.max(3, Math.round(pct * barH * 0.9));
          const isPos  = d.pnl >= 0;
          const color  = isPos ? "#3B82F6" : "#f93d3d";
          const isHov  = hovered === i;
          return (
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",height:"100%",position:"relative",cursor:"pointer"}}
              onMouseEnter={()=>setHovered(i)}
              onMouseLeave={()=>setHovered(null)}
              onTouchStart={()=>setHovered(hovered===i?null:i)}
            >
              {/* Tooltip */}
              {isHov && (
                <div style={{position:"absolute",bottom:"100%",left:"50%",transform:"translateX(-50%)",background:"#1A2D4A",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,padding:"6px 10px",whiteSpace:"nowrap",zIndex:10,marginBottom:4,pointerEvents:"none"}}>
                  <div style={{color:color,fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{isPos?"+":"-"}${Math.abs(d.pnl).toFixed(2)}</div>
                  <div style={{color:"rgba(255,255,255,0.4)",fontSize:9,fontFamily:"'Inter',sans-serif",marginTop:2}}>{d.day}</div>
                </div>
              )}
              {/* Bar — sits on zero line */}
              <div style={{
                position:"absolute",
                bottom:20,
                width:"100%",
                height:h,
                background: isHov ? (isPos?"#6ee7a0":"#fca5a5") : color+"cc",
                borderRadius: isPos ? "3px 3px 0 0" : "0 0 3px 3px",
                transform: isPos ? "none" : `translateY(${h}px)`,
                transition:"background 0.15s",
                boxShadow: isHov ? `0 0 8px ${color}88` : "none",
              }}/>
              {/* Day label */}
              <div style={{position:"absolute",bottom:0,fontSize:7,color:"rgba(255,255,255,0.25)",fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%",textAlign:"center"}}>
                {d.day.split(' ')[1]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function PropFirmPnlCard({ propAccounts, onOpenPropFirm, onOpenPropAnalytics }) {
  const allBets  = (propAccounts||[]).flatMap(a => a.bets || []);
  const resolved = allBets.filter(b => b.resolved);
  const open     = allBets.filter(b => !b.resolved);
  const totalPnl = parseFloat(resolved.reduce((s,b) => s+(b.pnlDelta||0), 0).toFixed(2));
  const wins     = resolved.filter(b => b.won).length;
  const wr       = resolved.length ? Math.round(wins/resolved.length*100) : 0;
  const funded   = (propAccounts||[]).find(a => a.status==="funded");
  const tier     = funded ? PROP_TIERS.find(t => t.id===funded.tierId) : PROP_TIERS.find(t => t.id===(propAccounts[0]?.tierId));
  const acctBal  = tier ? Math.max(0, tier.balance + totalPnl) : null;

  // Build daily P&L for histogram
  const dayMap = {};
  resolved.forEach(bet => {
    const d = new Date(bet.placedAt||Date.now()).toLocaleDateString('en-AU',{month:'short',day:'numeric'});
    if (!dayMap[d]) dayMap[d] = { day:d, pnl:0, ts: bet.placedAt||Date.now() };
    dayMap[d].pnl += bet.pnlDelta||0;
  });
  const histDays = Object.values(dayMap).sort((a,b)=>a.ts-b.ts).slice(-14);
  const maxAbs   = histDays.length ? Math.max(...histDays.map(d=>Math.abs(d.pnl)), 0.01) : 0.01;

  return (
    <div style={{background:"linear-gradient(135deg,#0d1a12,#0A1628)",border:"1px solid rgba(20,158,99,0.2)",borderRadius:16,padding:"16px",marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>🏦</span>
          <span style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>Prop Firm</span>
          {funded && <div style={{background:"rgba(20,158,99,0.2)",border:"1px solid rgba(20,158,99,0.4)",borderRadius:20,padding:"2px 8px"}}><span style={{color:"#3B82F6",fontSize:9,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>FUNDED</span></div>}
        </div>
        <button onClick={onOpenPropFirm} style={{background:"rgba(255,255,255,0.06)",border:"none",borderRadius:10,color:"rgba(255,255,255,0.4)",fontSize:10,padding:"5px 10px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>View →</button>
      </div>
      <div style={{marginBottom:12}}>
        <div style={{color:"rgba(255,255,255,0.4)",fontSize:10,fontFamily:"'Inter',sans-serif",letterSpacing:1.5,marginBottom:4}}>NET P&L</div>
        <div style={{color:totalPnl>=0?"#3B82F6":"#f93d3d",fontSize:32,fontWeight:900,fontFamily:"'Inter',sans-serif",lineHeight:1,textShadow:totalPnl>0?"0 0 20px rgba(59,130,246,0.4)":"none"}}>
          {totalPnl>=0?"+":"-"}${Math.abs(totalPnl).toFixed(2)}
        </div>
        {acctBal!==null && <div style={{color:"rgba(255,255,255,0.3)",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:4}}>Balance: ${acctBal.toLocaleString()}</div>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:10,marginBottom: resolved.length>0?12:0}}>
        {[{l:"Trades",v:allBets.length},{l:"Wins",v:wins},{l:"Win %",v:wr+"%"},{l:"Open",v:open.length}].map(s=>(
          <div key={s.l} style={{textAlign:"center"}}>
            <div style={{color:"#FFFFFF",fontSize:14,fontWeight:800,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{s.v}</div>
            <div style={{color:"rgba(255,255,255,0.25)",fontSize:8,fontFamily:"'Inter',sans-serif",marginTop:3,letterSpacing:0.5}}>{s.l.toUpperCase()}</div>
          </div>
        ))}
      </div>
      {resolved.length > 0 && (<>
        {histDays.length > 0 && <PnLHistogram days={histDays} maxAbs={maxAbs}/>}
        <div style={{color:"rgba(255,255,255,0.3)",fontSize:9,fontFamily:"'Inter',sans-serif",letterSpacing:1.5,marginBottom:8}}>RECENT TRADES</div>
        {resolved.slice(-4).reverse().map((bet,i)=>{
          const pnl = bet.pnlDelta||0;
          return (
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
              <div style={{flex:1,minWidth:0,marginRight:8}}>
                <div style={{color:"rgba(255,255,255,0.72)",fontSize:11,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{bet.title||bet.predId}</div>
                <div style={{color:"rgba(255,255,255,0.25)",fontSize:9,fontFamily:"'Inter',sans-serif",marginTop:1}}>{bet.pos} · ${(bet.stake||0).toFixed(2)}</div>
              </div>
              <div style={{color:bet.won?"#3B82F6":"#f93d3d",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif",flexShrink:0}}>
                {bet.won?"+":"-"}${Math.abs(pnl).toFixed(2)}
              </div>
            </div>
          );
        })}
      </>)}
    </div>
  );
}


function ProfilePage({
votes, balance, following, onOpenSettings, onOpenResolved, onOpenCreator, onOpenAdmin, onOpenWatchlist, onOpenReferral, onOpenProfileEdit, onOpenPortfolio, profileData, watchlistCount, onOpenPropFirm, resolvedBets={}, propAccounts=[], onOpenPropAnalytics, onOpenRanking, onOpenWallet }) {
  const ALL_PREDS = usePredictions();
  const t = useTheme();
  const [tab, setTab] = useState("activity");
  const voted = ALL_PREDS.filter(p => votes[p.id]);
  const resolvedVoted = voted.filter(p => resolvedBets && resolvedBets[p.id]);
  const wins = resolvedVoted.filter(p => resolvedBets[p.id] === votes[p.id]?.pos).length;
  const totalBetAmt = Object.values(votes||{}).reduce((s, v) => s + (v.amount || 1), 0);
  const totalWon = resolvedVoted.reduce((s,p) => {
    const won = resolvedBets[p.id] === votes[p.id]?.pos;
    if (!won) return s;
    const odds = votes[p.id]?.pos === "YES" ? p.yesPct/100 : (100-p.yesPct)/100;
    return s + (votes[p.id]?.amount||1) * (1/odds) * 0.98;
  }, 0);
  const netPnL = totalWon - resolvedVoted.reduce((s,p) => s+(votes[p.id]?.amount||1), 0);
  const avatar = profileData?.avatar || "⚡";
  const winRate = resolvedVoted.length ? Math.round(wins / resolvedVoted.length * 100) : 0;

  const [sellPosition, setSellPosition] = useState(null); // { pred, v }

  const achievements = [
    { icon:"🎯", label:"First Bet",   earned: voted.length > 0 },
    { icon:"🔥", label:"Hot Streak",  earned: wins >= 3 },
    { icon:"💎", label:"Diamond",     earned: voted.length >= 5 },
    { icon:"🏆", label:"Top 10",      earned: winRate >= 60 && resolvedVoted.length >= 5 },
    { icon:"👥", label:"Social",      earned: following.length > 0 },
    { icon:"⚡", label:"Degen",       earned: voted.length >= 8 },
    { icon:"💰", label:"Profitable",  earned: netPnL > 0 },
    { icon:"🎰", label:"Parlay Pro",  earned: voted.length >= 3 && winRate >= 70 },
  ];

  return (
    <div style={{height:"100%",overflowY:"auto",background:t.bgOverlay}}>

      {/* ── HERO ── */}
      <div style={{position:"relative",paddingBottom:0}}>
        {/* Banner */}
        <div style={{height:56,background:"linear-gradient(135deg,#0d1a12 0%,#0A1628 60%,#0d0d14 100%)",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 30% 60%,rgba(59,130,246,0.08) 0%,transparent 60%)"}}/>
        </div>

        {/* Avatar row */}
        <div style={{padding:"0 18px",marginTop:-28,display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
          <div style={{position:"relative"}}>
            <div style={{
              width:80,height:80,borderRadius:22,fontSize:34,border:"3px solid rgba(255,255,255,0.08)",
              background:"linear-gradient(135deg,rgba(20,158,99,0.6),rgba(30,92,58,0.4))",
              backdropFilter:"blur(20px)",
              boxShadow:"0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
              display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden",
            }}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:"40%",background:"linear-gradient(180deg,rgba(255,255,255,0.15),transparent)",borderRadius:"19px 19px 0 0"}}/>
              <span style={{position:"relative",zIndex:1}}>{avatar}</span>
            </div>
          </div>
          {/* Top-right action buttons */}
          <div style={{display:"flex",gap:8,marginBottom:6}}>
            <button onClick={onOpenSettings} style={{background:"#0F2040",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,color:"#ffffff",fontSize:11,fontWeight:600,padding:"7px 13px",cursor:"pointer",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",gap:5}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="#fff" strokeWidth="1.8"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/></svg>
              Settings
            </button>
            <button onClick={onOpenReferral} style={{background:"#0F2040",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,color:"#ffffff",fontSize:11,fontWeight:600,padding:"7px 13px",cursor:"pointer",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",gap:5}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="#fff" strokeWidth="1.8"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
              Referrals
            </button>
            <button onClick={onOpenPortfolio} style={{background:"#0F2040",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,color:"#ffffff",fontSize:11,fontWeight:600,padding:"7px 13px",cursor:"pointer",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",gap:5}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="14" rx="2" stroke="#fff" strokeWidth="1.8"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
              History
            </button>
          </div>
        </div>

        {/* Name + bio */}
        <div style={{padding:"10px 18px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2}}>
            <span style={{color:"#ffffff",fontWeight:800,fontSize:19,fontFamily:"'Inter',sans-serif"}}>@{profileData?.name || "deus_vult"}</span>
            <div style={{width:16,height:16,borderRadius:5,background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>
          <p style={{color:"rgba(255,255,255,0.35)",fontSize:12,fontFamily:"'Inter',sans-serif",lineHeight:1.5,marginBottom:12}}>{profileData?.bio || "Gold futures trader · Sydney, AU"}</p>

          {/* Follower row */}
          <div style={{display:"flex",gap:20,marginBottom:16}}>
            {[["284","Followers"],[""+following.length,"Following"],["$"+totalWon.toFixed(0),"Earned"]].map(([v,l])=>(
              <div key={l}>
                <span style={{color:"#ffffff",fontWeight:800,fontSize:14,fontFamily:"'Inter',sans-serif"}}>{v}</span>
                <span style={{color:"rgba(255,255,255,0.3)",fontSize:12,fontFamily:"'Inter',sans-serif",marginLeft:4}}>{l}</span>
              </div>
            ))}
          </div>


        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{padding:"0 18px 20px"}}>

        {/* ── QUICK ACTIONS ── */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
          <button onClick={onOpenWatchlist} style={{background:"#0F2040",border:"none",borderRadius:14,padding:"14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,textAlign:"left"}}>
            <div style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" stroke="#ffffff" strokeWidth="1.8" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <div style={{color:"#ffffff",fontSize:15,fontWeight:800,fontFamily:"'Inter',sans-serif"}}>{watchlistCount||0}</div>
              <div style={{color:"rgba(255,255,255,0.3)",fontSize:9,fontFamily:"'Inter',sans-serif",marginTop:2}}>WATCHLIST</div>
            </div>
          </button>
          <button onClick={onOpenResolved} style={{background:"#0F2040",border:"none",borderRadius:14,padding:"14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,textAlign:"left"}}>
            <div style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#ffffff" strokeWidth="1.8"/><path d="M9 12l2 2 4-4" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <div style={{color:"#ffffff",fontSize:15,fontWeight:800,fontFamily:"'Inter',sans-serif"}}>{RESOLVED_PREDICTIONS.length}</div>
              <div style={{color:"rgba(255,255,255,0.3)",fontSize:9,fontFamily:"'Inter',sans-serif",marginTop:2}}>RESOLVED</div>
            </div>
          </button>
          <button onClick={onOpenRanking} style={{background:"#0F2040",border:"none",borderRadius:14,padding:"14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,textAlign:"left",gridColumn:"1 / -1"}}>
            <div style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="14" width="4" height="8" rx="1" stroke="#ffffff" strokeWidth="1.7"/><rect x="9" y="9" width="4" height="13" rx="1" stroke="#ffffff" strokeWidth="1.7"/><rect x="16" y="4" width="4" height="18" rx="1" stroke="#ffffff" strokeWidth="1.7"/></svg>
            </div>
            <div>
              <div style={{color:"#ffffff",fontSize:15,fontWeight:800,fontFamily:"'Inter',sans-serif"}}>Rankings</div>
              <div style={{color:"rgba(255,255,255,0.3)",fontSize:9,fontFamily:"'Inter',sans-serif",marginTop:2}}>LEADERBOARD</div>
            </div>
            <svg style={{marginLeft:"auto"}} width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* ── PROP FIRM P&L ── */}
        {(propAccounts||[]).length > 0 && <PropFirmPnlCard propAccounts={propAccounts} onOpenPropFirm={onOpenPropFirm} onOpenPropAnalytics={onOpenPropAnalytics}/>}

        {/* ── PROP FIRM CTA ── */}
        <button onClick={onOpenPropFirm} style={{width:"100%",background:"linear-gradient(135deg,#1a1500,#1f1800)",border:"1px solid rgba(244,196,48,0.25)",borderRadius:14,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,marginBottom:16,textAlign:"left",animation:"propGlow 6s ease-in-out infinite"}}>
          <div style={{width:38,height:38,borderRadius:10,background:"rgba(244,196,48,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🏦</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:2}}><span style={{color:"#ffffff"}}>Trade with </span><span style={{color:"#3B82F6"}}>$10,000</span></div>
            <div style={{color:"rgba(244,196,48,0.5)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>From $49 · Keep 90% · Prediction prop firm</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="rgba(244,196,48,0.6)" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>

        {/* ── LEVEL · STREAK · ACHIEVEMENTS (combined panel) ── */}
        <div style={{background:"#0F2040",borderRadius:14,padding:"16px",marginBottom:16}}>
          {/* XP Level row */}
          {(()=>{
            const xp = calcXP(votes);
            const cur = [...XP_LEVELS].reverse().find(l=>xp>=l.minXp)||XP_LEVELS[0];
            const next = XP_LEVELS.find(l=>l.level===cur.level+1);
            const pct = next?Math.min(100,((xp-cur.minXp)/(next.minXp-cur.minXp))*100):100;
            return (<>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{color:"#ffffff",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>Level {cur.level} · {cur.label}</span>
                </div>
                <span style={{color:"rgba(255,255,255,0.3)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>{xp} XP{next?" / "+next.minXp:""}</span>
              </div>
              <div style={{height:5,background:"rgba(255,255,255,0.06)",borderRadius:99,overflow:"hidden",marginBottom:16}}>
                <div style={{height:"100%",width:pct+"%",background:"linear-gradient(90deg,"+cur.color+","+(next?.color||cur.color)+")",borderRadius:99,transition:"width 0.8s ease"}}/>
              </div>
            </>);
          })()}

          {/* Streak row */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{color:"#ffffff",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>🔥 Daily Streak</span>
            <span style={{color:"rgba(255,255,255,0.5)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>4 days · +50 XP/day</span>
          </div>
          <div style={{display:"flex",gap:5,marginBottom:16}}>
            {["M","T","W","T","F","S","S"].map((d,i)=>{
              const todayIdx=(new Date().getDay()||7)-1;
              const filled=i<=todayIdx&&i>todayIdx-4;
              const isToday=i===todayIdx;
              return (
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  <div style={{width:"100%",height:28,borderRadius:7,background:filled?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.04)",border:"1px solid "+(isToday?"rgba(255,255,255,0.25)":"transparent"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>
                    {filled?"🔥":""}
                  </div>
                  <span style={{color:isToday?"#ffffff":"rgba(255,255,255,0.25)",fontSize:8,fontFamily:"'Inter',sans-serif"}}>{d}</span>
                </div>
              );
            })}
          </div>

          {/* Achievements */}
          <div style={{color:"rgba(255,255,255,0.25)",fontSize:9,fontFamily:"'Inter',sans-serif",letterSpacing:1.5,marginBottom:10}}>ACHIEVEMENTS</div>
          <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:2,scrollbarWidth:"none"}}>
            {achievements.map(a=>(
              <div key={a.label} style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:5,opacity:a.earned?1:0.25}}>
                <div style={{width:46,height:46,borderRadius:14,background:"rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>
                  {a.icon}
                </div>
                <span style={{color:"rgba(255,255,255,0.45)",fontSize:8,fontFamily:"'Inter',sans-serif"}}>{a.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── ADMIN BUTTON ── */}
        <button onClick={onOpenAdmin} style={{width:"100%",background:"#0F2040",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"13px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,marginBottom:16,textAlign:"left"}}>
          <div style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.09 6.26L20 9.27l-5 4.73L16.18 21 12 17.77 7.82 21 9 13.99l-5-4.73 5.91-.01L12 2z" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round"/></svg>
          </div>
          <div style={{flex:1}}>
            <div style={{color:"#ffffff",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>Admin Dashboard</div>
            <div style={{color:"rgba(255,255,255,0.3)",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:1}}>Markets · Users · Revenue · Create</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.2)" strokeWidth="1.8" strokeLinecap="round"/></svg>
        </button>

        {/* ── CONTENT TABS ── */}
        <div style={{display:"flex",background:"#0F2040",borderRadius:14,padding:4,marginBottom:16}}>
          <span style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif",padding:"9px 0",display:"block"}}>Activity</span>
        </div>

        {/* Open Positions */}
        {tab==="bets" && (
          voted.length === 0
            ? <EmptyState icon="🎯" msg="No bets yet — go to the Feed!"/>
            : voted.map(pred => {
                const v = votes[pred.id];
                const staked = parseFloat(v.amount?.toFixed(2)||"1.00");
                const currPct = pred.yesPct;
                const entryOdds = v.pos==="YES" ? currPct/100 : (100-currPct)/100;
                const sellValue = parseFloat((staked * (1/entryOdds) * 0.99).toFixed(2));
                const pnl = sellValue - staked;
                return (
                  <div key={pred.id} onClick={()=>setSellPosition({pred,v})} style={{background:"#0F2040",borderRadius:14,padding:"13px",marginBottom:8,cursor:"pointer",border:"1px solid rgba(255,255,255,0.04)"}}>
                    <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:10}}>
                      <PredImage pred={pred} style={{width:46,height:46,borderRadius:11}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{color:"#ffffff",fontSize:13,fontWeight:600,fontFamily:"'Inter',sans-serif",lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pred.title}</div>
                        <div style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontFamily:"'Inter',sans-serif",marginTop:3}}>
                          ${staked.toFixed(2)} staked · {pred.daysLeft} left
                        </div>
                      </div>
                      <div style={{background:v.pos==="YES"?"rgba(34,197,94,0.12)":"rgba(249,61,61,0.1)",border:"1px solid "+(v.pos==="YES"?"rgba(34,197,94,0.2)":"rgba(249,61,61,0.2)"),borderRadius:8,padding:"4px 10px",flexShrink:0}}>
                        <span style={{color:v.pos==="YES"?"#22C55E":"#f93d3d",fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{v.pos}</span>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div style={{display:"flex",gap:16}}>
                        <div>
                          <div style={{color:"rgba(255,255,255,0.3)",fontSize:8,fontFamily:"'Inter',sans-serif",letterSpacing:1,marginBottom:2}}>SELL VALUE</div>
                          <div style={{color:"#ffffff",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>${sellValue.toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{color:"rgba(255,255,255,0.3)",fontSize:8,fontFamily:"'Inter',sans-serif",letterSpacing:1,marginBottom:2}}>P&L</div>
                          <div style={{color:pnl>=0?"#3B82F6":"#f93d3d",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{pnl>=0?"+":""}${pnl.toFixed(2)}</div>
                        </div>
                      </div>
                      <div style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:20,padding:"6px 14px",display:"flex",alignItems:"center",gap:5}}>
                        <span style={{color:"#ffffff",fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>Sell Position</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"/></svg>
                      </div>
                    </div>
                  </div>
                );
              })
        )}

        {/* Sell Position Sheet */}
        {sellPosition && <SellPositionSheet pred={sellPosition.pred} vote={sellPosition.v} onClose={()=>setSellPosition(null)}/>}

        {/* Closed Positions */}
        {tab==="closed" && (
          RESOLVED_PREDICTIONS.length === 0
            ? <EmptyState icon="✅" msg="No closed positions yet."/>
            : RESOLVED_PREDICTIONS.map(pred => {
                const won = Math.random() > 0.4;
                const amt = (Math.random()*10+1).toFixed(2);
                return (
                  <div key={pred.id} style={{background:"#0F2040",borderRadius:14,padding:"13px",marginBottom:8,display:"flex",gap:12,alignItems:"center"}}>
                    <PredImage pred={pred} style={{width:50,height:50,borderRadius:12}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{color:"#c8dae8",fontSize:13,fontWeight:600,fontFamily:"'Inter',sans-serif",lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pred.title}</div>
                      <div style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontFamily:"'Inter',sans-serif",marginTop:3}}>
                        Resolved · ${amt} staked
                      </div>
                    </div>
                    <div style={{background:won?"rgba(59,130,246,0.12)":"rgba(249,61,61,0.1)",border:"1px solid "+(won?"rgba(59,130,246,0.2)":"rgba(249,61,61,0.2)"),borderRadius:8,padding:"4px 10px",flexShrink:0}}>
                      <span style={{color:won?"#3B82F6":"#f93d3d",fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{won?"WON":"LOST"}</span>
                    </div>
                  </div>
                );
              })
        )}

        {/* Activity */}
        {tab==="activity" && (
          <div>
            {(() => {
              // Build real activity from votes + propAccount bets
              const now = Date.now();
              const fmt = ts => {
                if (!ts) return "";
                const d = now - ts;
                if (d < 60000) return Math.floor(d/1000)+"s ago";
                if (d < 3600000) return Math.floor(d/60000)+"m ago";
                if (d < 86400000) return Math.floor(d/3600000)+"h ago";
                return Math.floor(d/86400000)+"d ago";
              };
              const events = [];
              // Wallet bets placed
              Object.entries(votes||{}).forEach(([id,v]) => {
                events.push({
                  ts: v.placedAt || 0,
                  icon: "🎯",
                  text: "Placed $"+(v.amount||1).toFixed(2)+" "+v.pos+" on "+(v.title||id),
                  c: "rgba(255,255,255,0.42)",
                });
              });
              // Resolved wallet bets
              ALL_PREDS.filter(p => resolvedBets[p.id] && votes[p.id]).forEach(p => {
                const won = resolvedBets[p.id] === votes[p.id]?.pos;
                events.push({
                  ts: (votes[p.id]?.placedAt||0) + 1,
                  icon: won ? "🏆" : "❌",
                  text: (won ? "Won" : "Lost")+" bet on "+(p.title||p.id),
                  c: won ? "#3B82F6" : "#f93d3d",
                });
              });
              // Prop account bets
              (propAccounts||[]).flatMap(a=>a.bets||[]).forEach(b => {
                if (b.resolved) {
                  events.push({
                    ts: (b.placedAt||0) + 1,
                    icon: b.won ? "🏆" : "❌",
                    text: (b.won ? "Prop Won" : "Prop Lost")+" $"+(Math.abs(b.pnlDelta||0)).toFixed(2)+" on "+(b.title||b.predId),
                    c: b.won ? "#3B82F6" : "#f93d3d",
                  });
                } else {
                  events.push({
                    ts: b.placedAt || 0,
                    icon: "🎯",
                    text: "Prop bet $"+(b.stake||0).toFixed(2)+" "+b.pos+" on "+(b.title||b.predId),
                    c: "rgba(255,255,255,0.42)",
                  });
                }
              });
              events.sort((a,b)=>b.ts-a.ts);
              if (!events.length) return (
                <div style={{textAlign:"center",padding:"40px 0",color:"rgba(255,255,255,0.2)",fontFamily:"'Inter',sans-serif",fontSize:13}}>
                  <div style={{fontSize:40,marginBottom:12,opacity:0.3}}>📋</div>
                  No activity yet — place your first bet!
                </div>
              );
              return events.slice(0,30).map((a,i)=>(
                <div key={i} style={{display:"flex",gap:12,padding:"13px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <div style={{width:36,height:36,borderRadius:12,background:(a.c)+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{a.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{color:"rgba(255,255,255,0.75)",fontSize:13,fontFamily:"'Inter',sans-serif",lineHeight:1.4}}>{a.text}</div>
                    {a.ts > 0 && <div style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif",marginTop:3}}>{fmt(a.ts)}</div>}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}

        <div style={{height:32}}/>
      </div>
    </div>
  );
}

function MiniPnLChart({ won, bet }) {
  const data = [0, bet*0.1, -bet*0.05, bet*0.3, bet*0.2, bet*0.5, won-bet].map((v,i,a)=>a.slice(0,i+1).reduce((s,x)=>s+x,0));
  const min = Math.min(...data), max = Math.max(...data), range = (max-min)||1;
  const W=280, H=48;
  const pts = data.map((v,i)=>[(i/(data.length-1))*W, H-((v-min)/range)*H]);
  const pathD = pts.map((p,i)=>(i===0?"M":"L")+(p[0].toFixed(1))+","+(p[1].toFixed(1))).join(" ");
  const last = pts[pts.length-1];
  const color = (won-bet)>=0 ? "#3B82F6" : "#f93d3d";
  return (
    <svg width="100%" viewBox="0 0 280 52" style={{overflow:"visible"}}>
      <path d={(pathD+" L"+W+","+H+" L0,"+H+" Z")} fill={color+"18"}/>
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={last[0]} cy={last[1]} r="4" fill={color} stroke="#0F2040" strokeWidth="2"/>
    </svg>
  );
}

function EmptyState({ icon, msg }) {
  return <div style={{textAlign:"center",padding:"50px 0",color:"rgba(255,255,255,0.42)",fontFamily:"'Inter',sans-serif",fontSize:13}}><div style={{fontSize:48,marginBottom:12,opacity:0.3}}>{icon}</div>{msg}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────
const CATS_FOR_CREATE=Object.entries(CATEGORY_META).filter(([k])=>k!=="ALL").map(([id,v])=>({id,...v,label:id.charAt(0)+id.slice(1).toLowerCase()}));

function CreatePage() {
  const [form,setForm]=useState({title:"",category:"CRYPTO",deadline:"",startYes:50,stake:"1.00"});
  const [done,setDone]=useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const catMeta=CATEGORY_META[form.category]||CATEGORY_META.CRYPTO;

  if(done) return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:24,background:"#0A1628"}}>
      <div style={{fontSize:72,animation:"popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)"}}>🚀</div>
      <h2 style={{color:"#FFFFFF",fontFamily:"'Inter',sans-serif",fontSize:26,fontWeight:900,textAlign:"center"}}>Prediction Live!</h2>
      <p style={{color:"rgba(255,255,255,0.32)",fontFamily:"'Inter',sans-serif",fontSize:12,textAlign:"center",lineHeight:1.6}}>{form.title}</p>
      <div style={{display:"flex",gap:10,marginTop:8}}>
        <Badge color={catMeta.color}>{form.category}</Badge>
        <Badge color="#3B82F6">YES {form.startYes}%</Badge>
        <Badge color="#f93d3d">NO {100-form.startYes}%</Badge>
      </div>
      <button onClick={()=>{setDone(false);setForm({title:"",category:"CRYPTO",deadline:"",startYes:50,stake:"1.00"});}} style={{background:"#3B82F6",border:"none",borderRadius:99,color:"#fff",fontSize:14,fontWeight:900,padding:"13px 40px",cursor:"pointer",fontFamily:"'Inter',sans-serif",marginTop:12}}>Create Another</button>
    </div>
  );

  return (
    <div style={{height:"100%",overflowY:"auto",background:"#0A1628"}}>
      <div style={{padding:"20px 16px 100px"}}>
        <h2 style={{fontSize:22,fontWeight:900,color:"#FFFFFF",fontFamily:"'Inter',sans-serif",marginBottom:4}}>➕ Create Prediction</h2>
        <p style={{color:"rgba(255,255,255,0.2)",fontSize:11,fontFamily:"'Inter',sans-serif",marginBottom:24,letterSpacing:1}}>LAUNCH YOUR OWN MARKET</p>

        <SectionLabel>YOUR QUESTION</SectionLabel>
        <textarea value={form.title} onChange={e=>set("title",e.target.value)} placeholder='e.g. "Will X happen by Y date?"' rows={3}
          style={{width:"100%",background:"#0F2040",border:"1px solid #1A2D4A",borderRadius:14,padding:"14px",color:"#FFFFFF",fontSize:15,fontFamily:"'Inter',sans-serif",resize:"none",marginBottom:20,outline:"none",lineHeight:1.5}}/>

        <SectionLabel>CATEGORY</SectionLabel>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>
          {CATS_FOR_CREATE.map(c=>(
            <button key={c.id} onClick={()=>set("category",c.id)} style={{background:form.category===c.id?c.color:"#1A2D4A",border:"1px solid "+(form.category===c.id?c.color:"rgba(255,255,255,0.42)"),borderRadius:20,padding:"7px 14px",cursor:"pointer",color:form.category===c.id?"#000":"rgba(255,255,255,0.42)",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",gap:5,transition:"all 0.2s"}}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        <SectionLabel>RESOLUTION DEADLINE</SectionLabel>
        <input type="date" value={form.deadline} onChange={e=>set("deadline",e.target.value)} style={{width:"100%",background:"#0F2040",border:"1px solid #1A2D4A",borderRadius:12,padding:"13px 14px",color:"#FFFFFF",fontSize:14,fontFamily:"'Inter',sans-serif",marginBottom:20,outline:"none"}}/>

        <SectionLabel>STARTING YES ODDS: {form.startYes}%</SectionLabel>
        <input type="range" min={5} max={95} value={form.startYes} onChange={e=>set("startYes",+e.target.value)} style={{width:"100%",accentColor:"#3B82F6",marginBottom:8}}/>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
          <span style={{color:"#f93d3d",fontSize:12,fontFamily:"'Inter',sans-serif"}}>NO {100-form.startYes}%</span>
          <span style={{color:"#3B82F6",fontSize:12,fontFamily:"'Inter',sans-serif"}}>YES {form.startYes}%</span>
        </div>

        <SectionLabel>INITIAL LIQUIDITY STAKE</SectionLabel>
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          {["0.50","1.00","5.00","10.00"].map(v=>(
            <button key={v} onClick={()=>set("stake",v)} style={{flex:1,height:44,borderRadius:12,border:"1px solid "+(form.stake===v?"#3B82F6":"#1A2D4A"),background:form.stake===v?"rgba(59,130,246,0.12)":"#0F2040",color:form.stake===v?"#3B82F6":"#6a8090",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.15s"}}>${v}</button>
          ))}
        </div>

        {/* Live preview */}
        {form.title&&(
          <div style={{background:"#0F2040",borderRadius:16,border:"1px solid "+(catMeta.color)+"44",padding:"16px",marginBottom:24}}>
            <SectionLabel>PREVIEW</SectionLabel>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
              <span style={{fontSize:12}}>{catMeta.icon}</span>
              <span style={{color:catMeta.color,fontSize:10,fontWeight:700,letterSpacing:2,fontFamily:"'Inter',sans-serif"}}>{form.category}</span>
              {form.deadline&&<span style={{color:"rgba(255,255,255,0.25)",fontSize:10,fontFamily:"'Inter',sans-serif",marginLeft:"auto"}}>Resolves {form.deadline}</span>}
            </div>
            <div style={{color:"#FFFFFF",fontSize:15,fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:12,lineHeight:1.3}}>{form.title}</div>
            <div style={{height:5,background:"#1A2D4A",borderRadius:99,overflow:"hidden",marginBottom:6}}>
              <div style={{height:"100%",width:(form.startYes)+"%",background:"linear-gradient(90deg,#2F805A,#2d5c41)",borderRadius:99,transition:"width 0.4s"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{color:"#3B82F6",fontSize:12,fontFamily:"'Inter',sans-serif"}}>YES {form.startYes}%</span>
              <span style={{color:"#f93d3d",fontSize:12,fontFamily:"'Inter',sans-serif"}}>NO {100-form.startYes}%</span>
            </div>
          </div>
        )}

        <button onClick={()=>{ if(!form.title||!form.deadline)return; setDone(true); }} style={{width:"100%",background:form.title&&form.deadline?"#3B82F6":"#1A2D4A",border:"none",borderRadius:14,color:form.title&&form.deadline?"#000":"#1A2D4A",fontSize:16,fontWeight:900,padding:"16px",cursor:form.title&&form.deadline?"pointer":"default",fontFamily:"'Inter',sans-serif",transition:"all 0.3s",boxShadow:form.title&&form.deadline?"0 4px 24px rgba(59,130,246,0.267)":"none"}}>
          {form.title&&form.deadline?"🚀 Launch Prediction":"Fill in all fields to continue"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────────────────────────────────────────
const ONBOARDING_STEPS=[
  {
    id:"welcome",
    icon:"⚡",
    label:"WELCOME",
    title:"Welcome to PredictSwipe.",
    sub:"Scroll through what might happen next.\nPosition Early.",
    accent:"#3AAF72",
    accentDark:"#1E6644",
    bg:"linear-gradient(160deg,#091A10 0%,#0C1F15 50%,#071510 100%)",
    glow:"rgba(58,175,114,0.18)",
  },
  {
    id:"bet",
    icon:"🎯",
    label:"BET ON ANYTHING",
    title:"Predict what happens next.",
    sub:"Crypto prices, sport outcomes, politics, tech releases.\nIf it can resolve — it can be priced.",
    accent:"#F4C430",
    accentDark:"#8A5010",
    bg:"linear-gradient(160deg,#180F02 0%,#1F1408 50%,#140D02 100%)",
    glow:"rgba(244,196,48,0.18)",
  },
  {
    id:"rewards",
    icon:"💎",
    label:"WIN REAL REWARDS",
    title:"Put your predictions to work.",
    sub:"Start with $10 in credit. Accurate positions return proportional payouts when markets settle.",
    accent:"#7c4dcc",
    accentDark:"#2E2458",
    bg:"linear-gradient(160deg,#0D0A1A 0%,#131020 50%,#0A0815 100%)",
    glow:"rgba(124,77,204,0.18)",
  },
  {
    id:"odds",
    icon:"📡",
    label:"TRACK THE ODDS",
    title:"See Consensus Move.",
    sub:"Stay early. Stay informed.",
    accent:"#4A9ECC",
    accentDark:"#1A4A6A",
    bg:"linear-gradient(160deg,#080F18 0%,#0C1520 50%,#060C14 100%)",
    glow:"rgba(74,158,204,0.18)",
  },
  {
    id:"leaderboard",
    icon:"🏆",
    label:"CLIMB THE LEADERBOARD",
    title:"Compete on Accuracy.",
    sub:"Weekly rankings reset every Monday. Predict accurately, move up the rankings and earn bonus credits.",
    accent:"#C9A227",
    accentDark:"#6B520A",
    bg:"linear-gradient(160deg,#130F02 0%,#1A1506 50%,#0F0C01 100%)",
    glow:"rgba(201,162,39,0.18)",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// LIVE ODDS TICKER (top of feed - drifts every few seconds)
// ─────────────────────────────────────────────────────────────────────────────
function LiveTicker({ votes={}, onVote, balance=0, watchlist=[], onToggleWatch }) {
  const ALL_PREDS = usePredictions();
  const items = ALL_PREDS.filter(p=>p.hot).slice(0,6);
  const [ticks, setTicks] = useState(() => items.map(p=>p.yesPct));
  const [dir, setDir]     = useState(() => items.map(()=>0));
  const posRef = useRef(0);
  const [pos, setPos]     = useState(0);
  const [selectedPred, setSelectedPred] = useState(null);

  useEffect(()=>{
    const drift = setInterval(()=>{
      setTicks(t=>t.map((v,i)=>{
        const d = (Math.random()-0.48)*1.5;
        return Math.min(98, Math.max(2, v+d));
      }));
      setDir(prev=>prev.map(()=>Math.random()>0.5?1:-1));
    }, 2200);
    return ()=>clearInterval(drift);
  },[]);

  useEffect(()=>{
    const scroll = setInterval(()=>{
      posRef.current = (posRef.current + 1) % (items.length * 120);
      setPos(posRef.current);
    }, 30);
    return ()=>clearInterval(scroll);
  },[]);

  return (
    <>
    <div style={{background:"#0A1628",borderBottom:"1px solid #0F2040",overflow:"hidden",height:32,position:"relative",flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",transform:"translateX("+(-pos)+"px)",transition:"none",whiteSpace:"nowrap",height:"100%"}}>
        {[...items,...items].map((p,i)=>(
          <div key={i} onClick={()=>setSelectedPred(items[i%items.length])} style={{display:"inline-flex",alignItems:"center",gap:8,padding:"0 20px",height:"100%",borderRight:"1px solid #1A2D4A",cursor:"pointer"}}>
            <span style={{color:CATEGORY_META[p.category]?.color||"rgba(255,255,255,0.42)",fontSize:10}}>{CATEGORY_META[p.category]?.icon}</span>
            <span style={{color:"rgba(255,255,255,0.5)",fontSize:10,fontFamily:"'Inter',sans-serif",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis"}}>{p.title.slice(0,28)}…</span>
            <span style={{color:dir[i%items.length]>=0?"#3B82F6":"#f93d3d",fontSize:10,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>
              {ticks[i%items.length].toFixed(1)}% {dir[i%items.length]>=0?"▲":"▼"}
            </span>
          </div>
        ))}
      </div>
    </div>
    {selectedPred && (
      <MarketDetailSheet
        pred={selectedPred}
        votes={votes}
        onVote={onVote||(() =>{})}
        balance={balance}
        isWatched={watchlist.includes(selectedPred.id)}
        onToggleWatch={onToggleWatch||(() =>{})}
        onClose={()=>setSelectedPred(null)}
      />
    )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARE SHEET
// ─────────────────────────────────────────────────────────────────────────────
function ShareSheet({ pred, onClose }) {
  const [copied, setCopied] = useState(false);
  const url = "https://predictswipe.app/p/"+(pred.id);
  const copy = () => { navigator.clipboard?.writeText(code).catch(()=>{}); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  const channels = [
    { icon:"🐦", label:"Twitter / X",  color:"#1da1f2" },
    { icon:"💬", label:"WhatsApp",      color:"#25d366" },
    { icon:"📘", label:"Facebook",      color:"#1877f2" },
    { icon:"✈️",  label:"Telegram",     color:"#2ca5e0" },
    { icon:"📸", label:"Instagram",     color:"#e1306c" },
    { icon:"🔗", label:"Copy Link",     color:"rgba(255,255,255,0.42)",  action: copy },
  ];
  return (
    <Sheet onClose={onClose} title="📤 Share Prediction">
      <div style={{background:"#0F2040",borderRadius:14,padding:"14px",marginBottom:20,display:"flex",gap:12}}>
        <PredImage pred={pred} style={{width:64,height:64,borderRadius:10}}/>
        <div>
          <div style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif",lineHeight:1.3,marginBottom:6}}>{pred.title}</div>
          <div style={{display:"flex",gap:8}}>
            <Badge color="#3B82F6">YES {pred.yesPct}%</Badge>
            <Badge color="rgba(255,255,255,0.42)">Pool {pred.pool}</Badge>
          </div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
        {channels.map(c=>(
          <button key={c.label} onClick={c.action} style={{background:"#0F2040",border:"1px solid "+(c.color)+"33",borderRadius:14,padding:"14px 10px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6,transition:"all 0.2s"}}>
            <span style={{fontSize:24}}>{c.icon}</span>
            <span style={{color:"rgba(255,255,255,0.42)",fontSize:10,fontFamily:"'Inter',sans-serif",textAlign:"center"}}>{c.label}</span>
          </button>
        ))}
      </div>
      <div style={{background:"#0F2040",borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",gap:10}}>
        <span style={{color:"rgba(255,255,255,0.25)",fontSize:12,fontFamily:"'Inter',sans-serif",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{url}</span>
        <button onClick={copy} style={{background:copied?"#3B82F6":"#1A2D4A",border:"none",borderRadius:8,color:copied?"#000":"rgba(255,255,255,0.42)",fontSize:12,padding:"6px 12px",cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.2s",flexShrink:0}}>
          {copied?"Copied!":"Copy"}
        </button>
      </div>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATOR PROFILE PAGE
// ─────────────────────────────────────────────────────────────────────────────
function CreatorProfilePage({
handle, onClose, votes, onVote, balance, following, onFollow }) {
  const ALL_PREDS = usePredictions();
  const creator = CREATOR_PROFILES[handle];
  const preds   = ALL_PREDS.filter(p=>p.creator.handle===handle);
  const [activeTab, setActiveTab] = useState("active");
  const resolved = RESOLVED_PREDICTIONS.filter(p=>p.creator?.handle===handle);
  const isFollowing = following.includes(handle);

  if (!creator) return (
    <div style={{height:"100%",background:"#0A1628",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <EmptyState icon="👤" msg="Creator not found"/>
    </div>
  );

  return (
    <div style={{height:"100%",overflowY:"auto",background:"#0A1628"}}>
      {/* Back header */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px",position:"sticky",top:0,background:"#0A1628",zIndex:10}}>
        <button onClick={onClose} style={{width:36,height:36,borderRadius:12,background:"rgba(255,255,255,0.07)",border:"none",color:"rgba(255,255,255,0.6)",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <span style={{fontSize:20,lineHeight:1,color:"#FFFFFF",fontWeight:300}}>‹</span>
        </button>
        <span style={{color:"#FFFFFF",fontWeight:700,fontSize:15,fontFamily:"'Inter',sans-serif"}}>@{handle}</span>
      </div>

      {/* Hero */}
      <div style={{position:"relative",height:130,background:"linear-gradient(135deg,"+(creator.color)+"18,#0F2040)"}}>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 30% 50%, "+(creator.color)+"33,transparent 70%)"}}/>
        <div style={{position:"absolute",bottom:-40,left:16}}>
          <div style={{width:80,height:80,borderRadius:"50%",background:creator.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:34,border:"4px solid #090F14",boxShadow:"0 0 30px "+(creator.color)+"55"}}>
            {creator.avatar}
          </div>
        </div>
        <div style={{position:"absolute",bottom:12,right:16}}>
          <button onClick={()=>onFollow(handle)} style={{background:isFollowing?"#1A2D4A":"#3B82F6",border:"1px solid "+(isFollowing?"#1A2D4A":"#3B82F6"),borderRadius:20,color:isFollowing?"rgba(255,255,255,0.42)":"#000",fontSize:14,fontWeight:700,padding:"8px 22px",cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.2s"}}>
            {isFollowing?"Following ✓":"Follow"}
          </button>
        </div>
      </div>

      <div style={{padding:"52px 16px 0"}}>
        <div style={{marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{color:"#FFFFFF",fontWeight:900,fontSize:20,fontFamily:"'Inter',sans-serif"}}>{creator.name}</span>
            {creator.verified&&<span style={{color:"#00E5FF",fontSize:18}}>✓</span>}
          </div>
          <span style={{color:"rgba(255,255,255,0.25)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>@{creator.handle} · Joined {creator.joined}</span>
        </div>
        <p style={{color:"rgba(255,255,255,0.42)",fontSize:13,fontFamily:"'Inter',sans-serif",lineHeight:1.5,marginBottom:16}}>{creator.bio}</p>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:20}}>
          {[["Followers",creator.followers,creator.color],["Accuracy",creator.accuracy,"#3B82F6"],["Predictions",creator.predictions,"#fff"],["Volume",creator.totalVolume,"#F4C430"]].map(([l,v,c])=>(
            <div key={l} style={{background:"#0F2040",borderRadius:14,padding:"12px 8px",textAlign:"center"}}>
              <div style={{color:c,fontSize:15,fontWeight:800,fontFamily:"'Inter',sans-serif"}}>{v}</div>
              <div style={{color:"rgba(255,255,255,0.3)",fontSize:9,fontFamily:"'Inter',sans-serif",marginTop:3}}>{l}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{display:"flex",background:"rgba(255,255,255,0.05)",borderRadius:14,padding:4,marginBottom:16}}>
          {[["active","Active"],["resolved","Resolved"]].map(([id,label])=>(
            <button key={id} onClick={()=>setActiveTab(id)} style={{flex:1,background:activeTab===id?"#1A2D4A":"transparent",border:"none",borderRadius:11,color:activeTab===id?"#fff":"rgba(255,255,255,0.35)",fontSize:13,fontWeight:600,padding:"9px",cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.2s"}}>{label}</button>
          ))}
        </div>

        {activeTab==="active" && preds.map(pred=>{
          const [local,setLocal] = useState(pred.yesPct);
          return (
            <div key={pred.id} style={{background:"#0F2040",borderRadius:14,padding:"14px",marginBottom:10,display:"flex",gap:12,alignItems:"center"}}>
              <PredImage pred={pred} style={{width:56,height:56,borderRadius:10}}/>
              <div style={{flex:1,minWidth:0}}>
                <Badge color={CATEGORY_META[pred.category]?.color||"rgba(255,255,255,0.42)"}>{pred.category}</Badge>
                <div style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif",lineHeight:1.3,marginTop:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pred.title}</div>
                <div style={{display:"flex",gap:10,marginTop:4}}>
                  <span style={{color:"#22C55E",fontSize:11,fontFamily:"'Inter',sans-serif",fontWeight:700}}>{local}% YES</span>
                  <span style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>{pred.pool} · {pred.daysLeft}</span>
                </div>
              </div>
              {!votes[pred.id] && (
                <button onClick={()=>{onVote(pred.id,"YES",1);setLocal(l=>Math.min(99,l+1));}} style={{background:"rgba(20,158,99,0.15)",border:"1px solid rgba(59,130,246,0.267)",borderRadius:99,color:"#3B82F6",fontSize:11,fontWeight:700,padding:"6px 12px",cursor:"pointer",fontFamily:"'Inter',sans-serif",flexShrink:0}}>YES</button>
              )}
              {votes[pred.id] && <Badge color={votes[pred.id].pos==="YES"?"#22C55E":"#c42b2b"}>{votes[pred.id].pos}</Badge>}
            </div>
          );
        })}

        {activeTab==="resolved" && (
          resolved.length===0
            ? RESOLVED_PREDICTIONS.map(pred=>(
              <div key={pred.id} style={{background:"#0F2040",borderRadius:14,padding:"14px",marginBottom:10,display:"flex",gap:12,alignItems:"center"}}>
                <PredImage pred={pred} style={{width:56,height:56,borderRadius:10}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif",lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pred.title}</div>
                  <div style={{display:"flex",gap:8,marginTop:6,alignItems:"center"}}>
                    <div style={{background:pred.outcome==="YES"?"rgba(34,197,94,0.15)":"rgba(143,60,60,0.15)",border:"1px solid "+(pred.outcome==="YES"?"rgba(34,197,94,0.267)":"rgba(143,60,60,0.267)"),borderRadius:99,padding:"2px 10px",color:pred.outcome==="YES"?"#22C55E":"#c42b2b",fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>
                      {pred.outcome} ✓
                    </div>
                    <span style={{color:"rgba(255,255,255,0.2)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>{pred.resolvedDate}</span>
                  </div>
                </div>
              </div>
            ))
            : resolved.map(pred=>(
              <div key={pred.id} style={{background:"#0F2040",borderRadius:14,padding:"14px",marginBottom:10}}>
                <div style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:6}}>{pred.title}</div>
                <Badge color={pred.outcome==="YES"?"#22C55E":"#f93d3d"}>{pred.outcome} resolved</Badge>
              </div>
            ))
        )}
        <div style={{height:40}}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOLVED PREDICTIONS PAGE
// ─────────────────────────────────────────────────────────────────────────────
function ResolvedPage({ votes, resolvedBets={} }) {
  const ALL_PREDS = usePredictions();

  // Merge static resolved + live-resolved from Polymarket
  const liveResolved = ALL_PREDS
    .filter(p => resolvedBets[p.id])
    .map(p => ({
      ...p,
      outcome: resolvedBets[p.id],
      resolvedDate: new Date().toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"}),
      noYes: 100 - p.yesPct,
      payout: null,
    }));
  const allResolved = [...liveResolved, ...RESOLVED_PREDICTIONS];

  return (
    <div style={{height:"100%",overflowY:"auto",background:"#0A1628"}}>
      <div style={{padding:"20px 16px 0",position:"sticky",top:0,background:"#0A1628",zIndex:10}}>
        <h2 style={{fontSize:22,fontWeight:900,color:"#FFFFFF",fontFamily:"'Inter',sans-serif",marginBottom:4}}>✅ Resolved</h2>
        <p style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif",marginBottom:20,letterSpacing:1}}>{allResolved.length} CLOSED MARKETS</p>
      </div>
      <div style={{padding:"0 16px 100px"}}>
        {allResolved.length === 0 && <div style={{textAlign:"center",padding:"60px 20px",color:"rgba(255,255,255,0.2)",fontSize:14,fontFamily:"'Inter',sans-serif"}}>No resolved markets yet</div>}
        {allResolved.map(pred=>{
          const userBet = votes[pred.id];
          const won = userBet && userBet.pos === pred.outcome;
          return (
            <div key={pred.id} style={{background:"#0F2040",borderRadius:20,overflow:"hidden",marginBottom:14,border:"1px solid "+(won?"rgba(59,130,246,0.2)":"#1A2D4A")}}>
              <div style={{position:"relative",height:160}}>
                <PredImage pred={pred} style={{width:"100%",height:"100%"}}/>
                <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.9) 0%,transparent 60%)"}}/>
                {/* Outcome banner */}
                <div style={{position:"absolute",top:10,left:12,background:pred.outcome==="YES"?"rgba(34,197,94,0.9)":"rgba(143,60,60,0.9)",borderRadius:20,padding:"5px 14px",display:"flex",alignItems:"center",gap:6,backdropFilter:"blur(4px)"}}>
                  <span style={{color:"#FFFFFF",fontSize:12,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>RESOLVED: {pred.outcome}</span>
                </div>
                {won && (
                  <div style={{position:"absolute",top:10,right:12,background:"rgba(20,158,99,0.9)",borderRadius:20,padding:"5px 14px",backdropFilter:"blur(4px)"}}>
                    <span style={{color:"#FFFFFF",fontSize:12,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>🏆 YOU WON</span>
                  </div>
                )}
                <div style={{position:"absolute",bottom:10,left:12,right:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <Badge color={CATEGORY_META[pred.category]?.color||"rgba(255,255,255,0.42)"}>{pred.category}</Badge>
                  <span style={{color:"rgba(255,255,255,0.5)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>{pred.resolvedDate}</span>
                </div>
              </div>
              <div style={{padding:"14px 16px 16px"}}>
                <h3 style={{color:"#FFFFFF",fontSize:15,fontWeight:800,lineHeight:1.3,fontFamily:"'Inter',sans-serif",marginBottom:12}}>{pred.title}</h3>

                {/* Final odds bar */}
                <div style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{color:pred.outcome==="YES"?"#22C55E":"rgba(255,255,255,0.42)",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>YES {pred.yesPct}% {pred.outcome==="YES"&&"✓"}</span>
                    <span style={{color:pred.outcome==="NO"?"#f93d3d":"rgba(255,255,255,0.42)",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{pred.outcome==="NO"&&"✓"} NO {pred.noYes}%</span>
                  </div>
                  <div style={{height:6,background:"#1A2D4A",borderRadius:99,overflow:"hidden"}}>
                    <div style={{height:"100%",width:(pred.yesPct)+"%",background:pred.outcome==="YES"?"linear-gradient(90deg,#2F805A,#2d5c41)":"linear-gradient(90deg,#4F6475,#3A4F5E)",borderRadius:99,transition:"width 0.6s ease"}}/>
                  </div>
                </div>

                <div style={{display:"flex",gap:14,marginBottom:12}}>
                  {[["💰",pred.pool],["👥",pred.bettors],["📅",pred.resolvedDate]].map(([i,v])=>(
                    <span key={v} style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>{i} {v}</span>
                  ))}
                </div>

                {/* User bet result */}
                {userBet ? (
                  <div style={{background:won?"rgba(59,130,246,0.1)":"rgba(143,60,60,0.1)",border:"1px solid "+(won?"rgba(59,130,246,0.2)":"rgba(143,60,60,0.2)"),borderRadius:12,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{color:won?"#3B82F6":"#c42b2b",fontWeight:700,fontSize:13,fontFamily:"'Inter',sans-serif"}}>{won?"🏆 You won!":"You lost"}</div>
                      <div style={{color:"rgba(255,255,255,0.3)",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:2}}>Your bet: {userBet.pos} · ${userBet.amount?.toFixed(2)}</div>
                    </div>
                    {won && pred.payout && <div style={{color:"#3B82F6",fontWeight:900,fontSize:18,fontFamily:"'Inter',sans-serif"}}>+${pred.payout.toFixed(2)}</div>}
                  </div>
                ) : (
                  <div style={{color:"rgba(255,255,255,0.42)",fontSize:12,fontFamily:"'Inter',sans-serif",textAlign:"center",padding:"8px 0"}}>You didn't bet on this one</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS PAGE
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS SUB-PAGE SHELL
// ─────────────────────────────────────────────────────────────────────────────
function SettingsSubPage({ title, onBack, children }) {
  const t = useTheme();
  return (
    <div style={{position:"fixed",inset:0,zIndex:300,background:t.bgOverlay,display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:"1px solid "+t.border,flexShrink:0}}>
        <button onClick={onBack} style={{width:36,height:36,borderRadius:12,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
          <span style={{fontSize:20,lineHeight:1,color:"#FFFFFF",fontWeight:300}}>‹</span>
        </button>
        <span style={{color:t.text,fontWeight:700,fontSize:16,fontFamily:"'Inter',sans-serif"}}>{title}</span>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"20px 16px 60px"}}>{children}</div>
    </div>
  );
}

function SettingsInput({ label, value, onChange, placeholder, multiline=false }) {
  const t = useTheme();
  const style = {
    width:"100%", background:t.bgCard, border:"1px solid "+t.border,
    borderRadius:12, padding:"12px 14px", color:t.text,
    fontSize:14, fontFamily:"'Inter',sans-serif", outline:"none",
    resize:"none", boxSizing:"border-box",
  };
  return (
    <div style={{marginBottom:16}}>
      <div style={{color:t.textMuted,fontSize:11,fontFamily:"'Inter',sans-serif",letterSpacing:1,marginBottom:6}}>{label}</div>
      {multiline
        ? <textarea rows={3} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={style}/>
        : <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={style}/>
      }
    </div>
  );
}

// Profile editor
function ProfileSettingsPage({ profileData, onSave, onBack }) {
  const [name, setName] = useState(profileData?.name || "");
  const [bio,  setBio]  = useState(profileData?.bio  || "");
  const [avatar, setAvatar] = useState(profileData?.avatar || "⚡");
  const avatarOptions = ["⚡","🔮","🏆","💎","🦁","🐉","🎯","🌙","⚔️","🛡️","🦅","🔱"];
  const t = useTheme();
  return (
    <SettingsSubPage title="Edit Profile" onBack={onBack}>
      <div style={{color:t.textMuted,fontSize:11,letterSpacing:1,fontFamily:"'Inter',sans-serif",marginBottom:10}}>AVATAR</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:24}}>
        {avatarOptions.map(a=>(
          <button key={a} onClick={()=>setAvatar(a)} style={{
            width:48,height:48,borderRadius:14,fontSize:22,
            background:avatar===a?"rgba(59,130,246,0.2)":"rgba(255,255,255,0.05)",
            border:"1.5px solid "+(avatar===a?"#3B82F6":"rgba(255,255,255,0.1)"),
            cursor:"pointer",transition:"all 0.15s",
          }}>{a}</button>
        ))}
      </div>
      <SettingsInput label="DISPLAY NAME" value={name} onChange={setName} placeholder="Your name"/>
      <SettingsInput label="BIO" value={bio} onChange={setBio} placeholder="Tell people about yourself" multiline/>
      <button onClick={()=>onSave({name,bio,avatar})} style={{
        width:"100%",height:50,borderRadius:14,
        background:"#3B82F6",border:"none",
        color:"#fff",fontSize:15,fontWeight:700,
        fontFamily:"'Inter',sans-serif",cursor:"pointer",
      }}>Save Changes</button>
    </SettingsSubPage>
  );
}

// Privacy settings

// ─── Standalone Toggle — used by Settings sub-pages ───────────────────────────
function Toggle({ value, onChange }) {
  return (
    <div onClick={()=>onChange(!value)} style={{width:44,height:26,borderRadius:99,background:value?"#3B82F6":"#1A2D4A",position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0}}>
      <div style={{position:"absolute",top:3,left:value?20:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/>
    </div>
  );
}

function PrivacySettingsPage({ onBack }) {
  const t = useTheme();
  const [privateProfile, setPrivateProfile] = useState(false);
  const [hideBets, setHideBets] = useState(false);
  const [hideBalance, setHideBalance] = useState(true);
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(true);
  const rows = [
    ["Private Profile", "Only followers see your activity", privateProfile, setPrivateProfile],
    ["Hide My Bets", "Don't show bets on your profile", hideBets, setHideBets],
    ["Hide Balance", "Mask your wallet balance", hideBalance, setHideBalance],
    ["Leaderboard Visibility", "Appear in public rankings", showOnLeaderboard, setShowOnLeaderboard],
  ];
  return (
    <SettingsSubPage title="Privacy" onBack={onBack}>
      <div style={{background:t.bgCard,borderRadius:16,padding:"0 16px"}}>
        {rows.map(([label,sub,val,set],i)=>(
          <div key={label} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 0",borderBottom:i<rows.length-1?"1px solid "+t.borderSub:"none"}}>
            <div style={{flex:1}}>
              <div style={{color:t.text,fontSize:14,fontFamily:"'Inter',sans-serif"}}>{label}</div>
              <div style={{color:t.textMuted,fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:2}}>{sub}</div>
            </div>
            <Toggle value={val} onChange={set}/>
          </div>
        ))}
      </div>
    </SettingsSubPage>
  );
}

// Connected accounts
function ConnectedAccountsPage({ onBack }) {
  const t = useTheme();
  const [connected, setConnected] = useState({twitter:false, discord:true, telegram:false});
  const accounts = [
    ["🐦","Twitter / X","Share predictions automatically","twitter"],
    ["🎮","Discord","Join the Supreme Markets server","discord"],
    ["✈️","Telegram","Get alerts via Telegram","telegram"],
  ];
  return (
    <SettingsSubPage title="Connected Accounts" onBack={onBack}>
      <div style={{background:t.bgCard,borderRadius:16,overflow:"hidden"}}>
        {accounts.map(([icon,name,sub,key],i)=>(
          <div key={key} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:i<accounts.length-1?"1px solid "+t.borderSub:"none"}}>
            <span style={{fontSize:24,flexShrink:0}}>{icon}</span>
            <div style={{flex:1}}>
              <div style={{color:t.text,fontSize:14,fontFamily:"'Inter',sans-serif",fontWeight:600}}>{name}</div>
              <div style={{color:t.textMuted,fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:2}}>{sub}</div>
            </div>
            <button onClick={()=>setConnected(c=>({...c,[key]:!c[key]}))} style={{
              padding:"7px 16px",borderRadius:99,
              background:connected[key]?"rgba(249,61,61,0.15)":"rgba(59,130,246,0.15)",
              border:"1px solid "+(connected[key]?"rgba(249,61,61,0.3)":"rgba(59,130,246,0.3)"),
              color:connected[key]?"#f93d3d":"#3B82F6",
              fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif",cursor:"pointer",
            }}>
              {connected[key]?"Disconnect":"Connect"}
            </button>
          </div>
        ))}
      </div>
      {connected.discord && (
        <div style={{marginTop:16,background:"rgba(88,101,242,0.1)",border:"1px solid rgba(88,101,242,0.25)",borderRadius:14,padding:"14px 16px"}}>
          <div style={{color:"#7289DA",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:4}}>Discord Connected</div>
          <div style={{color:"rgba(255,255,255,0.4)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>Joined Supreme Markets server · #predictions channel active</div>
        </div>
      )}
    </SettingsSubPage>
  );
}

// Email settings
function EmailSettingsPage({ onBack }) {
  const t = useTheme();
  const [email, setEmail] = useState("user@example.com");
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [saved, setSaved] = useState(false);
  const handleSave = () => {
    if (!newEmail.includes("@")) return;
    setEmail(newEmail);
    setEditing(false);
    setSaved(true);
    setTimeout(()=>setSaved(false), 2000);
  };
  return (
    <SettingsSubPage title="Email" onBack={onBack}>
      <div style={{background:t.bgCard,borderRadius:16,padding:"16px"}}>
        <div style={{color:t.textMuted,fontSize:11,letterSpacing:1,fontFamily:"'Inter',sans-serif",marginBottom:6}}>CURRENT EMAIL</div>
        <div style={{color:t.text,fontSize:16,fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:16}}>{email}</div>
        {!editing ? (
          <button onClick={()=>{setEditing(true);setNewEmail(email);}} style={{width:"100%",height:44,borderRadius:12,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",color:t.textSub,fontSize:14,fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>
            Change Email
          </button>
        ) : (
          <>
            <SettingsInput label="NEW EMAIL" value={newEmail} onChange={setNewEmail} placeholder="your@email.com"/>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setEditing(false)} style={{flex:1,height:44,borderRadius:12,background:"transparent",border:"1px solid rgba(255,255,255,0.1)",color:t.textSub,fontSize:14,fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>Cancel</button>
              <button onClick={handleSave} style={{flex:1,height:44,borderRadius:12,background:"#3B82F6",border:"none",color:"#fff",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>Save</button>
            </div>
          </>
        )}
        {saved && <div style={{color:"#3B82F6",fontSize:12,textAlign:"center",marginTop:10,fontFamily:"'Inter',sans-serif"}}>✓ Email updated</div>}
      </div>
      <div style={{marginTop:16,background:t.bgCard,borderRadius:16,overflow:"hidden"}}>
        {[["Weekly digest","Summary of your predictions"],["Market alerts","Notify when saved markets close"],["Promo emails","News and offers"]].map(([label,sub],i,arr)=>(
          <div key={label} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:i<arr.length-1?"1px solid "+t.borderSub:"none"}}>
            <div style={{flex:1}}>
              <div style={{color:t.text,fontSize:14,fontFamily:"'Inter',sans-serif"}}>{label}</div>
              <div style={{color:t.textMuted,fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:2}}>{sub}</div>
            </div>
            <Toggle value={i<2} onChange={()=>{}}/>
          </div>
        ))}
      </div>
    </SettingsSubPage>
  );
}

function SettingsPage({ onClose, balance, quickBetPresets=[], setQuickBetPresets, maxBetSetting=100, setMaxBetSetting, propAccounts=[], darkMode, setDarkMode, profileData, onSaveProfile }) {
  const t = useTheme();
  const [subPage, setSubPage] = useState(null); // "profile"|"privacy"|"accounts"|"email"
  const [notifEnabled,    setNotifEnabled]    = useState(true);
  const [oddsAlerts,      setOddsAlerts]      = useState(true);
  const [winAlerts,       setWinAlerts]       = useState(true);
  const [followAlerts,    setFollowAlerts]    = useState(false);
  const [compactFeed,     setCompactFeed]     = useState(false);
  const [autoSkipAds,     setAutoSkipAds]     = useState(false);
  const [betConfirm,      setBetConfirm]      = useState(true);
  const [editingPreset,   setEditingPreset]   = useState(null);
  const [presetInput,     setPresetInput]     = useState("");

  // Max bet is capped by account balance + prop accounts
  const propBalance = (propAccounts||[]).filter(a=>a.funded).reduce((s,a)=>{
    const tier = PROP_TIERS.find(t=>t.id===a.tierId);
    return s + (tier?.balance||0);
  }, 0);
  const totalAvailable = balance + propBalance;
  const hardCap = Math.min(100000, Math.max(totalAvailable, 1));
  const displayMax = maxBetSetting || 100;

  // Slider: log scale up to hardCap for finer control at low values
  const sliderToValue = (s) => {
    const logMax = Math.log(hardCap + 1);
    return Math.round(Math.exp(s / 1000 * logMax) - 1);
  };
  const valueToSlider = (v) => {
    if (hardCap <= 0) return 0;
    const logMax = Math.log(hardCap + 1);
    return Math.round((Math.log(v + 1) / logMax) * 1000);
  };

  const Toggle = ({ value, onChange }) => (
    <div onClick={()=>onChange(!value)} style={{width:44,height:24,borderRadius:99,background:value?"#3B82F6":t.toggleOff,position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0}}>
      <div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:value?22:2,transition:"left 0.2s",boxShadow:"0 1px 4px rgba(10,22,40,0.45)"}}/>
    </div>
  );

  const SettingRow = ({ label, sub, value, onChange }) => (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0",borderBottom:"1px solid "+(t.borderSub)}}>
      <div>
        <div style={{color:t.text,fontSize:14,fontFamily:"'Inter',sans-serif"}}>{label}</div>
        {sub&&<div style={{color:t.textMuted,fontSize:12,fontFamily:"'Inter',sans-serif",marginTop:2}}>{sub}</div>}
      </div>
      <Toggle value={value} onChange={onChange}/>
    </div>
  );

  const savePreset = (idx) => {
    const val = parseFloat(presetInput);
    if (isNaN(val) || val <= 0) return;
    const capped = Math.min(val, hardCap);
    const next = [...quickBetPresets];
    next[idx] = capped;
    setQuickBetPresets && setQuickBetPresets(next.sort((a,b)=>a-b));
    setEditingPreset(null);
    setPresetInput("");
  };

  return (
    <>
    <div style={{height:"100%",overflowY:"auto",background:t.bgOverlay}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px",position:"sticky",top:0,background:t.bgOverlay,zIndex:10,borderBottom:"1px solid "+t.border}}>
        <button onClick={onClose} style={{width:36,height:36,borderRadius:12,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.15)",color:"#FFFFFF",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:20,lineHeight:1,color:"#FFFFFF",fontWeight:300}}>‹</span></button>
        <span style={{color:t.text,fontWeight:700,fontSize:16,fontFamily:"'Inter',sans-serif"}}>Settings</span>
      </div>

      <div style={{padding:"16px 16px 100px"}}>

        {/* Account */}
        <SectionLabel>ACCOUNT</SectionLabel>
        <div style={{background:t.bgCard,borderRadius:14,marginBottom:20}}>
          {[
            ["👤","Profile","Edit name, bio, avatar","profile"],
            ["🔒","Privacy","Control who sees your bets","privacy"],
            ["🔗","Connected Accounts","Link Twitter, Discord","accounts"],
            ["📧","Email","Change notification email","email"],
          ].map(([icon,label,sub,page],i,arr)=>(
            <div key={label} onClick={e=>{e.stopPropagation();if(!subPage)setSubPage(page);}} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:i<arr.length-1?"1px solid "+(t.borderSub):"none",cursor:"pointer",transition:"background 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.03)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}
            >
              <span style={{fontSize:20}}>{icon}</span>
              <div style={{flex:1}}>
                <div style={{color:t.text,fontSize:14,fontFamily:"'Inter',sans-serif"}}>{label}</div>
                <div style={{color:t.textMuted,fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:2}}>{sub}</div>
              </div>
              <span style={{color:t.textFaint,fontSize:18,fontWeight:300}}>›</span>
            </div>
          ))}
        </div>

        {/* Notifications */}
        <SectionLabel>NOTIFICATIONS</SectionLabel>
        <div style={{background:t.bgCard,borderRadius:16,padding:"0 16px",marginBottom:20}}>
          <SettingRow label="All Notifications" sub="Master toggle" value={notifEnabled} onChange={setNotifEnabled}/>
          <SettingRow label="Odds Alerts" sub="Notify when odds shift >5%" value={oddsAlerts} onChange={setOddsAlerts}/>
          <SettingRow label="Win Alerts" sub="When your predictions resolve" value={winAlerts} onChange={setWinAlerts}/>
          <SettingRow label="New Followers" sub="When someone follows you" value={followAlerts} onChange={setFollowAlerts}/>
        </div>

        {/* ── BETTING SETTINGS ── */}
        <SectionLabel>BETTING</SectionLabel>
        <div style={{background:t.bgCard,borderRadius:14,padding:"0 16px",marginBottom:12}}>
          <SettingRow label="Confirm Before Bet" sub="Show confirmation modal" value={betConfirm} onChange={setBetConfirm}/>
        </div>

        {/* Max Bet Slider */}
        <div style={{background:t.bgCard,borderRadius:14,padding:"18px 16px",marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div>
              <div style={{color:t.text,fontSize:14,fontFamily:"'Inter',sans-serif",fontWeight:700}}>Max Bet Per Market</div>
              <div style={{color:t.textMuted,fontSize:10,fontFamily:"'Inter',sans-serif",marginTop:2}}>
                CAPPED BY YOUR BALANCE · ${totalAvailable.toFixed(0)} AVAILABLE
              </div>
            </div>
            <div style={{background:"rgba(20,158,99,0.12)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:10,padding:"5px 12px"}}>
              <span style={{color:"#3B82F6",fontSize:16,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>${displayMax.toLocaleString()}</span>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={1000}
            value={valueToSlider(displayMax)}
            onChange={e => {
              const v = sliderToValue(parseInt(e.target.value));
              const capped = Math.min(v, Math.floor(totalAvailable));
              setMaxBetSetting && setMaxBetSetting(Math.max(1, capped));
            }}
            style={{width:"100%",accentColor:"#3B82F6",cursor:"pointer",marginBottom:8}}
          />
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{color:t.textFaint,fontSize:10,fontFamily:"'Inter',sans-serif"}}>$1</span>
            <span style={{color:t.textFaint,fontSize:10,fontFamily:"'Inter',sans-serif"}}>
              ${Math.floor(totalAvailable).toLocaleString()} max
            </span>
          </div>
          {(propAccounts||[]).some(a=>a.funded) && (
            <div style={{background:"rgba(0,229,255,0.06)",border:"1px solid rgba(0,229,255,0.094)",borderRadius:8,padding:"6px 10px",marginTop:8}}>
              <span style={{color:"#00E5FF",fontSize:10,fontFamily:"'Inter',sans-serif"}}>
                ⚡ Prop firm balance included: +${propBalance.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Quick Bet Presets */}
        <div style={{background:"#0F2040",borderRadius:14,padding:"18px 16px",marginBottom:20}}>
          <div style={{marginBottom:12}}>
            <div style={{color:"rgba(255,255,255,0.72)",fontSize:14,fontFamily:"'Inter',sans-serif",fontWeight:700,marginBottom:2}}>Quick Bet Presets</div>
            <div style={{color:"rgba(255,255,255,0.25)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>TAP ANY PRESET TO EDIT · SHOWS IN BET MODAL</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
            {(quickBetPresets.length>0?quickBetPresets:[1,5,10,25]).map((v,i)=>(
              <div key={i}>
                {editingPreset===i ? (
                  <div style={{background:"#0F2040",border:"1px solid #3B82F6",borderRadius:10,padding:"4px 6px",display:"flex",gap:4,gridColumn:"span 1"}}>
                    <input
                      autoFocus
                      type="number"
                      value={presetInput}
                      onChange={e=>setPresetInput(e.target.value)}
                      onKeyDown={e=>{ if(e.key==="Enter") savePreset(i); if(e.key==="Escape") setEditingPreset(null); }}
                      placeholder="$"
                      style={{flex:1,background:"transparent",border:"none",color:"#3B82F6",fontSize:12,fontFamily:"'Inter',sans-serif",outline:"none",width:"100%",minWidth:0}}
                    />
                    <button onClick={()=>savePreset(i)} style={{background:"#3B82F6",border:"none",borderRadius:6,color:"#FFFFFF",fontSize:10,padding:"2px 5px",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:700}}>✓</button>
                  </div>
                ) : (
                  <button
                    onClick={()=>{ setEditingPreset(i); setPresetInput(String(v)); }}
                    style={{width:"100%",height:44,borderRadius:10,border:"1px solid "+(t.borderMed),background:t.bgSubtle,color:t.textSub,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.15s",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}
                  >
                    <span style={{color:"#3B82F6"}}>${v}</span>
                    <span style={{color:t.textFaint,fontSize:8,letterSpacing:0.5}}>EDIT</span>
                  </button>
                )}
              </div>
            ))}
          </div>
          <div style={{color:t.textFaint,fontSize:10,fontFamily:"'Inter',sans-serif",marginTop:10,textAlign:"center"}}>
            Presets are capped to your max bet · ${displayMax.toLocaleString()} current max
          </div>
        </div>

        {/* Display */}
        <SectionLabel>DISPLAY</SectionLabel>
        <div style={{background:t.bgCard,borderRadius:14,padding:"0 16px",marginBottom:20}}>
          <SettingRow label="Dark Mode" sub="Toggle light / dark theme" value={darkMode} onChange={setDarkMode}/>
          <SettingRow label="Compact Feed" sub="Show more cards at once" value={compactFeed} onChange={setCompactFeed}/>
          <SettingRow label="Auto-Skip Ads" sub="Skip ads automatically" value={autoSkipAds} onChange={setAutoSkipAds}/>
        </div>

        {/* Danger zone */}
        <SectionLabel>ACCOUNT ACTIONS</SectionLabel>
        <div style={{background:t.bgCard,borderRadius:14,overflow:"hidden",marginBottom:20}}>
          {[["📤","Export My Data","Download all your data"],["🔕","Mute All Creators","Temporarily mute feed"],["⚠️","Delete Account","Permanently delete account","#f93d3d"]].map(([icon,label,sub,col])=>(
            <div key={label} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:"1px solid "+(t.borderSub),cursor:"pointer"}}>
              <div style={{width:36,height:36,borderRadius:10,background:col?"rgba(249,61,61,0.1)":t.bgHover,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{icon}</div>
              <div style={{flex:1}}>
                <div style={{color:col||t.text,fontSize:14,fontFamily:"'Inter',sans-serif"}}>{label}</div>
                <div style={{color:t.textMuted,fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:2}}>{sub}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke={t.textFaint} strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
          ))}
        </div>

        <div style={{textAlign:"center",padding:"10px 0"}}>
          <div style={{fontSize:28,marginBottom:6}}>⚡</div>
          <div style={{color:t.text,fontWeight:900,fontFamily:"'Inter',sans-serif",fontSize:15}}>PredictSwipe</div>
          <div style={{color:t.textMuted,fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:4}}>Version 1.2.0</div>
        </div>
      </div>
    </div>

    {/* Settings sub-pages */}
    {subPage === "profile"  && <ProfileSettingsPage profileData={profileData} onSave={(data)=>{ onSaveProfile&&onSaveProfile(data); setSubPage(null); }} onBack={()=>setSubPage(null)}/>}
    {subPage === "privacy"  && <PrivacySettingsPage onBack={()=>setSubPage(null)}/>}
    {subPage === "accounts" && <ConnectedAccountsPage onBack={()=>setSubPage(null)}/>}
    {subPage === "email"    && <EmailSettingsPage onBack={()=>setSubPage(null)}/>}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function AdminPage({
votes, balance, resolvedBets={}, propAccounts=[] }) {
  const ALL_PREDS = usePredictions();
  const [activeTab,setActiveTab]=useState("overview");
  const [resolveId,setResolveId]=useState(null);
  const [resolvedPreds,setResolvedPreds]=useState([]);

  // Real stats from actual data
  const totalBets = Object.keys(votes||{}).length;
  const totalVolume = Object.values(votes||{}).reduce((s,v)=>s+(v.amount||1),0);
  const houseRake = totalVolume * 0.05;
  const resolvedCount = Object.keys(resolvedBets).length;
  const winningBets = Object.entries(votes||{}).filter(([id,v]) => resolvedBets[id] === v.pos).length;
  const propRevenue = (propAccounts||[]).reduce((s,a) => {
    const tier = [49,79,116,350,490,720].find((_,i) => i < (propAccounts||[]).length) || 49;
    return s + (a.resets||0)*tier*0.8;
  }, 0);

  // Daily bets (last 7 days) — from real vote timestamps
  const now = Date.now();
  const dailyBets = Array.from({length:7}, (_,i) => {
    const dayStart = now - (6-i)*86400000;
    const dayEnd = dayStart + 86400000;
    return Object.values(votes).filter(v => (v.placedAt||0) >= dayStart && (v.placedAt||0) < dayEnd).length;
  });
  const dayLabels = Array.from({length:7}, (_,i) => {
    const d = new Date(now - (6-i)*86400000);
    return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
  });

  const statCards = [
    { icon:"👥", label:"Total Users",    val:"12,481",    sub:"+142 today",     color:"#00E5FF" },
    { icon:"🎯", label:"Active Markets", val:ALL_PREDS.length, sub:ALL_PREDS.filter(p=>p.hot).length+" trending", color:"#3B82F6" },
    { icon:"💰", label:"Total Volume",   val:"$"+((totalVolume+284200).toLocaleString()), sub:"All time", color:"#F4C430" },
    { icon:"🏠", label:"House Rake",     val:"$"+((houseRake+14210).toFixed(0)), sub:"5% of volume", color:"#7c4dcc" },
    { icon:"✅", label:"Resolved Bets",  val:resolvedCount + RESOLVED_PREDICTIONS.length, sub:"Win rate: "+(totalBets>0?Math.round(winningBets/Math.max(resolvedCount,1)*100):0)+"%", color:"#00c9a7" },
    { icon:"🏦", label:"Prop Revenue",   val:"$"+(propRevenue+4820).toFixed(0), sub:(propAccounts||[]).length+" active accounts", color:"#F4C430" },
  ];

  return (
    <div style={{height:"100%",overflowY:"auto",background:"#0A1628"}}>
      <div style={{padding:"20px 16px 0",position:"sticky",top:0,background:"#0A1628",zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
          <div style={{width:28,height:28,background:"#3B82F6",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>⚡</div>
          <div>
            <h2 style={{fontSize:18,fontWeight:900,color:"#FFFFFF",fontFamily:"'Inter',sans-serif",lineHeight:1}}>Admin Dashboard</h2>
            <div style={{color:"rgba(255,255,255,0.25)",fontSize:10,fontFamily:"'Inter',sans-serif",letterSpacing:1}}>PREDICTSWIPE · INTERNAL</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:4,overflowX:"auto"}}>
          {["overview","markets","users","revenue"].map(t=>(
            <button key={t} onClick={()=>setActiveTab(t)} style={{background:activeTab===t?"#3B82F6":"#1A2D4A",border:"none",borderRadius:20,color:activeTab===t?"#000":"rgba(255,255,255,0.22)",fontSize:11,fontWeight:700,padding:"5px 12px",cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:1,textTransform:"uppercase",transition:"all 0.2s",flexShrink:0,whiteSpace:"nowrap"}}>{t}</button>
          ))}
        </div>
      </div>

      {/* Create Market full-page overlay within admin */}
      {activeTab==="create" && (
        <CreatePageV2 onClose={()=>setActiveTab("markets")} onPublish={()=>setActiveTab("markets")}/>
      )}

      <div style={{padding:"12px 16px 100px"}}>

        {/* OVERVIEW */}
        {activeTab==="overview"&&(<>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
            {statCards.map(s=>(
              <div key={s.label} style={{background:"#0F2040",borderRadius:14,padding:"14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <span style={{fontSize:20}}>{s.icon}</span>
                  <span style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>{s.sub}</span>
                </div>
                <div style={{color:s.color,fontSize:22,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{s.val}</div>
                <div style={{color:"rgba(255,255,255,0.25)",fontSize:10,fontFamily:"'Inter',sans-serif",marginTop:2,letterSpacing:1}}>{s.label.toUpperCase()}</div>
              </div>
            ))}
          </div>

          {/* Real activity chart */}
          <SectionLabel>DAILY BETS (LAST 7 DAYS)</SectionLabel>
          <div style={{background:"#0F2040",borderRadius:14,padding:"16px",marginBottom:20}}>
            <div style={{display:"flex",alignItems:"flex-end",gap:6,height:80,marginBottom:8}}>
              {dailyBets.map((count,i) => {
                const maxCount = Math.max(...dailyBets, 1);
                const h = Math.max(4, Math.round((count/maxCount)*72));
                return (
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                    <div style={{width:"100%",height:h,background:"rgba(20,158,99,0.6)",borderRadius:"4px 4px 0 0",transition:"height 0.4s ease"}}/>
                    <span style={{color:"rgba(255,255,255,0.25)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>{dayLabels[i]}</span>
                  </div>
                );
              })}
            </div>
            <div style={{color:"rgba(255,255,255,0.3)",fontSize:11,fontFamily:"'Inter',sans-serif",textAlign:"center"}}>{totalBets} total bets placed</div>
          </div>

          {/* Recent bets */}
          <SectionLabel>RECENT ACTIVITY</SectionLabel>
          {[
            { user:"@satoshi_x",  action:"Bet YES $50 on BTC $150k",      time:"2m ago",  color:"#3B82F6" },
            { user:"@moonboy99",  action:"Bet NO $10 on Fed rate cuts",    time:"4m ago",  color:"#f93d3d" },
            { user:"@alpha_trader",action:"New account created",           time:"7m ago",  color:"#00E5FF" },
            { user:"@degenmode",  action:"Bet YES $25 on Argentina WC",    time:"12m ago", color:"#3B82F6" },
            { user:"@yolo_labs",  action:"Withdrew $124.50",               time:"18m ago", color:"#F4C430" },
          ].map((a,i)=>(
            <div key={i} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:"1px solid #0F2040",alignItems:"center"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:a.color,flexShrink:0}}/>
              <div style={{flex:1}}>
                <span style={{color:"#3B82F6",fontSize:12,fontFamily:"'Inter',sans-serif"}}>{a.user}</span>
                <span style={{color:"#6a8090",fontSize:12,fontFamily:"'Inter',sans-serif"}}> {a.action}</span>
              </div>
              <span style={{color:"rgba(255,255,255,0.2)",fontSize:11,fontFamily:"'Inter',sans-serif",flexShrink:0}}>{a.time}</span>
            </div>
          ))}
        </>)}

        {/* MARKETS */}
        {activeTab==="markets"&&(<>
          <button onClick={()=>setActiveTab("create")} style={{width:"100%",background:"linear-gradient(135deg,rgba(59,130,246,0.12),rgba(59,130,246,0.06))",border:"1px solid rgba(59,130,246,0.25)",borderRadius:14,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,marginBottom:16,textAlign:"left"}}>
            <div style={{width:38,height:38,borderRadius:12,background:"#3B82F6",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#000" strokeWidth="2.2" strokeLinecap="round"/></svg>
            </div>
            <div style={{flex:1}}>
              <div style={{color:"#3B82F6",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>Create New Market</div>
              <div style={{color:"rgba(59,130,246,0.5)",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:1}}>Publish a new prediction market</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="rgba(59,130,246,0.5)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <SectionLabel>ALL ACTIVE MARKETS</SectionLabel>
          {ALL_PREDS.map(pred=>(
            <div key={pred.id} style={{background:"#0F2040",borderRadius:14,padding:"12px 14px",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div style={{flex:1,marginRight:8}}>
                  <div style={{display:"flex",gap:6,marginBottom:4}}>
                    <Badge color={CATEGORY_META[pred.category]?.color||"rgba(255,255,255,0.42)"}>{pred.category}</Badge>
                    {pred.hot&&<Badge color="#F4C430">HOT</Badge>}
                  </div>
                  <div style={{color:"#c8dae8",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif",lineHeight:1.3}}>{pred.title}</div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  {!resolvedPreds.includes(pred.id) ? (
                    <button onClick={()=>setResolveId(pred.id)} style={{background:"rgba(20,158,99,0.1)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:8,color:"#3B82F6",fontSize:10,padding:"4px 10px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Resolve</button>
                  ) : (
                    <Badge color="#3B82F6">Resolved</Badge>
                  )}
                </div>
              </div>
              <div style={{display:"flex",gap:12}}>
                <span style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>Pool: {pred.pool}</span>
                <span style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>Bettors: {pred.bettors}</span>
                <span style={{color:"#3B82F6",fontSize:11,fontFamily:"'Inter',sans-serif",fontWeight:700}}>YES {pred.yesPct}%</span>
              </div>
            </div>
          ))}
        </>)}

        {/* USERS */}
        {activeTab==="users"&&(<>
          <SectionLabel>TOP CREATORS BY VOLUME</SectionLabel>
          {Object.values(CREATOR_PROFILES).map((c,i)=>(
            <div key={c.handle} style={{background:"#0F2040",borderRadius:14,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:c.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{c.avatar}</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{color:"#FFFFFF",fontWeight:700,fontSize:13,fontFamily:"'Inter',sans-serif"}}>@{c.handle}</span>
                  {c.verified&&<span style={{color:"#00E5FF",fontSize:11}}>✓</span>}
                </div>
                <div style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:1}}>{c.followers} followers · {c.accuracy} accuracy</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{color:"#3B82F6",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{c.totalVolume}</div>
                <div style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>volume</div>
              </div>
            </div>
          ))}
        </>)}

        {/* REVENUE */}
        {activeTab==="revenue"&&(<>
          <div style={{background:"linear-gradient(135deg,#0a1f0a,#0d2617)",borderRadius:16,border:"1px solid rgba(59,130,246,0.133)",padding:"20px",marginBottom:20}}>
            <div style={{color:"rgba(255,255,255,0.25)",fontSize:10,fontFamily:"'Inter',sans-serif",letterSpacing:2,marginBottom:8}}>TOTAL REVENUE (ALL TIME)</div>
            <div style={{color:"#3B82F6",fontSize:44,fontWeight:900,fontFamily:"'Inter',sans-serif",lineHeight:1}}>${(houseRake+14210+propRevenue).toFixed(0)}</div>
            <div style={{color:"rgba(255,255,255,0.3)",fontSize:12,fontFamily:"'Inter',sans-serif",marginTop:6}}>5% rake on ${(totalVolume+284200).toLocaleString()} total volume + prop fees</div>
          </div>
          <SectionLabel>REVENUE BREAKDOWN</SectionLabel>
          {[
            ["Rake (5%)", "$"+(houseRake+14210).toFixed(0),"#3B82F6", Math.round((houseRake+14210)/(houseRake+14210+propRevenue+3200+1340)*100)+"%"],
            ["Prop Firm Fees","$"+(propRevenue+4820).toFixed(0),"#F4C430", Math.round((propRevenue+4820)/(houseRake+14210+propRevenue+3200+1340)*100)+"%"],
            ["Ad Revenue","$3,200","#F4C430","—"],
            ["Premium Subs","$1,340","#7c4dcc","—"],
          ].map(([l,v,c,pct])=>(
            <div key={l} style={{background:"#0F2040",borderRadius:14,padding:"14px 16px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:c,boxShadow:"0 0 8px "+(c)}}/>
                <span style={{color:"rgba(255,255,255,0.72)",fontSize:14,fontFamily:"'Inter',sans-serif"}}>{l}</span>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{color:c,fontSize:15,fontWeight:800,fontFamily:"'Inter',sans-serif"}}>{v}</div>
                <div style={{color:"rgba(255,255,255,0.2)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>{pct} of total</div>
              </div>
            </div>
          ))}
        </>)}
      </div>

      {/* Resolve modal */}
      {resolveId&&(
        <div style={{position:"fixed",inset:0,zIndex:100,maxWidth:430,margin:"0 auto"}}>
          <Sheet onClose={()=>setResolveId(null)} title="✅ Resolve Market">
            {(() => {
              const pred = ALL_PREDS.find(p=>p.id===resolveId);
              if (!pred) return null;
              return (<>
                <div style={{background:"#0F2040",borderRadius:12,padding:"14px",marginBottom:20}}>
                  <div style={{color:"rgba(255,255,255,0.72)",fontSize:13,fontFamily:"'Inter',sans-serif",lineHeight:1.4}}>{pred.title}</div>
                  <div style={{display:"flex",gap:8,marginTop:10}}>
                    <span style={{color:"#3B82F6",fontSize:12,fontFamily:"'Inter',sans-serif",fontWeight:700}}>YES {pred.yesPct}%</span>
                    <span style={{color:"#f93d3d",fontSize:12,fontFamily:"'Inter',sans-serif",fontWeight:700}}>NO {100-pred.yesPct}%</span>
                    <span style={{color:"rgba(255,255,255,0.25)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>Pool: {pred.pool}</span>
                  </div>
                </div>
                <SectionLabel>SELECT OUTCOME</SectionLabel>
                <div style={{display:"flex",gap:10,marginBottom:20}}>
                  <button onClick={()=>{setResolvedPreds(r=>[...r,resolveId]);setResolveId(null);}} style={{flex:1,height:52,borderRadius:99,background:"rgba(20,158,99,0.85)",border:"none",color:"#FFFFFF",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>✓ YES Wins</button>
                  <button onClick={()=>{setResolvedPreds(r=>[...r,resolveId]);setResolveId(null);}} style={{flex:1,height:52,borderRadius:99,background:"rgba(153,27,27,0.85)",border:"none",color:"#FFFFFF",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>✕ NO Wins</button>
                </div>
                <div style={{color:"rgba(255,255,255,0.2)",fontSize:11,fontFamily:"'Inter',sans-serif",textAlign:"center"}}>Payouts will be distributed automatically after resolution</div>
              </>);
            })()}
          </Sheet>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WATCHLIST PAGE
// ─────────────────────────────────────────────────────────────────────────────
function WatchlistPage({
watchlist, onRemove, votes, onVote, balance, onOpenCreator, onClose }) {
  const ALL_PREDS = usePredictions();
  const watched = ALL_PREDS.filter(p => watchlist.includes(p.id));
  const [showBet, setShowBet] = useState(null);
  const [showConfirm, setShowConfirm] = useState(null);
  const [showAlert, setShowAlert] = useState(null);
  const [localPcts, setLocalPcts] = useState({});
  const [alerts, setAlerts] = useState({});

  const getPct = (pred) => localPcts[pred.id] ?? pred.yesPct;

  const handleBet = (pred, pos) => setShowBet({ pred, pos });
  const handleConfirm = (amount) => {
    const { pred, pos } = showBet;
    onVote(pred.id, pos, amount);
    setLocalPcts(lp => ({ ...lp, [pred.id]: pos==="YES" ? Math.min(99,(getPct(pred)+1)) : Math.max(1,(getPct(pred)-1)) }));
    setShowConfirm({ pos: showBet.pos, amount, betId:"BET-"+(showBet?.pred?.id||"")+"-"+(Date.now().toString(36).toUpperCase().slice(-6)) });
    setShowBet(null);
  };

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:"#0A1628"}}>
      <OverlayHeader title="🔖 Watchlist" onBack={onClose}/>
      <div style={{padding:"8px 16px 4px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        {watched.length > 0
          ? <span style={{color:"#3B82F6",fontSize:11,fontFamily:"'Inter',sans-serif",fontWeight:700,background:"rgba(20,158,99,0.1)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:20,padding:"3px 10px"}}>{watched.length} SAVED</span>
          : <span/>}
        <span style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif",letterSpacing:1}}>TAP 🔔 FOR ALERTS</span>
      </div>
      <div style={{flex:1,overflowY:"auto"}}>

      {watched.length === 0 ? (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60%",gap:14,padding:24}}>
          <div style={{fontSize:60,opacity:0.2}}>🔖</div>
          <div style={{color:"rgba(255,255,255,0.42)",fontFamily:"'Inter',sans-serif",fontSize:13,textAlign:"center",lineHeight:1.6}}>
            No saved predictions yet.<br/>Tap 🔖 on any card to save it here.
          </div>
        </div>
      ) : (
        <div style={{padding:"4px 16px 100px"}}>
          {watched.map(pred => {
            const yp = getPct(pred);
            const vote = votes[pred.id];
            const trendColor = pred.trendDir==="up" ? "#3B82F6" : "#f93d3d";
            const hasAlert = alerts[pred.id];
            return (
              <div key={pred.id} style={{background:"#0F2040",borderRadius:20,overflow:"hidden",marginBottom:14,border:"1px solid "+(hasAlert?"rgba(59,130,246,0.2)":"#1A2D4A"),position:"relative"}}>
                {/* Image strip */}
                <div style={{position:"relative",height:120}}>
                  <PredImage pred={pred} style={{width:"100%",height:"100%"}}/>
                  <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.88) 0%,transparent 60%)"}}/>
                  {/* Remove btn */}
                  <button onClick={()=>onRemove(pred.id)} style={{position:"absolute",top:10,right:10,background:"rgba(10,22,40,0.72)",border:"none",borderRadius:"50%",width:32,height:32,color:"rgba(255,255,255,0.42)",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}}>✕</button>
                  {/* Alert indicator */}
                  {hasAlert && <div style={{position:"absolute",top:10,left:12,background:"rgba(20,158,99,0.85)",borderRadius:20,padding:"3px 10px",backdropFilter:"blur(4px)"}}><span style={{color:"#000",fontSize:10,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>🔔 ALERT SET</span></div>}
                  {/* Odds badge */}
                  <div style={{position:"absolute",bottom:10,left:12,display:"flex",alignItems:"center",gap:6}}>
                    <div style={{background:"rgba(0,0,0,0.7)",borderRadius:20,padding:"4px 10px",display:"flex",alignItems:"center",gap:6,backdropFilter:"blur(4px)"}}>
                      <Sparkline data={pred.chartData} color={trendColor} width={30} height={10}/>
                      <span style={{color:trendColor,fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{yp}% YES</span>
                    </div>
                    <div style={{background:(trendColor)+"22",border:"1px solid "+(trendColor)+"44",borderRadius:20,padding:"4px 10px"}}>
                      <span style={{color:trendColor,fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{pred.trendDir==="up"?"↗":"↘"} {pred.trend}</span>
                    </div>
                  </div>
                </div>

                <div style={{padding:"12px 14px 14px"}}>
                  {/* Creator + category */}
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                    <button onClick={()=>onOpenCreator(pred.creator.handle)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6,padding:0}}>
                      <Avatar emoji={pred.creator.avatar} color={pred.creator.color} size={22}/>
                      <span style={{color:"#6a8090",fontSize:11,fontFamily:"'Inter',sans-serif"}}>@{pred.creator.handle}</span>
                    </button>
                    <Badge color={CATEGORY_META[pred.category]?.color||"rgba(255,255,255,0.42)"}>{pred.category}</Badge>
                    {pred.hot && <Badge color="#F4C430">HOT</Badge>}
                  </div>
                  <h3 style={{color:"#FFFFFF",fontSize:14,fontWeight:800,lineHeight:1.35,fontFamily:"'Inter',sans-serif",marginBottom:10}}>{pred.title}</h3>

                  {/* Odds bar */}
                  <div style={{height:4,background:"#1A2D4A",borderRadius:99,overflow:"hidden",marginBottom:8}}>
                    <div style={{height:"100%",width:(yp)+"%",background:"linear-gradient(90deg,#2F805A,#2d5c41)",borderRadius:99,transition:"width 0.6s ease"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                    <span style={{color:"#3B82F6",fontSize:11,fontFamily:"'Inter',sans-serif",fontWeight:700}}>YES {yp}%</span>
                    <div style={{display:"flex",gap:8}}>
                      <span style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>💰 {pred.pool}</span>
                      <span style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>⏱ {pred.daysLeft}</span>
                    </div>
                    <span style={{color:"#f93d3d",fontSize:11,fontFamily:"'Inter',sans-serif",fontWeight:700}}>NO {100-yp}%</span>
                  </div>

                  {/* Actions row */}
                  <div style={{display:"flex",gap:8}}>
                    {vote ? (
                      <div style={{flex:1,height:42,borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",background:vote.pos==="YES"?"rgba(34,197,94,0.15)":"rgba(143,60,60,0.15)",border:"1px solid "+(vote.pos==="YES"?"rgba(34,197,94,0.267)":"rgba(143,60,60,0.267)")}}>
                        <span style={{color:vote.pos==="YES"?"#22C55E":"#c42b2b",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>
                          {vote.pos} · ${vote.amount?.toFixed(2)||"1.00"}
                        </span>
                      </div>
                    ) : (
                      <>
                        <YesNoBtn label="YES" pct={yp} voted={null} onClick={()=>handleBet(pred,"YES")} size="sm"/>
                        <YesNoBtn label="NO" pct={100-yp} voted={null} onClick={()=>handleBet(pred,"NO")} size="sm"/>
                      </>
                    )}
                    <button onClick={()=>setShowAlert(pred)} style={{width:42,height:42,borderRadius:"50%",background:hasAlert?"rgba(59,130,246,0.15)":"#1A2D4A",border:"1px solid "+(hasAlert?"rgba(59,130,246,0.267)":"#1A2D4A"),fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>🔔</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      </div>
      {showBet && (
        <BetModal pred={{...showBet.pred, yesPct: getPct(showBet.pred)}} position={showBet.pos} balance={balance} onConfirm={handleConfirm} onClose={()=>setShowBet(null)}/>
      )}
      {showConfirm && (
        <BetConfirmed position={showConfirm.pos} amount={showConfirm.amount} betId={showConfirm.betId} onDone={()=>setShowConfirm(null)}/>
      )}
      {showAlert && (
        <div style={{position:"fixed",inset:0,zIndex:100,maxWidth:430,margin:"0 auto"}}>
          <PriceAlertModal pred={showAlert} onClose={()=>{ setAlerts(a=>({...a,[showAlert.id]:true})); setShowAlert(null); }}/>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKETS PAGE  (sortable browse)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// MARKET DETAIL SHEET (Markets page tap-to-expand)
// ─────────────────────────────────────────────────────────────────────────────
function MarketDetailSheet({ pred, votes, onVote, balance, isWatched, onToggleWatch, onClose }) {
  const t = useTheme();
  const [vis, setVis] = useState(false);
  const [showBet, setShowBet] = useState(null);
  const [showConfirm, setShowConfirm] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const vote = votes[pred.id];
  const yp = pred.yesPct;

  useEffect(() => { requestAnimationFrame(() => setVis(true)); }, []);
  const close = () => { setVis(false); setTimeout(onClose, 320); };

  // Fetch live price history
  useEffect(() => {
    if (!pred.clobTokenIds) return;
    const tokenId = pred.clobTokenIds[0];
    fetch(`/api/history?tokenId=${encodeURIComponent(tokenId)}`)
      .then(r => r.json())
      .then(data => {
        const raw = Array.isArray(data) ? data : data.history || [];
        const step = Math.max(1, Math.floor(raw.length / 50));
        const pts = raw.filter((_,i) => i % step === 0)
          .map(pt => Math.round(parseFloat(pt.p || 0) * 100))
          .filter(v => v > 0 && v < 100);
        if (pts.length >= 2) setHistoryData(pts);
      }).catch(() => {});
  }, [pred.id]);

  const chartData = historyData || pred.chartData || [50];
  const chartColor = yp >= 50 ? "#3B82F6" : "#f93d3d";

  const stats = [
    ["💰 Pool",    pred.pool],
    ["👥 Traders", pred.bettors],
    ["⏱ Closes",  pred.daysLeft],
    ["📈 YES",     yp + "%"],
    ["📉 NO",      (100-yp) + "%"],
  ];

  return (
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}
      onClick={close}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)",opacity:vis?1:0,transition:"opacity 0.3s"}}/>
      <div
        onClick={e=>e.stopPropagation()}
        style={{
          position:"relative",
          background:"#0A1628",
          borderRadius:"28px 28px 0 0",
          maxHeight:"88vh",
          overflowY:"auto",
          transform:vis?"translateY(0)":"translateY(100%)",
          transition:"transform 0.35s cubic-bezier(0.22,1,0.36,1)",
          boxShadow:"0 -8px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Handle */}
        <div style={{display:"flex",justifyContent:"center",padding:"12px 0 4px"}}>
          <div style={{width:36,height:4,borderRadius:99,background:"rgba(255,255,255,0.15)"}}/>
        </div>

        {/* Hero image */}
        <div style={{height:180,position:"relative",overflow:"hidden",margin:"0 16px",borderRadius:18}}>
          <PredImage pred={pred} style={{width:"100%",height:"100%"}}/>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(10,22,40,0.9) 0%,transparent 60%)"}}/>
          <div style={{position:"absolute",bottom:12,left:14,right:14}}>
            <div style={{display:"flex",gap:6,marginBottom:6}}>
              <Badge color={CATEGORY_META[pred.category]?.color||"rgba(255,255,255,0.42)"}>{pred.category}</Badge>
              {pred.hot && <Badge color="#F4C430">🔥 Hot</Badge>}
            </div>
          </div>
          {/* Save button */}
          <button onClick={()=>onToggleWatch(pred.id)} style={{position:"absolute",top:10,right:10,display:"flex",alignItems:"center",gap:5,padding:"5px 11px 5px 9px",background:isWatched?"rgba(59,130,246,0.85)":"rgba(10,22,40,0.6)",border:"1px solid "+(isWatched?"rgba(59,130,246,0.6)":"rgba(255,255,255,0.18)"),borderRadius:99,cursor:"pointer"}}>
            <svg width="12" height="14" viewBox="0 0 12 15" fill="none">
              <path d="M1 1h10v13l-5-3.5L1 14V1z" fill={isWatched?"#fff":"none"} stroke={isWatched?"#fff":"rgba(255,255,255,0.8)"} strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
            <span style={{fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif",color:"#fff"}}>{isWatched?"Saved":"Save"}</span>
          </button>
        </div>

        <div style={{padding:"16px 16px 40px"}}>
          {/* Title */}
          <h2 style={{color:"#FFFFFF",fontSize:18,fontWeight:800,fontFamily:"'Inter',sans-serif",lineHeight:1.3,marginBottom:16}}>{pred.title}</h2>

          {/* Stats grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
            {stats.slice(0,3).map(([k,v])=>(
              <div key={k} style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"10px 12px"}}>
                <div style={{color:"rgba(255,255,255,0.4)",fontSize:10,fontFamily:"'Inter',sans-serif",marginBottom:3}}>{k}</div>
                <div style={{color:"#FFFFFF",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{v}</div>
              </div>
            ))}
          </div>

          {/* Probability bar */}
          <div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,padding:"14px",marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <span style={{color:"#3B82F6",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>YES {yp}%</span>
              <span style={{color:"#f93d3d",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>NO {100-yp}%</span>
            </div>
            <div style={{height:8,background:"rgba(255,255,255,0.08)",borderRadius:99,overflow:"hidden",marginBottom:8}}>
              <div style={{height:"100%",width:yp+"%",background:"linear-gradient(90deg,#2F805A,#3B82F6)",borderRadius:99,transition:"width 0.6s ease"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>+{Math.round((1/Math.max(0.01,yp/100)-1)*0.98*100)}% return</span>
              <span style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>+{Math.round((1/Math.max(0.01,(100-yp)/100)-1)*0.98*100)}% return</span>
            </div>
          </div>

          {/* Chart */}
          {chartData.length >= 2 && (
            <div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,padding:"14px",marginBottom:16}}>
              <div style={{color:"rgba(255,255,255,0.4)",fontSize:10,fontFamily:"'Inter',sans-serif",marginBottom:10,letterSpacing:1}}>PRICE HISTORY</div>
              <FullChart data={chartData} color={chartColor} isLive={!!historyData}/>
            </div>
          )}

          {/* Bet buttons */}
          {vote ? (
            <div style={{height:52,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",background:vote.pos==="YES"?"rgba(34,197,94,0.1)":"rgba(249,61,61,0.1)",border:"1px solid "+(vote.pos==="YES"?"rgba(34,197,94,0.25)":"rgba(249,61,61,0.25)")}}>
              <span style={{color:vote.pos==="YES"?"#22C55E":"#f93d3d",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>
                {vote.pos==="YES"?"✓":"✕"} Bet {vote.pos} · ${vote.amount?.toFixed(2)}
              </span>
            </div>
          ) : (
            <div style={{display:"flex",gap:10}}>
              <YesNoBtn label="YES" pct={yp} voted={null} onClick={()=>setShowBet("YES")}/>
              <YesNoBtn label="NO" pct={100-yp} voted={null} onClick={()=>setShowBet("NO")}/>
            </div>
          )}
        </div>
      </div>

      {showBet && (
        <BetModal
          pred={pred}
          position={showBet}
          balance={balance}
          onConfirm={(amt)=>{ onVote(pred.id,showBet,amt); setShowBet(null); setShowConfirm({pos:showBet,amount:amt,betId:"BET-"+pred.id+"-"+(Date.now().toString(36).toUpperCase().slice(-6))}); }}
          onClose={()=>setShowBet(null)}
        />
      )}
      {showConfirm && <BetConfirmed position={showConfirm.pos} amount={showConfirm.amount} betId={showConfirm.betId} onDone={()=>{ setShowConfirm(null); close(); }}/>}
    </div>
  );
}

function MarketsPage({
  votes, onVote, balance, watchlist, onToggleWatch, onOpenCreator, onOpenCategory, onOpenPropFirm }) {
  const ALL_PREDS = usePredictions();
  const t = useTheme();
  const [sort, setSort] = useState("hot");
  const [cat, setCat]   = useState("ALL");
  const [showBet, setShowBet] = useState(null);
  const [showConfirm, setShowConfirm] = useState(null);
  const [detailPred, setDetailPred] = useState(null);

  const sorted = useMemo(() => {
    let list = [...ALL_PREDS];
    if (cat !== "ALL") list = list.filter(p => p.category === cat);
    switch (sort) {
      case "hot":      list.sort((a,b) => (b.hot?1:0)-(a.hot?1:0)); break;
      case "pool":     list.sort((a,b) => b.poolRaw - a.poolRaw); break;
      case "closing":  list.sort((a,b) => parseInt(a.daysLeft) - parseInt(b.daysLeft)); break;
      case "newest":   list.sort((a,b) => b.id - a.id); break;
      case "volatile": list.sort((a,b) => parseFloat(b.volatility) - parseFloat(a.volatility)); break;
    }
    return list;
  }, [sort, cat]);

  const handleConfirm = (amount) => {
    const { pred, pos } = showBet;
    onVote(pred.id, pos, amount);
    setShowConfirm({ pos, amount, betId:"BET-"+(pred?.id||"")+"-"+(Date.now().toString(36).toUpperCase().slice(-6)) });
    setShowBet(null);
  };

  const totalPool = ALL_PREDS.reduce((s,p) => s + p.poolRaw, 0);

  return (
    <div style={{height:"100%",overflowY:"auto",background:t.bgOverlay}}>
      {/* Sticky header */}
      <div style={{padding:"28px 16px 0",position:"sticky",top:0,background:"#0A1628",zIndex:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div>
            <h2 style={{fontSize:20,fontWeight:800,color:"#FFFFFF",fontFamily:"'Inter',sans-serif",lineHeight:1}}>Markets</h2>
            <p style={{color:"rgba(255,255,255,0.3)",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:3}}>{sorted.length} active · ${(totalPool/1e6).toFixed(1)}M pool</p>
          </div>
          <div style={{background:"rgba(20,158,99,0.1)",borderRadius:12,padding:"6px 12px"}}>
              <span style={{color:"#3B82F6",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>Live</span>
            </div>
        </div>

        {/* Sort chips */}
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10,scrollbarWidth:"none",marginBottom:6}}>
          {SORT_OPTIONS.map(s => (
            <button key={s.id} onClick={()=>setSort(s.id)} style={{flexShrink:0,background:sort===s.id?"rgba(255,255,255,0.1)":"transparent",border:"1px solid "+(sort===s.id?"rgba(255,255,255,0.35)":"rgba(255,255,255,0.1)"),borderRadius:20,padding:"7px 14px",cursor:"pointer",color:s.red?(sort===s.id?"#E07070":"rgba(249,61,61,0.75)"):(sort===s.id?"rgba(255,255,255,0.92)":"rgba(255,255,255,0.4)"),fontSize:12,fontWeight:sort===s.id?700:500,fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap",transition:"all 0.18s"}}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Category row */}
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:12,scrollbarWidth:"none"}}>
          {Object.entries(CATEGORY_META).map(([id,m]) => (
            <button key={id} onClick={()=>{ if(id!=="ALL"&&cat===id&&onOpenCategory){ onOpenCategory(id); } else setCat(id); }}
              style={{flexShrink:0,background:"transparent",border:"1px solid "+(cat===id?"rgba(255,255,255,0.4)":"rgba(255,255,255,0.1)"),borderRadius:20,padding:"6px 12px",cursor:"pointer",color:cat===id?"rgba(255,255,255,0.92)":"rgba(255,255,255,0.4)",fontSize:11,fontWeight:cat===id?700:500,fontFamily:"'Inter',sans-serif",transition:"all 0.18s"}}>
              {m.icon} {id==="ALL"?"All":id.charAt(0)+id.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:"4px 14px 100px"}}>
        {sorted.map(pred => {
          const vote = votes[pred.id];
          const isWatched = watchlist.includes(pred.id);
          const yp = pred.yesPct;
          return (
            <div key={pred.id} onClick={()=>setDetailPred(pred)} style={{background:"#0F2040",borderRadius:18,marginBottom:10,overflow:"hidden",cursor:"pointer"}}>
              {/* Image header */}
              <div style={{position:"relative",height:120}}>
                <PredImage pred={pred} style={{width:"100%",height:"100%"}}/>
                <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(17,17,17,1) 0%,rgba(17,17,17,0.2) 60%,transparent 100%)"}}/>
                {/* Top badges */}
                <div style={{position:"absolute",top:10,left:10,display:"flex",gap:6}}>
                  <Badge color={CATEGORY_META[pred.category]?.color||"rgba(255,255,255,0.42)"}>{pred.category}</Badge>
                  {pred.hot && <Badge color="#F4C430">🔥 Hot</Badge>}
                </div>
                {/* Bookmark — SwiftUI style */}
                <button
                  onClick={e=>{e.stopPropagation();onToggleWatch(pred.id);}}
                  style={{
                    position:"absolute",top:10,right:10,
                    display:"flex",alignItems:"center",gap:5,
                    padding:"5px 11px 5px 9px",
                    background:isWatched
                      ?"rgba(59,130,246,0.85)"
                      :"rgba(10,22,40,0.55)",
                    backdropFilter:"blur(12px)",
                    WebkitBackdropFilter:"blur(12px)",
                    border:"1px solid "+(isWatched?"rgba(59,130,246,0.6)":"rgba(255,255,255,0.18)"),
                    borderRadius:99,
                    cursor:"pointer",
                    transition:"all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
                    transform:isWatched?"scale(1.05)":"scale(1)",
                  }}
                >
                  <svg width="12" height="14" viewBox="0 0 12 15" fill="none">
                    <path d="M1 1h10v13l-5-3.5L1 14V1z"
                      fill={isWatched?"#ffffff":"none"}
                      stroke={isWatched?"#ffffff":"rgba(255,255,255,0.8)"}
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span style={{fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif",color:"#ffffff",letterSpacing:0.3,whiteSpace:"nowrap"}}>
                    {isWatched?"Saved":"Save"}
                  </span>
                </button>
              </div>

              {/* Content */}
              <div style={{padding:"10px 14px 14px"}}>
                <div style={{color:"#FFFFFF",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif",lineHeight:1.35,marginBottom:10}}>{pred.title}</div>

                {/* Probability bar */}
                <div style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{color:"#60a5fa",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>YES {yp}%</span>
                    <span style={{color:"rgba(255,255,255,0.3)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>{pred.pool} · {pred.daysLeft}</span>
                    <span style={{color:"#f93d3d",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>NO {100-yp}%</span>
                  </div>
                  <div style={{height:5,background:"rgba(255,255,255,0.08)",borderRadius:99,overflow:"hidden"}}>
                    <div style={{height:"100%",width:(yp)+"%",background:"linear-gradient(90deg,#2F805A,#2d5c41)",borderRadius:99,transition:"width 0.4s ease"}}/>
                  </div>
                </div>

                {/* Bet buttons */}
                {vote ? (
                  <div onClick={e=>e.stopPropagation()} style={{height:44,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",background:vote.pos==="YES"?"rgba(34,197,94,0.1)":"rgba(143,60,60,0.1)"}}>
                    <span style={{color:vote.pos==="YES"?"#22C55E":"#f93d3d",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>
                      {vote.pos==="YES"?"✓":"✕"} Bet {vote.pos} · ${vote.amount?.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <div style={{display:"flex",gap:8}}>
                    <YesNoBtn label="YES" pct={yp} voted={null} onClick={()=>setShowBet({pred,pos:"YES"})} size="sm"/>
                    <YesNoBtn label="NO" pct={100-yp} voted={null} onClick={()=>setShowBet({pred,pos:"NO"})} size="sm"/>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showBet && <BetModal pred={showBet.pred} position={showBet.pos} balance={balance} onConfirm={handleConfirm} onClose={()=>setShowBet(null)}/>}
      {detailPred && <MarketDetailSheet pred={detailPred} votes={votes} onVote={onVote} balance={balance} isWatched={watchlist.includes(detailPred.id)} onToggleWatch={onToggleWatch} onClose={()=>setDetailPred(null)}/>}
      {showConfirm && <BetConfirmed position={showConfirm.pos} amount={showConfirm.amount} betId={showConfirm.betId} onDone={()=>setShowConfirm(null)}/>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REFERRAL / INVITE PAGE
// ─────────────────────────────────────────────────────────────────────────────
function ReferralPage({ onClose }) {
  const [copied, setCopied] = useState(false);
  const [claimed, setClaimed] = useState([]);
  const code = "DEUS2025";
  const referrals = [
    { user:"@alpha_trader", status:"signed_up",  reward:2.00, date:"Feb 22" },
    { user:"@moonboy99",    status:"signed_up",  reward:2.00, date:"Feb 20" },
    { user:"@hodlgang",     status:"pending",    reward:null, date:"Feb 18" },
    { user:"@satoshi_x",    status:"bet_placed", reward:5.00, date:"Feb 15" },
  ];
  const totalEarned = referrals.filter(r=>r.reward&&claimed.includes(r.user)).reduce((s,r)=>s+r.reward,0);
  const pendingEarned = referrals.filter(r=>r.reward&&!claimed.includes(r.user)).reduce((s,r)=>s+r.reward,0);

  const copy = () => { navigator.clipboard?.writeText(code).catch(()=>{}); setCopied(true); setTimeout(()=>setCopied(false),2000); };

  return (
    <div style={{height:"100%",overflowY:"auto",background:"#0A1628"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px",position:"sticky",top:0,background:"#0A1628",zIndex:10,borderBottom:"1px solid #0F2040"}}>
        <button onClick={onClose} style={{width:36,height:36,borderRadius:12,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.15)",color:"#FFFFFF",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:20,lineHeight:1,color:"#FFFFFF",fontWeight:300}}>‹</span></button>
        <span style={{color:"#FFFFFF",fontWeight:700,fontSize:16,fontFamily:"'Inter',sans-serif"}}>🎁 Invite & Earn</span>
      </div>

      <div style={{padding:"20px 16px 100px"}}>
        {/* Hero */}
        <div style={{background:"linear-gradient(135deg,#0F2040,#0F2040)",borderRadius:22,padding:"24px",marginBottom:20,border:"1px solid rgba(59,130,246,0.133)",textAlign:"center",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 0%,rgba(59,130,246,0.094),transparent 70%)"}}/>
          <div style={{fontSize:56,marginBottom:12}}>🎁</div>
          <h2 style={{color:"#FFFFFF",fontSize:24,fontWeight:900,fontFamily:"'Inter',sans-serif",marginBottom:8}}>Invite friends,<br/>earn credits</h2>
          <p style={{color:"#6a8090",fontSize:13,fontFamily:"'Inter',sans-serif",lineHeight:1.6,marginBottom:20}}>
            You get <span style={{color:"#3B82F6",fontWeight:700}}>$2</span> when a friend signs up.<br/>
            You get <span style={{color:"#3B82F6",fontWeight:700}}>$5</span> when they place their first bet.
          </p>
          {/* Code block */}
          <div style={{background:"rgba(0,0,0,0.5)",borderRadius:14,padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",border:"1px solid rgba(59,130,246,0.267)"}}>
            <div>
              <div style={{color:"rgba(255,255,255,0.25)",fontSize:10,fontFamily:"'Inter',sans-serif",letterSpacing:2,marginBottom:4}}>YOUR CODE</div>
              <div style={{color:"#3B82F6",fontSize:22,fontWeight:900,fontFamily:"'Inter',sans-serif",letterSpacing:4}}>{code}</div>
            </div>
            <button onClick={copy} style={{background:copied?"#3B82F6":"rgba(59,130,246,0.15)",border:"1px solid "+(copied?"#3B82F6":"rgba(59,130,246,0.267)"),borderRadius:12,color:copied?"#000":"#3B82F6",fontSize:13,fontWeight:700,padding:"10px 18px",cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.2s"}}>
              {copied?"Copied!":"Copy"}
            </button>
          </div>
        </div>

        {/* Share buttons */}
        <SectionLabel>SHARE VIA</SectionLabel>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:24}}>
          {[["🐦","Twitter"],["💬","WhatsApp"],["✈️","Telegram"],["📤","More"]].map(([icon,label])=>(
            <button key={label} style={{background:"#0F2040",borderRadius:14,padding:"12px 8px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
              <span style={{fontSize:22}}>{icon}</span>
              <span style={{color:"#6a8090",fontSize:10,fontFamily:"'Inter',sans-serif"}}>{label}</span>
            </button>
          ))}
        </div>

        {/* Earnings summary */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
          {[["Total Earned","$"+(totalEarned.toFixed(2)),"#3B82F6"],["Pending","$"+(pendingEarned.toFixed(2)),"#F4C430"]].map(([l,v,c])=>(
            <div key={l} style={{background:"#0F2040",borderRadius:14,padding:"16px"}}>
              <div style={{color:c,fontSize:24,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{v}</div>
              <div style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:4,letterSpacing:1}}>{l.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* Referrals list */}
        <SectionLabel>YOUR REFERRALS ({referrals.length})</SectionLabel>
        {referrals.map(r => {
          const isClaimed = claimed.includes(r.user);
          const statusColor = r.status==="bet_placed"?"#3B82F6":r.status==="signed_up"?"#00E5FF":"#6a8090";
          const statusLabel = r.status==="bet_placed"?"Bet placed":r.status==="signed_up"?"Signed up":"Pending";
          return (
            <div key={r.user} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:"1px solid #0F2040"}}>
              <div style={{width:40,height:40,borderRadius:"50%",background:"#1A2D4A",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>👤</div>
              <div style={{flex:1}}>
                <div style={{color:"#FFFFFF",fontSize:14,fontWeight:600,fontFamily:"'Inter',sans-serif"}}>{r.user}</div>
                <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:statusColor}}/>
                  <span style={{color:statusColor,fontSize:11,fontFamily:"'Inter',sans-serif"}}>{statusLabel}</span>
                  <span style={{color:"rgba(255,255,255,0.2)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>· {r.date}</span>
                </div>
              </div>
              {r.reward && !isClaimed && (
                <button onClick={()=>setClaimed(c=>[...c,r.user])} style={{background:"rgba(20,158,99,0.15)",border:"1px solid rgba(59,130,246,0.267)",borderRadius:20,color:"#3B82F6",fontSize:12,fontWeight:700,padding:"6px 14px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                  Claim +${r.reward.toFixed(2)}
                </button>
              )}
              {r.reward && isClaimed && (
                <Badge color="#3B82F6">Claimed ✓</Badge>
              )}
              {!r.reward && (
                <span style={{color:"rgba(255,255,255,0.42)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE EDITOR
// ─────────────────────────────────────────────────────────────────────────────
const AVATAR_OPTIONS = ["⚡","🔥","💎","🚀","🎯","🦅","🐉","👑","⚔️","🏆","🎲","🃏","💀","🌪️","🤖"];

function ProfileEditor({ onClose, onSave }) {
  const [name, setName]       = useState("Supreme Markets");
  const [bio, setBio]         = useState("CEO");
  const [avatar, setAvatar]   = useState("⚡");
  const [location, setLocation] = useState("Sydney, AU");
  const [website, setWebsite] = useState("discord.gg/deusvult");

  return (
    <div style={{height:"100%",overflowY:"auto",background:"#0A1628"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",position:"sticky",top:0,background:"#0A1628",zIndex:10,borderBottom:"1px solid #0F2040"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onClose} style={{width:36,height:36,borderRadius:12,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <span style={{fontSize:20,lineHeight:1,color:"#FFFFFF",fontWeight:300}}>‹</span>
          </button>
          <span style={{color:"#FFFFFF",fontWeight:700,fontSize:16,fontFamily:"'Inter',sans-serif"}}>Edit Profile</span>
        </div>
        <button onClick={()=>{ onSave({name,bio,avatar,location,website}); onClose(); }} style={{background:"#3B82F6",border:"none",borderRadius:20,color:"#fff",fontSize:13,fontWeight:800,padding:"7px 18px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
          Save
        </button>
      </div>

      <div style={{padding:"20px 16px 100px"}}>
        {/* Avatar picker */}
        <SectionLabel>AVATAR</SectionLabel>
        <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:24}}>
          {AVATAR_OPTIONS.map(a => (
            <button key={a} onClick={()=>setAvatar(a)} style={{width:52,height:52,borderRadius:14,background:avatar===a?"rgba(59,130,246,0.15)":"#0F2040",border:"2px solid "+(avatar===a?"#3B82F6":"#1A2D4A"),fontSize:26,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>
              {a}
            </button>
          ))}
        </div>

        {/* Preview */}
        <div style={{background:"#0F2040",borderRadius:16,padding:"16px",marginBottom:24,display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:60,height:60,borderRadius:"50%",background:"linear-gradient(135deg,#2F805A,#2d5c41)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,border:"3px solid #090F14"}}>{avatar}</div>
          <div>
            <div style={{color:"#FFFFFF",fontWeight:900,fontSize:18,fontFamily:"'Inter',sans-serif"}}>@{name}</div>
            <div style={{color:"rgba(255,255,255,0.32)",fontSize:12,fontFamily:"'Inter',sans-serif",marginTop:2,lineHeight:1.4}}>{bio.slice(0,60)}{bio.length>60?"…":""}</div>
          </div>
        </div>

        {/* Fields */}
        {[
          { label:"USERNAME", value:name, setter:setName, prefix:"@", placeholder:"username" },
          { label:"LOCATION", value:location, setter:setLocation, prefix:"📍", placeholder:"City, Country" },
          { label:"WEBSITE / DISCORD", value:website, setter:setWebsite, prefix:"🔗", placeholder:"discord.gg/yourserver" },
        ].map(f => (
          <div key={f.label} style={{marginBottom:16}}>
            <SectionLabel>{f.label}</SectionLabel>
            <div style={{position:"relative"}}>
              <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,0.32)",fontSize:14,fontFamily:"'Inter',sans-serif"}}>{f.prefix}</span>
              <input value={f.value} onChange={e=>f.setter(e.target.value)} placeholder={f.placeholder}
                style={{width:"100%",background:"#0F2040",border:"1px solid #1A2D4A",borderRadius:12,padding:"13px 14px 13px 34px",color:"#FFFFFF",fontSize:14,fontFamily:"'Inter',sans-serif",outline:"none"}}/>
            </div>
          </div>
        ))}

        <div style={{marginBottom:24}}>
          <SectionLabel>BIO</SectionLabel>
          <textarea value={bio} onChange={e=>setBio(e.target.value)} rows={3} maxLength={160}
            style={{width:"100%",background:"#0F2040",border:"1px solid #1A2D4A",borderRadius:12,padding:"13px 14px",color:"#FFFFFF",fontSize:14,fontFamily:"'Inter',sans-serif",resize:"none",outline:"none",lineHeight:1.5}}/>
          <div style={{color:"rgba(255,255,255,0.2)",fontSize:11,fontFamily:"'Inter',sans-serif",textAlign:"right",marginTop:4}}>{bio.length}/160</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY CHALLENGE BANNER
// ─────────────────────────────────────────────────────────────────────────────
function DailyChallengeBanner({ onBet }) {
  const [time, setTime] = useState(DAILY_CHALLENGE.endsIn);
  useEffect(() => {
    const t = setInterval(() => {
      setTime(prev => {
        const [h,m,s] = prev.split(":").map(Number);
        let ts = h*3600+m*60+s-1;
        if (ts <= 0) ts = 86399;
        const nh = Math.floor(ts/3600), nm = Math.floor((ts%3600)/60), ns = ts%60;
        return (String(nh).padStart(2,"0"))+":"+(String(nm).padStart(2,"0"))+":"+(String(ns).padStart(2,"0"));
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{background:"linear-gradient(135deg,#0A1628,#0F2040)",borderRadius:18,border:"1px solid rgba(59,130,246,0.2)",padding:"16px",marginBottom:16,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,borderRadius:"50%",background:"radial-gradient(circle,rgba(59,130,246,0.094),transparent)"}}/>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <div style={{background:"#3B82F6",borderRadius:8,padding:"3px 8px"}}>
          <span style={{color:"#000",fontSize:10,fontWeight:900,fontFamily:"'Inter',sans-serif",letterSpacing:1}}>DAILY</span>
        </div>
        <span style={{color:"#3B82F6",fontSize:11,fontFamily:"'Inter',sans-serif"}}>⚡ PREDICTION OF THE DAY</span>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:4}}>
          <span style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>⏱</span>
          <span style={{color:"#F4C430",fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{time}</span>
        </div>
      </div>
      <p style={{color:"rgba(255,255,255,0.72)",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif",lineHeight:1.3,marginBottom:10}}>{DAILY_CHALLENGE.pred.title}</p>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(10,22,40,0.55)",borderRadius:20,padding:"5px 10px"}}>
          <span style={{color:"#F4C430",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>🎁 +${DAILY_CHALLENGE.bonus.toFixed(2)} bonus</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{color:"rgba(255,255,255,0.25)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>Streak:</span>
          {Array.from({length:7}).map((_,i)=>(
            <div key={i} style={{width:8,height:8,borderRadius:"50%",background:i<DAILY_CHALLENGE.streak?"#3B82F6":"#1A2D4A",transition:"background 0.2s"}}/>
          ))}
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:12}}>
        <button onClick={()=>onBet(DAILY_CHALLENGE.pred,"YES")} style={{flex:1,height:40,borderRadius:99,background:"rgba(20,158,99,0.85)",border:"none",color:"#FFFFFF",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>✓ YES</button>
        <button onClick={()=>onBet(DAILY_CHALLENGE.pred,"NO")} style={{flex:1,height:40,borderRadius:99,background:"rgba(153,27,27,0.85)",border:"none",color:"#FFFFFF",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>✕ NO</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACHIEVEMENT TOAST
// ─────────────────────────────────────────────────────────────────────────────
function AchievementToast({ achievement, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, []);
  return (
    <div style={{position:"fixed",top:60,left:"50%",transform:"translateX(-50%)",zIndex:200,animation:"slideDown 0.4s cubic-bezier(0.34,1.56,0.64,1)",maxWidth:360,width:"90%",pointerEvents:"none"}}>
      <div style={{background:"linear-gradient(135deg,#0F2040,#0F2040)",border:"1px solid rgba(59,130,246,0.267)",borderRadius:18,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,boxShadow:"0 8px 40px rgba(59,130,246,0.25)"}}>
        <div style={{width:52,height:52,borderRadius:16,background:"rgba(20,158,99,0.15)",border:"1px solid rgba(59,130,246,0.267)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0,animation:"popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.1s both"}}>{achievement.icon}</div>
        <div>
          <div style={{color:"#3B82F6",fontSize:10,fontWeight:700,fontFamily:"'Inter',sans-serif",letterSpacing:2,marginBottom:3}}>ACHIEVEMENT UNLOCKED</div>
          <div style={{color:"#FFFFFF",fontSize:15,fontWeight:800,fontFamily:"'Inter',sans-serif"}}>{achievement.label}</div>
          <div style={{color:"rgba(255,255,255,0.32)",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:2}}>{achievement.desc}</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PARLAY BUILDER
// ─────────────────────────────────────────────────────────────────────────────
function ParlayBuilder({
onClose, votes, onVote, balance }) {
  const ALL_PREDS = usePredictions();
  const [legs, setLegs] = useState([]); // [{pred, pos}]
  const [stake, setStake] = useState(2);
  const [confirmed, setConfirmed] = useState(false);
  const available = ALL_PREDS.filter(p => !votes[p.id] && !legs.find(l => l.pred.id === p.id));

  const addLeg = (pred, pos) => {
    if (legs.length >= 5) return;
    setLegs(l => [...l, { pred, pos }]);
  };
  const removeLeg = (id) => setLegs(l => l.filter(x => x.pred.id !== id));

  const multiplier = legs.reduce((m, l) => {
    const odds = l.pos === "YES" ? l.pred.yesPct / 100 : (100 - l.pred.yesPct) / 100;
    return m * (1 / odds);
  }, 1);
  const payout = stake * multiplier;
  const profit = payout - stake;

  const confirm = () => {
    legs.forEach(l => onVote(l.pred.id, l.pos, stake / legs.length));
    setConfirmed(true);
  };

  if (confirmed) return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:24,background:"#0A1628"}}>
      <div style={{fontSize:72,animation:"popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)"}}>🎰</div>
      <h2 style={{color:"#FFFFFF",fontFamily:"'Inter',sans-serif",fontSize:24,fontWeight:900,textAlign:"center"}}>Parlay Placed!</h2>
      <div style={{background:"#0F2040",borderRadius:16,border:"1px solid rgba(59,130,246,0.2)",padding:"20px",width:"100%",maxWidth:320}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
          <span style={{color:"rgba(255,255,255,0.25)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>STAKE</span>
          <span style={{color:"#FFFFFF",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>${stake.toFixed(2)}</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
          <span style={{color:"rgba(255,255,255,0.25)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>MULTIPLIER</span>
          <span style={{color:"#F4C430",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{multiplier.toFixed(2)}x</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #1A2D4A",paddingTop:12}}>
          <span style={{color:"rgba(255,255,255,0.25)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>POTENTIAL WIN</span>
          <span style={{color:"#3B82F6",fontSize:18,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>+${profit.toFixed(2)}</span>
        </div>
      </div>
      <button onClick={onClose} style={{background:"#3B82F6",border:"none",borderRadius:99,color:"#fff",fontSize:14,fontWeight:900,padding:"13px 40px",cursor:"pointer",fontFamily:"'Inter',sans-serif",marginTop:8}}>Done</button>
    </div>
  );

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:"#0A1628"}}>
      <OverlayHeader title="🎰 Parlay Builder" onBack={onClose}/>

      <div style={{flex:1,overflowY:"auto",padding:"16px"}}>
        {/* Legs */}
        {legs.length > 0 && (<>
          <SectionLabel>YOUR LEGS ({legs.length}/5)</SectionLabel>
          {legs.map(({ pred, pos }) => (
            <div key={pred.id} style={{background:"#0F2040",borderRadius:14,border:"1px solid "+(pos==="YES"?"rgba(34,197,94,0.2)":"rgba(143,60,60,0.2)"),padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
              <PredImage pred={pred} style={{width:44,height:44,borderRadius:8}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:"rgba(255,255,255,0.72)",fontSize:12,fontWeight:600,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pred.title}</div>
                <div style={{color:pos==="YES"?"#22C55E":"#c42b2b",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:2,fontWeight:700}}>{pos} · {pos==="YES"?pred.yesPct:100-pred.yesPct}%</div>
              </div>
              <button onClick={()=>removeLeg(pred.id)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.22)",fontSize:18,cursor:"pointer",padding:"4px",flexShrink:0}}>✕</button>
            </div>
          ))}
        </>)}

        {/* Payout summary */}
        {legs.length >= 2 && (
          <div style={{background:"linear-gradient(135deg,#0F2040,#0F2040)",borderRadius:16,border:"1px solid rgba(59,130,246,0.133)",padding:"16px",marginBottom:20}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
              {[["Legs",legs.length,"#fff"],["Multiplier",(multiplier.toFixed(2))+"x","#F4C430"],["Win","$"+(profit.toFixed(2)),"#3B82F6"]].map(([l,v,c])=>(
                <div key={l} style={{textAlign:"center"}}>
                  <div style={{color:c,fontSize:18,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{v}</div>
                  <div style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif",letterSpacing:1,marginTop:2}}>{l.toUpperCase()}</div>
                </div>
              ))}
            </div>
            <SectionLabel>STAKE</SectionLabel>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              {[1,2,5,10,25].map(v=>(
                <button key={v} onClick={()=>setStake(v)} style={{flex:1,height:38,borderRadius:10,border:"1px solid "+(stake===v?"#3B82F6":"#1A2D4A"),background:stake===v?"rgba(59,130,246,0.12)":"#0F2040",color:stake===v?"#3B82F6":"rgba(255,255,255,0.32)",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.15s"}}>${v}</button>
              ))}
            </div>
            <button onClick={confirm} disabled={balance<stake} style={{width:"100%",height:48,borderRadius:99,background:balance>=stake?"#3B82F6":"#1A2D4A",border:"none",color:balance>=stake?"#000":"#1A2D4A",fontSize:15,fontWeight:900,cursor:balance>=stake?"pointer":"default",fontFamily:"'Inter',sans-serif",transition:"all 0.2s"}}>
              {balance>=stake?"🎰 Place Parlay · $"+(stake.toFixed(2)):"Insufficient balance"}
            </button>
          </div>
        )}

        {/* Pick more legs */}
        {legs.length < 5 && (<>
          <SectionLabel>ADD A LEG {legs.length===0?"— PICK YOUR FIRST":"— PICK ANOTHER"}</SectionLabel>
          {available.slice(0,8).map(pred => (
            <div key={pred.id} style={{background:"#0F2040",borderRadius:14,padding:"12px 14px",marginBottom:8}}>
              <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
                <PredImage pred={pred} style={{width:48,height:48,borderRadius:10}}/>
                <div style={{flex:1}}>
                  <Badge color={CATEGORY_META[pred.category]?.color||"rgba(255,255,255,0.42)"} style={{marginBottom:4}}>{pred.category}</Badge>
                  <div style={{color:"#c8dae8",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif",lineHeight:1.3,marginTop:4}}>{pred.title}</div>
                  <div style={{color:"rgba(255,255,255,0.3)",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:3}}>Pool {pred.pool} · {pred.daysLeft}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>addLeg(pred,"YES")} style={{flex:1,height:38,borderRadius:99,background:"rgba(20,158,99,0.12)",border:"1px solid rgba(59,130,246,0.267)",color:"#3B82F6",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>✓ YES {pred.yesPct}%</button>
                <button onClick={()=>addLeg(pred,"NO")} style={{flex:1,height:38,borderRadius:99,background:"rgba(143,60,60,0.12)",border:"1px solid rgba(143,60,60,0.267)",color:"#c42b2b",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>✕ NO {100-pred.yesPct}%</button>
              </div>
            </div>
          ))}
        </>)}
        <div style={{height:40}}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTFOLIO PAGE
// ─────────────────────────────────────────────────────────────────────────────
function PortfolioPage({ votes, balance, resolvedBets={} }) {
  const ALL_PREDS = usePredictions();
  const voted = ALL_PREDS.filter(p => votes[p.id]);
  const [period, setPeriod] = useState("all");

  // Filter by period
  const now = Date.now();
  const periodVoted = period === "7d"
    ? voted.filter(p => (votes[p.id]?.placedAt||0) >= now - 7*86400000)
    : period === "30d"
    ? voted.filter(p => (votes[p.id]?.placedAt||0) >= now - 30*86400000)
    : voted;

  // Real stats from resolved bets
  const totalBet = periodVoted.reduce((s,p) => s+(votes[p.id]?.amount||1), 0);
  const resolvedVoted = periodVoted.filter(p => resolvedBets[p.id]);
  const wins = resolvedVoted.filter(p => resolvedBets[p.id] === votes[p.id]?.pos).length;
  const totalWon = resolvedVoted.reduce((s,p) => {
    const won = resolvedBets[p.id] === votes[p.id]?.pos;
    if (!won) return s;
    const odds = votes[p.id]?.pos === "YES" ? p.yesPct/100 : (100-p.yesPct)/100;
    return s + (votes[p.id]?.amount||1) * (1/odds) * 0.98;
  }, 0);
  const netPnL = totalWon - resolvedVoted.reduce((s,p) => s+(votes[p.id]?.amount||1), 0);
  const winRate = resolvedVoted.length ? Math.round((wins/resolvedVoted.length)*100) : 0;
  const roi = totalBet ? ((netPnL/totalBet)*100).toFixed(1) : "0.0";

  // Real category breakdown
  const catBreakdown = Object.entries(CATEGORY_META).filter(([k])=>k!=="ALL").map(([cat,meta]) => {
    const bets = periodVoted.filter(p => p.category === cat);
    const vol  = bets.reduce((s,p) => s+(votes[p.id]?.amount||1), 0);
    const catWins = bets.filter(p => resolvedBets[p.id] && resolvedBets[p.id] === votes[p.id]?.pos).length;
    const catResolved = bets.filter(p => resolvedBets[p.id]).length;
    return { cat, meta, count: bets.length, vol, acc: catResolved > 0 ? Math.round(catWins/catResolved*100) : null };
  }).filter(x => x.count > 0).sort((a,b) => b.vol - a.vol);
  const totalCatVol = catBreakdown.reduce((s,c) => s+c.vol, 0) || 1;

  // Real P&L curve — chronological resolved bets
  const pnlPoints = [0];
  const chronoBets = [...resolvedVoted].sort((a,b) => (votes[a.id]?.placedAt||0)-(votes[b.id]?.placedAt||0));
  chronoBets.forEach(p => {
    const won = resolvedBets[p.id] === votes[p.id]?.pos;
    const odds = votes[p.id]?.pos === "YES" ? p.yesPct/100 : (100-p.yesPct)/100;
    const delta = won ? (votes[p.id]?.amount||1)*(1/odds)*0.98-(votes[p.id]?.amount||1) : -(votes[p.id]?.amount||1);
    pnlPoints.push(pnlPoints[pnlPoints.length-1] + delta);
  });
  // Add pending bets at current value (0 delta)
  periodVoted.filter(p => !resolvedBets[p.id]).forEach(() => pnlPoints.push(pnlPoints[pnlPoints.length-1]));
  if (pnlPoints.length < 2) pnlPoints.push(0);

  const pMin = Math.min(...pnlPoints), pMax = Math.max(...pnlPoints), pRange = (pMax-pMin)||1;
  const W = 320, H = 80;
  const pts = pnlPoints.map((v,i) => [(i/(pnlPoints.length-1))*W, H-((v-pMin)/pRange)*(H-4)+2]);
  const pathD = pts.map((p,i)=>(i===0?"M":"L")+(p[0].toFixed(1))+","+(p[1].toFixed(1))).join(" ");
  const lastPt = pts[pts.length-1];
  const curveColor = netPnL >= 0 ? "#3B82F6" : "#f93d3d";

  // Best/worst bets sorted by actual P&L
  const sortedBets = [...resolvedVoted].sort((a,b) => {
    const aWon = resolvedBets[a.id] === votes[a.id]?.pos;
    const bWon = resolvedBets[b.id] === votes[b.id]?.pos;
    return (bWon?1:0) - (aWon?1:0);
  });

  return (
    <div style={{height:"100%",overflowY:"auto",background:"#0A1628"}}>
      <div style={{padding:"20px 16px 0",position:"sticky",top:0,background:"#0A1628",zIndex:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div>
            <h2 style={{fontSize:22,fontWeight:900,color:"#FFFFFF",fontFamily:"'Inter',sans-serif"}}>📈 Portfolio</h2>
            <p style={{color:"rgba(255,255,255,0.2)",fontSize:11,fontFamily:"'Inter',sans-serif",letterSpacing:1,marginTop:2}}>{voted.length} ACTIVE POSITION{voted.length!==1?"S":""}</p>
          </div>
          <div style={{display:"flex",gap:0,background:"#0F2040",borderRadius:20,padding:3}}>
            {["7d","30d","all"].map(p=>(
              <button key={p} onClick={()=>setPeriod(p)} style={{background:period===p?"#3B82F6":"transparent",border:"none",borderRadius:99,color:period===p?"#000":"rgba(255,255,255,0.32)",fontSize:11,fontWeight:700,padding:"5px 12px",cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.2s"}}>{p.toUpperCase()}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{padding:"0 16px 100px"}}>
        {/* Hero P&L */}
        <div style={{background:"linear-gradient(135deg,#0A1628,#0F2040)",borderRadius:20,border:"1px solid "+(curveColor)+"22",padding:"20px",marginBottom:16}}>
          <div style={{marginBottom:14}}>
            <div style={{color:"rgba(255,255,255,0.3)",fontSize:11,fontFamily:"'Inter',sans-serif",letterSpacing:2,marginBottom:6}}>NET P&L</div>
            <div style={{display:"flex",alignItems:"baseline",gap:10}}>
              <span style={{color:curveColor,fontSize:36,fontWeight:900,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{netPnL>=0?"+":""}{netPnL.toFixed(2)}</span>
              <span style={{color:curveColor,fontSize:14,fontFamily:"'Inter',sans-serif"}}>ROI {roi}%</span>
            </div>
          </div>
          {/* P&L Chart */}
          <svg width="100%" viewBox="0 0 320 88" style={{overflow:"visible",display:"block"}}>
            <defs>
              <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={curveColor} stopOpacity="0.3"/>
                <stop offset="100%" stopColor={curveColor} stopOpacity="0"/>
              </linearGradient>
            </defs>
            <path d={(pathD+" L"+W+","+(H+4)+" L0,"+(H+4)+" Z")} fill="url(#pnlGrad)"/>
            <path d={pathD} fill="none" stroke={curveColor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
            {/* Zero line */}
            {pMin < 0 && pMax > 0 && (
              <line x1="0" y1={H-((0-pMin)/pRange)*(H-4)+2} x2={W} y2={H-((0-pMin)/pRange)*(H-4)+2} stroke="#1A2D4A" strokeWidth="1" strokeDasharray="4 4"/>
            )}
            <circle cx={lastPt[0]} cy={lastPt[1]} r="5" fill={curveColor} stroke="#0F2040" strokeWidth="2"/>
          </svg>
        </div>

        {/* 4-stat grid */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          {[
            ["Total Wagered","$"+(totalBet.toFixed(2)),"rgba(255,255,255,0.42)"],
            ["Total Won","$"+(totalWon.toFixed(2)),"#3B82F6"],
            ["Win Rate",(winRate)+"%","#F4C430"],
            ["Correct",(wins)+"/"+(voted.length),"#7c4dcc"],
          ].map(([label,val,color])=>(
            <div key={label} style={{background:"#0F2040",borderRadius:14,padding:"14px"}}>
              <div style={{color,fontSize:22,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{val}</div>
              <div style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif",marginTop:4,letterSpacing:1}}>{label.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* Category exposure */}
        {catBreakdown.length > 0 && (<>
          <SectionLabel>EXPOSURE BY CATEGORY</SectionLabel>
          <div style={{background:"#0F2040",borderRadius:14,padding:"14px",marginBottom:16}}>
            {catBreakdown.map(({cat,meta,count,vol}) => (
              <div key={cat} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:13}}>{meta.icon}</span>
                    <span style={{color:"rgba(255,255,255,0.72)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>{cat.charAt(0)+cat.slice(1).toLowerCase()}</span>
                    <span style={{color:"rgba(255,255,255,0.2)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>{count} bet{count!==1?"s":""}</span>
                  </div>
                  <span style={{color:meta.color,fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>${vol.toFixed(2)}</span>
                </div>
                <div style={{height:4,background:"#1A2D4A",borderRadius:99,overflow:"hidden"}}>
                  <div style={{height:"100%",width:((vol/totalCatVol)*100)+"%",background:meta.color,borderRadius:99,transition:"width 0.6s ease"}}/>
                </div>
              </div>
            ))}
          </div>
        </>)}

        {/* Best/Worst Bets */}
        {voted.length > 0 && (<>
          <SectionLabel>YOUR BETS</SectionLabel>
          {sortedBets.slice(0,6).map(pred => {
            const v = votes[pred.id];
            const isGood = v.pos==="YES" ? pred.yesPct>50 : pred.yesPct<50;
            const mockPnL = isGood ? (v.amount||1)*7.2 : -(v.amount||1);
            return (
              <div key={pred.id} style={{background:"#0F2040",borderRadius:14,border:"1px solid "+(isGood?"rgba(59,130,246,0.133)":"rgba(143,60,60,0.133)"),padding:"12px 14px",marginBottom:8,display:"flex",gap:12,alignItems:"center"}}>
                <PredImage pred={pred} style={{width:52,height:52,borderRadius:10}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:"#c8dae8",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pred.title}</div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
                    <Badge color={v.pos==="YES"?"#22C55E":"#c42b2b"}>{v.pos}</Badge>
                    <Sparkline data={pred.chartData} color={isGood?"#3B82F6":"#f93d3d"} width={28} height={9}/>
                    <span style={{color:isGood?"#3B82F6":"#f93d3d",fontSize:11,fontFamily:"'Inter',sans-serif",fontWeight:700}}>{pred.yesPct}% YES</span>
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{color:isGood?"#3B82F6":"#f93d3d",fontSize:14,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{isGood?"+":""}{mockPnL.toFixed(2)}</div>
                  <div style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>${v.amount?.toFixed(2)} bet</div>
                </div>
              </div>
            );
          })}
        </>)}

        {voted.length === 0 && <EmptyState icon="📈" msg="No positions yet — start betting!"/>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOT TAKES FEED
// ─────────────────────────────────────────────────────────────────────────────
const TAKES_DATA = [
  { id:1, user:"@satoshi_x", avatar:"₿", color:"#F4C430", time:"2m", text:"BTC hitting $150k before EOY is basically guaranteed at this point. The halving math doesn't lie 🔮", reactions:{fire:142,skull:23,brain:67}, cat:"CRYPTO", pred:1 },
  { id:2, user:"@moonboy99", avatar:"🌙", color:"#7c4dcc", time:"7m", text:"Anyone betting YES on Elon running for president is ngmi. He literally can't — not a natural-born citizen 💀", reactions:{fire:88,skull:201,brain:44}, cat:"POLITICS", pred:3 },
  { id:3, user:"@alpha_trader", avatar:"🦅", color:"#00E5FF", time:"14m", text:"Fed cutting 3 times this year = cope. Inflation isn't dead. Betting NO and sitting pretty 📉", reactions:{fire:55,skull:12,brain:190}, cat:"FINANCE", pred:6 },
  { id:4, user:"@degenmode", avatar:"🎲", color:"#F4C430", time:"22m", text:"Argentina winning the 2026 WC after 2022?? I'd take that bet all day. Messi legacy run incoming 🏆", reactions:{fire:312,skull:44,brain:88}, cat:"SPORTS", pred:2 },
  { id:5, user:"@cryptooracle", avatar:"🔮", color:"#F4C430", time:"31m", text:"Solana flipping ETH market cap in 2025 is more likely than people think. The devs are shipping like crazy and fees are basically zero", reactions:{fire:99,skull:77,brain:55}, cat:"CRYPTO", pred:8 },
  { id:6, user:"@techinsider", avatar:"🤖", color:"#00c9a7", time:"45m", text:"GPT-5 before July? OpenAI is behind schedule, Altman said 'ambitious goals.' I'm fading this one. NO position all the way 🎯", reactions:{fire:41,skull:66,brain:233}, cat:"TECH", pred:5 },
  { id:7, user:"@yolo_labs", avatar:"💀", color:"#f93d3d", time:"1h", text:"Put my whole stack on the alien disclosure bet. The UAP hearings were NOT nothing. Government is prepping the narrative 👽", reactions:{fire:501,skull:88,brain:12}, cat:"CONSPIRACY", pred:4 },
  { id:8, user:"@marketwatch", avatar:"📈", color:"#3B82F6", time:"2h", text:"S&P 500 at 7k by EOY? With earnings season this strong and rate cuts still on table, probably yes. Boring but right 📊", reactions:{fire:34,skull:8,brain:156}, cat:"FINANCE", pred:null },
];

function HotTakesPage({
onOpenCreator, profileData }) {
  const ALL_PREDS = usePredictions();
  const [takes, setTakes] = useState(TAKES_DATA);
  const [reacted, setReacted] = useState({});
  const [composing, setComposing] = useState(false);
  const [newTake, setNewTake] = useState("");
  const [catFilter, setCatFilter] = useState("ALL");

  const react = (takeId, type) => {
    const key = (takeId)+"-"+(type);
    if (reacted[key]) return;
    setReacted(r => ({...r,[key]:true}));
    setTakes(ts => ts.map(t => t.id===takeId ? {...t, reactions:{...t.reactions,[type]:t.reactions[type]+1}} : t));
  };

  const filtered = catFilter==="ALL" ? takes : takes.filter(t => t.cat===catFilter);

  const post = () => {
    if (!newTake.trim()) return;
    const t = {
      id: Date.now(),
      user:"@"+(profileData?.name||"you").replace(/\s/g,"_").toLowerCase(),
      avatar: profileData?.avatar||"⚡", color:"#3B82F6",
      time:"now", text:newTake, reactions:{fire:0,skull:0,brain:0}, cat:catFilter==="ALL"?"CRYPTO":catFilter, pred:null,
      isMe: true,
    };
    setTakes(ts => [t, ...ts]);
    setNewTake(""); setComposing(false);
  };

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:"#0A1628"}}>
      <div style={{padding:"16px 16px 0",position:"sticky",top:0,background:"#0A1628",zIndex:10,flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <h2 style={{fontSize:20,fontWeight:900,color:"#FFFFFF",fontFamily:"'Inter',sans-serif"}}>🔥 Hot Takes</h2>
          <button onClick={()=>setComposing(true)} style={{background:"#3B82F6",border:"none",borderRadius:20,color:"#fff",fontSize:12,fontWeight:800,padding:"7px 16px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>+ Take</button>
        </div>
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:12,scrollbarWidth:"none"}}>
          {["ALL",...Object.keys(CATEGORY_META).filter(k=>k!=="ALL")].map(cat => (
            <button key={cat} onClick={()=>setCatFilter(cat)} style={{flexShrink:0,background:catFilter===cat?(CATEGORY_META[cat]?.color||"#3B82F6"):"#1A2D4A",border:"1px solid "+(catFilter===cat?(CATEGORY_META[cat]?.color||"#3B82F6"):"#1A2D4A"),borderRadius:20,padding:"5px 12px",color:catFilter===cat?"#000":"rgba(255,255,255,0.32)",fontSize:10,fontWeight:700,fontFamily:"'Inter',sans-serif",cursor:"pointer",transition:"all 0.2s",whiteSpace:"nowrap"}}>
              {cat==="ALL"?"ALL":CATEGORY_META[cat]?.icon+" "+cat}
            </button>
          ))}
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto"}}>
        {/* Compose modal */}
        {composing && (
          <div style={{padding:"12px 16px",background:"#0F2040",borderBottom:"1px solid #1A2D4A"}}>
            <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
              <div style={{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,#2F805A,#2d5c41)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>⚡</div>
              <div style={{flex:1}}>
                <textarea value={newTake} onChange={e=>setNewTake(e.target.value)} placeholder="What's your hot take? 🔥" rows={3} maxLength={280}
                  style={{width:"100%",background:"transparent",border:"none",color:"#FFFFFF",fontSize:14,fontFamily:"'Inter',sans-serif",resize:"none",outline:"none",lineHeight:1.5}}/>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
                  <span style={{color:"rgba(255,255,255,0.2)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>{newTake.length}/280</span>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>setComposing(false)} style={{background:"none",border:"1px solid #1A2D4A",borderRadius:20,color:"rgba(255,255,255,0.32)",fontSize:12,padding:"6px 14px",cursor:"pointer"}}>Cancel</button>
                    <button onClick={post} style={{background:newTake.trim()?"#3B82F6":"#1A2D4A",border:"none",borderRadius:20,color:newTake.trim()?"#000":"#1A2D4A",fontSize:12,fontWeight:700,padding:"6px 14px",cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.2s"}}>Post</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {filtered.map(take => {
          const pred = take.pred ? ALL_PREDS.find(p=>p.id===take.pred) : null;
          return (
            <div key={take.id} style={{padding:"16px",borderBottom:"1px solid #0F2040"}}>
              <div style={{display:"flex",gap:12}}>
                <button onClick={()=>onOpenCreator&&onOpenCreator(take.user.replace("@",""))} style={{background:"none",border:"none",cursor:"pointer",padding:0,flexShrink:0}}>
                  <div style={{width:42,height:42,borderRadius:"50%",background:take.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,border:"2px solid transparent"}}>{take.avatar}</div>
                </button>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                    <span style={{color:"#FFFFFF",fontWeight:700,fontSize:14,fontFamily:"'Inter',sans-serif"}}>{take.user}</span>
                    <Badge color={CATEGORY_META[take.cat]?.color||"rgba(255,255,255,0.42)"}>{take.cat}</Badge>
                    <span style={{color:"rgba(255,255,255,0.2)",fontSize:11,fontFamily:"'Inter',sans-serif",marginLeft:"auto"}}>{take.time}</span>
                  </div>
                  <p style={{color:"rgba(255,255,255,0.72)",fontSize:14,fontFamily:"'Inter',sans-serif",lineHeight:1.6,marginBottom:10}}>{take.text}</p>

                  {/* Linked prediction */}
                  {pred && (
                    <div style={{background:"#0F2040",borderRadius:12,padding:"10px 12px",marginBottom:10,display:"flex",gap:10,alignItems:"center"}}>
                      <PredImage pred={pred} style={{width:40,height:40,borderRadius:8}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{color:"rgba(255,255,255,0.42)",fontSize:11,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pred.title}</div>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3}}>
                          <span style={{color:"#3B82F6",fontSize:11,fontFamily:"'Inter',sans-serif",fontWeight:700}}>{pred.yesPct}% YES</span>
                          <span style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>· {pred.pool}</span>
                        </div>
                      </div>
                      <Sparkline data={pred.chartData} color="#3B82F6" width={32} height={12}/>
                    </div>
                  )}

                  {/* Reactions */}
                  <div style={{display:"flex",gap:6}}>
                    {[["fire","🔥"],["skull","💀"],["brain","🧠"]].map(([type,emoji])=>{
                      const key = (take.id)+"-"+(type);
                      const active = !!reacted[key];
                      return (
                        <button key={type} onClick={()=>react(take.id,type)} style={{background:active?"rgba(59,130,246,0.1)":"#0F2040",border:"1px solid "+(active?"rgba(59,130,246,0.267)":"#1A2D4A"),borderRadius:20,padding:"5px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:5,transition:"all 0.15s"}}>
                          <span style={{fontSize:13}}>{emoji}</span>
                          <span style={{color:active?"#3B82F6":"rgba(255,255,255,0.32)",fontSize:11,fontFamily:"'Inter',sans-serif",fontWeight:700}}>{take.reactions[type]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div style={{height:40}}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY DEEP-DIVE PAGE
// ─────────────────────────────────────────────────────────────────────────────
function CategoryPage({
cat, onClose, votes, onVote, balance, watchlist, onToggleWatch }) {
  const ALL_PREDS = usePredictions();
  const meta = CATEGORY_META[cat] || CATEGORY_META.CRYPTO;
  const preds = ALL_PREDS.filter(p => p.category === cat);
  const totalPool = preds.reduce((s,p) => s+p.poolRaw, 0);
  const hotCount = preds.filter(p=>p.hot).length;
  const [showBet, setShowBet] = useState(null);
  const [showConfirm, setShowConfirm] = useState(null);

  const handleConfirm = (amount) => {
    onVote(showBet.pred.id, showBet.pos, amount);
    setShowConfirm({ pos:showBet.pos, amount, betId:"BET-"+(showBet?.pred?.id||"")+"-"+(Date.now().toString(36).toUpperCase().slice(-6)) });
    setShowBet(null);
  };

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:"#0A1628"}}>
      {/* Hero header */}
      <div style={{background:"linear-gradient(135deg, "+(meta.color)+"18, #0F2040)",borderBottom:"1px solid "+(meta.color)+"22",padding:"14px 16px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <button onClick={onClose} style={{background:"rgba(10,22,40,0.55)",border:"1px solid "+(meta.color)+"33",borderRadius:"50%",width:34,height:34,color:meta.color,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
          <div style={{width:44,height:44,borderRadius:14,background:(meta.color)+"20",border:"1px solid "+(meta.color)+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{meta.icon}</div>
          <div>
            <h2 style={{color:"#FFFFFF",fontSize:20,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{cat.charAt(0)+cat.slice(1).toLowerCase()}</h2>
            <div style={{color:meta.color,fontSize:11,fontFamily:"'Inter',sans-serif",letterSpacing:1}}>{preds.length} MARKETS</div>
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          {[
            ["Total Pool","$"+((totalPool/1e6).toFixed(1))+"M"],
            ["Hot Markets",hotCount],
            ["Avg Odds",(Math.round(preds.reduce((s,p)=>s+p.yesPct,0)/Math.max(preds.length,1)))+"% YES"],
          ].map(([l,v])=>(
            <div key={l} style={{flex:1,background:"rgba(10,22,40,0.55)",borderRadius:12,padding:"10px 12px",backdropFilter:"blur(4px)"}}>
              <div style={{color:meta.color,fontSize:15,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{v}</div>
              <div style={{color:"rgba(255,255,255,0.22)",fontSize:9,fontFamily:"'Inter',sans-serif",letterSpacing:1,marginTop:2}}>{l.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"12px 16px 80px"}}>
        {preds.map(pred => {
          const vote = votes[pred.id];
          const isWatched = watchlist.includes(pred.id);
          return (
            <div key={pred.id} style={{background:"#0F2040",borderRadius:16,overflow:"hidden",marginBottom:12}}>
              <div style={{position:"relative",height:120}}>
                <PredImage pred={pred} style={{width:"100%",height:"100%"}}/>
                <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.88),transparent 60%)"}}/>
                {pred.hot && <div style={{position:"absolute",top:10,left:12,background:"rgba(255,107,53,0.9)",borderRadius:20,padding:"3px 10px"}}><span style={{color:"#FFFFFF",fontSize:10,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>🔥 HOT</span></div>}
                <button onClick={()=>onToggleWatch(pred.id)} style={{position:"absolute",top:8,right:10,background:"rgba(0,0,0,0.5)",border:"none",borderRadius:"50%",width:30,height:30,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:isWatched?1:0.5}}>🔖</button>
                <div style={{position:"absolute",bottom:8,left:12,display:"flex",alignItems:"center",gap:6}}>
                  <span style={{color:pred.trendDir==="up"?"#3B82F6":"#f93d3d",fontSize:11,fontFamily:"'Inter',sans-serif",fontWeight:700,background:"rgba(10,22,40,0.72)",padding:"3px 8px",borderRadius:20}}>
                    {pred.trendDir==="up"?"↗":"↘"} {pred.trend}
                  </span>
                </div>
              </div>
              <div style={{padding:"12px 14px 14px"}}>
                <h3 style={{color:"#FFFFFF",fontSize:13,fontWeight:800,lineHeight:1.35,fontFamily:"'Inter',sans-serif",marginBottom:8}}>{pred.title}</h3>
                <div style={{height:4,background:"#1A2D4A",borderRadius:99,overflow:"hidden",marginBottom:8}}>
                  <div style={{height:"100%",width:(pred.yesPct)+"%",background:"linear-gradient(90deg,"+(meta.color)+","+(meta.color)+"aa)",borderRadius:99}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                  <span style={{color:meta.color,fontSize:11,fontFamily:"'Inter',sans-serif",fontWeight:700}}>YES {pred.yesPct}%</span>
                  <div style={{display:"flex",gap:10}}>
                    <span style={{color:"rgba(255,255,255,0.2)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>💰 {pred.pool}</span>
                    <span style={{color:"rgba(255,255,255,0.2)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>⏱ {pred.daysLeft}</span>
                  </div>
                </div>
                {vote ? (
                  <div style={{height:38,borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",background:vote.pos==="YES"?"rgba(34,197,94,0.12)":"rgba(143,60,60,0.12)",border:"1px solid "+(vote.pos==="YES"?"rgba(34,197,94,0.2)":"rgba(143,60,60,0.2)")}}>
                    <span style={{color:vote.pos==="YES"?"#22C55E":"#c42b2b",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>Bet {vote.pos} · ${vote.amount?.toFixed(2)}</span>
                  </div>
                ) : (
                  <div style={{display:"flex",gap:8}}>
                    <YesNoBtn label="YES" pct={pred.yesPct} voted={null} onClick={()=>setShowBet({pred,pos:"YES"})} size="sm"/>
                    <YesNoBtn label="NO" pct={100-pred.yesPct} voted={null} onClick={()=>setShowBet({pred,pos:"NO"})} size="sm"/>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {showBet && <BetModal pred={showBet.pred} position={showBet.pos} balance={balance} onConfirm={handleConfirm} onClose={()=>setShowBet(null)}/>}
      {detailPred && <MarketDetailSheet pred={detailPred} votes={votes} onVote={onVote} balance={balance} isWatched={watchlist.includes(detailPred.id)} onToggleWatch={onToggleWatch} onClose={()=>setDetailPred(null)}/>}
      {showConfirm && <BetConfirmed position={showConfirm.pos} amount={showConfirm.amount} betId={showConfirm.betId} onDone={()=>setShowConfirm(null)}/>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICE ALERT MODAL
// ─────────────────────────────────────────────────────────────────────────────
function PriceAlertModal({ pred, onClose }) {
  const [threshold, setThreshold] = useState(pred.yesPct);
  const [direction, setDirection] = useState("above");
  const [set, setSet] = useState(false);

  if (set) return (
    <Sheet onClose={onClose} title="🔔 Alert Set">
      <div style={{textAlign:"center",padding:"20px 0"}}>
        <div style={{fontSize:52,marginBottom:12,animation:"popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)"}}>🔔</div>
        <h3 style={{color:"#FFFFFF",fontSize:18,fontWeight:800,fontFamily:"'Inter',sans-serif",marginBottom:8}}>Alert Active</h3>
        <p style={{color:"rgba(255,255,255,0.32)",fontFamily:"'Inter',sans-serif",fontSize:12,lineHeight:1.6}}>
          You'll be notified when<br/>
          <span style={{color:"#FFFFFF",fontWeight:700}}>{pred.title.slice(0,40)}…</span><br/>
          goes <span style={{color:direction==="above"?"#3B82F6":"#f93d3d",fontWeight:700}}>{direction} {threshold}% YES</span>
        </p>
        <button onClick={onClose} style={{marginTop:20,background:"#3B82F6",border:"none",borderRadius:99,color:"#fff",fontSize:14,fontWeight:800,padding:"12px 32px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Done</button>
      </div>
    </Sheet>
  );

  return (
    <Sheet onClose={onClose} title="🔔 Set Price Alert">
      <div style={{background:"#0F2040",borderRadius:14,padding:"14px",marginBottom:20,display:"flex",gap:12,alignItems:"center"}}>
        <PredImage pred={pred} style={{width:60,height:60,borderRadius:10}}/>
        <div>
          <div style={{color:"rgba(255,255,255,0.72)",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif",lineHeight:1.3,marginBottom:4}}>{pred.title.slice(0,55)}…</div>
          <div style={{color:"#3B82F6",fontSize:12,fontFamily:"'Inter',sans-serif",fontWeight:700}}>Currently {pred.yesPct}% YES</div>
        </div>
      </div>

      <SectionLabel>ALERT DIRECTION</SectionLabel>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {["above","below"].map(d=>(
          <button key={d} onClick={()=>setDirection(d)} style={{flex:1,height:44,borderRadius:12,border:"1px solid "+(direction===d?(d==="above"?"#3B82F6":"#f93d3d"):"#1A2D4A"),background:direction===d?(d==="above"?"rgba(59,130,246,0.12)":"rgba(143,60,60,0.12)"):"#0F2040",color:direction===d?(d==="above"?"#3B82F6":"#f93d3d"):"rgba(255,255,255,0.32)",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.15s"}}>
            {d==="above"?"↑ Above":"↓ Below"}
          </button>
        ))}
      </div>

      <SectionLabel>THRESHOLD: {threshold}% YES</SectionLabel>
      <input type="range" min={1} max={99} value={threshold} onChange={e=>setThreshold(+e.target.value)} style={{width:"100%",accentColor:"#3B82F6",marginBottom:6}}/>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        <span style={{color:"#f93d3d",fontSize:12,fontFamily:"'Inter',sans-serif"}}>1%</span>
        <span style={{color:"#3B82F6",fontSize:14,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{threshold}%</span>
        <span style={{color:"#3B82F6",fontSize:12,fontFamily:"'Inter',sans-serif"}}>99%</span>
      </div>

      <div style={{background:"#0F2040",borderRadius:12,padding:"12px 14px",marginBottom:20}}>
        <div style={{color:"rgba(255,255,255,0.32)",fontSize:12,fontFamily:"'Inter',sans-serif",lineHeight:1.5}}>
          Alert fires when odds move <span style={{color:direction==="above"?"#3B82F6":"#f93d3d",fontWeight:700}}>{direction} {threshold}%</span>
          {" "}(currently <span style={{color:"#FFFFFF"}}>{pred.yesPct}%</span>)
          {" "}— {Math.abs(pred.yesPct-threshold)}% away
        </div>
      </div>

      <button onClick={()=>setSet(true)} style={{width:"100%",height:52,borderRadius:99,background:"#3B82F6",border:"none",color:"#fff",fontSize:15,fontWeight:900,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
        🔔 Activate Alert
      </button>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOURNAMENT PAGE
// ─────────────────────────────────────────────────────────────────────────────
const TOURNAMENT_DATA = {
  id: 1,
  title: "🏆 Weekly Crypto Championship",
  subtitle: "Top 3 win real prizes",
  prizePool: 2500,
  entryFee: 5,
  endsIn: 72 * 3600, // seconds
  participants: 847,
  maxParticipants: 1000,
  prizes: [
    { place: 1, icon: "🥇", label: "1st Place", amount: 1250, color: "#F4C430" },
    { place: 2, icon: "🥈", label: "2nd Place", amount: 750, color: "rgba(255,255,255,0.42)" },
    { place: 3, icon: "🥉", label: "3rd Place", amount: 500, color: "#C97A28" },
  ],
  leaderboard: [
    { rank: 1, user: "crypto_oracle", avatar: "🔮", color: "#F4C430", score: 4820, correct: 7, total: 8 },
    { rank: 2, user: "alpha_trader", avatar: "🦅", color: "#00E5FF", score: 4210, correct: 6, total: 8 },
    { rank: 3, user: "moonboy99", avatar: "🌙", color: "#7c4dcc", score: 3990, correct: 6, total: 9 },
    { rank: 4, user: "deus_vult", avatar: "⚡", color: "#3B82F6", score: 3640, correct: 5, total: 7, isMe: true },
    { rank: 5, user: "satoshi_x", avatar: "₿", color: "#F4C430", score: 3200, correct: 5, total: 8 },
    { rank: 6, user: "degenmode", avatar: "🎲", color: "#F4C430", score: 2980, correct: 4, total: 7 },
    { rank: 7, user: "yolo_labs", avatar: "💀", color: "#f93d3d", score: 2750, correct: 4, total: 8 },
    { rank: 8, user: "techinsider", avatar: "🤖", color: "#00c9a7", score: 2340, correct: 3, total: 7 },
  ],
  predictions: ALL_PREDICTIONS.filter(p => p.category === "CRYPTO").slice(0, 5),
};

function TournamentPage({
onClose, votes, onVote, balance, onAddBalance }) {
  const ALL_PREDS = usePredictions();
  const [joined, setJoined] = useState(false);
  const [confirmJoin, setConfirmJoin] = useState(false);
  const [tab, setTab]       = useState("overview");
  const [posTab, setPosTab] = useState("open"); // open | closed // overview | leaderboard | predictions
  const [timeLeft, setTimeLeft] = useState(TOURNAMENT_DATA.endsIn);

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const hrs  = Math.floor(timeLeft / 3600);
  const mins = Math.floor((timeLeft % 3600) / 60);
  const secs = timeLeft % 60;
  const pad  = n => String(n).padStart(2, "0");

  const myRank = TOURNAMENT_DATA.leaderboard.find(r => r.isMe);
  const fillPct = (TOURNAMENT_DATA.participants / TOURNAMENT_DATA.maxParticipants) * 100;

  const [showPayTournament, setShowPayTournament] = useState(false);

  const doJoin = () => {
    setConfirmJoin(false);
    setShowPayTournament(true);
  };
  const confirmPaid = () => {
    onAddBalance && onAddBalance(-TOURNAMENT_DATA.entryFee);
    setJoined(true);
    setShowPayTournament(false);
  };

  return (
    <>
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:"#0A1628"}}>
      <OverlayHeader title="🏆 Tournament" onBack={onClose}/>

      {/* Hero banner */}
      <div style={{background:"linear-gradient(135deg,#100E06,#0F2040)",borderBottom:"1px solid rgba(244,196,48,0.133)",padding:"16px",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div>
            <h2 style={{color:"#FFFFFF",fontSize:18,fontWeight:900,fontFamily:"'Inter',sans-serif",marginBottom:4}}>{TOURNAMENT_DATA.title}</h2>
            <p style={{color:"rgba(255,255,255,0.32)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>{TOURNAMENT_DATA.subtitle}</p>
          </div>
          {joined
            ? <div style={{background:"rgba(20,158,99,0.15)",border:"1px solid rgba(59,130,246,0.267)",borderRadius:20,padding:"6px 14px"}}><span style={{color:"#3B82F6",fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>✓ ENTERED</span></div>
            : <button onClick={()=>setConfirmJoin(true)} style={{background:"#F4C430",border:"none",borderRadius:20,color:"#000",fontSize:13,fontWeight:900,padding:"8px 18px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Join $5</button>
          }
        </div>

        {/* Countdown */}
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          {[[hrs,"HRS"],[mins,"MIN"],[secs,"SEC"]].map(([v,l])=>(
            <div key={l} style={{flex:1,background:"rgba(10,22,40,0.55)",borderRadius:12,padding:"10px 0",textAlign:"center"}}>
              <div style={{color:"#F4C430",fontSize:24,fontWeight:900,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{pad(v)}</div>
              <div style={{color:"rgba(255,255,255,0.22)",fontSize:9,fontFamily:"'Inter',sans-serif",letterSpacing:2,marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>

        {/* Prize pool + participants */}
        <div style={{display:"flex",gap:10}}>
          <div style={{flex:1,background:"rgba(244,196,48,0.08)",border:"1px solid rgba(244,196,48,0.133)",borderRadius:12,padding:"10px 12px"}}>
            <div style={{color:"#F4C430",fontSize:20,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>${TOURNAMENT_DATA.prizePool.toLocaleString()}</div>
            <div style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontFamily:"'Inter',sans-serif",marginTop:2,letterSpacing:1}}>PRIZE POOL</div>
          </div>
          <div style={{flex:1,background:"rgba(10,22,40,0.45)",borderRadius:12,padding:"10px 12px"}}>
            <div style={{color:"#FFFFFF",fontSize:20,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{TOURNAMENT_DATA.participants.toLocaleString()}</div>
            <div style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontFamily:"'Inter',sans-serif",marginTop:2,letterSpacing:1}}>PLAYERS</div>
            <div style={{height:3,background:"#1A2D4A",borderRadius:99,marginTop:6,overflow:"hidden"}}>
              <div style={{height:"100%",width:(fillPct)+"%",background:"#F4C430",borderRadius:99}}/>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-nav */}
      <div style={{display:"flex",background:"#0A1628",borderBottom:"1px solid #0F2040",flexShrink:0}}>
        {[["overview","Overview"],["leaderboard","Leaderboard"],["predictions","Markets"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,background:"none",border:"none",borderBottom:"2px solid "+(tab===id?"#F4C430":"transparent"),color:tab===id?"#F4C430":"rgba(255,255,255,0.22)",fontSize:12,fontWeight:700,padding:"12px 0",cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:1,transition:"all 0.2s"}}>
            {label.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"16px 16px 80px"}}>

        {tab==="overview" && (<>
          {/* My rank card */}
          {joined && myRank && (
            <div style={{background:"linear-gradient(135deg,#0F2040,#0F2040)",borderRadius:16,border:"1px solid rgba(59,130,246,0.2)",padding:"16px",marginBottom:16,display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:48,height:48,borderRadius:16,background:"#3B82F6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,color:"#000",fontFamily:"'Inter',sans-serif"}}>#{myRank.rank}</div>
              <div style={{flex:1}}>
                <div style={{color:"#FFFFFF",fontSize:16,fontWeight:800,fontFamily:"'Inter',sans-serif"}}>Your Current Rank</div>
                <div style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:2}}>{myRank.score.toLocaleString()} pts · {myRank.correct}/{myRank.total} correct</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{color:"#3B82F6",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>Top 1%</div>
                <div style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>↑ 2 spots</div>
              </div>
            </div>
          )}

          {/* Prize structure */}
          <SectionLabel>PRIZE STRUCTURE</SectionLabel>
          {TOURNAMENT_DATA.prizes.map(p => (
            <div key={p.place} style={{background:"#0F2040",borderRadius:14,border:"1px solid "+(p.color)+"22",padding:"14px 16px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:28}}>{p.icon}</span>
              <div style={{flex:1}}>
                <div style={{color:"#FFFFFF",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{p.label}</div>
                <div style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:2}}>Guaranteed payout</div>
              </div>
              <div style={{color:p.color,fontSize:22,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>${p.amount.toLocaleString()}</div>
            </div>
          ))}

          {/* Rules */}
          <SectionLabel>HOW IT WORKS</SectionLabel>
          <div style={{background:"#0F2040",borderRadius:14,padding:"16px"}}>
            {[
              ["1️⃣","Bet on the 5 tournament markets — each correct prediction earns points"],
              ["2️⃣","Points = (bet amount × accuracy bonus × speed bonus)"],
              ["3️⃣","Leaderboard updates in real-time as markets resolve"],
              ["4️⃣","Final rankings lock when the timer hits zero"],
            ].map(([num,text]) => (
              <div key={num} style={{display:"flex",gap:10,marginBottom:12}}>
                <span style={{fontSize:16,flexShrink:0}}>{num}</span>
                <span style={{color:"rgba(255,255,255,0.42)",fontSize:13,fontFamily:"'Inter',sans-serif",lineHeight:1.5}}>{text}</span>
              </div>
            ))}
          </div>
        </>)}

        {tab==="leaderboard" && (<>
          {TOURNAMENT_DATA.leaderboard.map((r, i) => (
            <div key={r.rank} style={{background:r.isMe?"#0F2040":"#0F2040",borderRadius:14,border:r.isMe?"1px solid rgba(59,130,246,0.2)":"1px solid #1A2D4A",padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:32,textAlign:"center",fontSize:i<3?22:14,color:["#F4C430","rgba(255,255,255,0.42)","#C97A28"][i]||"rgba(255,255,255,0.22)",fontFamily:"'Inter',sans-serif",fontWeight:700}}>
                {i<3?["🥇","🥈","🥉"][i]:r.rank}
              </div>
              <div style={{width:38,height:38,borderRadius:"50%",background:r.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{r.avatar}</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{color:r.isMe?"#3B82F6":"#fff",fontWeight:700,fontSize:14,fontFamily:"'Inter',sans-serif"}}>@{r.user}</span>
                  {r.isMe&&<Badge color="#3B82F6">YOU</Badge>}
                </div>
                <div style={{color:"rgba(255,255,255,0.2)",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:2}}>{r.correct}/{r.total} correct · {Math.round(r.correct/r.total*100)}%</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{color:i===0?"#F4C430":i===1?"rgba(255,255,255,0.42)":i===2?"#C97A28":"#fff",fontSize:16,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{r.score.toLocaleString()}</div>
                <div style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>PTS</div>
              </div>
            </div>
          ))}
        </>)}

        {tab==="predictions" && (<>
          <div style={{background:"#0A1628",borderRadius:12,border:"1px solid rgba(59,130,246,0.133)",padding:"12px 14px",marginBottom:16}}>
            <span style={{color:"#3B82F6",fontSize:12,fontFamily:"'Inter',sans-serif"}}>⚡ Bet on these 5 markets to earn tournament points</span>
          </div>
          {TOURNAMENT_DATA.predictions.map(pred => {
            const vote = votes[pred.id];
            return (
              <div key={pred.id} style={{background:"#0F2040",borderRadius:14,padding:"12px 14px",marginBottom:10}}>
                <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
                  <PredImage pred={pred} style={{width:52,height:52,borderRadius:10}}/>
                  <div style={{flex:1}}>
                    <Badge color={CATEGORY_META[pred.category]?.color||"rgba(255,255,255,0.42)"}>{pred.category}</Badge>
                    <div style={{color:"#c8dae8",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif",lineHeight:1.3,marginTop:4}}>{pred.title}</div>
                    <div style={{color:"rgba(255,255,255,0.3)",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:3}}>Pool {pred.pool}</div>
                  </div>
                </div>
                {vote
                  ? <div style={{height:38,borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",background:vote.pos==="YES"?"rgba(34,197,94,0.12)":"rgba(143,60,60,0.12)",border:"1px solid "+(vote.pos==="YES"?"rgba(34,197,94,0.2)":"rgba(143,60,60,0.2)")}}>
                      <span style={{color:vote.pos==="YES"?"#22C55E":"#c42b2b",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>✓ {vote.pos} — ${vote.amount?.toFixed(2)} bet</span>
                    </div>
                  : <div style={{display:"flex",gap:8}}>
                      <YesNoBtn label="YES" pct={pred.yesPct} voted={null} onClick={()=>onVote(pred.id,"YES",2)} size="sm"/>
                      <YesNoBtn label="NO" pct={100-pred.yesPct} voted={null} onClick={()=>onVote(pred.id,"NO",2)} size="sm"/>
                    </div>
                }
              </div>
            );
          })}
        </>)}
      </div>

      {/* Join confirmation sheet */}
      {confirmJoin && (
        <Sheet onClose={()=>setConfirmJoin(false)} title="🏆 Join Tournament">
          <div style={{background:"#0A1628",borderRadius:14,padding:"16px",marginBottom:20,border:"1px solid rgba(59,130,246,0.133)"}}>
            <div style={{color:"#3B82F6",fontSize:13,fontFamily:"'Inter',sans-serif",marginBottom:4}}>ENTRY FEE: $5.00</div>
            <div style={{color:"rgba(255,255,255,0.42)",fontSize:13,fontFamily:"'Inter',sans-serif",lineHeight:1.5}}>You'll be entered into the Weekly Crypto Championship. Bet on 5 markets to earn points and compete for ${TOURNAMENT_DATA.prizePool.toLocaleString()} in prizes.</div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
            <span style={{color:"rgba(255,255,255,0.32)",fontSize:13,fontFamily:"'Inter',sans-serif"}}>Your balance</span>
            <span style={{color:"#FFFFFF",fontSize:13,fontFamily:"'Inter',sans-serif",fontWeight:700}}>${balance.toFixed(2)}</span>
          </div>
          <button onClick={doJoin} disabled={balance<5} style={{width:"100%",height:52,borderRadius:99,background:balance>=5?"#F4C430":"#1A2D4A",border:"none",color:balance>=5?"#000":"#1A2D4A",fontSize:15,fontWeight:900,cursor:balance>=5?"pointer":"default",fontFamily:"'Inter',sans-serif",transition:"all 0.2s"}}>
            {balance>=5?"🏆 Enter for $5":"Insufficient balance"}
          </button>
        </Sheet>
      )}
    </div>

    {showPayTournament && (
      <div style={{position:"fixed",inset:0,zIndex:200,background:"#0A1628",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
          <button onClick={()=>setShowPayTournament(false)} style={{width:36,height:36,borderRadius:12,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <span style={{fontSize:20,lineHeight:1,color:"#FFFFFF",fontWeight:300}}>‹</span>
          </button>
          <span style={{color:"#FFFFFF",fontWeight:700,fontSize:16,fontFamily:"'Inter',sans-serif"}}>🏆 Join Tournament</span>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"20px 16px"}}>
          <PaymentModal
            amount={TOURNAMENT_DATA.entryFee}
            description={TOURNAMENT_DATA.title+" — Entry Fee"}
            buttonLabel="Join Tournament"
            onSuccess={confirmPaid}
            onCancel={()=>setShowPayTournament(false)}
          />
        </div>
      </div>
    )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// XP / LEVEL SYSTEM  (used in ProfilePage)
const XP_LEVELS = [
  { level:1, label:"Rookie",   minXp:0,    color:"rgba(255,255,255,0.42)" },
  { level:2, label:"Bettor",   minXp:100,  color:"#3B82F6" },
  { level:3, label:"Analyst",  minXp:300,  color:"#00E5FF" },
  { level:4, label:"Shark",    minXp:600,  color:"#F4C430" },
  { level:5, label:"Oracle",   minXp:1000, color:"#7c4dcc" },
  { level:6, label:"Legend",   minXp:2000, color:"#F4C430" },
];

function calcXP(votes) {
  const bets = Object.keys(votes||{}).length;
  const wins = Math.round(bets * 0.62);
  return bets * 20 + wins * 35;
}

function XPBar({ votes }) {
  const xp = calcXP(votes);
  const cur = [...XP_LEVELS].reverse().find(l => xp >= l.minXp) || XP_LEVELS[0];
  const next = XP_LEVELS.find(l => l.level === cur.level + 1);
  const pct = next ? Math.min(100, ((xp - cur.minXp) / (next.minXp - cur.minXp)) * 100) : 100;

  return (
    <div style={{background:"#0F2040",borderRadius:14,padding:"14px 16px",marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{background:(cur.color)+"22",border:"1px solid "+(cur.color)+"44",borderRadius:10,padding:"3px 10px"}}>
            <span style={{color:cur.color,fontSize:11,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>LVL {cur.level} · {cur.label.toUpperCase()}</span>
          </div>
        </div>
        <span style={{color:"rgba(255,255,255,0.3)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>{xp} XP{next?" / "+(next.minXp):""}</span>
      </div>
      <div style={{height:6,background:"#1A2D4A",borderRadius:99,overflow:"hidden"}}>
        <div style={{height:"100%",width:(pct)+"%",background:"linear-gradient(90deg,"+(cur.color)+","+(next?.color||cur.color)+")",borderRadius:99,transition:"width 0.8s ease"}}/>
      </div>
      {next && <div style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif",marginTop:6}}>{next.minXp-xp} XP to {next.label}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STREAK TRACKER  (used in ProfilePage)
// ─────────────────────────────────────────────────────────────────────────────
function StreakTracker({ streak=4 }) {
  const days = ["M","T","W","T","F","S","S"];
  const today = new Date().getDay(); // 0=Sun
  const todayIdx = today === 0 ? 6 : today - 1;

  return (
    <div style={{background:"#0F2040",borderRadius:14,padding:"14px 16px",marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <span style={{color:"#FFFFFF",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>🔥 Daily Streak</span>
          <span style={{color:"#F4C430",fontSize:13,fontWeight:900,fontFamily:"'Inter',sans-serif",marginLeft:10}}>{streak} days</span>
        </div>
        <div style={{background:"rgba(244,196,48,0.12)",border:"1px solid rgba(244,196,48,0.2)",borderRadius:20,padding:"4px 10px"}}>
          <span style={{color:"#F4C430",fontSize:10,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>+50 XP/day</span>
        </div>
      </div>
      <div style={{display:"flex",gap:6,justifyContent:"space-between"}}>
        {days.map((d, i) => {
          const filled = i <= todayIdx && i > todayIdx - streak;
          const isToday = i === todayIdx;
          return (
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
              <div style={{width:"100%",height:32,borderRadius:8,background:filled?"linear-gradient(135deg,#F4C430,#e67e22)":isToday?"#1A2D4A":"#0F2040",border:"1px solid "+(filled?"rgba(244,196,48,0.267)":isToday?"#1A2D4A":"#0F2040"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>
                {filled?"🔥":""}
              </div>
              <span style={{color:isToday?"#fff":filled?"#F4C430":"#1A2D4A",fontSize:9,fontFamily:"'Inter',sans-serif",fontWeight:isToday?700:400}}>{d}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARE CARD  —  beautiful generated prediction card
// ─────────────────────────────────────────────────────────────────────────────
function ShareCardModal({ pred, onClose }) {
  const [copied, setCopied] = useState(false);
  const meta = CATEGORY_META[pred.category] || CATEGORY_META.CRYPTO;
  const link = "predictswipe.app/p/"+(pred.id);

  const copy = () => {
    navigator.clipboard?.writeText((pred.title)+"\\n\\nYES "+(pred.yesPct)+"% · NO "+(100-pred.yesPct)+"%\\nPool: "+(pred.pool)+"\\n\\nBet now 👉 "+(link)).catch(()=>{});
    setCopied(true);
    setTimeout(()=>setCopied(false), 2000);
  };

  return (
    <Sheet onClose={onClose} title="📤 Share Prediction">
      {/* Card preview */}
      <div style={{borderRadius:20,overflow:"hidden",marginBottom:20,boxShadow:"0 8px 40px rgba(10,22,40,0.72)"}}>
        <div style={{position:"relative",height:160}}>
          <PredImage pred={pred} style={{width:"100%",height:"100%"}}/>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,0.2),rgba(0,0,0,0.9))"}}/>
          <div style={{position:"absolute",top:12,left:14,display:"flex",gap:6,alignItems:"center"}}>
            <div style={{width:28,height:28,borderRadius:8,background:"#3B82F6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>⚡</div>
            <span style={{color:"#FFFFFF",fontWeight:900,fontSize:14,fontFamily:"'Inter',sans-serif"}}>PredictSwipe</span>
          </div>
          <div style={{position:"absolute",top:12,right:14}}>
            <div style={{background:(meta.color)+"cc",borderRadius:20,padding:"4px 10px"}}>
              <span style={{color:"#000",fontSize:10,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{meta.icon} {pred.category}</span>
            </div>
          </div>
          <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"14px"}}>
            <p style={{color:"#FFFFFF",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif",lineHeight:1.3,marginBottom:8}}>{pred.title}</p>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:pred.yesPct,background:"#3B82F6",borderRadius:99,height:6}}/>
              <div style={{flex:100-pred.yesPct,background:"#f93d3d",borderRadius:99,height:6}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
              <span style={{color:"#3B82F6",fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>YES {pred.yesPct}%</span>
              <span style={{color:"#f93d3d",fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>NO {100-pred.yesPct}%</span>
            </div>
          </div>
        </div>
        <div style={{background:"#0F2040",padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <span style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>💰 {pred.pool} · ⏱ {pred.daysLeft}</span>
          </div>
          <span style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>{link}</span>
        </div>
      </div>

      {/* Share buttons */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        {[
          ["🐦","Twitter/X","#1DA1F2"],
          ["💬","Discord","#5865F2"],
          ["📱","Telegram","#0088cc"],
          ["📊","TradingView","#2962FF"],
        ].map(([icon,label,color])=>(
          <button key={label} style={{background:color+"15",border:"1px solid "+(color)+"33",borderRadius:12,padding:"12px",cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>{icon}</span>
            <span style={{color:"rgba(255,255,255,0.72)",fontSize:13,fontFamily:"'Inter',sans-serif"}}>{label}</span>
          </button>
        ))}
      </div>
      <button onClick={copy} style={{width:"100%",height:48,borderRadius:99,background:copied?"#3B82F6":"#1A2D4A",border:"1px solid "+(copied?"#3B82F6":"#1A2D4A"),color:copied?"#000":"rgba(255,255,255,0.72)",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.2s"}}>
        {copied?"✓ Copied to clipboard!":"📋 Copy Link & Text"}
      </button>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UPGRADED CREATE PAGE
// ─────────────────────────────────────────────────────────────────────────────
function CreatePageV2({ onClose, onPublish }) {
  const [step, setStep] = useState(1); // 1=details 2=settings 3=preview
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("CRYPTO");
  const [endDate, setEndDate] = useState("");
  const [yesLabel, setYesLabel] = useState("Yes");
  const [noLabel, setNoLabel] = useState("No");
  const [pool, setPool] = useState(10);
  const [stake, setStake] = useState(1);
  const [published, setPublished] = useState(false);

  const canNext1 = title.trim().length > 10 && endDate;
  const days = endDate ? Math.max(1, Math.round((new Date(endDate) - Date.now()) / 86400000)) : 0;

  const publish = () => {
    onPublish && onPublish({ title, category });
    setPublished(true);
  };

  if (published) return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:24,background:"#0A1628"}}>
      <div style={{fontSize:72,animation:"popIn 0.5s cubic-bezier(0.34,1.56,0.64,1)"}}>🚀</div>
      <h2 style={{color:"#FFFFFF",fontSize:24,fontWeight:900,fontFamily:"'Inter',sans-serif",textAlign:"center"}}>Market Live!</h2>
      <p style={{color:"rgba(255,255,255,0.32)",fontSize:14,fontFamily:"'Inter',sans-serif",textAlign:"center",lineHeight:1.6,maxWidth:280}}>Your prediction is now live. Share it to build up the pool!</p>
      <div style={{background:"#0F2040",borderRadius:16,border:"1px solid rgba(59,130,246,0.2)",padding:"16px",width:"100%",maxWidth:320}}>
        <div style={{color:"rgba(255,255,255,0.72)",fontSize:13,fontFamily:"'Inter',sans-serif",lineHeight:1.5,marginBottom:10}}>{title}</div>
        <div style={{display:"flex",gap:8}}>
          <Badge color={CATEGORY_META[category]?.color||"rgba(255,255,255,0.42)"}>{category}</Badge>
          <Badge color="rgba(255,255,255,0.22)">{days}d</Badge>
        </div>
      </div>
      <button onClick={onClose} style={{background:"#3B82F6",border:"none",borderRadius:99,color:"#fff",fontSize:14,fontWeight:900,padding:"13px 40px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Done</button>
    </div>
  );

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:"#0A1628"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px",borderBottom:"1px solid #0F2040",flexShrink:0}}>
        <button onClick={step>1?()=>setStep(s=>s-1):onClose} style={{width:36,height:36,borderRadius:12,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.15)",color:"#FFFFFF",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:20,lineHeight:1,color:"#FFFFFF",fontWeight:300}}>‹</span></button>
        <span style={{color:"#FFFFFF",fontWeight:700,fontSize:16,fontFamily:"'Inter',sans-serif"}}>Create Market</span>
        {/* Progress dots */}
        <div style={{marginLeft:"auto",display:"flex",gap:6}}>
          {[1,2,3].map(s=>(
            <div key={s} style={{width:s===step?20:7,height:7,borderRadius:99,background:s<=step?"#3B82F6":"#1A2D4A",transition:"all 0.3s"}}/>
          ))}
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"20px 16px 100px"}}>

        {/* STEP 1: Details */}
        {step===1 && (<>
          <h3 style={{color:"#FFFFFF",fontSize:18,fontWeight:900,fontFamily:"'Inter',sans-serif",marginBottom:4}}>What's your prediction?</h3>
          <p style={{color:"rgba(255,255,255,0.25)",fontSize:12,fontFamily:"'Inter',sans-serif",marginBottom:20,letterSpacing:0.5}}>Ask a YES/NO question that resolves by a specific date</p>

          <SectionLabel>QUESTION</SectionLabel>
          <textarea value={title} onChange={e=>setTitle(e.target.value)} placeholder='e.g. "Will Bitcoin hit $150k before end of 2025?"' rows={3} maxLength={180}
            style={{width:"100%",background:"#0F2040",border:"1px solid "+(title.length>10?"rgba(59,130,246,0.267)":"#1A2D4A"),borderRadius:14,padding:"14px",color:"#FFFFFF",fontSize:14,fontFamily:"'Inter',sans-serif",resize:"none",outline:"none",lineHeight:1.5,marginBottom:4}}/>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
            <span style={{color:title.length>10?"#3B82F6":"rgba(255,255,255,0.32)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>{title.length>10?"✓ Good length":"Min 10 characters"}</span>
            <span style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>{title.length}/180</span>
          </div>

          <SectionLabel>CATEGORY</SectionLabel>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20}}>
            {Object.entries(CATEGORY_META).filter(([k])=>k!=="ALL").map(([id,{icon,color}])=>(
              <button key={id} onClick={()=>setCategory(id)} style={{background:category===id?(color)+"18":"#0F2040",border:"1px solid "+(category===id?color:"#1A2D4A"),borderRadius:12,padding:"12px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,transition:"all 0.15s"}}>
                <span style={{fontSize:18}}>{icon}</span>
                <span style={{color:category===id?color:"#6a8090",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{id.charAt(0)+id.slice(1).toLowerCase()}</span>
              </button>
            ))}
          </div>

          <SectionLabel>RESOLUTION DATE</SectionLabel>
          <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}
            min={new Date(Date.now()+86400000*2).toISOString().split("T")[0]}
            style={{width:"100%",background:"#0F2040",border:"1px solid #1A2D4A",borderRadius:14,padding:"14px",color:"#FFFFFF",fontSize:14,fontFamily:"'Inter',sans-serif",outline:"none",marginBottom:20}}/>

          <button onClick={()=>setStep(2)} disabled={!canNext1} style={{width:"100%",height:52,borderRadius:99,background:canNext1?"#3B82F6":"#1A2D4A",border:"none",color:canNext1?"#000":"#1A2D4A",fontSize:15,fontWeight:900,cursor:canNext1?"pointer":"default",fontFamily:"'Inter',sans-serif",transition:"all 0.2s"}}>
            Next → Settings
          </button>
        </>)}

        {/* STEP 2: Settings */}
        {step===2 && (<>
          <h3 style={{color:"#FFFFFF",fontSize:18,fontWeight:900,fontFamily:"'Inter',sans-serif",marginBottom:20}}>Market Settings</h3>

          <SectionLabel>ANSWER LABELS</SectionLabel>
          <div style={{display:"flex",gap:10,marginBottom:20}}>
            <div style={{flex:1}}>
              <div style={{color:"#3B82F6",fontSize:10,fontFamily:"'Inter',sans-serif",marginBottom:6,letterSpacing:1}}>YES OPTION</div>
              <input value={yesLabel} onChange={e=>setYesLabel(e.target.value)} style={{width:"100%",background:"rgba(20,158,99,0.08)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:12,padding:"12px",color:"#3B82F6",fontSize:14,fontFamily:"'Inter',sans-serif",outline:"none"}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{color:"#f93d3d",fontSize:10,fontFamily:"'Inter',sans-serif",marginBottom:6,letterSpacing:1}}>NO OPTION</div>
              <input value={noLabel} onChange={e=>setNoLabel(e.target.value)} style={{width:"100%",background:"rgba(143,60,60,0.08)",border:"1px solid rgba(143,60,60,0.2)",borderRadius:12,padding:"12px",color:"#f93d3d",fontSize:14,fontFamily:"'Inter',sans-serif",outline:"none"}}/>
            </div>
          </div>

          <SectionLabel>SEED POOL (YOUR BET)</SectionLabel>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            {[1,5,10,25,50].map(v=>(
              <button key={v} onClick={()=>setPool(v)} style={{flex:1,height:40,borderRadius:10,border:"1px solid "+(pool===v?"#3B82F6":"#1A2D4A"),background:pool===v?"rgba(59,130,246,0.12)":"#0F2040",color:pool===v?"#3B82F6":"rgba(255,255,255,0.32)",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.15s"}}>${v}</button>
            ))}
          </div>
          <p style={{color:"rgba(255,255,255,0.2)",fontSize:11,fontFamily:"'Inter',sans-serif",marginBottom:20}}>This seeds the prize pool and sets initial odds at 50/50</p>

          <SectionLabel>INITIAL STAKE AMOUNT</SectionLabel>
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            {[0.5,1,2,5].map(v=>(
              <button key={v} onClick={()=>setStake(v)} style={{flex:1,height:40,borderRadius:10,border:"1px solid "+(stake===v?"#3B82F6":"#1A2D4A"),background:stake===v?"rgba(59,130,246,0.12)":"#0F2040",color:stake===v?"#3B82F6":"rgba(255,255,255,0.32)",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.15s"}}>${v}</button>
            ))}
          </div>

          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setStep(1)} style={{flex:1,height:52,borderRadius:99,background:"#0F2040",border:"1px solid #1A2D4A",color:"rgba(255,255,255,0.42)",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>← Back</button>
            <button onClick={()=>setStep(3)} style={{flex:2,height:52,borderRadius:99,background:"#3B82F6",border:"none",color:"#fff",fontSize:15,fontWeight:900,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Preview →</button>
          </div>
        </>)}

        {/* STEP 3: Preview */}
        {step===3 && (<>
          <h3 style={{color:"#FFFFFF",fontSize:18,fontWeight:900,fontFamily:"'Inter',sans-serif",marginBottom:4}}>Preview your market</h3>
          <p style={{color:"rgba(255,255,255,0.25)",fontSize:12,fontFamily:"'Inter',sans-serif",marginBottom:20}}>This is how it'll appear in the feed</p>

          {/* Card preview */}
          <div style={{background:"#0F2040",borderRadius:20,overflow:"hidden",marginBottom:20,border:"1px solid #1A2D4A"}}>
            <div style={{background:"linear-gradient(135deg,"+(CATEGORY_META[category]?.color||"#3B82F6")+"22,#0F2040)",height:100,display:"flex",alignItems:"center",justifyContent:"center",fontSize:52}}>
              {CATEGORY_META[category]?.icon||"❓"}
            </div>
            <div style={{padding:"14px"}}>
              <div style={{display:"flex",gap:6,marginBottom:10}}>
                <Badge color={CATEGORY_META[category]?.color||"rgba(255,255,255,0.42)"}>{category}</Badge>
                <Badge color="rgba(255,255,255,0.22)">{days}d left</Badge>
              </div>
              <h3 style={{color:"#FFFFFF",fontSize:15,fontWeight:800,lineHeight:1.4,fontFamily:"'Inter',sans-serif",marginBottom:12}}>{title||"Your prediction title here..."}</h3>
              <div style={{height:4,background:"#1A2D4A",borderRadius:99,overflow:"hidden",marginBottom:8}}>
                <div style={{height:"100%",width:"50%",background:"linear-gradient(90deg,#2F805A,#2d5c41)",borderRadius:99}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                <span style={{color:"#3B82F6",fontSize:11,fontFamily:"'Inter',sans-serif",fontWeight:700}}>{yesLabel} 50%</span>
                <span style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>💰 ${pool} pool</span>
                <span style={{color:"#f93d3d",fontSize:11,fontFamily:"'Inter',sans-serif",fontWeight:700}}>{noLabel} 50%</span>
              </div>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1,height:42,borderRadius:99,background:"rgba(20,158,99,0.12)",border:"1px solid rgba(59,130,246,0.267)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{color:"#3B82F6",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>✓ {yesLabel}</span>
                </div>
                <div style={{flex:1,height:42,borderRadius:99,background:"rgba(143,60,60,0.12)",border:"1px solid rgba(143,60,60,0.267)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{color:"#c42b2b",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>✕ {noLabel}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{background:"#0A1628",borderRadius:12,border:"1px solid rgba(59,130,246,0.133)",padding:"12px 14px",marginBottom:20}}>
            <span style={{color:"#3B82F6",fontSize:12,fontFamily:"'Inter',sans-serif"}}>⚡ Publishing will seed the pool with ${pool} from your balance</span>
          </div>

          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setStep(2)} style={{flex:1,height:52,borderRadius:99,background:"#0F2040",border:"1px solid #1A2D4A",color:"rgba(255,255,255,0.42)",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>← Edit</button>
            <button onClick={publish} style={{flex:2,height:52,borderRadius:99,background:"#3B82F6",border:"none",color:"#fff",fontSize:15,fontWeight:900,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>🚀 Publish Market</button>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROP FIRM — DATA & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
// activationFee: fee to activate after passing (if noActivationAddon not chosen)
// noActivationAddon: extra upfront cost to skip activation fee on pass
// profitTarget: dollar amount needed to pass
// maxLoss: dollar amount loss = account blown
// maxBet: max single bet size
// consistency: % consistency rule
// rebillDays: auto-rebill if not passed within this many days
const PROP_TIERS = [
  {
    id:"test_1k", tier:"PredictTest", color:"#3B82F6", icon:"🎯",
    price:49, balance:1000, label:"$1K Account",
    profitTarget:500, maxLoss:300, maxBet:100, consistency:40, split:90,
    activationFee:149, noActivationAddon:49,
    minDays:5, minMarkets:10, days:28, rebillDays:28,
    highlights:["$500 profit target","$300 max loss","$100 max bet size","90% profit split","40% consistency rule","28-day window · auto-rebill"],
  },
  {
    id:"test_5k", tier:"PredictTest", color:"#3B82F6", icon:"🎯",
    price:79, balance:5000, label:"$5K Account",
    profitTarget:2500, maxLoss:1000, maxBet:500, consistency:40, split:90,
    activationFee:149, noActivationAddon:49,
    minDays:5, minMarkets:10, days:28, rebillDays:28,
    highlights:["$2,500 profit target","$1,000 max loss","$500 max bet size","90% profit split","40% consistency rule","28-day window · auto-rebill"],
    popular:true,
  },
  {
    id:"test_10k", tier:"PredictTest", color:"#3B82F6", icon:"🎯",
    price:116, balance:10000, label:"$10K Account",
    profitTarget:5000, maxLoss:2000, maxBet:1000, consistency:40, split:90,
    activationFee:149, noActivationAddon:49,
    minDays:5, minMarkets:10, days:28, rebillDays:28,
    highlights:["$5,000 profit target","$2,000 max loss","$1,000 max bet size","90% profit split","40% consistency rule","28-day window · auto-rebill"],
  },
  {
    id:"direct_1k", tier:"PredictDirect", color:"#F4C430", icon:"⚡",
    price:350, balance:1000, label:"$1K Direct",
    profitTarget:null, maxLoss:300, maxBet:100, consistency:20, split:90,
    activationFee:0, noActivationAddon:0,
    minDays:8, minMarkets:5, days:0, rebillDays:0,
    highlights:["Funded from Day 1 — no evaluation","$300 max loss","$100 max bet","90% split","20% consistency rule","8 min active days for payout"],
  },
  {
    id:"direct_5k", tier:"PredictDirect", color:"#F4C430", icon:"⚡",
    price:490, balance:5000, label:"$5K Direct",
    profitTarget:null, maxLoss:1000, maxBet:500, consistency:20, split:90,
    activationFee:0, noActivationAddon:0,
    minDays:8, minMarkets:5, days:0, rebillDays:0,
    highlights:["Funded from Day 1 — no evaluation","$1,000 max loss","$500 max bet","90% split","20% consistency rule","8 min active days for payout"],
    popular:true,
  },
  {
    id:"direct_10k", tier:"PredictDirect", color:"#F4C430", icon:"⚡",
    price:720, balance:10000, label:"$10K Direct",
    profitTarget:null, maxLoss:2000, maxBet:1000, consistency:20, split:90,
    activationFee:0, noActivationAddon:0,
    minDays:8, minMarkets:5, days:0, rebillDays:0,
    highlights:["Funded from Day 1 — no evaluation","$2,000 max loss","$1,000 max bet","90% split","20% consistency rule","8 min active days for payout"],
  },
];

const PROP_LEADERBOARD = [
  {rank:1, user:"crypto_oracle", avatar:"🔮", color:"#F4C430", accuracy:78, profit:4820, payouts:6, tier:"PredictLive"},
  {rank:2, user:"alpha_trader",  avatar:"🦅", color:"#00E5FF", accuracy:74, profit:3960, payouts:5, tier:"PredictElite"},
  {rank:3, user:"moonboy99",     avatar:"🌙", color:"#7c4dcc", accuracy:71, profit:3410, payouts:4, tier:"PredictElite"},
  {rank:4, user:"deus_vult",     avatar:"⚡", color:"#3B82F6", accuracy:68, profit:2890, payouts:3, tier:"Funded", isMe:true},
  {rank:5, user:"satoshi_x",     avatar:"₿",  color:"#F4C430", accuracy:65, profit:2340, payouts:2, tier:"Funded"},
  {rank:6, user:"degenmode",     avatar:"🎲", color:"#F4C430", accuracy:63, profit:1980, payouts:2, tier:"Funded"},
  {rank:7, user:"techinsider",   avatar:"🤖", color:"#00c9a7", accuracy:62, profit:1430, payouts:1, tier:"Funded"},
  {rank:8, user:"yolo_labs",     avatar:"💀", color:"#f93d3d", accuracy:60, profit:980,  payouts:1, tier:"Funded"},
];

function buildChallengeStats(votes, propAccount) {
  // If propAccount has real resolved bets, use those for accuracy
  if (propAccount?.bets && propAccount.bets.length > 0) {
    const resolved = propAccount.bets.filter(b => b.resolved);
    const wins     = resolved.filter(b => b.won).length;
    const total    = propAccount.bets.length;
    const accuracy = resolved.length > 0 ? Math.round((wins / resolved.length) * 100) : 0;
    const staked   = propAccount.bets.reduce((s,b) => s + (b.stake||1), 0);
    const resolvedPnl = parseFloat((propAccount.pnl || 0).toFixed(2));
    // Include live unrealised P&L from open bets
    const openBets = propAccount.bets.filter(b => !b.resolved);
    const unrealisedPnl = openBets.reduce((s, b) => {
      const currPrice = b.pos==="YES" ? (b.lastKnownPct??b.entryPct??50)/100 : (100-(b.lastKnownPct??b.entryPct??50))/100;
      const shares = b.shares > 0 ? b.shares : (b.stake / Math.max(0.01, b.sharePrice||0.5));
      return s + (shares * currPrice - b.stake);
    }, 0);
    const pnl = parseFloat((resolvedPnl + unrealisedPnl).toFixed(2));
    // Active days = unique days that had a bet placed
    const daySet   = new Set(propAccount.bets.map(b => new Date(b.placedAt||Date.now()).toDateString()));
    const activeDays = daySet.size;
    return { total, wins, accuracy, staked, won: staked + pnl, pnl, activeDays };
  }
  // Fallback: compute from vote count (mock)
  const total    = Object.keys(votes||{}).length;
  const wins     = Math.round(total * 0.68);
  const accuracy = total > 0 ? Math.round((wins / total) * 100) : 0;
  const staked   = Object.values(votes||{}).reduce((s,v)=>s+(v.amount||1),0);
  const won      = wins * 8.4;
  const pnl      = parseFloat((won - staked).toFixed(2));
  const activeDays = Math.min(total * 2, 10);
  return { total, wins, accuracy, staked, won, pnl, activeDays };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROP FIRM — LANDING PAGE (fully updated)
// ─────────────────────────────────────────────────────────────────────────────
function PropFirmLanding({ onClose, onGetFunded, onOpenChallenge, propAccount }) {
  const [tab, setTab] = useState("overview");

  // Tier comparison table data
  const COMPARE = [
    ["Account Size",   "$1K",   "$5K",   "$10K"],
    ["PredictTest Fee","$49",   "$79",   "$116"],
    ["PredictDirect",  "$350",  "$490",  "$720"],
    ["Profit Target",  "$500",  "$2,500","$5,000"],
    ["Max Loss",       "$300",  "$1,000","$2,000"],
    ["Max Bet",        "$100",  "$500",  "$1,000"],
    ["Profit Split",   "90%",   "90%",   "90%"],
  ];

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:"#0A1628"}}>
      <OverlayHeader title="🏦 PredictSwipe Prop" onBack={onClose}/>

      {/* Hero */}
      <div style={{background:"linear-gradient(160deg,#0F2040 0%,#090F14 70%)",padding:"20px 16px 18px",flexShrink:0,borderBottom:"1px solid #0F2040"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <div style={{background:"rgba(20,158,99,0.15)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:20,padding:"4px 12px"}}>
            <span style={{color:"#3B82F6",fontSize:10,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>🌍 WORLD'S FIRST</span>
          </div>
          <div style={{background:"rgba(244,196,48,0.1)",border:"1px solid rgba(244,196,48,0.2)",borderRadius:20,padding:"4px 12px"}}>
            <span style={{color:"#F4C430",fontSize:10,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>BETA OPEN</span>
          </div>
          <div style={{background:"rgba(124,77,204,0.1)",border:"1px solid rgba(124,77,204,0.2)",borderRadius:20,padding:"4px 12px"}}>
            <span style={{color:"#7c4dcc",fontSize:10,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>🔗 COPY TRADER</span>
          </div>
        </div>
        <h1 style={{color:"#FFFFFF",fontSize:26,fontWeight:900,fontFamily:"'Inter',sans-serif",lineHeight:1.2,marginBottom:8}}>
          Get Funded.<br/>
          <span style={{color:"#3B82F6"}}>Keep 90%</span> of profits.
        </h1>
        <p style={{color:"rgba(255,255,255,0.32)",fontSize:13,fontFamily:"'Inter',sans-serif",lineHeight:1.5,marginBottom:14}}>
          The world's first prediction market prop firm. Prove your edge on a $1K–$10K simulated account, earn real payouts at 90% split, and stack profits across up to 5 accounts with copy trading.
        </p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:16}}>
          {[["$49","From"],["90%","Split"],["5","Max Accs"],["$10K","Max Balance"]].map(([v,l])=>(
            <div key={l} style={{background:"rgba(0,0,0,0.45)",borderRadius:12,padding:"10px 6px",textAlign:"center"}}>
              <div style={{color:"#3B82F6",fontSize:16,fontWeight:900,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{v}</div>
              <div style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif",marginTop:3,letterSpacing:0.5}}>{l.toUpperCase()}</div>
            </div>
          ))}
        </div>
        {propAccount
          ? <button onClick={onOpenChallenge} style={{width:"100%",height:50,borderRadius:99,background:"linear-gradient(135deg,#2F805A,#2d5c41)",border:"none",color:"#000",fontSize:15,fontWeight:900,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
              📊 View My Accounts →
            </button>
          : <button onClick={onGetFunded} style={{width:"100%",height:50,borderRadius:99,background:"linear-gradient(135deg,#2F805A,#2d5c41)",border:"none",color:"#000",fontSize:15,fontWeight:900,cursor:"pointer",fontFamily:"'Inter',sans-serif",boxShadow:"0 4px 24px rgba(59,130,246,0.267)"}}>
              🚀 Get Funded — From $49 →
            </button>
        }
      </div>

      {/* Tabs */}
      <div style={{display:"flex",background:"#0A1628",borderBottom:"1px solid #0F2040",flexShrink:0}}>
        {[["overview","Overview"],["compare","Compare"],["how","How It Works"],["faq","FAQ"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,background:"none",border:"none",borderBottom:"2px solid "+(tab===id?"#3B82F6":"transparent"),color:tab===id?"#3B82F6":"rgba(255,255,255,0.22)",fontSize:10,fontWeight:700,padding:"11px 0",cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:1,transition:"all 0.2s"}}>
            {label.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",paddingBottom:80}}>

        {/* ── OVERVIEW TAB ── */}
        {tab==="overview" && (
          <div style={{padding:"16px 16px 0"}}>
            <SectionLabel>CHOOSE YOUR PATH</SectionLabel>

            {/* PredictTest card */}
            <div style={{background:"#0F2040",borderRadius:18,border:"1px solid #1A2D4A",overflow:"hidden",marginBottom:12}}>
              <div style={{height:3,background:"linear-gradient(90deg,#2F805A,#2d5c41)"}}/>
              <div style={{padding:"16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontSize:22}}>🎯</span>
                      <span style={{color:"#FFFFFF",fontSize:17,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>PredictTest</span>
                      <div style={{background:"rgba(20,158,99,0.12)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:20,padding:"2px 8px"}}>
                        <span style={{color:"#3B82F6",fontSize:9,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>EVALUATION</span>
                      </div>
                    </div>
                    <div style={{color:"rgba(255,255,255,0.32)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>Prove your edge. Earn your funded account.</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
                    <div style={{color:"#3B82F6",fontSize:24,fontWeight:900,fontFamily:"'Inter',sans-serif",lineHeight:1}}>$49</div>
                    <div style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>FROM</div>
                  </div>
                </div>

                {/* Pricing grid */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:12}}>
                  {[["$1K Acc","$49 fee","$500 target"],["$5K Acc","$79 fee","$2,500 target"],["$10K Acc","$116 fee","$5,000 target"]].map(([acc,fee,tgt])=>(
                    <div key={acc} style={{background:"rgba(20,158,99,0.06)",border:"1px solid rgba(59,130,246,0.133)",borderRadius:10,padding:"8px 6px",textAlign:"center"}}>
                      <div style={{color:"#3B82F6",fontSize:12,fontWeight:800,fontFamily:"'Inter',sans-serif"}}>{acc}</div>
                      <div style={{color:"#FFFFFF",fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif",marginTop:2}}>{fee}</div>
                      <div style={{color:"rgba(255,255,255,0.32)",fontSize:9,fontFamily:"'Inter',sans-serif",marginTop:1}}>{tgt}</div>
                    </div>
                  ))}
                </div>

                <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                  {["90% profit split","40% consistency rule","28-day window","Auto-rebills if not passed","$149 activation on pass (or waive for $49)"].map(t=>(
                    <div key={t} style={{background:"#1A2D4A",borderRadius:99,padding:"3px 9px"}}>
                      <span style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>✓ {t}</span>
                    </div>
                  ))}
                </div>

                {/* Max loss row */}
                <div style={{background:"rgba(249,61,61,0.06)",border:"1px solid rgba(249,61,61,0.133)",borderRadius:10,padding:"8px 12px",marginBottom:12,display:"flex",justifyContent:"space-between"}}>
                  <span style={{color:"#f93d3d",fontSize:11,fontFamily:"'Inter',sans-serif",fontWeight:700}}>⚠️ MAX LOSS</span>
                  <span style={{color:"rgba(255,255,255,0.42)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>$300 · $1,000 · $2,000</span>
                </div>

                <button onClick={onGetFunded} style={{width:"100%",height:44,borderRadius:99,background:"rgba(20,158,99,0.12)",border:"1px solid rgba(59,130,246,0.267)",color:"#3B82F6",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                  Choose Account Size →
                </button>
              </div>
            </div>

            {/* PredictDirect card */}
            <div style={{background:"#0F2040",borderRadius:18,border:"1px solid rgba(244,196,48,0.133)",overflow:"hidden",marginBottom:12}}>
              <div style={{height:3,background:"linear-gradient(90deg,#F4C430,#e67e22)"}}/>
              <div style={{padding:"16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontSize:22}}>⚡</span>
                      <span style={{color:"#FFFFFF",fontSize:17,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>PredictDirect</span>
                      <div style={{background:"rgba(244,196,48,0.12)",border:"1px solid rgba(244,196,48,0.2)",borderRadius:20,padding:"2px 8px"}}>
                        <span style={{color:"#F4C430",fontSize:9,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>INSTANT FUNDED</span>
                      </div>
                    </div>
                    <div style={{color:"rgba(255,255,255,0.32)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>Skip the eval. Trade funded from Day 1.</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
                    <div style={{color:"#F4C430",fontSize:24,fontWeight:900,fontFamily:"'Inter',sans-serif",lineHeight:1}}>$350</div>
                    <div style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>FROM</div>
                  </div>
                </div>

                {/* Pricing grid */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:12}}>
                  {[["$1K Acc","$350","No eval"],["$5K Acc","$490","No eval"],["$10K Acc","$720","No eval"]].map(([acc,fee,tag])=>(
                    <div key={acc} style={{background:"rgba(244,196,48,0.06)",border:"1px solid rgba(244,196,48,0.133)",borderRadius:10,padding:"8px 6px",textAlign:"center"}}>
                      <div style={{color:"#F4C430",fontSize:12,fontWeight:800,fontFamily:"'Inter',sans-serif"}}>{acc}</div>
                      <div style={{color:"#FFFFFF",fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif",marginTop:2}}>{fee}</div>
                      <div style={{color:"rgba(255,255,255,0.32)",fontSize:9,fontFamily:"'Inter',sans-serif",marginTop:1}}>{tag}</div>
                    </div>
                  ))}
                </div>

                <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                  {["No evaluation needed","Funded from Day 1","90% profit split","20% consistency rule","8 min active days for payout"].map(t=>(
                    <div key={t} style={{background:"#1A2D4A",borderRadius:99,padding:"3px 9px"}}>
                      <span style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>✓ {t}</span>
                    </div>
                  ))}
                </div>

                <div style={{background:"rgba(249,61,61,0.06)",border:"1px solid rgba(249,61,61,0.133)",borderRadius:10,padding:"8px 12px",marginBottom:12,display:"flex",justifyContent:"space-between"}}>
                  <span style={{color:"#f93d3d",fontSize:11,fontFamily:"'Inter',sans-serif",fontWeight:700}}>⚠️ MAX LOSS</span>
                  <span style={{color:"rgba(255,255,255,0.42)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>$300 · $1,000 · $2,000</span>
                </div>

                <button onClick={onGetFunded} style={{width:"100%",height:44,borderRadius:99,background:"rgba(244,196,48,0.1)",border:"1px solid rgba(244,196,48,0.267)",color:"#F4C430",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                  Go Instant →
                </button>
              </div>
            </div>

            {/* Copy Trader feature card */}
            <div style={{background:"linear-gradient(135deg,#0F2040,#0F2040)",borderRadius:18,border:"1px solid rgba(124,77,204,0.2)",overflow:"hidden",marginBottom:12}}>
              <div style={{height:3,background:"linear-gradient(90deg,#7c4dcc,#7c3aed)"}}/>
              <div style={{padding:"14px 16px",display:"flex",alignItems:"flex-start",gap:14}}>
                <div style={{width:46,height:46,borderRadius:14,background:"rgba(124,77,204,0.15)",border:"1px solid rgba(124,77,204,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🔗</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <div style={{color:"#7c4dcc",fontSize:14,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>Copy Trader</div>
                    <div style={{background:"rgba(124,77,204,0.15)",border:"1px solid rgba(124,77,204,0.2)",borderRadius:20,padding:"2px 8px"}}>
                      <span style={{color:"#7c4dcc",fontSize:9,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>UP TO 5 ACCS</span>
                    </div>
                  </div>
                  <div style={{color:"rgba(255,255,255,0.32)",fontSize:12,fontFamily:"'Inter',sans-serif",lineHeight:1.5,marginBottom:8}}>
                    Stack profits by running up to 5 accounts simultaneously. Set one account as the lead — every trade automatically copies to your follower accounts. Win once, get paid across all.
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {["Max 5 accounts","1 lead account","Auto-copy trades","90% split each","Independent risk"].map(t=>(
                      <div key={t} style={{background:"rgba(124,77,204,0.08)",border:"1px solid rgba(124,77,204,0.133)",borderRadius:99,padding:"3px 8px"}}>
                        <span style={{color:"#7c4dcc",fontSize:9,fontFamily:"'Inter',sans-serif"}}>✓ {t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* PredictElite teaser */}
            <div style={{background:"linear-gradient(135deg,#1a1500,#0F2040)",borderRadius:18,border:"1px solid rgba(244,196,48,0.2)",overflow:"hidden",marginBottom:20}}>
              <div style={{height:3,background:"linear-gradient(90deg,#F4C430,#ca8a04)"}}/>
              <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:14}}>
                <span style={{fontSize:28}}>🏆</span>
                <div style={{flex:1}}>
                  <div style={{color:"#F4C430",fontSize:14,fontWeight:900,fontFamily:"'Inter',sans-serif",marginBottom:2}}>PredictElite → PredictLive</div>
                  <div style={{color:"rgba(255,255,255,0.32)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>Invitation only · 90% split · $50K balance · After 6 payouts, graduate to real capital</div>
                </div>
                <div style={{background:"rgba(244,196,48,0.1)",border:"1px solid rgba(244,196,48,0.267)",borderRadius:20,padding:"4px 10px",flexShrink:0}}>
                  <span style={{color:"#F4C430",fontSize:9,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>INVITE ONLY</span>
                </div>
              </div>
            </div>

            <SectionLabel>RECENT PAYOUTS</SectionLabel>
            {[
              ["crypto_oracle","🔮","#F4C430","$1,240","PredictDirect $5K","yesterday"],
              ["alpha_trader","🦅","#00E5FF","$890","PredictTest $10K","2 days ago"],
              ["moonboy99","🌙","#7c4dcc","$620","PredictDirect $1K","3 days ago"],
              ["deus_vult","⚡","#3B82F6","$2,100","3× Copy Accounts","4 days ago"],
            ].map(([user,av,col,amt,tier,when])=>(
              <div key={user} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #0F2040"}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:col+"33",border:"1px solid "+(col)+"55",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{av}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>@{user}</div>
                  <div style={{color:"rgba(255,255,255,0.25)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>{tier} · {when}</div>
                </div>
                <div style={{color:"#3B82F6",fontSize:15,fontWeight:900,fontFamily:"'Inter',sans-serif",flexShrink:0}}>{amt}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── COMPARE TAB ── */}
        {tab==="compare" && (
          <div style={{padding:"16px 16px 0"}}>
            <SectionLabel>ACCOUNT COMPARISON</SectionLabel>

            {/* Full comparison table */}
            <div style={{background:"#0F2040",borderRadius:16,overflow:"hidden",marginBottom:16}}>
              {/* Header */}
              <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr 1fr 1fr",background:"#0A1628",borderBottom:"1px solid #1A2D4A"}}>
                {["","$1K","$5K","$10K"].map((h,i)=>(
                  <div key={i} style={{padding:"10px 8px",textAlign:i>0?"center":"left"}}>
                    <span style={{color:i>0?"#3B82F6":"rgba(255,255,255,0.22)",fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{h}</span>
                  </div>
                ))}
              </div>
              {COMPARE.map(([label,...vals],i)=>(
                <div key={label} style={{display:"grid",gridTemplateColumns:"1.4fr 1fr 1fr 1fr",borderBottom:i<COMPARE.length-1?"1px solid #0F2040":"none",background:i%2===0?"rgba(255,255,255,0.01)":"transparent"}}>
                  <div style={{padding:"10px 8px"}}>
                    <span style={{color:"rgba(255,255,255,0.3)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>{label}</span>
                  </div>
                  {vals.map((v,j)=>(
                    <div key={j} style={{padding:"10px 8px",textAlign:"center"}}>
                      <span style={{color:label==="Max Loss"?"#f93d3d":label==="Profit Split"?"#3B82F6":"#fff",fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{v}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* PredictTest vs PredictDirect side-by-side */}
            <SectionLabel>PREDICTTEST VS PREDICTDIRECT</SectionLabel>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {[
                {
                  name:"PredictTest",color:"#3B82F6",icon:"🎯",type:"EVALUATION",
                  pros:["Lower entry cost","Waive activation for $49","Rebills if you want to keep trying"],
                  cons:["Must hit profit target","$149 activation fee on pass","28-day deadline pressure"],
                },
                {
                  name:"PredictDirect",color:"#F4C430",icon:"⚡",type:"INSTANT FUNDED",
                  pros:["Funded from Day 1","No profit target","No activation fee ever"],
                  cons:["Higher upfront cost","8 min active days for first payout","20% consistency required"],
                },
              ].map(({name,color,icon,type,pros,cons})=>(
                <div key={name} style={{background:"#0F2040",borderRadius:16,border:"1px solid "+(color)+"22",padding:"14px 12px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                    <span style={{fontSize:18}}>{icon}</span>
                    <div>
                      <div style={{color:"#FFFFFF",fontSize:13,fontWeight:800,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{name}</div>
                      <div style={{color:color,fontSize:8,fontFamily:"'Inter',sans-serif",marginTop:2}}>{type}</div>
                    </div>
                  </div>
                  <div style={{marginBottom:8}}>
                    {pros.map(p=>(
                      <div key={p} style={{display:"flex",gap:5,marginBottom:4,alignItems:"flex-start"}}>
                        <span style={{color:"#3B82F6",fontSize:10,flexShrink:0,marginTop:1}}>✓</span>
                        <span style={{color:"rgba(255,255,255,0.42)",fontSize:10,fontFamily:"'Inter',sans-serif",lineHeight:1.4}}>{p}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    {cons.map(c=>(
                      <div key={c} style={{display:"flex",gap:5,marginBottom:4,alignItems:"flex-start"}}>
                        <span style={{color:"#f93d3d",fontSize:10,flexShrink:0,marginTop:1}}>✗</span>
                        <span style={{color:"rgba(255,255,255,0.32)",fontSize:10,fontFamily:"'Inter',sans-serif",lineHeight:1.4}}>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Copy trader explainer */}
            <SectionLabel>COPY TRADER — STACK PROFITS</SectionLabel>
            <div style={{background:"linear-gradient(135deg,#0F2040,#0F2040)",borderRadius:16,border:"1px solid rgba(124,77,204,0.2)",padding:"16px",marginBottom:16}}>
              <div style={{color:"#7c4dcc",fontSize:14,fontWeight:800,fontFamily:"'Inter',sans-serif",marginBottom:6}}>How profit stacking works</div>
              <div style={{color:"rgba(255,255,255,0.32)",fontSize:12,fontFamily:"'Inter',sans-serif",lineHeight:1.6,marginBottom:12}}>
                Buy up to 5 accounts and connect them with the Copy Trader. When you place a bet on your lead account, it's instantly replicated across all follower accounts — proportional to each account's max bet.
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {[["1 bet placed","On lead account","🎯"],["Auto-copied","To 4 followers","📡"],["5× payouts","Same 90% split","💰"]].map(([v,l,e])=>(
                  <div key={v} style={{background:"rgba(124,77,204,0.08)",border:"1px solid rgba(124,77,204,0.133)",borderRadius:10,padding:"10px 6px",textAlign:"center"}}>
                    <div style={{fontSize:18,marginBottom:4}}>{e}</div>
                    <div style={{color:"#7c4dcc",fontSize:12,fontWeight:800,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{v}</div>
                    <div style={{color:"rgba(255,255,255,0.32)",fontSize:9,fontFamily:"'Inter',sans-serif",marginTop:3}}>{l.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={onGetFunded} style={{width:"100%",height:52,borderRadius:99,background:"linear-gradient(135deg,#2F805A,#2d5c41)",border:"none",color:"#000",fontSize:15,fontWeight:900,cursor:"pointer",fontFamily:"'Inter',sans-serif",marginBottom:8}}>
              🚀 Get Started — From $49 →
            </button>
          </div>
        )}

        {/* ── HOW IT WORKS TAB ── */}
        {tab==="how" && (
          <div style={{padding:"16px 16px 0"}}>
            <SectionLabel>PREDICTTEST — STEP BY STEP</SectionLabel>
            {[
              ["1️⃣","Buy a Challenge","Pick your size: $1K ($49), $5K ($79), or $10K ($116). Optional: add $49 upfront to waive the $149 activation fee when you pass. Challenge starts immediately."],
              ["2️⃣","Hit the Profit Target","Reach $500 / $2,500 / $5,000 net profit within 28 days. Keep each bet under your max bet limit ($100–$1,000). No single market can account for more than 40% of your profits."],
              ["3️⃣","Don't Blow the Account","If your total losses exceed the max loss limit ($300 / $1,000 / $2,000), the account is closed. You can reset for a fee and try again."],
              ["4️⃣","Claim Your Funded Account","Hit the profit target → pay the $149 activation fee (or $0 if you paid the add-on) → receive your funded account and start earning 90% of all profits."],
              ["5️⃣","Scale Up with Copy Trader","Open more accounts (up to 5 total) and link them with Copy Trader. One trade on your lead account copies to all others — multiply your earnings."],
              ["6️⃣","Graduate to PredictLive","After 6 successful payouts across your funded accounts, you're eligible for PredictLive — real-capital trading with the same 90% split."],
            ].map(([icon,title,desc],i)=>(
              <div key={i} style={{display:"flex",gap:14,marginBottom:20,alignItems:"flex-start"}}>
                <div style={{width:44,height:44,borderRadius:14,background:"rgba(20,158,99,0.08)",border:"1px solid rgba(59,130,246,0.133)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{icon}</div>
                <div>
                  <div style={{color:"#FFFFFF",fontSize:14,fontWeight:800,fontFamily:"'Inter',sans-serif",marginBottom:4}}>{title}</div>
                  <div style={{color:"rgba(255,255,255,0.32)",fontSize:12,fontFamily:"'Inter',sans-serif",lineHeight:1.6}}>{desc}</div>
                </div>
              </div>
            ))}

            <SectionLabel>PREDICTDIRECT — STEP BY STEP</SectionLabel>
            {[
              ["⚡","Pay & Start Immediately","Pay $350 / $490 / $720 once. No evaluation — your funded account is live from Day 1."],
              ["📅","Be Active for 8 Days","Before requesting your first payout, you must have been active on at least 8 separate calendar days."],
              ["⚖️","Maintain 20% Consistency","No single market can account for more than 20% of your total profits for the payout period."],
              ["💰","Request Payouts","Once the 8-day minimum is met, request payouts at any time. 90% split, paid via ACH, PayPal, or USDC."],
            ].map(([icon,title,desc],i)=>(
              <div key={i} style={{display:"flex",gap:14,marginBottom:20,alignItems:"flex-start"}}>
                <div style={{width:44,height:44,borderRadius:14,background:"rgba(244,196,48,0.08)",border:"1px solid rgba(244,196,48,0.133)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{icon}</div>
                <div>
                  <div style={{color:"#FFFFFF",fontSize:14,fontWeight:800,fontFamily:"'Inter',sans-serif",marginBottom:4}}>{title}</div>
                  <div style={{color:"rgba(255,255,255,0.32)",fontSize:12,fontFamily:"'Inter',sans-serif",lineHeight:1.6}}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── FAQ TAB ── */}
        {tab==="faq" && (
          <div style={{padding:"16px 16px 0"}}>
            <SectionLabel>FAQ</SectionLabel>
            {[
              ["What are the account sizes and fees?","PredictTest: $1K account for $49, $5K for $79, $10K for $116. PredictDirect (instant funded): $1K for $350, $5K for $490, $10K for $720. All accounts come with a 90% profit split."],
              ["What is the activation fee for PredictTest?","After passing your PredictTest challenge, there's a $149 activation fee to receive your funded account. Alternatively, you can pay an extra $49 at checkout to completely waive this fee on pass — saving you $100 total."],
              ["What happens if I don't pass in 28 days?","Your PredictTest account auto-rebills at the same fee ($49–$116) and your challenge resets. You can cancel before the rebill date in your account settings."],
              ["What is the consistency rule?","PredictTest requires that no single market accounts for more than 40% of your total profits. PredictDirect uses a stricter 20% rule. This ensures your edge is diversified, not based on one lucky call."],
              ["What is the max loss limit?","If your cumulative losses reach the max loss limit ($300 for $1K, $1,000 for $5K, $2,000 for $10K), your account is immediately closed. This is a hard dollar limit. You can purchase a reset to try again."],
              ["How does the Copy Trader work?","Once you have 2+ accounts, you can designate one as the lead account. All bets placed on the lead are automatically replicated across your follower accounts, proportionally sized to each account's max bet. Each account remains independent — one blown account doesn't affect the others."],
              ["Can I have multiple accounts?","Yes — up to 5 simultaneous accounts across any mix of PredictTest and PredictDirect tiers and sizes. Use the Copy Trader to link them and maximise your profits from a single trade."],
              ["How are payouts processed?","Via ACH bank transfer (2–3 days), PayPal (same-day for Elite), or USDC stablecoin (instant). Minimum payout is $25."],
              ["Is the funded balance real money?","No — like all prop firms, the challenge and funded phases use simulated capital. Payouts are real and come from PredictSwipe's revenue pool. PredictLive (after 6 payouts) uses actual capital."],
            ].map(([q,a],i)=>(
              <div key={i} style={{background:"#0F2040",borderRadius:14,padding:"14px 16px",marginBottom:10}}>
                <div style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:6}}>{q}</div>
                <div style={{color:"rgba(255,255,255,0.32)",fontSize:12,fontFamily:"'Inter',sans-serif",lineHeight:1.5}}>{a}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROP FIRM — PURCHASE FLOW (updated with activation addon, new fields)
// ─────────────────────────────────────────────────────────────────────────────
function PropPurchaseFlow({ onClose, onPurchase, balance, existingCount=0 }) {
  const [selected,    setSelected]    = useState(null);
  const [step,        setStep]        = useState(1);
  const [payMethod,   setPayMethod]   = useState("card");
  const [noActAddon,  setNoActAddon]  = useState(false);
  const [paid,        setPaid]        = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [appliedCode,  setAppliedCode]  = useState(null);
  const [discountError, setDiscountError] = useState("");
  const [discountInput, setDiscountInput] = useState("");

  const DISCOUNT_CODES = {
    "DEUS20":   { pct: 20, label: "20% off — Deus Vult community" },
    "LAUNCH10": { pct: 10, label: "10% off — Launch special" },
    "FRIEND50": { pct: 50, label: "50% off — Friend referral" },
    "WELCOME15":{ pct: 15, label: "15% off — Welcome discount" },
  };

  const applyDiscount = () => {
    const code = discountInput.trim().toUpperCase();
    if (DISCOUNT_CODES[code]) {
      setAppliedCode({ code, ...DISCOUNT_CODES[code] });
      setDiscountError("");
    } else {
      setDiscountError("Invalid code. Try DEUS20 or LAUNCH10.");
      setAppliedCode(null);
    }
  };

  const removeDiscount = () => { setAppliedCode(null); setDiscountInput(""); setDiscountError(""); };

  const isTest    = selected?.tier === "PredictTest";
  const addonCost = isTest && noActAddon ? (selected?.noActivationAddon || 49) : 0;
  const baseCost  = selected ? selected.price + addonCost : 0;
  const discountAmt = appliedCode ? Math.round(baseCost * appliedCode.pct / 100) : 0;
  const totalCost = baseCost - discountAmt;
  const canAfford = selected && balance >= totalCost;
  const atLimit   = existingCount >= 5;

  const handlePay = () => {
    if (!canAfford || atLimit) return;
    onPurchase(selected, noActAddon);
    setPaid(true);
  };

  if (atLimit) return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:24,background:"#0A1628"}}>
      <div style={{fontSize:64}}>🔒</div>
      <h2 style={{color:"#FFFFFF",fontSize:22,fontWeight:900,fontFamily:"'Inter',sans-serif",textAlign:"center"}}>Account Limit Reached</h2>
      <p style={{color:"rgba(255,255,255,0.32)",fontSize:14,fontFamily:"'Inter',sans-serif",textAlign:"center",lineHeight:1.6,maxWidth:280}}>
        You already have <span style={{color:"#F4C430",fontWeight:700}}>5 active accounts</span> — the maximum. Close or complete an existing account before opening a new one.
      </p>
      <button onClick={onClose} style={{background:"#1A2D4A",border:"1px solid #1A2D4A",borderRadius:99,color:"rgba(255,255,255,0.42)",fontSize:14,fontWeight:700,padding:"13px 40px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
        ← Back to Accounts
      </button>
    </div>
  );

  if (paid) return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:"#0A1628"}}>
      <div style={{padding:"14px 16px",borderBottom:"1px solid #0F2040",flexShrink:0}}>
        <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",fontSize:13,fontFamily:"'Inter',sans-serif",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:18,lineHeight:1}}>‹</span> Back
        </button>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,padding:24}}>
      <div style={{fontSize:72,animation:"popIn 0.4s ease"}}>🎉</div>
      <h2 style={{color:"#FFFFFF",fontSize:24,fontWeight:900,fontFamily:"'Inter',sans-serif",textAlign:"center"}}>
        {selected.tier==="PredictDirect"?"Funded Account Active!":"Challenge Active!"}
      </h2>
      <p style={{color:"rgba(255,255,255,0.32)",fontSize:13,fontFamily:"'Inter',sans-serif",textAlign:"center",lineHeight:1.6,maxWidth:280}}>
        Your <span style={{color:selected.color,fontWeight:700}}>{selected.tier}</span> {selected.label} is now live.
        {noActAddon && isTest && <span style={{color:"#3B82F6"}}> No activation fee on pass! 🎯</span>}
      </p>
      <div style={{background:"#0F2040",borderRadius:18,border:"1px solid "+(selected.color)+"33",padding:16,width:"100%",maxWidth:320}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[
            ["Balance","$"+(selected.balance.toLocaleString()),"#3B82F6"],
            ["Profit Target", selected.profitTarget?"$"+(selected.profitTarget.toLocaleString()):"Funded","#F4C430"],
            ["Max Loss","$"+(selected.maxLoss.toLocaleString()),"#f93d3d"],
            ["Profit Split",(selected.split)+"%","#7c4dcc"],
            ["Max Bet","$"+(selected.maxBet),"#fff"],
            ["Consistency",(selected.consistency)+"%","#00E5FF"],
          ].map(([l,v,c])=>(
            <div key={l} style={{textAlign:"center",background:"rgba(10,22,40,0.45)",borderRadius:10,padding:"8px 6px"}}>
              <div style={{color:c,fontSize:15,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{v}</div>
              <div style={{color:"rgba(255,255,255,0.42)",fontSize:8,fontFamily:"'Inter',sans-serif",marginTop:1}}>{l.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>
      <button onClick={onClose} style={{background:"#3B82F6",border:"none",borderRadius:99,color:"#fff",fontSize:14,fontWeight:900,padding:"13px 40px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
        📊 Open Dashboard →
      </button>
      </div>
    </div>
  );

  const stepLabel = ["","Choose Account","Add-ons","Confirm"][step] || "Confirm";

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:"#0A1628"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px",borderBottom:"1px solid #0F2040",flexShrink:0}}>
        <button onClick={step>1?()=>setStep(s=> s===3 && !isTest ? 1 : s-1):onClose} style={{width:36,height:36,borderRadius:12,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.15)",color:"#FFFFFF",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:20,lineHeight:1,color:"#FFFFFF",fontWeight:300}}>‹</span></button>
        <span style={{color:"#FFFFFF",fontWeight:700,fontSize:16,fontFamily:"'Inter',sans-serif"}}>{stepLabel}</span>
        <div style={{marginLeft:"auto",display:"flex",gap:5,alignItems:"center"}}>
          {[1,2,3].map(s=>(
            <div key={s} style={{width:s===step?20:7,height:7,borderRadius:99,background:s<=step?"#3B82F6":"#1A2D4A",transition:"all 0.3s"}}/>
          ))}
        </div>
      </div>

      {/* Account count pill */}
      {existingCount > 0 && (
        <div style={{background:"rgba(244,196,48,0.08)",borderBottom:"1px solid rgba(244,196,48,0.133)",padding:"8px 16px",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <span style={{color:"#F4C430",fontSize:11,fontFamily:"'Inter',sans-serif",fontWeight:700}}>
            📂 {existingCount}/5 ACCOUNTS ACTIVE · Max 5 simultaneous accounts
          </span>
        </div>
      )}

      <div style={{flex:1,overflowY:"auto",padding:"16px 16px 80px"}}>

        {/* ── STEP 1: Choose Tier ── */}
        {step===1 && (<>
          <SectionLabel>🎯 EVALUATION ACCOUNTS — PREDICTTEST</SectionLabel>
          <div style={{background:"rgba(20,158,99,0.05)",border:"1px solid rgba(59,130,246,0.133)",borderRadius:12,padding:"10px 12px",marginBottom:12}}>
            <span style={{color:"#3B82F6",fontSize:11,fontFamily:"'Inter',sans-serif"}}>✓ 90% PROFIT SPLIT · 40% CONSISTENCY RULE · 28-DAY WINDOW · AUTO-REBILL</span>
          </div>
          {PROP_TIERS.filter(t=>t.tier==="PredictTest").map(tier=>(
            <div key={tier.id} onClick={()=>setSelected(tier)} style={{background:selected?.id===tier.id?"rgba(59,130,246,0.08)":"#0F2040",borderRadius:16,border:"2px solid "+(selected?.id===tier.id?"#3B82F6":"#1A2D4A"),padding:"14px 16px",marginBottom:10,cursor:"pointer",position:"relative",transition:"all 0.15s"}}>
              {tier.popular && <div style={{position:"absolute",top:-8,right:16,background:"#F4C430",borderRadius:99,padding:"2px 10px"}}><span style={{color:"#000",fontSize:9,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>MOST POPULAR</span></div>}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div>
                  <span style={{color:"#FFFFFF",fontSize:16,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{tier.label}</span>
                  <div style={{color:"rgba(255,255,255,0.25)",fontSize:10,fontFamily:"'Inter',sans-serif",marginTop:2}}>EVALUATION · REBILLS EVERY 28 DAYS IF NOT PASSED</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{color:"#3B82F6",fontSize:22,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>${tier.price}</div>
                  <div style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>+ $149 ACT. ON PASS</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                {[["Profit Target","$"+(tier.profitTarget.toLocaleString()),"#3B82F6"],["Max Loss","$"+(tier.maxLoss.toLocaleString()),"#f93d3d"],["Max Bet","$"+(tier.maxBet),"#fff"]].map(([l,v,c])=>(
                  <div key={l} style={{background:"rgba(10,22,40,0.55)",borderRadius:8,padding:"7px 6px",textAlign:"center"}}>
                    <div style={{color:c,fontSize:13,fontWeight:800,fontFamily:"'Inter',sans-serif"}}>{v}</div>
                    <div style={{color:"rgba(255,255,255,0.42)",fontSize:8,fontFamily:"'Inter',sans-serif",marginTop:1}}>{l.toUpperCase()}</div>
                  </div>
                ))}
              </div>
              {selected?.id===tier.id && <div style={{marginTop:8,display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:16,height:16,borderRadius:"50%",background:"#3B82F6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>✓</div>
                <span style={{color:"#3B82F6",fontSize:11,fontFamily:"'Inter',sans-serif"}}>SELECTED</span>
              </div>
              }
            </div>
          ))}

          <SectionLabel>⚡ INSTANT FUNDED — PREDICTDIRECT</SectionLabel>
          <div style={{background:"rgba(244,196,48,0.05)",border:"1px solid rgba(244,196,48,0.133)",borderRadius:12,padding:"10px 12px",marginBottom:12}}>
            <span style={{color:"#F4C430",fontSize:11,fontFamily:"'Inter',sans-serif"}}>✓ 90% SPLIT · 20% CONSISTENCY RULE · FUNDED DAY 1 · 8 MIN ACTIVE DAYS FOR PAYOUT</span>
          </div>
          {PROP_TIERS.filter(t=>t.tier==="PredictDirect").map(tier=>(
            <div key={tier.id} onClick={()=>setSelected(tier)} style={{background:selected?.id===tier.id?"rgba(244,196,48,0.08)":"#0F2040",borderRadius:16,border:"2px solid "+(selected?.id===tier.id?"#F4C430":"#1A2D4A"),padding:"14px 16px",marginBottom:10,cursor:"pointer",transition:"all 0.15s"}}>
              {tier.popular && <div style={{position:"absolute",top:-8,right:16,background:"#F4C430",borderRadius:99,padding:"2px 10px"}}><span style={{color:"#000",fontSize:9,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>MOST POPULAR</span></div>}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div>
                  <span style={{color:"#FFFFFF",fontSize:16,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{tier.label}</span>
                  <div style={{color:"rgba(255,255,255,0.25)",fontSize:10,fontFamily:"'Inter',sans-serif",marginTop:2}}>INSTANT FUNDED · NO EVALUATION REQUIRED</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{color:"#F4C430",fontSize:22,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>${tier.price}</div>
                  <div style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>ONE-TIME FEE</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                {[["Min Days","8 active","#00E5FF"],["Max Loss","$"+(tier.maxLoss.toLocaleString()),"#f93d3d"],["Max Bet","$"+(tier.maxBet),"#fff"]].map(([l,v,c])=>(
                  <div key={l} style={{background:"rgba(10,22,40,0.55)",borderRadius:8,padding:"7px 6px",textAlign:"center"}}>
                    <div style={{color:c,fontSize:13,fontWeight:800,fontFamily:"'Inter',sans-serif"}}>{v}</div>
                    <div style={{color:"rgba(255,255,255,0.42)",fontSize:8,fontFamily:"'Inter',sans-serif",marginTop:1}}>{l.toUpperCase()}</div>
                  </div>
                ))}
              </div>
              {selected?.id===tier.id && <div style={{marginTop:8,display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:16,height:16,borderRadius:"50%",background:"#F4C430",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>✓</div>
                <span style={{color:"#F4C430",fontSize:11,fontFamily:"'Inter',sans-serif"}}>SELECTED</span>
              </div>
              }
            </div>
          ))}

          <button onClick={()=>selected&&setStep(isTest?2:3)} disabled={!selected} style={{width:"100%",height:52,borderRadius:99,background:selected?selected.color:"#1A2D4A",border:"none",color:selected?"#000":"#1A2D4A",fontSize:15,fontWeight:900,cursor:selected?"pointer":"default",fontFamily:"'Inter',sans-serif",transition:"all 0.2s",marginTop:8}}>
            {selected?"Continue → $"+(selected.price):"Select an account to continue"}
          </button>
        </>)}

        {/* ── STEP 2: Activation Fee Add-on (PredictTest only) ── */}
        {step===2 && selected && isTest && (<>
          <div style={{background:"linear-gradient(135deg,#0A1628,#0A1628)",borderRadius:16,border:"1px solid rgba(59,130,246,0.2)",padding:16,marginBottom:20}}>
            <div style={{color:"#3B82F6",fontSize:13,fontWeight:900,fontFamily:"'Inter',sans-serif",marginBottom:4}}>🎉 Pass your challenge. What happens next?</div>
            <div style={{color:"#6a8090",fontSize:12,fontFamily:"'Inter',sans-serif",lineHeight:1.6}}>
              Once you hit the <span style={{color:"#FFFFFF",fontWeight:700}}>${ selected.profitTarget.toLocaleString()} profit target</span>, you claim your funded account.
              There's an activation fee to do this — but you can eliminate it upfront.
            </div>
          </div>

          <SectionLabel>ACTIVATION FEE OPTIONS</SectionLabel>

          {/* Option A: Pay later */}
          <div onClick={()=>setNoActAddon(false)} style={{background:!noActAddon?"rgba(59,130,246,0.06)":"#0F2040",borderRadius:16,border:"2px solid "+(!noActAddon?"#3B82F6":"#1A2D4A"),padding:"16px",marginBottom:10,cursor:"pointer",transition:"all 0.15s"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{color:"#FFFFFF",fontSize:15,fontWeight:800,fontFamily:"'Inter',sans-serif",marginBottom:2}}>Pay on Pass</div>
                <div style={{color:"rgba(255,255,255,0.32)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>Only pay the activation fee if you successfully pass your challenge.</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                <div style={{color:"rgba(255,255,255,0.42)",fontSize:18,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>+$149</div>
                <div style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>ON PASS</div>
              </div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {["Pay $149 only if you pass","Nothing extra upfront","Standard path"].map(t=>(
                <div key={t} style={{background:"#1A2D4A",borderRadius:99,padding:"3px 8px"}}>
                  <span style={{color:"#6a8090",fontSize:9,fontFamily:"'Inter',sans-serif"}}>{t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Option B: Pay upfront (waive on pass) */}
          <div onClick={()=>setNoActAddon(true)} style={{background:noActAddon?"rgba(244,196,48,0.08)":"#0F2040",borderRadius:16,border:"2px solid "+(noActAddon?"#F4C430":"#1A2D4A"),padding:"16px",marginBottom:20,cursor:"pointer",transition:"all 0.15s",position:"relative"}}>
            <div style={{position:"absolute",top:-8,right:16,background:"#F4C430",borderRadius:99,padding:"2px 10px"}}>
              <span style={{color:"#000",fontSize:9,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>RECOMMENDED</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{color:"#FFFFFF",fontSize:15,fontWeight:800,fontFamily:"'Inter',sans-serif",marginBottom:2}}>Waive Activation Fee ✓</div>
                <div style={{color:"rgba(255,255,255,0.32)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>Add $49 now and skip the $149 activation fee when you pass. Save $100.</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                <div style={{color:"#F4C430",fontSize:18,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>+$49</div>
                <div style={{color:"#3B82F6",fontSize:9,fontFamily:"'Inter',sans-serif"}}>SAVE $100</div>
              </div>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {["No activation fee on pass","Save $100 total","Immediate activation"].map(t=>(
                <div key={t} style={{background:noActAddon?"rgba(244,196,48,0.1)":"#1A2D4A",borderRadius:99,padding:"3px 8px"}}>
                  <span style={{color:noActAddon?"#F4C430":"#6a8090",fontSize:9,fontFamily:"'Inter',sans-serif"}}>✓ {t}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{background:"#0F2040",borderRadius:12,padding:"12px 14px",marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{color:"rgba(255,255,255,0.32)",fontSize:13,fontFamily:"'Inter',sans-serif"}}>{selected.label} challenge fee</span>
              <span style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>${selected.price}</span>
            </div>
            {noActAddon && <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{color:"#F4C430",fontSize:13,fontFamily:"'Inter',sans-serif"}}>Waive activation fee add-on</span>
              <span style={{color:"#F4C430",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>+$49</span>
            </div>
            }
            {!noActAddon && <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{color:"rgba(255,255,255,0.22)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>Activation fee (charged on pass)</span>
              <span style={{color:"rgba(255,255,255,0.25)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>$149*</span>
            </div>
            }
            <div style={{height:1,background:"#1A2D4A",margin:"8px 0"}}/>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{color:"#FFFFFF",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>Due now</span>
              <span style={{color:"#3B82F6",fontSize:16,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>${totalCost}</span>
            </div>
          </div>

          <button onClick={()=>setStep(3)} style={{width:"100%",height:52,borderRadius:99,background:"#3B82F6",border:"none",color:"#fff",fontSize:15,fontWeight:900,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
            Continue to Payment →
          </button>
        </>)}

        {/* ── STEP 3: Confirm & Pay ── */}
        {step===3 && selected && (<>
          <div style={{background:"linear-gradient(135deg,#0A1628,#0F2040)",borderRadius:18,border:"1px solid "+(selected.color)+"33",padding:16,marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div>
                <div style={{color:"#FFFFFF",fontSize:16,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{selected.tier}</div>
                <div style={{color:"rgba(255,255,255,0.32)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>{selected.label}</div>
                {noActAddon && <div style={{color:"#F4C430",fontSize:10,fontFamily:"'Inter',sans-serif",marginTop:3}}>✓ ACTIVATION FEE WAIVED ON PASS</div>}
              </div>
              <div style={{color:selected.color,fontSize:28,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>${totalCost}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {[
                ["Balance","$"+(selected.balance.toLocaleString())],
                ["Profit Target",selected.profitTarget?"$"+(selected.profitTarget.toLocaleString()):"∞"],
                ["Max Loss","$"+(selected.maxLoss.toLocaleString())],
                ["Max Bet","$"+(selected.maxBet)],
                ["Consistency",(selected.consistency)+"%"],
                ["Split",(selected.split)+"%"],
              ].map(([l,v])=>(
                <div key={l} style={{background:"rgba(10,22,40,0.45)",borderRadius:8,padding:"7px 6px",textAlign:"center"}}>
                  <div style={{color:selected.color,fontSize:13,fontWeight:800,fontFamily:"'Inter',sans-serif"}}>{v}</div>
                  <div style={{color:"rgba(255,255,255,0.42)",fontSize:8,fontFamily:"'Inter',sans-serif",marginTop:1}}>{l.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>

          <SectionLabel>WHAT'S INCLUDED</SectionLabel>
          {selected.highlights.map((h,i)=>(
            <div key={i} style={{display:"flex",gap:10,alignItems:"center",padding:"7px 0",borderBottom:"1px solid #0F2040"}}>
              <span style={{color:selected.color,fontSize:13}}>✓</span>
              <span style={{color:"#777",fontSize:12,fontFamily:"'Inter',sans-serif"}}>{h}</span>
            </div>
          ))}

          <SectionLabel>PAYMENT METHOD</SectionLabel>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            {[["card","💳 Card"],["paypal","🅿️ PayPal"],["crypto","₿ Crypto"]].map(([id,label])=>(
              <button key={id} onClick={()=>setPayMethod(id)} style={{flex:1,height:40,borderRadius:10,border:"1px solid "+(payMethod===id?"#3B82F6":"#1A2D4A"),background:payMethod===id?"rgba(59,130,246,0.1)":"#0F2040",color:payMethod===id?"#3B82F6":"rgba(255,255,255,0.32)",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.15s"}}>{label}</button>
            ))}
          </div>

          {/* Discount code */}
          <SectionLabel>DISCOUNT CODE</SectionLabel>
          {appliedCode ? (
            <div style={{background:"rgba(20,158,99,0.08)",border:"1px solid rgba(59,130,246,0.25)",borderRadius:14,padding:"12px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:32,height:32,borderRadius:10,background:"rgba(20,158,99,0.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#3B82F6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:"#3B82F6",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{appliedCode.code} · -{appliedCode.pct}% off</div>
                <div style={{color:"rgba(255,255,255,0.35)",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:1}}>{appliedCode.label}</div>
              </div>
              <button onClick={removeDiscount} style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",fontSize:18,cursor:"pointer",lineHeight:1,padding:"2px 4px",flexShrink:0}}>×</button>
            </div>
          ) : (
            <div style={{marginBottom:16}}>
              <div style={{display:"flex",gap:8}}>
                <input
                  value={discountInput}
                  onChange={e=>{ setDiscountInput(e.target.value.toUpperCase()); setDiscountError(""); }}
                  onKeyDown={e=>e.key==="Enter"&&applyDiscount()}
                  placeholder="Enter code (e.g. DEUS20)"
                  style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid "+(discountError?"rgba(249,61,61,0.5)":"rgba(255,255,255,0.1)"),borderRadius:12,padding:"12px 14px",color:"#FFFFFF",fontSize:13,fontFamily:"'Inter',sans-serif",outline:"none",letterSpacing:1}}
                />
                <button onClick={applyDiscount} style={{background:"rgba(20,158,99,0.12)",border:"1px solid rgba(59,130,246,0.25)",borderRadius:12,color:"#3B82F6",fontSize:13,fontWeight:700,padding:"0 18px",cursor:"pointer",fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap",flexShrink:0}}>Apply</button>
              </div>
              {discountError && <div style={{color:"#f93d3d",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:6,paddingLeft:2}}>{discountError}</div>}
            </div>
          )}

          <div style={{background:"#0F2040",borderRadius:12,padding:"12px 14px",marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{color:"rgba(255,255,255,0.35)",fontSize:13,fontFamily:"'Inter',sans-serif"}}>Subtotal</span>
              <span style={{color:"rgba(255,255,255,0.6)",fontSize:13,fontFamily:"'Inter',sans-serif"}}>${baseCost}.00</span>
            </div>
            {appliedCode && (
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{color:"#3B82F6",fontSize:13,fontFamily:"'Inter',sans-serif"}}>Discount ({appliedCode.code})</span>
                <span style={{color:"#3B82F6",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>−${discountAmt}.00</span>
              </div>
            )}
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <span style={{color:"rgba(255,255,255,0.35)",fontSize:13,fontFamily:"'Inter',sans-serif"}}>Wallet balance</span>
              <span style={{color:"#FFFFFF",fontSize:13,fontFamily:"'Inter',sans-serif",fontWeight:700}}>${balance.toFixed(2)}</span>
            </div>
            <div style={{height:1,background:"rgba(255,255,255,0.06)",marginBottom:8}}/>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{color:"#FFFFFF",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>Total due today</span>
              <div style={{textAlign:"right"}}>
                {appliedCode && <div style={{color:"rgba(255,255,255,0.3)",fontSize:11,fontFamily:"'Inter',sans-serif",textDecoration:"line-through"}}>${baseCost}.00</div>}
                <span style={{color:"#3B82F6",fontSize:17,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>${totalCost}.00</span>
              </div>
            </div>
          </div>

          {!canAfford && (
            <div style={{background:"rgba(249,61,61,0.1)",border:"1px solid rgba(249,61,61,0.2)",borderRadius:12,padding:"10px 14px",marginBottom:12}}>
              <span style={{color:"#f93d3d",fontSize:12,fontFamily:"'Inter',sans-serif"}}>⚠️ Insufficient balance. Add funds via the Wallet tab first.</span>
            </div>
          )}

          <button onClick={handlePay} disabled={!canAfford} style={{width:"100%",height:52,borderRadius:99,background:canAfford?selected.color:"#1A2D4A",border:"none",color:canAfford?"#000":"#1A2D4A",fontSize:15,fontWeight:900,cursor:canAfford?"pointer":"default",fontFamily:"'Inter',sans-serif",transition:"all 0.2s"}}>
            {canAfford?"🚀 Pay $"+(totalCost)+" & Start":"Add funds to continue"}
          </button>
          <p style={{color:"#1A2D4A",fontSize:10,fontFamily:"'Inter',sans-serif",textAlign:"center",marginTop:10}}>Simulated capital · Real payouts · 90% profit split</p>
        </>)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROP FIRM — CHALLENGE DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function PropChallengeDashboard({ onClose, propAccount, votes, dynamicMarkets=[], onOpenPropLeaderboard, onClaim, onOpenAnalytics, onUpdatePropAccount, onAddAccount }) {
  const ALL_PREDS = usePredictions();
  const stats  = buildChallengeStats(votes, propAccount);
  const tier   = PROP_TIERS.find(t=>t.id===propAccount?.tierId) || PROP_TIERS[1];
  const [tab, setTab]             = useState("overview");
  const [posTab, setPosTab]       = useState("open");
  const [sellSheet, setSellSheet] = useState(null); // {bet, pred}
  const [openMarketDetail, setOpenMarketDetail] = useState(null); // pred object
  const openBets   = (propAccount?.bets || []).filter(b => !b.resolved);
  const closedBets = (propAccount?.bets || []).filter(b => b.resolved);
  // Live P&L: resolved bets (stored) + open bets (live market price)
  const totalPnl = parseFloat(((propAccount?.bets || []).reduce((sum, bet) => {
    if (bet.resolved) return sum + (bet.pnlDelta || 0);
    // Open bet: current value = shares × current market price
    const market     = (dynamicMarkets||[]).find(m => String(m.id) === String(bet.predId));
    const currYesPct = market?.yesPct ?? bet.entryPct ?? 50;
    const currPrice  = bet.pos==="YES" ? currYesPct/100 : (100-currYesPct)/100;
    const betShares  = bet.shares > 0 ? bet.shares : (bet.sharePrice > 0 ? bet.stake/bet.sharePrice : bet.stake/0.5);
    const currVal    = betShares * currPrice;
    return sum + (currVal - bet.stake);
  }, 0)).toFixed(2));
  const daysPassed = propAccount?.startedAt
    ? Math.min(28, Math.floor((Date.now() - propAccount.startedAt) / 86400000))
    : (propAccount?.daysPassed || 0);
  const daysLeft = tier.days > 0 ? Math.max(0, tier.days - daysPassed) : null;

  // New pass logic: hit profit target, meet consistency, meet min days
  const pnlPct    = tier.profitTarget ? (stats.pnl / tier.profitTarget) * 100 : 0;
  const lossUsed  = Math.max(0, -stats.pnl);
  const lossUsedPct = (lossUsed / tier.maxLoss) * 100;
  // Consistency check: no single resolved bet > consistency% of total profit
  const resolvedWins = (propAccount?.bets||[]).filter(b => b.resolved && b.pnlDelta > 0);
  const totalWinPnl  = resolvedWins.reduce((s,b) => s + (b.pnlDelta||0), 0);
  const maxSingleWin = resolvedWins.length > 0 ? Math.max(...resolvedWins.map(b => b.pnlDelta||0)) : 0;
  const consistencyOk = totalWinPnl <= 0 || (maxSingleWin / totalWinPnl) <= (tier.consistency / 100);
  const passed    = tier.profitTarget
    ? stats.pnl >= tier.profitTarget && stats.activeDays >= tier.minDays && consistencyOk
    : stats.activeDays >= tier.minDays; // Direct accounts

  const GaugeMeter = ({value, max, label, color="#3B82F6", unit="%", danger=false}) => {
    const pct = Math.min(100, Math.max(0,(value/max)*100));
    const c   = danger ? (pct>75?"#f93d3d":pct>50?"#F4C430":"#3B82F6") : color;
    return (
      <div style={{background:"#0F2040",borderRadius:14,border:"1px solid "+(danger&&pct>75?"rgba(249,61,61,0.133)":"#1A2D4A"),padding:"12px 8px",textAlign:"center"}}>
        <div style={{position:"relative",width:72,height:72,margin:"0 auto 8px"}}>
          <svg viewBox="0 0 72 72" style={{transform:"rotate(-90deg)"}}>
            <circle cx="36" cy="36" r="28" fill="none" stroke="#1A2D4A" strokeWidth="7"/>
            <circle cx="36" cy="36" r="28" fill="none" stroke={c} strokeWidth="7"
              strokeDasharray={(pct*1.76)+" 176"} strokeLinecap="round"/>
          </svg>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <span style={{color:c,fontSize:12,fontWeight:900,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{value}{unit}</span>
          </div>
        </div>
        <div style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif",letterSpacing:0.5}}>{label}</div>
        <div style={{color:"rgba(255,255,255,0.32)",fontSize:8,fontFamily:"'Inter',sans-serif",marginTop:1}}>TARGET: {max}{unit}</div>
      </div>
    );
  };

  return (
    <>
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:"#0A1628"}}>
      <div style={{display:"flex",alignItems:"center",borderBottom:"1px solid #0F2040",flexShrink:0}}>
        <div style={{flex:1}}><OverlayHeader title="📊 Challenge Dashboard" onBack={onClose}/></div>
        {onAddAccount && <button onClick={onAddAccount} style={{background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.25)",borderRadius:12,color:"#3B82F6",fontSize:11,fontWeight:700,padding:"6px 12px",cursor:"pointer",fontFamily:"'Inter',sans-serif",marginRight:14,whiteSpace:"nowrap",flexShrink:0}}>+ Account</button>}
      </div>

      {/* Status banner */}
      <div style={{background:passed?"linear-gradient(135deg,#0F2040,#0F2040)":"linear-gradient(135deg,#100E06,#0F2040)",borderBottom:"1px solid "+(passed?"rgba(59,130,246,0.133)":"rgba(244,196,48,0.133)"),padding:"12px 16px",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{color:tier.color,fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{tier.tier} · {tier.label}</span>
            {passed && <div style={{background:"rgba(20,158,99,0.15)",border:"1px solid rgba(59,130,246,0.267)",borderRadius:20,padding:"3px 10px"}}>
              <span style={{color:"#3B82F6",fontSize:9,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>✅ TARGET MET</span>
            </div>
            }
          </div>
          {daysLeft!==null && <div style={{textAlign:"right"}}>
            <div style={{color:"#FFFFFF",fontSize:18,fontWeight:900,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{daysLeft}</div>
            <div style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>DAYS LEFT</div>
          </div>
          }
        </div>
        <div style={{height:4,background:"#1A2D4A",borderRadius:99,overflow:"hidden"}}>
          <div style={{height:"100%",width:(Math.min(100,(daysPassed/(tier.days||30))*100))+"%",background:"linear-gradient(90deg,#2F805A,#F4C430)",borderRadius:99,transition:"width 0.6s"}}/>
        </div>
      </div>

      {/* Sub tabs */}
      <div style={{display:"flex",background:"#0A1628",borderBottom:"1px solid #0F2040",flexShrink:0}}>
        {[["overview","Overview"],["positions","Positions"],["rules","Rules"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,background:"none",border:"none",borderBottom:"2px solid "+(tab===id?"#3B82F6":"transparent"),color:tab===id?"#3B82F6":"rgba(255,255,255,0.22)",fontSize:11,fontWeight:700,padding:"11px 0",cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:1}}>
            {label.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"16px 16px 80px"}}>
        {tab==="overview" && (<>
          {/* Gauges — profit progress, loss used, active days */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
            {tier.profitTarget
              ? <GaugeMeter value={Math.max(0,stats.pnl)} max={tier.profitTarget} label="PROFIT" color={pnlPct>=100?"#3B82F6":"#00E5FF"} unit="$"/>
              : <GaugeMeter value={stats.activeDays} max={tier.minDays} label="ACTIVE DAYS" color="#3B82F6" unit="d"/>
            }
            <GaugeMeter value={Math.round(lossUsed)} max={tier.maxLoss} label="LOSS USED" color="#f93d3d" danger={true} unit="$"/>
            <GaugeMeter value={stats.activeDays} max={tier.minDays} label="ACTIVE DAYS" color="#7c4dcc" unit="d"/>
          </div>

          {/* Live P&L banner */}
          <div style={{background:totalPnl>=0?"rgba(59,130,246,0.12)":"rgba(249,61,61,0.1)",border:"1px solid "+(totalPnl>=0?"rgba(59,130,246,0.3)":"rgba(249,61,61,0.3)"),borderRadius:14,padding:"14px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{color:"rgba(255,255,255,0.45)",fontSize:10,fontFamily:"'Inter',sans-serif",letterSpacing:1.5,marginBottom:4}}>LIVE NET P&L</div>
              <div style={{color:totalPnl>=0?"#3B82F6":"#f93d3d",fontSize:30,fontWeight:900,fontFamily:"'Inter',sans-serif",lineHeight:1}}>
                {totalPnl>=0?"+":"-"}${Math.abs(totalPnl).toFixed(2)}
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{color:"rgba(255,255,255,0.35)",fontSize:10,fontFamily:"'Inter',sans-serif",marginBottom:4}}>Open positions</div>
              <div style={{color:"#FFFFFF",fontSize:20,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{openBets.length}</div>
            </div>
          </div>

          {/* P&L summary */}
          <div style={{background:"#0F2040",borderRadius:14,padding:"14px 16px",marginBottom:14}}>
            <SectionLabel>P&L SUMMARY</SectionLabel>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:8}}>
              {[
                ["Account Balance","$"+Math.max(0, tier.balance + totalPnl).toLocaleString(), totalPnl>=0?"#3B82F6":totalPnl<0?"#f93d3d":"#c8dae8"],
                ["Net P&L",(totalPnl>=0?"+":"-")+"$"+Math.abs(totalPnl).toFixed(2),totalPnl>=0?"#3B82F6":"#f93d3d"],
                ["Starting Balance","$"+(tier.balance.toLocaleString()),"rgba(255,255,255,0.32)"],
                ["Max Drawdown","$"+(tier.maxLoss.toLocaleString()),"#f93d3d"],
                ["Max Bet","$"+(tier.maxBet),"#c8dae8"],
                ["Consistency",(tier.consistency)+"%","#00E5FF"],
              ].map(([l,v,c])=>(
                <div key={l}>
                  <div style={{color:c,fontSize:16,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{v}</div>
                  <div style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif",marginTop:2}}>{l.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Loss meter */}
          <div style={{background:"#0F2040",borderRadius:14,border:"1px solid "+(lossUsedPct>75?"rgba(249,61,61,0.2)":"#1A2D4A"),padding:"14px 16px",marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>⚠️ Max Loss Meter</span>
              <span style={{color:lossUsedPct>75?"#f93d3d":lossUsedPct>50?"#F4C430":"#3B82F6",fontSize:11,fontFamily:"'Inter',sans-serif",fontWeight:700}}>
                {lossUsedPct>75?"🔴 DANGER":lossUsedPct>50?"🟡 CAUTION":"🟢 SAFE"}
              </span>
            </div>
            <div style={{height:8,background:"#1A2D4A",borderRadius:99,overflow:"hidden",marginBottom:6}}>
              <div style={{height:"100%",width:(Math.min(100,lossUsedPct))+"%",background:lossUsedPct>75?"#f93d3d":lossUsedPct>50?"#F4C430":"#3B82F6",borderRadius:99,transition:"width 0.6s"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>
                ${Math.round(lossUsed).toLocaleString()} used of ${tier.maxLoss.toLocaleString()} max
              </span>
              <span style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>
                ${(tier.maxLoss-Math.round(lossUsed)).toLocaleString()} remaining
              </span>
            </div>
          </div>

          {/* Streak */}
          <div style={{background:"#0F2040",borderRadius:14,padding:"14px 16px",marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>🔥 Profit Streak</span>
              <span style={{color:"#F4C430",fontSize:14,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>4 days</span>
            </div>
            <div style={{display:"flex",gap:4}}>
              {["M","T","W","T","F","S","S"].map((d,i)=>(
                <div key={i} style={{flex:1,height:28,borderRadius:6,background:i<4?"rgba(244,196,48,0.2)":"#1A2D4A",border:"1px solid "+(i<4?"rgba(244,196,48,0.267)":"#0F2040"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:i<4?11:9,color:i<4?"#F4C430":"#1A2D4A"}}>
                  {i<4?"🔥":d}
                </div>
              ))}
            </div>
          </div>

          {/* Rebill warning for PredictTest */}
          {tier.tier==="PredictTest" && daysLeft!==null && daysLeft<=7 && !passed && (
            <div style={{background:"rgba(249,61,61,0.08)",border:"1px solid rgba(249,61,61,0.2)",borderRadius:14,padding:"12px 14px",marginBottom:14}}>
              <div style={{color:"#f93d3d",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:3}}>
                ⏰ Auto-rebill in {daysLeft} days
              </div>
              <div style={{color:"rgba(255,255,255,0.32)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>
                Hit ${tier.profitTarget?.toLocaleString()} profit target before Day {tier.rebillDays} or your account auto-rebills at ${tier.price}.
              </div>
            </div>
          )}

          {passed && (
            <div style={{background:"linear-gradient(135deg,#0F2040,#0F2040)",borderRadius:16,border:"2px solid #3B82F6",padding:16,marginBottom:14}}>
              <div style={{color:"#3B82F6",fontSize:16,fontWeight:900,fontFamily:"'Inter',sans-serif",marginBottom:4}}>🎯 Challenge Target Met!</div>
              <div style={{color:"rgba(255,255,255,0.42)",fontSize:13,fontFamily:"'Inter',sans-serif",marginBottom:12}}>You've hit all requirements. Claim your funded account now.</div>
              <button onClick={onClaim} style={{width:"100%",height:44,borderRadius:99,background:"#3B82F6",border:"none",color:"#fff",fontSize:14,fontWeight:900,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                🚀 Claim Funded Account
              </button>
            </div>
          )}

          <button onClick={onOpenPropLeaderboard} style={{width:"100%",height:44,borderRadius:12,background:"#0F2040",color:"rgba(255,255,255,0.42)",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",marginBottom:8}}>
            🏆 View Prop Leaderboard →
          </button>
          <button onClick={onOpenAnalytics} style={{width:"100%",height:44,borderRadius:12,background:"#0F2040",color:"#00E5FF",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
            📈 View Performance Analytics →
          </button>
        </>)}

        {tab==="positions" && (<>
          {/* Open / Closed sub-tabs */}
          <div style={{display:"flex",background:"#0F2040",borderRadius:12,padding:3,marginBottom:16,gap:2}}>
            {[["open","Open ("+openBets.length+")"],["closed","Closed ("+closedBets.length+")"]].map(([id,label])=>(
              <button key={id} onClick={()=>setPosTab(id)} style={{flex:1,background:posTab===id?"#3B82F6":"transparent",border:"none",borderRadius:9,color:posTab===id?"#000":"rgba(255,255,255,0.32)",fontSize:12,fontWeight:700,padding:"8px 0",cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.2s"}}>
                {label}
              </button>
            ))}
          </div>

          {posTab==="open" && (<>
            {openBets.length === 0 ? (
              <div style={{textAlign:"center",padding:"40px 20px",color:"rgba(255,255,255,0.2)",fontSize:14,fontFamily:"'Inter',sans-serif"}}>
                <div style={{fontSize:40,marginBottom:12}}>📭</div>
                No open positions yet
              </div>
            ) : openBets.map((bet,i) => {
              const pred       = ALL_PREDS.find(p => String(p.id) === String(bet.predId));
              const currYesPct = pred?.yesPct ?? bet.entryPct ?? 50;
              const currPrice  = bet.pos==="YES" ? currYesPct/100 : (100-currYesPct)/100;
              const betShares  = bet.shares > 0 ? bet.shares : (bet.sharePrice > 0 ? (bet.stake||1)/bet.sharePrice : (bet.stake||1)/0.5);
              const currValue  = parseFloat((betShares * currPrice).toFixed(2));
              const unrealised = parseFloat((currValue - (bet.stake||1)).toFixed(2));
              const unrColor   = unrealised >= 0 ? "#3B82F6" : "#f93d3d";
              return (
                <div key={i} style={{background:"#0F2040",borderRadius:14,padding:"14px",marginBottom:8,border:"1px solid rgba(59,130,246,0.12)"}}>
                  {/* Market title — clickable */}
                  <div onClick={()=>pred && setOpenMarketDetail(pred)} style={{marginBottom:10,cursor:pred?"pointer":"default"}}>
                    <div style={{color:"#c8dae8",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif",lineHeight:1.3,marginBottom:6,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
                      {bet.title || pred?.title || bet.predId}
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <div style={{background:bet.pos==="YES"?"rgba(34,197,94,0.15)":"rgba(249,61,61,0.15)",border:"1px solid "+(bet.pos==="YES"?"rgba(34,197,94,0.4)":"rgba(249,61,61,0.4)"),borderRadius:20,padding:"2px 8px"}}>
                        <span style={{color:bet.pos==="YES"?"#22C55E":"#f93d3d",fontSize:10,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{bet.pos}</span>
                      </div>
                      <span style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>{betShares.toFixed(2)} shares @ ${(bet.sharePrice||0.5).toFixed(3)}</span>
                      {pred && <span style={{color:"rgba(59,130,246,0.5)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>tap to view ›</span>}
                    </div>
                  </div>
                  {/* P&L row */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div>
                      <div style={{color:"rgba(255,255,255,0.4)",fontSize:9,fontFamily:"'Inter',sans-serif",marginBottom:2}}>CURRENT ODDS</div>
                      <div style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{currYesPct}% YES</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{color:"rgba(255,255,255,0.4)",fontSize:9,fontFamily:"'Inter',sans-serif",marginBottom:2}}>UNREALISED P&L</div>
                      <div style={{color:unrColor,fontSize:14,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{unrealised>=0?"+":"-"}${Math.abs(unrealised).toFixed(2)}</div>
                      <div style={{color:"rgba(255,255,255,0.25)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>val ${currValue.toFixed(2)}</div>
                    </div>
                  </div>
                  {/* Probability bar */}
                  <div style={{height:4,background:"#1A2D4A",borderRadius:99,overflow:"hidden",marginBottom:8}}>
                    <div style={{height:"100%",width:currYesPct+"%",background:"linear-gradient(90deg,#2F805A,#00c9a7)",borderRadius:99,transition:"width 0.5s"}}/>
                  </div>
                  {/* Sell button */}
                  <button onClick={(e)=>{e.stopPropagation();setSellSheet({bet,pred});}} style={{width:"100%",background:"rgba(249,61,61,0.12)",border:"1px solid rgba(249,61,61,0.3)",borderRadius:10,color:"#f93d3d",fontSize:11,fontWeight:700,padding:"8px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                    Sell Position · ${currValue.toFixed(2)}
                  </button>
                </div>
              );
            })}
          </>)}

          {posTab==="closed" && (<>
            {closedBets.length === 0 ? (
              <div style={{textAlign:"center",padding:"40px 20px",color:"rgba(255,255,255,0.2)",fontSize:14,fontFamily:"'Inter',sans-serif"}}>
                <div style={{fontSize:40,marginBottom:12}}>📊</div>
                No resolved positions yet
              </div>
            ) : closedBets.map((bet,i) => {
              const pnl = bet.pnlDelta||0;
              return (
                <div key={i} style={{background:"#0F2040",borderRadius:14,padding:"12px 14px",marginBottom:6,opacity:0.85,border:"1px solid "+(bet.won?"rgba(59,130,246,0.15)":"rgba(249,61,61,0.1)")}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{flex:1,minWidth:0,marginRight:8}}>
                      <div style={{color:"rgba(255,255,255,0.42)",fontSize:11,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {(bet.title || bet.predId)?.slice(0,45)}
                      </div>
                      <div style={{color:"rgba(255,255,255,0.25)",fontSize:9,fontFamily:"'Inter',sans-serif",marginTop:2}}>{bet.pos} · ${(bet.stake||0).toFixed(2)}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{color:bet.soldEarly?"#F4C430":bet.won?"#3B82F6":"#f93d3d",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:2}}>{bet.soldEarly?"📤 SOLD":bet.won?"✓ WON":"✗ LOST"}</div>
                      <div style={{color:pnl>=0?"#3B82F6":"#f93d3d",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{pnl>=0?"+":"-"}${Math.abs(pnl).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </>)}
        </>)}

        {tab==="rules" && (
          [["🎯","Profit Target",tier.profitTarget?"Hit $"+(tier.profitTarget.toLocaleString())+" in net profit to pass. Consistency rule: no single market may account for more than "+(tier.consistency)+"% of your total profit.":"Funded accounts have no profit target — just maintain min activity for payouts."],
           ["📉","Max Loss (Account Blown)","If your total losses exceed $"+(tier.maxLoss.toLocaleString())+", your account is immediately closed. This is a hard dollar limit, not a percentage."],
           ["💸","Max Bet Size","No single market bet may exceed $"+(tier.maxBet)+". Bets over this limit will be rejected by the system."],
           ["📅","Active Days","Be active on at least "+(tier.minDays)+" separate calendar days. "+(tier.tier==="PredictDirect"?"Required before requesting a payout.":"Required to pass the challenge.")],
           ...(tier.tier==="PredictTest"?[["🔄","28-Day Rebill","Your challenge window is "+(tier.days)+" days. If the profit target is not met, your account auto-rebills at $"+(tier.price)+". Cancel anytime before rebill."]]:
              [["⏱","Minimum Days for Payout","You need to be active on at least 8 separate days before your first payout is eligible."]]),
           ["⚖️","Consistency Rule","No single market may account for more than "+(tier.consistency)+"% of your total challenge profit. Spreads risk across multiple predictions."],
           ["🚫","Manipulation","Exploiting extreme odds (<5% or >95%), coordinated betting, copy trading from external sources, or running multiple accounts for the same trade is prohibited."],
          ].map(([icon,title,desc])=>(
            <div key={title} style={{background:"#0F2040",borderRadius:14,padding:"14px",marginBottom:8,display:"flex",gap:12}}>
              <span style={{fontSize:20,flexShrink:0}}>{icon}</span>
              <div>
                <div style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:4}}>{title}</div>
                <div style={{color:"rgba(255,255,255,0.32)",fontSize:12,fontFamily:"'Inter',sans-serif",lineHeight:1.5}}>{desc}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>

    {openMarketDetail && (
      <div style={{position:"fixed",inset:0,zIndex:300,maxWidth:430,margin:"0 auto"}}>
        <MarketDetailSheet pred={openMarketDetail} onClose={()=>setOpenMarketDetail(null)}/>
      </div>
    )}
    {sellSheet && (
      <SellPositionSheet
        pred={sellSheet.pred || {title: sellSheet.bet?.predId, yesPct: 50, daysLeft:"—"}}
        vote={{
          pos:        sellSheet.bet?.pos,
          amount:     sellSheet.bet?.stake,
          shares:     sellSheet.bet?.shares,
          sharePrice: sellSheet.bet?.sharePrice,
        }}
        onClose={(result) => {
          if (result != null && onUpdatePropAccount) {
            const bet = sellSheet.bet;
            onUpdatePropAccount(propAccount.id, result, bet, true);
          }
          setSellSheet(null);
        }}
      />
    )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROP FIRM — FUNDED ACCOUNT DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// WITHDRAWAL FLOW — ACH / Crypto / Wise → KYC
// ─────────────────────────────────────────────────────────────────────────────
function WithdrawalFlow({ amount, splitPct, pnl, onDone, isFirstPayout=false }) {
  const [step, setStep] = useState("method"); // "method" | "kyc" | "done"
  const [method, setMethod] = useState(null);
  const [kycStep, setKycStep] = useState(0); // 0=intro 1=identity 2=address 3=selfie
  const [formData, setFormData] = useState({});
  const [uploading, setUploading] = useState(false);

  const METHODS = [
    { id:"ach",    icon:"🏦", label:"ACH Transfer",   sub:"US bank account · 1-3 business days",  color:"#00E5FF", fee:"Free" },
    { id:"crypto", icon:"₿",  label:"Cryptocurrency", sub:"USDC / USDT / BTC · Within 1 hour",   color:"#F4C430", fee:"~$2 network fee" },
    { id:"wise",   icon:"🌍", label:"Wise (Intl)",    sub:"International · 1-2 business days",    color:"#9fdb71", fee:"Small FX fee" },
  ];

  const KYC_STEPS = [
    { title:"Government ID", icon:"🪪", desc:"Passport, driver's licence, or national ID card", fields:[
      {name:"fullName",label:"Full Legal Name",type:"text",placeholder:"As on your ID"},
      {name:"dob",label:"Date of Birth",type:"date"},
      {name:"idType",label:"ID Type",type:"select",options:["Passport","Driver's Licence","National ID"]},
    ]},
    { title:"Address Verification", icon:"📍", desc:"Must match your government ID", fields:[
      {name:"street",label:"Street Address",type:"text",placeholder:"123 Main St"},
      {name:"city",label:"City",type:"text",placeholder:"City"},
      {name:"country",label:"Country",type:"select",options:["Australia","United States","United Kingdom","Canada","Other"]},
      {name:"postcode",label:"Postcode / ZIP",type:"text",placeholder:"2000"},
    ]},
    { title:"Selfie Verification", icon:"🤳", desc:"Take a selfie holding your ID open to the photo page", fields:[] },
  ];

  if (step === "method") {
    return (
      <div>
        {/* Amount summary */}
        {isFirstPayout && (
          <div style={{background:"linear-gradient(135deg,rgba(244,196,48,0.15),rgba(244,196,48,0.08))",border:"1px solid rgba(244,196,48,0.4)",borderRadius:14,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:22}}>🎉</span>
            <div>
              <div style={{color:"#F4C430",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>First Payout Bonus — 100% Split!</div>
              <div style={{color:"rgba(255,255,255,0.4)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>You keep every dollar of your first withdrawal. Subsequent payouts are 90%.</div>
            </div>
          </div>
        )}
        <div style={{background:"linear-gradient(135deg,#0A1628,#0F2040)",border:"1px solid rgba(59,130,246,0.133)",borderRadius:14,padding:"14px 16px",marginBottom:20}}>
          {[["Available profit","$"+(pnl.toFixed(2))],["Your split ("+(isFirstPayout?"100":splitPct)+"%)","$"+(amount.toFixed(2))],["Processing","Within 24 hours"]].map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0"}}>
              <span style={{color:"rgba(255,255,255,0.32)",fontSize:13,fontFamily:"'Inter',sans-serif"}}>{l}</span>
              <span style={{color:"#3B82F6",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{color:"rgba(255,255,255,0.22)",fontSize:9,fontFamily:"'Inter',sans-serif",letterSpacing:1.5,marginBottom:12}}>SELECT WITHDRAWAL METHOD</div>
        {METHODS.map(m=>(
          <button key={m.id} onClick={()=>setMethod(m.id)} style={{width:"100%",background:method===m.id?(m.color)+"12":"#0F2040",border:"2px solid "+(method===m.id?m.color:"#1A2D4A"),borderRadius:16,padding:"16px",marginBottom:10,cursor:"pointer",display:"flex",alignItems:"center",gap:14,textAlign:"left",transition:"all 0.2s"}}>
            <div style={{width:48,height:48,borderRadius:14,background:(m.color)+"15",border:"1px solid "+(m.color)+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{m.icon}</div>
            <div style={{flex:1}}>
              <div style={{color:"#FFFFFF",fontSize:15,fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:3}}>{m.label}</div>
              <div style={{color:"rgba(255,255,255,0.3)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>{m.sub}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{color:m.color,fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{m.fee}</div>
              {method===m.id && <div style={{color:m.color,fontSize:16,marginTop:2}}>✓</div>}
            </div>
          </button>
        ))}

        <div style={{background:"rgba(244,196,48,0.08)",border:"1px solid rgba(244,196,48,0.133)",borderRadius:12,padding:"10px 14px",marginBottom:20,marginTop:4}}>
          <div style={{color:"#F4C430",fontSize:10,fontFamily:"'Inter',sans-serif",marginBottom:3}}>🔒 KYC REQUIRED FOR FIRST WITHDRAWAL</div>
          <div style={{color:"rgba(255,255,255,0.32)",fontSize:12,fontFamily:"'Inter',sans-serif",lineHeight:1.5}}>Identity verification required by financial regulations. Takes ~2 minutes.</div>
        </div>

        <button onClick={()=>{ if(method) setStep("kyc"); }} disabled={!method} style={{width:"100%",height:52,borderRadius:99,background:method?"#3B82F6":"#1A2D4A",border:"none",color:method?"#000":"#1A2D4A",fontSize:15,fontWeight:900,cursor:method?"pointer":"not-allowed",fontFamily:"'Inter',sans-serif",transition:"all 0.2s"}}>
          Continue to Verification →
        </button>
      </div>
    );
  }

  if (step === "kyc") {
    const cur = KYC_STEPS[kycStep];
    const isLast = kycStep === KYC_STEPS.length - 1;
    const selMethod = METHODS.find(m=>m.id===method);

    return (
      <div>
        {/* Progress */}
        <div style={{display:"flex",gap:6,marginBottom:20}}>
          {KYC_STEPS.map((_,i)=>(
            <div key={i} style={{flex:1,height:3,borderRadius:99,background:i<=kycStep?"#3B82F6":"#1A2D4A",transition:"background 0.3s"}}/>
          ))}
        </div>

        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          <div style={{width:44,height:44,borderRadius:12,background:"rgba(20,158,99,0.12)",border:"1px solid rgba(59,130,246,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{cur.icon}</div>
          <div>
            <div style={{color:"#FFFFFF",fontSize:16,fontWeight:800,fontFamily:"'Inter',sans-serif"}}>{cur.title}</div>
            <div style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif",marginTop:1}}>Step {kycStep+1} of {KYC_STEPS.length}</div>
          </div>
        </div>
        <div style={{color:"#6a8090",fontSize:13,fontFamily:"'Inter',sans-serif",marginBottom:18,lineHeight:1.5}}>{cur.desc}</div>

        {cur.fields.map(f=>(
          <div key={f.name} style={{marginBottom:14}}>
            <div style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontFamily:"'Inter',sans-serif",letterSpacing:1,marginBottom:6}}>{f.label.toUpperCase()}</div>
            {f.type==="select" ? (
              <select value={formData[f.name]||""} onChange={e=>setFormData(d=>({...d,[f.name]:e.target.value}))}
                style={{width:"100%",background:"#0F2040",border:"1px solid #1A2D4A",borderRadius:10,padding:"12px 14px",color:formData[f.name]?"#fff":"rgba(255,255,255,0.22)",fontSize:13,fontFamily:"'Inter',sans-serif",outline:"none",cursor:"pointer"}}>
                <option value="">Select...</option>
                {f.options.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input type={f.type} value={formData[f.name]||""} onChange={e=>setFormData(d=>({...d,[f.name]:e.target.value}))} placeholder={f.placeholder||""}
                style={{width:"100%",background:"#0F2040",border:"1px solid #1A2D4A",borderRadius:10,padding:"12px 14px",color:"#FFFFFF",fontSize:13,fontFamily:"'Inter',sans-serif",outline:"none"}}/>
            )}
          </div>
        ))}

        {/* Selfie step mock */}
        {cur.icon==="🤳" && (
          <div style={{border:"2px dashed #1A2D4A",borderRadius:16,padding:"32px 16px",textAlign:"center",marginBottom:16,cursor:"pointer",background:"#0F2040"}} onClick={()=>{ setUploading(true); setTimeout(()=>setUploading(false),1500); }}>
            {uploading ? (
              <div>
                <div style={{fontSize:32,marginBottom:8}}>⏳</div>
                <div style={{color:"rgba(255,255,255,0.3)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>Processing...</div>
              </div>
            ) : (
              <div>
                <div style={{fontSize:48,marginBottom:8}}>📷</div>
                <div style={{color:"#FFFFFF",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:4}}>Tap to upload selfie</div>
                <div style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>Hold your open ID next to your face</div>
              </div>
            )}
          </div>
        )}

        <div style={{display:"flex",gap:10}}>
          {kycStep>0 && (
            <button onClick={()=>setKycStep(k=>k-1)} style={{flex:1,height:50,borderRadius:99,background:"#0F2040",border:"1px solid #1A2D4A",color:"#6a8090",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>← Back</button>
          )}
          <button onClick={()=>{ if(isLast) setStep("done"); else setKycStep(k=>k+1); }} style={{flex:2,height:50,borderRadius:99,background:"#3B82F6",border:"none",color:"#fff",fontSize:14,fontWeight:900,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
            {isLast?"Submit & Request Payout →":"Continue →"}
          </button>
        </div>
      </div>
    );
  }

  // Done step
  const selMethod = METHODS.find(m=>m.id===method);
  return (
    <div style={{textAlign:"center",padding:"20px 0"}}>
      <div style={{width:80,height:80,borderRadius:"50%",background:"rgba(20,158,99,0.15)",border:"2px solid #3B82F6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 16px"}}>✓</div>
      <div style={{color:"#3B82F6",fontSize:20,fontWeight:900,fontFamily:"'Inter',sans-serif",marginBottom:6}}>Withdrawal Requested!</div>
      <div style={{color:"rgba(255,255,255,0.32)",fontSize:13,fontFamily:"'Inter',sans-serif",lineHeight:1.6,marginBottom:6}}>
        ${amount.toFixed(2)} via {selMethod?.label}
      </div>
      <div style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif",marginBottom:24}}>{selMethod?.sub}</div>
      <div style={{background:"#0A1628",border:"1px solid rgba(59,130,246,0.133)",borderRadius:12,padding:"14px",marginBottom:24}}>
        <div style={{color:"#3B82F6",fontSize:11,fontFamily:"'Inter',sans-serif",marginBottom:4}}>REFERENCE NUMBER</div>
        <div style={{color:"#FFFFFF",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>WD-{Date.now().toString(36).toUpperCase()}</div>
      </div>
      <button onClick={onDone} style={{background:"#3B82F6",border:"none",borderRadius:99,color:"#fff",fontSize:14,fontWeight:900,padding:"14px 40px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Done</button>
    </div>
  );
}

function PropFundedDashboard({ onClose, propAccount, votes, onOpenAnalytics, onBreach, onGraduate, onPayout }) {
  const stats     = buildChallengeStats(votes, propAccount);
  const tier      = PROP_TIERS.find(t=>t.id===propAccount?.tierId) || PROP_TIERS[1];
  const payouts   = propAccount?.payouts || 0;
  const startBal  = tier?.balance || 5000;
  const scaledBal = startBal + (propAccount?.pnl || 0);
  // 100% on first payout, 90% on all subsequent
  const splitPct  = payouts === 0 ? 100 : 90;
  const toElite   = Math.max(0,6-payouts);
  // Real P&L from resolved bets
  const realPnl   = propAccount?.pnl || 0;
  const pnlColor  = realPnl >= 0 ? "#3B82F6" : "#f93d3d";
  // Drawdown warning
  const drawdown  = Math.max(0, -(realPnl));
  const drawdownPct = tier ? (drawdown / tier.maxLoss) * 100 : 0;
  const [showPayout, setShowPayout] = useState(false);
  const [payDone, setPayDone]       = useState(false);
  const [payoutAmount, setPayoutAmount] = useState(0);

  const TxRow = ({icon,label,amount,date,positive}) => (
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:"1px solid #0F2040"}}>
      <div style={{width:36,height:36,borderRadius:"50%",background:"#0F2040",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{icon}</div>
      <div style={{flex:1}}>
        <div style={{color:"rgba(255,255,255,0.72)",fontSize:13,fontFamily:"'Inter',sans-serif"}}>{label}</div>
        <div style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif",marginTop:1}}>{date}</div>
      </div>
      <div style={{color:positive?"#3B82F6":"#f93d3d",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{positive?"+":""}{amount}</div>
    </div>
  );

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:"#0A1628"}}>
      <OverlayHeader title="💰 Funded Account" onBack={onClose}/>

      {/* Hero */}
      <div style={{background:"linear-gradient(160deg,#0F2040,#090F14)",padding:"20px 16px 16px",flexShrink:0,borderBottom:"1px solid #0F2040"}}>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <div style={{background:"rgba(20,158,99,0.12)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:20,padding:"3px 10px"}}>
            <span style={{color:"#3B82F6",fontSize:10,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>FUNDED ✓</span>
          </div>
          <div style={{background:"rgba(244,196,48,0.1)",border:"1px solid rgba(244,196,48,0.2)",borderRadius:20,padding:"3px 10px"}}>
            <span style={{color:"#F4C430",fontSize:10,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{splitPct}% SPLIT</span>
          </div>
          {toElite===0 && <div style={{background:"rgba(244,196,48,0.1)",border:"1px solid rgba(244,196,48,0.2)",borderRadius:20,padding:"3px 10px"}}>
            <span style={{color:"#F4C430",fontSize:10,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>🏆 ELITE ELIGIBLE</span>
          </div>
          }
        </div>
        <div style={{color:scaledBal>=startBal?"#3B82F6":"#f93d3d",fontSize:40,fontWeight:900,fontFamily:"'Inter',sans-serif",lineHeight:1}}>${scaledBal.toFixed(2)}</div>
        <div style={{color:"rgba(255,255,255,0.42)",fontSize:12,fontFamily:"'Inter',sans-serif",marginBottom:16}}>FUNDED BALANCE</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
          {[[(realPnl>=0?"+":"")+realPnl.toFixed(2),"Net P&L",pnlColor],[(stats.accuracy)+"%","Accuracy","#fff"],[payouts+" paid","Payouts","#F4C430"]].map(([v,l,c])=>(
            <div key={l} style={{background:"rgba(10,22,40,0.55)",borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
              <div style={{color:c,fontSize:16,fontWeight:900,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{v}</div>
              <div style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif",marginTop:3}}>{l.toUpperCase()}</div>
            </div>
          ))}
        </div>
        {drawdownPct > 50 && (
          <div style={{background:"rgba(249,61,61,0.1)",border:"1px solid rgba(249,61,61,0.25)",borderRadius:10,padding:"8px 12px",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:14}}>⚠️</span>
            <span style={{color:"#f93d3d",fontSize:12,fontFamily:"'Inter',sans-serif"}}>
              {drawdownPct.toFixed(0)}% of max drawdown used — ${(tier?.maxLoss-drawdown).toFixed(0)} remaining
            </span>
          </div>
        )}
        <button onClick={()=>setShowPayout(true)} style={{width:"100%",height:48,borderRadius:99,background:"linear-gradient(135deg,#2F805A,#2d5c41)",border:"none",color:"#000",fontSize:14,fontWeight:900,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
          💸 Request Payout
        </button>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"16px 16px 80px"}}>
        {/* Scale-up */}
        <SectionLabel>SCALE-UP PROGRESS</SectionLabel>
        <div style={{background:"#0F2040",borderRadius:14,padding:"14px 16px",marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>Payouts to PredictElite</span>
            <span style={{color:"#F4C430",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{payouts}/6</span>
          </div>
          <div style={{height:6,background:"#1A2D4A",borderRadius:99,overflow:"hidden",marginBottom:6}}>
            <div style={{height:"100%",width:((payouts/6)*100)+"%",background:"linear-gradient(90deg,#2F805A,#F4C430)",borderRadius:99,transition:"width 0.6s"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{color:"rgba(255,255,255,0.25)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>{toElite} more payout{toElite!==1?"s":""} to Elite</span>
            <span style={{color:"#F4C430",fontSize:10,fontFamily:"'Inter',sans-serif"}}>🏆 {toElite===0?"ELIGIBLE!":"Keep going"}</span>
          </div>
        </div>

        {/* Milestones row */}
        <SectionLabel>BALANCE MILESTONES</SectionLabel>
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,marginBottom:14,scrollbarWidth:"none"}}>
          {[["Start","$5K",true],["+1","$7.5K",payouts>=1],["+2","$10K",payouts>=2],["+3","$15K",payouts>=3],["+5","$25K",payouts>=5],["+6","$50K",payouts>=6]].map(([lbl,bal,done],i)=>(
            <div key={i} style={{flexShrink:0,width:70,background:done?"rgba(59,130,246,0.08)":"#0F2040",border:"1px solid "+(done?"rgba(59,130,246,0.2)":"#1A2D4A"),borderRadius:12,padding:"10px 6px",textAlign:"center"}}>
              <div style={{color:done?"#3B82F6":"#1A2D4A",fontSize:13,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{bal}</div>
              <div style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif",marginTop:2}}>{lbl}</div>
              {done && <div style={{color:"#3B82F6",fontSize:10,marginTop:2}}>✓</div>}
            </div>
          ))}
        </div>

        {/* Transactions */}
        <SectionLabel>TRANSACTION HISTORY</SectionLabel>
        <TxRow icon="💰" label="Payout #3 — 80% split" amount="+$620.00" date="Feb 21, 2026" positive={true}/>
        <TxRow icon="💰" label="Payout #2 — 80% split" amount="+$480.00" date="Feb 14, 2026" positive={true}/>
        <TxRow icon="💰" label="Payout #1 — 75% split" amount="+$310.00" date="Feb 7, 2026" positive={true}/>
        <TxRow icon="🎯" label="Challenge fee — PredictTest $5K" amount="-$59.00" date="Jan 31, 2026" positive={false}/>

        <div style={{height:1,background:"#0F2040",margin:"16px 0"}}/>

        {/* Actions */}
        <button onClick={onOpenAnalytics} style={{width:"100%",height:46,borderRadius:12,background:"#0F2040",border:"1px solid rgba(0,229,255,0.2)",color:"#00E5FF",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          📈 Performance Analytics
        </button>
        {toElite===0 && (
          <button onClick={onGraduate} style={{width:"100%",height:46,borderRadius:12,background:"linear-gradient(135deg,#1a1500,#0F2040)",border:"1px solid rgba(244,196,48,0.267)",color:"#F4C430",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            🌟 Graduate to PredictLive →
          </button>
        )}
        <button onClick={onBreach} style={{width:"100%",height:40,borderRadius:12,background:"none",border:"1px solid rgba(249,61,61,0.133)",color:"#f93d3d",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif",opacity:0.6}}>
          ⚠️ Simulate Account Breach (demo)
        </button>

      </div>

      {/* Withdrawal flow sheet */}
      {showPayout && (
        <Sheet onClose={()=>setShowPayout(false)} title="💸 Request Withdrawal">
          <WithdrawalFlow
            amount={Math.max(0, realPnl * (splitPct/100))}
            splitPct={splitPct}
            pnl={realPnl}
            isFirstPayout={payouts === 0}
            onDone={(amt)=>{
              setPayoutAmount(amt);
              setShowPayout(false);
              setPayDone(true);
              // Record payout on account — increment payouts, add to balance
              if (onPayout) onPayout(propAccount.id, amt, realPnl);
            }}
          />
        </Sheet>
      )}

      {payDone && (
        <div style={{position:"absolute",inset:0,zIndex:200,background:"rgba(10,22,40,0.9)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#0F2040",borderRadius:24,padding:"32px 24px",textAlign:"center",width:"80%",border:"1px solid rgba(59,130,246,0.2)"}}>
            <div style={{fontSize:56,marginBottom:12}}>💰</div>
            <div style={{color:"#3B82F6",fontSize:20,fontWeight:900,fontFamily:"'Inter',sans-serif",marginBottom:6}}>Payout Requested!</div>
            <div style={{color:"#F4C430",fontSize:28,fontWeight:900,fontFamily:"'Inter',sans-serif",marginBottom:6}}>${payoutAmount.toFixed(2)}</div>
            <div style={{color:"rgba(255,255,255,0.32)",fontSize:13,fontFamily:"'Inter',sans-serif",marginBottom:20,lineHeight:1.5}}>Funds arrive within 24 hours.<br/>Your P&L has been reset for the next cycle.</div>
            <button onClick={()=>setPayDone(false)} style={{background:"#3B82F6",border:"none",borderRadius:99,color:"#fff",fontSize:13,fontWeight:900,padding:"12px 32px",cursor:"pointer"}}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROP FIRM — LEADERBOARD
// ─────────────────────────────────────────────────────────────────────────────
function PropLeaderboard({ onClose }) {
  const [period, setPeriod] = useState("monthly");
  const tierColors = {"PredictLive":"#F4C430","PredictElite":"#7c4dcc","Funded":"#3B82F6"};

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:"#0A1628"}}>
      <OverlayHeader title="🏆 Prop Leaderboard" onBack={onClose}/>

      <div style={{padding:"12px 16px",background:"#0A1628",borderBottom:"1px solid #0F2040",flexShrink:0,display:"flex",gap:8}}>
        {["weekly","monthly","alltime"].map(p=>(
          <button key={p} onClick={()=>setPeriod(p)} style={{background:period===p?"#3B82F6":"#1A2D4A",border:"none",borderRadius:20,color:period===p?"#000":"rgba(255,255,255,0.22)",fontSize:10,fontWeight:700,padding:"6px 14px",cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:1,textTransform:"uppercase",transition:"all 0.2s"}}>
            {p==="alltime"?"ALL TIME":p.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"12px 16px 80px"}}>
        {/* Podium */}
        <div style={{display:"flex",alignItems:"flex-end",gap:6,marginBottom:20,height:130}}>
          {[PROP_LEADERBOARD[1],PROP_LEADERBOARD[0],PROP_LEADERBOARD[2]].map((r,i)=>{
            const hs=[85,130,70]; const medals=["🥈","🥇","🥉"];
            return (
              <div key={r.user} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{width:38,height:38,borderRadius:"50%",background:r.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>{r.avatar}</div>
                <div style={{fontSize:9,color:"#6a8090",fontFamily:"'Inter',sans-serif",textAlign:"center"}}>@{r.user.slice(0,9)}</div>
                <div style={{width:"100%",height:hs[i],background:i===1?"linear-gradient(180deg,#2F805A,#2d5c41)":"#0F2040",border:"1px solid "+(i===1?"rgba(59,130,246,0.267)":"#1A2D4A"),borderRadius:"8px 8px 0 0",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
                  <span style={{fontSize:18}}>{medals[i]}</span>
                  <span style={{color:"#FFFFFF",fontSize:11,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>${r.profit.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Full list */}
        {PROP_LEADERBOARD.map((r,i)=>(
          <div key={r.rank} style={{background:r.isMe?"#0F2040":"#0F2040",borderRadius:14,border:r.isMe?"1px solid rgba(59,130,246,0.2)":"1px solid #1A2D4A",padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:26,textAlign:"center",color:["#F4C430","rgba(255,255,255,0.62)","#C97A28"][i]||"#1A2D4A",fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:i<3?16:12}}>
              {i<3?["🥇","🥈","🥉"][i]:r.rank}
            </div>
            <div style={{width:36,height:36,borderRadius:"50%",background:r.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{r.avatar}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{color:r.isMe?"#3B82F6":"#fff",fontWeight:700,fontSize:13,fontFamily:"'Inter',sans-serif"}}>@{r.user}</span>
                {r.isMe&&<Badge color="#3B82F6">YOU</Badge>}
              </div>
              <div style={{display:"flex",gap:6,marginTop:3,alignItems:"center"}}>
                <div style={{background:(tierColors[r.tier]||"#1A2D4A")+"22",border:"1px solid "+(tierColors[r.tier]||"#1A2D4A")+"44",borderRadius:99,padding:"1px 7px"}}>
                  <span style={{color:tierColors[r.tier]||"rgba(255,255,255,0.42)",fontSize:8,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{r.tier.toUpperCase()}</span>
                </div>
                <span style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>{r.accuracy}% · {r.payouts} payouts</span>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{color:"#3B82F6",fontSize:15,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>${r.profit.toLocaleString()}</div>
              <div style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>EARNED</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROP FIRM — PERFORMANCE ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────
function PropAnalytics({ onClose, votes, resolvedBets, propAccount }) {
  const ALL_PREDS = usePredictions();
  const stats = buildChallengeStats(votes, propAccount);

  // ── Real resolved bets with full data ─────────────────────────────────────
  // Build a title lookup from propAccount.bets (has stored titles)
  const propBetTitles = {};
  (propAccount?.bets||[]).forEach(b => { if (b.title) propBetTitles[String(b.predId)] = b.title; });

  const resolvedEntries = Object.entries(votes||{})
    .filter(([id]) => resolvedBets[id])
    .map(([id, v]) => {
      const market   = ALL_PREDS.find(p => String(p.id) === String(id));
      const won      = resolvedBets[id] === v.pos;
      const shares   = v.shares > 0 ? v.shares : ((v.amount||1) / Math.max(0.01, v.sharePrice||0.5));
      const pnl      = won ? parseFloat((shares - (v.amount||1)).toFixed(2)) : -(v.amount||1);
      const entryPct = v.pos === "YES" ? (v.sharePrice ? Math.round(v.sharePrice*100) : 50) : (v.sharePrice ? Math.round((1-v.sharePrice)*100) : 50);
      // Title priority: stored in vote > stored in propBet > live market > id
      const title    = v.title || propBetTitles[String(id)] || market?.title || market?.question || String(id);
      return { id, v: {...v, title}, market, won, pnl, entryPct, shares, title };
    });

  // ── Calibration — real data by odds band ──────────────────────────────────
  const bands = [
    {label:"<30%", min:0,  max:30},
    {label:"30–50%",min:30, max:50},
    {label:"50–70%",min:50, max:70},
    {label:">70%", min:70, max:100},
  ];
  const calibration = bands.map(b => {
    const inBand = resolvedEntries.filter(e => e.entryPct >= b.min && e.entryPct < b.max);
    const wins   = inBand.filter(e => e.won).length;
    return {
      band:     b.label,
      expected: Math.round((b.min + b.max) / 2),
      actual:   inBand.length > 0 ? Math.round((wins / inBand.length) * 100) : null,
      count:    inBand.length,
    };
  });

  // ── Category breakdown ────────────────────────────────────────────────────
  const catMap = {};
  resolvedEntries.forEach(({ market, v, won }) => {
    const cat = market?.category || "CRYPTO";
    if (!catMap[cat]) catMap[cat] = { wins:0, total:0, vol:0, color: CATEGORY_META[cat]?.color||"rgba(255,255,255,0.42)" };
    catMap[cat].total++;
    catMap[cat].vol += v.amount||1;
    if (won) catMap[cat].wins++;
  });
  const totalVol    = Object.values(catMap).reduce((s,c) => s+c.vol, 0) || 1;
  const catBreakdown = Object.entries(catMap).map(([cat,c]) => ({
    cat, color:c.color,
    pct: Math.round((c.vol/totalVol)*100),
    acc: c.total > 0 ? Math.round((c.wins/c.total)*100) : 0,
  })).sort((a,b) => b.pct - a.pct);

  // ── Best & Worst bets (real data, sorted by pnl) ──────────────────────────
  const sortedByPnl = [...resolvedEntries].sort((a,b) => b.pnl - a.pnl);
  const bestBets    = sortedByPnl.filter(e => e.pnl > 0).slice(0, 5);
  const worstBets   = sortedByPnl.filter(e => e.pnl < 0).slice(-5).reverse();

  // ── Composite score ───────────────────────────────────────────────────────
  const profitFactor = stats.staked > 0 ? (stats.won / stats.staked).toFixed(2) : "—";
  const pfNum        = parseFloat(profitFactor) || 0;
  const compositeScore = stats.total > 0
    ? Math.min(100, Math.round(stats.accuracy * 0.6 + pfNum * 20))
    : 0;
  const grade = compositeScore>=90?"A+":compositeScore>=75?"A":compositeScore>=65?"B+":compositeScore>=55?"B":compositeScore>=45?"C":"D";
  const isTopGrade = grade === "A+" || grade === "A";

  // ── P&L curve ─────────────────────────────────────────────────────────────
  const pnlCurve = [0];
  resolvedEntries
    .slice()
    .sort((a,b) => (a.v.placedAt||0)-(b.v.placedAt||0))
    .forEach(e => { pnlCurve.push(parseFloat((pnlCurve[pnlCurve.length-1] + e.pnl).toFixed(2))); });
  const finalPnl = pnlCurve[pnlCurve.length-1] || 0;

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:"#0A1628"}}>
      <OverlayHeader title="📈 Performance Analytics" onBack={onClose}/>
      <div style={{flex:1,overflowY:"auto",padding:"16px 16px 80px"}}>

        {/* ── Overview stats ── */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
          {[
            {l:"Composite Score", v:compositeScore+" / 100", c: compositeScore>=70?"#3B82F6":compositeScore>=50?"#F4C430":"#f93d3d"},
            {l:"Profit Factor",   v:profitFactor+"x",         c:"#c8dae8"},
            {l:"Win Rate",        v:stats.accuracy+"%",       c: stats.accuracy>=60?"#3B82F6":"#F4C430"},
            {l:"Grade",           v:grade,                    c: isTopGrade?"#3B82F6":"#F4C430", glow: isTopGrade},
          ].map(({l,v,c,glow})=>(
            <div key={l} style={{
              background: glow ? "linear-gradient(135deg,rgba(59,130,246,0.12),rgba(59,130,246,0.08))" : "#0F2040",
              borderRadius:14, padding:"16px 12px", textAlign:"center",
              border: glow ? "1px solid rgba(59,130,246,0.4)" : "1px solid #1A2D4A",
              boxShadow: glow ? "0 0 24px rgba(59,130,246,0.15)" : "none",
              position:"relative", overflow:"hidden",
            }}>
              {glow && <div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 50% 0%,rgba(59,130,246,0.1),transparent 70%)",pointerEvents:"none"}}/>}
              <div style={{color:c,fontSize:glow?28:22,fontWeight:900,fontFamily:"'Inter',sans-serif",lineHeight:1,marginBottom:4,
                textShadow: glow ? "0 0 20px rgba(59,130,246,0.8)" : "none",
              }}>{v}</div>
              <div style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif",letterSpacing:1}}>{l.toUpperCase()}</div>
              {glow && <div style={{color:"rgba(59,130,246,0.6)",fontSize:10,fontFamily:"'Inter',sans-serif",marginTop:4}}>🔥 Elite Trader</div>}
            </div>
          ))}
        </div>

        {/* ── P&L Curve ── */}
        <SectionLabel>P&L CURVE</SectionLabel>
        {pnlCurve.length > 1 ? (
          <div style={{background:"#0F2040",borderRadius:14,padding:"14px",marginBottom:20}}>
            <FullChart data={pnlCurve} color={finalPnl>=0?"#3B82F6":"#f93d3d"} isLive={false}/>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
              <span style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>Start</span>
              <span style={{color:finalPnl>=0?"#3B82F6":"#f93d3d",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>
                {finalPnl>=0?"+":""}{finalPnl.toFixed(2)} total P&L
              </span>
            </div>
          </div>
        ) : (
          <div style={{background:"#0F2040",borderRadius:14,padding:"20px",marginBottom:20,textAlign:"center",color:"rgba(255,255,255,0.2)",fontSize:13,fontFamily:"'Inter',sans-serif"}}>Place bets to see your P&L curve</div>
        )}

        {/* ── Calibration ── */}
        <SectionLabel>CALIBRATION CHART</SectionLabel>
        <div style={{background:"#0F2040",borderRadius:14,padding:"16px",marginBottom:20}}>
          <div style={{color:"rgba(255,255,255,0.35)",fontSize:11,fontFamily:"'Inter',sans-serif",marginBottom:14}}>Your actual win rate vs expected by odds band</div>
          {calibration.map(({band,expected,actual,count})=>{
            const hasData = actual !== null;
            const diff    = hasData ? actual - expected : 0;
            const barColor = !hasData ? "#1A2D4A" : diff >= 10 ? "#3B82F6" : diff >= 0 ? "#3B82F6" : diff >= -10 ? "#F4C430" : "#f93d3d";
            return (
              <div key={band} style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div>
                    <span style={{color:"#c8dae8",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{band}</span>
                    <span style={{color:"rgba(255,255,255,0.25)",fontSize:10,fontFamily:"'Inter',sans-serif",marginLeft:6}}>({count} bets)</span>
                  </div>
                  <div style={{textAlign:"right"}}>
                    {hasData ? (<>
                      <span style={{color:barColor,fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{actual}%</span>
                      <span style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontFamily:"'Inter',sans-serif"}}> vs {expected}% exp</span>
                    </>) : (
                      <span style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>no data</span>
                    )}
                  </div>
                </div>
                <div style={{height:6,background:"#1A2D4A",borderRadius:99,position:"relative"}}>
                  {/* Expected line */}
                  <div style={{position:"absolute",top:0,left:0,height:"100%",width:expected+"%",background:"rgba(255,255,255,0.08)",borderRadius:99}}/>
                  {/* Actual bar */}
                  {hasData && <div style={{position:"absolute",top:0,left:0,height:"100%",width:actual+"%",background:barColor,borderRadius:99,opacity:0.9,transition:"width 0.8s"}}/>}
                  {/* Expected marker */}
                  <div style={{position:"absolute",top:-2,left:expected+"%",width:2,height:10,background:"rgba(255,255,255,0.4)",borderRadius:1,transform:"translateX(-1px)"}}/>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Category breakdown ── */}
        <SectionLabel>ACCURACY BY CATEGORY</SectionLabel>
        {catBreakdown.length === 0
          ? <div style={{color:"rgba(255,255,255,0.2)",fontSize:13,fontFamily:"'Inter',sans-serif",padding:"20px 0",textAlign:"center",marginBottom:20}}>No resolved bets yet</div>
          : catBreakdown.map(({cat,pct,color,acc})=>(
            <div key={cat} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{color:"#c8dae8",fontSize:12,fontFamily:"'Inter',sans-serif"}}>{cat}</span>
                <span style={{color:acc>=60?"#3B82F6":acc>=50?"#F4C430":"#f93d3d",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{acc}% · {pct}% of vol</span>
              </div>
              <div style={{height:6,background:"#1A2D4A",borderRadius:99,overflow:"hidden"}}>
                <div style={{height:"100%",width:acc+"%",background:color,borderRadius:99}}/>
              </div>
            </div>
          ))
        }

        {/* ── Best Bets ── */}
        <SectionLabel>BEST BETS</SectionLabel>
        {bestBets.length === 0
          ? <div style={{color:"rgba(255,255,255,0.2)",fontSize:12,fontFamily:"'Inter',sans-serif",padding:"12px 0",marginBottom:16}}>No winning bets yet</div>
          : bestBets.map((e,i)=>(
            <div key={i} style={{background:"#0F2040",borderRadius:12,padding:"12px 14px",marginBottom:8,display:"flex",gap:10,alignItems:"center",border:"1px solid rgba(59,130,246,0.1)"}}>
              <div style={{width:24,height:24,borderRadius:8,background:"rgba(20,158,99,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#3B82F6",flexShrink:0}}>#{i+1}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:"#c8dae8",fontSize:12,fontWeight:600,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.title || e.market?.title || e.id}</div>
                <div style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontFamily:"'Inter',sans-serif",marginTop:2}}>{e.v.pos} · {e.entryPct}% odds · ${(e.v.amount||1).toFixed(2)} staked</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{color:"#3B82F6",fontSize:14,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>+${e.pnl.toFixed(2)}</div>
                <div style={{color:"rgba(255,255,255,0.25)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>{e.shares.toFixed(1)} shares</div>
              </div>
            </div>
          ))
        }

        {/* ── Worst Bets ── */}
        <SectionLabel>WORST BETS</SectionLabel>
        {worstBets.length === 0
          ? <div style={{color:"rgba(255,255,255,0.2)",fontSize:12,fontFamily:"'Inter',sans-serif",padding:"12px 0",marginBottom:16}}>No losing bets yet</div>
          : worstBets.map((e,i)=>(
            <div key={i} style={{background:"#0F2040",borderRadius:12,padding:"12px 14px",marginBottom:8,display:"flex",gap:10,alignItems:"center",border:"1px solid rgba(249,61,61,0.1)"}}>
              <div style={{width:24,height:24,borderRadius:8,background:"rgba(249,61,61,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#f93d3d",flexShrink:0}}>#{i+1}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:"#c8dae8",fontSize:12,fontWeight:600,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.title || e.market?.title || e.id}</div>
                <div style={{color:"rgba(255,255,255,0.3)",fontSize:10,fontFamily:"'Inter',sans-serif",marginTop:2}}>{e.v.pos} · {e.entryPct}% odds · ${(e.v.amount||1).toFixed(2)} staked</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{color:"#f93d3d",fontSize:14,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{e.pnl.toFixed(2)}</div>
                <div style={{color:"rgba(255,255,255,0.25)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>${(e.v.amount||1).toFixed(2)} lost</div>
              </div>
            </div>
          ))
        }

      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// PROP FIRM — MULTI-ACCOUNT MANAGER
// ─────────────────────────────────────────────────────────────────────────────
function PropAccountsManager({ onClose, propAccounts, onOpenAccount, onAddAccount, onOpenCopyTrader, onCloseAccount, activeAccountId, onSetActiveAccount }) {
  const ALL_PREDS = usePredictions();
  const livePnl = (acct) => {
    const resolved = acct.pnl || 0;
    const unrealised = (acct.bets||[]).filter(b=>!b.resolved).reduce((s,bet)=>{
      const market = ALL_PREDS.find(p=>String(p.id)===String(bet.predId)||String(p.polyId)===String(bet.predId));
      const currPct = (bet.lastKnownPct ?? (market?.yesPct) ?? bet.entryPct ?? 50);
      const currPrice = bet.pos==="YES" ? currPct/100 : (100-currPct)/100;
      const betShares = bet.shares>0 ? bet.shares : (bet.stake/Math.max(0.01,bet.sharePrice||0.5));
      return s + (betShares*currPrice - bet.stake);
    },0);
    return parseFloat((resolved+unrealised).toFixed(2));
  };
  const MAX_ACCOUNTS = 5;
  const [acctTab, setAcctTab] = useState("active");
  const funded   = (propAccounts||[]).filter(a=>a.funded);
  const breached = (propAccounts||[]).filter(a=>a.status==="breached");
  const active   = (propAccounts||[]).filter(a=>a.status!=="breached");
  const totalPnl = (propAccounts||[]).reduce((s,a)=>s+(a.pnl||0),0);

  const statusColor = a => a.funded?"#3B82F6":a.status==="breached"?"#f93d3d":"#F4C430";
  const statusLabel = a => a.funded?"FUNDED":a.status==="breached"?"BREACHED":"EVALUATING";
  const tierOf = a => PROP_TIERS.find(t=>t.id===a.tierId);
  const displayAccounts = acctTab==="active" ? active : breached;

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:"#0A1628"}}>
      <OverlayHeader title="Accounts" onBack={onClose} icon={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="#FFFFFF" strokeWidth="1.7" strokeLinejoin="round"/>
        </svg>
      }/>

      {/* Summary bar */}
      <div style={{background:"linear-gradient(135deg,#0A1628,#090F14)",borderBottom:"1px solid #0F2040",padding:"14px 16px",flexShrink:0}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
          {[
            [(propAccounts||[]).length,"/"+(MAX_ACCOUNTS),"ACCOUNTS","#fff"],
            [funded.length,"","FUNDED","#3B82F6"],
            [breached.length,"","BREACHED","#f93d3d"],
            [(totalPnl>=0?"+":"")+"$"+(Math.abs(totalPnl).toFixed(0)),"","TOTAL P&L",totalPnl>=0?"#3B82F6":"#f93d3d"],
          ].map(([v,sub,l,c],i)=>(
            <div key={i} style={{textAlign:"center",background:"rgba(10,22,40,0.45)",borderRadius:10,padding:"10px 6px"}}>
              <div style={{display:"flex",alignItems:"baseline",justifyContent:"center",gap:1}}>
                <span style={{color:c,fontSize:18,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{v}</span>
                {sub&&<span style={{color:"rgba(255,255,255,0.2)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>{sub}</span>}
              </div>
              <div style={{color:"rgba(255,255,255,0.42)",fontSize:8,fontFamily:"'Inter',sans-serif",marginTop:2,letterSpacing:0.5}}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Trading account selector */}
      {(propAccounts||[]).filter(a=>a.status!=="breached").length > 1 && onSetActiveAccount && (
        <div style={{padding:"10px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(59,130,246,0.04)",flexShrink:0}}>
          <div style={{color:"rgba(255,255,255,0.4)",fontSize:9,fontFamily:"'Inter',sans-serif",letterSpacing:1.5,marginBottom:6}}>TRADING ON</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {(propAccounts||[]).filter(a=>a.status!=="breached").map(acct=>{
              const t = PROP_TIERS.find(t=>t.id===acct.tierId);
              const isActive = activeAccountId ? acct.id===activeAccountId : acct.isLeader || acct.status==="funded" || acct.status==="active";
              return (
                <button key={acct.id} onClick={()=>onSetActiveAccount(acct.id)}
                  style={{background:isActive?"rgba(59,130,246,0.15)":"rgba(255,255,255,0.05)",border:"1px solid "+(isActive?"rgba(59,130,246,0.5)":"rgba(255,255,255,0.1)"),borderRadius:10,padding:"5px 10px",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:10,fontWeight:isActive?700:500,color:isActive?"#3B82F6":"rgba(255,255,255,0.4)"}}>
                  {t?.label||"Account"} {acct.isLeader?"👑":acct.funded?"⭐":""}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active / Breached tabs */}
      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.06)",flexShrink:0}}>
        {[["active","Active ("+active.length+")"],["breached","Breached ("+breached.length+")"]].map(([id,label])=>(
          <button key={id} onClick={()=>setAcctTab(id)}
            style={{flex:1,background:"none",border:"none",padding:"10px 0",cursor:"pointer",
              fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:acctTab===id?700:500,
              color:acctTab===id?(id==="breached"?"#f93d3d":"#3B82F6"):"rgba(255,255,255,0.35)",
              display:"flex",flexDirection:"column",alignItems:"center",gap:4,transition:"color 0.15s"}}>
            <span>{label}</span>
            <div style={{width:acctTab===id?20:0,height:2,borderRadius:99,
              background:id==="breached"?"#f93d3d":"#3B82F6",
              transition:"width 0.2s cubic-bezier(0.4,0,0.2,1)"}}/>
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"16px 16px 100px"}}>

        {/* Copy trader CTA */}
        {(propAccounts||[]).length > 1 && (
          <div onClick={onOpenCopyTrader} style={{background:"linear-gradient(135deg,#0F2040,#0F2040)",borderRadius:16,border:"1px solid rgba(124,77,204,0.2)",padding:"14px 16px",marginBottom:16,cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:44,height:44,borderRadius:12,background:"rgba(124,77,204,0.15)",border:"1px solid rgba(124,77,204,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🔗</div>
            <div style={{flex:1}}>
              <div style={{color:"#FFFFFF",fontSize:14,fontWeight:800,fontFamily:"'Inter',sans-serif",marginBottom:2}}>Copy Trader — Stack Profits</div>
              <div style={{color:"#7c4dcc",fontSize:11,fontFamily:"'Inter',sans-serif",fontWeight:700}}>
                {(propAccounts||[]).filter(a=>a.isLeader).length>0?"LEADER SET · COPYING "+( (propAccounts||[]).length-1)+" ACCOUNTS":"SET A LEAD ACCOUNT · COPY ACROSS ALL"}
              </div>
            </div>
            <span style={{color:"#7c4dcc",fontSize:20}}>›</span>
          </div>
        )}

        {/* Accounts list */}
        {displayAccounts.length === 0 ? (
          <div style={{textAlign:"center",padding:"40px 0"}}>
            <div style={{fontSize:48,marginBottom:12}}>{acctTab==="breached"?"💀":"📂"}</div>
            <div style={{color:"rgba(255,255,255,0.22)",fontSize:14,fontFamily:"'Inter',sans-serif",marginBottom:8}}>
              {acctTab==="breached" ? "No breached accounts" : "No active accounts"}
            </div>
            <div style={{color:"rgba(255,255,255,0.42)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>
              {acctTab==="breached" ? "Keep your drawdown in check 💪" : "Add up to 5 accounts to stack profits"}
            </div>
          </div>
        ) : (
          displayAccounts.map((acct,i)=>{
            const t = tierOf(acct);
            if (!t) return null;
            const acctLivePnl = livePnl(acct);
            const lossUsed = Math.max(0,-acctLivePnl);
            const lossBar  = Math.min(100,(lossUsed/t.maxLoss)*100);
            const pnlBar   = t.profitTarget ? Math.min(100,Math.max(0,(acctLivePnl/t.profitTarget)*100)) : 0;
            return (
              <div key={acct.id} style={{background:"#0F2040",borderRadius:18,border:"1px solid "+(statusColor(acct))+"22",padding:"14px 16px",marginBottom:12,position:"relative"}}>
                {acct.isLeader && (
                  <div style={{position:"absolute",top:-8,left:14,background:"#7c4dcc",borderRadius:99,padding:"2px 10px"}}>
                    <span style={{color:"#FFFFFF",fontSize:9,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>👑 LEAD ACCOUNT</span>
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                      <span style={{color:"#FFFFFF",fontSize:14,fontWeight:800,fontFamily:"'Inter',sans-serif"}}>{t.tier} · {t.label}</span>
                      <div style={{background:(statusColor(acct))+"15",border:"1px solid "+(statusColor(acct))+"33",borderRadius:99,padding:"2px 8px"}}>
                        <span style={{color:statusColor(acct),fontSize:8,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{statusLabel(acct)}</span>
                      </div>
                    </div>
                    <div style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>ACC #{acct.id?.slice(-4)||i+1} · {t.consistency}% CONSISTENCY · ${t.maxBet} MAX BET</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{color:livePnl(acct)>=0?"#3B82F6":"#f93d3d",fontSize:16,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>
                      {livePnl(acct)>=0?"+":""}${Math.abs(livePnl(acct)).toFixed(2)}
                    </div>
                    <div style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>NET P&L</div>
                  </div>
                </div>

                {/* Progress bars */}
                {t.profitTarget && !acct.funded && (
                  <div style={{marginBottom:6}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{color:"#00E5FF",fontSize:9,fontFamily:"'Inter',sans-serif"}}>PROFIT PROGRESS</span>
                      <span style={{color:"#00E5FF",fontSize:9,fontFamily:"'Inter',sans-serif"}}>${Math.max(0,acct.pnl||0).toFixed(0)} / ${t.profitTarget.toLocaleString()}</span>
                    </div>
                    <div style={{height:4,background:"#1A2D4A",borderRadius:99,overflow:"hidden"}}>
                      <div style={{height:"100%",width:(pnlBar)+"%",background:"#00E5FF",borderRadius:99}}/>
                    </div>
                  </div>
                )}
                <div style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{color:lossBar>75?"#f93d3d":lossBar>50?"#F4C430":"rgba(255,255,255,0.32)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>LOSS USED</span>
                    <span style={{color:lossBar>75?"#f93d3d":lossBar>50?"#F4C430":"rgba(255,255,255,0.32)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>${lossUsed.toFixed(0)} / ${t.maxLoss.toLocaleString()}</span>
                  </div>
                  <div style={{height:4,background:"#1A2D4A",borderRadius:99,overflow:"hidden"}}>
                    <div style={{height:"100%",width:(lossBar)+"%",background:lossBar>75?"#f93d3d":lossBar>50?"#F4C430":"#3B82F6",borderRadius:99}}/>
                  </div>
                </div>

                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>onOpenAccount(acct)} style={{flex:1,height:36,borderRadius:10,background:"rgba(20,158,99,0.08)",border:"1px solid rgba(59,130,246,0.133)",color:"#3B82F6",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                    View Dashboard
                  </button>
                  <button onClick={()=>onCloseAccount(acct.id)} style={{height:36,padding:"0 12px",borderRadius:10,background:"none",border:"1px solid rgba(249,61,61,0.133)",color:"#f93d3d",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",opacity:0.6}}>
                    Close
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* Add account button */}
        {(propAccounts||[]).length < MAX_ACCOUNTS && (
          <button onClick={onAddAccount} style={{width:"100%",height:56,borderRadius:16,background:"rgba(20,158,99,0.06)",border:"2px dashed rgba(59,130,246,0.2)",color:"#3B82F6",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <span style={{fontSize:20}}>+</span> Add Account ({(propAccounts||[]).length}/{MAX_ACCOUNTS})
          </button>
        )}
        {(propAccounts||[]).length >= MAX_ACCOUNTS && (
          <div style={{textAlign:"center",padding:"12px 0"}}>
            <span style={{color:"rgba(255,255,255,0.2)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>MAX 5 ACCOUNTS REACHED · CLOSE AN ACCOUNT TO ADD MORE</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROP FIRM — COPY TRADER
// ─────────────────────────────────────────────────────────────────────────────
function PropCopyTrader({ onClose, propAccounts, onSetLeader, onToggleCopy }) {
  const [activeTab, setActiveTab] = useState("setup");
  const leader    = (propAccounts||[]).find(a=>a.isLeader);
  const followers = (propAccounts||[]).filter(a=>!a.isLeader&&a.copyEnabled);
  const tierOf    = a => PROP_TIERS.find(t=>t.id===a.tierId);

  const COPY_LOG = [
    {time:"10:42","market":"Will BTC hit $150K?","pos":"YES","accounts":3,"result":"✅ +$420"},
    {time:"10:18","market":"S&P 500 hits 7,000?", "pos":"YES","accounts":3,"result":"✅ +$210"},
    {time:"09:54","market":"GPT-5 before July?",  "pos":"YES","accounts":2,"result":"❌ -$280"},
    {time:"09:30","market":"Fed cuts in Q1?",      "pos":"NO", "accounts":3,"result":"✅ +$390"},
  ];

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:"#0A1628"}}>
      <OverlayHeader title="Copy Trader" onBack={onClose}/>

      {/* Status banner */}
      <div style={{background:leader?"linear-gradient(135deg,#0F2040,#090F14)":"linear-gradient(135deg,#1a1a00,#090F14)",borderBottom:"1px solid #0F2040",padding:"14px 16px",flexShrink:0}}>
        {leader ? (<>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <div style={{background:"rgba(124,77,204,0.15)",border:"1px solid rgba(124,77,204,0.2)",borderRadius:20,padding:"3px 10px"}}>
              <span style={{color:"#7c4dcc",fontSize:9,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>👑 COPY TRADER ACTIVE</span>
            </div>
            <div style={{background:"rgba(20,158,99,0.12)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:20,padding:"3px 10px"}}>
              <span style={{color:"#3B82F6",fontSize:9,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{followers.length} FOLLOWING</span>
            </div>
          </div>
          <div style={{color:"#FFFFFF",fontSize:14,fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:2}}>
            Lead: <span style={{color:"#7c4dcc"}}>{tierOf(leader)?.tier} · {tierOf(leader)?.label}</span>
          </div>
          <div style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>
            All positions from your lead account are automatically replicated across follower accounts (within their max bet limits).
          </div>
        </>) : (
          <div style={{textAlign:"center",padding:"8px 0"}}>
            <div style={{color:"#F4C430",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:3}}>⚠️ No Lead Account Set</div>
            <div style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>Select a lead account below to start copying trades</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",background:"#0A1628",borderBottom:"1px solid #0F2040",flexShrink:0}}>
        {[["setup","Setup"],["log","Copy Log"],["how","How It Works"]].map(([id,label])=>(
          <button key={id} onClick={()=>setActiveTab(id)} style={{flex:1,background:"none",border:"none",borderBottom:"2px solid "+(activeTab===id?"#7c4dcc":"transparent"),color:activeTab===id?"#7c4dcc":"rgba(255,255,255,0.22)",fontSize:11,fontWeight:700,padding:"11px 0",cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:1}}>
            {label.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"16px 16px 80px"}}>

        {activeTab==="setup" && (<>
          <SectionLabel>👑 SELECT LEAD ACCOUNT</SectionLabel>
          <div style={{background:"rgba(124,77,204,0.05)",border:"1px solid rgba(124,77,204,0.133)",borderRadius:12,padding:"10px 12px",marginBottom:12}}>
            <span style={{color:"#7c4dcc",fontSize:11,fontFamily:"'Inter',sans-serif"}}>
              The lead account's bets are copied to all follower accounts. Choose your best-performing account as the lead.
            </span>
          </div>

          {(propAccounts||[]).map((acct,i)=>{
            const t = tierOf(acct); if (!t) return null;
            const isLead = acct.isLeader;
            return (
              <div key={acct.id||i} style={{background:isLead?"rgba(124,77,204,0.08)":"#0F2040",borderRadius:16,border:"2px solid "+(isLead?"#7c4dcc":"#1A2D4A"),padding:"14px 16px",marginBottom:10,position:"relative"}}>
                {isLead && <div style={{position:"absolute",top:-8,right:14,background:"#7c4dcc",borderRadius:99,padding:"2px 10px"}}><span style={{color:"#FFFFFF",fontSize:9,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>👑 LEAD</span></div>}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div>
                    <div style={{color:"#FFFFFF",fontSize:14,fontWeight:800,fontFamily:"'Inter',sans-serif",marginBottom:2}}>{t.tier} · {t.label}</div>
                    <div style={{color:"rgba(255,255,255,0.25)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>{acct.funded?"FUNDED":"EVALUATING"} · ${t.maxBet} MAX BET</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{color:acct.pnl>=0?"#3B82F6":"#f93d3d",fontSize:15,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{acct.pnl>=0?"+":""}${Math.abs(acct.pnl||0).toFixed(0)}</div>
                    <div style={{color:"rgba(255,255,255,0.42)",fontSize:8,fontFamily:"'Inter',sans-serif"}}>P&L</div>
                  </div>
                </div>
                <button
                  onClick={()=>onSetLeader(acct.id)}
                  style={{width:"100%",height:36,borderRadius:10,background:isLead?"#7c4dcc":isLead?"none":"rgba(124,77,204,0.08)",border:"1px solid "+(isLead?"transparent":"rgba(124,77,204,0.2)"),color:isLead?"#000":"#7c4dcc",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}
                >
                  {isLead?"👑 Current Lead":"Set as Lead Account"}
                </button>
              </div>
            );
          })}

          {leader && (<>
            <SectionLabel>📡 FOLLOWER ACCOUNTS</SectionLabel>
            <div style={{background:"rgba(20,158,99,0.05)",border:"1px solid rgba(59,130,246,0.133)",borderRadius:12,padding:"10px 12px",marginBottom:12}}>
              <span style={{color:"#3B82F6",fontSize:11,fontFamily:"'Inter',sans-serif"}}>
                Toggle which accounts follow the lead. Bets are capped at each account's max bet size.
              </span>
            </div>
            {(propAccounts||[]).filter(a=>!a.isLeader).map((acct,i)=>{
              const t = tierOf(acct); if (!t) return null;
              return (
                <div key={acct.id||i} style={{background:"#0F2040",borderRadius:14,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:1}}>{t.tier} · {t.label}</div>
                    <div style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>${t.maxBet} max bet · {acct.funded?"Funded":"Evaluating"}</div>
                  </div>
                  {/* Toggle switch */}
                  <div onClick={()=>onToggleCopy(acct.id)} style={{width:44,height:24,borderRadius:99,background:acct.copyEnabled?"#3B82F6":"#1A2D4A",border:"1px solid "+(acct.copyEnabled?"#3B82F6":"#1A2D4A"),cursor:"pointer",position:"relative",transition:"all 0.2s",flexShrink:0}}>
                    <div style={{position:"absolute",top:3,left:acct.copyEnabled?22:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(10,22,40,0.45)"}}/>
                  </div>
                </div>
              );
            })}
          </>)}
        </>)}

        {activeTab==="log" && (<>
          <SectionLabel>RECENT COPY TRADES</SectionLabel>
          {leader ? (
            COPY_LOG.map((log,i)=>(
              <div key={i} style={{background:"#0F2040",borderRadius:12,padding:"12px 14px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div style={{flex:1,fontSize:12,fontFamily:"'Inter',sans-serif",color:"rgba(255,255,255,0.72)",fontWeight:600,lineHeight:1.3,marginRight:8}}>{log.market}</div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{color:log.result.includes("+")?"#3B82F6":"#f93d3d",fontSize:13,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>{log.result}</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div style={{background:"#1A2D4A",borderRadius:99,padding:"2px 8px"}}>
                    <span style={{color:"rgba(255,255,255,0.42)",fontSize:9,fontFamily:"'Inter',sans-serif"}}>{log.pos}</span>
                  </div>
                  <span style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontFamily:"'Inter',sans-serif"}}>📡 Copied to {log.accounts} accounts</span>
                  <span style={{color:"#1A2D4A",fontSize:10,fontFamily:"'Inter',sans-serif",marginLeft:"auto"}}>{log.time}</span>
                </div>
              </div>
            ))
          ) : (
            <div style={{textAlign:"center",padding:"32px 0",color:"rgba(255,255,255,0.42)",fontSize:13,fontFamily:"'Inter',sans-serif"}}>
              Set a lead account to see copy trade logs
            </div>
          )}
        </>)}

        {activeTab==="how" && (
          [
            ["👑","Choose a Lead Account","Select your best-performing or most confident account as the leader. All bets placed on this account will be automatically copied."],
            ["📡","Automatic Trade Replication","When you place a bet on your lead account, the same market position is instantly replicated across all enabled follower accounts."],
            ["⚖️","Smart Sizing","Each follower account copies the bet proportionally, capped at that account's own max bet limit. A $200 bet on a $10K account copies as $100 on a $5K account."],
            ["💰","Stack Your Profits","Win once, get paid across all your accounts. A single correct prediction earns 90% of profits on every funded account that copied the trade."],
            ["🔒","Independent Risk","Each account has its own max loss limit. A blown account doesn't affect your other accounts. Risk is always isolated per account."],
            ["🔄","Change Lead Anytime","You can switch which account is the lead, or disable copying on individual follower accounts at any time."],
          ].map(([icon,title,desc],i)=>(
            <div key={i} style={{display:"flex",gap:14,marginBottom:18,alignItems:"flex-start"}}>
              <div style={{width:44,height:44,borderRadius:14,background:"rgba(124,77,204,0.1)",border:"1px solid rgba(124,77,204,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{icon}</div>
              <div>
                <div style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:3}}>{title}</div>
                <div style={{color:"rgba(255,255,255,0.32)",fontSize:12,fontFamily:"'Inter',sans-serif",lineHeight:1.5}}>{desc}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROP FIRM — BREACH MODAL
// ─────────────────────────────────────────────────────────────────────────────
function PropBreachModal({ onClose, propAccount, onReset }) {
  const tier = PROP_TIERS.find(t=>t.id===propAccount?.tierId) || PROP_TIERS[1];
  const resetFee = tier.price <= 29 ? 15 : tier.price <= 59 ? 25 : 49;
  const [step, setStep] = useState("breach"); // breach | reset | done

  if (step==="done") return (
    <div style={{position:"absolute",inset:0,zIndex:300,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#0F2040",borderRadius:24,padding:"32px 24px",textAlign:"center",width:"100%",maxWidth:320,border:"1px solid rgba(59,130,246,0.2)"}}>
        <div style={{fontSize:56,marginBottom:12}}>🔄</div>
        <div style={{color:"#3B82F6",fontSize:20,fontWeight:900,fontFamily:"'Inter',sans-serif",marginBottom:6}}>Account Reset!</div>
        <div style={{color:"rgba(255,255,255,0.32)",fontSize:13,fontFamily:"'Inter',sans-serif",marginBottom:20,lineHeight:1.5}}>Your {tier.tier} account has been reset. New challenge starts now.</div>
        <button onClick={()=>{onReset();onClose();}} style={{background:"#3B82F6",border:"none",borderRadius:99,color:"#fff",fontSize:13,fontWeight:900,padding:"12px 32px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
          Start New Challenge →
        </button>
      </div>
    </div>
  );

  return (
    <div style={{position:"absolute",inset:0,zIndex:300,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#0F2040",borderRadius:24,padding:"24px",width:"100%",maxWidth:340,border:"2px solid rgba(249,61,61,0.2)"}}>
        {step==="breach" ? (<>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:52,marginBottom:8}}>⚠️</div>
            <div style={{color:"#f93d3d",fontSize:20,fontWeight:900,fontFamily:"'Inter',sans-serif",marginBottom:4}}>Account Breached</div>
            <div style={{color:"rgba(255,255,255,0.32)",fontSize:13,fontFamily:"'Inter',sans-serif",lineHeight:1.5}}>Your EOD drawdown exceeded the {tier.drawdown}% limit. Account is frozen.</div>
          </div>
          <div style={{background:"rgba(249,61,61,0.05)",border:"1px solid rgba(249,61,61,0.133)",borderRadius:12,padding:"12px 14px",marginBottom:16}}>
            {[["Account",(tier.tier)+" · "+(tier.label)],["Breach type","EOD Drawdown Exceeded"],["Balance at breach","$4,178.00"],["Drawdown limit",(tier.drawdown)+"% ($"+((tier.balance*(1-tier.drawdown/100)).toLocaleString())+")"]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{color:"rgba(255,255,255,0.32)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>{l}</span>
                <span style={{color:"#f93d3d",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={onClose} style={{flex:1,height:44,borderRadius:99,background:"#1A2D4A",border:"1px solid #1A2D4A",color:"rgba(255,255,255,0.42)",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
              Close
            </button>
            <button onClick={()=>setStep("reset")} style={{flex:2,height:44,borderRadius:99,background:"rgba(249,61,61,0.1)",border:"1px solid rgba(249,61,61,0.267)",color:"#f93d3d",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
              💳 Reset Account (${resetFee}) →
            </button>
          </div>
        </>) : (<>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:48,marginBottom:8}}>🔄</div>
            <div style={{color:"#FFFFFF",fontSize:18,fontWeight:900,fontFamily:"'Inter',sans-serif",marginBottom:4}}>Reset Account</div>
            <div style={{color:"rgba(255,255,255,0.32)",fontSize:13,fontFamily:"'Inter',sans-serif",lineHeight:1.5}}>Pay the reset fee to start a fresh challenge on the same tier.</div>
          </div>
          <div style={{background:"#1A2D4A",borderRadius:12,padding:"12px 14px",marginBottom:16}}>
            {[[(tier.tier)+" Reset Fee","$"+(resetFee)+".00"],["New funded balance","$"+(tier.balance.toLocaleString())],["Accuracy target",(tier.target)+"%"]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{color:"rgba(255,255,255,0.32)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>{l}</span>
                <span style={{color:"#FFFFFF",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{v}</span>
              </div>
            ))}
          </div>
          <button onClick={()=>setStep("done")} style={{width:"100%",height:48,borderRadius:99,background:"#3B82F6",border:"none",color:"#fff",fontSize:14,fontWeight:900,cursor:"pointer",fontFamily:"'Inter',sans-serif",marginBottom:8}}>
            Pay ${resetFee} & Reset →
          </button>
          <button onClick={()=>setStep("breach")} style={{width:"100%",height:40,borderRadius:99,background:"none",border:"1px solid #1A2D4A",color:"rgba(255,255,255,0.32)",fontSize:12,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
            ← Back
          </button>
        </>)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROP FIRM — PREDICTLIVE GRADUATION
// ─────────────────────────────────────────────────────────────────────────────
function PropGraduationModal({ onClose, propAccount }) {
  const tier = PROP_TIERS.find(t=>t.id===propAccount?.tierId) || PROP_TIERS[1];
  const [step, setStep] = useState(0);

  const steps = [
    {
      icon:"🎓",
      title:"Congratulations!",
      subtitle:"You've qualified for PredictLive",
      body:"After 6 successful funded payouts, you've proven your edge. You're now eligible to graduate to PredictLive — real capital, real markets, 90% profit split.",
      cta:"See What's Next →",
      color:"#F4C430",
    },
    {
      icon:"💎",
      title:"PredictLive Account",
      subtitle:"Real capital. Real payouts.",
      body:"Your simulated profits translate to a starting PredictLive balance (up to $5,000). You'll trade with actual capital and keep 90% of all profits indefinitely.",
      cta:"View My Starting Balance →",
      color:"#3B82F6",
    },
    {
      icon:"📋",
      title:"KYC Required",
      subtitle:"Identity verification needed",
      body:"To receive real payouts from PredictLive, we need to verify your identity. This takes 2–3 minutes. You'll need: government ID + proof of address.",
      cta:"Start KYC Verification →",
      color:"#00E5FF",
    },
    {
      icon:"🌟",
      title:"Welcome to PredictLive!",
      subtitle:"You're in the top 1%",
      body:"Your account is active. You now have a real $3,000 starting balance (based on your sim profits). Trade any market and earn 90% split on every win.",
      cta:"Open PredictLive →",
      color:"#7c4dcc",
    },
  ];

  const s = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div style={{position:"absolute",inset:0,zIndex:300,background:"rgba(0,0,0,0.95)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#0F2040",borderRadius:24,padding:"32px 24px",width:"100%",maxWidth:340,border:"1px solid "+(s.color)+"33",textAlign:"center",position:"relative"}}>
        {/* Progress */}
        <div style={{display:"flex",gap:6,marginBottom:24,justifyContent:"center"}}>
          {steps.map((_,i)=><div key={i} style={{width:i===step?28:7,height:7,borderRadius:99,background:i<=step?s.color:"#1A2D4A",transition:"all 0.3s"}}/>)}
        </div>

        <div style={{fontSize:64,marginBottom:16,animation:"popIn 0.4s ease"}}>{s.icon}</div>
        <div style={{color:s.color,fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif",letterSpacing:1,marginBottom:6}}>{s.subtitle.toUpperCase()}</div>
        <h2 style={{color:"#FFFFFF",fontSize:22,fontWeight:900,fontFamily:"'Inter',sans-serif",marginBottom:12,lineHeight:1.2}}>{s.title}</h2>
        <p style={{color:"#6a8090",fontSize:13,fontFamily:"'Inter',sans-serif",lineHeight:1.6,marginBottom:24}}>{s.body}</p>

        {step===1 && (
          <div style={{background:"rgba(10,22,40,0.55)",borderRadius:14,padding:"14px",marginBottom:20,border:"1px solid "+(s.color)+"22"}}>
            {[["Sim profits earned","$1,840.00"],["Transfer cap","$5,000"],["Starting balance","$1,840.00"],["Profit split","90%"]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{color:"rgba(255,255,255,0.22)",fontSize:12,fontFamily:"'Inter',sans-serif"}}>{l}</span>
                <span style={{color:s.color,fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{v}</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={isLast?onClose:()=>setStep(s=>s+1)}
          style={{width:"100%",height:52,borderRadius:99,background:"linear-gradient(135deg,"+(s.color)+","+(s.color)+"bb)",border:"none",color:"#000",fontSize:14,fontWeight:900,cursor:"pointer",fontFamily:"'Inter',sans-serif",marginBottom:8,boxShadow:"0 4px 24px "+(s.color)+"44"}}
        >
          {isLast?"Enter PredictLive 🌟":s.cta}
        </button>
        <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,0.42)",fontSize:12,cursor:"pointer",fontFamily:"'Inter',sans-serif",width:"100%"}}>
          Maybe later
        </button>
      </div>
    </div>
  );
}

function OnboardingPage({ onDone }) {
  const [step, setStep] = useState(0);
  const [animDir, setAnimDir] = useState(1);
  const [visible, setVisible] = useState(true);
  const s = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;

  const goTo = (next) => {
    setVisible(false);
    setAnimDir(next > step ? 1 : -1);
    setTimeout(() => { setStep(next); setVisible(true); }, 180);
  };

  // Decorative ring SVG for each slide
  const Rings = ({ color }) => (
    <svg width="320" height="320" viewBox="0 0 320 320" style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",opacity:0.13,pointerEvents:"none"}}>
      <circle cx="160" cy="160" r="140" fill="none" stroke={color} strokeWidth="1"/>
      <circle cx="160" cy="160" r="105" fill="none" stroke={color} strokeWidth="1.5"/>
      <circle cx="160" cy="160" r="70"  fill="none" stroke={color} strokeWidth="2"/>
      <circle cx="160" cy="160" r="35"  fill="none" stroke={color} strokeWidth="2.5"/>
      <line x1="160" y1="20"  x2="160" y2="300" stroke={color} strokeWidth="0.5" strokeDasharray="4,8"/>
      <line x1="20"  y1="160" x2="300" y2="160" stroke={color} strokeWidth="0.5" strokeDasharray="4,8"/>
    </svg>
  );

  // Icon illustrations per slide
  const illustrations = {
    welcome: (
      <div style={{position:"relative",width:180,height:180,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{position:"absolute",inset:0,borderRadius:"50%",background:"radial-gradient(circle,"+s.glow+" 0%,transparent 70%)"}}/>
        <div style={{fontSize:80}}>⚡</div>
        <div style={{position:"absolute",bottom:10,right:10,width:36,height:36,borderRadius:10,background:s.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:"0 4px 16px "+s.glow}}>📈</div>
        <div style={{position:"absolute",top:10,left:10,width:32,height:32,borderRadius:10,background:s.accentDark,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🎯</div>
      </div>
    ),
    bet: (
      <div style={{position:"relative",width:200,height:180,display:"flex",alignItems:"center",justifyContent:"center",gap:10,flexWrap:"wrap"}}>
        {[["₿","CRYPTO","#D98E2F"],["⚽","SPORT","#3F7A5C"],["🏛","POLITICS","#f93d3d"],["💻","TECH","#4A9ECC"]].map(([ic,lb,cl])=>(
          <div key={lb} style={{width:82,height:72,borderRadius:14,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4}}>
            <span style={{fontSize:26}}>{ic}</span>
            <span style={{fontSize:8,fontFamily:"'Inter',sans-serif",color:cl,letterSpacing:1,fontWeight:700}}>{lb}</span>
          </div>
        ))}
      </div>
    ),
    rewards: (
      <div style={{position:"relative",width:180,height:180,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{position:"absolute",inset:0,borderRadius:"50%",background:"radial-gradient(circle,"+s.glow+" 0%,transparent 70%)"}}/>
        <div style={{width:130,height:130,borderRadius:32,background:"linear-gradient(135deg,"+s.accentDark+","+s.accent+"33)",border:"2px solid "+s.accent+"44",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6}}>
          <span style={{fontSize:44}}>💎</span>
          <span style={{color:s.accent,fontFamily:"'Inter',sans-serif",fontWeight:900,fontSize:18}}>+$10</span>
          <span style={{color:"rgba(255,255,255,0.4)",fontFamily:"'Inter',sans-serif",fontSize:9,letterSpacing:1}}>FREE CREDIT</span>
        </div>
      </div>
    ),
    odds: (
      <div style={{position:"relative",width:220,height:160,display:"flex",alignItems:"flex-end",justifyContent:"center",gap:6}}>
        {[42,58,51,72,65,80,74,88].map((h,i)=>(
          <div key={i} style={{flex:1,height:h*1.4,borderRadius:"4px 4px 0 0",background:i===7?"rgba(74,158,204,0.9)":"rgba(74,158,204,"+(0.15+i*0.08)+")",transition:"height 0.4s",position:"relative"}}>
            {i===7&&<div style={{position:"absolute",top:-22,left:"50%",transform:"translateX(-50%)",background:"#4A9ECC",borderRadius:6,padding:"2px 6px",fontSize:9,fontFamily:"'Inter',sans-serif",color:"#000",fontWeight:700,whiteSpace:"nowrap"}}>88%</div>}
          </div>
        ))}
      </div>
    ),
    leaderboard: (
      <div style={{width:220,display:"flex",flexDirection:"column",gap:6}}>
        {[["🥇","deus_vult","#C9A227","+$284"],["🥈","cryptoking","#8FA3B1","+$196"],["🥉","traderpro","#C97A28","+$142"]].map(([medal,name,col,earn],i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"10px 14px",border:"1px solid "+(i===0?s.accent+"44":"rgba(255,255,255,0.06)")}}>
            <span style={{fontSize:20}}>{medal}</span>
            <span style={{flex:1,color:i===0?s.accent:"rgba(255,255,255,0.7)",fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:13}}>{name}</span>
            <span style={{color:col,fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:12}}>{earn}</span>
          </div>
        ))}
      </div>
    ),
  };

  return (
    <div style={{height:"100%",background:s.bg,display:"flex",flexDirection:"column",position:"relative",overflow:"hidden",transition:"background 0.5s"}}>

      {/* Glow blob */}
      <div style={{position:"absolute",top:"30%",left:"50%",transform:"translate(-50%,-50%)",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,"+s.glow+" 0%,transparent 65%)",pointerEvents:"none",transition:"background 0.5s"}}/>

      {/* Rings decoration */}
      <div style={{position:"absolute",top:"35%",left:"50%",transform:"translate(-50%,-50%)"}}>
        <Rings color={s.accent}/>
      </div>

      {/* Top bar: skip + progress */}
      <div style={{position:"relative",zIndex:10,padding:"52px 24px 0",display:"flex",alignItems:"center",gap:10}}>
        <div style={{display:"flex",gap:5,flex:1}}>
          {ONBOARDING_STEPS.map((_,i)=>(
            <div key={i} onClick={()=>goTo(i)} style={{height:3,flex:i===step?2.5:1,background:i<=step?s.accent:"rgba(255,255,255,0.12)",borderRadius:99,cursor:"pointer",transition:"all 0.4s"}}/>
          ))}
        </div>
        <button onClick={onDone} style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:0.5,padding:"4px 0 4px 12px"}}>skip</button>
      </div>

      {/* Label chip */}
      <div style={{position:"relative",zIndex:10,padding:"28px 24px 0",display:"flex",justifyContent:"center"}}>
        <div style={{background:s.accent+"22",border:"1px solid "+s.accent+"44",borderRadius:99,padding:"5px 14px",display:"inline-flex",alignItems:"center",gap:6}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:s.accent,boxShadow:"0 0 6px "+s.accent}}/>
          <span style={{color:s.accent,fontSize:10,fontFamily:"'Inter',sans-serif",fontWeight:700,letterSpacing:1.5}}>{s.label}</span>
        </div>
      </div>

      {/* Illustration */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",zIndex:10,opacity:visible?1:0,transform:visible?"translateY(0)":"translateY("+(animDir*16)+"px)",transition:"opacity 0.25s,transform 0.25s"}}>
        {illustrations[s.id]}
      </div>

      {/* Text block */}
      <div style={{position:"relative",zIndex:10,padding:"0 28px 32px",opacity:visible?1:0,transform:visible?"translateY(0)":"translateY("+(animDir*12)+"px)",transition:"opacity 0.3s 0.05s,transform 0.3s 0.05s"}}>
        <h2 style={{color:"#FFFFFF",fontSize:28,fontWeight:900,fontFamily:"'Inter',sans-serif",lineHeight:1.15,marginBottom:12}}>{s.title}</h2>
        <p style={{color:"rgba(255,255,255,0.6)",fontSize:15,fontFamily:"'Inter',sans-serif",lineHeight:1.65,whiteSpace:"pre-line",marginBottom:32}}>{s.sub}</p>

        {/* CTA button */}
        <button
          onClick={isLast ? onDone : ()=>goTo(step+1)}
          style={{width:"100%",background:s.accent,border:"none",borderRadius:16,color:"#fff",fontSize:16,fontWeight:900,padding:"17px",cursor:"pointer",fontFamily:"'Inter',sans-serif",boxShadow:"0 8px 32px "+s.glow,transition:"all 0.3s",letterSpacing:0.3}}
        >
          {isLast ? "Start Predicting →" : "Continue →"}
        </button>

        {/* Step counter */}
        <div style={{textAlign:"center",marginTop:16,color:"rgba(255,255,255,0.2)",fontSize:11,fontFamily:"'Inter',sans-serif",letterSpacing:1}}>
          {step+1} / {ONBOARDING_STEPS.length}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
const NAV_ITEMS=[
  {id:"home",    icon:"🏠", label:"Home"},
  {id:"markets", icon:"📊", label:"Markets"},
  {id:"prop",    icon:"🏦", label:"Prop"},
  {id:"profile", icon:"👤", label:"Profile"},
];

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1: BET RESOLUTION ENGINE + PROP FIRM CHALLENGE ENGINE
// ─────────────────────────────────────────────────────────────────────────────

// Resolve market — Up/Down 5m: Up=YES, Down=NO
function resolveMarket(market) {
  // officialWinner set by /api/prices (most reliable)
  if (market.officialWinner) return market.officialWinner;

  // Resolved market: closed=true and outcomePrices is exactly [0,1] or [1,0]
  if (market.closed && market.outcomePrices) {
    try {
      const p = JSON.parse(market.outcomePrices).map(Number);
      if (p[0] === 1 && p[1] === 0) return 'YES';
      if (p[0] === 0 && p[1] === 1) return 'NO';
    } catch(e) {}
  }
  return null;
}

// Calculate payout for a winning bet
function calcPayout(stake, impliedOdds) {
  // Polymarket fee ~2%
  return parseFloat((stake * (1 / impliedOdds) * 0.98).toFixed(2));
}

// Check prop account status after a resolution event
function evalPropAccount(acct, tier) {
  if (!tier) return acct;
  const startBal = tier.balance;
  const currentBal = startBal + acct.pnl;
  const profit = acct.pnl;
  const drawdown = startBal - currentBal; // positive = losing money

  // Breach check
  if (drawdown >= tier.maxLoss) {
    return { ...acct, status: "breached", breachReason: "max_drawdown", breachAt: Date.now() };
  }

  // Rebill check — 28 days elapsed without passing
  if (acct.startedAt && !acct.funded && !tier.funded) {
    const elapsed = Date.now() - acct.startedAt;
    const windowMs = 28 * 24 * 60 * 60 * 1000;
    if (elapsed >= windowMs && profit < (tier.profitTarget || 0)) {
      return { ...acct, status: "rebill", rebillAt: Date.now() };
    }
  }

  // Pass check (PredictTest only)
  if (!acct.funded && tier.profitTarget !== null && profit >= tier.profitTarget) {
    return { ...acct, status: "passed", passedAt: Date.now() };
  }

  return { ...acct, status: acct.status || "active" };
}

// Prop account progress stats
function getPropProgress(acct, tier) {
  if (!tier) return null;
  const startBal = tier.balance;
  const currentBal = startBal + acct.pnl;
  const profit = acct.pnl;
  const drawdown = startBal - currentBal;
  const profitPct = tier.profitTarget ? (profit / tier.profitTarget) * 100 : null;
  const drawdownPct = (drawdown / tier.maxLoss) * 100;
  const daysElapsed = acct.startedAt ? Math.floor((Date.now() - acct.startedAt) / 86400000) : 0;
  const daysLeft = Math.max(0, 28 - daysElapsed);
  const isFunded = acct.funded || tier.tier === "PredictDirect";
  return {
    currentBal, profit, drawdown, profitPct, drawdownPct,
    daysLeft, daysElapsed, isFunded,
    profitTarget: tier.profitTarget,
    maxLoss: tier.maxLoss,
    split: tier.split,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BREACH SCREEN — shown when max drawdown is hit
// ─────────────────────────────────────────────────────────────────────────────
function PropBreachScreen({ acct, tier, onReset, onClose }) {
  const t = useTheme();
  const prog = getPropProgress(acct, tier);
  const resets = acct?.resets || 0;
  const resetFee = tier ? (resets < 2 ? Math.round(tier.price * 0.8) : tier.price) : tier?.price || 49;
  const resetDiscount = resets < 2;
  const [showPayment, setShowPayment] = useState(false);

  return showPayment ? (
    <div style={{position:"fixed",inset:0,zIndex:401,background:"#0A1628",display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
        <button onClick={()=>setShowPayment(false)} style={{width:36,height:36,borderRadius:12,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
          <span style={{fontSize:20,lineHeight:1,color:"#FFFFFF",fontWeight:300}}>‹</span>
        </button>
        <span style={{color:"#FFFFFF",fontWeight:700,fontSize:16,fontFamily:"'Inter',sans-serif"}}>Reset Challenge</span>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"20px 16px"}}>
        <PaymentModal
          amount={resetFee}
          description={"Challenge Reset"+(resetDiscount?" (20% discount)":"")+" — "+tier?.label}
          buttonLabel="Reset & Restart"
          onSuccess={()=>{ setShowPayment(false); onReset(); }}
          onCancel={()=>setShowPayment(false)}
        />
      </div>
    </div>
  ) : (
    <div style={{position:"fixed",inset:0,zIndex:400,background:"#0A1628",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{fontSize:64,marginBottom:16}}>💥</div>
      <h2 style={{color:"#f93d3d",fontSize:26,fontWeight:900,fontFamily:"'Inter',sans-serif",marginBottom:8,textAlign:"center"}}>Account Breached</h2>
      <p style={{color:"rgba(255,255,255,0.4)",fontSize:14,fontFamily:"'Inter',sans-serif",textAlign:"center",marginBottom:32,lineHeight:1.6}}>
        Your {tier?.label} hit the maximum drawdown of ${tier?.maxLoss.toLocaleString()}.<br/>
        Your challenge has been reset.
      </p>

      {/* Stats */}
      <div style={{width:"100%",maxWidth:340,background:"rgba(249,61,61,0.08)",border:"1px solid rgba(249,61,61,0.2)",borderRadius:18,padding:20,marginBottom:24}}>
        {[
          ["Starting Balance", "$"+tier?.balance.toLocaleString()],
          ["Final Balance",    "$"+(prog?.currentBal||0).toFixed(2)],
          ["Total P&L",        (prog?.profit||0) >= 0 ? "+$"+(prog?.profit||0).toFixed(2) : "-$"+Math.abs(prog?.profit||0).toFixed(2)],
          ["Max Drawdown",     "$"+tier?.maxLoss.toLocaleString()],
          ["Days Active",      (prog?.daysElapsed||0)+" days"],
          ["Resets Used",      (acct?.resets||0)+" of 2 discounted"],
        ].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
            <span style={{color:"rgba(255,255,255,0.4)",fontSize:13,fontFamily:"'Inter',sans-serif"}}>{k}</span>
            <span style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{v}</span>
          </div>
        ))}
      </div>

      <button onClick={()=>setShowPayment(true)} style={{width:"100%",maxWidth:340,height:52,borderRadius:14,background:"#3B82F6",border:"none",color:"#fff",fontSize:15,fontWeight:700,fontFamily:"'Inter',sans-serif",cursor:"pointer",marginBottom:12,position:"relative"}}>
        {resetDiscount && <span style={{position:"absolute",top:-10,right:12,background:"#F4C430",color:"#000",fontSize:10,fontWeight:900,borderRadius:99,padding:"2px 8px"}}>20% OFF</span>}
        Reset Challenge — ${resetFee}
        {resetDiscount && <span style={{fontSize:11,opacity:0.7,marginLeft:6,textDecoration:"line-through"}}>${tier?.price}</span>}
      </button>
      <button onClick={onClose} style={{width:"100%",maxWidth:340,height:44,borderRadius:14,background:"transparent",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.4)",fontSize:14,fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>
        Close
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PASS SCREEN — shown when profit target is hit
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT MODAL — simulated checkout, Stripe-ready
// To integrate Stripe: replace the "processing" step with Stripe.js Elements
// and call your backend /api/create-payment-intent endpoint
// ─────────────────────────────────────────────────────────────────────────────
function PaymentModal({ amount, description, buttonLabel="Pay Now", onSuccess, onCancel }) {
  const [step, setStep] = useState("form"); // "form" | "processing" | "success"
  const [card, setCard] = useState({ number:"", expiry:"", cvv:"", name:"" });
  const [errors, setErrors] = useState({});

  const formatCard = (val) => val.replace(/\D/g,"").slice(0,16).replace(/(.{4})/g,"$1 ").trim();
  const formatExpiry = (val) => {
    const d = val.replace(/\D/g,"").slice(0,4);
    return d.length > 2 ? d.slice(0,2)+"/"+d.slice(2) : d;
  };

  const validate = () => {
    const e = {};
    if (card.number.replace(/\s/g,"").length < 16) e.number = "Enter a valid 16-digit card number";
    if (card.expiry.length < 5) e.expiry = "Enter expiry MM/YY";
    if (card.cvv.length < 3) e.cvv = "Enter 3-digit CVV";
    if (!card.name.trim()) e.name = "Enter cardholder name";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePay = () => {
    if (!validate()) return;
    setStep("processing");
    // ── STRIPE INTEGRATION POINT ──────────────────────────────────────────
    // Replace the setTimeout below with:
    // const stripe = await loadStripe(process.env.VITE_STRIPE_KEY);
    // const { error, paymentMethod } = await stripe.createPaymentMethod({ type:"card", card: elements.getElement(CardElement) });
    // if (!error) { const res = await fetch("/api/charge", { method:"POST", body: JSON.stringify({ paymentMethodId: paymentMethod.id, amount: amount*100 }) }); }
    // ─────────────────────────────────────────────────────────────────────
    setTimeout(() => { setStep("success"); }, 1800);
  };

  const inputStyle = (field) => ({
    width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid "+(errors[field]?"#f93d3d":"rgba(255,255,255,0.12)"),
    borderRadius:12, padding:"12px 14px", color:"#FFFFFF", fontSize:14,
    fontFamily:"'Inter',sans-serif", outline:"none", boxSizing:"border-box",
  });

  if (step === "processing") return (
    <div style={{padding:"48px 24px",textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:16,animation:"pulse 1s infinite"}}>⏳</div>
      <div style={{color:"#FFFFFF",fontSize:16,fontWeight:700,fontFamily:"'Inter',sans-serif",marginBottom:8}}>Processing Payment</div>
      <div style={{color:"rgba(255,255,255,0.4)",fontSize:13,fontFamily:"'Inter',sans-serif"}}>Please wait — do not close this screen</div>
    </div>
  );

  if (step === "success") return (
    <div style={{padding:"40px 24px",textAlign:"center"}}>
      <div style={{fontSize:56,marginBottom:16}}>✅</div>
      <div style={{color:"#3B82F6",fontSize:20,fontWeight:900,fontFamily:"'Inter',sans-serif",marginBottom:8}}>Payment Successful</div>
      <div style={{color:"rgba(255,255,255,0.4)",fontSize:13,fontFamily:"'Inter',sans-serif",marginBottom:28}}>${amount.toFixed(2)} charged successfully</div>
      <button onClick={onSuccess} style={{width:"100%",height:50,borderRadius:14,background:"#3B82F6",border:"none",color:"#fff",fontSize:15,fontWeight:700,fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>
        Continue →
      </button>
    </div>
  );

  return (
    <div>
      {/* Order summary */}
      <div style={{background:"rgba(20,158,99,0.08)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:14,padding:"14px 16px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{color:"rgba(255,255,255,0.5)",fontSize:13,fontFamily:"'Inter',sans-serif"}}>{description}</span>
          <span style={{color:"#F4C430",fontSize:18,fontWeight:900,fontFamily:"'Inter',sans-serif"}}>${amount.toFixed(2)}</span>
        </div>
      </div>

      {/* Card form */}
      <div style={{marginBottom:14}}>
        <div style={{color:"rgba(255,255,255,0.4)",fontSize:10,letterSpacing:1,fontFamily:"'Inter',sans-serif",marginBottom:6}}>CARDHOLDER NAME</div>
        <input value={card.name} onChange={e=>setCard(c=>({...c,name:e.target.value}))} placeholder="John Smith" style={inputStyle("name")}/>
        {errors.name && <div style={{color:"#f93d3d",fontSize:11,marginTop:4,fontFamily:"'Inter',sans-serif"}}>{errors.name}</div>}
      </div>
      <div style={{marginBottom:14}}>
        <div style={{color:"rgba(255,255,255,0.4)",fontSize:10,letterSpacing:1,fontFamily:"'Inter',sans-serif",marginBottom:6}}>CARD NUMBER</div>
        <input value={card.number} onChange={e=>setCard(c=>({...c,number:formatCard(e.target.value)}))} placeholder="4242 4242 4242 4242" style={inputStyle("number")}/>
        {errors.number && <div style={{color:"#f93d3d",fontSize:11,marginTop:4,fontFamily:"'Inter',sans-serif"}}>{errors.number}</div>}
      </div>
      <div style={{display:"flex",gap:12,marginBottom:20}}>
        <div style={{flex:1}}>
          <div style={{color:"rgba(255,255,255,0.4)",fontSize:10,letterSpacing:1,fontFamily:"'Inter',sans-serif",marginBottom:6}}>EXPIRY</div>
          <input value={card.expiry} onChange={e=>setCard(c=>({...c,expiry:formatExpiry(e.target.value)}))} placeholder="MM/YY" style={inputStyle("expiry")}/>
          {errors.expiry && <div style={{color:"#f93d3d",fontSize:11,marginTop:4,fontFamily:"'Inter',sans-serif"}}>{errors.expiry}</div>}
        </div>
        <div style={{flex:1}}>
          <div style={{color:"rgba(255,255,255,0.4)",fontSize:10,letterSpacing:1,fontFamily:"'Inter',sans-serif",marginBottom:6}}>CVV</div>
          <input value={card.cvv} onChange={e=>setCard(c=>({...c,cvv:e.target.value.replace(/\D/g,"").slice(0,4)}))} placeholder="123" style={inputStyle("cvv")}/>
          {errors.cvv && <div style={{color:"#f93d3d",fontSize:11,marginTop:4,fontFamily:"'Inter',sans-serif"}}>{errors.cvv}</div>}
        </div>
      </div>

      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
        <span style={{fontSize:16}}>🔒</span>
        <span style={{color:"rgba(255,255,255,0.25)",fontSize:11,fontFamily:"'Inter',sans-serif"}}>256-bit SSL encryption · PCI DSS compliant · Powered by Stripe</span>
      </div>

      <button onClick={handlePay} style={{width:"100%",height:52,borderRadius:14,background:"linear-gradient(135deg,#2F805A,#2d5c41)",border:"none",color:"#fff",fontSize:15,fontWeight:700,fontFamily:"'Inter',sans-serif",cursor:"pointer",marginBottom:10}}>
        {buttonLabel} — ${amount.toFixed(2)}
      </button>
      <button onClick={onCancel} style={{width:"100%",height:42,borderRadius:14,background:"transparent",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.35)",fontSize:13,fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>
        Cancel
      </button>
    </div>
  );
}

function PropPassScreen({ acct, tier, onActivate, onClose }) {
  const prog = getPropProgress(acct, tier);
  const activationFee = acct.noActivationAddon ? 0 : (tier?.activationFee || 149);
  const [showPayment, setShowPayment] = useState(false);

  return showPayment ? (
    <div style={{position:"fixed",inset:0,zIndex:401,background:"#0A1628",display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
        <button onClick={()=>setShowPayment(false)} style={{width:36,height:36,borderRadius:12,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
          <span style={{fontSize:20,lineHeight:1,color:"#FFFFFF",fontWeight:300}}>‹</span>
        </button>
        <span style={{color:"#FFFFFF",fontWeight:700,fontSize:16,fontFamily:"'Inter',sans-serif"}}>Activate Funded Account</span>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"20px 16px"}}>
        <PaymentModal
          amount={activationFee}
          description={"Funded Account Activation — "+tier?.label}
          buttonLabel="Activate Account"
          onSuccess={onActivate}
          onCancel={()=>setShowPayment(false)}
        />
      </div>
    </div>
  ) : (
    <div style={{position:"fixed",inset:0,zIndex:400,background:"#0A1628",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{fontSize:64,marginBottom:16,animation:"pulse 1.5s infinite"}}>🏆</div>
      <h2 style={{color:"#F4C430",fontSize:26,fontWeight:900,fontFamily:"'Inter',sans-serif",marginBottom:8,textAlign:"center"}}>Challenge Passed!</h2>
      <p style={{color:"rgba(255,255,255,0.5)",fontSize:14,fontFamily:"'Inter',sans-serif",textAlign:"center",marginBottom:32,lineHeight:1.6}}>
        You hit the ${tier?.profitTarget?.toLocaleString()} profit target.<br/>
        {activationFee > 0 ? `Pay the $${activationFee} activation fee to receive your funded account.` : "Your funded account is ready — no activation fee required!"}
      </p>

      <div style={{width:"100%",maxWidth:340,background:"rgba(244,196,48,0.08)",border:"1px solid rgba(244,196,48,0.25)",borderRadius:18,padding:20,marginBottom:24}}>
        {[
          ["Account Size",   "$"+tier?.balance.toLocaleString()],
          ["Profit Made",    "+$"+(prog?.profit||0).toFixed(2)],
          ["Days Taken",     (prog?.daysElapsed||0)+" / 28 days"],
          ["Profit Split",   tier?.split+"%"],
          ["Activation Fee", activationFee > 0 ? "$"+activationFee : "FREE ✓"],
        ].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
            <span style={{color:"rgba(255,255,255,0.4)",fontSize:13,fontFamily:"'Inter',sans-serif"}}>{k}</span>
            <span style={{color:"#F4C430",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{v}</span>
          </div>
        ))}
      </div>

      <button onClick={activationFee > 0 ? ()=>setShowPayment(true) : onActivate} style={{width:"100%",maxWidth:340,height:52,borderRadius:14,background:"linear-gradient(135deg,#F4C430,#b8960c)",border:"none",color:"#000",fontSize:15,fontWeight:900,fontFamily:"'Inter',sans-serif",cursor:"pointer",marginBottom:12}}>
        {activationFee > 0 ? `Activate Funded Account — $${activationFee}` : "Claim Funded Account →"}
      </button>
      <button onClick={onClose} style={{width:"100%",maxWidth:340,height:44,borderRadius:14,background:"transparent",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.4)",fontSize:14,fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>
        Later
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REBILL SCREEN — 28 days elapsed, not passed
// ─────────────────────────────────────────────────────────────────────────────
function PropRebillScreen({ acct, tier, onRebill, onClose }) {
  const prog = getPropProgress(acct, tier);

  const resets = acct?.resets || 0;
  const rebillFee = resets < 2 ? Math.round((tier?.price||49) * 0.8) : (tier?.price||49);
  const rebillDiscount = resets < 2;

  const [showPayment, setShowPayment] = useState(false);

  return showPayment ? (
    <div style={{position:"fixed",inset:0,zIndex:401,background:"#0A1628",display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
        <button onClick={()=>setShowPayment(false)} style={{width:36,height:36,borderRadius:12,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
          <span style={{fontSize:20,lineHeight:1,color:"#FFFFFF",fontWeight:300}}>‹</span>
        </button>
        <span style={{color:"#FFFFFF",fontWeight:700,fontSize:16,fontFamily:"'Inter',sans-serif"}}>Rebill Challenge</span>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"20px 16px"}}>
        <PaymentModal
          amount={rebillFee}
          description={"28-Day Rebill"+(rebillDiscount?" (20% discount)":"")+" — "+tier?.label}
          buttonLabel="Rebill & Restart"
          onSuccess={()=>{ setShowPayment(false); onRebill(); }}
          onCancel={()=>setShowPayment(false)}
        />
      </div>
    </div>
  ) : (
    <div style={{position:"fixed",inset:0,zIndex:400,background:"#0A1628",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{fontSize:64,marginBottom:16}}>📅</div>
      <h2 style={{color:"#F4C430",fontSize:24,fontWeight:900,fontFamily:"'Inter',sans-serif",marginBottom:8,textAlign:"center"}}>28-Day Window Ended</h2>
      <p style={{color:"rgba(255,255,255,0.4)",fontSize:14,fontFamily:"'Inter',sans-serif",textAlign:"center",marginBottom:32,lineHeight:1.6}}>
        Your challenge window expired before hitting the target.<br/>
        Rebill to get a fresh 28-day window.
      </p>

      <div style={{width:"100%",maxWidth:340,background:"rgba(244,196,48,0.08)",border:"1px solid rgba(244,196,48,0.2)",borderRadius:18,padding:20,marginBottom:24}}>
        {[
          ["Progress",      "$"+(prog?.profit||0).toFixed(2)+" / $"+tier?.profitTarget?.toLocaleString()],
          ["Days Used",     "28 / 28"],
          ["Rebill Cost",   "$"+tier?.price],
          ["New Window",    "28 days fresh start"],
        ].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
            <span style={{color:"rgba(255,255,255,0.4)",fontSize:13,fontFamily:"'Inter',sans-serif"}}>{k}</span>
            <span style={{color:"#FFFFFF",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{v}</span>
          </div>
        ))}
      </div>

      <button onClick={()=>setShowPayment(true)} style={{width:"100%",maxWidth:340,height:52,borderRadius:14,background:"#F4C430",border:"none",color:"#000",fontSize:15,fontWeight:700,fontFamily:"'Inter',sans-serif",cursor:"pointer",marginBottom:12,position:"relative"}}>
        {rebillDiscount && <span style={{position:"absolute",top:-10,right:12,background:"#f93d3d",color:"#fff",fontSize:10,fontWeight:900,borderRadius:99,padding:"2px 8px"}}>20% OFF</span>}
        Rebill — ${rebillFee}
        {rebillDiscount && <span style={{fontSize:11,opacity:0.6,marginLeft:6,textDecoration:"line-through"}}>${tier?.price}</span>}
      </button>
      <button onClick={onClose} style={{width:"100%",maxWidth:340,height:44,borderRadius:14,background:"transparent",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.4)",fontSize:14,fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>
        Close Account
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCE HOOK — bulletproof localStorage with type validation
// ─────────────────────────────────────────────────────────────────────────────
const _memStore = {};

function safeGet(key, defaultValue) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null || raw === undefined) return defaultValue;
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return defaultValue;
    // Strict type matching
    if (Array.isArray(defaultValue) && !Array.isArray(parsed)) return defaultValue;
    if (typeof defaultValue === 'number' && typeof parsed !== 'number') return defaultValue;
    if (!Array.isArray(defaultValue) && typeof defaultValue === 'object' && (Array.isArray(parsed) || typeof parsed !== 'object')) return defaultValue;
    return parsed;
  } catch { 
    try { window.localStorage.removeItem(key); } catch {}
    return defaultValue; 
  }
}

function safeSet(key, val) {
  try { 
    if (val !== null && val !== undefined) {
      window.localStorage.setItem(key, JSON.stringify(val)); 
    }
  } catch {}
  _memStore[key] = val;
}

function usePersistedState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      return safeGet(key, defaultValue);
    } catch { return defaultValue; }
  });
  const setPersistedState = (valueOrFn) => {
    setState(prev => {
      try {
        // Guarantee prev is never null/undefined — always use defaultValue as fallback
        const safePrev = prev ?? defaultValue;
        const next = typeof valueOrFn === "function" ? valueOrFn(safePrev) : valueOrFn;
        const safeNext = next ?? defaultValue;
        safeSet(key, safeNext);
        return safeNext;
      } catch(err) { 
        console.warn("usePersistedState setter error:", err);
        return prev ?? defaultValue; 
      }
    });
  };
  return [state ?? defaultValue, setPersistedState];
}

export default function App() {
  // localStorage validation handled in safeGet()

  const {
    session, user, loading: authLoading, synced,
    syncBalance, syncBet, syncResolvedMarket,
    syncPropAccount, syncToggleWatchlist, syncProfile,
    syncPushNotif, syncMarkNotifsRead, syncPayoutRequest,
  } = useSupabaseSyncSafe();

  const [darkMode, setDarkMode] = useState(true);
  const theme = darkMode ? DARK_THEME : LIGHT_THEME;
  const [onboarded, setOnboarded] = useState(false);
  const [tab, setTab]             = useState("home");
  const [votes, setVotes]         = usePersistedState("ps_votes", {});
  const [balance, setBalance]     = usePersistedState("ps_balance", 100);
  const [following, setFollowing] = usePersistedState("ps_following", []);
  const [watchlist, setWatchlist] = usePersistedState("ps_watchlist", []);

  // ── Load Supabase data when user logs in ────────────────────────────────
  useEffect(() => {
    if (!synced || !user) return;
    // Hydrate app state from Supabase
    if (user.votes && Object.keys(user.votes).length > 0) setVotes(user.votes);
    if (user.balance !== undefined) setBalance(user.balance);
    if (user.watchlist?.length > 0) setWatchlist(user.watchlist);
    if (user.profile) setProfileData(user.profile);
  }, [synced, user?.id]);
  const [notifCount, setNotifCount] = useState(3);
  const [liveNotifs, setLiveNotifs] = usePersistedState("ps_liveNotifs", []);

  const pushNotif = (type, icon, title, body) => {
    const notif = { id: Date.now(), type, icon, title, body, time: "just now", read: false };
    setLiveNotifs(n => [notif, ...n].slice(0, 50));
    setNotifCount(c => c + 1);
  };
  const [profileData, setProfileData] = useState({ name:"Supreme Markets", bio:"CEO", avatar:"S" });
  const [quickBetPresets, setQuickBetPresets] = useState([1, 5, 10, 25]);
  const [maxBetSetting, setMaxBetSetting] = useState(100);
  const [toast, setToast]         = useState(null); // achievement toast

  // ── POLYMARKET LIVE FEED ──────────────────────────────────────────────────
  const { markets: liveMarkets, error: polyError, loading: polyLoading, lockedRef: marketLockedRef, resolvedOutcomesRef: serverResolutionsRef } = usePolymarketMarkets();
  const livePrices = {}; // WebSocket disabled - static

  // Collect token IDs from live markets for WS subscription
  // tokenIds no longer needed (WebSocket disabled)
  // const tokenIds = useMemo(() => [], []);

  // WebSocket price feed disabled - prices update via 30s API poll instead
  // usePolymarketPrices(tokenIds, (tokenId, yesPct) => { setLivePrices(prev => ({...prev,[tokenId]:yesPct})); });

  // Merge live prices into markets; fall back to mock data while loading
  const dynamicMarkets = useMemo(() => {
    if (!liveMarkets) return ALL_PREDICTIONS; // show mock while loading
    return liveMarkets.map(m => {
      const liveYes = m.clobTokenIds?.[0] && livePrices[m.clobTokenIds[0]];
      return liveYes ? { ...m, yesPct: liveYes } : m;
    });
  }, [liveMarkets, livePrices]);

  const isLive = !!liveMarkets && !polyError;
  const isFetchingLive = polyLoading && !liveMarkets;

  // overlays
  const [showSearch,      setShowSearch]      = useState(false);
  const [showNotifs,      setShowNotifs]      = useState(false);
  const [showWallet,      setShowWallet]      = useState(false);
  const [showSettings,    setShowSettings]    = useState(false);
  const [showAdmin,       setShowAdmin]       = useState(false);
  const [showResolved,    setShowResolved]    = useState(false);
  const [showWatchlist,   setShowWatchlist]   = useState(false);
  const [showReferral,    setShowReferral]    = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showFeed,        setShowFeed]        = useState(false);
  const [showParlay,      setShowParlay]      = useState(false);
  const [showPortfolio,   setShowPortfolio]   = useState(false);
  const [showHotTakes,    setShowHotTakes]    = useState(false);
  const [showTournament,  setShowTournament]  = useState(false);
  const [showPropFirm,    setShowPropFirm]    = useState(false);
  const [showPropPurchase,setShowPropPurchase] = useState(false);
  const [showPropAccounts,setShowPropAccounts] = useState(false);
  const [showPropCopyTrader,setShowPropCopyTrader] = useState(false);
  const [showPropChallenge,setShowPropChallenge] = useState(false);
  const [showPropFunded,  setShowPropFunded]  = useState(false);
  const [showPropLeaderboard,setShowPropLeaderboard] = useState(false);
  const [showPropAnalytics,setShowPropAnalytics] = useState(false);
  const [showPropBreach,   setShowPropBreach]    = useState(false);
  const [showPropGraduation,setShowPropGraduation] = useState(false);
  const [propAccounts,    setPropAccounts]    = usePersistedState("ps_propAccounts", []);
  const [resolvedBets,    setResolvedBets]    = usePersistedState("ps_resolvedBets", {});
  const [resolutionQueue, setResolutionQueue] = useState([]); // pending toasts
  const [propBreachAcct,  setPropBreachAcct]  = useState(null);
  const [propPassAcct,    setPropPassAcct]    = useState(null);
  const [propRebillAcct,  setPropRebillAcct]  = useState(null);
  const [activeAccountId, setActiveAccountId] = useState(null); // which account to view dashboard for
  const [catPage,         setCatPage]         = useState(null); // cat string
  const [creatorView,     setCreatorView]     = useState(null);

  const handleVote = (predId, pos, amount=1, shares=0, sharePrice=0) => {
    if (votes[predId]) return;
    // If user has an active prop account, use prop balance — not wallet balance
    const activePropAccount = (propAccounts||[]).find(a => a.status === "active" || a.status === "funded");
    const activeTier = activePropAccount ? PROP_TIERS.find(t => t.id === activePropAccount.tierId) : null;

    // Block trading on breached/passed accounts
    if (activePropAccount?.status === "breached") {
      const resets = activePropAccount.resets || 0;
      const resetLabel = resets < 2 ? "Reset (20% off)" : "Reset";
      setToast({icon:"🚫", label:"Account Breached", desc:"Your challenge account is breached. Reset to continue trading."});
      setTimeout(() => setPropBreachAcct(activePropAccount), 300);
      return;
    }
    if (activePropAccount?.status === "passed") {
      setToast({icon:"🏆", label:"Challenge Passed!", desc:"Activate your funded account to continue trading."});
      setTimeout(() => setPropPassAcct(activePropAccount), 300);
      return;
    }

    const effectiveBalance = activeTier ? activeTier.balance : balance;
    const effectiveMaxBet  = activeTier ? activeTier.maxBet  : maxBetSetting;
    if (amount > effectiveBalance) { setToast({icon:"⚠️",label:"Exceeds Account Balance",desc:"Bet exceeds your "+( activeTier ? activeTier.label+" balance" : "wallet balance")}); return; }
    if (activeTier && amount > effectiveMaxBet) { setToast({icon:"⚠️",label:"Exceeds Max Bet",desc:"Max bet for "+activeTier.label+" is $"+effectiveMaxBet}); return; }
    // Find the market for prop account recording
    const market = dynamicMarkets?.find(m => String(m.id) === String(predId));
    setVotes(v => { v = v || {};
      const next = {...v,[predId]:{pos,amount,shares:shares||0,sharePrice:sharePrice||0,placedAt:Date.now(),title:dynamicMarkets?.find(m=>String(m.id)===String(predId))?.title||String(predId)}};
      const count = Object.keys(next).length;
      if (count===1) setToast({icon:"🎯",label:"First Bet!",desc:"You placed your first prediction bet"});
      else if (count===5) setToast({icon:"💎",label:"Diamond Hands",desc:"5 active positions — you're all in"});
      else if (count===10) setToast({icon:"🔥",label:"Degen Mode",desc:"10 bets placed — absolute degen"});
      return next;
    });
    // Only deduct from wallet if no active prop account
    if (!activePropAccount) {
      const newBal = Math.max(0, parseFloat((balance-amount).toFixed(2)));
      setBalance(newBal);
      if (session) syncBalance(newBal);
    }
    // Record bet in Supabase
    if (session && market) syncBet(predId, pos, amount, market);
    // Record bet on active prop accounts
    if (market) handlePropBet(predId, pos, amount, market, shares, sharePrice);
  };

  // ── PRICE SNAPSHOT — track last known price for every market ────────────────
  const priceSnapshotRef = React.useRef({}); // marketId -> {yesPct, endDate, lastSeen}
  useEffect(() => {
    if (!dynamicMarkets) return;
    const snap = priceSnapshotRef.current;
    dynamicMarkets.forEach(m => {
      snap[m.id] = { yesPct: m.yesPct, endDate: m.endDate, lastSeen: Date.now(), polyId: m.polyId };
    });
  }, [dynamicMarkets]);

  // ── BET RESOLUTION ENGINE ──────────────────────────────────────────────────
  // Runs every 10s — checks all open votes + prop bets against live market data
  useEffect(() => {
    const settle = () => {
      const dynamicMkts = dynamicMarkets || [];

      // Update lastKnownPct on all open prop bets (before market resets to 50%)
      setPropAccounts(accounts => (accounts||[]).map(acct => ({
        ...acct,
        bets: (acct.bets||[]).map(b => {
          if (b.resolved) return b;
          const m = dynamicMkts.find(mk => String(mk.id)===String(b.predId)||String(mk.polyId)===String(b.predId));
          if (!m) return b; // market gone — keep existing lastKnownPct
          const endMs = m.endDate ? new Date(m.endDate).getTime() : 0;
          if (endMs > 0 && endMs < Date.now()) return b; // market closing — freeze, don't update
          return { ...b, lastKnownPct: m.yesPct }; // store fresh price
        }),
      })));

      const newResolved = {};
      const newToasts = [];
      let balanceDelta = 0;
      const snap   = priceSnapshotRef.current;
      const locked = marketLockedRef?.current || {};

      // Build set of ALL market IDs to check:
      // 1. Live dynamic markets
      // 2. Wallet votes
      // 3. Open prop account bets (key addition)
      // Use ref for fresh propAccounts — avoid stale closure
      const currentAccounts = propAccounts || [];
      const propBetIds = new Set(
        currentAccounts.flatMap(a =>
          (a.bets||[]).filter(b=>!b.resolved).map(b => b.predId)
        )
      );
      const allMarketIds = new Set([
        ...dynamicMkts.map(m => m.id),
        ...Object.keys(votes||{}),
        ...propBetIds,
      ]);

      if (allMarketIds.size === 0) return;

      allMarketIds.forEach(marketId => {
        // Skip already-resolved wallet bets
        if ((votes||{})[marketId] && resolvedBets[marketId]) return;

        // Skip prop bets already resolved in ALL accounts (use fresh ref)
        const allPropBetsResolved = !currentAccounts.some(a =>
          (a.bets||[]).some(b => b.predId === marketId && !b.resolved)
        );
        const hasWalletVote = !!(votes||{})[marketId];
        if (!hasWalletVote && allPropBetsResolved) return;

        const vote = (votes||{})[marketId];
        let winner = null;
        let market = dynamicMkts.find(m => m.id === marketId);

        // ── Priority 1: officialWinner on live market object ─────────────────
        if (market?.officialWinner) winner = market.officialWinner;

        // ── Priority 2: OFFICIAL server resolution from past windows ─────────
        if (!winner) {
          const serverRes = serverResolutionsRef?.current?.[marketId];
          if (serverRes?.winner) winner = serverRes.winner;
        }

        // ── Priority 3: locked price (only from official 99%/1% signal) ───────
        if (!winner) {
          const polyId   = market?.polyId || snap[marketId]?.polyId;
          const lockData = polyId ? locked[polyId] : null;
          if (lockData?.winner) winner = lockData.winner;
        }

        // ── Priority 4: live market resolution ───────────────────────────────
        if (!winner && market) {
          winner = resolveMarket(market);
        }

        if (!winner) return;
        if (!market) market = { id: marketId, question: marketId, title: marketId };

        // ── Settle wallet vote ────────────────────────────────────────────────
        if (vote && !resolvedBets[marketId]) {
          newResolved[market.id] = winner;
          const won      = vote.pos === winner;
          const cost     = vote.amount || 1;
          const shares   = vote.shares > 0
            ? vote.shares
            : (vote.sharePrice > 0 ? cost / vote.sharePrice : cost / 0.5);
          const payout   = won ? shares : 0;
          const pnlDelta = parseFloat((won ? payout - cost : -cost).toFixed(2));
          balanceDelta  += won ? payout : 0;

          const pnlStr = won
            ? `+$${pnlDelta.toFixed(2)} (${shares.toFixed(1)} shares @ $1)`
            : `-$${cost.toFixed(2)}`;
          newToasts.push({
            icon: won ? "💰" : "❌",
            label: won ? "Bet Won!" : "Bet Lost",
            desc: `${(market.question||market.title||"Market")?.slice(0,40)}… resolved ${winner} ${pnlStr}`,
          });
          pushNotif(
            won ? "win" : "loss",
            won ? "💰" : "❌",
            won ? `Bet Won! ${pnlStr}` : `Bet Lost ${pnlStr}`,
            `"${(market.question||market.title||"Market").slice(0,60)}" resolved ${winner}`
          );
        }

        // ── Settle prop account bets ──────────────────────────────────────────
        setPropAccounts(accounts => (accounts||[]).map(acct => {
          const bet = acct.bets?.find(b => b.predId === marketId && !b.resolved);
          if (!bet) return acct;
          if (acct.resolvedIds?.includes(marketId)) return acct;

          const betShares = bet.shares > 0
            ? bet.shares
            : (bet.sharePrice > 0 ? bet.stake / bet.sharePrice : bet.stake / 0.5);
          const betWon   = bet.pos === winner;
          const betPnl   = betWon
            ? parseFloat((betShares - bet.stake).toFixed(2))
            : parseFloat((-bet.stake).toFixed(2));

          const updatedAcct = {
            ...acct,
            pnl: parseFloat(((acct.pnl || 0) + betPnl).toFixed(2)),
            resolvedIds: [...(acct.resolvedIds || []), marketId],
            bets: acct.bets.map(b => b.predId === marketId && !b.resolved
              ? { ...b, resolved: true, won: betWon, pnlDelta: betPnl }
              : b
            ),
          };

          // Show toast for prop bet resolution
          newToasts.push({
            icon: betWon ? "🏆" : "❌",
            label: betWon ? "Prop Bet Won!" : "Prop Bet Lost",
            desc: `${(bet.title||marketId).slice(0,40)} → ${betWon ? "+$"+betPnl.toFixed(2) : "-$"+bet.stake.toFixed(2)}`,
          });

          const tier     = PROP_TIERS.find(t => t.id === updatedAcct.tierId);
          const evaluated = evalPropAccount(updatedAcct, tier);
          if (evaluated.status === "breached" && acct.status !== "breached") {
            setTimeout(() => setPropBreachAcct(evaluated), 800);
          } else if (evaluated.status === "passed" && acct.status !== "passed") {
            setTimeout(() => setPropPassAcct(evaluated), 800);
          } else if (evaluated.status === "rebill" && acct.status !== "rebill") {
            setTimeout(() => setPropRebillAcct(evaluated), 800);
          }
          return evaluated;
        }));
      });

      if (Object.keys(newResolved).length > 0) {
        setResolvedBets(r => ({ ...(r||{}), ...newResolved }));
        const activeProp = (propAccounts||[]).find(a => a.status==="active"||a.status==="funded");
        if (balanceDelta > 0 && !activeProp) {
          setBalance(b => parseFloat((b + balanceDelta).toFixed(2)));
        }
      }
      if (newToasts.length > 0) setToast(newToasts[0]);
    };

    const timeout = setTimeout(settle, 3000);
    const interval = setInterval(settle, 10000);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [votes, dynamicMarkets, resolvedBets, propAccounts]);

  // ── PROP ACCOUNT MONITORING — check for rebills and drawdown warnings ────────
  useEffect(() => {
    (propAccounts || []).forEach(acct => {
      if (acct.status === "breached" || acct.status === "passed") return;
      const tier = PROP_TIERS.find(t => t.id === acct.tierId);
      if (!tier) return;

      // Check 28-day rebill
      if (acct.startedAt && tier.rebillDays > 0) {
        const elapsed = Date.now() - acct.startedAt;
        const windowMs = 28 * 24 * 60 * 60 * 1000;
        if (elapsed >= windowMs && (acct.pnl || 0) < (tier.profitTarget || Infinity)) {
          if (acct.status !== "rebill") {
            setPropAccounts(a => (a||[]).map(ac => ac.id === acct.id ? {...ac, status:"rebill"} : ac));
            setTimeout(() => setPropRebillAcct({...acct, status:"rebill"}), 500);
          }
          return;
        }
        // Warn at 80% of window
        const warnMs = windowMs * 0.8;
        if (elapsed >= warnMs && elapsed < windowMs) {
          const daysLeft = Math.ceil((windowMs - elapsed) / 86400000);
          if (!acct._warnedRebill) {
            pushNotif("system","⏰","Challenge Expiring Soon",
              `${tier.label}: ${daysLeft} days left to hit your $${tier.profitTarget?.toLocaleString()} target`);
            setPropAccounts(a => (a||[]).map(ac => ac.id === acct.id ? {...ac, _warnedRebill:true} : ac));
          }
        }
      }

      // Warn at 75% drawdown
      const drawdown = Math.max(0, -(acct.pnl || 0));
      const drawdownPct = (drawdown / tier.maxLoss) * 100;
      if (drawdownPct >= 75 && !acct._warnedDrawdown) {
        pushNotif("loss","⚠️","Drawdown Warning",
          `${tier.label}: ${drawdownPct.toFixed(0)}% of max drawdown used — $${(tier.maxLoss - drawdown).toFixed(0)} buffer remaining`);
        setPropAccounts(a => (a||[]).map(ac => ac.id === acct.id ? {...ac, _warnedDrawdown:true} : ac));
      }
      // Reset drawdown warning if recovered
      if (drawdownPct < 60 && acct._warnedDrawdown) {
        setPropAccounts(a => (a||[]).map(ac => ac.id === acct.id ? {...ac, _warnedDrawdown:false} : ac));
      }
    });
  }, [propAccounts]);

  // ── PROP ACCOUNT VOTE — also record bet on active prop accounts ───────────
  const handlePropBet = (predId, pos, stake, market, shares=0, sharePrice=0) => {
    const makeBet = (acct) => {
      const tier = PROP_TIERS.find(t => t.id === acct.tierId);
      if (!tier) return acct;
      if (acct.status === "breached" || acct.status === "passed") return acct;
      if (stake > tier.maxBet) return acct;
      if ((acct.bets||[]).some(b => b.predId === String(predId) && !b.resolved)) return acct;
      return {
        ...acct,
        bets: [...(acct.bets || []), {
          predId:     String(predId),
          title:      market?.title || market?.question || String(predId),
          category:   market?.category || "CRYPTO",
          symbol:     market?.symbol || null,
          pos,
          stake,
          shares:     shares || (stake / Math.max(0.01, (pos==="YES" ? (market?.yesPct||50) : (100-(market?.yesPct||50)))/100)),
          sharePrice: sharePrice || (pos==="YES" ? (market?.yesPct||50)/100 : (100-(market?.yesPct||50))/100),
          entryPct:   market?.yesPct ?? 50,
          placedAt:   Date.now(),
          endDate:    market?.endDate || null,
          resolved:   false,
          won:        null,
          pnlDelta:   null,
        }],
      };
    };

    setPropAccounts(accounts => {
      const accts = accounts || [];
      // Determine trading account: activeAccountId if set, else leader, else funded, else active
      const tradingAcct = accts.find(a => a.id === activeAccountId && a.status !== "breached" && a.status !== "passed")
        || accts.find(a => a.isLeader)
        || accts.find(a => a.status === "funded")
        || accts.find(a => a.status === "active");
      if (!tradingAcct) return accts;

      // Copy to follower accounts that have copyEnabled
      const followerIds = new Set(
        accts.filter(a => a.copyEnabled && a.id !== tradingAcct.id && a.status !== "breached" && a.status !== "passed").map(a => a.id)
      );

      return accts.map(acct => {
        if (acct.id === tradingAcct.id) return makeBet(acct);
        if (followerIds.has(acct.id)) return makeBet(acct);
        return acct;
      });
    });
  };

  const handleFollow = (handle) => {
    setFollowing(f => { f = f || [];
      const next = f.includes(handle) ? f.filter(h=>h!==handle) : [...f,handle];
      if (!f.includes(handle) && next.length===1) setToast({icon:"👥",label:"First Follow!",desc:"You're building your network"});
      return next;
    });
  };

  const handleToggleWatch = (predId) => {
    setWatchlist(w => { w = w || [];
      const next = w.includes(predId) ? w.filter(id=>id!==predId) : [...w,predId];
      if (!w.includes(predId) && next.length===1) setToast({icon:"🔖",label:"Watchlist Started",desc:"Track predictions you care about"});
      return next;
    });
  };

  // Show loading while checking auth
  if (authLoading) return (
    <div style={{position:"fixed",inset:0,background:"#0A1628",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:"rgba(255,255,255,0.3)",fontSize:14,fontFamily:"'Inter',sans-serif"}}>Loading…</div>
    </div>
  );

  // Show auth screen if not logged in
  // Comment out the auth gate during testing to skip login requirement
  // if (!session) return ( <AuthScreen .../> );

  if (!onboarded) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{width:"100vw",height:"100vh",maxWidth:430,margin:"0 auto",background:"#0A1628"}}>
        <OnboardingPage onDone={()=>setOnboarded(true)}/>
      </div>
    </>
  );

  const propAccount    = (propAccounts||[]).find(a=>a.id===activeAccountId) || propAccounts[0] || null;
  const anyFunded      = (propAccounts||[]).some(a=>a.funded);
  const propBtnLabel   = anyFunded?"FUNDED":(propAccounts||[]).length>0?"ACTIVE":"PROP";
  const propBtnColor   = "#0F1720";
  const propBtnBg      = "#F4C430";
  const propBtnBorder  = "rgba(244,196,48,0.4)";
  const openPropMain   = () => {
    if ((propAccounts||[]).length === 0) { setShowPropFirm(true); return; }
    setShowPropAccounts(true);
  };

  // Open the active/leader account dashboard directly
  const openActiveDashboard = () => {
    const accounts = propAccounts || [];
    if (accounts.length === 0) { setShowPropFirm(true); return; }
    // If multiple accounts, show accounts list so user can choose / add
    if (accounts.length > 1) { setShowPropAccounts(true); return; }
    // Single account: go directly to its dashboard
    const target = accounts.find(a => a.isLeader)
      || accounts.find(a => a.status === "funded")
      || accounts.find(a => a.status === "active")
      || accounts[0];
    setActiveAccountId(target.id);
    if (target.funded || target.status === "funded") {
      setShowPropFunded(true);
    } else {
      setShowPropChallenge(true);
    }
  };

  const overlay = creatorView            ? "creator"
    : catPage               ? "catpage"
    : showTournament        ? "tournament"
    : showPropAnalytics     ? "propanalytics"
    : showPropLeaderboard   ? "propleaderboard"
    : showPropCopyTrader    ? "propcopytader"
    : showPropAccounts      ? "propaccounts"
    : showPropFunded        ? "propfunded"
    : showPropChallenge     ? "propchallenge"
    : showPropPurchase      ? "proppurchase"
    : showPropFirm          ? "propfirm"
    : showParlay            ? "parlay"
    : showPortfolio   ? "portfolio"
    : showHotTakes    ? "hottakes"
    : showProfileEdit ? "profileedit"
    : showSettings    ? "settings"
    : showAdmin       ? "admin"
    : showResolved    ? "resolved"
    : showWatchlist   ? "watchlist"
    : showReferral    ? "referral"
    : showSearch      ? "search"
    : showNotifs      ? "notifs"
    : showWallet      ? "wallet"
    : showFeed        ? "feed"
    : null;

  return (
    <AppErrorBoundary>
    <ThemeContext.Provider value={theme}>
    <PredictionsContext.Provider value={dynamicMarkets || []}>
      <style>{darkMode ? GLOBAL_CSS : GLOBAL_CSS_LIGHT}</style>
      <div style={{width:"100vw",height:"100vh",maxWidth:430,margin:"0 auto",display:"flex",flexDirection:"column",background:theme.bg,position:"relative",transition:"background 0.3s"}}>

        {/* ACHIEVEMENT TOAST */}
        {toast && <AchievementToast achievement={toast} onDone={()=>setToast(null)}/>}

        {/* LIVE DATA BADGE removed */}

        {/* LIVE TICKER — markets only (feed is full-screen, no ticker needed there) */}
        {tab==="markets" && !overlay && <LiveTicker votes={votes} onVote={handleVote} balance={balance} watchlist={watchlist} onToggleWatch={handleToggleWatch}/>}

        {/* TOP UTILITY BAR — Polymarket style header */}
        {tab!=="home" && (
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px 10px",background:"#070F1E",borderBottom:"1px solid #1E3A5F",flexShrink:0,zIndex:250}}>
            {/* Logo + brand */}
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              <div style={{width:30,height:30,background:"linear-gradient(135deg,#3B82F6,#1D6ED8)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,boxShadow:"0 2px 12px rgba(59,130,246,0.5)"}}>⚡</div>
              <span style={{color:"#FFFFFF",fontWeight:800,fontSize:16,fontFamily:"'Inter',sans-serif",letterSpacing:-0.5}}>PredictSwipe</span>
            </div>
            {/* Right side — Polymarket style: notif + outlined wallet + filled blue search */}
            <div style={{display:"flex",gap:6,alignItems:"center",minWidth:0}}>
              <button onClick={()=>{setShowNotifs(true);setNotifCount(0);}} style={{background:"transparent",border:"1px solid #1E3A5F",borderRadius:8,padding:"6px 8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",flexShrink:0,height:34,width:34}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" stroke="rgba(255,255,255,0.65)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {notifCount>0&&<span style={{position:"absolute",top:-3,right:-3,width:15,height:15,borderRadius:"50%",background:"#EF4444",color:"#fff",fontSize:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,border:"2px solid #070F1E"}}>{notifCount}</span>}
              </button>
              <button onClick={()=>setShowWallet(true)} style={{background:"transparent",border:"1px solid #1E3A5F",borderRadius:8,padding:"6px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:4,flexShrink:0,height:34}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M21 6H3a2 2 0 00-2 2v8a2 2 0 002 2h18a2 2 0 002-2V8a2 2 0 00-2-2z" stroke="rgba(255,255,255,0.55)" strokeWidth="1.7"/>
                  <circle cx="17" cy="12" r="1.5" fill="rgba(255,255,255,0.55)"/>
                </svg>
                <span style={{color:"rgba(255,255,255,0.85)",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap"}}>${balance.toFixed(2)}</span>
              </button>
              <button onClick={()=>setShowSearch(true)} style={{background:"#3B82F6",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:4,flexShrink:0,height:34,boxShadow:"0 2px 8px rgba(59,130,246,0.4)"}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="#fff" strokeWidth="2"/>
                  <path d="M21 21l-4.35-4.35" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* MAIN CONTENT */}
        <div style={{flex:1,overflow:"hidden",position:"relative"}}>
          {tab==="home"      && <Feed votes={votes} onVote={handleVote} following={following} onFollow={handleFollow} balance={balance} watchlist={watchlist} onToggleWatch={handleToggleWatch} onOpenWallet={()=>setShowWallet(true)} onOpenPropFirm={openActiveDashboard} propAccounts={propAccounts} maxBetSetting={maxBetSetting} showPnlOverlay={!overlay} onSellBet={(accountId, result, bet, isSell)=>{
              const soldValue    = result?.soldValue ?? result;
              const sellPct      = result?.sellPct ?? 100;
              const predId       = typeof bet === "object" ? bet.predId : bet;
              const isPartial    = sellPct < 100;
              const pnlDelta     = typeof bet === "object"
                ? parseFloat((soldValue - (bet.stake||0) * sellPct / 100).toFixed(2))
                : 0;
              setPropAccounts(a => (a||[]).map(ac => {
                // Sell on the primary account AND any copy accounts that have this same bet
                const hasBet = (ac.bets||[]).some(b => String(b.predId) === String(predId) && !b.resolved);
                if (!hasBet) return ac;
                // Calculate pnlDelta per account based on that account's stake
                const acBet = (ac.bets||[]).find(b => String(b.predId) === String(predId));
                const acSoldValue = acBet ? (acBet.shares > 0 ? acBet.shares : acBet.stake / Math.max(0.01, acBet.sharePrice||0.5)) * (acBet.pos==="YES" ? (acBet.lastKnownPct??acBet.entryPct??50)/100 : (100-(acBet.lastKnownPct??acBet.entryPct??50))/100) * 0.99 : soldValue;
                const acPnlDelta = parseFloat((acSoldValue - (acBet?.stake||0) * sellPct / 100).toFixed(2));
                return {
                  ...ac,
                  pnl: parseFloat(((ac.pnl||0) + acPnlDelta).toFixed(2)),
                  resolvedIds: isPartial ? (ac.resolvedIds||[]) : [...(ac.resolvedIds||[]), predId],
                  bets: (ac.bets||[]).map(b => {
                    if (String(b.predId) !== String(predId)) return b;
                    if (isPartial) {
                      const remainPct = (100 - sellPct) / 100;
                      return { ...b, shares: parseFloat(((b.shares||0)*remainPct).toFixed(4)), stake: parseFloat(((b.stake||0)*remainPct).toFixed(2)), partialSoldPnl: (b.partialSoldPnl||0)+acPnlDelta };
                    }
                    return { ...b, resolved: true, won: acPnlDelta >= 0, pnlDelta: acPnlDelta, soldEarly: true };
                  }),
                };
              }));
            }}/>}
          {tab==="markets"   && <MarketsPage votes={votes} onVote={handleVote} balance={balance} watchlist={watchlist} onToggleWatch={handleToggleWatch} onOpenCreator={setCreatorView} onOpenCategory={setCatPage} onOpenPropFirm={openPropMain}/>}
          {tab==="ranking"   && <RankingPage onOpenCreator={setCreatorView} onOpenTournament={()=>setShowTournament(true)} onOpenPropFirm={openPropMain} onOpenPropAnalytics={()=>setShowPropAnalytics(true)} propAccount={propAccount} propAccounts={propAccounts} following={following} onFollow={handleFollow} votes={votes} resolvedBets={resolvedBets} profileData={profileData}/>}
          {tab==="profile"   && <ProfilePage votes={votes} balance={balance} following={following} onOpenSettings={()=>setShowSettings(true)} onOpenResolved={()=>setShowResolved(true)} onOpenCreator={setCreatorView} onOpenAdmin={()=>setShowAdmin(true)} onOpenWatchlist={()=>setShowWatchlist(true)} onOpenReferral={()=>setShowReferral(true)} onOpenProfileEdit={()=>setShowProfileEdit(true)} onOpenPortfolio={()=>setShowPortfolio(true)} profileData={profileData} watchlistCount={watchlist.length} onOpenPropFirm={openPropMain} resolvedBets={resolvedBets} propAccounts={propAccounts} onOpenPropAnalytics={()=>setShowPropAnalytics(true)} onOpenRanking={()=>setTab("ranking")} onOpenWallet={()=>setShowWallet(true)}/>}
          {tab==="create"    && <CreatePageV2 onClose={()=>setTab("home")} onPublish={()=>{ setToast({icon:"🚀",label:"Market Published!",desc:"Your prediction is now live"}); setTab("home"); }}/>}
        </div>

        {/* BOTTOM NAV — Polymarket style: dark footer, blue active accent */}
        <div style={{display:"flex",background:"#070F1E",borderTop:"1px solid #1E3A5F",flexShrink:0,padding:"6px 0 20px",position:"relative",zIndex:200}}>
          {[
            { id:"home", label:"Home",
              icon: (on) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" stroke={on?"#3B82F6":"rgba(255,255,255,0.35)"} strokeWidth={on?2:1.5} strokeLinejoin="round" fill={on?"rgba(59,130,246,0.18)":"none"}/>
                <path d="M9 21V13h6v8" stroke={on?"#3B82F6":"rgba(255,255,255,0.35)"} strokeWidth={on?2:1.5} strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            },
            { id:"markets", label:"Markets",
              icon: (on) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="7" height="7" rx="1.5" stroke={on?"#3B82F6":"rgba(255,255,255,0.35)"} strokeWidth={on?2:1.5} fill={on?"rgba(59,130,246,0.18)":"none"}/>
                <rect x="14" y="3" width="7" height="7" rx="1.5" stroke={on?"#3B82F6":"rgba(255,255,255,0.35)"} strokeWidth={on?2:1.5} fill={on?"rgba(59,130,246,0.18)":"none"}/>
                <rect x="3" y="14" width="7" height="7" rx="1.5" stroke={on?"#3B82F6":"rgba(255,255,255,0.35)"} strokeWidth={on?2:1.5} fill={on?"rgba(59,130,246,0.18)":"none"}/>
                <rect x="14" y="14" width="7" height="7" rx="1.5" stroke={on?"#3B82F6":"rgba(255,255,255,0.35)"} strokeWidth={on?2:1.5} fill={on?"rgba(59,130,246,0.18)":"none"}/>
              </svg>
            },
            { id:"prop", label: anyFunded?"FUNDED":(propAccounts||[]).length>0?"ACTIVE":"Prop",
              isProp: true,
              icon: (on) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="6" width="18" height="13" rx="2.5" stroke="#F4C430" strokeWidth="1.8" fill="rgba(244,196,48,0.1)"/>
                <path d="M3 10.5h18" stroke="#F4C430" strokeWidth="1.2" strokeDasharray="2 2"/>
                <text x="12" y="18.5" textAnchor="middle" fontSize="7" fontWeight="800" fontFamily="'Inter',sans-serif" fill="#F4C430">PROP</text>
              </svg>
            },
            { id:"ranking", label:"Ranking",
              icon: (on) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M18 20V10M12 20V4M6 20v-6" stroke={on?"#3B82F6":"rgba(255,255,255,0.35)"} strokeWidth={on?2:1.5} strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            },
            { id:"profile", label:"Profile",
              icon: (on) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="4" stroke={on?"#3B82F6":"rgba(255,255,255,0.35)"} strokeWidth={on?2:1.5} fill={on?"rgba(59,130,246,0.18)":"none"}/>
                <path d="M4 20c0-3.86 3.58-7 8-7s8 3.14 8 7" stroke={on?"#3B82F6":"rgba(255,255,255,0.35)"} strokeWidth={on?2:1.5} strokeLinecap="round"/>
              </svg>
            },
          ].map(n=>(
            <button key={n.id}
              onClick={()=>{
                if(n.isProp){ openPropMain(); }
                else {
                  setShowWallet(false); setShowSettings(false); setShowWatchlist(false);
                  setShowReferral(false); setShowPortfolio(false);
                  setShowResolved(false); setShowSearch(false);
                  setShowNotifs(false); setShowProfileEdit(false);
                  setShowPropFirm(false); setShowPropAccounts(false);
                  setShowPropPurchase(false); setShowPropFunded(false);
                  setShowPropChallenge(false); setShowPropAnalytics(false);
                  setShowPropGraduation(false); setShowPropLeaderboard(false);
                  setShowPropCopyTrader(false); setShowPropBreach(false);
                  setCreatorView(null); setCatPage(null);
                  setShowTournament(false); setShowFeed(false);
                  setTab(n.id);
                }
              }}
              style={{flex:1,background:"transparent",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"8px 0 0",position:"relative",transition:"opacity 0.15s"}}>
              {/* Active glow dot at top */}
              {(!n.isProp && tab===n.id) && (
                <div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:20,height:3,borderRadius:"0 0 4px 4px",background:"#3B82F6",boxShadow:"0 2px 8px rgba(59,130,246,0.7)"}}/>
              )}
              {n.icon(n.isProp ? true : tab===n.id)}
              <span style={{
                fontSize:9,fontFamily:"'Inter',sans-serif",letterSpacing:0.4,transition:"color 0.2s",
                fontWeight: n.isProp ? 800 : tab===n.id ? 700 : 400,
                color: n.isProp ? "#F4C430" : tab===n.id ? "#3B82F6" : "rgba(255,255,255,0.35)",
              }}>{n.label}</span>
              {n.id==="profile"&&notifCount>0&&tab!=="profile"&&<div style={{position:"absolute",top:6,right:"18%",width:7,height:7,borderRadius:"50%",background:"#EF4444",border:"2px solid #070F1E"}}/>}
              {n.id==="markets"&&watchlist.length>0&&<div style={{position:"absolute",top:6,right:"14%",width:7,height:7,borderRadius:"50%",background:"#3B82F6",border:"2px solid #070F1E"}}/>}
              {n.isProp&&anyFunded&&<div style={{position:"absolute",top:6,right:"18%",width:7,height:7,borderRadius:"50%",background:"#22C55E",border:"2px solid #070F1E"}}/>}
            </button>
          ))}
        </div>

        {/* ── OVERLAYS ─────────────────────────────────────────────────────── */}
        {overlay && (
          <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,zIndex:50,display:"flex",flexDirection:"column",background:theme.bgOverlay}}>
            {/* Search + notif accessible from all overlays */}
            {overlay!=="search" && overlay!=="notifs" && overlay!=="settings" && overlay!=="profileedit" && overlay!=="propfirm" && overlay!=="proppurchase" && overlay!=="propaccounts" && overlay!=="propchallenge" && overlay!=="propfunded" && overlay!=="propleaderboard" && overlay!=="propanalytics" && overlay!=="propcopytader" && <div style={{position:"absolute",top:10,right:12,zIndex:500,display:"flex",gap:6,pointerEvents:"all"}}>
              <button onClick={()=>setShowSearch(true)} style={{background:"rgba(0,0,0,0.6)",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,width:30,height:30,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:13,lineHeight:1,color:"#FFFFFF"}}>⌕</span>
              </button>
              <button onClick={()=>{setShowNotifs(true);setNotifCount(0);}} style={{background:"rgba(0,0,0,0.6)",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,width:30,height:30,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
                <span style={{fontSize:12,lineHeight:1}}>🔔</span>
                {notifCount>0&&<span style={{position:"absolute",top:-3,right:-3,width:14,height:14,borderRadius:"50%",background:"#f93d3d",color:"#fff",fontSize:7,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,border:"1px solid #0A1628"}}>{notifCount}</span>}
              </button>
            </div>}

            {overlay==="feed" && (
              <div style={{flex:1,overflow:"hidden",position:"relative"}}>
                <button onClick={()=>setShowFeed(false)} style={{position:"absolute",top:16,left:16,zIndex:100,background:"rgba(10,22,40,0.72)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:20,color:"#FFFFFF",fontSize:13,padding:"6px 14px",cursor:"pointer",backdropFilter:"blur(4px)",fontFamily:"'Inter',sans-serif"}}>← Back</button>
                <Feed votes={votes} onVote={handleVote} following={following} onFollow={handleFollow} balance={balance} watchlist={watchlist} onToggleWatch={handleToggleWatch}/>
              </div>
            )}

            {overlay==="tournament" && (
              <div style={{flex:1,overflow:"hidden"}}><TournamentPage onClose={()=>setShowTournament(false)} votes={votes} onVote={handleVote} balance={balance} onAddBalance={amt=>setBalance(b=>parseFloat((b+amt).toFixed(2)))}/></div>
            )}

            {overlay==="propfirm" && (
              <div style={{flex:1,overflow:"hidden"}}>
                <PropFirmLanding
                  onClose={()=>setShowPropFirm(false)}
                  onGetFunded={()=>{setShowPropFirm(false);setShowPropPurchase(true);}}
                  onOpenChallenge={()=>{setShowPropFirm(false);(propAccounts||[]).length>1?setShowPropAccounts(true):propAccount?.funded?setShowPropFunded(true):setShowPropChallenge(true);}}
                  propAccount={propAccount}
                />
              </div>
            )}

            {overlay==="proppurchase" && (
              <div style={{flex:1,overflow:"hidden"}}>
                <PropPurchaseFlow
                  onClose={()=>{setShowPropPurchase(false);(propAccounts||[]).length>1?setShowPropAccounts(true):propAccount?.funded?setShowPropFunded(true):propAccount?setShowPropChallenge(true):null;}}
                  balance={balance}
                  existingCount={(propAccounts||[]).length}
                  onPurchase={(tier, noActivationAddon)=>{
                    const newId = "acc_"+(Date.now());
                    const newAcct = {
                      id: newId,
                      tierId: tier.id,
                      funded: tier.tier==="PredictDirect",
                      daysPassed: tier.tier==="PredictDirect"?0:8,
                      payouts: 0,
                      pnl: 0,
                      noActivationAddon: !!noActivationAddon,
                      isLeader: false,
                      copyEnabled: false,
                      startedAt: Date.now(),
                      status: "active",
                      bets: [],       // [{predId, pos, stake, payout, resolved, won}]
                      resolvedIds: [], // predIds already settled
                    };
                    const totalPaid = tier.price + (noActivationAddon?tier.noActivationAddon:0);
                    setPropAccounts(a=>[...(a||[]), newAcct]);
                    setActiveAccountId(newId);
                    setBalance(b=>parseFloat((b-totalPaid).toFixed(2)));
                    setToast({icon:"🎯",label:"Account Created!",desc:(tier.tier)+" "+(tier.label)+" is now live"});
                  }}
                />
              </div>
            )}

            {overlay==="propaccounts" && (
              <div style={{flex:1,overflow:"hidden"}}>
                <PropAccountsManager
                  onClose={()=>setShowPropAccounts(false)}
                  propAccounts={propAccounts}
                  onOpenAccount={(acct)=>{setActiveAccountId(acct.id);setShowPropAccounts(false);acct.funded?setShowPropFunded(true):setShowPropChallenge(true);}}
                  onAddAccount={()=>{setShowPropAccounts(false);setShowPropPurchase(true);}}
                  activeAccountId={activeAccountId}
                  onSetActiveAccount={(id)=>setActiveAccountId(id)}
                  onOpenCopyTrader={()=>{setShowPropAccounts(false);setShowPropCopyTrader(true);}}
                  onCloseAccount={(id)=>setPropAccounts(a=>(a||[]).filter(ac=>ac.id!==id))}
                />
              </div>
            )}

            {overlay==="propcopytader" && (
              <div style={{flex:1,overflow:"hidden"}}>
                <PropCopyTrader
                  onClose={()=>{ setShowPropCopyTrader(false); setTimeout(()=>setShowPropAccounts(true),0); }}
                  propAccounts={propAccounts}
                  onSetLeader={(id)=>setPropAccounts(a=>(a||[]).map(ac=>({...ac,isLeader:ac.id===id})))}
                  onToggleCopy={(id)=>setPropAccounts(a=>(a||[]).map(ac=>ac.id===id?{...ac,copyEnabled:!ac.copyEnabled}:ac))}
                />
              </div>
            )}

            {overlay==="propchallenge" && propAccount && (
              <div style={{flex:1,overflow:"hidden"}}>
                <PropChallengeDashboard
                  onClose={()=>{setShowPropChallenge(false);(propAccounts||[]).length>1&&setShowPropAccounts(true);}}
                  onAddAccount={()=>{setShowPropChallenge(false);setShowPropPurchase(true);}}
                  propAccount={propAccount}
                  votes={votes}
                  dynamicMarkets={dynamicMarkets}
                  onOpenPropLeaderboard={()=>{setShowPropChallenge(false);setShowPropLeaderboard(true);}}
                  onOpenAnalytics={()=>{setShowPropChallenge(false);setShowPropAnalytics(true);}}
                  onUpdatePropAccount={(accountId, result, bet, isSell=false) => {
                    const soldValue    = result?.soldValue ?? result;
                    const sellPct      = result?.sellPct ?? 100;
                    const sharesToSell = result?.sharesToSell ?? null;
                    const predId       = typeof bet === "object" ? bet.predId : bet;
                    const isPartial    = sellPct < 100;
                    const pnlDelta     = typeof bet === "object"
                      ? parseFloat((soldValue - bet.stake * sellPct / 100).toFixed(2))
                      : parseFloat((soldValue - (soldValue * 1.01)).toFixed(2));
                    setPropAccounts(a => (a||[]).map(ac => ac.id !== accountId ? ac : {
                      ...ac,
                      pnl: parseFloat(((ac.pnl||0) + pnlDelta).toFixed(2)),
                      resolvedIds: isPartial ? (ac.resolvedIds||[]) : [...(ac.resolvedIds||[]), predId],
                      bets: (ac.bets||[]).map(b => {
                        if (String(b.predId) !== String(predId)) return b;
                        if (isPartial) {
                          const remainPct    = (100 - sellPct) / 100;
                          const newShares    = parseFloat(((b.shares||0) * remainPct).toFixed(4));
                          const newStake     = parseFloat(((b.stake||0) * remainPct).toFixed(2));
                          return { ...b, shares: newShares, stake: newStake, partialSoldPnl: (b.partialSoldPnl||0) + pnlDelta };
                        }
                        return { ...b, resolved: true, won: pnlDelta >= 0, pnlDelta, soldEarly: isSell };
                      }),
                    }));
                  }}
                  onClaim={()=>{
                    setPropAccounts(a=>(a||[]).map(ac=>ac.id===propAccount.id?{...ac,funded:true,status:"funded",pnl:0,bets:[],resolvedIds:[],startedAt:Date.now(),payouts:0}:ac));
                    setShowPropChallenge(false);
                    setShowPropFunded(true);
                    setToast({icon:"💰",label:"Funded Account Activated!",desc:"Congrats — you're now a funded forecaster"});
                  }}
                />
              </div>
            )}

            {overlay==="propfunded" && propAccount && (
              <div style={{flex:1,overflow:"hidden"}}>
                <PropFundedDashboard
                  onClose={()=>{setShowPropFunded(false);(propAccounts||[]).length>1&&setShowPropAccounts(true);}}
                  propAccount={propAccount}
                  votes={votes}
                  onOpenAnalytics={()=>{setShowPropFunded(false);setShowPropAnalytics(true);}}
                  onBreach={()=>setShowPropBreach(true)}
                  onGraduate={()=>setShowPropGraduation(true)}
                  onPayout={(accountId, payoutAmt, prevPnl) => {
                    // Add payout amount to personal balance (their cut)
                    setBalance(b => parseFloat((b + payoutAmt).toFixed(2)));
                    // Record payout on account + reset P&L for new cycle
                    setPropAccounts(a => (a||[]).map(ac => ac.id === accountId ? {
                      ...ac,
                      payouts: (ac.payouts || 0) + 1,
                      pnl: 0,
                      bets: [],
                      resolvedIds: [],
                      startedAt: Date.now(), // reset 28-day window
                    } : ac));
                    setToast({icon:"💰", label:"Payout Processed!", desc:`$${payoutAmt.toFixed(2)} will arrive in 24h`});
                  }}
                />
                {showPropBreach && (
                  <PropBreachModal
                    onClose={()=>setShowPropBreach(false)}
                    propAccount={propAccount}
                    onReset={()=>{ setPropAccounts(a=>(a||[]).map(ac=>ac.id===propAccount.id?{...ac,funded:false,daysPassed:0,payouts:0,pnl:0}:ac)); setShowPropFunded(false); setShowPropChallenge(true); setShowPropBreach(false); }}
                  />
                )}
                {showPropGraduation && (
                  <PropGraduationModal
                    onClose={()=>setShowPropGraduation(false)}
                    propAccount={propAccount}
                  />
                )}
              </div>
            )}

            {overlay==="propleaderboard" && (
              <div style={{flex:1,overflow:"hidden"}}>
                <PropLeaderboard onClose={()=>setShowPropLeaderboard(false)}/>
              </div>
            )}

            {overlay==="propanalytics" && (
              <div style={{flex:1,overflow:"hidden"}}>
                <PropAnalytics onClose={()=>setShowPropAnalytics(false)} votes={votes} resolvedBets={resolvedBets} propAccount={propAccount}/>
              </div>
            )}

            {overlay==="parlay" && <ParlayBuilder onClose={()=>setShowParlay(false)} votes={votes} onVote={handleVote} balance={balance}/>}

            {overlay==="portfolio" && <>
              <OverlayHeader title="📈 Portfolio" onBack={()=>setShowPortfolio(false)}/>
              <div style={{flex:1,overflow:"hidden"}}><PortfolioPage votes={votes} balance={balance} resolvedBets={resolvedBets}/></div>
            </>}

            {overlay==="hottakes" && <>
              <OverlayHeader title="🔥 Hot Takes" onBack={()=>setShowHotTakes(false)}/>
              <div style={{flex:1,overflow:"hidden"}}><HotTakesPage onOpenCreator={setCreatorView} profileData={profileData}/></div>
            </>}

            {overlay==="catpage" && (
              <CategoryPage cat={catPage} onClose={()=>setCatPage(null)} votes={votes} onVote={handleVote} balance={balance} watchlist={watchlist} onToggleWatch={handleToggleWatch}/>
            )}

            {overlay==="search" && <>
              <OverlayHeader title="🔍 Search" onBack={()=>setShowSearch(false)}/>
              <div style={{flex:1,overflow:"hidden"}}><SearchPage votes={votes} onVote={handleVote} balance={balance} onOpenCreator={setCreatorView}/></div>
            </>}

            {overlay==="notifs" && <>
              <OverlayHeader title="🔔 Notifications" onBack={()=>setShowNotifs(false)}/>
              <div style={{flex:1,overflow:"hidden"}}><NotificationsPage liveNotifs={liveNotifs} onMarkRead={()=>{setLiveNotifs(n=>n.map(x=>({...x,read:true})));setNotifCount(0);}} setLiveNotifs={setLiveNotifs}/></div>
            </>}

            {overlay==="wallet" && <>
              <OverlayHeader title="💰 Wallet" onBack={()=>setShowWallet(false)}/>
              <div style={{flex:1,overflow:"hidden"}}><WalletPage balance={balance} votes={votes} resolvedBets={resolvedBets} onAddBalance={amt=>setBalance(b=>parseFloat((b+amt).toFixed(2)))}/></div>
            </>}

            {overlay==="watchlist" && (
              <div style={{flex:1,overflow:"hidden"}}><WatchlistPage watchlist={watchlist} onRemove={handleToggleWatch} votes={votes} onVote={handleVote} balance={balance} onOpenCreator={setCreatorView} onClose={()=>setShowWatchlist(false)}/></div>
            )}

            {overlay==="referral" && (
              <div style={{flex:1,overflow:"hidden"}}><ReferralPage onClose={()=>setShowReferral(false)}/></div>
            )}

            {overlay==="profileedit" && (
              <div style={{flex:1,overflow:"hidden"}}><ProfileEditor onClose={()=>setShowProfileEdit(false)} onSave={d=>setProfileData(d)}/></div>
            )}

            {/* Prop firm resolution screens */}
        {propBreachAcct && <PropBreachScreen
          acct={propBreachAcct}
          tier={PROP_TIERS.find(t=>t.id===propBreachAcct.tierId)}
          onReset={()=>{
            const tier = PROP_TIERS.find(t=>t.id===propBreachAcct.tierId);
            const fee = Math.round((tier?.price||49)*0.4);
            setBalance(b=>Math.max(0,parseFloat((b-fee).toFixed(2))));
            setPropAccounts(a=>(a||[]).map(ac=>ac.id===propBreachAcct.id
              ? {...ac, status:"active", pnl:0, bets:[], resolvedIds:[], startedAt:Date.now(), breachAt:null, resets:(ac.resets||0)+1, _warnedDrawdown:false, _warnedRebill:false}
              : ac));
            setPropBreachAcct(null);
            setToast({icon:"🔄",label:"Challenge Reset",desc:"New 28-day window started"});
          }}
          onClose={()=>{
            setPropAccounts(a=>(a||[]).filter(ac=>ac.id!==propBreachAcct.id));
            setPropBreachAcct(null);
          }}
        />}
        {propPassAcct && <PropPassScreen
          acct={propPassAcct}
          tier={PROP_TIERS.find(t=>t.id===propPassAcct.tierId)}
          onActivate={()=>{
            const tier = PROP_TIERS.find(t=>t.id===propPassAcct.tierId);
            const fee = propPassAcct.noActivationAddon ? 0 : (tier?.activationFee||149);
            if (fee > 0) setBalance(b=>Math.max(0,parseFloat((b-fee).toFixed(2))));
            setPropAccounts(a=>(a||[]).map(ac=>ac.id===propPassAcct.id
              ? {
                  ...ac,
                  funded:      true,
                  status:      "funded",
                  fundedAt:    Date.now(),
                  // Reset P&L and trade history for the funded account
                  pnl:         0,
                  bets:        [],
                  resolvedIds: [],
                  startedAt:   Date.now(),
                  payouts:     0,
                  _warnedDrawdown: false,
                  _warnedRebill:   false,
                }
              : ac));
            setPropPassAcct(null);
            setToast({icon:"🏆",label:"Account Funded!",desc:"You now trade with firm capital. Keep 80% of all profits."});
          }}
          onClose={()=>setPropPassAcct(null)}
        />}
        {propRebillAcct && <PropRebillScreen
          acct={propRebillAcct}
          tier={PROP_TIERS.find(t=>t.id===propRebillAcct.tierId)}
          onRebill={()=>{
            const tier = PROP_TIERS.find(t=>t.id===propRebillAcct.tierId);
            const rCount = propRebillAcct?.resets || 0;
            const rFee = rCount < 2 ? Math.round((tier?.price||49)*0.8) : (tier?.price||49);
            setBalance(b=>Math.max(0,parseFloat((b-rFee).toFixed(2))));
            setPropAccounts(a=>(a||[]).map(ac=>ac.id===propRebillAcct.id
              ? {...ac, status:"active", pnl:0, bets:[], resolvedIds:[], startedAt:Date.now(), rebillAt:null, resets:(ac.resets||0)+1, _warnedDrawdown:false, _warnedRebill:false}
              : ac));
            setPropRebillAcct(null);
            setToast({icon:"🔄",label:"Rebilled",desc:"Fresh 28-day challenge window started"});
          }}
          onClose={()=>{
            setPropAccounts(a=>(a||[]).filter(ac=>ac.id!==propRebillAcct.id));
            setPropRebillAcct(null);
          }}
        />}

        {overlay==="settings" && <SettingsPage onClose={()=>setShowSettings(false)} balance={balance} quickBetPresets={quickBetPresets} setQuickBetPresets={setQuickBetPresets} maxBetSetting={maxBetSetting} setMaxBetSetting={setMaxBetSetting} propAccounts={propAccounts} darkMode={darkMode} setDarkMode={setDarkMode} profileData={profileData} onSaveProfile={(data)=>setProfileData(d=>({...d,...data}))}/>}

            {overlay==="admin" && <>
              <OverlayHeader title="⚡ Admin" onBack={()=>setShowAdmin(false)}/>
              <div style={{flex:1,overflow:"hidden"}}><AdminPage votes={votes} balance={balance} resolvedBets={resolvedBets} propAccounts={propAccounts}/></div>
            </>}

            {overlay==="resolved" && <>
              <OverlayHeader title="✅ Resolved Markets" onBack={()=>setShowResolved(false)}/>
              <div style={{flex:1,overflow:"hidden"}}><ResolvedPage votes={votes} resolvedBets={resolvedBets}/></div>
            </>}

            {overlay==="creator" && (
              <div style={{flex:1,overflow:"hidden"}}>
                <CreatorProfilePage handle={creatorView} onClose={()=>setCreatorView(null)} votes={votes} onVote={handleVote} balance={balance} following={following} onFollow={handleFollow}/>
              </div>
            )}
          </div>
        )}
      </div>
    </PredictionsContext.Provider>
    </ThemeContext.Provider>
    </AppErrorBoundary>
  );
}

const GLOBAL_CSS=`
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
  body{background:#0A1628;color:#FFFFFF;font-family:'Inter',sans-serif;overflow:hidden;}
  ::-webkit-scrollbar{width:0;height:0;}
  button{transition:transform 0.12s,background 0.18s,box-shadow 0.18s,opacity 0.18s;}
  button:active{transform:scale(0.95);}
  input,textarea,select{color-scheme:dark;}
  input[type=range]{height:4px;cursor:pointer;accent-color:#3B82F6;}
  img{-webkit-user-drag:none;}
  ::placeholder{color:rgba(255,255,255,0.25);}
  @keyframes polyGlow{0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,0);}50%{box-shadow:0 0 20px 6px rgba(59,130,246,0.25);}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
  @keyframes popIn{from{transform:scale(0.3);opacity:0}to{transform:scale(1);opacity:1}}
  @keyframes slideDown{from{transform:translateX(-50%) translateY(-120%);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
  @keyframes propGlow{0%,80%,100%{box-shadow:0 0 0 0 rgba(244,196,48,0);}40%{box-shadow:0 0 18px 6px rgba(244,196,48,0.2);}}
  @keyframes flashSweep{0%{opacity:0;transform:translateX(-100%)}20%{opacity:1}80%{opacity:0.6}100%{opacity:0;transform:translateX(100%)}}
  @keyframes dangerpulse{0%{opacity:1;box-shadow:0 0 0 0 rgba(239,68,68,0.7);}50%{opacity:0.75;box-shadow:0 0 0 8px rgba(239,68,68,0);}100%{opacity:1;box-shadow:0 0 0 0 rgba(239,68,68,0);}}
  @keyframes blueGlow{0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,0);}50%{box-shadow:0 0 16px 4px rgba(59,130,246,0.3);}}
`;

const GLOBAL_CSS_LIGHT=`
  *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
  body{background:#f0f4f8;color:#0f172a;font-family:'Inter',sans-serif;overflow:hidden;}
  ::-webkit-scrollbar{width:0;height:0;}
  button{transition:transform 0.12s;}
  button:active{transform:scale(0.93);}
  input,textarea,select{color-scheme:light;}
  input[type=range]{height:4px;cursor:pointer;}
  img{-webkit-user-drag:none;}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes popIn{from{transform:scale(0.3);opacity:0}to{transform:scale(1);opacity:1}}
  @keyframes slideDown{from{transform:translateX(-50%) translateY(-120%);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
  @keyframes propGlow{0%,80%,100%{box-shadow:0 0 0 0 rgba(244,196,48,0);}40%{box-shadow:0 0 18px 6px rgba(244,196,48,0.25);}}
  @keyframes flashSweep{0%{opacity:0;transform:translateX(-100%)}20%{opacity:1}80%{opacity:0.6}100%{opacity:0;transform:translateX(100%)}}
`;
