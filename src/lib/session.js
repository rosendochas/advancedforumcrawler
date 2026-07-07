const SESSION_COOKIE = 'session';
const ALGORITHM = { name: 'AES-GCM' };

async function getKey(secret) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', hash, ALGORITHM, false, ['encrypt', 'decrypt']);
}

function encodeBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function decodeBase64(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0)).buffer;
}

export async function encryptSession(data, secret) {
  const key = await getKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return encodeBase64(combined);
}

export async function decryptSession(encoded, secret) {
  try {
    const key = await getKey(secret);
    const combined = decodeBase64(encoded);
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch {
    return null;
  }
}

export async function getSession(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (!match) return {};
  const data = await decryptSession(match[1], env.SESSION_SECRET);
  return data || {};
}

export function setSessionCookie(sessionData, secret) {
  return encryptSession(sessionData, secret).then(encoded => {
    const maxAge = 7 * 24 * 3600;
    return `session=${encoded}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  });
}
