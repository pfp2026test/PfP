import { exchangeCodeForToken } from '../../_lib/gmail.js';

// GET /api/gmail/callback?code=...&state=...
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  const mailUrl = new URL('/mail.html', url);

  if (errorParam || !code || !state) {
    mailUrl.searchParams.set('gmail_error', errorParam || 'missing_code');
    return Response.redirect(mailUrl.toString(), 302);
  }

  const stateRow = await db
    .prepare('SELECT user_id, pfp_email_address FROM gmail_oauth_states WHERE state = ?')
    .bind(state)
    .first();
  await db.prepare('DELETE FROM gmail_oauth_states WHERE state = ?').bind(state).run();

  if (!stateRow) {
    mailUrl.searchParams.set('gmail_error', 'invalid_state');
    return Response.redirect(mailUrl.toString(), 302);
  }

  try {
    const tokenData = await exchangeCodeForToken(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, code);
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    await db
      .prepare(
        'INSERT INTO gmail_connections (user_id, pfp_email_address, access_token, refresh_token, expires_at) ' +
        'VALUES (?, ?, ?, ?, ?) ' +
        'ON CONFLICT(user_id) DO UPDATE SET ' +
        'pfp_email_address = excluded.pfp_email_address, ' +
        'access_token = excluded.access_token, ' +
        'refresh_token = excluded.refresh_token, ' +
        'expires_at = excluded.expires_at'
      )
      .bind(stateRow.user_id, stateRow.pfp_email_address, tokenData.access_token, tokenData.refresh_token, expiresAt)
      .run();

    mailUrl.searchParams.set('gmail_connected', '1');
    return Response.redirect(mailUrl.toString(), 302);
  } catch (err) {
    mailUrl.searchParams.set('gmail_error', 'connect_failed');
    return Response.redirect(mailUrl.toString(), 302);
  }
}
