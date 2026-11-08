// Debug helper endpoint to check what the latest emails actually are
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

    // Fetch the 5 most recent messages regardless of sender/query
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const listData = await listRes.json();

    if (!listData.messages || listData.messages.length === 0) {
      return res.status(200).json({ status: 'empty_inbox', messages: [] });
    }

    const emailSummaries = [];
    for (const m of listData.messages) {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const detail = await detailRes.json();
      const headers = detail.payload?.headers || [];
      const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value || '';
      const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value || '';
      const date = headers.find((h) => h.name.toLowerCase() === 'date')?.value || '';
      emailSummaries.push({
        id: m.id,
        from,
        subject,
        date,
        snippet: detail.snippet || '',
      });
    }

    return res.status(200).json({
      status: 'debug_success',
      total_recent: emailSummaries.length,
      emails: emailSummaries,
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
