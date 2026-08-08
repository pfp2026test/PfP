import { exchangeCodeForToken, getAccessibleResources, getCurrentUser } from '../../_lib/jira.js';

// GET /api/jira/callback?code=...&state=...
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  const dashboardUrl = new URL('/tasks.html', url);

  if (errorParam || !code || !state) {
    dashboardUrl.searchParams.set('jira_error', errorParam || 'missing_code');
    return Response.redirect(dashboardUrl.toString(), 302);
  }

  const stateRow = await db.prepare('SELECT user_id FROM jira_oauth_states WHERE state = ?').bind(state).first();
  await db.prepare('DELETE FROM jira_oauth_states WHERE state = ?').bind(state).run();

  if (!stateRow) {
    dashboardUrl.searchParams.set('jira_error', 'invalid_state');
    return Response.redirect(dashboardUrl.toString(), 302);
  }

  try {
    const tokenData = await exchangeCodeForToken(env.JIRA_CLIENT_ID, env.JIRA_CLIENT_SECRET, code);
    const resources = await getAccessibleResources(tokenData.access_token);

    if (!resources || resources.length === 0) {
      dashboardUrl.searchParams.set('jira_error', 'no_sites');
      return Response.redirect(dashboardUrl.toString(), 302);
    }

    const site = resources[0];
    const me = await getCurrentUser(tokenData.access_token, site.id);
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    await db
      .prepare(
        `INSERT INTO jira_connections (user_id, cloud_id, site_name, site_url, jira_account_id, access_token, refresh_token, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           cloud_id = excluded.cloud_id,
           site_name = excluded.site_name,
           site_url = excluded.site_url,
           jira_account_id = excluded.jira_account_id,
           access_token = excluded.access_token,
           refresh_token = excluded.refresh_token,
           expires_at = excluded.expires_at`
      )
      .bind(stateRow.user_id, site.id, site.name || null, site.url || null, me.accountId, tokenData.access_token, tokenData.refresh_token, expiresAt)
      .run();

    dashboardUrl.searchParams.set('jira_connected', '1');
    return Response.redirect(dashboardUrl.toString(), 302);
  } catch (err) {
    dashboardUrl.searchParams.set('jira_error', 'connect_failed');
    return Response.redirect(dashboardUrl.toString(), 302);
  }
}
