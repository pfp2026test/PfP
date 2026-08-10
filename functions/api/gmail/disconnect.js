import { getCookie, getSessionUser, json } from '../../_lib/auth.js';

// POST /api/gmail/disconnect
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;
  const sessionId = getCookie(request, 'pfp_session');
  const user = await getSessionUser(db, sessionId);
  if (!user) return json({ error: 'Not authenticated.' }, { status: 401 });

  await db.prepare('DELETE FROM gmail_connections WHERE user_id = ?').bind(user.id).run();
  return json({ ok: true });
}
