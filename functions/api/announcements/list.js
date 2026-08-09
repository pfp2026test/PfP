import { getCookie, getSessionUser, json } from '../../_lib/auth.js';

// GET /api/announcements/list — every logged-in employee can see these
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const sessionId = getCookie(request, 'pfp_session');
  const user = await getSessionUser(db, sessionId);
  if (!user) return json({ error: 'Not authenticated.' }, { status: 401 });

  const { results } = await db
    .prepare(
      'SELECT a.id, a.title, a.body, a.pinned, a.created_at, u.username AS created_by_username ' +
      'FROM announcements a JOIN users u ON u.id = a.created_by ' +
      'ORDER BY a.pinned DESC, a.created_at DESC LIMIT 50'
    )
    .all();

  return json({ announcements: results });
}
