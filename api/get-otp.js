// Fetches the latest Cyber Vidya Login OTP from Gmail.
// Requires the Google refresh token to be stored in the google_refresh_token cookie.
// Optional query param: ?after=<unix_ms> to only look at emails after a specific time.

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    const value = decodeURIComponent(part.slice(idx + 1).trim());
    cookies[name] = value;
  }
  return cookies;
}

function getEmailBody(payload) {
  if (!payload) return '';
  if (payload.body?.data) {
    try {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } catch {
      return '';
    }
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = getEmailBody(part);
      if (text) return text;
    }
  }
  return '';
}

export default async function handler(req, res) {
  // Handle preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const cookies = parseCookies(req.headers.cookie);
  const refreshToken = cookies.google_refresh_token;

  if (!refreshToken) {
    return res.status(401).json({
      status: 'unauthorized',
      message: 'Gmail not authorized. Please visit /api/auth/google to authorize.',
    });
  }

  try {
    // Get a fresh access token from the stored refresh token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('Refresh token error:', tokenData);
      return res.status(401).json({
        status: 'token_error',
        message: 'Could not refresh Gmail access. Please re-authorize at /api/auth/google.',
      });
    }

    const accessToken = tokenData.access_token;

    // Build Gmail search query
    // Filter by time: only emails AFTER the timestamp provided (or last 10 minutes)
    const afterMs = req.query.after ? Number(req.query.after) : Date.now() - 10 * 60 * 1000;
    const afterSec = Math.floor(afterMs / 1000);
    const query = `from:kiet@cybervidya.net subject:"Cyber Vidya Login OTP" after:${afterSec}`;

    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=1`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const searchData = await searchRes.json();

    if (!searchData.messages || searchData.messages.length === 0) {
      return res.status(404).json({ status: 'not_found', message: 'OTP email not received yet.' });
    }

    const messageId = searchData.messages[0].id;

    // Fetch the full message
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const message = await msgRes.json();

    // Extract text from snippet + body
    const snippet = message.snippet || '';
    const body = getEmailBody(message.payload);
    const fullText = `${snippet} ${body}`;

    // Extract the 6-digit OTP
    const otpMatch = fullText.match(/\b(\d{6})\b/);

    if (!otpMatch) {
      return res.status(422).json({ status: 'parse_error', message: 'Found email but could not extract OTP.' });
    }

    return res.status(200).json({ status: 'success', otp: otpMatch[1] });
  } catch (err) {
    console.error('get-otp error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
}
