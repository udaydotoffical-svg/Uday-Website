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
  const SCREEN_W = 2.99; // 13" 3:2 display
  const SCREEN_H = 1.99;
  const OPEN_ANGLE = (115 * Math.PI) / 180;

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

  /* ---------- fastfetch easter egg data ---------- */

  const ARCH_LOGO = [
    '                  -`',
    '                 .o+`',
    '                `ooo/',
    '               `+oooo:',
    '              `+oooooo:',
    '              -+oooooo+:',
    '            `/:-:++oooo+:',
    '           `/++++/+++++++:',
    '          `/++++++++++++++:',
    '         `/+++ooooooooooooo/`',
    '        ./ooosssso++osssssso+`',
    '       .oossssso-````/ossssss+`',
    '      -osssssso.      :ssssssso.',
    '     :osssssss/        osssso+++.',
    '    /ossssssss/        +ssssooo/-',
    '  `/ossssso+/:-        -:/+osssso+-',
    ' `+sso+:-`                 `.-/+oso:',
    '`++:.                           `-/+/',
    '.`                                 `/',
  ];
  // Placeholder readout for a Surface Pro 11 running Arch Linux ARM. Edit freely: the display (13" 2880x1920 @ 120 Hz)
  // and chip family (Snapdragon X, 10-core X Plus) match the device; kernel, uptime, packages, DE and memory used are
  // just plausible values.
  const FETCH_INFO = [
    { k: '', v: 'uday@arch', c: '#22e5ff' },
    { k: '', v: '---------', c: '#8fa6cc' },
    { k: 'OS', v: 'Arch Linux ARM aarch64' },
    { k: 'Host', v: 'Microsoft Surface Pro 11' },
    { k: 'Kernel', v: 'Linux 6.18.2-arch1' },
    { k: 'Uptime', v: '3 hours, 14 mins' },
    { k: 'Packages', v: '842 (pacman)' },
    { k: 'Shell', v: 'zsh 5.9' },
    { k: 'Display', v: '2880x1920 @ 120 Hz' },
    { k: 'DE', v: 'KDE Plasma 6.5' },
    { k: 'Terminal', v: 'kitty' },
    { k: 'CPU', v: 'Snapdragon X Plus (10)' },
    { k: 'GPU', v: 'Qualcomm Adreno X1' },
    { k: 'Memory', v: '4.1 GiB / 15.6 GiB' },
    { k: 'Motto', v: 'I use arch btw' },
  ];
  const FONT5X7 = {
    I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
    U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
    H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  };
  // fastfetch screen grid (readable size) and a separate, chunkier grid for the banner letters
  const EGG = { CW: 13, CH: 22, COLS: 72, TOP: 86, LEFT: 14, S: 20 };
  const EGG_T = { type: 0.8, out: 2.2, hold: 5.2, morph: 7.3, banner: 13.0, end: 13.6 };

  // banner text -> list of cells {c, r, ch, col} on a grid of S x S pixel cells (one character per font pixel)
  function bannerCells(lines, cols, rows) {
    const out = [];
    const total = lines.length * 7 + (lines.length - 1) * 2;
    let r0 = Math.max(0, Math.floor((rows - total) / 2));
    lines.forEach((text) => {
      const widths = [...text].map((chr) => (chr === ' ' ? 3 : 6));
      const w = widths.reduce((a, b) => a + b, 0) - 1;
      let x = Math.floor((cols - w) / 2);
      [...text].forEach((chr, i) => {
        const glyph = FONT5X7[chr];
        if (glyph)
          glyph.forEach((row, ry) =>
            [...row].forEach((bit, rx) => {
              if (bit === '#') out.push({ c: x + rx, r: r0 + ry, ch: '#@#%'[(rx + ry) % 4], col: ry < 4 ? '#eaf6ff' : '#22e5ff' });
            })
          );
        x += widths[i];
      });
      r0 += 9;
    });
    return out;
  }

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
    let bootT0 = 0; // the normal typing loop restarts from here
    let pendingEgg = false;
    let egg = null; // { t0, grid... } while the easter egg runs
    let eggStill = false;
    let lastEggDraw = -1;

    const ROWS = Math.floor((ch - EGG.TOP - 10) / EGG.CH);
    const fetchGrid = Array.from({ length: ROWS }, () => Array(EGG.COLS).fill(null));
    const put = (r, c0, str, col) => [...str].forEach((chr, i) => chr !== ' ' && (fetchGrid[r][c0 + i] = { ch: chr, col }));
    put(0, 0, '$ fastfetch', '#eaf6ff');
    ARCH_LOGO.forEach((line, i) => put(2 + i, 0, line, '#22e5ff'));
    const INFO_COL = 38;
    FETCH_INFO.forEach((it, i) => {
      const r = 4 + i;
      if (it.k) {
        put(r, INFO_COL, it.k + ':', '#22e5ff');
        put(r, INFO_COL + it.k.length + 2, it.v, '#eaf6ff');
      } else put(r, INFO_COL, it.v, it.c);
    });
    const SWATCH = ['#05070f', '#0f2a80', '#2f6bff', '#22e5ff', '#8fa6cc', '#eaf6ff'];
    const swatchRow = 4 + FETCH_INFO.length + 1;
    const BCOLS = Math.floor((cw - 24) / EGG.S);
    const BROWS = Math.floor((ch - 62 - 10) / EGG.S);
    const bCells = bannerCells(['I USE', 'ARCH BTW'], BCOLS, BROWS).map((cell) => {
      const dx = (cell.c - BCOLS / 2) / (BCOLS / 2);
      const dy = (cell.r - BROWS / 2) / (BROWS / 2);
      return Object.assign(cell, { d: Math.min(1, Math.hypot(dx, dy) / 1.2), rnd: Math.random() });
    });
    const rnd = Array.from({ length: ROWS }, () => Array.from({ length: EGG.COLS }, () => Math.random()));
    const GL = '!<>-_/[]{}=+*^?#01XKZ%&@';

    function frameStart(title) {
      const bg = ctx.createLinearGradient(0, 0, 0, ch);
      bg.addColorStop(0, '#071026');
      bg.addColorStop(1, '#050a1a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = 'rgba(47,107,255,0.14)';
      ctx.fillRect(0, 0, cw, 62);
      ['#22e5ff', '#2f6bff', '#8fa6cc'].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(34 + i * 34, 22, 18, 18);
      });
      ctx.font = '26px "Geist Pixel", monospace';
      ctx.fillStyle = '#8fa6cc';
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillText(title, 150, 42);
    }
    function frameEnd() {
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      for (let y = 0; y < ch; y += 4) ctx.fillRect(0, y, cw, 1);
      const vg = ctx.createRadialGradient(cw / 2, ch / 2, ch * 0.35, cw / 2, ch / 2, cw * 0.65);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, cw, ch);
      texture.needsUpdate = true;
    }

    const fx = (c) => EGG.LEFT + c * EGG.CW + EGG.CW / 2;
    const fy = (r) => EGG.TOP + r * EGG.CH + 16;

    // e = seconds since the egg started
    function drawEgg(e, glow) {
      frameStart('uday@arch: ~');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';

      const morphP = (e - EGG_T.hold) / (EGG_T.morph - EGG_T.hold); // <0 before, 0..1 across the morph, >1 after
      const fade = e > EGG_T.banner ? clamp(1 - (e - EGG_T.banner) / (EGG_T.end - EGG_T.banner), 0, 1) : 1;
      ctx.globalAlpha = fade;

      // ----- fastfetch screen (flickers away during the morph) -----
      if (morphP < 1) {
        ctx.font = '21px "Geist Pixel", monospace';
        for (let r = 0; r < ROWS; r++) {
          for (let c2 = 0; c2 < EGG.COLS; c2++) {
            const src = fetchGrid[r][c2];
            if (!src) continue;
            const x = fx(c2);
            const y = fy(r);
            if (morphP < 0) {
              let visible;
              if (r === 0) visible = c2 < Math.floor(clamp(e / EGG_T.type, 0, 1) * 11);
              else visible = e > EGG_T.type && e - EGG_T.type > (r / ROWS) * (EGG_T.out - EGG_T.type);
              if (!visible) continue;
              ctx.fillStyle = src.col;
              ctx.fillText(src.ch, x, y);
            } else {
              const delay = (c2 / EGG.COLS) * 0.5 + rnd[r][c2] * 0.3;
              const local = (morphP - delay * 0.7) / 0.3;
              if (local < 0) {
                ctx.fillStyle = src.col;
                ctx.fillText(src.ch, x, y);
              } else if (local < 1) {
                ctx.globalAlpha = fade * (1 - local);
                ctx.fillStyle = Math.random() < 0.5 ? '#22e5ff' : '#eaf6ff';
                ctx.fillText(GL[(Math.random() * GL.length) | 0], x, y);
                ctx.globalAlpha = fade;
              }
            }
          }
        }
        // swatches + prompt with a blinking cursor
        if (morphP < 0 && e > EGG_T.out - 0.3) {
          SWATCH.forEach((col, i) => {
            ctx.fillStyle = col;
            ctx.fillRect(EGG.LEFT + INFO_COL * EGG.CW + i * 40, fy(swatchRow) - 16, 36, 20);
          });
          ctx.textAlign = 'left';
          ctx.fillStyle = '#eaf6ff';
          ctx.fillText('$', EGG.LEFT, fy(ROWS - 2));
          if (Math.floor(e * 2) % 2 === 0) {
            ctx.fillStyle = '#22e5ff';
            ctx.fillRect(EGG.LEFT + 22, fy(ROWS - 2) - 16, 12, 20);
          }
          ctx.textAlign = 'center';
        }
      }

      // ----- big ASCII banner, cells scramble in from the centre outwards -----
      if (morphP > 0.3) {
        ctx.font = '25px "Geist Pixel", monospace';
        const bx = 12 + EGG.S / 2;
        const by = 62 + 12;
        for (let i = 0; i < bCells.length; i++) {
          const cell = bCells[i];
          const local = (morphP - (0.3 + cell.d * 0.45)) / 0.22;
          if (local < 0) continue;
          let chr = cell.ch;
          let col = cell.col;
          if (local < 1) {
            chr = GL[(Math.random() * GL.length) | 0];
            col = Math.random() < 0.5 ? '#22e5ff' : '#eaf6ff';
          } else if (glow) {
            const wave = Math.abs(cell.c - ((e * 14) % (BCOLS + 20)) + 10);
            if (wave < 3) col = '#ffffff';
            if (Math.random() < 0.0012) chr = GL[(Math.random() * GL.length) | 0];
          }
          const x = bx + cell.c * EGG.S;
          const y = by + cell.r * EGG.S + 16;
          ctx.fillStyle = col;
          ctx.fillText(chr, x, y);
          ctx.fillText(chr, x + 0.9, y); // fake bold so the letters read from far away
        }
        if (morphP > 1 && glow) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.06 * fade;
          ctx.fillStyle = '#22e5ff';
          ctx.fillRect(0, 62, cw, ch);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      ctx.globalAlpha = 1;
      frameEnd();
    }

    function draw(t, still, force) {
      // easter egg
      if (still && eggStill) {
        drawEgg(EGG_T.morph + 1, false);
        return true;
      }
      if (pendingEgg && !egg && !still) {
        egg = { t0: t };
        pendingEgg = false;
      }
      if (egg && !still) {
        const e = t - egg.t0;
        if (e >= EGG_T.end) {
          egg = null;
          bootT0 = t;
          lastKey = '';
        } else {
          if (!force && t - lastEggDraw < 1 / 24) return false; // ~24 fps is plenty for text
          lastEggDraw = t;
          drawEgg(e, true);
          return true;
        }
      }

      const tt = t - bootT0;
      const chars = still ? TERM_TOTAL : Math.min(TERM_TOTAL, Math.floor((tt % TYPE_LOOP) * TYPE_CPS));
      const typing = chars < TERM_TOTAL;
      const blink = still || typing || Math.floor(t * 1.9) % 2 === 0;
      const key = chars + ':' + blink;
      if (!force && key === lastKey) return false;
      lastKey = key;

      frameStart('uday@bench: ~/samata');

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
      frameEnd();
      return true;
    }

    return {
      texture,
      draw,
      startEgg() {
        if (!egg) pendingEgg = true;
      },
      isEgg: () => !!egg || pendingEgg,
      setEggStill(v) {
        eggStill = v;
      },
    };
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

  /* ---------- Surface Pro 11 (black) + Flex Keyboard ---------- */

  // Real proportions: 287 x 209 x 9.3 mm tablet (1 unit ~ 90 mm), 13" 3:2 PixelSense Flow display.
  const TAB = { w: 3.2, d: 2.3, t: 0.105, gap: 0.03 };
  const KB = { w: 3.2, d: 2.3, t: 0.07 };
  const STAND = { len: 1.42, hingeFromBottom: 1.5, t: 0.03 };
  const PITCH = 0.19;
  const KEY_ROWS = [
    ['esc:1.5', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'del:1.5'],
    ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'back:2'],
    ['tab:1.5', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\:1.5'],
    ['caps:1.75', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", 'enter:2.25'],
    ['shift:2.25', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'shift:2.75'],
    ['ctrl:1.25', 'fn', 'win', 'alt', 'space:5.75', 'alt', 'cp', '<', '^v', '>'],
  ];

  function keyLayout() {
    const out = [];
    KEY_ROWS.forEach((row, r) => {
      const widths = row.map((k) => parseFloat(k.split(':')[1] || '1'));
      const total = widths.reduce((a, b) => a + b, 0);
      let x = -(total * PITCH) / 2;
      row.forEach((k, i) => {
        const w = widths[i] * PITCH;
        out.push({ label: k.split(':')[0], x: x + w / 2, r, w });
        x += w;
      });
    });
    return out;
  }

  function legendTexture(keys) {
    const cw = 2048;
    const ch = Math.round((cw * 6) / 15);
    const cv = document.createElement('canvas');
    cv.width = cw;
    cv.height = ch;
    const g = cv.getContext('2d');
    const ppu = cw / (15 * PITCH); // pixels per world unit
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    keys.forEach((k) => {
      const cx = cw / 2 + k.x * ppu;
      const cy = (k.r + 0.5) * PITCH * ppu;
      if (k.label === 'cp') {
        // accent key (like a dedicated assistant key): glowing gradient dot, no brand mark
        const gr = g.createLinearGradient(cx - 24, cy - 24, cx + 24, cy + 24);
        gr.addColorStop(0, '#22e5ff');
        gr.addColorStop(1, '#2f6bff');
        g.shadowColor = '#22e5ff';
        g.shadowBlur = 20;
        g.fillStyle = gr;
        g.beginPath();
        g.arc(cx, cy, 20, 0, Math.PI * 2);
        g.fill();
        g.shadowBlur = 0;
        return;
      }
      if (k.label === 'space') return;
      const map = { back: '⌫', enter: '↵', shift: 'shift', caps: 'caps', '^v': '↕', '<': '←', '>': '→', win: '❖', del: 'del', esc: 'esc', tab: 'tab', ctrl: 'ctrl', alt: 'alt', fn: 'fn' };
      const text = map[k.label] || k.label.toUpperCase();
      g.font = `${text.length > 2 ? 34 : k.r === 0 ? 40 : 52}px "Geist Pixel", monospace`;
      g.shadowColor = 'rgba(180,235,255,0.9)';
      g.shadowBlur = 16;
      g.fillStyle = '#eaf6ff';
      g.fillText(text, cx, cy + 2);
      g.shadowBlur = 0;
    });
    const tex = new THREE.CanvasTexture(cv);
    if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    return tex;
  }

  function buildSurface(screenMat) {
    const laptop = new THREE.Group();
    const black = (c, m, r, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: m, roughness: r }, extra));
    const alu = black(0x17181d, 0.8, 0.36); // black anodised aluminium
    const fabric = black(0x07080a, 0.05, 0.9); // soft-touch palm rest
    const keyMat = black(0x08090c, 0.15, 0.4);
    const plate = black(0x050608, 0.3, 0.6);
    const glassDark = new THREE.MeshStandardMaterial({ color: 0x030407, metalness: 0.2, roughness: 0.08 });
    const gold = black(0xe5c35a, 0.9, 0.3);
    const silver = black(0x8a93a3, 0.9, 0.3);

    /* ----- Flex Keyboard ----- */
    const kb = new THREE.Group();
    laptop.add(kb);
    const deck = new THREE.Mesh(slab(KB.w, KB.d, KB.t, 0.12, 0.02), fabric);
    deck.position.y = KB.t / 2;
    kb.add(deck);

    // key well (dark plate the keys sit in)
    const kw = 15 * PITCH + 0.1;
    const kd = 6 * PITCH + 0.1;
    const keysZ0 = -KB.d / 2 + 0.44; // z of the top of the key block
    const wellMesh = new THREE.Mesh(new THREE.BoxGeometry(kw, 0.012, kd), plate);
    wellMesh.position.set(0, KB.t + 0.004, keysZ0 + (6 * PITCH) / 2);
    kb.add(wellMesh);

    const keys = keyLayout();
    const keyGeo = new THREE.BoxGeometry(1, 0.045, 1);
    const inst = new THREE.InstancedMesh(keyGeo, keyMat, keys.length);
    const m4 = new THREE.Matrix4();
    const sc = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    keys.forEach((k, i) => {
      pos.set(k.x, KB.t + 0.028, keysZ0 + (k.r + 0.5) * PITCH);
      sc.set(k.w - 0.024, 1, PITCH - 0.024);
      m4.compose(pos, q, sc);
      inst.setMatrixAt(i, m4);
    });
    kb.add(inst);
    // backlit legends
    const legend = new THREE.Mesh(
      new THREE.PlaneGeometry(15 * PITCH, 6 * PITCH),
      new THREE.MeshBasicMaterial({ map: legendTexture(keys), transparent: true, toneMapped: false, depthWrite: false })
    );
    legend.rotation.x = -Math.PI / 2;
    legend.position.set(0, KB.t + 0.0515, keysZ0 + (6 * PITCH) / 2);
    kb.add(legend);

    // glass haptic touchpad
    const padZ = keysZ0 + 6 * PITCH + 0.1 + 0.27;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.008, 0.56), glassDark);
    pad.position.set(0, KB.t + 0.004, padZ);
    kb.add(pad);
    const padEdge = new THREE.Mesh(
      new THREE.PlaneGeometry(1.57, 0.58),
      new THREE.MeshBasicMaterial({ color: 0x22e5ff, transparent: true, opacity: 0.18, toneMapped: false })
    );
    padEdge.rotation.x = -Math.PI / 2;
    padEdge.position.set(0, KB.t + 0.0015, padZ);
    kb.add(padEdge);

    // magnetic hinge strip along the back edge + gold contact pads
    const strip = new THREE.Mesh(new THREE.BoxGeometry(KB.w - 0.3, KB.t + 0.03, 0.15), alu);
    strip.position.set(0, (KB.t + 0.03) / 2, -KB.d / 2 + 0.1);
    kb.add(strip);
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.03), gold);
      p.position.set((i - 2.5) * 0.09, KB.t + 0.034, -KB.d / 2 + 0.1);
      kb.add(p);
    }

    // pen storage groove with a stylus held magnetically in it
    const groove = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.02, 0.12), plate);
    groove.position.set(0.1, KB.t + 0.006, -KB.d / 2 + 0.29);
    kb.add(groove);
    const pen = new THREE.Group();
    const penBody = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 2.0, 18), black(0x0c0d10, 0.6, 0.3));
    penBody.rotation.z = Math.PI / 2;
    pen.add(penBody);
    const penTip = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.16, 18), silver);
    penTip.rotation.z = Math.PI / 2;
    penTip.position.x = 1.08;
    pen.add(penTip);
    const penBand = new THREE.Mesh(new THREE.CylinderGeometry(0.0375, 0.0375, 0.05, 18), silver);
    penBand.rotation.z = Math.PI / 2;
    penBand.position.x = -0.85;
    pen.add(penBand);
    const penLed = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: 0x22e5ff, toneMapped: false }));
    penLed.position.set(-0.98, 0.037, 0);
    pen.add(penLed);
    pen.position.set(0.12, KB.t + 0.05, -KB.d / 2 + 0.29);
    kb.add(pen);

    /* ----- tablet (hinge pivot = tablet's bottom edge, sits on the keyboard's magnetic strip) ----- */
    const hinge = new THREE.Group();
    hinge.name = 'Lid';
    hinge.position.set(0, KB.t + 0.035, -KB.d / 2 + 0.1);
    laptop.add(hinge);

    const tab = new THREE.Mesh(slab(TAB.w, TAB.d, TAB.t, 0.15, 0.022), alu);
    tab.position.set(0, TAB.gap + TAB.t / 2, TAB.d / 2);
    hinge.add(tab);

    // inner (screen) face: glass, then the display. Planes face -y; each a hair closer to the viewer
    const face = TAB.gap - 0.002;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(TAB.w - 0.05, TAB.d - 0.05), glassDark);
    glass.rotation.x = Math.PI / 2;
    glass.position.set(0, face, TAB.d / 2);
    hinge.add(glass);
    const SCREEN_Z = TAB.d / 2;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), screenMat);
    screen.name = 'Screen';
    screen.rotation.x = Math.PI / 2;
    screen.position.set(0, face - 0.004, SCREEN_Z);
    hinge.add(screen);

    // front camera + IR sensors in the top bezel (top = far end, +z)
    const camZ = TAB.d - 0.09;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.02, 20), new THREE.MeshBasicMaterial({ color: 0x0b1226, toneMapped: false }));
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, face - 0.006, camZ);
    hinge.add(lens);
    const lensRing = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.028, 20), new THREE.MeshBasicMaterial({ color: 0x2a3350, toneMapped: false }));
    lensRing.rotation.x = Math.PI / 2;
    lensRing.position.set(0, face - 0.0065, camZ);
    hinge.add(lensRing);
    [-0.1, 0.1].forEach((dx, i) => {
      const s = new THREE.Mesh(new THREE.CircleGeometry(i ? 0.01 : 0.008, 12), new THREE.MeshBasicMaterial({ color: i ? 0x22e5ff : 0x3a1218, toneMapped: false }));
      s.rotation.x = Math.PI / 2;
      s.position.set(dx, face - 0.006, camZ);
      hinge.add(s);
    });

    // back (outer) face: rear camera + subtle recess where the kickstand sits
    const backY = TAB.gap + TAB.t;
    const camBase = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 28), silver);
    camBase.position.set(-TAB.w / 2 + 0.32, backY + 0.006, TAB.d - 0.3);
    hinge.add(camBase);
    const camLens = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.014, 24), glassDark);
    camLens.position.set(camBase.position.x, backY + 0.012, camBase.position.z);
    hinge.add(camLens);
    const camDot = new THREE.Mesh(new THREE.CircleGeometry(0.012, 12), new THREE.MeshBasicMaterial({ color: 0x2f6bff, toneMapped: false }));
    camDot.rotation.x = -Math.PI / 2;
    camDot.position.set(camBase.position.x + 0.015, backY + 0.0195, camBase.position.z - 0.01);
    hinge.add(camDot);

    // kickstand: its own pivot (hinge line across the back), swings out to rest on the surface
    const standPivot = new THREE.Group();
    standPivot.position.set(0, backY, STAND.hingeFromBottom);
    hinge.add(standPivot);
    const standMesh = new THREE.Mesh(slab(TAB.w - 0.2, STAND.len, STAND.t, 0.08, 0.01), alu);
    standMesh.position.set(0, STAND.t / 2 + 0.004, -STAND.len / 2);
    standPivot.add(standMesh);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, TAB.w - 0.55, 16), black(0x0e0f12, 0.85, 0.3));
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0, 0.022, 0);
    standPivot.add(barrel);
    [-1, 1].forEach((s) => {
      const hb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.09), silver);
      hb.position.set(s * (TAB.w / 2 - 0.35), 0.014, 0.0);
      standPivot.add(hb);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.034, 0.03), black(0x050507, 0, 0.9));
      foot.position.set(s * 0.6, STAND.t / 2 + 0.004, -STAND.len + 0.03);
      standPivot.add(foot);
    });

    // edges: USB-C x2 + magnetic connector on the right side, power + volume on the top edge
    const portMat = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false });
    [0.95, 1.2].forEach((z) => {
      const rim = new THREE.Mesh(new THREE.PlaneGeometry(0.17, TAB.t * 0.55), silver);
      rim.rotation.y = Math.PI / 2;
      rim.position.set(TAB.w / 2 + 0.0015, TAB.gap + TAB.t / 2, z);
      hinge.add(rim);
      const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.14, TAB.t * 0.38), portMat);
      hole.rotation.y = Math.PI / 2;
      hole.position.set(TAB.w / 2 + 0.002, TAB.gap + TAB.t / 2, z);
      hinge.add(hole);
    });
    const sc2 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, TAB.t * 0.5), silver);
    sc2.rotation.y = Math.PI / 2;
    sc2.position.set(TAB.w / 2 + 0.0015, TAB.gap + TAB.t / 2, 1.65);
    hinge.add(sc2);
    const sc2h = new THREE.Mesh(new THREE.PlaneGeometry(0.26, TAB.t * 0.3), portMat);
    sc2h.rotation.y = Math.PI / 2;
    sc2h.position.set(TAB.w / 2 + 0.002, TAB.gap + TAB.t / 2, 1.65);
    hinge.add(sc2h);
    const power = new THREE.Mesh(new THREE.BoxGeometry(0.24, TAB.t * 0.5, 0.025), silver);
    power.position.set(TAB.w / 2 - 0.55, TAB.gap + TAB.t / 2, TAB.d + 0.004);
    hinge.add(power);
    [-0.35, -0.15].forEach((x) => {
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.14, TAB.t * 0.45, 0.02), silver);
      v.position.set(-TAB.w / 2 + 0.95 + x + 0.35, TAB.gap + TAB.t / 2, TAB.d + 0.003);
      hinge.add(v);
    });
    // 6 gold magnetic-connector pads on the tablet's bottom edge
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, TAB.t * 0.35, 0.012), gold);
      p.position.set((i - 2.5) * 0.09, TAB.gap + TAB.t / 2, -0.002);
      hinge.add(p);
    }

    // kickstand angle that always lands the stand on the surface for any tablet angle A
    const y0 = KB.t + 0.035; // hinge height above the surface
    function setOpen(A) {
      const p1y = y0 + backY * Math.cos(A) + STAND.hingeFromBottom * Math.sin(A);
      const phi = A - Math.asin(clamp(p1y / STAND.len, -1, 1));
      standPivot.rotation.x = clamp(phi, 0, 1.3);
    }

    return { laptop, hinge, setOpen };
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
    let xiaoDone = Promise.resolve();
    let warmFrames = 0;
    let introOn = !opts.holdIntro; // held while the boot loader is on screen; play() releases it
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
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 1.5));
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

    let model = buildSurface(screenMat);
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
      return ready
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
    xiaoDone = loadXiao();

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
    let quality = 1; // render-resolution multiplier, lowered automatically on slow devices
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
      renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 1.5) * quality);
      renderer.setSize(w, h, false);
      aspect = w / h;
      placeEsp();
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      terminal.texture.anisotropy = Math.min(4, maxAniso);
    }

    function update(t, dt) {
      if (introOn && startT === null) startT = t;
      const since = startT === null ? -1 : t - startT;

      // lid opens on load (after the loader, if there is one)
      if (!reduced) state.open = easeOutCubic(clamp((since - 0.5) / 1.8, 0, 1));
      const hinge = model.hinge;
      if (hinge) hinge.rotation.x = -OPEN_ANGLE * state.open;
      if (model.setOpen) model.setOpen(OPEN_ANGLE * state.open);
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

    // adaptive quality: if frames stay slow (weak GPU / phone), step the render resolution down
    let slowFrames = 0;
    let fastFrames = 0;
    function adapt(rawDt) {
      if (rawDt > 0.034) { slowFrames++; fastFrames = 0; } else { fastFrames++; slowFrames = Math.max(0, slowFrames - 1); }
      if (slowFrames > 45 && quality > 0.5) {
        quality = quality > 0.75 ? 0.75 : 0.5;
        slowFrames = 0;
        renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 1.5) * quality);
        renderer.setSize(canvas.parentElement.clientWidth, canvas.parentElement.clientHeight, false);
      }
    }

    function frame(now) {
      raf = global.requestAnimationFrame(frame);
      const t = now / 1000;
      const rawDt = t - last;
      const dt = Math.min(0.05, Math.max(0.001, rawDt));
      last = t;
      // hidden behind the boot loader: warm up with a few frames (shaders, textures), then idle until play()
      if (!introOn) {
        if (warmFrames >= 3) return;
        warmFrames++;
        update(t, dt);
        renderer.render(scene, camera);
        return;
      }
      if (rawDt < 0.5) adapt(rawDt); // ignore the gap after a tab switch
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

    // ready = every model loaded, shaders compiled and a first frame drawn, so nothing pops in when it is revealed
    const fontsReady = document.fonts && document.fonts.load ? document.fonts.load('17px "Geist Pixel"').catch(() => {}) : Promise.resolve();
    const ready = Promise.all([xiaoDone, fontsReady]).then(
      () =>
        new Promise((res) => {
          try {
            renderer.compile(scene, camera);
          } catch (e) {}
          if (reduced) renderStill();
          global.requestAnimationFrame(() => global.requestAnimationFrame(res));
        })
    );

    /* ---------- easter egg: fastfetch -> "I USE ARCH BTW" ---------- */

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    function hitLaptop(cx, cy) {
      const r = canvas.getBoundingClientRect();
      if (!r.width || cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return false;
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      // anywhere on the laptop model counts (screen, bezel, back, keyboard, touchpad, kickstand, pen)
      return !!model.laptop && ray.intersectObject(model.laptop, true).length > 0;
    }
    let eggTimer = 0;
    function fastfetch() {
      if (reduced) {
        // no animation: show the finished banner for a few seconds
        terminal.setEggStill(true);
        renderStill();
        clearTimeout(eggTimer);
        eggTimer = setTimeout(() => {
          terminal.setEggStill(false);
          renderStill();
        }, 6000);
        return;
      }
      terminal.startEgg();
    }
    const onClick = (e) => {
      if (!visible || e.defaultPrevented) return;
      if (e.target.closest && e.target.closest('a, button, input, textarea, select, label, [role="dialog"], .palette')) return;
      if (hitLaptop(e.clientX, e.clientY)) fastfetch();
    };
    global.addEventListener('click', onClick);

    return {
      ready,
      play() {
        introOn = true;
      },
      fastfetch,
      hitLaptop,
      setModel,
      loadGLB,
      destroy() {
        stop();
        ro.disconnect();
        if (io) io.disconnect();
        global.removeEventListener('pointermove', onPointer);
        global.removeEventListener('click', onClick);
        document.removeEventListener('visibilitychange', onVis);
        renderer.dispose();
      },
    };
  }

  global.LaptopHero = { init };
})(window);
