function getApiBaseUrl(apiKey) {
  if (apiKey && apiKey.trim().startsWith('IM')) {
    return 'https://api.grok.com';
  }
  return 'https://api.x.ai';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  const { requestId } = req.query;
  if (!requestId) {
    return res.status(400).json({ error: 'Missing requestId' });
  }

  try {
    const apiBase = getApiBaseUrl(apiKey);
    const response = await fetch(`${apiBase}/v1/videos/${requestId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
      },
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('Poll error:', err);
    return res.status(500).json({ error: err.message });
  }
}
