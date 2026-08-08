import { getCookie, getSessionUser, json } from '../../_lib/auth.js';

// GET /api/meetings/list — every logged-in employee can see active meetings
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const sessionId = getCookie(request, 'pfp_session');
  const user = await getSessionUser(db, sessionId);
  if (!user) return json({ error: 'Not authenticated.' }, { status: 401 });

  const { results } = await db
    .prepare(
      'SELECT m.id, m.room_name, m.room_url, m.title, m.created_at, u.username AS created_by_username ' +
      'FROM meetings m JOIN users u ON u.id = m.created_by ' +
      'WHERE m.ended = 0 ORDER BY m.created_at DESC'
    )
    .all();

  return json({ meetings: results });
}
