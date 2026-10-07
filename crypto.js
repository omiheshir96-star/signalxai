export default async function handler(req, res) {
  try {
    const symbol = req.query.symbol || 'BTCUSDT';
    const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=100`);
    const data = await r.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'crypto failed' });
  }
}
