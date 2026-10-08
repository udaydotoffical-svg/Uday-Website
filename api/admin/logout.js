// POST /api/admin/logout -> clears the session cookie
const L = require('../_lib');

module.exports = (req, res) => {
  if (req.method !== 'POST') return L.send(res, 405, { error: 'POST only' });
  if (!L.sameOrigin(req)) return L.send(res, 403, { error: 'Bad origin.' });
  res.setHeader('Set-Cookie', L.sessionCookie('', 0));
  L.send(res, 200, { ok: true });
};
