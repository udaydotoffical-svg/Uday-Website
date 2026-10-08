/* /admin: visual (WYSIWYG) markdown editor for the blog. Talks to /api/admin/* (password login, saves to data/posts.json on GitHub). */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const MD = window.MD;

  const el = {
    boot: $('#boot'), setup: $('#setup'), missing: $('#setup-missing'), login: $('#login'), app: $('#app'), logout: $('#logout'),
    loginForm: $('#login-form'), pw: $('#pw'), loginBtn: $('#login-btn'), loginStatus: $('#login-status'),
    list: $('#post-list'), newPost: $('#new-post'),
    title: $('#f-title'), id: $('#f-id'), idHint: $('#f-id-hint'), date: $('#f-date'), tags: $('#f-tags'), sum: $('#f-sum'), sumCount: $('#sum-count'),
    editor: $('#editor'), raw: $('#raw'), mode: $('#mode'),
    save: $('#save'), del: $('#delete'), status: $('#save-status'), count: $('#read-count'),
  };

  const state = { items: [], isNew: true, rawMode: false, dirty: false, slugTouched: false };

  /* ---------- api ---------- */

  async function api(method, path, body) {
    const r = await fetch('/api/admin/' + path, {
      method,
      credentials: 'same-origin',
      headers: { 'X-Admin-Request': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try {
      data = await r.json();
    } catch (e) {}
    return { status: r.status, ok: r.ok, data };
  }

  const show = (which) => {
    el.boot.hidden = which !== 'boot';
    el.setup.hidden = which !== 'setup';
    el.login.hidden = which !== 'login';
    el.app.hidden = which !== 'app';
    el.logout.hidden = which !== 'app';
  };
  const say = (node, kind, msg) => {
    node.className = 'status' + (kind ? ' ' + kind : '');
    node.textContent = msg || '';
  };

  /* ---------- markdown <-> editor ---------- */

  const escText = (t) => t.replace(/([\\`*\[\]])/g, '\\$1');
  const escLineStart = (line) => line.replace(/^(#{1,3})(\s)/, '\\$1$2').replace(/^>/, '\\>').replace(/^-(\s|-)/, '\\-$1').replace(/^(\d+)\.(\s)/, '$1\\.$2');
  const wrap = (mark, inner) => {
    const m = inner.match(/^(\s*)([\s\S]*?)(\s*)$/);
    return m[2] ? m[1] + mark + m[2] + mark + m[3] : inner;
  };
  const SAFE_HREF = /^(https?:\/\/|mailto:|#|\/(?!\/))/i;

  function inlineMd(node) {
    let out = '';
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) return void (out += escText(n.nodeValue.replace(/\u00a0/g, ' ')));
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === 'BR') out += '\n';
      else if (tag === 'STRONG' || tag === 'B') out += wrap('**', inlineMd(n));
      else if (tag === 'EM' || tag === 'I') out += wrap('*', inlineMd(n));
      else if (tag === 'CODE') out += n.textContent ? '`' + n.textContent.replace(/`/g, "'") + '`' : '';
      else if (tag === 'A') {
        const href = n.getAttribute('href') || '';
        const inner = inlineMd(n);
        out += SAFE_HREF.test(href) && inner.trim() ? '[' + inner + '](' + href.replace(/\)/g, '%29').replace(/\s/g, '%20') + ')' : inner;
      } else out += inlineMd(n);
    });
    return out;
  }

  function preText(node) {
    let t = '';
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) t += n.nodeValue;
      else if (n.tagName === 'BR') t += '\n';
      else {
        const inner = preText(n);
        t += (/^(DIV|P)$/.test(n.tagName) && t && !t.endsWith('\n') ? '\n' : '') + inner;
      }
    });
    return t;
  }

  const BLOCK = /^(P|DIV|H[1-6]|BLOCKQUOTE|PRE|UL|OL|HR)$/;

  function toMarkdown(root) {
    const blocks = [];
    let run = null; // inline nodes that sit directly in the editor, joined as one paragraph
    const flushRun = () => {
      if (!run) return;
      const tmp = document.createElement('div');
      run.forEach((n) => tmp.appendChild(n.cloneNode(true)));
      const t = inlineMd(tmp).trim();
      if (t) blocks.push(t.split('\n').map(escLineStart).join('\n'));
      run = null;
    };
    const walk = (parent) => {
      parent.childNodes.forEach((n) => {
        if (n.nodeType === 3 || (n.nodeType === 1 && !BLOCK.test(n.tagName))) return void (run = (run || []).concat(n));
        if (n.nodeType !== 1) return;
        flushRun();
        const tag = n.tagName;
        if (tag === 'DIV' || tag === 'P') {
          if ([...n.children].some((c) => BLOCK.test(c.tagName))) return walk(n);
          const t = inlineMd(n).trim();
          if (t) blocks.push(t.split('\n').map(escLineStart).join('\n'));
        } else if (/^H[1-6]$/.test(tag)) {
          const t = inlineMd(n).replace(/\n+/g, ' ').trim();
          if (t) blocks.push((+tag[1] <= 3 ? '## ' : '### ') + t);
        } else if (tag === 'BLOCKQUOTE') {
          const t = inlineMd(n).trim();
          if (t) blocks.push(t.split('\n').map((l) => '> ' + l).join('\n'));
        } else if (tag === 'PRE') {
          blocks.push('```\n' + preText(n).replace(/\n+$/, '') + '\n```');
        } else if (tag === 'UL' || tag === 'OL') {
          const lines = [...n.children]
            .filter((c) => c.tagName === 'LI')
            .map((c, i) => (tag === 'OL' ? i + 1 + '. ' : '- ') + inlineMd(c).replace(/\n+/g, ' ').trim())
            .filter((l) => /\S/.test(l.replace(/^(-|\d+\.)\s*/, '')));
          if (lines.length) blocks.push(lines.join('\n'));
        } else if (tag === 'HR') blocks.push('---');
      });
      flushRun();
    };
    walk(root);
    return blocks.join('\n\n');
  }

  const getBody = () => (state.rawMode ? el.raw.value.replace(/\r\n?/g, '\n').trim() : toMarkdown(el.editor));
  const setBody = (md) => {
    el.editor.innerHTML = MD.render(md);
    el.raw.value = md;
  };

  /* ---------- toolbar ---------- */

  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}

  const blockOf = () => {
    const s = getSelection();
    let n = s && s.anchorNode;
    while (n && n !== el.editor) {
      if (n.nodeType === 1 && /^(H[1-6]|BLOCKQUOTE|PRE|P|DIV|LI)$/.test(n.tagName)) return n;
      n = n.parentNode;
    }
    return null;
  };
  const inside = (tag) => {
    const s = getSelection();
    let n = s && s.anchorNode;
    while (n && n !== el.editor) {
      if (n.nodeType === 1 && n.tagName === tag) return n;
      n = n.parentNode;
    }
    return null;
  };
  const toggleBlock = (tag) => {
    const b = blockOf();
    document.execCommand('formatBlock', false, b && b.tagName.toLowerCase() === tag ? 'p' : tag);
  };

  function inlineCode() {
    const c = inside('CODE');
    if (c) {
      c.replaceWith(document.createTextNode(c.textContent));
      return;
    }
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return;
    const code = document.createElement('code');
    code.textContent = sel.toString();
    document.execCommand('insertHTML', false, code.outerHTML);
  }

  function link() {
    const a = inside('A');
    const url = window.prompt('Link address (https://…). Leave empty to remove the link.', a ? a.getAttribute('href') : 'https://');
    if (url === null) return;
    const u = url.trim();
    if (!u || u === 'https://') return void document.execCommand('unlink');
    if (!SAFE_HREF.test(u)) return void say(el.status, 'err', 'Links must start with https://, mailto: or #.');
    if (getSelection().isCollapsed && !a) document.execCommand('insertHTML', false, `<a href="${MD.esc(u)}">${MD.esc(u)}</a>`);
    else document.execCommand('createLink', false, u);
  }

  const COMMANDS = {
    h3: () => toggleBlock('h3'),
    h4: () => toggleBlock('h4'),
    quote: () => toggleBlock('blockquote'),
    pre: () => toggleBlock('pre'),
    bold: () => document.execCommand('bold'),
    italic: () => document.execCommand('italic'),
    code: inlineCode,
    link,
    ul: () => document.execCommand('insertUnorderedList'),
    ol: () => document.execCommand('insertOrderedList'),
    hr: () => document.execCommand('insertHorizontalRule'),
  };

  $('.ad-toolbar').addEventListener('mousedown', (e) => e.target.closest('.tb[data-cmd]') && e.preventDefault()); // keep the text selection
  $('.ad-toolbar').addEventListener('click', (e) => {
    const b = e.target.closest('.tb[data-cmd]');
    if (!b || state.rawMode) return;
    el.editor.focus();
    COMMANDS[b.dataset.cmd]();
    touch();
  });

  el.editor.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    const cmd = { b: 'bold', i: 'italic', k: 'link' }[k];
    if (!cmd) return;
    e.preventDefault();
    COMMANDS[cmd]();
    touch();
  });

  // Enter on an empty line inside a quote or code block leaves it (like most editors)
  el.editor.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return;
    const q = inside('BLOCKQUOTE') || inside('PRE');
    const sel = getSelection();
    if (!q || !sel.rangeCount || !sel.isCollapsed) return;
    const line = blockOf();
    let empty;
    if (q.tagName === 'PRE') {
      const r = sel.getRangeAt(0).cloneRange();
      r.selectNodeContents(q);
      r.setEnd(sel.anchorNode, sel.anchorOffset);
      empty = /\n$/.test(r.toString()) && q.textContent.slice(r.toString().length).replace(/\n/g, '') === '';
      if (empty) q.textContent = q.textContent.replace(/\n+$/, '');
    } else {
      empty = line && line !== q && !line.textContent.trim();
      if (!empty && line === q) empty = !q.textContent.trim();
      if (empty && line !== q) line.remove();
    }
    if (!empty) return;
    e.preventDefault();
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    if (q.textContent.trim() === '' && q.tagName === 'BLOCKQUOTE') q.replaceWith(p);
    else q.after(p);
    const range = document.createRange();
    range.setStart(p, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    touch();
  });

  // paste as plain text so no outside styles sneak in
  el.editor.addEventListener('paste', (e) => {
    e.preventDefault();
    const t = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, t);
  });
  el.editor.addEventListener('drop', (e) => e.preventDefault());

  el.mode.addEventListener('click', () => {
    if (state.rawMode) {
      el.editor.innerHTML = MD.render(el.raw.value);
    } else {
      el.raw.value = toMarkdown(el.editor);
    }
    state.rawMode = !state.rawMode;
    el.editor.hidden = state.rawMode;
    el.raw.hidden = !state.rawMode;
    el.mode.setAttribute('aria-pressed', String(state.rawMode));
    el.mode.textContent = state.rawMode ? 'Visual' : 'Markdown';
    $$('.tb[data-cmd]').forEach((b) => (b.disabled = state.rawMode));
    (state.rawMode ? el.raw : el.editor).focus();
  });

  /* ---------- post form ---------- */

  const today = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const slugify = (t) => t.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

  function touch() {
    state.dirty = true;
    const w = MD.words(getBody());
    el.count.textContent = w + ' words · ' + Math.max(1, Math.round(w / 200)) + ' min read';
    el.sumCount.textContent = el.sum.value.length + '/300';
  }

  function loadPost(p) {
    state.isNew = !p;
    state.slugTouched = !!p;
    el.title.value = p ? p.title : '';
    el.id.value = p ? p.id : '';
    el.id.readOnly = !!p;
    el.idHint.textContent = p ? 'fixed, it is the post address' : 'made from the title';
    el.date.value = p ? p.date : today();
    el.tags.value = p ? (p.tags || []).join(', ') : '';
    el.sum.value = p ? p.summary : '';
    setBody(p ? p.body : '');
    if (state.rawMode) el.mode.click(); // always open in visual mode
    el.del.hidden = !p;
    say(el.status, '', '');
    state.dirty = false;
    touch();
    state.dirty = false;
    drawList();
  }

  const confirmLeave = () => !state.dirty || window.confirm('You have unsaved changes. Leave without saving?');

  function drawList() {
    const cur = state.isNew ? null : el.id.value;
    el.list.innerHTML = '';
    state.items.forEach((p) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = p.title;
      const sm = document.createElement('small');
      sm.textContent = p.date;
      b.appendChild(sm);
      if (p.id === cur) b.setAttribute('aria-current', 'true');
      b.addEventListener('click', () => confirmLeave() && loadPost(p));
      li.appendChild(b);
      el.list.appendChild(li);
    });
  }

  el.title.addEventListener('input', () => {
    if (state.isNew && !state.slugTouched) el.id.value = slugify(el.title.value);
    touch();
  });
  el.id.addEventListener('input', () => {
    state.slugTouched = true;
    el.id.value = el.id.value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    touch();
  });
  [el.date, el.tags, el.sum, el.raw].forEach((n) => n.addEventListener('input', touch));
  el.editor.addEventListener('input', touch);
  el.newPost.addEventListener('click', () => confirmLeave() && loadPost(null));
  window.addEventListener('beforeunload', (e) => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  /* ---------- save / delete ---------- */

  function expired() {
    show('login');
    say(el.loginStatus, 'err', 'Your session ended. Log in again, your text is still here.');
    el.pw.value = '';
    el.pw.focus();
  }

  el.save.addEventListener('click', async () => {
    const post = {
      id: el.id.value.trim(),
      title: el.title.value.trim(),
      date: el.date.value,
      tags: el.tags.value.split(',').map((t) => t.trim()).filter(Boolean),
      summary: el.sum.value.trim(),
      body: getBody(),
    };
    el.save.disabled = true;
    say(el.status, '', 'Saving…');
    try {
      const r = await api('POST', 'posts', { post, isNew: state.isNew });
      if (r.status === 401) return expired();
      if (!r.ok) return say(el.status, 'err', r.data.error || 'Could not save (' + r.status + ').');
      state.items = r.data.items;
      state.isNew = false;
      el.id.readOnly = true;
      el.idHint.textContent = 'fixed, it is the post address';
      el.del.hidden = false;
      state.dirty = false;
      drawList();
      say(el.status, 'ok', r.data.note || 'Saved.');
    } catch (e) {
      say(el.status, 'err', 'No connection. Your text is still here, try again.');
    } finally {
      el.save.disabled = false;
    }
  });

  el.del.addEventListener('click', async () => {
    if (state.isNew || !window.confirm('Delete "' + el.title.value + '" for good?')) return;
    el.del.disabled = true;
    try {
      const r = await api('DELETE', 'posts?id=' + encodeURIComponent(el.id.value));
      if (r.status === 401) return expired();
      if (!r.ok) return say(el.status, 'err', r.data.error || 'Could not delete.');
      state.items = r.data.items;
      state.dirty = false;
      loadPost(null);
      say(el.status, 'ok', r.data.note || 'Deleted.');
    } catch (e) {
      say(el.status, 'err', 'No connection. Try again.');
    } finally {
      el.del.disabled = false;
    }
  });

  /* ---------- login / start ---------- */

  async function enter() {
    const r = await api('GET', 'posts');
    if (r.status === 401) return expired();
    if (!r.ok) {
      show('app');
      return say(el.status, 'err', r.data.error || 'Could not load the posts.');
    }
    state.items = r.data.items;
    show('app');
    if (!el.title.value && !getBody()) loadPost(null);
    else drawList();
  }

  el.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.loginBtn.disabled = true;
    say(el.loginStatus, '', 'Checking…');
    try {
      const r = await api('POST', 'login', { password: el.pw.value });
      if (!r.ok) return say(el.loginStatus, 'err', r.data.error || 'Could not log in.');
      el.pw.value = '';
      say(el.loginStatus, '', '');
      await enter();
    } catch (err) {
      say(el.loginStatus, 'err', 'No connection. Try again.');
    } finally {
      el.loginBtn.disabled = false;
    }
  });

  el.logout.addEventListener('click', async () => {
    if (!confirmLeave()) return;
    state.dirty = false;
    await api('POST', 'logout').catch(() => {});
    location.reload();
  });

  (async function start() {
    try {
      const me = await api('GET', 'me');
      if (!me.data.configured) {
        el.missing.textContent = (me.data.missing || []).join(', ');
        return show('setup');
      }
      if (me.data.authed) return enter();
      show('login');
      el.pw.focus();
    } catch (e) {
      el.boot.hidden = false;
      el.boot.textContent = 'Could not reach the server. Open this page from the deployed site (or run it with `vercel dev`).';
    }
  })();
})();
