import { CONFIG } from './config.js';

export class ForumClient {
  constructor(env) {
    this.env = env;
    this.config = CONFIG(env);
    this.baseUrl = this.config.FORUM_BASE;
    this.cookieJar = new Map();
  }

  setCookies(cookieString) {
    if (!cookieString) return;
    for (const part of cookieString.split(';')) {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue;
      this.cookieJar.set(part.slice(0, eqIdx).trim(), part.slice(eqIdx + 1).trim());
    }
  }

  getCookieString() {
    return Array.from(this.cookieJar.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  parseSetCookieHeaders(headers) {
    const cookies = headers.getSetCookie();
    if (!cookies || !cookies.length) return;
    for (const cookieStr of cookies) {
      const semiIdx = cookieStr.indexOf(';');
      const part = semiIdx === -1 ? cookieStr : cookieStr.slice(0, semiIdx);
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue;
      this.cookieJar.set(part.slice(0, eqIdx).trim(), part.slice(eqIdx + 1).trim());
    }
  }

  async fetch(path, options = {}) {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

    const cookie = this.getCookieString();
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; MecatolForos/1.0)',
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    };

    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, 3000));
      }
      try {
        let response = await fetch(url, {
          method: options.method || 'GET',
          headers,
          body: options.body,
          redirect: 'manual',
        });

        this.parseSetCookieHeaders(response.headers);

        if (response.status >= 500 && attempt < 2) {
          lastError = new Error(`Server error: ${response.status}`);
          continue;
        }

        if (response.status >= 300 && response.status < 400 && options.followRedirects !== false) {
          const location = response.headers.get('Location');
          if (location) {
            const isGetRedirect = [301, 302, 303].includes(response.status);
            const followOpts = { ...options, followRedirects: true };
            if (isGetRedirect) {
              followOpts.method = 'GET';
              delete followOpts.body;
            }
            response = await this.fetch(location, followOpts);
          }
        }

        return response;
      } catch (err) {
        lastError = err;
        if (attempt >= 2) break;
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  async get(path) {
    return this.fetch(path, { method: 'GET' });
  }

  async post(path, body) {
    return this.fetch(path, {
      method: 'POST',
      body: new URLSearchParams(body).toString(),
    });
  }
}
