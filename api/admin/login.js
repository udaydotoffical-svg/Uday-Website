// POST /api/admin/login { password } -> sets the signed, httpOnly session cookie
const L = require('../_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return L.send(res, 405, { error: 'POST only' });
  if (L.missing().length) return L.send(res, 503, { error: 'The editor is not set up yet.' });
  if (!L.sameOrigin(req)) return L.send(res, 403, { error: 'Bad origin.' });
  if (L.locked(req)) return L.send(res, 429, { error: 'Too many wrong tries. Wait 15 minutes.' });

  const { password } = L.body(req);
  if (!L.checkPassword(password)) {
    L.fail(req);
    await new Promise((r) => setTimeout(r, 700)); // slow down guessing
    return L.send(res, 401, { error: 'Wrong password.' });
  }
  L.clearFails(req);
  res.setHeader('Set-Cookie', L.sessionCookie(L.makeSession(), 8 * 60 * 60));
  L.send(res, 200, { ok: true });
};
