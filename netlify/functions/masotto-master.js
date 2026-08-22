const MASTER_PATH = 'masotto_master_export_2026-08-20.json';
const REPO = 'matteomasella-svg/GestioneMasotto4';
const BRANCH = 'main';

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type,x-masotto-write-key',
      'access-control-allow-methods': 'GET,POST,OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

async function githubRequest(path, options = {}) {
  const token = requireEnv('MASOTTO_GITHUB_TOKEN');
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': '2EMME-Masotto-Control',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`GitHub ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function readMaster() {
  const data = await githubRequest(`/repos/${REPO}/contents/${MASTER_PATH}?ref=${encodeURIComponent(BRANCH)}`);
  const content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
  return { master: JSON.parse(content), sha: data.sha };
}

function bookingYear(booking) {
  return String((booking && booking.check_in) || '').slice(0, 4);
}

function normalizeBookingForMaster(b) {
  const out = { ...b };
  delete out.canonical_source;
  delete out.canonical_year;
  delete out.receipt_total_display_eur;
  delete out.city_tax_accounting;
  if (!out.last_night && out.check_in && out.nights) {
    const d = new Date(`${out.check_in}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + Number(out.nights) - 1);
    out.last_night = d.toISOString().slice(0, 10);
  }
  if (!out.check_out && out.check_in && out.nights) {
    const d = new Date(`${out.check_in}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + Number(out.nights));
    out.check_out = d.toISOString().slice(0, 10);
  }
  out.updated_at = new Date().toISOString();
  out.updated_via = 'Masotto Control UI';
  return out;
}

function applyMutation(master, mutation) {
  const op = mutation && mutation.op;
  const payload = mutation && mutation.payload;
  if (!op) throw new Error('Missing mutation op');

  if (op === 'booking.upsert') {
    const booking = normalizeBookingForMaster(payload || {});
    const year = bookingYear(booking);
    if (!['2025', '2026'].includes(year)) throw new Error('Booking year must be 2025 or 2026');
    const y = master.bookings && master.bookings[year];
    if (!y) throw new Error(`Missing bookings.${year}`);
    const key = year === '2025' ? 'canonical_unique_bookings' : 'records';
    y[key] = Array.isArray(y[key]) ? y[key] : [];
    const idx = y[key].findIndex(x => String(x.id) === String(booking.id));
    if (idx >= 0) y[key][idx] = { ...y[key][idx], ...booking };
    else y[key].push(booking);
    return;
  }

  if (op === 'booking.delete') {
    const id = payload && payload.id;
    ['2025', '2026'].forEach(year => {
      const y = master.bookings && master.bookings[year];
      if (!y) return;
      const key = year === '2025' ? 'canonical_unique_bookings' : 'records';
      if (Array.isArray(y[key])) y[key] = y[key].filter(x => String(x.id) !== String(id));
    });
    return;
  }

  if (op === 'asset.upsert') {
    master.assets = master.assets || {};
    master.assets.items = Array.isArray(master.assets.items) ? master.assets.items : [];
    const a = { ...(payload || {}) };
    const id = a.asset_id || a.id;
    if (!id) throw new Error('Asset id required');
    a.asset_id = id;
    delete a.id;
    a.updated_at = new Date().toISOString();
    a.updated_via = 'Masotto Control UI';
    const idx = master.assets.items.findIndex(x => String(x.asset_id || x.id) === String(id));
    if (idx >= 0) master.assets.items[idx] = { ...master.assets.items[idx], ...a };
    else master.assets.items.push(a);
    master.assets.count_total = master.assets.items.length;
    master.assets.count_movable = master.assets.items.filter(x => (x.nature || x.asset_nature) !== 'STRUCTURAL_OR_PLANT').length;
    master.assets.count_structural = master.assets.items.filter(x => (x.nature || x.asset_nature) === 'STRUCTURAL_OR_PLANT').length;
    return;
  }

  if (op === 'asset.delete') {
    const id = payload && payload.id;
    master.assets = master.assets || {};
    master.assets.items = (master.assets.items || []).filter(x => String(x.asset_id || x.id) !== String(id));
    master.assets.count_total = master.assets.items.length;
    master.assets.count_movable = master.assets.items.filter(x => (x.nature || x.asset_nature) !== 'STRUCTURAL_OR_PLANT').length;
    master.assets.count_structural = master.assets.items.filter(x => (x.nature || x.asset_nature) === 'STRUCTURAL_OR_PLANT').length;
    return;
  }

  if (op === 'finance.upsert') {
    master.finance_manual = Array.isArray(master.finance_manual) ? master.finance_manual : [];
    const row = { ...(payload || {}) };
    if (!row.id) row.id = `UI-${Date.now()}`;
    row.updated_at = new Date().toISOString();
    row.updated_via = 'Masotto Control UI';
    const idx = master.finance_manual.findIndex(x => String(x.id) === String(row.id));
    if (idx >= 0) master.finance_manual[idx] = { ...master.finance_manual[idx], ...row };
    else master.finance_manual.push(row);
    return;
  }

  if (op === 'finance.delete') {
    const id = payload && payload.id;
    master.finance_manual = (master.finance_manual || []).filter(x => String(x.id) !== String(id));
    return;
  }

  if (op === 'ticket.upsert') {
    master.tickets = Array.isArray(master.tickets) ? master.tickets : [];
    const row = { ...(payload || {}) };
    if (!row.id) row.id = Date.now();
    row.updated_at = new Date().toISOString();
    row.updated_via = 'Masotto Control UI';
    const idx = master.tickets.findIndex(x => String(x.id) === String(row.id));
    if (idx >= 0) master.tickets[idx] = { ...master.tickets[idx], ...row };
    else master.tickets.push(row);
    return;
  }

  if (op === 'ticket.delete') {
    const id = payload && payload.id;
    master.tickets = (master.tickets || []).filter(x => String(x.id) !== String(id));
    return;
  }

  throw new Error(`Unsupported mutation: ${op}`);
}

async function writeMaster(master, sha, message) {
  master.metadata = master.metadata || {};
  master.metadata.generated_at = new Date().toISOString();
  master.metadata.last_write_via = 'Masotto Control UI / Netlify Function';
  const body = {
    message: message || 'Update Masotto master from control platform',
    content: Buffer.from(JSON.stringify(master, null, 2), 'utf8').toString('base64'),
    sha,
    branch: BRANCH
  };
  return githubRequest(`/repos/${REPO}/contents/${MASTER_PATH}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

exports.handler = async function(event) {
  try {
    if (event.httpMethod === 'OPTIONS') return response(204, {});

    if (event.httpMethod === 'GET') {
      const { master, sha } = await readMaster();
      return response(200, { ok: true, sha, master });
    }

    if (event.httpMethod !== 'POST') return response(405, { ok: false, error: 'Method not allowed' });

    const expectedKey = requireEnv('MASOTTO_WRITE_KEY');
    const providedKey = event.headers['x-masotto-write-key'] || event.headers['X-Masotto-Write-Key'];
    if (!providedKey || providedKey !== expectedKey) return response(401, { ok: false, error: 'Unauthorized' });

    const input = JSON.parse(event.body || '{}');
    const { master, sha } = await readMaster();
    applyMutation(master, input.mutation || {});
    const result = await writeMaster(master, sha, input.message);
    return response(200, {
      ok: true,
      commit_sha: result.commit && result.commit.sha,
      content_sha: result.content && result.content.sha,
      updated_at: master.metadata.generated_at
    });
  } catch (err) {
    console.error(err);
    return response(err.status || 500, { ok: false, error: err.message, details: err.data || null });
  }
};
