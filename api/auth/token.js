export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, code_verifier } = req.body;
  if (!code || !code_verifier) {
    return res.status(400).json({ error: 'Missing code or code_verifier' });
  }

  try {
    const response = await fetch('https://auth.x.ai/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: 'b1a00492-073a-47ea-816f-4c329264a828',
        code: code.trim(),
        code_verifier: code_verifier.trim(),
        redirect_uri: 'http://127.0.0.1:38769/callback',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error_description || data.error || 'Token exchange failed'
      });
    }

    // Return the tokens
    return res.status(200).json(data);
  } catch (err) {
    console.error('Token exchange error:', err);
    return res.status(500).json({ error: err.message });
  }
}
