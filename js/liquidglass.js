/*
 * Liquid glass refraction for every glass surface on the page (Chromium: Chrome, Edge, Brave, Opera, Android Chrome).
 *
 * Same look as dashersw/liquid-glass-js (bent light at the edges, rim light, blur, tint) but LIVE: it uses an SVG
 * displacement map in `backdrop-filter`, so the glass refracts whatever is really behind it (ocean, 3D laptop,
 * moving marquee). liquid-glass-js itself photographs the page once with html2canvas and uses one WebGL context per
 * element, which can't see WebGL content and caps out near 16 elements, so it can't cover a whole site.
 *
 * Other browsers (Safari, Firefox) keep the CSS-only version in styles/liquid.css: blur, rim light and tint.
 * Turn everything off by removing class="liquid" from <html> in index.html.
 */
(function () {
  'use strict';

  const root = document.documentElement;
  if (!root.classList.contains('liquid')) return;

  const ua = navigator.userAgent;
  const chromium = /Chrome\/|Chromium\//.test(ua) && !/Firefox\/|FxiOS|CriOS|EdgiOS/.test(ua);
  if (!chromium) return;

  // selectors that get real refraction (keep in sync with styles/liquid.css)
  const SELECTOR = ['.glass', '.btn', '.tl-card', '.quote', '.nav', '.palette-box', '.ghp', '.tag', '.browser', '.media'].join(',');
  const SKIP_BIG = 1400 * 900; // px^2: bigger than this is left on the CSS blur (it would cost too much per frame)

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;pointer-events:none';
  const defs = document.createElementNS(NS, 'defs');
  svg.appendChild(defs);
  document.body.appendChild(svg);

  /* ---------- displacement maps ---------- */

  const maps = new Map(); // quantised size -> data URL
  function mapURL(w, h, r, bezel) {
    const qw = Math.round(w / 8) * 8;
    const qh = Math.round(h / 8) * 8;
    const key = `${qw}x${qh}x${Math.round(r)}x${Math.round(bezel)}`;
    if (maps.has(key)) return maps.get(key);
    const sc = Math.min(1, 220 / Math.max(w, h));
    const W = Math.max(8, Math.round(w * sc));
    const H = Math.max(8, Math.round(h * sc));
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H);
    const hx = w / 2;
    const hy = h / 2;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = (x + 0.5) / sc;
        const py = (y + 0.5) / sc;
        const dx = px - hx;
        const dy = py - hy;
        const qx = Math.abs(dx) - (hx - r);
        const qy = Math.abs(dy) - (hy - r);
        const ox = Math.max(qx, 0);
        const oy = Math.max(qy, 0);
        const out = Math.hypot(ox, oy);
        const d = r - (out + Math.min(Math.max(qx, qy), 0)); // distance inside the edge (>0 inside)
        let R = 128;
        let G = 128;
        if (d >= 0 && d < bezel) {
          // outward normal of the rounded rectangle at this point
          let nx;
          let ny;
          if (qx > 0 && qy > 0) {
            nx = (Math.sign(dx) * ox) / out;
            ny = (Math.sign(dy) * oy) / out;
          } else if (qx > qy) {
            nx = Math.sign(dx);
            ny = 0;
          } else {
            nx = 0;
            ny = Math.sign(dy);
          }
          const t = d / bezel; // 0 at the very edge, 1 at the inner end of the bezel
          const mag = Math.pow(1 - t, 2.4); // strongest right at the rim, like a convex lens
          // sample from further inside, so the rim shows squeezed, bent interior content
          R = 128 - nx * mag * 127;
          G = 128 - ny * mag * 127;
        }
        const i = (y * W + x) * 4;
        img.data[i] = R;
        img.data[i + 1] = G;
        img.data[i + 2] = 128;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const url = cv.toDataURL('image/png');
    maps.set(key, url);
    return url;
  }

  /* ---------- one filter per exact element size ---------- */

  const filters = new Map(); // "WxH:url" -> id
  let uid = 0;
  function filterId(w, h, r, bezel) {
    const url = mapURL(w, h, r, bezel);
    const key = `${w}x${h}:${url.length}:${Math.round(r)}:${Math.round(bezel)}`;
    if (filters.has(key)) return filters.get(key);
    const id = 'lg-' + ++uid;
    const f = document.createElementNS(NS, 'filter');
    f.setAttribute('id', id);
    f.setAttribute('filterUnits', 'userSpaceOnUse');
    f.setAttribute('primitiveUnits', 'userSpaceOnUse');
    f.setAttribute('x', '0');
    f.setAttribute('y', '0');
    f.setAttribute('width', String(w));
    f.setAttribute('height', String(h));
    f.setAttribute('color-interpolation-filters', 'sRGB');
    const im = document.createElementNS(NS, 'feImage');
    im.setAttribute('href', url);
    im.setAttribute('x', '0');
    im.setAttribute('y', '0');
    im.setAttribute('width', String(w));
    im.setAttribute('height', String(h));
    im.setAttribute('preserveAspectRatio', 'none');
    im.setAttribute('result', 'map');
    const disp = document.createElementNS(NS, 'feDisplacementMap');
    disp.setAttribute('in', 'SourceGraphic');
    disp.setAttribute('in2', 'map');
    disp.setAttribute('scale', String(Math.round(bezel * 1.8)));
    disp.setAttribute('xChannelSelector', 'R');
    disp.setAttribute('yChannelSelector', 'G');
    f.appendChild(im);
    f.appendChild(disp);
    defs.appendChild(f);
    filters.set(key, id);
    return id;
  }

  /* ---------- apply to elements ---------- */

  const tracked = new WeakSet();
  const ro = 'ResizeObserver' in window ? new ResizeObserver((entries) => entries.forEach((e) => schedule(e.target))) : null;
  const pending = new Set();
  let raf = 0;
  function schedule(el) {
    pending.add(el);
    if (!raf)
      raf = requestAnimationFrame(() => {
        raf = 0;
        pending.forEach(apply);
        pending.clear();
      });
  }

  function radiusOf(el, w, h) {
    const v = getComputedStyle(el).borderTopLeftRadius || '0';
    const n = parseFloat(v) || 0;
    const px = v.indexOf('%') > -1 ? (n / 100) * Math.min(w, h) : n;
    return Math.min(px, Math.min(w, h) / 2);
  }

  function apply(el) {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!w || !h || w * h > SKIP_BIG) {
      el.style.removeProperty('backdrop-filter');
      el.style.removeProperty('-webkit-backdrop-filter');
      return;
    }
    const r = radiusOf(el, w, h);
    const bezel = Math.max(5, Math.min(26, Math.min(w, h) * 0.42));
    const id = filterId(w, h, r, bezel);
    const blur = Math.min(h, w) < 60 ? 3 : 7;
    // refraction first, then a soft blur and a little punch, like thick glass
    el.style.setProperty('backdrop-filter', `url(#${id}) blur(${blur}px) saturate(1.7) brightness(1.1)`);
  }

  function track(el) {
    if (tracked.has(el)) return;
    tracked.add(el);
    schedule(el);
    if (ro) ro.observe(el);
  }
  function scan(rootNode) {
    if (rootNode.nodeType !== 1) return;
    if (rootNode.matches && rootNode.matches(SELECTOR)) track(rootNode);
    rootNode.querySelectorAll && rootNode.querySelectorAll(SELECTOR).forEach(track);
  }

  scan(document.body);
  new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach(scan))).observe(document.body, { childList: true, subtree: true });
  // fonts change text widths, which change chip/button sizes
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => document.querySelectorAll(SELECTOR).forEach(schedule));

  /* ---------- automatic lite mode on slow devices ---------- */

  // watch ~2 s of frames shortly after load; if they are slow, drop the refraction (keeps the look, loses the bending)
  function goLite() {
    root.classList.add('liquid-lite');
    document.querySelectorAll('[style*="backdrop-filter"]').forEach((el) => el.style.removeProperty('backdrop-filter'));
    document.querySelectorAll(SELECTOR).forEach((el) => tracked.delete && el);
    ro && ro.disconnect();
  }
  function probe() {
    let n = 0;
    let last = performance.now();
    let sum = 0;
    const f = (now) => {
      const dt = now - last;
      last = now;
      if (dt < 400) {
        sum += dt;
        n++;
      }
      if (n >= 90) return sum / n > 42 && goLite();
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }
  if (!/[?&]nolite\b/.test(location.search)) setTimeout(() => (document.hidden ? 0 : probe()), 9000);

  /* ---------- pointer light across glass ---------- */

  let lastEl = null;
  let px = 0;
  let py = 0;
  let pend = false;
  document.addEventListener(
    'pointermove',
    (e) => {
      px = e.clientX;
      py = e.clientY;
      lastEl = e.target.closest && e.target.closest('.glass, .tl-card, .quote');
      if (!lastEl || pend) return;
      pend = true;
      requestAnimationFrame(() => {
        pend = false;
        if (!lastEl) return;
        const r = lastEl.getBoundingClientRect();
        lastEl.style.setProperty('--gx', px - r.left + 'px');
        lastEl.style.setProperty('--gy', py - r.top + 'px');
      });
    },
    { passive: true }
  );
})();
