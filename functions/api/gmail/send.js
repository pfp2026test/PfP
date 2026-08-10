import { getCookie, getSessionUser, json } from '../../_lib/auth.js';
import { sendMessage } from '../../_lib/gmail.js';

// POST /api/gmail/send  { to, subject, message, threadId?, inReplyTo?, references? }
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;
  const sessionId = getCookie(request, 'pfp_session');
  const user = await getSessionUser(db, sessionId);
  if (!user) return json({ error: 'Not authenticated.' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const to = (body.to || '').trim();
  const subject = (body.subject || '').trim();
  const message = body.message || '';

  if (!to || !subject || !message) {
    return json({ error: 'To, subject, and message are all required.' }, { status: 400 });
  }

  const conn = await db.prepare('SELECT pfp_email_address, access_token FROM gmail_connections WHERE user_id = ?').bind(user.id).first();
  if (!conn) return json({ error: 'Gmail not connected.' }, { status: 400 });

  try {
    const result = await sendMessage(conn.access_token, {
      fromAddress: conn.pfp_email_address,
      to: to,
      subject: subject,
      body: message,
      threadId: body.threadId,
      inReplyTo: body.inReplyTo,
      references: body.references,
    });
    return json({ ok: true, id: result.id });
  } catch (err) {
    return json({ error: 'Could not send: ' + (err && err.message ? err.message : String(err)) }, { status: 500 });
  }
}
