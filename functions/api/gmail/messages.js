import { getCookie, getSessionUser, json } from '../../_lib/auth.js';
import { refreshAccessToken, listMessages, getMessage } from '../../_lib/gmail.js';

// GET /api/gmail/messages
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const sessionId = getCookie(request, 'pfp_session');
  const user = await getSessionUser(db, sessionId);
  if (!user) return json({ error: 'Not authenticated.' }, { status: 401 });

  const conn = await db
    .prepare('SELECT pfp_email_address, access_token, refresh_token, expires_at FROM gmail_connections WHERE user_id = ?')
    .bind(user.id)
    .first();
  if (!conn) return json({ connected: false });

  let accessToken = conn.access_token;

  if (new Date(conn.expires_at) <= new Date()) {
    try {
      const refreshed = await refreshAccessToken(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, conn.refresh_token);
      accessToken = refreshed.access_token;
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await db
        .prepare('UPDATE gmail_connections SET access_token = ?, expires_at = ? WHERE user_id = ?')
        .bind(accessToken, newExpiresAt, user.id)
        .run();
    } catch (err) {
      await db.prepare('DELETE FROM gmail_connections WHERE user_id = ?').bind(user.id).run();
      return json({ connected: false, error: 'Your Gmail connection expired (this happens weekly on personal accounts). Please reconnect.' });
    }
  }

  try {
    const listData = await listMessages(accessToken, conn.pfp_email_address);
    const summaries = [];
    const items = (listData.messages || []).slice(0, 20);
    for (const m of items) {
      const full = await getMessage(accessToken, m.id);
      const headers = (full.payload && full.payload.headers) || [];
      const getHeader = function (name) {
        const h = headers.find(function (h) { return h.name.toLowerCase() === name.toLowerCase(); });
        return h ? h.value : '';
      };
      summaries.push({
        id: full.id,
        threadId: full.threadId,
        from: getHeader('From'),
        subject: getHeader('Subject'),
        date: getHeader('Date'),
        snippet: full.snippet,
      });
    }
    return json({ connected: true, address: conn.pfp_email_address, messages: summaries });
  } catch (err) {
    return json({
      connected: true,
      address: conn.pfp_email_address,
      messages: [],
      error: 'Could not load messages: ' + (err && err.message ? err.message : String(err)),
    });
  }
}
