const express = require('express');
const path = require('path');
const app = express();
const PORT = 3456;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function getApiBaseUrl(apiKey) {
  if (apiKey && apiKey.trim().startsWith('IM')) {
    return 'https://api.grok.com';
  }
  return 'https://api.x.ai';
}

// Proxy: POST /api/videos/generations
app.post('/api/videos/generations', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return res.status(401).json({ error: 'API key required' });

    const apiBase = getApiBaseUrl(apiKey);
    const response = await fetch(`${apiBase}/v1/videos/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
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

    const apiBase = getApiBaseUrl(apiKey);
    const response = await fetch(`${apiBase}/v1/videos/${req.params.requestId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`
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

    const headers = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    const response = await fetch(videoUrl, { headers });

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
