import { requireAdmin, json } from '../../_lib/auth.js';

// POST /api/announcements/create  { title, body, pinned }  — admin only
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;
  const check = await requireAdmin(db, request);
  if (check.error) return check.error;

  let reqBody;
  try {
    reqBody = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const title = (reqBody.title || '').trim();
  const body = (reqBody.body || '').trim();
  const pinned = reqBody.pinned ? 1 : 0;

  if (!title || !body) {
    return json({ error: 'Title and message are both required.' }, { status: 400 });
  }
  if (title.length > 150) {
    return json({ error: 'Title is too long.' }, { status: 400 });
  }
  if (body.length > 4000) {
    return json({ error: 'Message is too long.' }, { status: 400 });
  }

  const result = await db
    .prepare('INSERT INTO announcements (title, body, pinned, created_by) VALUES (?, ?, ?, ?)')
    .bind(title, body, pinned, check.user.id)
    .run();

  return json({ ok: true, id: result.meta.last_row_id });
}
