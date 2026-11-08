// Initiates Google OAuth flow to authorize Gmail readonly access.
// Visit /api/auth/google in the browser to begin the one-time setup.
export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'GOOGLE_CLIENT_ID environment variable not set.' });
  }

  const redirectUri =
    process.env.REDIRECT_URI ||
    `https://${req.headers.host}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    access_type: 'offline',
    prompt: 'consent',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.redirect(302, authUrl);
}
