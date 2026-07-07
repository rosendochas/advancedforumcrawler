import { loginPage } from '../lib/templates.js';
import { getSession, setSessionCookie } from '../lib/session.js';
import { ForumClient } from '../lib/forum-client.js';
import { parseLoginResponse, extractLoginFormData, extractUsernameFromProfile } from '../lib/scraper.js';
import { log, error as logError } from '../lib/logger.js';

export async function handleLogin(request, env) {
  const session = await getSession(request, env);
  if (session.forumCookies && session.username) {
    return new Response(null, { status: 302, headers: { Location: '/calendar' } });
  }

  if (request.method === 'POST') {
    return handleLoginPost(request, env);
  }

  return new Response(loginPage(), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function handleLoginPost(request, env) {
  const formData = await request.formData();
  const email = formData.get('email');
  const password = formData.get('password');

  if (!email || !password) {
    return new Response(loginPage('Email y contraseña son obligatorios.'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const client = new ForumClient(env);

  try {
    const loginPageResp = await client.get('/index.php?action=login');
    const loginHtml = await loginPageResp.text();
    const hiddenFields = extractLoginFormData(loginHtml);

    log('Hidden fields found:', Object.keys(hiddenFields));

    const postData = {
      user: email,
      passwrd: password,
      cookielength: '3153600',
      ...hiddenFields,
    };

    const loginResp = await client.post('/index.php?action=login2', postData);

    log('Login response status:', loginResp.status);
    const responseHtml = await loginResp.text();

    if (loginResp.status === 403) {
      if (responseHtml.includes('Verificaci') || responseHtml.includes('sesi')) {
        return new Response(loginPage('Error de verificación de sesión. Inténtalo de nuevo.'), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      return new Response(loginPage('Error de autenticación (403). Revisa credenciales.'), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const result = parseLoginResponse(responseHtml);

    if (!result.success) {
      return new Response(loginPage('Credenciales incorrectas.'), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const cookies = client.getCookieString();

    const profileResp = await client.get('/index.php?action=profile');
    const profileHtml = await profileResp.text();
    const username = extractUsernameFromProfile(profileHtml) || 'Usuario';
    log('Forum cookies:', cookies);
    log('Username from profile:', username);

    const sessionData = { forumCookies: cookies, username };

    const cookieValue = await setSessionCookie(sessionData, env.SESSION_SECRET);
    const response = new Response(null, { status: 302, headers: { Location: '/calendar' } });
    response.headers.append('Set-Cookie', cookieValue);
    return response;
  } catch (err) {
    logError('Login error:', err);
    return new Response(loginPage('Error de conexión con el foro. Inténtalo de nuevo.'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
