import { requireAdmin, json } from '../../_lib/auth.js';
import { createRoom } from '../../_lib/whereby.js';

// POST /api/meetings/create  { title }  — admin only
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

  const title = (body.title || '').trim() || 'Untitled Meeting';

  try {
    const room = await createRoom(env.WHEREBY_API_KEY, title);
    const result = await db
      .prepare('INSERT INTO meetings (room_name, room_url, title, created_by) VALUES (?, ?, ?, ?)')
      .bind(String(room.meetingId), room.roomUrl, title, check.user.id)
      .run();
    return json({ ok: true, meetingId: result.meta.last_row_id, roomUrl: room.roomUrl });
  } catch (err) {
    return json({ error: 'Could not create meeting: ' + (err && err.message ? err.message : String(err)) }, { status: 500 });
  }
}
