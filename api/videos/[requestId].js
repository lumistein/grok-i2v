async function getAccessToken(apiKey) {
  if (apiKey.startsWith('IM')) {
    const tokenResponse = await fetch('https://auth.x.ai/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: 'b1a00492-073a-47ea-816f-4c329264a828',
        refresh_token: apiKey,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Failed to refresh OAuth token: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  }
  return apiKey;
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
    const token = await getAccessToken(apiKey);
    const response = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('Poll error:', err);
    return res.status(500).json({ error: err.message });
  }
}
