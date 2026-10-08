// GET /api/admin/me -> { configured, missing?, authed }
const L = require('../_lib');

module.exports = (req, res) => {
  const miss = L.missing();
  if (miss.length) return L.send(res, 200, { configured: false, missing: miss, authed: false });
  L.send(res, 200, { configured: true, authed: L.isAuthed(req) });
};
