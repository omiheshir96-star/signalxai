export default async function handler(req: any, res: any) {
  const from = req.query.from || 'EUR';
  const to = req.query.to || 'USD';
  try {
    const r = await fetch(`https://api.exchangerate.host/timeseries?start_date=2024-01-01&end_date=2024-12-31&base=${from}&symbols=${to}`);
    // fallback simple latest
    const r2 = await fetch(`https://api.frankfurter.app/2023-01-01..2024-12-31?from=${from}&to=${to}`);
    let data: any;
    if (r2.ok) data = await r2.json();
    else data = { rates: { USD: 1.08 } };

    // normalize for app
    const rates: any = {};
    if (data.rates) {
      Object.keys(data.rates).forEach((d: string) => {
        rates[d] = data.rates[d];
      });
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ rates: data.rates || rates, base: from });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
