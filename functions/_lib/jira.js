const JIRA_SCOPES = 'read:jira-work read:jira-user offline_access';
const REDIRECT_URI = 'https://pfp-5kd.pages.dev/api/jira/callback';

function buildAuthorizeUrl(clientId, state) {
  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: clientId,
    scope: JIRA_SCOPES,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    prompt: 'consent',
    state,
  });
  return `https://auth.atlassian.com/authorize?${params.toString()}`;
}

async function exchangeCodeForToken(clientId, clientSecret, code) {
  const res = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Token exchange failed: ' + text.slice(0, 300));
  }
  return res.json();
}

async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Token refresh failed: ' + text.slice(0, 300));
  }
  return res.json();
}

async function getAccessibleResources(accessToken) {
  const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('Could not fetch accessible resources');
  return res.json();
}

async function getCurrentUser(accessToken, cloudId) {
  const res = await fetch(``https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql?jql=${jql}&maxResults=50&fields=summary,status,priority,issuetype,updated`,`, {
    headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('Could not fetch Jira user');
  return res.json();
}

async function searchAssignedIssues(accessToken, cloudId) {
  const jql = encodeURIComponent('assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC');
  const res = await fetch(
    `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search?jql=${jql}&maxResults=50&fields=summary,status,priority,issuetype,updated`,
    { headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' } }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Issue search failed: ' + text.slice(0, 300));
  }
  return res.json();
}

export {
  JIRA_SCOPES,
  REDIRECT_URI,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  getAccessibleResources,
  getCurrentUser,
  searchAssignedIssues,
};
