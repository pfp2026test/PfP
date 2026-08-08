import { getCookie, getSessionUser, json } from '../../_lib/auth.js';
import { getDisplayName } from '../../_lib/chat.js';

// GET /api/chat/conversations — list conversations the current user belongs to
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const sessionId = getCookie(request, 'pfp_session');
  const user = await getSessionUser(db, sessionId);
  if (!user) return json({ error: 'Not authenticated.' }, { status: 401 });

  const { results } = await db
    .prepare(
      'SELECT c.id, c.name, c.is_main_group, ' +
      '(SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_body, ' +
      '(SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_at ' +
      'FROM conversations c ' +
      'JOIN conversation_members cm ON cm.conversation_id = c.id ' +
      'WHERE cm.user_id = ? ' +
      'ORDER BY c.is_main_group DESC, last_at DESC'
    )
    .bind(user.id)
    .all();

  const conversations = [];
  for (const row of results) {
    const displayName = row.is_main_group
      ? (row.name || 'Pins for Palestine')
      : await getDisplayName(db, row.id, user.id);
    conversations.push({
      id: row.id,
      name: displayName,
      isMainGroup: !!row.is_main_group,
      lastMessage: row.last_body || null,
      lastAt: row.last_at || null,
    });
  }

  return json({ conversations });
}

// POST /api/chat/conversations  { memberIds: [1,2], name: "optional" }
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

  const memberIds = Array.isArray(body.memberIds) ? body.memberIds.map(Number).filter(Boolean) : [];
  const name = (body.name || '').trim() || null;

  if (memberIds.length === 0) {
    return json({ error: 'Select at least one other person.' }, { status: 400 });
  }

  const allMembers = Array.from(new Set([user.id, ...memberIds]));
  const placeholders = allMembers.map(() => '?').join(',');
  const { results: validUsers } = await db
    .prepare('SELECT id FROM users WHERE id IN (' + placeholders + ')')
    .bind(...allMembers)
    .all();

  if (validUsers.length !== allMembers.length) {
    return json({ error: 'One or more selected users do not exist.' }, { status: 400 });
  }

  const convResult = await db
    .prepare('INSERT INTO conversations (name, is_main_group, created_by) VALUES (?, 0, ?)')
    .bind(name, user.id)
    .run();
  const conversationId = convResult.meta.last_row_id;

  for (const memberId of allMembers) {
    await db.prepare('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)').bind(conversationId, memberId).run();
  }

  return json({ ok: true, conversationId });
} 
