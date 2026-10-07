import { useState, useEffect, useRef } from 'react';

type Signal = {
  market: string; price: number; bias: 'BUY'|'SELL'; confidence: number;
  rsi: number; ema9: number; ema21: number; reason: string;
  sl: number; tp: number; createdAt: number; expiresAt: number;
  source: 'REAL ECB'|'REAL BINANCE'; verified: boolean;
};

const TOKENS = [
  { label: 'EUR/USD', value: 'EURUSD', type: 'FOREX', base: 'EUR', quote: 'USD' },
  { label: 'GBP/USD', value: 'GBPUSD', type: 'FOREX', base: 'GBP', quote: 'USD' },
  { label: 'USD/JPY', value: 'USDJPY', type: 'FOREX', base: 'USD', quote: 'JPY' },
  { label: 'AUD/USD', value: 'AUDUSD', type: 'FOREX', base: 'AUD', quote: 'USD' },
  { label: 'BTC/USDT', value: 'BTCUSDT', type: 'CRYPTO' },
  { label: 'ETH/USDT', value: 'ETHUSDT', type: 'CRYPTO' },
  { label: 'SOL/USDT', value: 'SOLUSDT', type: 'CRYPTO' },
  { label: 'LINK/USDT', value: 'LINKUSDT', type: 'CRYPTO' },
] as const;

function calcEMA(p:number[], per:number){ const k=2/(per+1); let ema=p.slice(0,per).reduce((a,b)=>a+b,0)/per; for(let i=per;i<p.length;i++) ema=p[i]*k+ema*(1-k); return ema; }
function calcRSI(p:number[], per=14){ let g=0,l=0; for(let i=1;i<=per;i++){ const d=p[i]-p[i-1]; if(d>=0) g+=d; else l-=d; } let ag=g/per, al=l/per; for(let i=per+1;i<p.length;i++){ const d=p[i]-p[i-1]; if(d>=0){ ag=(ag*(per-1)+d)/per; al=(al*(per-1))/per; } else { ag=(ag*(per-1))/per; al=(al*(per-1)-d)/per; } } if(al===0) return 62; return 100-(100/(1+ag/al)); }

export default function App(){
  const [selected, setSelected] = useState(TOKENS[0]);
  const [signal, setSignal] = useState<Signal|null>(null);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const [botToken, setBotToken] = useState(localStorage.getItem('tg_bot_token')||'');
  const [chatId, setChatId] = useState(localStorage.getItem('tg_chat_id')||'');
  const [status, setStatus] = useState('Ready - 100% REAL ONLY - No Fake Ever');
  const [soundOn, setSoundOn] = useState(true);
  const audioRef = useRef<AudioContext|null>(null);

  useEffect(()=>{ const t=setInterval(()=>setNow(Date.now()),1000); return()=>clearInterval(t); },[]);

  const playTick=()=>{ if(!soundOn) return; try{ if(!audioRef.current) audioRef.current=new (window.AudioContext||(window as any).webkitAudioContext)(); const ctx=audioRef.current; if(ctx.state==='suspended') ctx.resume(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.frequency.value=900; g.gain.value=0.06; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime+0.07);}catch{} };
  const playAlarm=()=>{ if(!soundOn) return; try{ if(!audioRef.current) audioRef.current=new (window.AudioContext||(window as any).webkitAudioContext)(); const ctx=audioRef.current; if(ctx.state==='suspended') ctx.resume(); [0,0.2,0.4].forEach(d=>{ const o=ctx.createOscillator(); const gn=ctx.createGain(); o.frequency.value=1300; gn.gain.value=0.14; o.connect(gn); gn.connect(ctx.destination); o.start(ctx.currentTime+d); o.stop(ctx.currentTime+d+0.25); }); }catch{} };

  const remaining = signal? signal.expiresAt-now : 0;
  const isActive = remaining>0;

  useEffect(()=>{
    if(!isActive) return;
    const sec = Math.floor(remaining/1000);
    if(sec>0 && remaining%1000 < 250) playTick();
    if(remaining>0 && remaining<=1100) playAlarm();
  },[now]);

  // ✅ FIXED - 100% REAL PROXY - NO FAKE DATA EVER
  const fetchReal = async ()=>{
    if(selected.type==='CRYPTO'){
      const res = await fetch(`/api/crypto?symbol=${selected.value}`, { cache: 'no-store' });
      if(!res.ok){
        const e = await res.json().catch(()=>({}));
        throw new Error(e.error || 'REAL BINANCE FAILED - No fake given to protect poor');
      }
      const data = await res.json();
      if(!Array.isArray(data) || data.length===0) throw new Error('Empty REAL data - No signal given');
      const closes = data.map((d:any)=>parseFloat(d[4]));
      const price = closes[closes.length-1];
      return { closes, price, source:'REAL BINANCE' as const };
    }else{
      const res = await fetch(`/api/forex?from=${selected.base}&to=${selected.quote}`, { cache: 'no-store' });
      if(!res.ok) throw new Error('REAL ECB FAILED - No fake given');
      const data = await res.json();
      if(data.error) throw new Error('REAL FOREX FAILED - No fake');
      const closes = Object.values(data.rates).map((v:any)=> v[selected.quote!] as number);
      if(closes.length<20) throw new Error('Not enough REAL candles - No fake to protect users');
      const price = closes[closes.length-1];
      return { closes, price, source:'REAL ECB' as const };
    }
  };

  const runScan = async ()=>{
    if
