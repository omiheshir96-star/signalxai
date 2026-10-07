export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const symbol = (req.query.symbol as string) || 'BTCUSDT';
  try {
    const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=100`, { cache: 'no-store' });
    if (!r.ok) throw new Error('Binance error');
    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('Empty data');
    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(500).json({ error: 'REAL API FAILED', detail: e.message });
  }
      }
