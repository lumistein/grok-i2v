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

// Edge Runtime for streaming large video files without body size limits
export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url');

  if (!videoUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiKey = request.headers.get('x-api-key');
    const headers = {};
    if (apiKey) {
      const token = await getAccessToken(apiKey);
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(videoUrl, { headers });

    if (!response.ok) {
      return new Response(`Failed to fetch video: ${response.status}`, {
        status: response.status,
      });
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'video/mp4',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
