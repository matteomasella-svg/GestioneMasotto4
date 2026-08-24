export default async (req, context) => {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  let html = await response.text();
  const scripts = [];

  if (!html.includes('masotto_asset_manual_v1.js')) {
    scripts.push('<script src="/masotto_asset_manual_v1.js?v=20260824-1" defer></script>');
  }
  if (!html.includes('masotto_admin_crud.js')) {
    scripts.push('<script src="/masotto_admin_crud.js?v=20260824-1" defer></script>');
  }

  if (scripts.length) {
    const injection = scripts.join('');
    html = html.includes('</body>') ? html.replace('</body>', `${injection}</body>`) : `${html}${injection}`;
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-store');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
};

export const config = {
  path: '/*',
  excludedPath: ['/.netlify/*', '/api/*']
};
