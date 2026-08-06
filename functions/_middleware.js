import { getCookie, getSessionUser } from './_lib/auth.js';

const PROTECTED_PATHS = ['/dashboard.html', '/dashboard'];
const CHANGE_PASSWORD_PATH = '/change-password.html';
const LOGIN_PATH = '/employee-login.html';

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (!PROTECTED_PATHS.includes(path)) {
    return next();
  }

  const sessionId = getCookie(request, 'pfp_session');
  const sessionUser = await getSessionUser(env.DB, sessionId);

  if (!sessionUser) {
    return Response.redirect(new URL(LOGIN_PATH, url), 302);
  }

  if (sessionUser.must_change_password) {
    return Response.redirect(new URL(CHANGE_PASSWORD_PATH, url), 302);
  }

  // Authenticated and password is current — let the static file through.
  return next();
} 

