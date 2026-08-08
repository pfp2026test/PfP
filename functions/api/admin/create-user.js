import { requireAdmin, newSalt, hashPassword, generateTempPassword, json } from '../../_lib/auth.js';

// POST /api/admin/create-user  { username, isAdmin }
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

  const username = (body.username || '').trim().toLowerCase();
  const makeAdmin = !!body.isAdmin;

  if (!username || username.length < 3) {
    return json({ error: 'Username must be at least 3 characters.' }, { status: 400 });
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return json({ error: 'Username can only contain letters, numbers, dots, dashes, and underscores.' }, { status: 400 });
  }

  const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (existing) {
    return json({ error: 'That username is already taken.' }, { status: 409 });
  }

  const tempPassword = generateTempPassword();
  const salt = newSalt();
  const hash = await hashPassword(tempPassword, salt);

  const result = await db
    .prepare(
      'INSERT INTO users (username, password_hash, password_salt, must_change_password, is_admin) VALUES (?, ?, ?, 1, ?)'
    )
    .bind(username, hash, salt, makeAdmin ? 1 : 0)
    .run();

  const newUserId = result.meta.last_row_id;

  // Auto-add every new employee to the main group chat.
  const mainGroup = await db.prepare('SELECT id FROM conversations WHERE is_main_group = 1').first();
  if (mainGroup) {
    await db
      .prepare('INSERT OR IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)')
      .bind(mainGroup.id, newUserId)
      .run();
  }

  // The temporary password is only ever returned here, once. It is never stored in
  // plaintext or retrievable again — only its hash is kept.
  return json({ ok: true, username, tempPassword });
}
