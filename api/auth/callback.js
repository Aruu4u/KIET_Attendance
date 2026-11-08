// Handles Google OAuth callback: exchanges the auth code for tokens
// and stores the refresh token in a long-lived HTTP-only cookie.
export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(`
      <html><body style="font-family:sans-serif;background:#060a1a;color:white;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center;">
          <h2>❌ OAuth Error: ${error}</h2>
          <a href="/" style="color:#cc0000;">← Back to App</a>
        </div>
      </body></html>
    `);
  }

  if (!code) {
    return res.status(400).send('No authorization code received.');
  }

  const redirectUri =
    process.env.REDIRECT_URI ||
    `https://${req.headers.host}/api/auth/callback`;

  try {
    // Exchange auth code for access + refresh tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Token exchange error:', tokenData);
      return res.status(400).send(`Token exchange failed: ${tokenData.error_description || tokenData.error}`);
    }

    if (!tokenData.refresh_token) {
      return res.status(400).send(
        'No refresh token received. Try visiting /api/auth/google again (revoke access in your Google account first if needed).',
      );
    }

    // Store refresh token in HTTP-only cookie (90 days)
    const isLocal = req.headers.host?.includes('localhost');
    const cookieParts = [
      `google_refresh_token=${encodeURIComponent(tokenData.refresh_token)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      'Max-Age=7776000', // 90 days in seconds
    ];
    if (!isLocal) cookieParts.push('Secure');

    res.setHeader('Set-Cookie', cookieParts.join('; '));

    // Redirect back to the app with a success indicator
    res.redirect(302, '/?gmail_auth=success');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).send('Internal server error during OAuth callback.');
  }
}
