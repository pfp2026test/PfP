import { getCookie, getSessionUser, json } from '../../_lib/auth.js';
import { getMessage } from '../../_lib/gmail.js';

function decodeBase64Url(data) {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function extractBody(payload) {
  if (!payload) return '';
  if (payload.body && payload.body.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    const textPart = payload.parts.find(function (p) { return p.mimeType === 'text/plain'; }) ||
                      payload.parts.find(function (p) { return p.mimeType === 'text/html'; });
    if (textPart && textPart.body && textPart.body.data) return decodeBase64Url(textPart.body.data);
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }
  return '';
}

// GET /api/gmail/message?id=...
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const sessionId = getCookie(request, 'pfp_session');
  const user = await getSessionUser(db, sessionId);
  if (!user) return json({ error: 'Not authenticated.' }, { status: 401 });

  const url = new URL(request.url);
  const messageId = url.searchParams.get('id');
  if (!messageId) return json({ error: 'Missing id.' }, { status: 400 });

  const conn = await db.prepare('SELECT access_token FROM gmail_connections WHERE user_id = ?').bind(user.id).first();
  if (!conn) return json({ error: 'Not connected.' }, { status: 400 });

  try {
    const full = await getMessage(conn.access_token, messageId);
    const headers = (full.payload && full.payload.headers) || [];
    const getHeader = function (name) {
      const h = headers.find(function (h) { return h.name.toLowerCase() === name.toLowerCase(); });
      return h ? h.value : '';
    };
    return json({
      id: full.id,
      threadId: full.threadId,
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
      messageIdHeader: getHeader('Message-ID'),
      body: extractBody(full.payload),
    });
  } catch (err) {
    return json({ error: 'Could not load message: ' + (err && err.message ? err.message : String(err)) }, { status: 500 });
  }
}
