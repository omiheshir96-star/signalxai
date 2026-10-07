export default async function handler(req: any, res: any) {
  const symbol = req.query.symbol || 'BTCUSDT';
  try {
    const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=100`);
    if (!r.ok) throw new Error('Binance failed');
    const data = await r.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed' });
  }
}
