// Robust extraction of 6-digit OTP from Gmail
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
  let text = '';
  if (payload.body?.data) {
    try {
      text += Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } catch {
      // ignore decode error
    }
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      text += ' ' + getEmailBody(part);
    }
  }
  return text;
}

export default async function handler(req, res) {
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
        message: 'Could not refresh Gmail access. Re-authorize at /api/auth/google.',
      });
    }

    const accessToken = tokenData.access_token;

    // Flexible query: matches kiet OR cybervidya OR "Login OTP"
    // Search up to 3 most recent messages so we never miss it even with slight time discrepancies
    const query = '(from:cybervidya OR "Cyber Vidya" OR "Login OTP")';

    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=3`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const searchData = await searchRes.json();

    if (!searchData.messages || searchData.messages.length === 0) {
      return res.status(404).json({ status: 'not_found', message: 'No matching OTP email found in Gmail.' });
    }

    // Iterate through the latest 3 candidate emails to find the 6-digit OTP
    for (const msgSummary of searchData.messages) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgSummary.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      const message = await msgRes.json();
      const snippet = message.snippet || '';
      const body = getEmailBody(message.payload);
      const fullText = `${snippet} ${body}`;

      // Check if message is relevant
      const isRelevant = /cyber\s*vidya|login\s*otp|kiet/i.test(fullText);
      if (isRelevant) {
        // Find 6 digit code
        const otpMatch = fullText.match(/\b(\d{6})\b/);
        if (otpMatch) {
          return res.status(200).json({ status: 'success', otp: otpMatch[1] });
        }
      }
    }

    return res.status(422).json({
      status: 'parse_error',
      message: 'Found CyberVidya email but could not locate 6-digit code.',
    });
  } catch (err) {
    console.error('get-otp error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
}
