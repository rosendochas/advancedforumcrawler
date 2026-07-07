const STATIC_MAP = {
  'styles.css': 'text/css',
};

export async function handleStatic(request, env, params) {
  const filePath = params.wildcard || '';
  const contentType = STATIC_MAP[filePath];

  if (!contentType) {
    return new Response('Not Found', { status: 404 });
  }

  return new Response('', {
    headers: { 'Content-Type': contentType },
  });
}
