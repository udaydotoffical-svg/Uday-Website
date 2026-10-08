# Uday Singh, portfolio

Static site: HTML, CSS, vanilla JS and Three.js (r128 from cdnjs). No build step.
Styled with the **Knowura** design system (`styles/knowura.css`, never edited).

```
index.html            page shell + hero
styles/knowura.css    design system, saved verbatim
styles/site.css       site styles (.glass .glass-light .btn .input copy the reference patterns exactly)
js/content.js         ALL text, links and projects live here
js/main.js            renders sections, Knowura frame, form, "/" command palette
js/laptop.js          3D laptop (Three.js)
js/fx.js              motion layer: boot loader, cursor, scramble text, marquees, tilt, scroll effects
styles/fx.css         styles for the motion layer
api/embed-check.js    Vercel function: checks if a site allows iframes
api/admin/*.js        blog editor API: login, logout, posts (password gate, saves to GitHub)
api/_lib.js           shared helpers for the editor API (not a route)
admin/                the /admin visual blog editor (index.html, admin.js, admin.css)
data/posts.json       the blog posts (markdown bodies), written by the editor
js/md.js              tiny safe markdown renderer used by the blog and the editor
assets/               logo, favicon, OG image, placeholders
vercel.json           headers + cache
```

## Run locally

```bash
npx serve .          # or: python3 -m http.server 8000
```

Open the printed URL. (`/api/embed-check` only exists on Vercel; locally the Knowura frame just tries to load, which is fine.)

## Deploy on Vercel

1. Push this repo to GitHub.
2. Go to <https://vercel.com/new>, import the repo.
3. Framework preset: **Other**. Leave build command and output directory empty. Deploy.
4. Open your new URL, then set it in two places so link previews work:
   - `siteUrl` in `js/content.js`
   - the three `https://udaysingh.vercel.app/...` lines (`og:url`, `og:image`) in `index.html`

Optional: add a custom domain under Project, Settings, Domains.

## Edit the content

Everything is in `js/content.js`. To **add a project**, copy one object inside `projects.items` and change it. It gets its own full-width panel and alternates left/right automatically. No layout code to touch.

```js
{
  id: 'my-thing',                // used in the "/" palette: "open my-thing"
  title: 'MY THING',
  kicker: 'What it is',
  description: '...',
  tags: ['A', 'B'],
  link: { label: 'Open it', href: 'https://...' },
  visual: { type: 'media', image: 'assets/my-thing.jpg', video: '', alt: '...' }
  // or { type: 'browser', embed: true, url, displayUrl, fallback, alt } for a live iframe preview
}
```

## Project cards: features, GitHub button, repo-stats popup

Projects in `js/content.js` can have an optional `features: [...]` checklist and an optional `github: 'https://github.com/owner/repo'`, which adds a GitHub button next to the main button. **Any** link to a `github.com/owner/repo` page on the site (including that button) shows a glass popup on hover or keyboard focus with live stars, forks, watchers and a language bar, straight from the public GitHub API (`js/ghhover.js`, `styles/ghhover.css`). No key, no tracking; results are cached for 10 minutes in the tab's sessionStorage only. Unauthenticated GitHub allows 60 requests per hour per visitor, so if that runs out the popup says it couldn't reach GitHub.

The "GitHub Repo Stats on Hover" card (`id: 'repo-stats'`) uses `visual.type: 'hovercard'`: a fake page of real repo links (`visual.repos`) that plays the popup automatically when scrolled into view and stops as soon as you hover. On phones it pins a static stats card instead.

## Placeholders to replace

| What | Where | Notes |
|---|---|---|
| Real logo | `assets/logo-k.svg` and `assets/favicon.svg` | Placeholder K (pencil stem + open book arms), used as the browser-tab favicon. Replace both files, keep the names. The top bar has no logo. |
| Knowura screenshot | `assets/knowura-fallback.svg` → `projects.items[0].visual.fallback` | Shown while loading and if the live frame is blocked. Use a 16:10 png/webp. |
| Samata photo or video (optional) | `projects.items[1].visual` in `js/content.js` | The panel is an animated demo signal monitor, no assets needed. For a real photo or video, change it to `type: 'media'` with `image` (and optional `video`). |
| Repo Stats extension GitHub repo (optional) | `projects.items[2].github` in `js/content.js` | Commented out: add the repo URL and a GitHub button appears (with the hover popup). The Gumroad link is already set. |
| Samata link (optional) | `projects.items[1].link` | Left out on purpose (the repo is private); a badge line shows instead. Add `link: { label, href }` to get a button. |
| Site URL | `siteUrl` in `js/content.js`, plus the OG tags in `index.html` | Set to `https://udaysingh.vercel.app`. |
| OG image | `assets/og.png` | 1200x630, regenerate if you change your name block. |
| Timeline | `timeline.items` in `js/content.js` | Wording is a draft built from what you told me; edit freely. |
| 3D laptop model | `glbUrl` line in `js/main.js` (commented) | See below. |
| Formspree (optional) | `contact.formspreeId` in `js/content.js` | Empty = the form opens the visitor's email app (mailto). |

## Fonts: exactly two

Contrast comes from two typefaces only:
- **Redaction 35** (open source, SIL OFL, <https://www.redaction.us>): headings and titles only. That is the hero tagline (italic), the section titles, the project card titles (KNOWURA, SAMATA, ...) and the timeline card titles. No other Redaction level is used or shipped.
- **Geist Pixel** (from `knowura.css`): everything else (body text, quotes, labels, buttons, nav, the UDAY / SINGH blocks, the terminal).

Files: `assets/fonts/redaction-35-{normal,italic}.woff2` (about 90 KB, self-hosted, the italic is preloaded). `styles/redaction.css` has the `@font-face` and the list of what uses it. To make another element a heading in Redaction add it to that list, or give it class `serif` (child elements need the class too, because Knowura's `* { font-family: ... !important }` hits every element; the `!important` in `.serif` is what beats it).

## Liquid glass (performance-first)

Every glass surface has the liquid-glass look: bright rim light, soft inner glow and a tinted fill (`styles/liquid.css`, active while `<html class="liquid">`; delete that class in `index.html` for the original Knowura glass).

**There is deliberately no backdrop blur and no refraction by default.** Each `backdrop-filter` re-blurs whatever moves behind it (the 3D scene, the marquees, the ocean) on every frame, and dozens of them made the page lag. The panels use a stronger tint instead, which looks very close and costs almost nothing.

Opt-in extras, if your machine is fast:
- Real blur: set `--lg-blur: blur(9px) saturate(1.7) brightness(1.1)` at the top of `styles/liquid.css`.
- Real **refraction** (light bends at panel edges, Chromium only): add `liquid-refract` next to `liquid` in `index.html`, or open the page with `?refract`. `js/liquidglass.js` builds an SVG displacement map per panel and applies it as a live `backdrop-filter`. It is the most expensive effect on the site.

Other lag fixes: no film grain, the Samata signal runs at 30 fps without glow, the 3D scene renders at most 1.5x pixel density (and lowers itself further if frames run slow), and the ocean freezes once you scroll.

## Easter egg: fastfetch -> "I USE ARCH BTW"

Trigger it any of these ways (nothing on the page advertises it):
- click anywhere on the laptop (screen, keyboard, back, kickstand...)
- type `arch`, `btw` or `fastfetch` anywhere (outside a text box)
- open the `/` command palette and run `fastfetch`

The screen types `$ fastfetch`, prints the Arch logo and system info (a full Surface Pro 11 on Arch Linux ARM readout: `OS`, `Host`, `Kernel`, `Packages`, `Display 2880x1920 @ 120 Hz`, `CPU Snapdragon X Plus`, ... edit `FETCH_INFO`), then the characters scramble and morph into a big ASCII "I USE ARCH BTW", glows for a few seconds and goes back to the normal terminal. With reduced motion it just shows the finished banner for 6 seconds. All of it lives in `createTerminal()` in `js/laptop.js` (look for `ARCH_LOGO`, `FETCH_INFO`, `EGG_T` timings).

## Blog and the /admin editor

Posts are stored in `data/posts.json` (one entry per post, body in markdown) and the site loads them when the page opens. You can edit that file by hand, or write posts in the visual editor at **`/admin`** (your-site/admin). The editor is a real WYSIWYG: the text area uses the same `.prose` styles as the live reader, with a toolbar for heading, bold, italic, inline code, link, quote, code block, lists and a divider, and a **Markdown** button to switch to the raw text. Pasting always pastes plain text.

Markdown supported: `## heading`, `### sub-heading`, `> quote`, fenced code, `- list`, `1. list`, `---`, `**bold**`, `*italic*`, `` `code` ``, `[text](https://link)`. Everything is HTML-escaped before it is shown, so a post can never inject script. Cards open an in-page reader at `#blog/<id>` (shareable link, Esc / Back / click outside closes), and the `/` palette gets `read <id>` commands automatically.

### Turn the editor on (one time)

The site is static, so the editor saves by committing `data/posts.json` to GitHub through two small Vercel functions; Vercel then redeploys (about a minute) and the post is live. In Vercel: Project, Settings, Environment Variables:

| Variable | What |
|---|---|
| `ADMIN_PASSWORD` | your editor password, 10+ characters (a long passphrase is best) |
| `GITHUB_TOKEN` | GitHub, Settings, Developer settings, Fine-grained tokens. Only this repository, permission **Contents: Read and write** |
| `SESSION_SECRET` | optional, any long random text (signs the login cookie) |
| `GITHUB_REPO` / `GITHUB_BRANCH` | optional, default `udaydotoffical-svg/uday-website` and `main` |

Redeploy after adding them. Until both required values exist, `/admin` just shows what is missing.

### How the verification works

- Login is a password check on the server (constant-time compare). A wrong password is slowed down, and after 5 wrong tries from one address it locks that address for 15 minutes.
- A correct password sets a signed, `HttpOnly`, `Secure`, `SameSite=Strict` cookie that expires after 8 hours and is only sent to `/api/admin`. The password and the GitHub token never reach the browser.
- Every save and delete also checks the request really came from this site (Origin and a custom header), and the posts are validated on the server (slug, length, date, tags).
- `/admin` is `noindex` and not cached. This is single-user protection, not a multi-user system. If you want it stronger later, the next step is GitHub sign-in limited to your account.

## Boot loader and 3D

On a first visit the 0-100 loader loads the 3D scene *inside itself*: Three.js, the laptop code, the XIAO model and the font start right after the first paint (so they never delay it), the counter waits for them, shaders are compiled and a few frames are drawn behind the loader, and only then does it lift and the lid open. It never waits longer than `LOADER_MAX` (4 s, in `runLoader()` in `js/fx.js`); if the scene is later than that it fades in afterwards. A **Skip** button (or Esc) ends it immediately. It shows once per browser session and not at all with reduced motion. A failsafe in `index.html` removes it after 5 s even if the scripts never run. On repeat visits (no loader) the 3D scene loads lazily after the window `load` event.

## The "laptop" is a Surface Pro 11 + Flex Keyboard (black)

Procedural, built in `buildSurface()` in `js/laptop.js`:
- **Tablet:** black anodised aluminium, 13" 3:2 glass display (the live terminal), front camera + IR sensors in the top bezel, rear camera, power and volume buttons on the top edge, two USB-C ports and the Surface Connect port on the side, gold magnetic-connector pads along the bottom edge.
- **Kickstand:** hinged on the back with real feet; its angle is computed from the tablet angle so it always rests on the surface (it swings out as the screen opens on load).
- **Flex Keyboard:** magnetically attached along the bottom edge, with a backlit full QWERTY (Esc/F-row/fn/win keys, arrow cluster, one cyan accent key), glass haptic touchpad, and the Slim Pen held in the pen groove with a status LED.
- Not affiliated with or endorsed by Microsoft; the shapes are an original illustration and carry no logos.

`models/user-design-reference.glb` is your Tinkercad sketch (a simple wedge). The site uses the procedural model above instead; to use your own mesh, point `glbUrl` at a `.glb` (see below).

## The ESP32 next to the laptop (real Seeed XIAO ESP32-S3)

The 3D board is your actual XIAO ESP32-S3 CAD model, converted from the `.step` file to `assets/xiao-esp32s3.glb` (270 KB, real colours: black PCB, gold castellated pads, steel USB-C, U.FL antenna connector). The printed module label is the crop of your top-view photo, `assets/xiao-label.jpg`. Around it:

- **Amber user LED blinks** once a second and lights the board; the red charge LED stays on. Both sit where they are on the real board.
- **Wi-Fi arcs** radiate from the antenna connector and **data packets** fly toward the laptop.
- Beside the laptop on wide screens, in front of it on phones; it floats on its own and shrinks/drifts with the scroll.
- If the model fails to load, a simple procedural ESP32 is shown instead.
- Loaded with `js/vendor/GLTFLoader.js` (three r128 example loader, vendored so there's no extra CDN).

To swap the board, replace `assets/xiao-esp32s3.glb` (keep the long axis along x, USB end at +x, about 2.5 units long) and adjust the `XIAO` constants (label rect, LED positions, antenna) near `loadXiao()` in `js/laptop.js`. Convert STEP to GLB with `pip install cascadio trimesh` then `cascadio.step_to_glb(...)`.

## Swap in your own laptop model (.glb)

Put the file in `models/laptop.glb`, then uncomment `glbUrl: 'models/laptop.glb'` in `js/main.js`.

- A mesh named `Screen` gets the live terminal texture.
- An object named `Lid` is treated as the hinge and animated open on load.
- Anything else is shown as is. Scale and position it in Blender to roughly 3.2 units wide.

## The Knowura live preview (iframe)

On desktop the Knowura panel is full-width with a big frame (`wide: true` / `interactive: true` in `js/content.js`). Click the frame to use the site inside it; the mouse leaving or Esc locks it again so page scrolling is never hijacked. On phones and tablets it stays view-only.

The frame is **view only until clicked** (and always on touch devices): `sandbox="allow-scripts allow-same-origin"`, `loading="lazy"`, `pointer-events: none`, scaled from a 1280px-wide desktop layout. Google sign-in cannot work inside an iframe, hence the **Open Knowura** button.

A page can't detect a blocked frame from JavaScript (blocked, refused and healthy all look alike). So `api/embed-check.js` reads Knowura's response headers on the server. If framing is blocked, the page shows the screenshot with a note instead of a browser error page.

**What's blocking it right now:** Knowura's own `vercel.json` sends `X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'`, so browsers refuse to show it anywhere but knowura.vercel.app. Until that changes, the portfolio shows the screenshot fallback. A ready-made fix is in `docs/knowura-frame-fix.patch` (apply it in the Knowura repo with `git apply`, change the domain to yours if it differs, then redeploy). It only allows *your portfolio* to frame Knowura, not every site.

**Check Knowura's headers yourself:**

```bash
curl -sI https://knowura.vercel.app | grep -iE "x-frame-options|content-security-policy"
```

If you see `X-Frame-Options: DENY` (or `SAMEORIGIN`), or a `frame-ancestors` that doesn't include your portfolio, framing is blocked. Fix it **in the Knowura repo's `vercel.json`** (replace the domain with your portfolio's):

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy", "value": "frame-ancestors 'self' https://udaysingh.vercel.app" }
      ]
    }
  ]
}
```

and remove any `X-Frame-Options` header from that file, from `next.config.js` `headers()`, or from middleware, because `X-Frame-Options` takes priority in some browsers and would still block it. Redeploy Knowura. Vercel itself adds neither header by default.

`/api/embed-check` only checks `*.vercel.app` hosts. For other domains, set the env var `EMBED_ALLOW=example.com,other.com` in Vercel.

## Motion layer (js/fx.js + styles/fx.css)

- **Boot loader**: terminal log + giant pixel counter, once per browser session (skipped for reduced motion).
- **Hero intro**: name tags drop in with a spring and decode from scrambled glyphs, stars spin in, copy rises.
- **Custom cursor** (mouse only): pixel dot + trailing ring that grows on links and shows labels (LIVE, DEMO, OPEN, SAY HI).
- **Magnetic buttons**, **3D tilt + glare** on project panels, title colour sweep on hover.
- **Kinetic marquees**: words come from `marquee` in `js/content.js`; scrolling speeds them up and flips direction.
- **Scroll**: progress bar, nav hides on scroll down, name tags drift apart, section titles decode, timeline line draws itself, quotes light up word by word.
- **Mega footer**: giant "LET'S BUILD" email link with a hover wave.
- **Ocean background** (`assets/ocean-bg.webp` 1600px / 58 KB on desktop, `assets/ocean-bg-sm.webp` 800px / 24 KB on phones; `.ocean` in `styles/fx.css`): your water photo under a deep-blue veil. It drifts slowly only while you are at the top of the page and freezes once you scroll, because the glass panels blur whatever is behind them every frame and a moving background made the whole page lag (measured: ~2x slower per frame). No mouse/scroll parallax, one layer, off on phones and for reduced motion. Swap the photo by replacing the file (keep it under ~150 KB); tune the darkness in the `body::after` veil in `styles/site.css`.
 Everything heavy switches off under `prefers-reduced-motion`.

## Command palette

Press `/` anywhere (or tap the `/` button in the nav). Type to filter, arrows to move, Enter to run, Esc to close. Commands are generated from `js/content.js`, so new projects get an `open <id>` command automatically.

## Performance and accessibility notes

- Three.js and the laptop code are not loaded until the first interaction (mouse move, touch, scroll, key) or 6 s after page load (`LAPTOP_BOOT_MS` in `js/main.js`), then the laptop fades in. This keeps the page fast. Pixel ratio is capped at 2, rendering pauses off-screen and in hidden tabs.
- `prefers-reduced-motion`: the laptop renders a single still frame, particles and stars stop, no scroll animations.
- No WebGL: a flat SVG laptop is shown instead.
- Lighthouse (local run, software rendering, simulated mobile): with the 3D scene loading eagerly behind the loader, a software-rendered local run scored much lower on performance (mobile ~36, desktop ~50, because that run has no GPU); with `EAGER_3D = false` it was 92-95 mobile / 100 desktop. Accessibility 100, best practices 96, SEO 100. Re-run on your deployed URL (Chrome DevTools, Lighthouse tab).
