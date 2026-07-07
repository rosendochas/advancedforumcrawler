export function CONFIG(env) {
  return {
    SESSION_SECRET: env.SESSION_SECRET,
    ROOMS: parseRooms(env.ROOMS),
    WHO: env.WHO,
    FORUM_BASE: env.FORUM_BASE,
  };
}

function parseRooms(roomsStr) {
  return roomsStr.split(';').map(entry => {
    const [name, url] = entry.split(',', 2);
    return { name: name.trim(), url: url.trim() };
  });
}
