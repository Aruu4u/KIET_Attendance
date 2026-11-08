// Handles Google OAuth callback: exchanges the auth code for tokens
// and stores the refresh token in a long-lived cookie.
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

    const refreshToken = tokenData.refresh_token;

    if (!refreshToken) {
      // If user already approved earlier, Google might only return access_token unless prompt=consent was used
      return res.status(400).send(
        'No refresh token received. Please visit /api/auth/google again or remove app access in your Google Account security settings first.',
      );
    }

    // Set cookie: HttpOnly, Path=/, Max-Age=1 year (31536000s)
    const cookieHeader = [
      `google_refresh_token=${encodeURIComponent(refreshToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000; Secure`,
      `gmail_auth_status=true; Path=/; SameSite=Lax; Max-Age=31536000; Secure`,
    ];

    res.setHeader('Set-Cookie', cookieHeader);
    res.redirect(302, '/?gmail_auth=success');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).send('Internal server error during OAuth callback.');
  }
}
