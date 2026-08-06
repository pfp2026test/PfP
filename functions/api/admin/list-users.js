import { requireAdmin, json } from '../../_lib/auth.js';

// GET /api/admin/list-users
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;

  const check = await requireAdmin(db, request);
  if (check.error) return check.error;

  const { results } = await db
    .prepare('SELECT id, username, is_admin, must_change_password, created_at FROM users ORDER BY created_at ASC')
    .all();

  return json({ users: results });
}
