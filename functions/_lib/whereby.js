async function createRoom(apiKey, title) {
  const endDate = new Date(Date.now() + 60 * 60 * 6 * 1000).toISOString();
  const url = 'https://api.whereby.dev/v1/meetings';
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ endDate: endDate, roomMode: 'group' }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Whereby room creation failed: ' + text.slice(0, 300));
  }
  return res.json();
}

async function deleteRoom(apiKey, meetingId) {
  const url = 'https://api.whereby.dev/v1/meetings/' + meetingId;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + apiKey },
  });
  return res.ok || res.status === 204;
}

export { createRoom, deleteRoom };
