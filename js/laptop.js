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
    { t: 'uday singh // firmware dev', c: '#8fa6cc' },
    { t: '$ ./flash --board samata', c: '#eaf6ff', prompt: true },
    { t: '[ok] eeg ........ online', c: '#22e5ff' },
    { t: '[ok] imu ........ online', c: '#22e5ff' },
    { t: '[ok] firmware .. running', c: '#22e5ff' },
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

  function glowTexture(inner, mid) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, inner || 'rgba(34,229,255,0.85)');
    grad.addColorStop(0.35, mid || 'rgba(47,107,255,0.4)');
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


  /* ---------- ESP32 dev board ---------- */

  function labelTexture(lines, w, h, color) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d');
    g.fillStyle = color || '#eaf6ff';
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    lines.forEach((l, i) => {
      g.font = `${l.size}px "Geist Pixel", monospace`;
      g.fillText(l.t, w / 2, l.y);
    });
    const tex = new THREE.CanvasTexture(cv);
    if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  // ~1.8:1 like a real ESP32-DevKitC (51 x 28 mm). 1 unit = ~2 cm.
  function buildESP32() {
    const g = new THREE.Group();
    const body = new THREE.Group(); // procedural board (fallback); hidden once the real model loads
    g.add(body);
    const BW = 2.5;
    const BD = 1.4;
    const BT = 0.07;

    const pcb = new THREE.MeshStandardMaterial({ color: 0x14306e, metalness: 0.25, roughness: 0.5, emissive: 0x0a1a45, emissiveIntensity: 0.6 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xb9c6dc, metalness: 0.9, roughness: 0.28 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xe5c35a, metalness: 0.85, roughness: 0.3 });
    const black = new THREE.MeshStandardMaterial({ color: 0x05070f, metalness: 0.2, roughness: 0.5 });

    const board = new THREE.Mesh(slab(BW, BD, BT, 0.06, 0.012), pcb);
    board.position.y = BT / 2;
    body.add(board);

    // glowing traces on the board (flat strips)
    const traceMat = new THREE.MeshBasicMaterial({ color: 0x22e5ff, transparent: true, opacity: 0.6, toneMapped: false });
    [[-0.2, 0.18, 0.9], [0.1, -0.12, 0.7], [0.5, 0.3, 0.5]].forEach(([x, z, len], i) => {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.012), traceMat);
      t.rotation.x = -Math.PI / 2;
      t.position.set(x, BT + 0.002, z);
      body.add(t);
      const t2 = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.25 + i * 0.1), traceMat);
      t2.rotation.x = -Math.PI / 2;
      t2.position.set(x + len / 2, BT + 0.002, z + 0.12);
      body.add(t2);
    });

    // WROOM module: silver shield + PCB antenna keep-out
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.09, 0.9), metal);
    shield.position.set(-BW / 2 + 0.62, BT + 0.045, 0);
    body.add(shield);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 0.5),
      new THREE.MeshBasicMaterial({
        map: labelTexture(
          [
            { t: 'ESP32', size: 82, y: 70 },
            { t: 'WROOM-32', size: 40, y: 150 },
          ],
          256,
          200,
          '#0a1226'
        ),
        transparent: true,
        toneMapped: false,
      })
    );
    label.rotation.x = -Math.PI / 2;
    label.position.set(shield.position.x, BT + 0.092, 0.02);
    body.add(label);
    // meander antenna
    const ant = new THREE.MeshBasicMaterial({ color: 0xe5c35a, toneMapped: false });
    const ax = -BW / 2 + 0.1;
    for (let i = 0; i < 5; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.3), ant);
      bar.position.set(ax + i * 0.045 - 0.0, BT + 0.007, i % 2 ? -0.12 : 0.12);
      body.add(bar);
    }
    const antBase = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.02), ant);
    antBase.position.set(ax + 0.09, BT + 0.007, 0.27);
    body.add(antBase);

    // pin headers: 19 per side
    const pinGeo = new THREE.BoxGeometry(0.05, 0.16, 0.05);
    const base = new THREE.BoxGeometry(2.0, 0.09, 0.1);
    const pins = new THREE.InstancedMesh(pinGeo, gold, 38);
    const m = new THREE.Matrix4();
    let n = 0;
    [-1, 1].forEach((side) => {
      const strip = new THREE.Mesh(base, black);
      strip.position.set(0.1, BT + 0.045, side * (BD / 2 - 0.1));
      body.add(strip);
      for (let i = 0; i < 19; i++) {
        m.setPosition(0.1 + (i - 9) * 0.105, BT + 0.1, side * (BD / 2 - 0.1));
        pins.setMatrixAt(n++, m);
      }
    });
    body.add(pins);

    // micro-USB at the far end + USB-UART chip + 2 tact buttons
    const usb = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.28), metal);
    usb.position.set(BW / 2 - 0.12, BT + 0.07, 0);
    body.add(usb);
    const usbHole = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.2), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    usbHole.rotation.y = Math.PI / 2;
    usbHole.position.set(BW / 2 + 0.051, BT + 0.07, 0);
    body.add(usbHole);
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.2), black);
    chip.position.set(BW / 2 - 0.55, BT + 0.02, 0.0);
    body.add(chip);
    [-0.32, 0.32].forEach((z, i) => {
      const btn = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.2), metal);
      btn.position.set(BW / 2 - 0.4, BT + 0.035, z);
      body.add(btn);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), new THREE.MeshStandardMaterial({ color: i ? 0x2f6bff : 0xeaf6ff, roughness: 0.5 }));
      cap.position.set(btn.position.x, BT + 0.09, z);
      body.add(cap);
    });

    // LEDs: steady power LED + blinking status LED (GPIO2 style)
    const ledGeo = new THREE.BoxGeometry(0.08, 0.04, 0.05);
    const powerMat = new THREE.MeshBasicMaterial({ color: 0xff4a5a, toneMapped: false });
    const power = new THREE.Mesh(ledGeo, powerMat);
    power.position.set(BW / 2 - 0.9, BT + 0.02, -0.36);
    g.add(power);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x22e5ff, toneMapped: false });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(BW / 2 - 0.9, BT + 0.02, 0.36);
    g.add(led);
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(led.position.x, BT + 0.06, led.position.z);
    g.add(halo);
    const ledLight = new THREE.PointLight(CYAN, 1.2, 2.6, 2);
    ledLight.position.set(led.position.x, 0.35, led.position.z);
    g.add(ledLight);

    // data pulses flying from the antenna toward the laptop (+x is toward the laptop once the board is turned)
    const pulses = [];
    const pulseGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
    for (let i = 0; i < 7; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: i % 2 ? 0x22e5ff : 0xeaf6ff, transparent: true, toneMapped: false });
      const p = new THREE.Mesh(pulseGeo, mat);
      p.visible = false;
      g.add(p);
      pulses.push(p);
    }

    // "WIFI" ring arcs from the antenna
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(
        new THREE.RingGeometry(0.28, 0.31, 28, 1, -0.8, 1.6),
        new THREE.MeshBasicMaterial({ color: 0x22e5ff, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })
      );
      r.rotation.x = -Math.PI / 2;
      r.position.set(-BW / 2 - 0.05, BT + 0.25, 0);
      r.rotation.z = Math.PI; // open toward -x (outward from antenna)
      g.add(r);
      rings.push(r);
    }

    return { group: g, body, ledMat, led, power, halo, ledLight, powerMat, pulses, rings, ledRGB: [0.13, 0.9, 1], ant: { x: -BW / 2 - 0.05, y: 0.25, z: 0 }, dims: { BW, BD, BT } };
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

    // ESP32 dev board standing next to the laptop (front-left), with its own float
    const esp = buildESP32();
    const espWrap = new THREE.Group();
    espWrap.add(esp.group);
    esp.group.rotation.set(0, 0, 0);
    esp.group.scale.setScalar(0.85);
    espWrap.rotation.set(0.28, 0.55, -0.12);
    floatGroup.add(espWrap);

    // ---- real Seeed XIAO ESP32-S3 (converted from the supplied STEP file) ----
    // meta values come from the conversion: units are scene units, long axis = x, USB-C at +x, antenna connector at -x
    const XIAO = {
      url: 'assets/xiao-esp32s3.glb',
      label: 'assets/xiao-label.jpg',
      shield: { x: [-0.842, 0.334], z: [-0.7, 0.701], top: 0.3614 },
      pcbTop: 0.139,
      ledUser: [0.6708, 0.6351], // blinks (amber)
      ledCharge: [0.6708, -0.6659], // steady (red)
      ant: { x: -1.06, y: 0.36, z: -0.53 },
    };

    function loadScript(src) {
      return new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = res;
        s.onerror = rej;
        document.head.appendChild(s);
      });
    }

    function makeEnv() {
      // tiny studio-ish sky so the metal parts (USB-C shell, gold pads) have something to reflect
      const cv = document.createElement('canvas');
      cv.width = 256;
      cv.height = 128;
      const g = cv.getContext('2d');
      const grad = g.createLinearGradient(0, 0, 0, 128);
      grad.addColorStop(0, '#5b7bb8');
      grad.addColorStop(0.45, '#17306e');
      grad.addColorStop(0.55, '#0a1634');
      grad.addColorStop(1, '#02030a');
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 128);
      g.fillStyle = '#ffffff';
      g.fillRect(40, 30, 60, 14); // soft box
      g.fillStyle = '#22e5ff';
      g.fillRect(170, 40, 50, 10); // cyan strip
      const tex = new THREE.CanvasTexture(cv);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const pm = new THREE.PMREMGenerator(renderer);
      const env = pm.fromEquirectangular(tex).texture;
      pm.dispose();
      tex.dispose();
      return env;
    }

    function loadXiao() {
      const ready = THREE.GLTFLoader ? Promise.resolve() : loadScript('js/vendor/GLTFLoader.js');
      ready
        .then(
          () =>
            new Promise((res, rej) => {
              new THREE.GLTFLoader().load(XIAO.url, res, undefined, rej);
            })
        )
        .then((gltf) => {
          const env = makeEnv();
          gltf.scene.traverse((o) => {
            if (!o.isMesh) return;
            o.material.envMap = env;
            o.material.envMapIntensity = 0.7;
            o.material.needsUpdate = true;
          });
          esp.body.visible = false;
          esp.group.add(gltf.scene);

          // the printed module label from the supplied top-view photo
          const tex = new THREE.TextureLoader().load(XIAO.label, () => reduced && renderStill());
          if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
          tex.anisotropy = 4;
          const sx = XIAO.shield.x[1] - XIAO.shield.x[0];
          const sz = XIAO.shield.z[1] - XIAO.shield.z[0];
          const label = new THREE.Mesh(
            new THREE.PlaneGeometry(sz, sx),
            new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.05, envMap: env, envMapIntensity: 0.25 })
          );
          label.rotation.set(-Math.PI / 2, 0, -Math.PI / 2); // image right -> +z, image up -> +x
          label.position.set((XIAO.shield.x[0] + XIAO.shield.x[1]) / 2, XIAO.shield.top + 0.003, (XIAO.shield.z[0] + XIAO.shield.z[1]) / 2);
          esp.group.add(label);

          // LEDs: amber user LED blinks, red charge LED stays on
          const y = XIAO.pcbTop + 0.012;
          esp.led.position.set(XIAO.ledUser[0], y, XIAO.ledUser[1]);
          esp.led.scale.set(1.1, 1, 1.1);
          esp.power.position.set(XIAO.ledCharge[0], y, XIAO.ledCharge[1]);
          esp.halo.position.set(XIAO.ledUser[0], y + 0.06, XIAO.ledUser[1]);
          esp.halo.scale.setScalar(0.8);
          esp.halo.material.map = glowTexture('rgba(255,176,48,0.9)', 'rgba(255,110,20,0.38)');
          esp.halo.material.needsUpdate = true;
          esp.ledLight.color.setHex(0xffb030);
          esp.ledLight.position.set(XIAO.ledUser[0], 0.4, XIAO.ledUser[1]);
          esp.ledRGB = [1, 0.69, 0.19];
          esp.ledMat.color.setRGB(1, 0.69, 0.19);

          // wifi arcs + data packets start at the antenna connector
          esp.ant = XIAO.ant;
          esp.rings.forEach((r) => r.position.set(XIAO.ant.x - 0.08, XIAO.ant.y, XIAO.ant.z));
          if (reduced) renderStill();
        })
        .catch((e) => console.warn('XIAO model failed, keeping the procedural board', e));
    }

    let espBase = { x: -2.7, y: -0.55, z: 1.5 };
    // wide screens: beside the laptop. Portrait screens: in front of it, so nothing is clipped.
    function placeEsp() {
      const portrait = aspect < 1;
      espBase = portrait ? { x: 0.2, y: -0.8, z: 1.35 } : { x: -2.7, y: -0.55, z: 1.5 };
      esp.group.scale.setScalar(portrait ? 0.55 : 0.85);
      espWrap.position.set(espBase.x, espBase.y, espBase.z);
    }
    loadXiao();

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
    let firstFrame = true;

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
        s0 = Math.min(v.h * 0.55 / 2.5, (v.w * 0.46) / (W + 1.7));
        a = { x: v.w * 0.2, y: 0, s: s0 };
        b = { x: v.w * 0.3, y: v.h * 0.12, s: s0 * 0.58 };
      } else {
        s0 = Math.min(v.h * 0.3 / 2.5, (v.w * 0.8) / (W + 0.6));
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
      placeEsp();
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
      const k = reduced || firstFrame ? 1 : 1 - Math.exp(-dt * 5);
      firstFrame = false;
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

      // ESP32: hover, blinking status LED, data pulses to the laptop, wifi rings
      espWrap.position.y = espBase.y + (reduced ? 0 : Math.sin(t * 1.3 + 1.2) * 0.09);
      const on = reduced ? true : Math.floor(t * 2) % 2 === 0; // 1 Hz blink
      const k2 = on ? 1 : 0.08;
      esp.ledMat.color.setRGB(esp.ledRGB[0] * k2 + 0.02, esp.ledRGB[1] * k2 + 0.02, esp.ledRGB[2] * k2 + 0.02);
      esp.halo.material.opacity = on ? 0.95 : 0.0;
      esp.halo.visible = on;
      esp.ledLight.intensity = on ? 1.4 : 0;
      esp.powerMat.color.setRGB(1, 0.29 + (reduced ? 0 : Math.sin(t * 3) * 0.02), 0.35);
      if (!reduced) {
        // pulses travel along an arc from the board's antenna end to the laptop (local to esp.group -> target is +x, up, back)
        esp.pulses.forEach((p, i) => {
          const u = (((t * 0.45 + i / esp.pulses.length) % 1) + 1) % 1;
          // bezier: start at antenna (-1.25,0.2,0), control up high, end near laptop left edge
          const sx = esp.ant.x, sy = esp.ant.y, sz = esp.ant.z;
          const ex = 6.0, ey = 1.2, ez = -3.0;
          const cx = 1.0, cy = 3.2, cz = -1.0;
          const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, d = u * u;
          p.position.set(a * sx + b * cx + d * ex, a * sy + b * cy + d * ey, a * sz + b * cz + d * ez);
          p.visible = true;
          p.material.opacity = Math.sin(u * Math.PI);
          p.rotation.set(t * 2 + i, t * 3 + i, 0);
        });
        esp.rings.forEach((r, i) => {
          const u = (t * 0.7 + i / 3) % 1;
          r.scale.setScalar(0.4 + u * 2.4);
          r.material.opacity = (1 - u) * 0.7;
        });
      } else {
        esp.pulses.forEach((p) => (p.visible = false));
        esp.rings.forEach((r, i) => {
          r.scale.setScalar(0.5 + i * 0.9);
          r.material.opacity = 0.6 - i * 0.18;
        });
      }
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
      s.src = 'js/vendor/GLTFLoader.js';
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
