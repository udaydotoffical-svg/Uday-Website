// Logged-in only.
//   GET    /api/admin/posts        -> { items }
//   POST   /api/admin/posts        { post, isNew } -> create / update one post (commits data/posts.json)
//   DELETE /api/admin/posts?id=x   -> delete one post
const L = require('../_lib');

module.exports = async (req, res) => {
  if (L.missing().length) return L.send(res, 503, { error: 'The editor is not set up yet.' });
  if (!L.isAuthed(req)) return L.send(res, 401, { error: 'Log in first.' });
  if (req.method !== 'GET' && !L.sameOrigin(req)) return L.send(res, 403, { error: 'Bad origin.' });

  try {
    if (req.method === 'GET') {
      const cur = await L.readPosts();
      return L.send(res, 200, { items: cur.items });
    }

    if (req.method === 'POST') {
      const { post, isNew } = L.body(req);
      const c = L.cleanPost(post);
      if (c.error) return L.send(res, 400, { error: c.error });
      let clash = false;
      const r = await L.mutatePosts((items) => {
        const i = items.findIndex((p) => p.id === c.post.id);
        if (i >= 0 && isNew) { clash = true; return null; }
        if (i >= 0) items[i] = c.post;
        else items.push(c.post);
        return items;
      }, `blog: ${isNew ? 'add' : 'edit'} "${c.post.id}"`);
      if (clash) return L.send(res, 409, { error: 'A post with that link name already exists.' });
      return L.send(res, 200, { ok: true, items: r.items, note: 'Saved. The live site updates after the next deploy (about a minute).' });
    }

    if (req.method === 'DELETE') {
      const id = String((req.query && req.query.id) || '');
      if (!/^[a-z0-9-]{1,60}$/.test(id)) return L.send(res, 400, { error: 'bad id' });
      let found = false;
      const r = await L.mutatePosts((items) => {
        const next = items.filter((p) => p.id !== id);
        found = next.length !== items.length;
        return found ? next : null;
      }, `blog: delete "${id}"`);
      if (!found) return L.send(res, 404, { error: 'No such post.' });
      return L.send(res, 200, { ok: true, items: r.items, note: 'Deleted. The live site updates after the next deploy (about a minute).' });
    }

    L.send(res, 405, { error: 'GET, POST or DELETE only' });
  } catch (e) {
    L.send(res, 502, { error: 'Could not reach GitHub. Check GITHUB_TOKEN and GITHUB_REPO on Vercel.' });
  }
};
