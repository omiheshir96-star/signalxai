export default async function handler(req, res) {
  try {
    const from = req.query.from || 'EUR';
    const to = req.query.to || 'USD';
    const r = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
    const data = await r.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'forex failed' });
  }
}
