import { Router } from './lib/router.js';
import { handleLogin } from './handlers/login.js';
import { handleCalendar } from './handlers/calendar.js';
import { handleBookings } from './handlers/bookings.js';
import { handleReserve } from './handlers/reserve.js';
import { handleUserPosts } from './handlers/user-posts.js';
import { handleStatic } from './handlers/static.js';
import { getSession } from './lib/session.js';
import { CONFIG } from './lib/config.js';
import { setDebug, error as logError } from './lib/logger.js';

const router = new Router();

router.get('/', handleLogin);
router.post('/login', handleLogin);
router.get('/calendar', handleCalendar);
router.get('/bookings', handleBookings);
router.get('/user-posts', handleUserPosts);
router.get('/reserve', handleReserve);
router.post('/reserve', handleReserve);
router.get('/static/*', handleStatic);
router.get('/logout', async (request, env) => {
  const session = await getSession(request, env);
  if (session.forumCookies) {
    await logoutFromForum(session.forumCookies, env);
  }
  const response = new Response(null, { status: 302, headers: { Location: '/' } });
  response.headers.append('Set-Cookie', 'session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');
  return response;
});

async function logoutFromForum(cookies, env) {
  try {
    const url = `${CONFIG(env).FORUM_BASE}/index.php?action=logout`;
    await fetch(url, {
      headers: { Cookie: cookies },
      redirect: 'manual',
    });
  } catch {}
}

export default {
  async fetch(request, env) {
    setDebug(env.DEBUG === 'true' || env.DEBUG === '1');
    try {
      return await router.handle(request, env);
    } catch (err) {
      logError('Unhandled error:', err);
      return new Response('Error interno', { status: 500 });
    }
  },
};
