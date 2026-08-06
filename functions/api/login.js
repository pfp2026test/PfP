import { verifyPassword, createSession, sessionCookieHeader, json } from '../_lib/auth.js';

// POST /api/login  { username, password }
export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const db = env.DB;

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const username = (body.username || '').trim();
    const password = body.password || '';

    if (!username || !password) {
      return json({ error: 'Username and password are required.' }, { status: 400 });
    }

    if (!db) {
      return json({ error: 'DEBUG: env.DB is missing — the D1 binding is not reaching this function.' }, { status: 500 });
    }

    const user = await db
      .prepare('SELECT id, username, password_hash, password_salt, must_change_password FROM users WHERE username = ?')
      .bind(username)
      .first();

    if (!user) {
      return json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password_salt, user.password_hash);
    if (!valid) {
      return json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    const session = await createSession(db, user.id);

    return json(
      {
        ok: true,
        mustChangePassword: !!user.must_change_password,
      },
      {
        headers: {
          'Set-Cookie': sessionCookieHeader(session.id, session.expires),
        },
      }
    );
  } catch (err) {
    return json(
      { error: 'DEBUG CRASH: ' + (err && err.message ? err.message : String(err)), stack: err && err.stack ? String(err.stack).slice(0, 800) : null },
      { status: 500 }
    );
  }
}
