const express = require('express');
const path = require('path');
const app = express();
const PORT = 3456;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

async function getAccessToken(apiKey) {
  if (apiKey && apiKey.startsWith('IM')) {
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

// Proxy: POST /api/videos/generations
app.post('/api/videos/generations', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return res.status(401).json({ error: 'API key required' });

    const token = await getAccessToken(apiKey);
    const response = await fetch('https://api.x.ai/v1/videos/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Proxy: GET /api/videos/:requestId
app.get('/api/videos/:requestId', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return res.status(401).json({ error: 'API key required' });

    const token = await getAccessToken(apiKey);
    const response = await fetch(`https://api.x.ai/v1/videos/${req.params.requestId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Poll error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Proxy video download (to avoid CORS on video URLs)
app.get('/api/proxy-video', async (req, res) => {
  try {
    const videoUrl = req.query.url;
    const apiKey = req.headers['x-api-key'];
    if (!videoUrl) return res.status(400).json({ error: 'Missing url parameter' });

    const token = apiKey ? await getAccessToken(apiKey) : null;
    const response = await fetch(videoUrl, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });

    if (!response.ok) return res.status(response.status).send('Failed to fetch video');

    res.setHeader('Content-Type', response.headers.get('content-type') || 'video/mp4');
    res.setHeader('Content-Disposition', 'inline');

    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    console.error('Video proxy error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n  ✨ Grok I2V Personal Frontend`);
  console.log(`  🌐 http://localhost:${PORT}\n`);
});
