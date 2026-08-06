// Shared auth helpers for Pages Functions.
// Uses the Web Crypto API available in the Workers/Pages Functions runtime.

const PBKDF2_ITERATIONS = 100000;
const HASH_ALGO = 'SHA-256';
const KEY_LENGTH_BITS = 256;
const SESSION_TTL_HOURS = 12;

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function randomHex(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: fromHex(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: HASH_ALGO,
    },
    keyMaterial,
    KEY_LENGTH_BITS
  );
  return toHex(derived);
}

async function verifyPassword(password, saltHex, expectedHashHex) {
  const computed = await hashPassword(password, saltHex);
  if (computed.length !== expectedHashHex.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ expectedHashHex.charCodeAt(i);
  }
  return mismatch === 0;
}

function newSalt() {
  return randomHex(16);
}

function newSessionId() {
  return randomHex(32);
}

async function createSession(db, userId) {
  const id = newSessionId();
  const expires = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();
  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(id, userId, expires)
    .run();
  return { id, expires };
}

async function getSessionUser(db, sessionId) {
  if (!sessionId) return null;
  const row = await db
    .prepare(
      `SELECT users.id, users.username, users.must_change_password, users.is_admin, sessions.expires_at
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.id = ?`
    )
    .bind(sessionId)
    .first();
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
    return null;
  }
  return row;
}

async function requireAdmin(db, request) {
  const sessionId = getCookie(request, 'pfp_session');
  const user = await getSessionUser(db, sessionId);
  if (!user) return { error: json({ error: 'Not authenticated.' }, { status: 401 }) };
  if (!user.is_admin) return { error: json({ error: 'Admin access required.' }, { status: 403 }) };
  return { user };
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

async function destroySession(db, sessionId) {
  if (!sessionId) return;
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function sessionCookieHeader(sessionId, expiresISO) {
  const expires = new Date(expiresISO).toUTCString();
  return `pfp_session=${sessionId}; Path=/; Expires=${expires}; HttpOnly; Secure; SameSite=Strict`;
}

function clearCookieHeader() {
  return `pfp_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict`;
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}

export {
  hashPassword,
  verifyPassword,
  newSalt,
  createSession,
  getSessionUser,
  destroySession,
  getCookie,
  sessionCookieHeader,
  clearCookieHeader,
  json,
  requireAdmin,
  generateTempPassword,
};
