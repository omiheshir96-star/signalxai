export default async function handler(req: any, res: any) {
  try {
    const from = (req.query.from as string) || 'EUR';
    const to = (req.query.to as string) || 'USD';
    const r = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
    const data = await r.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'forex failed' });
  }
}
