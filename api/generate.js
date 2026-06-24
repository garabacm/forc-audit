export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  try {
    const model = await pickModel(apiKey);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        stream: false,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return res.status(502).json({ error: `Anthropic error ${response.status}`, detail: errText });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    return res.status(200).json({ text });

  } catch (err) {
    console.error('generate handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function pickModel(apiKey) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
    });
    if (!res.ok) throw new Error(`Models API ${res.status}`);
    const { data = [] } = await res.json();
    const rank = id => id.includes('haiku') ? 0 : id.includes('sonnet') ? 1 : id.includes('opus') ? 2 : 3;
    data.sort((a, b) => rank(a.id) - rank(b.id));
    if (data.length > 0) {
      console.log('Selected model:', data[0].id);
      return data[0].id;
    }
  } catch (e) {
    console.warn('pickModel error:', e.message);
  }
  return 'claude-haiku-4-5';
}
