import { getCookie, getSessionUser, json } from '../../_lib/auth.js';
import { isMember } from '../../_lib/chat.js';

// GET /api/chat/messages?conversationId=X&afterId=Y
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const sessionId = getCookie(request, 'pfp_session');
  const user = await getSessionUser(db, sessionId);
  if (!user) return json({ error: 'Not authenticated.' }, { status: 401 });

  const url = new URL(request.url);
  const conversationId = Number(url.searchParams.get('conversationId'));
  const afterId = Number(url.searchParams.get('afterId')) || 0;

  if (!conversationId) return json({ error: 'Missing conversationId.' }, { status: 400 });

  const member = await isMember(db, conversationId, user.id);
  if (!member) return json({ error: 'Not a member of this conversation.' }, { status: 403 });

  const { results } = await db
    .prepare(
      'SELECT m.id, m.body, m.created_at, m.sender_id, u.username AS sender_username ' +
      'FROM messages m JOIN users u ON u.id = m.sender_id ' +
      'WHERE m.conversation_id = ? AND m.id > ? ' +
      'ORDER BY m.id ASC LIMIT 200'
    )
    .bind(conversationId, afterId)
    .all();

  return json({ messages: results });
}

// POST /api/chat/messages  { conversationId, body }
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;
  const sessionId = getCookie(request, 'pfp_session');
  const user = await getSessionUser(db, sessionId);
  if (!user) return json({ error: 'Not authenticated.' }, { status: 401 });

  let reqBody;
  try {
    reqBody = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const conversationId = Number(reqBody.conversationId);
  const text = (reqBody.body || '').trim();

  if (!conversationId || !text) return json({ error: 'Missing conversationId or message body.' }, { status: 400 });
  if (text.length > 4000) return json({ error: 'Message is too long.' }, { status: 400 });

  const member = await isMember(db, conversationId, user.id);
  if (!member) return json({ error: 'Not a member of this conversation.' }, { status: 403 });

  const result = await db
    .prepare('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)')
    .bind(conversationId, user.id, text)
    .run();

  return json({ ok: true, id: result.meta.last_row_id });
} 
 
