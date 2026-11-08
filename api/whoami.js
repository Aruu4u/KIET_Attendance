// Get authorized user's profile email address
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

export default async function handler(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const refreshToken = cookies.google_refresh_token;

  if (!refreshToken) {
    return res.status(401).json({ status: 'unauthorized', message: 'No refresh token' });
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
      return res.status(400).json({ status: 'token_error', data: tokenData });
    }

    const accessToken = tokenData.access_token;

    // Get user profile email address
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await profileRes.json();

    return res.status(200).json({
      status: 'success',
      logged_in_as: profile.emailAddress,
      total_messages: profile.messagesTotal,
      threads_total: profile.threadsTotal,
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
