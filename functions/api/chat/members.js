import { getCookie, getSessionUser, json } from '../../_lib/auth.js';

// GET /api/chat/members — list of everyone else, for the "new conversation" picker
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const sessionId = getCookie(request, 'pfp_session');
  const user = await getSessionUser(db, sessionId);
  if (!user) return json({ error: 'Not authenticated.' }, { status: 401 });

  const { results } = await db.prepare('SELECT id, username FROM users WHERE id != ? ORDER BY username ASC').bind(user.id).all();
  return json({ users: results });
} 
