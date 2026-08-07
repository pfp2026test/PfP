import { getCookie, getSessionUser, json } from '../../_lib/auth.js';
import { refreshAccessToken, searchAssignedIssues } from '../../_lib/jira.js';

// GET /api/jira/tasks
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;

  const sessionId = getCookie(request, 'pfp_session');
  const user = await getSessionUser(db, sessionId);
  if (!user) return json({ error: 'Not authenticated.' }, { status: 401 });

  const conn = await db
    .prepare('SELECT cloud_id, site_url, access_token, refresh_token, expires_at FROM jira_connections WHERE user_id = ?')
    .bind(user.id)
    .first();

  if (!conn) {
    return json({ connected: false });
  }

  let accessToken = conn.access_token;

  if (new Date(conn.expires_at) <= new Date()) {
    try {
      const refreshed = await refreshAccessToken(env.JIRA_CLIENT_ID, env.JIRA_CLIENT_SECRET, conn.refresh_token);
      accessToken = refreshed.access_token;
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await db
        .prepare('UPDATE jira_connections SET access_token = ?, refresh_token = ?, expires_at = ? WHERE user_id = ?')
        .bind(accessToken, refreshed.refresh_token || conn.refresh_token, newExpiresAt, user.id)
        .run();
    } catch (err) {
      await db.prepare('DELETE FROM jira_connections WHERE user_id = ?').bind(user.id).run();
      return json({ connected: false, error: 'Your Jira connection expired. Please reconnect.' });
    }
  }

  try {
    const data = await searchAssignedIssues(accessToken, conn.cloud_id);
    const issues = (data.issues || []).map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status ? issue.fields.status.name : null,
      priority: issue.fields.priority ? issue.fields.priority.name : null,
      type: issue.fields.issuetype ? issue.fields.issuetype.name : null,
      updated: issue.fields.updated,
      url: conn.site_url ? `${conn.site_url}/browse/${issue.key}` : null,
    }));
    return json({ connected: true, issues });
  } catch (err) {
    return json({ connected: true, issues: [], error: 'DEBUG: ' + (err && err.message ? err.message : String(err)) });
  }  }
}
