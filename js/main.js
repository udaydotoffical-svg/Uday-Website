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
    `<h2 class="section-title"><span class="num" aria-hidden="true">${num}</span>${esc(title)}</h2>`;

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
         ${v.interactive ? `<button type="button" class="view-lock" data-cursor="INTERACT"><span>Click to use Knowura here</span></button>` : ''}
         <div class="skeleton" aria-hidden="true"><span class="spinner"></span><span>loading live preview</span></div>`
      : '';
    return `
      <div class="browser" data-embed="${v.embed ? '1' : '0'}" data-interactive="${v.interactive ? '1' : '0'}">
        <div class="browser-bar">
          <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="urlbar input-look">${esc(v.displayUrl)}</span>
        </div>
        <div class="browser-view">
          <img class="fallback" src="${esc(v.fallback)}" alt="${esc(v.alt)}" width="1280" height="800" loading="lazy" decoding="async">
          ${embed}
        </div>
        <p class="browser-note"></p>
      </div>`;
  }

  function mediaVisual(p) {
    const v = p.visual;
    const inner = v.video
      ? `<video src="${esc(v.video)}" poster="${esc(v.image)}" muted loop playsinline autoplay preload="none" aria-label="${esc(v.alt)}"></video>`
      : `<img src="${esc(v.image)}" alt="${esc(v.alt)}" width="1280" height="800" loading="lazy" decoding="async">`;
    return `<div class="media glass-light">${inner}</div>`;
  }

  function signalVisual(p) {
    const v = p.visual;
    return `
      <div class="browser device" role="img" aria-label="${esc(v.alt)}">
        <div class="browser-bar">
          <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="urlbar input-look">${esc(v.title)}</span>
          <span class="demo-chip">demo signal</span>
        </div>
        <div class="browser-view">
          <div class="device-body" aria-hidden="true">
            <div class="device-left">
              <svg class="head" viewBox="0 0 120 150">
                <path class="skull" d="M28 62C28 22 92 22 92 62V90C92 114 77 132 60 132S28 114 28 90Z"/>
                <rect class="ear" x="20" y="74" width="9" height="20"/><rect class="ear" x="91" y="74" width="9" height="20"/>
                <path class="band" d="M25 66C40 48 80 48 95 66"/>
                <circle class="ring" cx="42" cy="58" r="6"/><circle class="ring r2" cx="78" cy="58" r="6"/><circle class="ring r3" cx="60" cy="52" r="6"/>
                <circle class="node" cx="42" cy="58" r="5"/><circle class="node" cx="78" cy="58" r="5"/><circle class="node" cx="60" cy="52" r="5"/>
                <rect class="mod" x="52" y="40" width="16" height="9"/><rect class="led" x="58" y="43" width="4" height="3"/>
                <path class="face" d="M46 96h8M66 96h8M52 112c4 4 12 4 16 0"/>
              </svg>
              <ul class="leds"><li>EEG</li><li>IMU</li><li>Firmware</li></ul>
            </div>
            <div class="sig">
              <span class="sig-label">EEG</span>
              <div class="sig-panel eegp"><canvas class="eeg"></canvas></div>
              <span class="sig-label">IMU</span>
              <div class="sig-panel imup"><canvas class="imu"></canvas></div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function hovercardVisual(p) {
    const v = p.visual;
    return `
      <div class="browser repo-demo" role="group" aria-label="${esc(v.alt)}">
        <div class="browser-bar">
          <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="urlbar input-look">${esc(v.displayUrl)}</span>
          <span class="demo-chip">live demo</span>
        </div>
        <div class="browser-view">
          <div class="demo-page">
            <p class="dp-h">${esc(v.title)}</p>
            <ul class="dp-list">
              ${v.repos.map((r) => `<li>${icon('i-github')}<a href="https://github.com/${esc(r)}" target="_blank" rel="noopener">${esc(r)}</a></li>`).join('')}
            </ul>
            <p class="dp-hint"><span class="hint-fine">Hover a link</span><span class="hint-touch">Stats card</span></p>
            <div class="dp-inline" aria-live="polite"></div>
          </div>
        </div>
      </div>`;
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
            <article class="project glass reveal ${i % 2 ? 'flip' : ''} ${p.wide ? 'wide' : ''}" id="project-${esc(p.id)}">
              <div class="project-copy">
                <p class="kicker">${esc(p.kicker)}</p>
                <h3>${esc(p.title)}</h3>
                <p>${esc(p.description)}</p>
                ${p.features ? `<ul class="features">${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
                <ul class="tags">${tags(p.tags)}</ul>
                ${
                  p.link || p.github
                    ? `<div class="project-actions">${
                        p.link ? `<a class="btn" href="${esc(p.link.href)}" target="_blank" rel="noopener">${esc(p.link.label)} ${icon('i-arrow')}</a>` : ''
                      }${
                        p.github
                          ? `<a class="btn btn-icon" href="${esc(p.github)}" target="_blank" rel="noopener" title="GitHub repo">${icon('i-github')}<span class="sr-only">${esc(p.title)} on GitHub</span></a>`
                          : ''
                      }</div>`
                    : p.badge
                      ? `<p class="badge glass-light">${esc(p.badge)}</p>`
                      : ''
                }
              </div>
              <div class="project-visual">${p.visual.type === 'browser' ? browserVisual(p) : p.visual.type === 'signal' ? signalVisual(p) : p.visual.type === 'hovercard' ? hovercardVisual(p) : mediaVisual(p)}</div>
            </article>`
            )
            .join('')}
        </div>
      </div>`;
  }

  /* ---------- blog: card list + in-page reader (#blog/<id>) ---------- */

  const fmtDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const readMins = (post) => Math.max(1, Math.round(MD.words(post.body) / 200));

  S.blog.items = []; // filled from data/posts.json (written by the /admin editor)

  function renderBlog() {
    const b = S.blog;
    $('#blog').innerHTML = `
      <div class="wrap">
        ${heading('03', b.title)}
        <p class="blog-intro reveal">${esc(b.intro)}</p>
        <div class="post-list" id="post-list" aria-live="polite"></div>
      </div>`;
  }

  function renderPosts() {
    const items = S.blog.items;
    $('#post-list').innerHTML = items.length
      ? items
          .map(
            (it) => `
            <a class="post glass-light reveal" href="#blog/${esc(it.id)}" data-cursor="READ" data-post="${esc(it.id)}">
              <p class="post-meta"><time datetime="${esc(it.date)}">${esc(fmtDate(it.date))}</time><span>${readMins(it)} min read</span></p>
              <h3>${esc(it.title)}</h3>
              <p class="post-sum">${esc(it.summary)}</p>
              <ul class="tags">${tags(it.tags)}</ul>
              <span class="post-go">Read ${icon('i-arrow')}</span>
            </a>`
          )
          .join('')
      : '<p class="blog-intro">No posts yet.</p>';
  }

  function postHTML(it) {
    return `
      <p class="post-meta"><time datetime="${esc(it.date)}">${esc(fmtDate(it.date))}</time><span>${readMins(it)} min read</span></p>
      <h2 id="reader-title">${esc(it.title)}</h2>
      <ul class="tags">${tags(it.tags)}</ul>
      <div class="prose">${MD.render(it.body)}</div>`;
  }

  function renderTimeline() {
    const t = S.timeline;
    $('#timeline').innerHTML = `
      <div class="wrap">
        ${heading('04', t.title)}
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
        ${heading('05', q.title)}
        <div class="quotes">
          ${q.items.map((text, i) => `<blockquote class="glass-light quote reveal ${i % 2 ? 'r' : 'l'}"><p>${esc(text)}</p></blockquote>`).join('')}
        </div>
      </div>`;
  }

  function renderContact() {
    const c = S.contact;
    $('#contact').innerHTML = `
      <div class="wrap">
        ${heading('06', c.title)}
        <div class="glass contact-card reveal">
          <form id="contact-form" method="post" action="mailto:${esc(S.links.email)}" enctype="text/plain" novalidate>
            <p class="intro">${esc(c.intro)}</p>
            <label>Name<input class="input" name="name" type="text" autocomplete="name" required aria-describedby="form-status"></label>
            <label>Email<input class="input" name="email" type="email" autocomplete="email" inputmode="email" required aria-describedby="form-status"></label>
            <label>Message<textarea class="input" name="message" rows="5" required aria-describedby="form-status"></textarea></label>
            <input class="hp" name="company" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">
            <div class="form-row">
              <button class="btn" type="submit">Send message ${icon('i-arrow')}</button>
              <p class="status" id="form-status" role="status" aria-live="polite" aria-atomic="true"></p>
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
  renderBlog();
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

    // desktop: the frame is view-only until you click it; it re-locks when the mouse leaves so page scroll is never hijacked
    const lock = $('.view-lock', b);
    if (lock) {
      lock.addEventListener('click', () => b.classList.add('is-live'));
      view.addEventListener('pointerleave', () => b.classList.remove('is-live'));
      document.addEventListener('keydown', (e) => e.key === 'Escape' && b.classList.remove('is-live'));
    }

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

  /* ---------- Samata demo signal monitor ---------- */

  $$('.device').forEach((dev) => {
    const eeg = $('.eeg', dev);
    const imu = $('.imu', dev);
    const ctxE = eeg.getContext('2d');
    const ctxI = imu.getContext('2d');
    const COLORS = ['#22e5ff', '#2f6bff', '#eaf6ff', '#22e5ff'];
    let dpr = 1;

    const fit = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      [eeg, imu].forEach((c) => {
        const r = c.getBoundingClientRect();
        c.width = Math.max(1, Math.round(r.width * dpr));
        c.height = Math.max(1, Math.round(r.height * dpr));
      });
    };

    // deterministic fake brainwave: a few detuned sines plus a travelling spike
    const wave = (x, t, k) => {
      const base = 0.5 * Math.sin(x * 0.045 + t * 2.1 + k) + 0.3 * Math.sin(x * 0.11 - t * 3.3 + k * 2);
      const burst = 0.5 + 0.5 * Math.sin(x * 0.012 + t * 0.7 + k);
      const fast = 0.28 * Math.sin(x * 0.33 + t * 6.1 + k * 3.1) * burst;
      const sx = ((t * 150 + k * 90) % 520) - 60;
      const spike = 0.9 * Math.exp(-Math.pow((x - sx) / 7, 2)) * (k % 2 ? -1 : 1);
      return base + fast + spike;
    };

    function drawEEG(t) {
      const w = eeg.width;
      const h = eeg.height;
      ctxE.clearRect(0, 0, w, h);
      const rows = 4;
      const rh = h / rows;
      ctxE.lineJoin = 'miter';
      ctxE.lineWidth = Math.max(2, 2 * dpr);
      for (let k = 0; k < rows; k++) {
        const cy = rh * (k + 0.5);
        ctxE.strokeStyle = 'rgba(143,166,204,0.18)';
        ctxE.lineWidth = 1;
        ctxE.beginPath();
        ctxE.moveTo(0, cy);
        ctxE.lineTo(w, cy);
        ctxE.stroke();
        ctxE.lineWidth = Math.max(2, 2 * dpr);
        ctxE.strokeStyle = COLORS[k];
        ctxE.beginPath();
        const step = 3 * dpr;
        for (let x = 0; x <= w; x += step) {
          const y = cy + wave(x / dpr, t, k) * rh * 0.32;
          x === 0 ? ctxE.moveTo(x, y) : ctxE.lineTo(x, y);
        }
        ctxE.stroke();
      }
    }

    function drawIMU(t) {
      const w = imu.width;
      const h = imu.height;
      ctxI.clearRect(0, 0, w, h);
      const vals = [Math.sin(t * 1.3), Math.sin(t * 0.9 + 2) * 0.8, Math.sin(t * 1.9 + 4) * 0.6];
      const cols = ['#22e5ff', '#2f6bff', '#eaf6ff'];
      const rh = h / 3;
      const pad = 22 * dpr;
      ctxI.font = `${Math.round(11 * dpr)}px "Geist Pixel", monospace`;
      ctxI.textBaseline = 'middle';
      vals.forEach((v, i) => {
        const cy = rh * (i + 0.5);
        const mid = pad + (w - pad) / 2;
        ctxI.fillStyle = '#8fa6cc';
        ctxI.fillText('XYZ'[i], 6 * dpr, cy);
        ctxI.fillStyle = 'rgba(143,166,204,0.18)';
        ctxI.fillRect(pad, cy - 1, w - pad, 2);
        ctxI.fillStyle = cols[i];
        const bw = v * ((w - pad) / 2 - 4 * dpr);
        ctxI.fillRect(bw >= 0 ? mid : mid + bw, cy - rh * 0.22, Math.abs(bw), rh * 0.44);
        ctxI.fillStyle = '#eaf6ff';
        ctxI.fillRect(mid - 1, cy - rh * 0.34, 2, rh * 0.68);
      });
    }

    let visible = false;
    let raf = 0;
    let lastDraw = 0;
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (now - lastDraw < 33) return; // 30 fps is plenty for a signal trace
      lastDraw = now;
      const t = now / 1000;
      drawEEG(t);
      drawIMU(t);
    };
    const sync = () => {
      if (visible && !document.hidden && !reduced) {
        if (!raf) raf = requestAnimationFrame(frame);
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    fit();
    const still = () => {
      drawEEG(3);
      drawIMU(3);
    };
    still();
    if ('ResizeObserver' in window)
      new ResizeObserver(() => {
        fit();
        still();
      }).observe(dev);
    if ('IntersectionObserver' in window)
      new IntersectionObserver((en) => {
        visible = en[0].isIntersecting;
        sync();
      }).observe(dev);
    document.addEventListener('visibilitychange', sync);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(still);
  });

  /* ---------- contact form: Formspree if configured, else mailto ---------- */
  // The <form> is method="post" with a mailto: action, so even if this handler never ran nothing would be put in the URL.
  // Here we always preventDefault and send it ourselves.

  const form = $('#contact-form');
  const status = $('#form-status');
  const sendBtn = $('button[type="submit"]', form);
  const say = (text, kind) => {
    status.textContent = text;
    status.className = 'status' + (kind ? ' ' + kind : '');
  };
  const fields = ['name', 'email', 'message'].map((n) => form.elements[n]);
  fields.forEach((f) =>
    f.addEventListener('input', () => {
      f.removeAttribute('aria-invalid');
    })
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.company) return; // honeypot: bots fill it, people never see it

    // validation: mark every bad field, say what is wrong, focus the first one
    const bad = [];
    if (!data.name || !data.name.trim()) bad.push([form.elements.name, 'your name']);
    if (!/^\S+@\S+\.\S+$/.test((data.email || '').trim())) bad.push([form.elements.email, 'a valid email address']);
    if (!data.message || !data.message.trim()) bad.push([form.elements.message, 'a message']);
    fields.forEach((f) => (bad.some(([x]) => x === f) ? f.setAttribute('aria-invalid', 'true') : f.removeAttribute('aria-invalid')));
    if (bad.length) {
      say('Please add ' + bad.map(([, what]) => what).join(', ').replace(/, ([^,]*)$/, ' and $1') + '.', 'err');
      bad[0][0].focus();
      return;
    }

    sendBtn.disabled = true;
    const mailto = () => {
      const body = `${data.message}\n\n— ${data.name} (${data.email})`;
      window.location.href =
        'mailto:' + S.links.email + '?subject=' + encodeURIComponent(S.contact.subject) + '&body=' + encodeURIComponent(body);
    };
    const id = S.contact.formspreeId;
    try {
      if (id) {
        say('Sending...', '');
        const r = await fetch('https://formspree.io/f/' + encodeURIComponent(id), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ name: data.name, email: data.email, message: data.message }),
        });
        if (!r.ok) throw new Error(String(r.status));
        form.reset();
        say('Message sent. Thanks, I will reply soon.', 'ok');
      } else {
        mailto();
        say('Your email app should open with the message ready. Press send there to finish. If nothing opens, email ' + S.links.email + '.', 'ok');
      }
    } catch (err) {
      say('Could not send the message. Opening your email app instead; if nothing opens, email ' + S.links.email + '.', 'err');
      mailto();
    } finally {
      sendBtn.disabled = false;
    }
  });

  /* ---------- scroll reveal ---------- */

  let revealIO = null;

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
    revealIO = io;
  }

  /* ---------- blog reader ---------- */

  const reader = $('#reader');
  const readerBox = $('.reader-box', reader);
  let readerFrom = null;
  function openPost(id, push) {
    const it = S.blog.items.find((x) => x.id === id);
    if (!it) return;
    readerFrom = document.activeElement;
    $('#reader-body').innerHTML = postHTML(it);
    document.title = it.title + ' | Uday Singh';
    reader.hidden = false;
    document.documentElement.classList.add('reader-open');
    readerBox.scrollTop = 0;
    readerBox.focus({ preventScroll: true });
    if (push && location.hash !== '#blog/' + id) history.pushState(null, '', '#blog/' + id);
  }
  function closePost(push) {
    if (reader.hidden) return;
    reader.hidden = true;
    document.documentElement.classList.remove('reader-open');
    document.title = 'Uday Singh | Firmware & Hardware Developer';
    if (push && /^#blog\//.test(location.hash)) history.pushState(null, '', '#blog');
    if (readerFrom && readerFrom.focus) readerFrom.focus({ preventScroll: true });
  }
  $('#blog').addEventListener('click', (e) => {
    const a = e.target.closest('a[data-post]');
    if (!a) return;
    e.preventDefault();
    openPost(a.dataset.post, true);
  });
  $('#reader-close').addEventListener('click', () => closePost(true));
  reader.addEventListener('mousedown', (e) => e.target === reader && closePost(true));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !reader.hidden) closePost(true);
    // keep keyboard focus inside the open article
    if (e.key === 'Tab' && !reader.hidden) {
      const f = [...reader.querySelectorAll('a[href], button')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === readerBox)) (e.preventDefault(), last.focus());
      else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
    }
  });
  const route = () => {
    const mt = /^#blog\/([\w-]+)$/.exec(location.hash);
    if (mt) openPost(mt[1], false);
    else closePost(false);
  };
  window.addEventListener('popstate', route);
  window.addEventListener('hashchange', route);

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
    { cmd: 'goto blog', desc: 'notes from the bench', run: go('blog') },
    { cmd: 'goto timeline', desc: 'wro 2026 and now', run: go('timeline') },
    { cmd: 'goto quotes', desc: 'words to live by', run: go('quotes') },
    { cmd: 'goto contact', desc: 'say hi', run: go('contact') },
    {
      cmd: 'fastfetch',
      desc: 'btw',
      run: () => {
        window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
        setTimeout(() => window.__fastfetch && window.__fastfetch(), reduced ? 0 : 600);
      },
    },
    { cmd: 'goto top', desc: 'back to the laptop', run: () => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }) },
    ...S.projects.items.map((p) =>
      p.link
        ? { cmd: 'open ' + p.id, desc: p.link.href.replace(/^https?:\/\//, ''), run: open(p.link.href) }
        : { cmd: 'goto ' + p.id, desc: p.kicker.toLowerCase(), run: go('project-' + p.id) }
    ),
    { cmd: 'open github', desc: S.links.github.replace(/^https?:\/\//, ''), run: open(S.links.github) },
    { cmd: 'open instagram', desc: S.links.instagramHandle, run: open(S.links.instagram) },
    { cmd: 'email', desc: S.links.email, run: () => (window.location.href = 'mailto:' + S.links.email) },
    {
      cmd: 'copy email',
      desc: 'to clipboard',
      run: () => navigator.clipboard && navigator.clipboard.writeText(S.links.email),
    },
  ];

  /* ---------- load the posts (data/posts.json) ---------- */

  const validPost = (p) =>
    p && /^[a-z0-9-]{1,60}$/.test(p.id) && /^\d{4}-\d{2}-\d{2}$/.test(p.date) && typeof p.title === 'string' && typeof p.body === 'string';

  fetch('data/posts.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('posts ' + r.status))))
    .then((d) => {
      S.blog.items = (d.items || [])
        .filter(validPost)
        .map((p) => ({ ...p, tags: Array.isArray(p.tags) ? p.tags : [], summary: p.summary || '' }))
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      renderPosts();
      $$('.reveal', $('#post-list')).forEach((el) => (revealIO ? revealIO.observe(el) : el.classList.add('in')));
      const at = commands.findIndex((c) => c.cmd === 'goto blog') + 1;
      commands.splice(at, 0, ...S.blog.items.map((p) => ({ cmd: 'read ' + p.id, desc: p.title.toLowerCase().slice(0, 40), run: () => openPost(p.id, true) })));
      route(); // deep link: /#blog/<id> opens the article once the posts are here
    })
    .catch(() => {
      S.blog.items = [];
      renderPosts();
    });

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
  // Three.js (~600 KB, ~125 KB gzipped), the laptop code and the ESP32 model are loaded INSIDE the boot loader:
  // they start right after the first paint (so they never delay it), the loader's counter waits for them, and the
  // laptop is fully built when the loader lifts. On repeat visits (no loader) they load lazily after the window
  // "load" event instead, or on the first interaction.
  const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'; // pinned
  const stage = $('#stage');
  const showStage = () => stage.classList.remove('is-booting');

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      if (/^https?:/.test(src)) s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });

  // The boot loader waits for the 3D scene, but never longer than its cap (LOADER_MAX in fx.js, 4 s).
  // If the scene is later than that, the loader lifts without it and the laptop fades in when it is ready.
  const loading = document.documentElement.classList.contains('is-loading');
  let resolveReady = () => {};
  window.__laptopReady = loading ? new Promise((res) => (resolveReady = res)) : null;
  window.__laptopHero = null;

  function startLaptop() {
    loadScript(THREE_URL)
      .then(() => loadScript('js/laptop.js'))
      .then(() => {
        const hero = window.LaptopHero.init({
          canvas: $('#laptop-canvas'),
          stage,
          track: $('#hero'),
          zone: [$('#hero'), $('#about')],
          holdIntro: loading && !window.__introStarted, // lid opens once the loader has lifted
          onFallback: () => {
            showStage();
            resolveReady();
          },
          // glbUrl: 'models/laptop.glb', // swap in your own model here
        });
        if (!hero) return resolveReady();
        window.__laptopHero = hero;
        window.__laptopPlay = () => hero.play();
        if (window.__introStarted) hero.play(); // loader already gone (cap reached): open the lid right away
        hero.ready.then(() => {
          requestAnimationFrame(showStage);
          resolveReady();
        });
      })
      .catch((err) => {
        console.warn('3D scene failed, using the flat fallback', err);
        // CDN blocked or offline: show the flat SVG laptop instead
        document.documentElement.classList.add('no-webgl');
        showStage();
        resolveReady();
      });
  }

  let booted = false;
  const INTERACT = ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'keydown', 'scroll'];
  const boot = () => {
    if (booted) return;
    booted = true;
    INTERACT.forEach((e) => window.removeEventListener(e, boot));
    startLaptop();
  };
  INTERACT.forEach((e) => window.addEventListener(e, boot, { passive: true }));
  const afterPaint = () =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => ('requestIdleCallback' in window ? requestIdleCallback(boot, { timeout: 1200 }) : setTimeout(boot, 150)))
    );
  if (loading) requestAnimationFrame(() => requestAnimationFrame(boot)); // first visit: load the 3D scene inside the loader
  else if (document.readyState === 'complete') afterPaint();
  else window.addEventListener('load', afterPaint, { once: true });

  /* ---------- easter egg: fastfetch -> I USE ARCH BTW ---------- */
  // palette command, clicking the laptop screen (laptop.js), or typing  arch  /  btw  /  fastfetch  anywhere
  window.__fastfetch = () => {
    boot();
    const go = (tries) => {
      if (window.__laptopHero) return window.__laptopHero.fastfetch();
      if (tries > 0) setTimeout(() => go(tries - 1), 250);
    };
    go(40);
  };
  let typed = '';
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return;
    typed = (typed + e.key.toLowerCase()).slice(-10);
    if (/(arch|btw|fastfetch)$/.test(typed)) {
      typed = '';
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      setTimeout(window.__fastfetch, reduced ? 0 : 500);
    }
  });
})();
