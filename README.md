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
api/embed-check.js    Vercel function: checks if a site allows iframes
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
   - the three `https://uday-singh.vercel.app/...` lines (`og:url`, `og:image`) in `index.html`

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

## Placeholders to replace

| What | Where | Notes |
|---|---|---|
| Real logo | `assets/logo-k.svg` and `assets/favicon.svg` | Placeholder K (pencil stem + open book arms), used as the browser-tab favicon. Replace both files, keep the names. The top bar has no logo. |
| Knowura screenshot | `assets/knowura-fallback.svg` → `projects.items[0].visual.fallback` | Shown while loading and if the live frame is blocked. Use a 16:10 png/webp. |
| Samata photo or video | `assets/samata-placeholder.svg` → `projects.items[1].visual.image`, optional `.video` | A video plays muted on loop with the image as poster. |
| Samata link | `projects.items[1].link.href` | Currently points at your GitHub profile. Use the repo or a write-up. |
| Site URL | `siteUrl` in `js/content.js`, plus the OG tags in `index.html` | `https://uday-singh.vercel.app` is a guess. |
| OG image | `assets/og.png` | 1200x630, regenerate if you change your name block. |
| Timeline | `timeline.items` in `js/content.js` | Wording is a draft built from what you told me; edit freely. |
| 3D laptop model | `glbUrl` line in `js/main.js` (commented) | See below. |
| Formspree (optional) | `contact.formspreeId` in `js/content.js` | Empty = the form opens the visitor's email app (mailto). |

## Swap in your own laptop model (.glb)

Put the file in `models/laptop.glb`, then uncomment `glbUrl: 'models/laptop.glb'` in `js/main.js`.

- A mesh named `Screen` gets the live terminal texture.
- An object named `Lid` is treated as the hinge and animated open on load.
- Anything else is shown as is. Scale and position it in Blender to roughly 3.2 units wide.

## The Knowura live preview (iframe)

The frame is **view only**: `sandbox="allow-scripts allow-same-origin"`, `loading="lazy"`, `pointer-events: none`, scaled from a 1280px-wide desktop layout. Google sign-in cannot work inside an iframe, hence the **Open Knowura** button.

A page can't detect a blocked frame from JavaScript (blocked, refused and healthy all look alike). So `api/embed-check.js` reads Knowura's response headers on the server. If framing is blocked, the page shows the screenshot with a note instead of a browser error page.

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
        { "key": "Content-Security-Policy", "value": "frame-ancestors 'self' https://uday-singh.vercel.app" }
      ]
    }
  ]
}
```

and remove any `X-Frame-Options` header from that file, from `next.config.js` `headers()`, or from middleware, because `X-Frame-Options` takes priority in some browsers and would still block it. Redeploy Knowura. Vercel itself adds neither header by default.

`/api/embed-check` only checks `*.vercel.app` hosts. For other domains, set the env var `EMBED_ALLOW=example.com,other.com` in Vercel.

## Command palette

Press `/` anywhere (or tap the `/` button in the nav). Type to filter, arrows to move, Enter to run, Esc to close. Commands are generated from `js/content.js`, so new projects get an `open <id>` command automatically.

## Performance and accessibility notes

- Three.js and the laptop code are not loaded until the first interaction (mouse move, touch, scroll, key) or 6 s after page load (`LAPTOP_BOOT_MS` in `js/main.js`), then the laptop fades in. This keeps the page fast. Pixel ratio is capped at 2, rendering pauses off-screen and in hidden tabs.
- `prefers-reduced-motion`: the laptop renders a single still frame, particles and stars stop, no scroll animations.
- No WebGL: a flat SVG laptop is shown instead.
- Lighthouse (local run, software rendering, simulated mobile): performance 97 mobile / 99 desktop, accessibility 100, best practices 96, SEO 100. Re-run on your deployed URL (Chrome DevTools, Lighthouse tab).
