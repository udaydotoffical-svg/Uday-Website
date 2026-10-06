/*
 * GitHub repo stats on hover. Works on every link to a github.com/<owner>/<repo> page on the site:
 * hover (or keyboard-focus) a link and a glass popup shows stars, forks, watchers and a language bar,
 * live from the public GitHub API (no key, no tracking, cached for 10 minutes in this tab only).
 * Also drives the "live demo" panel in the repo-stats project card.
 */
(function () {
  'use strict';

  const RE = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;
  const API = 'https://api.github.com/repos/';
  const TTL = 10 * 60 * 1000;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const repoOf = (a) => {
    const m = a && a.href ? RE.exec(a.href) : null;
    return m ? m[1] + '/' + m[2] : null;
  };

  /* ---------- data (memory + sessionStorage cache, 6 s timeout) ---------- */

  const mem = new Map();
  function readCache(repo) {
    try {
      const raw = sessionStorage.getItem('gh:' + repo);
      if (!raw) return null;
      const o = JSON.parse(raw);
      return Date.now() - o.t < TTL ? o.d : null;
    } catch (e) {
      return null;
    }
  }
  async function getJSON(url) {
    const ctl = 'AbortController' in window ? new AbortController() : null;
    const timer = setTimeout(() => ctl && ctl.abort(), 6000);
    try {
      const r = await fetch(url, { headers: { Accept: 'application/vnd.github+json' }, signal: ctl ? ctl.signal : undefined });
      if (!r.ok) throw new Error(String(r.status));
      return await r.json();
    } finally {
      clearTimeout(timer);
    }
  }
  function load(repo) {
    if (mem.has(repo)) return mem.get(repo);
    const cached = readCache(repo);
    const p = cached
      ? Promise.resolve(cached)
      : Promise.all([getJSON(API + repo), getJSON(API + repo + '/languages').catch(() => ({}))]).then(([r, langs]) => {
          const d = {
            name: r.full_name,
            desc: r.description,
            stars: r.stargazers_count,
            forks: r.forks_count,
            watchers: r.subscribers_count != null ? r.subscribers_count : r.watchers_count,
            langs,
          };
          try {
            sessionStorage.setItem('gh:' + repo, JSON.stringify({ t: Date.now(), d }));
          } catch (e) {}
          return d;
        });
    mem.set(repo, p);
    p.catch(() => setTimeout(() => mem.delete(repo), 60000)); // retry a failed repo after a minute
    return p;
  }

  /* ---------- the card ---------- */

  const COLORS = ['#22e5ff', '#2f6bff', '#eaf6ff', '#8fa6cc', '#0f2a80'];
  const compact = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'm' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k' : String(n));
  const ic = (id) => `<svg class="ghp-ic" aria-hidden="true"><use href="#${id}"/></svg>`;

  function langParts(langs) {
    const entries = Object.entries(langs || {}).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    if (!total) return [];
    const top = entries.slice(0, 4).map(([name, v]) => ({ name, pct: (v / total) * 100 }));
    const rest = 100 - top.reduce((s, l) => s + l.pct, 0);
    if (rest > 0.5) top.push({ name: 'Other', pct: rest });
    return top;
  }

  function cardHTML(d) {
    const langs = langParts(d.langs);
    return `
      <div class="ghp-head">${ic('i-github')}<strong>${esc(d.name)}</strong></div>
      ${d.desc ? `<p class="ghp-desc">${esc(d.desc)}</p>` : ''}
      <ul class="ghp-stats">
        <li>${ic('i-star')}<b>${compact(d.stars)}</b><span>stars</span></li>
        <li>${ic('i-fork')}<b>${compact(d.forks)}</b><span>forks</span></li>
        <li>${ic('i-eye')}<b>${compact(d.watchers)}</b><span>watchers</span></li>
      </ul>
      ${
        langs.length
          ? `<div class="ghp-bar" aria-hidden="true">${langs.map((l, i) => `<i style="width:${l.pct.toFixed(1)}%;background:${COLORS[i]}"></i>`).join('')}</div>
             <ul class="ghp-langs">${langs.map((l, i) => `<li><i style="background:${COLORS[i]}"></i>${esc(l.name)} <span>${l.pct.toFixed(l.pct < 10 ? 1 : 0)}%</span></li>`).join('')}</ul>`
          : '<p class="ghp-desc">No language data.</p>'
      }`;
  }
  const loadingHTML = (repo) => `<div class="ghp-head">${ic('i-github')}<strong>${esc(repo)}</strong></div><div class="ghp-skel"><i></i><i></i><i></i></div>`;
  const errorHTML = (repo) => `<div class="ghp-head">${ic('i-github')}<strong>${esc(repo)}</strong></div><p class="ghp-desc">Couldn't reach GitHub just now (rate limit or offline). Open the link to see it there.</p>`;

  /* ---------- floating popup ---------- */

  const pop = document.createElement('div');
  pop.className = 'ghp glass';
  pop.setAttribute('role', 'tooltip');
  pop.id = 'gh-pop';
  pop.hidden = true;
  document.body.appendChild(pop);

  let current = null; // { a, repo }
  let hideTimer = 0;
  let token = 0;

  function place(a) {
    const r = a.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    let x = Math.min(Math.max(12, r.left), window.innerWidth - w - 12);
    let y = r.bottom + 10;
    pop.classList.remove('above');
    if (y + h > window.innerHeight - 12 && r.top - h - 10 > 12) {
      y = r.top - h - 10;
      pop.classList.add('above');
    }
    pop.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  function show(a, quiet) {
    const repo = repoOf(a);
    if (!repo) return;
    clearTimeout(hideTimer);
    if (current && current.a === a && !pop.hidden) return;
    current = { a, repo };
    const my = ++token;
    pop.innerHTML = loadingHTML(repo);
    pop.hidden = false;
    pop.classList.remove('in');
    a.setAttribute('aria-describedby', 'gh-pop');
    place(a);
    requestAnimationFrame(() => pop.classList.add('in'));
    load(repo).then(
      (d) => {
        if (my !== token) return;
        pop.innerHTML = cardHTML(d);
        place(a);
      },
      () => {
        if (my !== token) return;
        if (quiet) return hide(true); // auto-demo stays silent when GitHub can't be reached
        pop.innerHTML = errorHTML(repo);
        place(a);
      }
    );
  }
  function hide(now) {
    clearTimeout(hideTimer);
    const go = () => {
      pop.hidden = true;
      pop.classList.remove('in');
      if (current) current.a.removeAttribute('aria-describedby');
      current = null;
      token++;
    };
    if (now) go();
    else hideTimer = setTimeout(go, 140);
  }

  let userTookOver = false;
  document.addEventListener('pointerover', (e) => {
    if (!canHover || e.pointerType === 'touch') return;
    if (pop.contains(e.target)) return clearTimeout(hideTimer);
    const a = e.target.closest && e.target.closest('a');
    if (a && repoOf(a)) {
      if (a.closest('.repo-demo')) userTookOver = true;
      show(a);
    }
  });
  document.addEventListener('pointerout', (e) => {
    if (!current) return;
    const to = e.relatedTarget;
    if (to && (pop.contains(to) || current.a.contains(to))) return;
    if (e.target === current.a || current.a.contains(e.target) || pop.contains(e.target)) hide();
  });
  document.addEventListener('focusin', (e) => {
    const a = e.target.closest && e.target.closest('a');
    if (a && repoOf(a)) show(a);
  });
  document.addEventListener('focusout', (e) => {
    if (current && e.target === current.a) hide();
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && hide(true));
  window.addEventListener('scroll', () => current && !pop.hidden && place(current.a), { passive: true });
  window.addEventListener('resize', () => hide(true));

  // custom cursor label (fx.js) for repo links
  $$('a').forEach((a) => {
    if (repoOf(a) && !a.dataset.cursor) a.dataset.cursor = 'STATS';
  });

  /* ---------- the card's live demo ---------- */

  $$('.repo-demo').forEach((demo) => {
    const links = $$('.dp-list a', demo);
    const inline = $('.dp-inline', demo);
    if (!links.length) return;

    // phones / touch: no hover, so pin the first repo's stats card inside the page instead
    if (!canHover) {
      load(repoOf(links[0])).then((d) => {
        inline.innerHTML = `<div class="ghp ghp-static glass">${cardHTML(d)}</div>`;
      }, () => {});
      return;
    }
    if (reduced) return; // no auto-play; hovering still works

    let i = 0;
    let timer = 0;
    let visible = false;
    const tick = () => {
      if (userTookOver || !visible || document.hidden) return;
      show(links[i % links.length], true);
      i++;
      timer = setTimeout(() => {
        if (!userTookOver) hide(true);
        timer = setTimeout(tick, 900);
      }, 3600);
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((en) => {
        visible = en[0].isIntersecting;
        clearTimeout(timer);
        if (visible && !userTookOver) timer = setTimeout(tick, 1200);
        else if (!visible && current && current.a.closest('.repo-demo')) hide(true);
      }, { threshold: 0.5 }).observe(demo);
    }
  });
})();
