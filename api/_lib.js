// Shared helpers for the /admin blog editor API (files starting with "_" are not exposed as routes).
//
// Env vars (set on Vercel -> Project -> Settings -> Environment Variables):
//   ADMIN_PASSWORD   the editor password, at least 10 characters (a long passphrase is best)
//   SESSION_SECRET   optional, random string that signs the login cookie (if empty it is derived from the password)
//   GITHUB_TOKEN     fine-grained token, ONLY this repo, permission "Contents: Read and write"
//   GITHUB_REPO      optional, "owner/name" (default udaydotoffical-svg/uday-website)
//   GITHUB_BRANCH    optional, branch the posts are committed to (default main)

const crypto = require('crypto');

const COOKIE = 'admin_session';
const SESSION_SECONDS = 8 * 60 * 60;
const POSTS_FILE = 'data/posts.json';

const cfg = () => ({
  password: process.env.ADMIN_PASSWORD || '',
  secret: process.env.SESSION_SECRET || '',
  token: process.env.GITHUB_TOKEN || '',
  repo: process.env.GITHUB_REPO || 'udaydotoffical-svg/uday-website',
  branch: process.env.GITHUB_BRANCH || 'main',
  api: process.env.GITHUB_API || 'https://api.github.com',
});

// which settings are still missing (names only, never values)
function missing() {
  const c = cfg();
  const m = [];
  if (c.password.length < 10) m.push('ADMIN_PASSWORD (at least 10 characters)');
  if (!c.token) m.push('GITHUB_TOKEN');
  return m;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.end(JSON.stringify(body));
}

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const key = () => {
  const c = cfg();
  return c.secret || sha('uday-admin-session:' + c.password);
};
const sign = (payload) => crypto.createHmac('sha256', key()).update(payload).digest('base64url');

function safeEqual(a, b) {
  const x = sha(a);
  const y = sha(b);
  return crypto.timingSafeEqual(x, y);
}

function checkPassword(input) {
  return typeof input === 'string' && input.length <= 200 && safeEqual(input, cfg().password);
}

function makeSession() {
  const payload = b64u(JSON.stringify({ exp: Date.now() + SESSION_SECONDS * 1000, n: crypto.randomBytes(8).toString('hex') }));
  return payload + '.' + sign(payload);
}

function cookieOf(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

function isAuthed(req) {
  if (missing().length) return false;
  const tok = cookieOf(req, COOKIE);
  const [payload, sig] = tok.split('.');
  if (!payload || !sig) return false;
  const want = sign(payload);
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return false;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now();
  } catch (e) {
    return false;
  }
}

const sessionCookie = (value, maxAge) =>
  `${COOKIE}=${value}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

// state-changing requests must come from this site (blocks cross-site form posts / fetches)
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.host && req.headers['x-admin-request'] === '1';
  } catch (e) {
    return false;
  }
}

function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body || '{}');
  } catch (e) {
    return {};
  }
}

// --- brute-force guard: 5 wrong passwords per IP per 15 minutes (per server instance) ---
const tries = new Map();
const WINDOW = 15 * 60 * 1000;
const ipOf = (req) => String(req.headers['x-real-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress || '?').trim();
function locked(req) {
  const t = tries.get(ipOf(req));
  return !!t && t.until > Date.now() && t.n >= 5;
}
function fail(req) {
  const ip = ipOf(req);
  const t = tries.get(ip);
  const now = Date.now();
  if (!t || t.until < now) tries.set(ip, { n: 1, until: now + WINDOW });
  else t.n++;
  if (tries.size > 500) for (const [k, v] of tries) if (v.until < now) tries.delete(k);
}
const clearFails = (req) => tries.delete(ipOf(req));

// --- GitHub contents API ---
async function gh(method, path, payload) {
  const c = cfg();
  const r = await fetch(`${c.api}/repos/${c.repo}${path}`, {
    method,
    headers: {
      Authorization: 'Bearer ' + c.token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'uday-portfolio-admin',
      ...(payload ? { 'Content-Type': 'application/json' } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  let json = null;
  try {
    json = await r.json();
  } catch (e) {}
  return { status: r.status, json };
}

async function readPosts() {
  const c = cfg();
  const r = await gh('GET', `/contents/${POSTS_FILE}?ref=${encodeURIComponent(c.branch)}`);
  if (r.status === 404) return { sha: null, items: [] };
  if (r.status !== 200) throw new Error('github read ' + r.status);
  const data = JSON.parse(Buffer.from(r.json.content, 'base64').toString('utf8'));
  return { sha: r.json.sha, items: Array.isArray(data.items) ? data.items : [] };
}

async function writePosts(items, sha, message) {
  const c = cfg();
  const content = Buffer.from(JSON.stringify({ items }, null, 2) + '\n').toString('base64');
  const r = await gh('PUT', `/contents/${POSTS_FILE}`, { message, content, branch: c.branch, ...(sha ? { sha } : {}) });
  return r.status === 200 || r.status === 201 ? { ok: true } : { ok: false, status: r.status };
}

// read -> change -> write, retrying if somebody else saved in between
async function mutatePosts(change, message) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const cur = await readPosts();
    const items = change(cur.items.slice());
    if (!items) return { error: 'nothing to change' };
    items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const w = await writePosts(items, cur.sha, message);
    if (w.ok) return { items };
    if (w.status !== 409 && w.status !== 422) throw new Error('github write ' + w.status);
  }
  throw new Error('github write conflict');
}

// --- validate what the editor sends ---
function cleanPost(p) {
  if (!p || typeof p !== 'object') return { error: 'bad post' };
  const str = (v, max) => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim() : '').slice(0, max);
  const id = str(p.id, 60);
  const title = str(p.title, 140);
  const date = str(p.date, 10);
  const summary = str(p.summary, 300);
  const bodyMd = typeof p.body === 'string' ? p.body.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim() : '';
  const tags = (Array.isArray(p.tags) ? p.tags : []).map((t) => str(t, 24)).filter(Boolean).slice(0, 8);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) return { error: 'The link name can only use lowercase letters, numbers and dashes.' };
  if (!title) return { error: 'Add a title.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return { error: 'Pick a valid date.' };
  if (!summary) return { error: 'Add a short summary for the card.' };
  if (!bodyMd) return { error: 'The post is empty.' };
  if (bodyMd.length > 60000) return { error: 'The post is too long.' };
  return { post: { id, title, date, tags, summary, body: bodyMd } };
}

module.exports = {
  COOKIE, cfg, missing, send, checkPassword, makeSession, isAuthed, sessionCookie, sameOrigin, body,
  locked, fail, clearFails, readPosts, mutatePosts, cleanPost,
};
