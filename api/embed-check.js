// Vercel serverless function: can this URL be shown in an <iframe> on this site?
// GET /api/embed-check?url=https://knowura.vercel.app  ->  { embeddable, reason, xFrameOptions, frameAncestors }
//
// Only *.vercel.app hosts (plus anything listed in the EMBED_ALLOW env var, comma separated) are checked,
// so this can't be used as an open proxy.

function allowed(host) {
  const extra = (process.env.EMBED_ALLOW || '').split(',').map((s) => s.trim()).filter(Boolean);
  return host.endsWith('.vercel.app') || extra.includes(host);
}

function frameAncestorsOf(csp) {
  if (!csp) return null;
  const part = csp.split(';').map((s) => s.trim()).find((s) => s.toLowerCase().startsWith('frame-ancestors'));
  return part ? part.split(/\s+/).slice(1) : null;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.setHeader('Content-Type', 'application/json');

  let target;
  try {
    target = new URL(String((req.query && req.query.url) || ''));
  } catch (e) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'bad url' }));
  }
  if (target.protocol !== 'https:' || !allowed(target.hostname)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'host not allowed' }));
  }

  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch(target.href, { method: 'GET', redirect: 'follow', signal: ctl.signal });
    clearTimeout(t);
    if (r.body && r.body.cancel) r.body.cancel();

    const xfo = (r.headers.get('x-frame-options') || '').trim();
    const ancestors = frameAncestorsOf(r.headers.get('content-security-policy'));
    const me = req.headers['x-forwarded-host'] || req.headers.host || '';

    let embeddable = true;
    let reason = 'no blocking header';
    if (/^(deny|sameorigin)$/i.test(xfo)) {
      embeddable = false;
      reason = 'X-Frame-Options: ' + xfo;
    } else if (ancestors) {
      const ok = ancestors.some((a) => a === '*' || a === 'https:' || a === 'https://' + me || a === me);
      if (!ok) {
        embeddable = false;
        reason = 'CSP frame-ancestors ' + ancestors.join(' ');
      } else reason = 'CSP frame-ancestors allows this site';
    }
    res.end(JSON.stringify({ embeddable, reason, xFrameOptions: xfo || null, frameAncestors: ancestors }));
  } catch (e) {
    // can't tell (timeout, network): let the page try the iframe and use its own timeout
    res.end(JSON.stringify({ embeddable: true, reason: 'check failed, trying anyway' }));
  }
};
