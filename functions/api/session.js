import { getCookie, getSessionUser, json } from '../_lib/auth.js';

// GET /api/session — returns current session's user, or 401 if not logged in
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;

  const sessionId = getCookie(request, 'pfp_session');
  const sessionUser = await getSessionUser(db, sessionId);

  if (!sessionUser) {
    return json({ error: 'Not authenticated.' }, { status: 401 });
  }

  return json({
    username: sessionUser.username,
    mustChangePassword: !!sessionUser.must_change_password,
    isAdmin: !!sessionUser.is_admin,
  });
}
