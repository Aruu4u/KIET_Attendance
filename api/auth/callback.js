// Handles Google OAuth callback: exchanges the auth code for tokens
// and stores the refresh token in a long-lived cookie + delivers to localStorage
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
      return res.status(400).send(
        'No refresh token received. Please visit /api/auth/google again with prompt=consent.',
      );
    }

    // Set cookie on the domain: SameSite=None + Secure + 1 year max-age
    const cookieHeader = [
      `google_refresh_token=${encodeURIComponent(refreshToken)}; Path=/; HttpOnly; SameSite=None; Max-Age=31536000; Secure`,
      `gmail_auth_status=true; Path=/; SameSite=None; Max-Age=31536000; Secure`,
    ];

    res.setHeader('Set-Cookie', cookieHeader);

    // Render a lightweight HTML page that writes the token into localStorage and cookies
    // so mobile browsers never lose it even if third-party cookies are blocked!
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Gmail Authorized</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="background:#0f172a;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;padding:20px;">
            <div style="font-size:40px;margin-bottom:10px;">✅</div>
            <h2 style="margin:0 0 8px 0;font-size:20px;">Gmail Connected!</h2>
            <p style="color:#94a3b8;font-size:14px;margin:0;">Saving your token and heading back...</p>
          </div>
          <script>
            try {
              localStorage.setItem('google_refresh_token', ${JSON.stringify(refreshToken)});
              localStorage.setItem('gmail_authorized', 'true');
            } catch (e) {
              console.error(e);
            }
            window.location.replace('/?gmail_auth=success');
          </script>
        </body>
      </html>
    `;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).send('Internal server error during OAuth callback.');
  }
}
