export class Router {
  constructor() {
    this.routes = [];
  }

  get(path, handler) {
    this.routes.push({ method: 'GET', path, handler });
  }

  post(path, handler) {
    this.routes.push({ method: 'POST', path, handler });
  }

  async handle(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    for (const route of this.routes) {
      if (route.method !== method) continue;
      const params = this.matchPath(route.path, url.pathname);
      if (params !== null) {
        return route.handler(request, env, params);
      }
    }

    return new Response('Not Found', { status: 404 });
  }

  matchPath(pattern, pathname) {
    const patternParts = pattern.split('/');
    const pathParts = pathname.split('/');

    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      if (pathname.startsWith(prefix)) {
        return { wildcard: pathname.slice(prefix.length) };
      }
      return null;
    }

    if (patternParts.length !== pathParts.length) return null;

    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }
    return params;
  }
}
