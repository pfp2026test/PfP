async function createRoom(apiKey, title) {
  const roomName = 'pfp-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const url = 'https://api.daily.co/v1/rooms';
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: roomName,
      properties: {
        enable_screenshare: true,
        enable_chat: true,
        start_video_off: false,
        start_audio_off: false,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 6,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Daily room creation failed: ' + text.slice(0, 300));
  }
  return res.json();
}

async function deleteRoom(apiKey, roomName) {
  const url = 'https://api.daily.co/v1/rooms/' + roomName;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + apiKey },
  });
  return res.ok;
}

export { createRoom, deleteRoom };
