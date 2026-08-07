import { getCookie, getSessionUser } from '../../_lib/auth.js';
import { buildAuthorizeUrl } from '../../_lib/jira.js';

// GET /api/jira/connect — redirects the logged-in user to Atlassian's consent screen
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;

  const sessionId = getCookie(request, 'pfp_session');
  const user = await getSessionUser(db, sessionId);
  if (!user) {
    return Response.redirect(new URL('/employee-login.html', request.url), 302);
  }

  const stateBytes = new Uint8Array(24);
  crypto.getRandomValues(stateBytes);
  const state = [...stateBytes].map(b => b.toString(16).padStart(2, '0')).join('');

  await db.prepare('INSERT INTO jira_oauth_states (state, user_id) VALUES (?, ?)').bind(state, user.id).run();

  const authorizeUrl = buildAuthorizeUrl(env.JIRA_CLIENT_ID, state);
  return Response.redirect(authorizeUrl, 302);
}
