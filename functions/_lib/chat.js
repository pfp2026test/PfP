async function isMember(db, conversationId, userId) {
  const row = await db
    .prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?')
    .bind(conversationId, userId)
    .first();
  return !!row;
}

async function getDisplayName(db, conversationId, viewerUserId) {
  const conv = await db.prepare('SELECT id, name, is_main_group FROM conversations WHERE id = ?').bind(conversationId).first();
  if (!conv) return null;
  if (conv.is_main_group) return conv.name || 'Pins for Palestine';
  if (conv.name) return conv.name;

  const { results } = await db
    .prepare(
      'SELECT u.username FROM conversation_members cm JOIN users u ON u.id = cm.user_id WHERE cm.conversation_id = ? AND cm.user_id != ?'
    )
    .bind(conversationId, viewerUserId)
    .all();

  return results.map(r => r.username).join(', ') || 'Just you';
}

export { isMember, getDisplayName };
