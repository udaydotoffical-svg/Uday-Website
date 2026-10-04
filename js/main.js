/* Renders every section from window.SITE (js/content.js) and wires up the interactive bits. */
(function () {
  'use strict';

  const S = window.SITE;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const esc = (str) =>
    String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const icon = (id) => `<svg class="icon" aria-hidden="true"><use href="#${id}"/></svg>`;

  /* ---------- bind simple text/links from content ---------- */

  $$('[data-text]').forEach((el) => (el.textContent = S[el.dataset.text] || ''));
  $$('[data-link]').forEach((el) => {
    const k = el.dataset.link;
    el.href = k === 'email' ? 'mailto:' + S.links.email : S.links[k];
    el.title = k === 'instagram' ? S.links.instagramHandle : k === 'email' ? S.links.email : 'GitHub';
  });

  $('#nav-links').innerHTML = S.nav.map((n) => `<a href="${esc(n.href)}">${esc(n.label)}</a>`).join('');

  /* ---------- section renderers ---------- */

  const heading = (num, title) =>
    `<h2 class="section-title"><span class="num">${num}</span>${esc(title)}</h2>`;

  const tags = (list, cls) => list.map((t) => `<li class="tag-chip glass-light ${cls || ''}">${esc(t)}</li>`).join('');

  function renderAbout() {
    const a = S.about;
    $('#about').innerHTML = `
      <div class="wrap">
        ${heading('01', a.title)}
        <div class="glass about-card reveal">
          ${a.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}
          <ul class="tags">${tags(a.tags)}</ul>
        </div>
      </div>`;
  }

  function browserVisual(p) {
    const v = p.visual;
    const embed = v.embed
      ? `<iframe class="frame" data-src="${esc(v.url)}" title="Live preview of ${esc(p.title)}" loading="lazy"
           sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer" tabindex="-1"
           width="1280" height="800"></iframe>
         <div class="skeleton" aria-hidden="true"><span class="spinner"></span><span>loading live preview</span></div>`
      : '';
    return `
      <div class="browser" data-embed="${v.embed ? '1' : '0'}">
        <div class="browser-bar">
          <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="urlbar input-look">${esc(v.displayUrl)}</span>
        </div>
        <div class="browser-view">
          <img class="fallback" src="${esc(v.fallback)}" alt="${esc(v.alt)}" width="1280" height="800" loading="lazy" decoding="async">
          ${embed}
        </div>
        <p class="browser-note">View only. Sign-in does not work inside a frame, so use the button to open the real site.</p>
      </div>`;
  }

  function mediaVisual(p) {
    const v = p.visual;
    const inner = v.video
      ? `<video src="${esc(v.video)}" poster="${esc(v.image)}" muted loop playsinline autoplay preload="none" aria-label="${esc(v.alt)}"></video>`
      : `<img src="${esc(v.image)}" alt="${esc(v.alt)}" width="1280" height="800" loading="lazy" decoding="async">`;
    return `<div class="media glass-light">${inner}</div>`;
  }

  function renderProjects() {
    const pr = S.projects;
    $('#projects').innerHTML = `
      <div class="wrap">
        ${heading('02', pr.title)}
        <div class="project-list">
          ${pr.items
            .map(
              (p, i) => `
            <article class="project glass reveal ${i % 2 ? 'flip' : ''}" id="project-${esc(p.id)}">
              <div class="project-copy">
                <p class="kicker">${esc(p.kicker)}</p>
                <h3>${esc(p.title)}</h3>
                <p>${esc(p.description)}</p>
                <ul class="tags">${tags(p.tags)}</ul>
                <a class="btn" href="${esc(p.link.href)}" target="_blank" rel="noopener">${esc(p.link.label)} ${icon('i-arrow')}</a>
              </div>
              <div class="project-visual">${p.visual.type === 'browser' ? browserVisual(p) : mediaVisual(p)}</div>
            </article>`
            )
            .join('')}
        </div>
      </div>`;
  }

  function renderTimeline() {
    const t = S.timeline;
    $('#timeline').innerHTML = `
      <div class="wrap">
        ${heading('03', t.title)}
        <ol class="timeline">
          ${t.items
            .map(
              (it) => `
            <li class="reveal">
              <span class="when">${esc(it.when)}</span>
              <div class="glass-light tl-card"><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></div>
            </li>`
            )
            .join('')}
        </ol>
      </div>`;
  }

  function renderQuotes() {
    const q = S.quotes;
    $('#quotes').innerHTML = `
      <div class="wrap">
        ${heading('04', q.title)}
        <div class="quotes">
          ${q.items.map((text, i) => `<blockquote class="glass-light quote reveal ${i % 2 ? 'r' : 'l'}"><p>${esc(text)}</p></blockquote>`).join('')}
        </div>
      </div>`;
  }

  function renderContact() {
    const c = S.contact;
    $('#contact').innerHTML = `
      <div class="wrap">
        ${heading('05', c.title)}
        <div class="glass contact-card reveal">
          <form id="contact-form" novalidate>
            <p class="intro">${esc(c.intro)}</p>
            <label>Name<input class="input" name="name" type="text" autocomplete="name" required></label>
            <label>Email<input class="input" name="email" type="email" autocomplete="email" required></label>
            <label>Message<textarea class="input" name="message" rows="5" required></textarea></label>
            <input class="hp" name="company" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">
            <div class="form-row">
              <button class="btn" type="submit">Send message ${icon('i-arrow')}</button>
              <p class="status" id="form-status" role="status" aria-live="polite"></p>
            </div>
          </form>
          <div class="socials">
            <p class="mail-line">${esc(S.links.email)}</p>
            <div class="actions">
              <a class="btn btn-icon" href="${esc(S.links.github)}" target="_blank" rel="noopener" title="GitHub">${icon('i-github')}<span class="sr-only">GitHub</span></a>
              <a class="btn btn-icon" href="mailto:${esc(S.links.email)}" title="${esc(S.links.email)}">${icon('i-mail')}<span class="sr-only">Email</span></a>
              <a class="btn btn-icon" href="${esc(S.links.instagram)}" target="_blank" rel="noopener" title="${esc(S.links.instagramHandle)}">${icon('i-insta')}<span class="sr-only">Instagram</span></a>
            </div>
            <p class="handle">${esc(S.links.instagramHandle)}</p>
          </div>
        </div>
      </div>`;
  }

  // arrow icon used on buttons
  document.body.insertAdjacentHTML(
    'afterbegin',
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="square"/></symbol></svg>'
  );

  renderAbout();
  renderProjects();
  renderTimeline();
  renderQuotes();
  renderContact();

  /* ---------- Knowura live preview: scale, skeleton, fallback ---------- */

  $$('.browser').forEach((b) => {
    const view = $('.browser-view', b);
    const frame = $('.frame', b);
    const skeleton = $('.skeleton', b);
    const FW = 1280;

    const fit = () => {
      const s = view.clientWidth / FW;
      view.style.setProperty('--s', s.toFixed(4));
    };
    fit();
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(view);

    if (!frame) return;
    let settled = false;
    let timer;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (skeleton) skeleton.hidden = true;
      if (!ok) {
        // blocked or too slow: show the static screenshot instead
        frame.hidden = true;
        b.classList.add('is-fallback');
      }
    };
    frame.addEventListener('load', () => {
      if (frame.getAttribute('src')) done(true);
    });
    frame.addEventListener('error', () => done(false));

    // A blocked frame (X-Frame-Options / frame-ancestors) still fires "load" and shows a browser error page,
    // and page JS cannot tell. So ask our own /api/embed-check first; if it says no, go straight to the screenshot.
    const url = frame.dataset.src;
    const start = () => {
      frame.src = url; // loading="lazy" still defers the actual request until it nears the viewport
      timer = setTimeout(() => done(false), 15000);
    };
    if (!('fetch' in window) || location.protocol === 'file:') return start();
    const ctl = 'AbortController' in window ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), 4000);
    fetch('/api/embed-check?url=' + encodeURIComponent(url), ctl ? { signal: ctl.signal } : undefined)
      .then((r) => (r.ok ? r.json() : { embeddable: true }))
      .catch(() => ({ embeddable: true })) // no API (static hosting / offline): just try
      .then((j) => {
        clearTimeout(t);
        if (j && j.embeddable === false) done(false);
        else start();
      });
  });

  /* ---------- contact form: Formspree if configured, else mailto ---------- */

  const form = $('#contact-form');
  const status = $('#form-status');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.company) return; // honeypot
    if (!data.name || !data.message || !/^\S+@\S+\.\S+$/.test(data.email || '')) {
      status.textContent = 'Fill in your name, a valid email and a message.';
      status.className = 'status err';
      return;
    }
    const id = S.contact.formspreeId;
    if (id) {
      status.textContent = 'Sending...';
      status.className = 'status';
      try {
        const r = await fetch('https://formspree.io/f/' + encodeURIComponent(id), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ name: data.name, email: data.email, message: data.message }),
        });
        if (!r.ok) throw new Error(r.status);
        form.reset();
        status.textContent = 'Sent. Thanks, I will reply soon.';
        status.className = 'status ok';
        return;
      } catch (err) {
        status.textContent = 'Could not send, opening your email app instead.';
        status.className = 'status err';
      }
    }
    const body = `${data.message}\n\n— ${data.name} (${data.email})`;
    window.location.href =
      'mailto:' + S.links.email + '?subject=' + encodeURIComponent(S.contact.subject) + '&body=' + encodeURIComponent(body);
    if (!id) {
      status.textContent = 'Opening your email app...';
      status.className = 'status ok';
    }
  });

  /* ---------- scroll reveal ---------- */

  if (!reduced && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('js-reveal');
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('in');
            io.unobserve(en.target);
          }
        }),
      { rootMargin: '0px 0px -8% 0px' }
    );
    $$('.reveal').forEach((el) => io.observe(el));
  }

  /* ---------- command palette ("/") ---------- */

  const palette = $('#palette');
  const input = $('#palette-q');
  const list = $('#palette-list');
  let items = [];
  let active = 0;
  let lastFocus = null;

  const go = (id) => () => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  };
  const open = (url) => () => window.open(url, '_blank', 'noopener');

  const commands = [
    { cmd: 'goto about', desc: 'who is this guy', run: go('about') },
    { cmd: 'goto projects', desc: 'the builds', run: go('projects') },
    { cmd: 'goto timeline', desc: 'wro 2026 and now', run: go('timeline') },
    { cmd: 'goto quotes', desc: 'words to live by', run: go('quotes') },
    { cmd: 'goto contact', desc: 'say hi', run: go('contact') },
    { cmd: 'goto top', desc: 'back to the laptop', run: () => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }) },
    ...S.projects.items.map((p) => ({ cmd: 'open ' + p.id, desc: p.link.href.replace(/^https?:\/\//, ''), run: open(p.link.href) })),
    { cmd: 'open github', desc: S.links.github.replace(/^https?:\/\//, ''), run: open(S.links.github) },
    { cmd: 'open instagram', desc: S.links.instagramHandle, run: open(S.links.instagram) },
    { cmd: 'email', desc: S.links.email, run: () => (window.location.href = 'mailto:' + S.links.email) },
    {
      cmd: 'copy email',
      desc: 'to clipboard',
      run: () => navigator.clipboard && navigator.clipboard.writeText(S.links.email),
    },
  ];

  function draw() {
    const q = input.value.trim().toLowerCase();
    items = commands.filter((c) => !q || c.cmd.includes(q) || c.desc.toLowerCase().includes(q));
    active = Math.min(active, Math.max(0, items.length - 1));
    list.innerHTML = items.length
      ? items
          .map(
            (c, i) =>
              `<li role="option" aria-selected="${i === active}" class="${i === active ? 'on' : ''}" data-i="${i}"><span class="c">${esc(c.cmd)}</span><span class="d">${esc(c.desc)}</span></li>`
          )
          .join('')
      : '<li class="none">command not found</li>';
  }

  function openPalette() {
    lastFocus = document.activeElement;
    palette.hidden = false;
    input.value = '';
    active = 0;
    draw();
    input.focus();
  }
  function closePalette() {
    palette.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function runActive() {
    const c = items[active];
    if (!c) return;
    closePalette();
    c.run();
  }

  $('#open-palette').addEventListener('click', openPalette);
  palette.addEventListener('mousedown', (e) => {
    if (e.target === palette) closePalette();
  });
  list.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-i]');
    if (li) {
      active = +li.dataset.i;
      runActive();
    }
  });
  input.addEventListener('input', () => {
    active = 0;
    draw();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') (e.preventDefault(), (active = (active + 1) % Math.max(1, items.length)), draw());
    else if (e.key === 'ArrowUp') (e.preventDefault(), (active = (active - 1 + items.length) % Math.max(1, items.length)), draw());
    else if (e.key === 'Enter') (e.preventDefault(), runActive());
    else if (e.key === 'Escape') closePalette();
    else if (e.key === 'Tab') e.preventDefault(); // keep focus inside the dialog
  });
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey && palette.hidden) {
      e.preventDefault();
      openPalette();
    } else if (e.key === 'Escape' && !palette.hidden) closePalette();
  });

  /* ---------- 3D laptop ---------- */

  function startLaptop() {
    if (!window.THREE || !window.LaptopHero) return;
    window.LaptopHero.init({
      canvas: $('#laptop-canvas'),
      stage: $('#stage'),
      track: $('#hero'),
      zone: [$('#hero'), $('#about')],
      // glbUrl: 'models/laptop.glb', // swap in your own model here
    });
  }
  // let the page paint first, then boot WebGL
  requestAnimationFrame(() => setTimeout(startLaptop, 0));
})();
