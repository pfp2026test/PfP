import { getCookie, getSessionUser } from '../../_lib/auth.js';
import { buildAuthorizeUrl } from '../../_lib/gmail.js';

// GET /api/gmail/connect?address=you@pinsforpalestine.org
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const address = (url.searchParams.get('address') || '').trim();

  const sessionId = getCookie(request, 'pfp_session');
  const user = await getSessionUser(db, sessionId);
  if (!user) {
    return Response.redirect(new URL('/employee-login.html', request.url), 302);
  }

  if (!address) {
    const mailUrl = new URL('/mail.html', request.url);
    mailUrl.searchParams.set('gmail_error', 'missing_address');
    return Response.redirect(mailUrl.toString(), 302);
  }

  const stateBytes = new Uint8Array(24);
  crypto.getRandomValues(stateBytes);
  const state = [...stateBytes].map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');

  await db
    .prepare('INSERT INTO gmail_oauth_states (state, user_id, pfp_email_address) VALUES (?, ?, ?)')
    .bind(state, user.id, address)
    .run();

  const authorizeUrl = buildAuthorizeUrl(env.GOOGLE_CLIENT_ID, state);
  return Response.redirect(authorizeUrl, 302);
}
