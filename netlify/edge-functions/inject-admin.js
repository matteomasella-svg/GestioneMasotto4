export default async (req, context) => {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  const html = await response.text();
  if (html.includes('masotto_admin_crud.js')) return new Response(html, response);

  const script = '<script src="/masotto_admin_crud.js?v=20260824-1" defer></script>';
  const nextHtml = html.includes('</body>') ? html.replace('</body>', `${script}</body>`) : `${html}${script}`;
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-store');
  return new Response(nextHtml, { status: response.status, statusText: response.statusText, headers });
};

export const config = {
  path: '/*',
  excludedPath: ['/.netlify/*', '/api/*']
};
