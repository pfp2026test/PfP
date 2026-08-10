const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send';
const REDIRECT_URI = 'https://pfp-5kd.pages.dev/api/gmail/callback';

function buildAuthorizeUrl(clientId, state) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: GMAIL_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: state,
  });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
}

async function exchangeCodeForToken(clientId, clientSecret, code) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Token exchange failed: ' + text.slice(0, 300));
  }
  return res.json();
}

async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Token refresh failed: ' + text.slice(0, 300));
  }
  return res.json();
}

async function listMessages(accessToken, pfpAddress) {
  const q = encodeURIComponent('to:' + pfpAddress);
  const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=' + q + '&maxResults=20';
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('List messages failed: ' + text.slice(0, 300));
  }
  return res.json();
}

async function getMessage(accessToken, messageId) {
  const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/' + messageId + '?format=full';
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Get message failed: ' + text.slice(0, 300));
  }
  return res.json();
}

function base64UrlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(function (b) { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sendMessage(accessToken, opts) {
  let raw = 'From: ' + opts.fromAddress + '\r\n' +
            'To: ' + opts.to + '\r\n' +
            'Subject: ' + opts.subject + '\r\n';
  if (opts.inReplyTo) raw += 'In-Reply-To: ' + opts.inReplyTo + '\r\n';
  if (opts.references) raw += 'References: ' + opts.references + '\r\n';
  raw += 'Content-Type: text/plain; charset="UTF-8"\r\n\r\n' + opts.body;

  const payload = { raw: base64UrlEncode(raw) };
  if (opts.threadId) payload.threadId = opts.threadId;

  const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Send failed: ' + text.slice(0, 300));
  }
  return res.json();
}

export { buildAuthorizeUrl, exchangeCodeForToken, refreshAccessToken, listMessages, getMessage, sendMessage };
