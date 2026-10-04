/*
 * Motion layer. Runs after main.js has rendered everything.
 * Boot loader, hero intro, text scramble, custom cursor, magnetic buttons, 3D tilt,
 * kinetic marquees, scroll progress, timeline draw, quote word-lighting, mega footer.
 * Everything here is optional polish: with prefers-reduced-motion it mostly switches itself off.
 */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const root = document.documentElement;
  const S = window.SITE || {};
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const mk = (tag, cls, html) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html) el.innerHTML = html;
    return el;
  };
  const star = (cls) => `<svg class="${cls || 'mq-star'}" aria-hidden="true"><use href="#i-star"/></svg>`;

  /* ---------- text scramble ---------- */

  const GLYPHS = '!<>-_/[]{}=+*^?#01XKZ';
  function scramble(el, text, dur) {
    text = text == null ? el.textContent : text;
    if (reduced) {
      el.textContent = text;
      return;
    }
    dur = dur || 900;
    const n = text.length;
    const at = Array.from({ length: n }, (_, i) => (i / n) * 0.65 + Math.random() * 0.35);
    const start = performance.now();
    const tick = (now) => {
      const p = clamp((now - start) / dur, 0, 1);
      let out = '';
      for (let i = 0; i < n; i++) {
        const c = text[i];
        out += c === ' ' || p >= at[i] ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // laggy device? always settle on the real text
    setTimeout(() => (el.textContent = text), dur + 250);
  }

  /* ---------- boot loader + hero intro ---------- */

  function intro() {
    root.classList.add('is-intro');
    const u = $('.tag-uday');
    const s = $('.tag-singh');
    if (u) setTimeout(() => scramble(u, 'UDAY', 900), 120);
    if (s) setTimeout(() => scramble(s, 'SINGH', 1000), 300);
  }

  function runLoader() {
    const L = $('#loader');
    if (!L || !root.classList.contains('is-loading')) {
      if (L) L.remove();
      intro();
      return;
    }
    const num = $('.loader-num', L);
    const bar = $('.loader-bar i', L);
    const lines = $$('.loader-log li', L);
    const D = 1300;
    const start = performance.now();
    const step = (now) => {
      const p = clamp((now - start) / D, 0, 1);
      const e = 1 - Math.pow(1 - p, 3);
      num.textContent = String(Math.round(e * 100)).padStart(3, '0');
      bar.style.transform = `scaleX(${e})`;
      lines.forEach((li, i) => li.classList.toggle('on', e > (i + 1) / (lines.length + 1)));
      if (p < 1) return requestAnimationFrame(step);
      root.classList.add('loader-out');
      try {
        sessionStorage.setItem('uday-booted', '1');
      } catch (err) {}
      setTimeout(intro, 220);
      setTimeout(() => {
        root.classList.remove('is-loading', 'loader-out');
        L.remove();
      }, 900);
    };
    requestAnimationFrame(step);
  }

  /* ---------- extra DOM: progress bar, grain, marquees, mega footer ---------- */

  const progress = mk('div', 'scroll-progress');
  progress.setAttribute('aria-hidden', 'true');
  document.body.appendChild(progress);
  const grain = mk('div', 'grain');
  grain.setAttribute('aria-hidden', 'true');
  document.body.appendChild(grain);

  const words = S.marquee || ['Firmware', 'Hardware', 'WRO 2026', 'Knowura', 'Sensors', 'Vadodara'];
  function marquee(cls, list) {
    const wrap = mk('div', 'marquee ' + (cls || ''));
    wrap.setAttribute('aria-hidden', 'true');
    const track = mk('div', 'mq-track');
    const chunk = list.map((w) => `<span class="mq-item">${w}</span>${star()}`).join('');
    track.innerHTML = chunk + chunk + chunk + chunk;
    wrap.appendChild(track);
    return wrap;
  }
  const about = $('#about');
  const contact = $('#contact');
  const bands = [];
  if (about) {
    const m = marquee('mq-a', words);
    about.after(m);
    bands.push({ el: m, dir: -1 });
  }
  if (contact) {
    const cross = mk('div', 'mq-cross');
    const a = marquee('mq-b', words.slice().reverse());
    const b = marquee('mq-c', ['I build hardware that talks to software']);
    cross.append(a, b);
    contact.before(cross);
    bands.push({ el: a, dir: 1 }, { el: b, dir: -1 });
  }

  const footer = $('.footer');
  if (footer && S.links) {
    const mega = mk('a', 'mega');
    mega.href = 'mailto:' + S.links.email;
    mega.dataset.cursor = 'SAY HI';
    const txt = "LET'S BUILD";
    mega.innerHTML =
      '<span class="sr-only">Email Uday</span>' +
      [...txt].map((c, i) => `<span class="ch" aria-hidden="true" style="--i:${i}">${c === ' ' ? '&nbsp;' : c}</span>`).join('') +
      star('mega-star');
    footer.prepend(mega);
  }

  /* ---------- section titles: scramble once in view ---------- */

  $$('.section-title').forEach((h) => {
    const node = [...h.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (!node) return;
    const span = mk('span', 'st-text');
    span.textContent = node.textContent;
    h.replaceChild(span, node);
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          en.target.classList.add('seen');
          const t = $('.st-text', en.target);
          if (t) scramble(t, t.textContent, 800);
          io.unobserve(en.target);
        }),
      { rootMargin: '0px 0px -15% 0px' }
    );
    $$('.section-title').forEach((h) => io.observe(h));
  }

  /* ---------- quotes: split into words, lit by scroll ---------- */

  const quotes = $$('.quote p').map((p) => {
    const ws = p.textContent.split(/\s+/).filter(Boolean);
    p.innerHTML = ws.map((w) => `<span class="w">${w}</span>`).join(' ');
    return { el: p, words: $$('.w', p), lit: -1 };
  });

  /* ---------- cursor labels ---------- */

  $$('.project').forEach((pr) => {
    const vis = $('.project-visual', pr);
    if (vis && !pr.classList.contains('wide')) vis.dataset.cursor = $('.device', pr) ? 'DEMO' : 'VIEW';
    const a = $('.project-copy .btn', pr);
    if (a) a.dataset.cursor = 'OPEN';
  });

  /* ---------- custom cursor (mouse only) ---------- */

  if (fine && !reduced) {
    root.classList.add('has-cursor');
    const dot = mk('div', 'cursor-dot');
    const ring = mk('div', 'cursor-ring', '<span></span>');
    const label = $('span', ring);
    document.body.append(ring, dot);
    let x = -100;
    let y = -100;
    let rx = x;
    let ry = y;
    window.addEventListener(
      'pointermove',
      (e) => {
        x = e.clientX;
        y = e.clientY;
        dot.style.transform = `translate(${x}px, ${y}px)`;
        root.classList.add('cursor-on');
      },
      { passive: true }
    );
    document.addEventListener('pointerleave', () => root.classList.remove('cursor-on'));
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest && e.target.closest('a, button, [data-cursor], input, textarea, [role="option"]');
      const text = t && t.dataset.cursor ? t.dataset.cursor : '';
      ring.classList.toggle('is-hover', !!t);
      ring.classList.toggle('has-label', !!text);
      ring.classList.toggle('is-text', !!t && /INPUT|TEXTAREA/.test(t.tagName));
      label.textContent = text;
    });
    window.addEventListener('pointerdown', () => ring.classList.add('is-down'));
    window.addEventListener('pointerup', () => ring.classList.remove('is-down'));
    const follow = () => {
      rx += (x - rx) * 0.2;
      ry += (y - ry) * 0.2;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);

    // magnetic buttons
    $$('.btn').forEach((b) => {
      b.classList.add('magnetic');
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        b.style.setProperty('--mx', ((e.clientX - (r.left + r.width / 2)) * 0.3).toFixed(1) + 'px');
        b.style.setProperty('--my', ((e.clientY - (r.top + r.height / 2)) * 0.35).toFixed(1) + 'px');
      });
      b.addEventListener('pointerleave', () => {
        b.style.setProperty('--mx', '0px');
        b.style.setProperty('--my', '0px');
      });
    });

    // 3D tilt + glare on project panels
    $$('.project:not(.wide)').forEach((p) => {
      p.addEventListener('pointermove', (e) => {
        const r = p.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        p.classList.add('is-tilting');
        p.style.transform = `perspective(1400px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg)`;
        p.style.setProperty('--gx', ((px + 0.5) * 100).toFixed(1) + '%');
        p.style.setProperty('--gy', ((py + 0.5) * 100).toFixed(1) + '%');
      });
      p.addEventListener('pointerleave', () => {
        p.classList.remove('is-tilting');
        p.style.transform = '';
      });
    });

    // hero name follows the mouse a little
    const stack = $('.name-stack');
    if (stack) {
      window.addEventListener(
        'pointermove',
        (e) => {
          if (window.scrollY > window.innerHeight) return;
          const px = e.clientX / window.innerWidth - 0.5;
          const py = e.clientY / window.innerHeight - 0.5;
          stack.style.setProperty('--px', (px * -18).toFixed(1) + 'px');
          stack.style.setProperty('--py', (py * -12).toFixed(1) + 'px');
        },
        { passive: true }
      );
    }

    // nav links scramble on hover
    $$('.nav-links a').forEach((a) => {
      const t = a.textContent;
      a.addEventListener('pointerenter', () => scramble(a, t, 380));
    });
  }

  /* ---------- scroll engine (one rAF per frame, only when scrolling) ---------- */

  const nav = $('.nav');
  const tagU = $('.tag-uday');
  const tagS = $('.tag-singh');
  const stars = $$('.star');
  const timeline = $('.timeline');
  let lastY = window.scrollY;
  let vel = 0;
  let ticking = false;

  function onScroll() {
    const y = window.scrollY;
    const vh = window.innerHeight;
    const dy = y - lastY;
    lastY = y;
    vel = clamp(vel + dy, -400, 400);

    const max = document.documentElement.scrollHeight - vh;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;

    if (nav) nav.classList.toggle('nav-hidden', dy > 4 && y > vh * 0.6);
    if (nav && dy < -4) nav.classList.remove('nav-hidden');

    if (!reduced && y < vh * 1.3) {
      if (tagU) tagU.style.translate = `${(-y * 0.18).toFixed(1)}px ${(-y * 0.22).toFixed(1)}px`;
      if (tagS) tagS.style.translate = `${(y * 0.16).toFixed(1)}px ${(y * 0.08).toFixed(1)}px`;
      stars.forEach((s, i) => (s.style.translate = `0 ${(-y * (0.1 + (i % 4) * 0.12)).toFixed(1)}px`));
    }

    if (timeline) {
      const r = timeline.getBoundingClientRect();
      timeline.style.setProperty('--draw', clamp((vh * 0.75 - r.top) / r.height, 0, 1).toFixed(3));
    }

    quotes.forEach((q) => {
      const r = q.el.getBoundingClientRect();
      const p = reduced ? 1 : clamp((vh * 0.9 - r.top) / (r.height + vh * 0.35), 0, 1);
      const lit = Math.round(p * q.words.length);
      if (lit === q.lit) return;
      q.words.forEach((w, i) => w.classList.toggle('lit', i < lit));
      q.lit = lit;
    });
    ticking = false;
  }
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(onScroll);
      }
    },
    { passive: true }
  );
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  /* ---------- marquee loop (scroll velocity speeds it up and flips direction) ---------- */

  if (!reduced && bands.length) {
    let dir = 1;
    let prev = performance.now();
    const state = bands.map((b) => ({ ...b, track: $('.mq-track', b.el), x: 0, w: 0, on: false }));
    const measure = () => state.forEach((s) => (s.w = s.track.scrollWidth / 4));
    measure();
    window.addEventListener('resize', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((en) =>
        en.forEach((e) => {
          const s = state.find((x) => x.el === e.target);
          if (s) s.on = e.isIntersecting;
        })
      );
      state.forEach((s) => io.observe(s.el));
    } else state.forEach((s) => (s.on = true));

    const loop = (now) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (Math.abs(vel) > 2) dir = vel > 0 ? 1 : -1;
      const boost = Math.abs(vel) * 4;
      vel *= 0.9;
      state.forEach((s) => {
        if (!s.on || !s.w) return;
        s.x += (70 + boost) * dir * s.dir * dt;
        s.x = ((s.x % s.w) + s.w) % s.w;
        s.track.style.transform = `translate3d(${-s.x}px,0,0)`;
      });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ---------- go ---------- */

  runLoader();
})();
