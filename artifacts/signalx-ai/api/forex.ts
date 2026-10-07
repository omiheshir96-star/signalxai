export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const from = (req.query.from as string) || 'EUR';
  const to = (req.query.to as string) || 'USD';
  try {
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 30*24*3600*1000).toISOString().split('T')[0];
    const url = `https://api.frankfurter.app/${start}..${end}?from=${from}&to=${to}`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('Forex error');
    const data = await r.json();
    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(500).json({ error: 'REAL FOREX FAILED' });
  }
}
