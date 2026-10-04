/*
 * Floating 3D laptop for the hero. Needs global THREE (three.js r128 from cdnjs).
 *
 *   const hero = LaptopHero.init({
 *     canvas,            // <canvas> inside a fixed .laptop-stage
 *     zone,              // element(s) where the laptop is relevant (hero + about); paused when off-screen
 *     track,             // element whose height drives the "shrink and drift aside" scroll move
 *     glbUrl,            // optional: swap the procedural laptop for your own model
 *     onFallback(err),   // called if WebGL is unavailable
 *   });
 *
 * GLB hook: hero.loadGLB('/models/laptop.glb') or hero.setModel(object3D).
 *   - a mesh named "Screen" gets the live terminal texture
 *   - an object named "Lid" is used as the hinge and animated open on load
 */
(function (global) {
  'use strict';

  const CYAN = 0x22e5ff;
  const BLUE = 0x2f6bff;
  const BLUE_DEEP = 0x0f2a80;

  // laptop dimensions (world units)
  const W = 3.2;
  const D = 2.2;
  const BASE_T = 0.12;
  const LID_T = 0.07;
  const LID_GAP = 0.07;
  const SCREEN_W = 2.9;
  const SCREEN_H = 1.85;
  const OPEN_ANGLE = (105 * Math.PI) / 180;

  const CAM_Z = 9.5;
  const FOV = 35;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const smoothstep = (a, b, v) => {
    const t = clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  /* ---------- geometry helpers ---------- */

  function roundedRectShape(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  // rounded slab: w along x, d along z, t along y, centered on origin
  function slab(w, d, t, r, bevel) {
    const geo = new THREE.ExtrudeGeometry(roundedRectShape(w - bevel * 2, d - bevel * 2, r), {
      depth: t - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
      curveSegments: 10,
    });
    geo.rotateX(-Math.PI / 2);
    geo.center();
    return geo;
  }

  /* ---------- terminal screen (canvas texture) ---------- */

  const TERM_LINES = [
    { t: '$ whoami', c: '#eaf6ff', prompt: true },
    { t: 'uday singh // firmware + hardware', c: '#8fa6cc' },
    { t: '$ ./flash --board samata', c: '#eaf6ff', prompt: true },
    { t: '[ok] eeg ........ 250hz', c: '#22e5ff' },
    { t: '[ok] imu ........ 100hz', c: '#22e5ff' },
    { t: '[ok] ble ........ paired', c: '#22e5ff' },
    { t: '$ ./talk --to software', c: '#eaf6ff', prompt: true },
    { t: '> hello, world', c: '#2f6bff' },
  ];
  const TERM_TOTAL = TERM_LINES.reduce((n, l) => n + l.t.length, 0);
  const TYPE_CPS = 34;
  const TYPE_LOOP = TERM_TOTAL / TYPE_CPS + 5;

  function createTerminal() {
    const cw = 1024;
    const ch = Math.round((cw * SCREEN_H) / SCREEN_W);
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    if ('encoding' in texture) texture.encoding = THREE.sRGBEncoding;
    let lastKey = '';

    function draw(t, still, force) {
      const chars = still ? TERM_TOTAL : Math.min(TERM_TOTAL, Math.floor((t % TYPE_LOOP) * TYPE_CPS));
      const typing = chars < TERM_TOTAL;
      const blink = still || typing || Math.floor(t * 1.9) % 2 === 0;
      const key = chars + ':' + blink;
      if (!force && key === lastKey) return false;
      lastKey = key;

      const bg = ctx.createLinearGradient(0, 0, 0, ch);
      bg.addColorStop(0, '#071026');
      bg.addColorStop(1, '#050a1a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cw, ch);

      // title bar
      ctx.fillStyle = 'rgba(47,107,255,0.14)';
      ctx.fillRect(0, 0, cw, 62);
      ['#22e5ff', '#2f6bff', '#8fa6cc'].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(34 + i * 34, 22, 18, 18);
      });
      ctx.font = '26px "Geist Pixel", monospace';
      ctx.fillStyle = '#8fa6cc';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('uday@bench: ~/samata', 150, 42);

      // text
      ctx.font = '34px "Geist Pixel", monospace';
      let left = chars;
      let cursorX = 48;
      let cursorY = 118;
      for (let i = 0; i < TERM_LINES.length; i++) {
        const line = TERM_LINES[i];
        const y = 118 + i * 58;
        const shown = line.t.slice(0, Math.max(0, left));
        left -= line.t.length;
        if (shown) {
          ctx.fillStyle = line.c;
          ctx.fillText(shown, 48, y);
          cursorX = 48 + ctx.measureText(shown).width + 6;
          cursorY = y;
        }
        if (left <= 0) break;
      }
      if (blink) {
        ctx.fillStyle = '#22e5ff';
        ctx.shadowColor = '#22e5ff';
        ctx.shadowBlur = 18;
        ctx.fillRect(cursorX, cursorY - 28, 18, 34);
        ctx.shadowBlur = 0;
      }

      // scanlines + vignette
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      for (let y = 0; y < ch; y += 4) ctx.fillRect(0, y, cw, 1);
      const vg = ctx.createRadialGradient(cw / 2, ch / 2, ch * 0.35, cw / 2, ch / 2, cw * 0.65);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, cw, ch);

      texture.needsUpdate = true;
      return true;
    }

    return { texture, draw };
  }

  function glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(34,229,255,0.85)');
    grad.addColorStop(0.35, 'rgba(47,107,255,0.4)');
    grad.addColorStop(1, 'rgba(15,42,128,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  /* ---------- procedural laptop ---------- */

  function buildLaptop(screenMat) {
    const laptop = new THREE.Group();

    const shell = new THREE.MeshStandardMaterial({ color: 0x141d40, metalness: 0.6, roughness: 0.48 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0a1226, metalness: 0.3, roughness: 0.6 });

    // base
    const base = new THREE.Mesh(slab(W, D, BASE_T, 0.16, 0.025), shell);
    base.position.y = BASE_T / 2;
    laptop.add(base);

    // keyboard deck (backlight glow between keys)
    const deck = new THREE.Mesh(
      new THREE.PlaneGeometry(W - 0.36, 1.2),
      new THREE.MeshBasicMaterial({ color: 0x123a8c, toneMapped: false })
    );
    deck.rotation.x = -Math.PI / 2;
    deck.position.set(0, BASE_T + 0.002, -0.28);
    laptop.add(deck);

    // keys
    const cols = 14;
    const rows = 4;
    const pitch = 0.195;
    const keyGeo = new THREE.BoxGeometry(0.165, 0.045, 0.165);
    const keys = new THREE.InstancedMesh(keyGeo, dark, cols * rows);
    const m = new THREE.Matrix4();
    let n = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        m.setPosition((c - (cols - 1) / 2) * pitch, BASE_T + 0.022, -0.74 + r * pitch);
        keys.setMatrixAt(n++, m);
      }
    }
    laptop.add(keys);
    // space row
    const space = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.045, 0.165), dark);
    space.position.set(0, BASE_T + 0.022, -0.74 + rows * pitch);
    laptop.add(space);
    [-1, 1].forEach((s) => {
      const k = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.045, 0.165), dark);
      k.position.set(s * 1.1, BASE_T + 0.022, -0.74 + rows * pitch);
      laptop.add(k);
    });

    // trackpad
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x142046, metalness: 0.4, roughness: 0.35 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, BASE_T + 0.003, 0.76);
    laptop.add(pad);

    // hinge pivot at back edge
    const hinge = new THREE.Group();
    hinge.name = 'Lid';
    hinge.position.set(0, BASE_T, -D / 2 + 0.05);
    laptop.add(hinge);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, W * 0.6, 16), dark);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0, 0.02, 0);
    hinge.add(barrel);

    const lidD = D - 0.1;
    const lid = new THREE.Mesh(slab(W, lidD, LID_T, 0.16, 0.025), shell);
    lid.position.set(0, LID_GAP + LID_T / 2, lidD / 2);
    hinge.add(lid);

    // inner face (viewer looks at it from -y of the lid frame): bezel then screen, each a hair closer
    const bezel = new THREE.Mesh(
      new THREE.PlaneGeometry(W - 0.14, lidD - 0.14),
      new THREE.MeshBasicMaterial({ color: 0x02040a, toneMapped: false })
    );
    bezel.rotation.x = Math.PI / 2;
    bezel.position.set(0, LID_GAP - 0.002, lidD / 2);
    hinge.add(bezel);

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), screenMat);
    screen.name = 'Screen';
    screen.rotation.x = Math.PI / 2;
    screen.position.set(0, LID_GAP - 0.005, lidD / 2 + 0.02);
    hinge.add(screen);

    return { laptop, hinge };
  }

  /* ---------- scene ---------- */

  function init(opts) {
    opts = opts || {};
    const canvas = opts.canvas;
    const reduced = global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = global.matchMedia('(pointer: coarse)').matches;
    document.documentElement.classList.toggle('reduced-motion', reduced);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (err) {
      document.documentElement.classList.add('no-webgl');
      if (opts.onFallback) opts.onFallback(err);
      return null;
    }
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    else renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    camera.position.set(0, 1.4, CAM_Z);
    camera.lookAt(0, 0.1, 0);

    // lights: soft fill, blue key from front, cyan rim from behind
    scene.add(new THREE.HemisphereLight(0x5f86ff, 0x050a1c, 0.35));
    const key = new THREE.DirectionalLight(0xbcd6ff, 0.65);
    key.position.set(2.5, 4, 5);
    scene.add(key);
    const rimA = new THREE.DirectionalLight(CYAN, 2.4);
    rimA.position.set(-4, 2.5, -4);
    scene.add(rimA);
    const rimB = new THREE.DirectionalLight(BLUE, 1.8);
    rimB.position.set(4, 1, -3);
    scene.add(rimB);
    const under = new THREE.PointLight(CYAN, 1.4, 6, 2);
    under.position.set(0, -1.6, 0.5);
    scene.add(under);

    // root moves/scales with scroll; floatGroup bobs and rotates
    const root = new THREE.Group();
    const floatGroup = new THREE.Group();
    root.add(floatGroup);
    scene.add(root);

    const terminal = createTerminal();
    const screenMat = new THREE.MeshBasicMaterial({ map: terminal.texture, toneMapped: false });
    screenMat.color.setScalar(0);

    let model = buildLaptop(screenMat);
    model.laptop.position.set(0, -0.95, 0.2);
    floatGroup.add(model.laptop);

    // glow pool under the laptop
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 7),
      new THREE.MeshBasicMaterial({
        map: glowTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(0, -1.75, 0.2);
    root.add(glow);

    // particles
    const COUNT = 220;
    const pos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 9;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8 - 1;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const particles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        color: CYAN,
        size: 0.055,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    scene.add(particles);

    /* ---------- state ---------- */

    const state = {
      open: reduced ? 1 : 0,
      x: 0, y: 0, s: 1, // smoothed root transform
      px: 0, py: 0, // smoothed pointer
      mx: 0, my: 0, // raw pointer
    };
    let aspect = 1;
    let visible = true;
    let raf = 0;
    let last = 0;
    let startT = null;

    function visSize() {
      const h = 2 * CAM_Z * Math.tan((FOV * Math.PI) / 360);
      return { w: h * aspect, h };
    }

    // p: 0 = hero, 1 = drifted aside (About)
    function targetFor(p) {
      const v = visSize();
      const desktop = aspect >= 1;
      let s0;
      let a;
      let b;
      if (desktop) {
        s0 = Math.min(v.h * 0.55 / 2.5, (v.w * 0.42) / (W + 0.1));
        a = { x: v.w * 0.2, y: 0, s: s0 };
        b = { x: v.w * 0.3, y: v.h * 0.12, s: s0 * 0.58 };
      } else {
        s0 = Math.min(v.h * 0.3 / 2.5, (v.w * 0.74) / (W + 0.1));
        a = { x: 0, y: v.h * 0.2, s: s0 };
        b = { x: v.w * 0.24, y: v.h * 0.36, s: s0 * 0.5 };
      }
      const e = easeOutCubic(p);
      return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), s: lerp(a.s, b.s, e) };
    }

    function scrollProgress() {
      if (typeof opts.progress === 'function') return clamp(opts.progress(), 0, 1);
      if (reduced) return 0;
      const el = opts.track;
      const h = el ? el.offsetHeight : global.innerHeight;
      return clamp(global.scrollY / (h * 0.85), 0, 1);
    }

    function resize() {
      const parent = canvas.parentElement || canvas;
      const w = Math.max(1, parent.clientWidth);
      const h = Math.max(1, parent.clientHeight);
      renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      aspect = w / h;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      terminal.texture.anisotropy = Math.min(4, maxAniso);
    }

    function update(t, dt) {
      if (startT === null) startT = t;
      const since = t - startT;

      // lid opens on load
      if (!reduced) state.open = easeOutCubic(clamp((since - 0.5) / 1.8, 0, 1));
      const hinge = model.hinge;
      if (hinge) hinge.rotation.x = -OPEN_ANGLE * state.open;
      screenMat.color.setScalar(smoothstep(0.3, 0.85, state.open));

      // scroll-driven root transform (damped)
      const tgt = targetFor(scrollProgress());
      const k = reduced ? 1 : 1 - Math.exp(-dt * 5);
      state.x = lerp(state.x, tgt.x, k);
      state.y = lerp(state.y, tgt.y, k);
      state.s = lerp(state.s, tgt.s, k);
      root.position.set(state.x, state.y, 0);
      root.scale.setScalar(state.s);

      // float + rotation
      const bob = Math.sin(t * 1.1) * 0.12;
      floatGroup.position.y = reduced ? 0 : bob;
      const pk = 1 - Math.exp(-dt * 4);
      state.px = lerp(state.px, state.mx, pk);
      state.py = lerp(state.py, state.my, pk);
      if (reduced) {
        floatGroup.rotation.set(0.12, -0.28, 0);
      } else if (coarse) {
        // touch devices: no cursor, so just auto-rotate
        floatGroup.rotation.y = Math.sin(t * 0.35) * 0.5 - 0.15;
        floatGroup.rotation.x = 0.12 + Math.sin(t * 0.5) * 0.03;
      } else {
        floatGroup.rotation.y = -0.2 + Math.sin(t * 0.22) * 0.2 + state.px * 0.4;
        floatGroup.rotation.x = 0.12 + Math.sin(t * 0.5) * 0.03 - state.py * 0.18;
      }
      floatGroup.rotation.z = reduced ? 0 : Math.sin(t * 0.8) * 0.012;

      // glow breathes inversely to the bob (laptop rises -> pool dims)
      glow.material.opacity = reduced ? 0.8 : 0.8 - bob * 1.6;
      under.intensity = 1.4 - bob * 2;

      particles.rotation.y = t * 0.012;
      particles.position.y = Math.sin(t * 0.2) * 0.15;

      terminal.draw(t, reduced, false);
    }

    function frame(now) {
      raf = global.requestAnimationFrame(frame);
      const t = now / 1000;
      const dt = Math.min(0.05, Math.max(0.001, t - last));
      last = t;
      update(t, dt);
      renderer.render(scene, camera);
    }

    function start() {
      if (raf || reduced) return;
      last = performance.now() / 1000;
      raf = global.requestAnimationFrame(frame);
    }
    function stop() {
      if (raf) global.cancelAnimationFrame(raf);
      raf = 0;
    }
    function sync() {
      if (visible && !document.hidden) start();
      else stop();
    }

    function renderStill() {
      update(0, 1);
      terminal.draw(0, true, true);
      renderer.render(scene, camera);
    }

    /* ---------- wiring ---------- */

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) renderStill();
    });
    ro.observe(canvas.parentElement || canvas);
    resize();

    const onPointer = (e) => {
      state.mx = (e.clientX / global.innerWidth) * 2 - 1;
      state.my = (e.clientY / global.innerHeight) * 2 - 1;
    };
    if (!coarse && !reduced) global.addEventListener('pointermove', onPointer, { passive: true });

    const onVis = () => sync();
    document.addEventListener('visibilitychange', onVis);

    let io = null;
    const zones = [].concat(opts.zone || []);
    if (zones.length && 'IntersectionObserver' in global) {
      const seen = new Map();
      io = new IntersectionObserver((entries) => {
        entries.forEach((en) => seen.set(en.target, en.isIntersecting));
        visible = [...seen.values()].some(Boolean);
        if (opts.stage) opts.stage.classList.toggle('is-hidden', !visible);
        sync();
      });
      zones.forEach((z) => io.observe(z));
    }

    // redraw terminal once the pixel font arrives
    if (document.fonts && document.fonts.load) {
      document.fonts.load('34px "Geist Pixel"').then(() => terminal.draw(0, reduced, true), () => {});
    }

    if (reduced) renderStill();
    else sync();

    /* ---------- model swap hook ---------- */

    function setModel(obj) {
      floatGroup.remove(model.laptop);
      let hinge = obj.getObjectByName('Lid') || null;
      obj.traverse((o) => {
        if (o.isMesh && /screen/i.test(o.name)) o.material = screenMat;
      });
      obj.position.set(0, -0.95, 0.2);
      floatGroup.add(obj);
      model = { laptop: obj, hinge };
      if (reduced) renderStill();
    }

    function loadGLB(url) {
      const go = () => {
        new THREE.GLTFLoader().load(url, (gltf) => setModel(gltf.scene), undefined, (e) => console.warn('GLB failed', e));
      };
      if (THREE.GLTFLoader) return go();
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
      s.onload = go;
      document.head.appendChild(s);
    }

    if (opts.glbUrl) loadGLB(opts.glbUrl);
    if (opts.onReady) opts.onReady();

    return {
      setModel,
      loadGLB,
      destroy() {
        stop();
        ro.disconnect();
        if (io) io.disconnect();
        global.removeEventListener('pointermove', onPointer);
        document.removeEventListener('visibilitychange', onVis);
        renderer.dispose();
      },
    };
  }

  global.LaptopHero = { init };
})(window);
