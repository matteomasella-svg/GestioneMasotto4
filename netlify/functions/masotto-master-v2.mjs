function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function env(name) {
  const value = globalThis.Netlify && Netlify.env ? Netlify.env.get(name) : undefined;
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

function repoConfig() {
  return {
    repo: 'matteomasella-svg/GestioneMasotto4',
    branch: 'main',
    masterPath: 'masotto_master_export_2026-08-20.json'
  };
}

async function githubRequest(path, options = {}) {
  const token = env('MASOTTO_GITHUB_TOKEN');
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': '2EMME-Masotto-Control-V2',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const e = new Error(`GitHub ${res.status}: ${data && data.message ? data.message : 'request failed'}`);
    e.status = res.status;
    e.details = data;
    throw e;
  }
  return data;
}

async function readMaster() {
  const { repo, branch, masterPath } = repoConfig();
  const data = await githubRequest(`/repos/${repo}/contents/${masterPath}?ref=${encodeURIComponent(branch)}`);
  const content = Buffer.from(String(data.content || '').replace(/\n/g, ''), 'base64').toString('utf8');
  return { master: JSON.parse(content), sha: data.sha };
}

async function writeMaster(master, sha, message) {
  const { repo, branch, masterPath } = repoConfig();
  master.metadata = master.metadata || {};
  master.metadata.generated_at = new Date().toISOString();
  master.metadata.last_write_via = 'Masotto Admin CRUD V2';
  const body = {
    message: message || 'Update Masotto master from Admin CRUD',
    content: Buffer.from(JSON.stringify(master, null, 2), 'utf8').toString('base64'),
    sha,
    branch
  };
  return githubRequest(`/repos/${repo}/contents/${masterPath}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function checkAdmin(req) {
  const expected = env('MASOTTO_WRITE_KEY');
  const provided = req.headers.get('x-masotto-write-key') || '';
  return Boolean(provided && provided === expected);
}

function pathParts(path) {
  if (typeof path !== 'string' || !path.trim()) throw new Error('Missing data path');
  const parts = path.split('.').filter(Boolean);
  if (!parts.length || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) throw new Error('Invalid data path');
  return parts;
}

function getAt(root, path) {
  return pathParts(path).reduce((acc, key) => (acc == null ? undefined : acc[key]), root);
}

function setAt(root, path, value) {
  const parts = pathParts(path);
  let cur = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!cur[key] || typeof cur[key] !== 'object') cur[key] = {};
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
}

function inferKeyField(record, requested) {
  if (requested && Object.prototype.hasOwnProperty.call(record || {}, requested)) return requested;
  for (const key of ['id', 'asset_id', 'booking_id', 'ticket_id', 'code', 'key']) {
    if (record && Object.prototype.hasOwnProperty.call(record, key)) return key;
  }
  return requested || 'id';
}

function normalizeRecord(record, keyField) {
  const out = { ...(record || {}) };
  if (!out[keyField]) out[keyField] = `UI-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  out.updated_at = new Date().toISOString();
  out.updated_via = 'Masotto Admin CRUD V2';
  return out;
}

function applyMutation(master, mutation) {
  const type = mutation && mutation.type;
  const path = mutation && mutation.path;
  if (!type) throw new Error('Missing mutation type');

  if (type === 'record.upsert') {
    const current = getAt(master, path);
    const rows = Array.isArray(current) ? current.slice() : [];
    const incoming = mutation.record || {};
    const keyField = inferKeyField(incoming, mutation.keyField);
    const record = normalizeRecord(incoming, keyField);
    const idx = rows.findIndex(r => String(r && r[keyField]) === String(record[keyField]));
    if (idx >= 0) rows[idx] = { ...rows[idx], ...record }; else rows.push(record);
    setAt(master, path, rows);
    return { keyField, key: record[keyField] };
  }

  if (type === 'record.delete') {
    const current = getAt(master, path);
    if (!Array.isArray(current)) throw new Error('Target section is not an array');
    const keyField = mutation.keyField || 'id';
    const key = mutation.key;
    setAt(master, path, current.filter(r => String(r && r[keyField]) !== String(key)));
    return { keyField, key };
  }

  if (type === 'object.patch') {
    const current = getAt(master, path);
    const next = { ...(current && typeof current === 'object' && !Array.isArray(current) ? current : {}), ...(mutation.patch || {}) };
    next.updated_at = new Date().toISOString();
    next.updated_via = 'Masotto Admin CRUD V2';
    setAt(master, path, next);
    return { path };
  }

  if (type === 'section.replace') {
    setAt(master, path, mutation.value);
    return { path };
  }

  throw new Error(`Unsupported mutation type: ${type}`);
}

export default async (req) => {
  try {
    if (req.method === 'GET') {
      const { master, sha } = await readMaster();
      return json({ ok: true, sha, master });
    }
    if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

    if (!checkAdmin(req)) return json({ ok: false, error: 'Chiave amministratore non valida' }, 401);

    const input = await req.json().catch(() => ({}));
    if (input.action === 'auth.check') {
      const { sha } = await readMaster();
      return json({ ok: true, authenticated: true, github_ready: true, master_sha: sha });
    }

    const { master, sha } = await readMaster();
    const changed = applyMutation(master, input.mutation || {});
    const result = await writeMaster(master, sha, input.message);
    return json({
      ok: true,
      changed,
      commit_sha: result && result.commit ? result.commit.sha : null,
      content_sha: result && result.content ? result.content.sha : null,
      updated_at: master.metadata.generated_at
    });
  } catch (err) {
    console.error('Masotto Admin CRUD V2', err);
    return json({ ok: false, error: err.message || 'Server error', details: err.details || null }, err.status || 500);
  }
};

export const config = {
  path: '/api/masotto-master'
};
