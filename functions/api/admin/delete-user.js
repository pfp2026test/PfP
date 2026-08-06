import { requireAdmin, json } from '../../_lib/auth.js';

// POST /api/admin/delete-user  { userId }
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  const check = await requireAdmin(db, request);
  if (check.error) return check.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const userId = Number(body.userId);
  if (!userId) {
    return json({ error: 'Missing userId.' }, { status: 400 });
  }

  if (userId === check.user.id) {
    return json({ error: "You can't delete your own account while logged in as it." }, { status: 400 });
  }

  const target = await db.prepare('SELECT id, is_admin FROM users WHERE id = ?').bind(userId).first();
  if (!target) {
    return json({ error: 'User not found.' }, { status: 404 });
  }

  if (target.is_admin) {
    const { results } = await db.prepare('SELECT id FROM users WHERE is_admin = 1').all();
    if (results.length <= 1) {
      return json({ error: 'Cannot delete the last remaining admin account.' }, { status: 400 });
    }
  }

  await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();

  return json({ ok: true });
}
