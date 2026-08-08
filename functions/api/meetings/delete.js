import { requireAdmin, json } from '../../_lib/auth.js';
import { deleteRoom } from '../../_lib/whereby.js';

// POST /api/meetings/delete  { meetingId }  — admin only
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

  const meetingId = Number(body.meetingId);
  if (!meetingId) return json({ error: 'Missing meetingId.' }, { status: 400 });

  const meeting = await db.prepare('SELECT room_name FROM meetings WHERE id = ?').bind(meetingId).first();
  if (!meeting) return json({ error: 'Meeting not found.' }, { status: 404 });

  await deleteRoom(env.WHEREBY_API_KEY, meeting.room_name);
  await db.prepare('UPDATE meetings SET ended = 1 WHERE id = ?').bind(meetingId).run();

  return json({ ok: true });
}
