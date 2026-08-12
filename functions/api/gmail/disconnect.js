import { getCookie, getSessionUser, requireAdmin, json } from '../../_lib/auth.js';

// POST /api/gmail/disconnect
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;
  const check = await requireAdmin(db, request);
  if (check.error) return check.error;
  const user = check.user;
  if (!user.is_admin) return json({ error: 'Admin access required.' }, { status: 403 });

  await db.prepare('DELETE FROM gmail_connections WHERE user_id = ?').bind(user.id).run();
  return json({ ok: true });
}
