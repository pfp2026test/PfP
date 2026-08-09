import { requireAdmin, json } from '../../_lib/auth.js';

// POST /api/announcements/delete  { announcementId }  — admin only
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;
  const check = await requireAdmin(db, request);
  if (check.error) return check.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const announcementId = Number(body.announcementId);
  if (!announcementId) return json({ error: 'Missing announcementId.' }, { status: 400 });

  await db.prepare('DELETE FROM announcements WHERE id = ?').bind(announcementId).run();
  return json({ ok: true });
}
