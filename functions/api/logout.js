import { getCookie, destroySession, clearCookieHeader, json } from '../_lib/auth.js';

// POST /api/logout
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  const sessionId = getCookie(request, 'pfp_session');
  await destroySession(db, sessionId);

  return json(
    { ok: true },
    { headers: { 'Set-Cookie': clearCookieHeader() } }
  );
} 
