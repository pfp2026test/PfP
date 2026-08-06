import { getCookie, getSessionUser, verifyPassword, hashPassword, newSalt, json } from '../_lib/auth.js';

// POST /api/change-password  { currentPassword, newPassword }
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  const sessionId = getCookie(request, 'pfp_session');
  const sessionUser = await getSessionUser(db, sessionId);
  if (!sessionUser) {
    return json({ error: 'Your session has expired. Please log in again.' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return json({ error: 'Current and new password are required.' }, { status: 400 });
  }

  if (newPassword.length < 10) {
    return json({ error: 'New password must be at least 10 characters.' }, { status: 400 });
  }

  if (newPassword === currentPassword) {
    return json({ error: 'New password must be different from your current password.' }, { status: 400 });
  }

  const userRow = await db
    .prepare('SELECT id, password_hash, password_salt FROM users WHERE id = ?')
    .bind(sessionUser.id)
    .first();

  const currentValid = await verifyPassword(currentPassword, userRow.password_salt, userRow.password_hash);
  if (!currentValid) {
    return json({ error: 'Current password is incorrect.' }, { status: 401 });
  }

  const salt = newSalt();
  const hash = await hashPassword(newPassword, salt);

  await db
    .prepare(
      'UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0, updated_at = datetime(\'now\') WHERE id = ?'
    )
    .bind(hash, salt, sessionUser.id)
    .run();

  return json({ ok: true });
}

