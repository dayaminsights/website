# Executive Visual System — Foundation + Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-page rust/serif site with a logo-derived navy/Inter design system delivered as shared CSS/JS/SVG assets, a living `styleguide.html`, a new homepage that follows the seven-frame storyboard, and five stub pages so no nav link ships dead.

**Architecture:** Static multi-page HTML with no build step. Four CSS files split by responsibility (`tokens` → `base` → `components` → `graphics`), one vanilla JS file (`site.js`) that owns a single rAF scroll bus and every observer, and hand-authored inline SVG for the six graphic systems. Nav and footer markup is duplicated per page from canonical partials in `docs/partials/`. Every pre-animation state is scoped under `html.js` so the no-JS and reduced-motion paths render the finished frame.

**Tech Stack:** HTML5, CSS custom properties, vanilla JS (IntersectionObserver, `offset-path`, CSS `clamp()` math), inline SVG with `pathLength="1"`, Inter via Google Fonts, GA4. Verification: Node static server on :8090 + Playwright (already in `node_modules`) for visibility, overflow, console-error and screenshot checks; axe-core for accessibility.

**Spec:** `docs/superpowers/specs/2026-09-16-executive-system-foundation-homepage-design.md`. Where this plan and the spec disagree, the spec wins.

**Working style:** After each homepage section task (13–16), invoke `/taste:taste` on that section for motion timing, spacing and copy polish before committing. The `/taste` pass may adjust values in this plan; record any changed token in `PROJECT_NOTES.md` (Task 18).

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `tmp_serve.js`, `tmp_check.js` | Verification harness (gitignored) | 0 |
| `docs/archive/index-2026-09-rust.html` | Retired page, reference only | 1 |
| `assets/css/tokens.css` | `:root` custom properties only — colour, type, space, shape, motion | 2 |
| `assets/css/base.css` | Reset, type styles, `.wrap`/`.grid`, surfaces, motion verb pre-states, reduced-motion overrides | 3 |
| `assets/svg/mark.svg`, `wordmark.svg`, `lockup.svg`, `favicon.svg` | Logo assets | 4 |
| `docs/partials/head.html`, `nav.html`, `footer.html`, `icons.html` | Canonical blocks pasted into every page | 5 |
| `assets/css/components.css` | Nav, footer, buttons, eyebrow, tag-line, section head, tag, stat, diagram frame, module, case tile, insight row, statement band, form, FAQ, splash | 5, 7, 11, 12 |
| `assets/js/site.js` | Scroll bus, nav, reveal, run-while-visible, scrub, steppers, counters, pulse network, splash, form fallback | 6, 12, 16 |
| `assets/css/graphics.css` | Intelligence Grid, blueprint lines, mesh, data flow, automation loop, blueprint, pulse network, icons, module figures | 8, 9, 10 |
| `styleguide.html` | Living design system; every component and graphic demonstrated | 5 → 12 |
| `index.html` | Homepage | 13–16 |
| `services.html`, `case-studies.html`, `insights.html`, `about.html` | Stub pages | 17 |
| `contact.html` | Minimal real page: contact block | 17 |
| `PROJECT_NOTES.md`, `sitemap.xml` | Documentation and SEO | 18 |

**Dependency chain:** Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19. Tasks 8–10 (graphics) could run in parallel after Task 7; everything else is sequential because each task extends `styleguide.html` and the CSS files.

**Canonical CSS load order in every page `<head>`:** `tokens.css`, `base.css`, `components.css`, `graphics.css`. JS: `site.js` with `defer`, at the end of `<head>`.

---

## Task 0: Verification harness

**Files:**
- Create: `tmp_serve.js` (gitignored)
- Create: `tmp_check.js` (gitignored)

- [ ] **Step 1: Confirm Playwright and Chromium are available**

Run:
```bash
cd "C:/Users/USER/Documents/GitHub/website" && node -e "require('playwright'); console.log('playwright ok')" && npx playwright install chromium
```
Expected: `playwright ok`, then Chromium reported as downloaded or already installed.

- [ ] **Step 2: Write the static server**

Create `tmp_serve.js`:

```js
const http = require('http'), fs = require('fs'), path = require('path');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain', '.ico': 'image/x-icon' };
http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(__dirname, decodeURIComponent(p));
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found: ' + p); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(8090, () => console.log('serving on http://localhost:8090'));
```

- [ ] **Step 3: Write the checker**

Create `tmp_check.js`:

```js
// usage: node tmp_check.js <page> [--rm] [--splash] [--shots] [--expect sel1,sel2]
//   --rm      emulate prefers-reduced-motion
//   --splash  let the intro splash play (default: pre-set the session flag so it is skipped)
//   --shots   full-page screenshots at 390/768/1280/1440 → tmp_<page>_<w>.png
//   --expect  comma-separated selectors that must exist and be visible
const { chromium } = require('playwright');
const [, , page = 'index.html', ...rest] = process.argv;
const rm = rest.includes('--rm'), shots = rest.includes('--shots'), splash = rest.includes('--splash');
const ei = rest.indexOf('--expect');
const expect = ei > -1 ? rest[ei + 1].split(',') : [];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ reducedMotion: rm ? 'reduce' : 'no-preference', viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', e => errors.push(String(e)));
  if (!splash) await p.addInitScript(() => { try { sessionStorage.setItem('dayamSplash', '1'); } catch (e) {} });
  await p.goto('http://localhost:8090/' + page, { waitUntil: 'networkidle' });
  let fail = 0;
  for (const s of expect) {
    const n = await p.locator(s).count();
    const vis = n ? await p.locator(s).first().isVisible() : false;
    console.log((n && vis ? 'ok   ' : 'FAIL ') + s + '  count=' + n + ' visible=' + vis);
    if (!n || !vis) fail++;
  }
  for (const w of [390, 768, 1280, 1440]) {
    await p.setViewportSize({ width: w, height: 900 });
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(500);
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(800);
    const over = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    console.log((over ? 'FAIL ' : 'ok   ') + 'no horizontal overflow @' + w);
    if (over) fail++;
    if (shots) await p.screenshot({ path: `tmp_${page.replace(/\W/g, '_')}_${w}${rm ? '_rm' : ''}.png`, fullPage: true });
  }
  console.log(errors.length ? 'FAIL console errors:\n  ' + errors.join('\n  ') : 'ok   no console errors');
  fail += errors.length;
  await browser.close();
  console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL OK');
  process.exit(fail ? 1 : 0);
})();
```

- [ ] **Step 4: Smoke-test the harness against the current page**

Run (two terminals, or background the first):
```bash
cd "C:/Users/USER/Documents/GitHub/website" && node tmp_serve.js &
sleep 1 && node tmp_check.js index.html --expect "header.nav,#top"
```
Expected: `ok   header.nav`, `ok   #top`, four `ok   no horizontal overflow` lines, `ok   no console errors`, `ALL OK`. (The old page has no splash, so the init script is harmless.)

Both files are already covered by `.gitignore` (`tmp_serve.js`, `tmp_check.js`, `tmp_*.png`). No commit.

---

## Task 1: Preserve the old page, branch, scaffold

**Files:**
- Modify: `index.html` (commit the pending ladder-heading edit as-is)
- Move: `index.html` → `docs/archive/index-2026-09-rust.html`
- Create: directories `assets/css`, `assets/js`, `assets/svg`, `docs/partials`, `docs/archive`

- [ ] **Step 1: Commit the pending edit on `main`**

Run:
```bash
cd "C:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Reveal the ladder heading in two beats

The sentence is the section's argument in miniature, so the first clause
settles before the handoff clause follows it, and the accent rule draws
under \"our job\" with the same left-to-right climb the rungs use.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
Expected: one commit on `main`; `git status --short` shows only `?? docs/superpowers/plans/2026-06-15-agency-pipeline-mvp.md` (leave that file alone throughout).

- [ ] **Step 2: Create the feature branch**

Run:
```bash
git switch -c executive-system
```
Expected: `Switched to a new branch 'executive-system'`.

- [ ] **Step 3: Archive the old page and scaffold directories**

Run:
```bash
mkdir -p docs/archive docs/partials assets/css assets/js assets/svg && git mv index.html docs/archive/index-2026-09-rust.html
```
Expected: `git status --short` shows `R  index.html -> docs/archive/index-2026-09-rust.html`.

- [ ] **Step 4: Add an archive note**

Create `docs/archive/README.md`:

```markdown
# Archive

`index-2026-09-rust.html` is the single-page site that shipped from 2026-06 to 2026-09 (rust accent, Instrument Sans / Source Serif 4, Tier-2 India copy). It is kept for copy and schema reference only; it is not deployed, and its relative asset paths (`hero-bg.jpg`, `og-image.png`, `favicon.svg`) resolve only from the repo root.

The replacement is documented in `docs/superpowers/specs/2026-09-16-executive-system-foundation-homepage-design.md`.
```

- [ ] **Step 5: Commit**

```bash
git add -A docs/archive && git commit -m "Archive the rust single-page site before the rebuild

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Design tokens

**Files:**
- Create: `assets/css/tokens.css`

- [ ] **Step 1: Write the token file**

Create `assets/css/tokens.css`:

```css
/* Dayam Insights — design tokens.
   Source of truth: docs/superpowers/specs/2026-09-16-executive-system-foundation-homepage-design.md
   Nothing in here is a rule; every value is consumed by base.css, components.css and graphics.css. */
:root{
  /* ---- colour: 80 navy / 15 white / 5 blue ---- */
  --navy:#07162D;
  --blue:#1E7BFF;
  --bg:#F8FAFC;
  --surface:#FFFFFF;
  --line:#E5EAF2;
  --line-strong:#CBD5E1;
  --muted:#64748B;               /* 4.7:1 on white — text 14px and up only */
  --ink:#07162D;
  --ink-2:#334155;               /* labels under 14px, secondary text */
  --blue-soft:rgba(30,123,255,.10);
  --on-navy:#F8FAFC;
  --on-navy-muted:#9FB0C8;
  --line-on-navy:rgba(248,250,252,.14);
  --hairline:rgba(7,22,45,.28);  /* diagram strokes, live */
  --hairline-soft:rgba(7,22,45,.14);
  --hairline-on-navy:rgba(248,250,252,.28);

  /* ---- type ---- */
  --font:Inter,"Neue Haas Grotesk","Helvetica Neue",system-ui,-apple-system,"Segoe UI",sans-serif;
  --fs-display:clamp(56px,5vw + 24px,96px);
  --fs-h1:clamp(44px,3.5vw + 21.6px,72px);
  --fs-h2:clamp(36px,2vw + 23.2px,52px);
  --fs-h3:clamp(24px,.75vw + 19.2px,30px);
  --fs-lead:clamp(18px,.5vw + 14.8px,22px);
  --fs-body:17px;
  --fs-small:14px;
  --fs-label:11px;
  --track-display:-.035em;
  --track-h1:-.03em;
  --track-h2:-.025em;
  --track-h3:-.02em;
  --track-label:.14em;
  --lh-display:1.02;
  --lh-h2:1.08;
  --lh-h3:1.2;
  --lh-body:1.55;
  --measure:68ch;
  --measure-lead:60ch;
  --measure-h2:14ch;

  /* ---- space: 8px base ---- */
  --sp-1:8px;  --sp-2:16px;  --sp-3:24px;  --sp-4:32px;
  --sp-5:48px; --sp-6:64px;  --sp-7:96px;  --sp-8:128px;
  --sp-9:160px;--sp-10:192px;--sp-11:240px;--sp-12:320px;
  --sec:var(--sp-7);             /* section block padding; grows at 900 / 1200 */
  --gutter:24px;
  --maxw:1440px;
  --col-gap:24px;
  --nav-h:72px;

  /* ---- shape + elevation ---- */
  --r-0:0;
  --r-1:2px;
  --r-full:999px;
  --lift:0 12px 32px -16px rgba(7,22,45,.25);

  /* ---- motion ---- */
  --t-fast:200ms;
  --t-base:600ms;
  --t-slow:1200ms;
  --ease:cubic-bezier(.2,.7,.2,1);
}
@media (min-width:900px){:root{--gutter:40px;--sec:var(--sp-8)}}
@media (min-width:1200px){:root{--gutter:64px;--sec:var(--sp-9)}}
```

- [ ] **Step 2: Verify the clamps hit the spec endpoints**

Run:
```bash
node -e "
const f=(min,vw,add,max,w)=>Math.min(max,Math.max(min,vw*w/100+add));
console.log('display',f(56,5,24,96,640),f(56,5,24,96,1440));
console.log('h1',f(44,3.5,21.6,72,640),f(44,3.5,21.6,72,1440));
console.log('h2',f(36,2,23.2,52,640),f(36,2,23.2,52,1440));
console.log('h3',f(24,.75,19.2,30,640),f(24,.75,19.2,30,1440));
console.log('lead',f(18,.5,14.8,22,640),f(18,.5,14.8,22,1440));"
```
Expected:
```
display 56 96
h1 44 72
h2 36 52
h3 24 30
lead 18 22
```

- [ ] **Step 3: Commit**

```bash
git add assets/css/tokens.css && git commit -m "Add the executive design tokens

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Base stylesheet

**Files:**
- Create: `assets/css/base.css`

- [ ] **Step 1: Write the base stylesheet**

Create `assets/css/base.css`:

```css
/* ===== Reset ===== */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:calc(var(--nav-h) + 16px)}
body{font-family:var(--font);font-size:var(--fs-body);line-height:var(--lh-body);color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;overflow-x:hidden}
img,svg{display:block;max-width:100%}
a{color:inherit;text-decoration:none}
button,input,select,textarea{font:inherit;color:inherit}
button{background:none;border:0;cursor:pointer}
ul,ol{list-style:none}
:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
::selection{background:var(--navy);color:var(--on-navy)}

/* ===== Type ===== */
h1,h2,h3,h4{font-weight:700;color:var(--ink);text-wrap:balance}
.display{font-size:var(--fs-display);font-weight:800;letter-spacing:var(--track-display);line-height:var(--lh-display)}
h1,.h1{font-size:var(--fs-h1);font-weight:800;letter-spacing:var(--track-h1);line-height:var(--lh-display)}
h2,.h2{font-size:var(--fs-h2);letter-spacing:var(--track-h2);line-height:var(--lh-h2);max-width:var(--measure-h2)}
h3,.h3{font-size:var(--fs-h3);letter-spacing:var(--track-h3);line-height:var(--lh-h3)}
p{max-width:var(--measure)}
.lead{font-size:var(--fs-lead);line-height:1.5;color:var(--muted);max-width:var(--measure-lead)}
.small{font-size:var(--fs-small);font-weight:500}
.muted{color:var(--muted)}
.label{font-size:var(--fs-label);font-weight:500;letter-spacing:var(--track-label);text-transform:uppercase;color:var(--ink-2);line-height:1}
.tnum{font-variant-numeric:tabular-nums}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* ===== Layout ===== */
.wrap{max-width:var(--maxw);margin-inline:auto;padding-inline:var(--gutter)}
.grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:var(--col-gap);row-gap:var(--sp-4)}
.c-1{grid-column:span 1}.c-2{grid-column:span 2}.c-3{grid-column:span 3}.c-4{grid-column:span 4}
.c-5{grid-column:span 5}.c-6{grid-column:span 6}.c-7{grid-column:span 7}.c-8{grid-column:span 8}
.c-9{grid-column:span 9}.c-10{grid-column:span 10}.c-11{grid-column:span 11}.c-12{grid-column:span 12}
.o-7{grid-column-start:7}.o-8{grid-column-start:8}
.sec{padding-block:var(--sec)}
.sec-tight{padding-block:var(--sp-6)}
.band{background:var(--surface);border-block:1px solid var(--line)}
.band + .band{border-top:0}
.navy{background:var(--navy);color:var(--on-navy)}
.navy h1,.navy h2,.navy h3,.navy .label{color:var(--on-navy)}
.navy .lead,.navy .muted{color:var(--on-navy-muted)}
.hairline{border:0;border-top:1px solid var(--line)}
.navy .hairline{border-color:var(--line-on-navy)}
@media (max-width:899px){
  .grid{grid-template-columns:repeat(6,minmax(0,1fr))}
  [class^="c-"],[class*=" c-"]{grid-column:1/-1}
  .o-7,.o-8{grid-column-start:auto}
  .c-sm-3{grid-column:span 3}
}
@media (max-width:639px){
  .grid{grid-template-columns:repeat(4,minmax(0,1fr));column-gap:16px}
  .c-sm-3{grid-column:1/-1}
}

/* ===== Motion verbs =====
   Pre-states live under html.js only, so the no-JS path renders the finished frame.
   1. Reveal — .reveal, staggered with --i (60ms steps). A .reveal-group reveals its children together.
   2. Draw — .draw on an SVG path that carries pathLength="1". Staggered with --i (120ms steps).
   3. Travel — graphics.css (offset-path travellers, run only while [data-run] is on screen).
   4. Scrub — [data-scrub] sections receive --p (0→1) from site.js; graphics.css interpolates from it. */
.js .reveal{opacity:0;transform:translateY(16px);transition:opacity var(--t-base) var(--ease),transform var(--t-base) var(--ease);transition-delay:calc(var(--i,0) * 60ms)}
.js .reveal.in,.js .reveal-group.in .reveal{opacity:1;transform:none}
.js .draw{stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 900ms var(--ease);transition-delay:calc(var(--i,0) * 120ms + 200ms)}
.js .in .draw,.js .draw.in{stroke-dashoffset:0}

@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  *,*::before,*::after{animation:none!important;transition:none!important}
  .js .reveal{opacity:1;transform:none}
  .js .draw{stroke-dashoffset:0}
}
```

- [ ] **Step 2: Write a minimal probe page and check computed values**

Create `tmp_probe.html` (gitignored by the `tmp_*` pattern? No — `.gitignore` only covers `tmp_*.png`, `tmp_serve.js`, `tmp_check.js`. Delete this file at the end of the step.):

```html
<!DOCTYPE html><html lang="en" class="no-js"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="assets/css/tokens.css"><link rel="stylesheet" href="assets/css/base.css">
<script>document.documentElement.className='js'</script></head>
<body><main class="wrap"><h1>Probe</h1><p class="lead">Lead</p><div class="grid"><div class="c-7">7</div><div class="c-5">5</div></div><p class="reveal">reveal</p></main></body></html>
```

Run:
```bash
node -e "
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});
await p.goto('http://localhost:8090/tmp_probe.html');
const r=await p.evaluate(()=>{const cs=e=>getComputedStyle(e);return{h1:cs(document.querySelector('h1')).fontSize,lead:cs(document.querySelector('.lead')).fontSize,gut:cs(document.querySelector('.wrap')).paddingLeft,cols:cs(document.querySelector('.grid')).gridTemplateColumns.split(' ').length,rev:cs(document.querySelector('.reveal')).opacity}});
console.log(r);await p.setViewportSize({width:390,height:800});
console.log(await p.evaluate(()=>({h1:getComputedStyle(document.querySelector('h1')).fontSize,cols:getComputedStyle(document.querySelector('.grid')).gridTemplateColumns.split(' ').length,gut:getComputedStyle(document.querySelector('.wrap')).paddingLeft})));
await b.close()})()"
```
Expected (server from Task 0 still running):
```
{ h1: '72px', lead: '22px', gut: '64px', cols: 12, rev: '0' }
{ h1: '44px', cols: 4, gut: '24px' }
```
Then delete the probe: `rm tmp_probe.html`.

- [ ] **Step 3: Commit**

```bash
git add assets/css/base.css && git commit -m "Add the base stylesheet: reset, type, grid, motion verbs

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Logo assets

The mark is redrawn from the supplied PNG. Geometry below is the reference; if tracing the PNG shows a different inner-D offset or notch angle, follow the PNG and keep the same element ids and classes. Navy parts use `currentColor` so the same markup renders white on navy surfaces; the blue square is `class="sig"` and always `#1E7BFF`.

**Files:**
- Create: `assets/svg/mark.svg`, `assets/svg/wordmark.svg`, `assets/svg/lockup.svg`
- Modify: `favicon.svg` (replace contents)

- [ ] **Step 1: Write the mark**

Create `assets/svg/mark.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 104 96" width="104" height="96" role="img" aria-label="Dayam Insights mark">
  <!-- i: signal square + input bar -->
  <rect class="sig" x="0" y="0" width="16" height="16" fill="#1E7BFF"/>
  <rect x="0" y="24" width="16" height="72" fill="currentColor"/>
  <!-- outer D: flat input face on the left, semicircular delivery face on the right -->
  <path fill="currentColor" fill-rule="evenodd" d="M28 0h28a48 48 0 0 1 0 96H28V0zm16 16v64h12a32 32 0 0 0 0-64H44z"/>
  <!-- nested inner D with the transformation notch -->
  <path fill="currentColor" d="M52 28h8a20 20 0 0 1 0 40h-8V28z"/>
  <path fill="#F8FAFC" class="notch" d="M52 28l8 8v24l-8 8V28z"/>
</svg>
```

- [ ] **Step 2: Write the wordmark and lockup**

Create `assets/svg/wordmark.svg` (text kept live rather than outlined so it stays editable; every page loads Inter anyway):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 96" width="300" height="96" role="img" aria-label="Dayam Insights">
  <text x="0" y="40" font-family="Inter, system-ui, sans-serif" font-size="44" font-weight="700" letter-spacing="-1.2" fill="currentColor">Dayam</text>
  <text x="0" y="88" font-family="Inter, system-ui, sans-serif" font-size="44" font-weight="400" letter-spacing="-.8" fill="currentColor">Insights</text>
</svg>
```

Create `assets/svg/lockup.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 96" width="460" height="96" role="img" aria-label="Dayam Insights">
  <g>
    <rect x="0" y="0" width="16" height="16" fill="#1E7BFF"/>
    <rect x="0" y="24" width="16" height="72" fill="currentColor"/>
    <path fill="currentColor" fill-rule="evenodd" d="M28 0h28a48 48 0 0 1 0 96H28V0zm16 16v64h12a32 32 0 0 0 0-64H44z"/>
    <path fill="currentColor" d="M52 28h8a20 20 0 0 1 0 40h-8V28z"/>
    <path fill="#F8FAFC" d="M52 28l8 8v24l-8 8V28z"/>
  </g>
  <line x1="136" y1="0" x2="136" y2="96" stroke="currentColor" stroke-width="1.5"/>
  <text x="168" y="40" font-family="Inter, system-ui, sans-serif" font-size="44" font-weight="700" letter-spacing="-1.2" fill="currentColor">Dayam</text>
  <text x="168" y="88" font-family="Inter, system-ui, sans-serif" font-size="44" font-weight="400" letter-spacing="-.8" fill="currentColor">Insights</text>
</svg>
```

- [ ] **Step 3: Replace the favicon**

Overwrite `favicon.svg` (the mark on a white tile, navy hard-coded because favicons get no `currentColor`):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#FFFFFF"/>
  <g transform="translate(4 4) scale(.2308)">
    <rect x="0" y="0" width="16" height="16" fill="#1E7BFF"/>
    <rect x="0" y="24" width="16" height="72" fill="#07162D"/>
    <path fill="#07162D" fill-rule="evenodd" d="M28 0h28a48 48 0 0 1 0 96H28V0zm16 16v64h12a32 32 0 0 0 0-64H44z"/>
    <path fill="#07162D" d="M52 28h8a20 20 0 0 1 0 40h-8V28z"/>
    <path fill="#FFFFFF" d="M52 28l8 8v24l-8 8V28z"/>
  </g>
</svg>
```

- [ ] **Step 4: Render all four and eyeball against the PNG**

Run:
```bash
node -e "
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:400}});
await p.setContent('<body style=\"background:#F8FAFC;display:flex;gap:48px;align-items:center;padding:40px;color:#07162D\"><img src=\"http://localhost:8090/assets/svg/mark.svg\" height=96><img src=\"http://localhost:8090/assets/svg/lockup.svg\" height=96><img src=\"http://localhost:8090/favicon.svg\" width=64><div style=\"background:#07162D;padding:24px;color:#F8FAFC\"><img src=\"http://localhost:8090/assets/svg/mark.svg\" height=96></div></body>');
await p.waitForTimeout(500);await p.screenshot({path:'tmp_logo.png'});await b.close()})()"
```
Expected: `tmp_logo.png` shows the mark, lockup and favicon. Open it beside the supplied logo PNG: blue square top-left of the i, nested D inside the counter with a diagonal notch, one thin separator line before the wordmark. Note: `<img>`-loaded SVG cannot inherit `currentColor`, so the navy tile shows a navy-on-navy mark — that is expected here; inline use in Task 5 proves the white-on-navy case.

- [ ] **Step 5: Commit**

```bash
git add assets/svg favicon.svg && git commit -m "Redraw the logo mark, wordmark and lockup as SVG

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Canonical partials, nav + footer CSS, styleguide skeleton

Nav and footer are pasted verbatim into every page from `docs/partials/`. When a page is not the homepage, set `aria-current="page"` on its own nav link (Step 6 shows where).

**Files:**
- Create: `docs/partials/head.html`, `docs/partials/nav.html`, `docs/partials/footer.html`, `docs/partials/icons.html`
- Create: `assets/css/components.css` (nav, footer, tag-line, lockup)
- Create: `styleguide.html`

- [ ] **Step 1: Write the head partial**

Create `docs/partials/head.html`. Each page replaces the three `{{…}}` slots (title, description, canonical) — these are the only placeholders in the partials and every page task fills them:

```html
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{TITLE}}</title>
<meta name="description" content="{{DESCRIPTION}}">
<link rel="canonical" href="{{CANONICAL}}">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<link rel="apple-touch-icon" href="og-image.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Dayam Insights">
<meta property="og:title" content="{{TITLE}}">
<meta property="og:description" content="{{DESCRIPTION}}">
<meta property="og:url" content="{{CANONICAL}}">
<meta property="og:image" content="https://dayaminsights.com/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F8FAFC">
<script>(function(d){d.className=d.className.replace('no-js','js');try{if(sessionStorage.getItem('dayamSplash')||matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('no-splash')}catch(e){d.classList.add('no-splash')}})(document.documentElement)</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-24QJPZPKZR"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-24QJPZPKZR');
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/tokens.css">
<link rel="stylesheet" href="assets/css/base.css">
<link rel="stylesheet" href="assets/css/components.css">
<link rel="stylesheet" href="assets/css/graphics.css">
<script src="assets/js/site.js" defer></script>
```

- [ ] **Step 2: Write the icons partial**

Create `docs/partials/icons.html` — pasted once per page directly after `<body>`. Eight symbols on a 24px grid, 1.5px stroke, square terminals:

```html
<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">
  <symbol id="i-data" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="4"/><rect x="3" y="10" width="18" height="4"/><rect x="3" y="16" width="18" height="4"/></symbol>
  <symbol id="i-automation" viewBox="0 0 24 24"><path d="M7 5h5a7 7 0 0 1 0 14H7"/><path d="M7 5v14" stroke-dasharray="2 2"/><rect x="5" y="3" width="4" height="4" fill="currentColor" stroke="none"/></symbol>
  <symbol id="i-ai" viewBox="0 0 24 24"><path d="M5 3h7a9 9 0 0 1 0 18H5V3z"/><path d="M9 8h3a4 4 0 0 1 0 8H9V8z"/></symbol>
  <symbol id="i-websites" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16"/><path d="M3 9h18"/><rect x="6" y="12" width="7" height="2" fill="currentColor" stroke="none"/><rect x="6" y="16" width="4" height="2" fill="currentColor" stroke="none"/></symbol>
  <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M4 12h15"/><path d="M13 6l6 6-6 6"/></symbol>
  <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></symbol>
  <symbol id="i-whatsapp" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13"/><path d="M7 17l-3 4v-4"/><path d="M8 10.5h8"/></symbol>
  <symbol id="i-mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14"/><path d="M3 7l9 6 9-6"/></symbol>
</svg>
```

- [ ] **Step 3: Write the nav partial**

Create `docs/partials/nav.html`. The mark is inline (not `<img>`) so `currentColor` works:

```html
<a class="skip" href="#main">Skip to content</a>
<header class="nav" id="nav">
  <div class="wrap nav-in">
    <a class="lockup" href="index.html" aria-label="Dayam Insights — home">
      <svg class="mark" viewBox="0 0 104 96" aria-hidden="true"><rect class="sig" x="0" y="0" width="16" height="16"/><rect x="0" y="24" width="16" height="72" fill="currentColor"/><path fill="currentColor" fill-rule="evenodd" d="M28 0h28a48 48 0 0 1 0 96H28V0zm16 16v64h12a32 32 0 0 0 0-64H44z"/><path fill="currentColor" d="M52 28h8a20 20 0 0 1 0 40h-8V28z"/><path class="notch" d="M52 28l8 8v24l-8 8V28z"/></svg>
      <span class="wm">Dayam<b>Insights</b></span>
    </a>
    <nav class="nav-links" aria-label="Primary">
      <a href="services.html">Services</a>
      <a href="case-studies.html">Case Studies</a>
      <a href="insights.html">Insights</a>
      <a href="about.html">About</a>
    </nav>
    <a class="btn btn-primary nav-cta" href="contact.html">Talk to us</a>
    <button class="nav-burger" type="button" aria-expanded="false" aria-controls="menu" aria-label="Menu"><i></i><i></i><i></i></button>
  </div>
  <div class="menu" id="menu" hidden>
    <a href="services.html">Services</a>
    <a href="case-studies.html">Case Studies</a>
    <a href="insights.html">Insights</a>
    <a href="about.html">About</a>
    <a class="btn btn-on-navy menu-cta" href="contact.html">Talk to us</a>
    <span class="tag-line">Data<i></i>Automation<i></i>AI<i></i>Websites</span>
  </div>
</header>
```

- [ ] **Step 4: Write the footer partial**

Create `docs/partials/footer.html`:

```html
<footer class="footer igrid on-navy">
  <div class="wrap">
    <div class="footer-top">
      <div>
        <a class="lockup" href="index.html" aria-label="Dayam Insights — home">
          <svg class="mark" viewBox="0 0 104 96" aria-hidden="true"><rect class="sig" x="0" y="0" width="16" height="16"/><rect x="0" y="24" width="16" height="72" fill="currentColor"/><path fill="currentColor" fill-rule="evenodd" d="M28 0h28a48 48 0 0 1 0 96H28V0zm16 16v64h12a32 32 0 0 0 0-64H44z"/><path fill="currentColor" d="M52 28h8a20 20 0 0 1 0 40h-8V28z"/><path class="notch" d="M52 28l8 8v24l-8 8V28z"/></svg>
          <span class="wm">Dayam<b>Insights</b></span>
        </a>
        <p class="footer-pos">We build the systems a growing business runs on: one source of truth, routine work that runs itself, and answers from your own numbers.</p>
      </div>
      <span class="tag-line">Data<i></i>Automation<i></i>AI<i></i>Websites</span>
    </div>
    <div class="footer-cols">
      <div class="footer-col"><span class="label">Services</span><a href="services.html#data">Data</a><a href="services.html#automation">Automation</a><a href="services.html#ai">AI</a><a href="services.html#websites">Websites</a></div>
      <div class="footer-col"><span class="label">Company</span><a href="case-studies.html">Case Studies</a><a href="insights.html">Insights</a><a href="about.html">About</a><a href="contact.html">Contact</a></div>
      <div class="footer-col"><span class="label">Contact</span><a href="mailto:dayaminsights@gmail.com">dayaminsights@gmail.com</a><a href="tel:+917877640693">+91 78776 40693</a><a href="https://wa.me/917877640693" target="_blank" rel="noopener">WhatsApp</a></div>
      <div class="footer-col"><span class="label">Location</span><span class="footer-txt">India · remote-first</span><span class="footer-txt">On site where it helps</span></div>
    </div>
    <div class="footer-bottom">
      <span>© <span data-year>2026</span> Dayam Insights</span>
      <span><a href="styleguide.html">Styleguide</a></span>
    </div>
  </div>
</footer>
```

- [ ] **Step 5: Write the nav, footer, lockup and tag-line CSS**

Create `assets/css/components.css` with this first block (later tasks append to this file):

```css
/* ============================================================
   components.css — nav, footer, and every reusable component.
   Order: lockup + tag-line → nav → footer → (Task 7) buttons, eyebrow,
   section head, tag, stat, diagram → (Task 11) module, case, insight,
   statement, form, FAQ → (Task 12) splash.
   ============================================================ */

/* ===== Lockup + tag-line ===== */
.lockup{display:inline-flex;align-items:center;gap:12px;font-weight:600;font-size:17px;letter-spacing:-.02em;color:var(--ink);white-space:nowrap}
.lockup .mark{width:28px;height:26px;flex:none;color:var(--navy)}
.lockup .mark .sig{fill:var(--blue)}
.lockup .mark .notch{fill:var(--surface)}
.lockup .wm b{font-weight:400;margin-left:.28em}
.navy .lockup,.footer .lockup{color:var(--on-navy)}
.navy .lockup .mark,.footer .lockup .mark{color:var(--on-navy)}
.navy .lockup .mark .notch,.footer .lockup .mark .notch{fill:var(--navy)}
.tag-line{display:inline-flex;align-items:center;gap:12px;font-size:var(--fs-label);font-weight:500;letter-spacing:var(--track-label);text-transform:uppercase;color:var(--ink-2);line-height:1}
.tag-line i{width:5px;height:5px;background:var(--blue);flex:none}
.navy .tag-line,.footer .tag-line,.menu .tag-line{color:var(--on-navy-muted)}

/* ===== Nav ===== */
.skip{position:absolute;left:var(--sp-2);top:-100px;z-index:100;background:var(--navy);color:var(--on-navy);padding:var(--sp-1) var(--sp-2);font-size:var(--fs-small);font-weight:600}
.skip:focus{top:var(--sp-2)}
.nav{position:fixed;inset:0 0 auto 0;z-index:50;height:var(--nav-h);background:var(--surface);border-bottom:1px solid var(--line);transition:height var(--t-fast) var(--ease),background var(--t-fast)}
.nav.scrolled{height:64px;background:rgba(255,255,255,.88);-webkit-backdrop-filter:saturate(1.2) blur(12px);backdrop-filter:saturate(1.2) blur(12px)}
.nav-in{height:100%;display:flex;align-items:center;gap:var(--sp-4)}
.nav-links{display:flex;gap:var(--sp-4);margin-left:auto}
.nav-links a{font-size:var(--fs-small);font-weight:500;color:var(--ink-2);padding:6px 0;border-bottom:2px solid transparent;transition:color var(--t-fast),border-color var(--t-fast)}
.nav-links a:hover{color:var(--ink)}
.nav-links a[aria-current="page"]{color:var(--ink);border-bottom-color:var(--blue)}
.nav-cta{flex:none}
.nav-burger{display:none;margin-left:auto;width:44px;height:44px;position:relative}
.nav-burger i{position:absolute;left:12px;right:12px;height:2px;background:var(--ink);transition:transform var(--t-fast) var(--ease),opacity var(--t-fast)}
.nav-burger i:nth-child(1){top:15px}
.nav-burger i:nth-child(2){top:21px}
.nav-burger i:nth-child(3){top:27px}
.nav-burger[aria-expanded="true"] i:nth-child(1){transform:translateY(6px) rotate(45deg)}
.nav-burger[aria-expanded="true"] i:nth-child(2){opacity:0}
.nav-burger[aria-expanded="true"] i:nth-child(3){transform:translateY(-6px) rotate(-45deg)}
.menu{position:fixed;inset:var(--nav-h) 0 0 0;z-index:49;background:var(--navy);color:var(--on-navy);padding:var(--sp-5) var(--gutter) var(--sp-4);display:flex;flex-direction:column;overflow:auto}
.menu[hidden]{display:none}
.menu > a:not(.btn){font-size:var(--fs-h2);font-weight:700;letter-spacing:var(--track-h2);padding:var(--sp-2) 0;border-bottom:1px solid var(--line-on-navy);color:var(--on-navy)}
.menu .menu-cta{margin-top:var(--sp-4);align-self:flex-start}
.menu .tag-line{margin-top:auto;padding-top:var(--sp-5)}
body.menu-open{overflow:hidden}
@media (max-width:899px){.nav-links,.nav-cta{display:none}.nav-burger{display:block}}

/* ===== Footer ===== */
.footer{position:relative;background:var(--navy);color:var(--on-navy);padding-block:var(--sp-7) var(--sp-4);overflow:hidden}
.footer > .wrap{position:relative;z-index:1}
.footer-top{display:grid;grid-template-columns:1.4fr 1fr;gap:var(--sp-6);align-items:start;padding-bottom:var(--sp-6);border-bottom:1px solid var(--line-on-navy)}
.footer-top .tag-line{justify-self:end}
.footer-pos{margin-top:var(--sp-3);color:var(--on-navy-muted);max-width:44ch}
.footer-cols{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--sp-4);padding-block:var(--sp-6)}
.footer-col .label{display:block;color:var(--on-navy-muted);margin-bottom:var(--sp-2)}
.footer-col a,.footer-col .footer-txt{display:block;padding:6px 0;font-size:var(--fs-small);font-weight:500;color:var(--on-navy)}
.footer-col a:hover{color:var(--blue)}
.footer-bottom{display:flex;flex-wrap:wrap;gap:var(--sp-3);justify-content:space-between;padding-top:var(--sp-4);border-top:1px solid var(--line-on-navy);font-size:var(--fs-small);color:var(--on-navy-muted)}
.footer-bottom a{color:var(--on-navy-muted)}
.footer-bottom a:hover{color:var(--on-navy)}
@media (max-width:899px){.footer-top{grid-template-columns:1fr}.footer-top .tag-line{justify-self:start}.footer-cols{grid-template-columns:1fr 1fr}}
@media (max-width:639px){.footer-cols{grid-template-columns:1fr}}
```

- [ ] **Step 6: Write the styleguide skeleton**

Create `styleguide.html`. Paste the partials where marked; the nav's Styleguide is not a nav link so no `aria-current` here. Sections after "Logo" are filled by Tasks 7–12.

```html
<!DOCTYPE html>
<html lang="en" class="no-js">
<head>
<!-- paste docs/partials/head.html with:
     TITLE       = Styleguide | Dayam Insights
     DESCRIPTION = The Dayam Insights visual system: logo, colour, type, spacing, components, graphics and motion.
     CANONICAL   = https://dayaminsights.com/styleguide.html -->
<meta name="robots" content="noindex,nofollow">
<style>
  /* styleguide-only chrome */
  .sg-main{padding-top:calc(var(--nav-h) + var(--sp-7))}
  .sg-sec{padding-block:var(--sp-6);border-top:1px solid var(--line)}
  .sg-sec > .wrap > h2{margin-bottom:var(--sp-4)}
  .sg-row{display:flex;flex-wrap:wrap;gap:var(--sp-3);align-items:center}
  .sg-note{font-size:var(--fs-small);color:var(--muted);margin-top:var(--sp-2)}
  .sg-swatch{width:120px;border:1px solid var(--line)}
  .sg-swatch i{display:block;height:72px}
  .sg-swatch span{display:block;padding:8px 10px;font-size:12px;font-variant-numeric:tabular-nums}
  .sg-ratio{display:flex;height:16px;border:1px solid var(--line);max-width:480px}
  .sg-ratio i:nth-child(1){flex:80;background:var(--navy)}
  .sg-ratio i:nth-child(2){flex:15;background:var(--surface)}
  .sg-ratio i:nth-child(3){flex:5;background:var(--blue)}
  .sg-type > *{margin-bottom:var(--sp-3)}
  .sg-space{display:flex;align-items:flex-end;gap:8px}
  .sg-space i{display:block;width:var(--w);height:var(--w);background:var(--navy)}
  .sg-navy{background:var(--navy);padding:var(--sp-4)}
  .sg-grid-toggle{position:fixed;right:16px;bottom:16px;z-index:60}
  body.show-grid .grid{background-image:linear-gradient(90deg,rgba(30,123,255,.08) 0 calc(100% - var(--col-gap)),transparent calc(100% - var(--col-gap)) 100%);background-size:calc((100% + var(--col-gap)) / 12) 100%}
  table.sg-table{border-collapse:collapse;font-size:var(--fs-small);width:100%;max-width:720px}
  .sg-table th,.sg-table td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line)}
  .sg-table th{font-size:var(--fs-label);letter-spacing:var(--track-label);text-transform:uppercase;color:var(--ink-2);font-weight:500}
</style>
</head>
<body>
<!-- paste docs/partials/icons.html -->
<!-- paste docs/partials/nav.html -->

<main id="main" class="sg-main">
  <div class="wrap">
    <span class="eyebrow"><span class="ch">00</span><i></i>Design system</span>
    <h1 style="margin-top:16px">Everything on this site derives from the mark.</h1>
    <p class="lead" style="margin-top:24px">The blue square is the signal, the i-bar is input, the D is the system. This page shows the primitives, the components and the six graphics that follow from that reading, with the rules that keep them honest.</p>
  </div>

  <section class="sg-sec" id="sg-logo">
    <div class="wrap">
      <h2>Logo</h2>
      <div class="sg-row">
        <img src="assets/svg/lockup.svg" alt="Dayam Insights lockup" height="96">
        <img src="assets/svg/mark.svg" alt="Dayam Insights mark" height="96">
        <div class="sg-navy"><span class="lockup" style="font-size:24px"><svg class="mark" viewBox="0 0 104 96" aria-hidden="true" style="width:42px;height:39px"><rect class="sig" x="0" y="0" width="16" height="16"/><rect x="0" y="24" width="16" height="72" fill="currentColor"/><path fill="currentColor" fill-rule="evenodd" d="M28 0h28a48 48 0 0 1 0 96H28V0zm16 16v64h12a32 32 0 0 0 0-64H44z"/><path fill="currentColor" d="M52 28h8a20 20 0 0 1 0 40h-8V28z"/><path class="notch" d="M52 28l8 8v24l-8 8V28z"/></svg><span class="wm">Dayam<b>Insights</b></span></span></div>
      </div>
      <p class="sg-note">Clearspace: one blue-square unit on every side. Minimum mark size 24px. Navy parts use <code>currentColor</code>; the blue square never changes.</p>
    </div>
  </section>

  <!-- Task 7 adds: #sg-colour #sg-type #sg-space #sg-shape #sg-buttons #sg-labels #sg-stat #sg-diagram -->
  <!-- Task 8–10 add: #sg-graphics #sg-icons -->
  <!-- Task 11 adds: #sg-module #sg-case #sg-insight #sg-stmt #sg-form #sg-faq -->
  <!-- Task 12 adds: #sg-motion #sg-rules -->
</main>

<!-- paste docs/partials/footer.html -->
<button class="btn btn-secondary sg-grid-toggle" type="button" onclick="document.body.classList.toggle('show-grid')">Grid</button>
</body>
</html>
```

Replace the three `<!-- paste … -->` comments with the partial contents, and fill the three head slots. Note: `<img>`-loaded SVGs render `currentColor` as black, so the two `<img>` logos read black-on-white here; that is acceptable on the styleguide, and the inline navy tile beside them proves the white-on-navy case.

- [ ] **Step 7: Create an empty graphics.css and site.js so the page loads clean**

Create `assets/css/graphics.css` containing only:
```css
/* graphics.css — the six SVG systems, icons and figures. Filled by Tasks 8–10. */
```
Create `assets/js/site.js` containing only:
```js
/* site.js — filled by Task 6. */
```

- [ ] **Step 8: Check the page**

Run:
```bash
node tmp_check.js styleguide.html --expect ".nav,.lockup,.footer,#sg-logo" --shots
```
Expected: all `ok`, `ALL OK`. Open `tmp_styleguide_html_1440.png`: white 72px nav with lockup left, four links and a "Talk to us" link (unstyled until Task 7 — a plain link is acceptable at this step), navy footer with four columns and a white lockup. Open `tmp_styleguide_html_390.png`: burger visible, links hidden, footer single column.

- [ ] **Step 9: Commit**

```bash
git add docs/partials assets/css/components.css assets/css/graphics.css assets/js/site.js styleguide.html && git commit -m "Add nav, footer and the styleguide skeleton

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: site.js core — scroll bus, nav, reveal, run, scrub, steppers, counters, year

**Files:**
- Modify: `assets/js/site.js` (replace contents)

- [ ] **Step 1: Write the core script**

Replace `assets/js/site.js` with:

```js
/* site.js — one scroll bus, every observer, no libraries.
   Sections:
   1. scroll bus      — a single rAF handler; measurements cached on resize, never read on scroll
   2. nav             — scrolled state, hamburger
   3. reveal          — .reveal / .reveal-group get .in once at 15% visibility
   4. run             — [data-run] gets .run while on screen (travellers, ripples)
   5. scrub           — [data-scrub] gets --p 0→1 from its own scroll travel, smoothstep eased
   6. steppers        — [data-steps] marks children .done / .live from --p
   7. counters        — [data-count] counts up once
   8. pulse network   — .pulse-net cycles one .pn.on at a time while visible
   9. splash          — Task 12
   10. form fallback  — Task 16
*/
(function () {
  'use strict';
  var rmq = window.matchMedia('(prefers-reduced-motion: reduce)');
  function reduced() { return rmq.matches; }
  var clamp01 = function (t) { return t < 0 ? 0 : t > 1 ? 1 : t; };
  var smooth = function (t) { t = clamp01(t); return t * t * (3 - 2 * t); };

  /* ---------- 1. scroll bus ---------- */
  var onScroll = [], onMeasure = [], raf = 0;
  function frame() { raf = 0; var y = window.scrollY || window.pageYOffset; for (var i = 0; i < onScroll.length; i++) onScroll[i](y); }
  function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
  function measure() { for (var i = 0; i < onMeasure.length; i++) onMeasure[i](); schedule(); }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  /* ---------- 2. nav ---------- */
  var nav = document.getElementById('nav');
  if (nav) {
    onScroll.push(function (y) { nav.classList.toggle('scrolled', y > 8); });
    var burger = nav.querySelector('.nav-burger'), menu = document.getElementById('menu');
    if (burger && menu) {
      var setMenu = function (open) {
        burger.setAttribute('aria-expanded', String(open));
        menu.hidden = !open;
        document.body.classList.toggle('menu-open', open);
      };
      burger.addEventListener('click', function () { setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
      menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });
    }
  }

  /* ---------- 3. reveal ---------- */
  var revealIo = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); revealIo.unobserve(e.target); } });
  }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
  document.querySelectorAll('.reveal, .reveal-group').forEach(function (el) { revealIo.observe(el); });

  /* ---------- 4. run while visible ---------- */
  var runIo = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { e.target.classList.toggle('run', e.isIntersecting && !reduced()); });
  }, { threshold: 0.2 });
  document.querySelectorAll('[data-run]').forEach(function (el) { runIo.observe(el); });

  /* ---------- 5. scrub ----------
     --p = 0 when the section's top reaches (start × viewport height) from the top of the viewport,
     --p = 1 after the page has scrolled (len × section height) further. Defaults: start .75, len 1. */
  document.querySelectorAll('[data-scrub]').forEach(function (el) {
    var top = 0, h = 1;
    var start = parseFloat(el.getAttribute('data-scrub-start') || '.75');
    var len = parseFloat(el.getAttribute('data-scrub-len') || '1');
    var last = -1;
    onMeasure.push(function () { var r = el.getBoundingClientRect(); top = r.top + (window.scrollY || window.pageYOffset); h = r.height || 1; });
    onScroll.push(function (y) {
      var p = reduced() ? 1 : smooth((y + window.innerHeight * start - top) / (h * len));
      if (p === last) return;
      last = p;
      el.style.setProperty('--p', p.toFixed(4));
      el.dispatchEvent(new CustomEvent('scrub', { detail: p }));
    });
  });

  /* ---------- 6. steppers ---------- */
  document.querySelectorAll('[data-steps]').forEach(function (el) {
    var items = Array.prototype.slice.call(el.querySelectorAll(el.getAttribute('data-steps')));
    var n = items.length;
    if (!n) return;
    el.addEventListener('scrub', function (e) {
      var idx = e.detail >= 1 ? n : Math.floor(e.detail * n);
      items.forEach(function (it, k) {
        it.classList.toggle('done', k < idx);
        it.classList.toggle('live', k === idx || (idx === n && k === n - 1));
      });
    });
  });

  /* ---------- 7. counters ---------- */
  document.querySelectorAll('[data-count]').forEach(function (el) {
    var end = parseFloat(el.getAttribute('data-count'));
    var dec = parseInt(el.getAttribute('data-dec') || '0', 10);
    var pre = el.getAttribute('data-prefix') || '', suf = el.getAttribute('data-suffix') || '';
    var fmt = function (v) { return pre + v.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; };
    if (reduced()) { el.textContent = fmt(end); return; }
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      var t0 = performance.now(), d = 1400;
      var tick = function (now) {
        var t = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - t, 3);
        el.textContent = fmt(end * e);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    io.observe(el);
  });

  /* ---------- 8. pulse network ---------- */
  document.querySelectorAll('.pulse-net').forEach(function (svg) {
    var nodes = Array.prototype.slice.call(svg.querySelectorAll('.pn'));
    if (!nodes.length) return;
    var i = 0, timer = 0;
    var step = function () {
      nodes.forEach(function (n) { n.classList.remove('on'); });
      nodes[i % nodes.length].classList.add('on');
      i = (i + 1 + Math.floor(Math.random() * 3)) % nodes.length;
    };
    var on = function () { if (timer || reduced()) return; step(); timer = setInterval(step, 2400); };
    var off = function () { clearInterval(timer); timer = 0; };
    new IntersectionObserver(function (entries) { entries[0].isIntersecting ? on() : off(); }, { threshold: 0.1 }).observe(svg);
  });

  /* ---------- footer year ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  measure();
  window.DAYAM = { onScroll: onScroll, onMeasure: onMeasure, measure: measure, reduced: reduced, smooth: smooth };
})();
```

- [ ] **Step 2: Verify the nav and reveal behaviour**

Temporarily add to `styleguide.html`, just before `</main>`:
```html
<div style="height:200vh"></div><p class="reveal" id="sg-probe">probe</p>
```
Run:
```bash
node -e "
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});
p.on('pageerror',e=>console.log('PAGEERROR',e));
await p.goto('http://localhost:8090/styleguide.html',{waitUntil:'networkidle'});
console.log('scrolled@0', await p.evaluate(()=>document.getElementById('nav').classList.contains('scrolled')));
console.log('probe opacity before', await p.evaluate(()=>getComputedStyle(document.getElementById('sg-probe')).opacity));
await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await p.waitForTimeout(900);
console.log('scrolled@end', await p.evaluate(()=>document.getElementById('nav').classList.contains('scrolled')));
console.log('probe opacity after', await p.evaluate(()=>getComputedStyle(document.getElementById('sg-probe')).opacity));
await p.setViewportSize({width:390,height:800});await p.click('.nav-burger');
console.log('menu open', await p.evaluate(()=>!document.getElementById('menu').hidden && document.body.classList.contains('menu-open')));
await p.keyboard.press('Escape');console.log('menu closed', await p.evaluate(()=>document.getElementById('menu').hidden));
await b.close()})()"
```
Expected:
```
scrolled@0 false
probe opacity before 0
scrolled@end true
probe opacity after 1
menu open true
menu closed true
```
Then remove the two temporary probe elements from `styleguide.html`.

- [ ] **Step 3: Commit**

```bash
git add assets/js/site.js && git commit -m "Add the site script: scroll bus, nav, reveal, scrub, steppers, counters

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: Buttons, eyebrow, section head, tag, stat, diagram frame + styleguide foundations

**Files:**
- Modify: `assets/css/components.css` (append)
- Modify: `styleguide.html` (add sections)

- [ ] **Step 1: Append the component CSS**

Append to `assets/css/components.css`:

```css
/* ===== Buttons ===== */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;height:48px;padding:0 var(--sp-3);font-size:var(--fs-small);font-weight:600;border:1px solid transparent;border-radius:var(--r-0);white-space:nowrap;transition:background var(--t-fast),color var(--t-fast),border-color var(--t-fast)}
.btn .ico{width:16px;height:16px}
.btn-primary{background:var(--navy);color:var(--on-navy);border-color:var(--navy)}
.btn-primary:hover{background:var(--blue);border-color:var(--blue);color:#fff}
.btn-secondary{border-color:var(--navy);color:var(--ink);background:transparent}
.btn-secondary:hover{background:var(--navy);color:var(--on-navy)}
.btn-on-navy{background:var(--on-navy);color:var(--navy);border-color:var(--on-navy)}
.btn-on-navy:hover{background:var(--blue);border-color:var(--blue);color:#fff}
.btn-link{display:inline-flex;align-items:center;gap:8px;font-size:var(--fs-small);font-weight:600;color:var(--ink);border-bottom:1px solid var(--navy);padding-bottom:2px;transition:color var(--t-fast),border-color var(--t-fast)}
.btn-link:hover{color:var(--blue);border-color:var(--blue)}
.btn-link .ico{width:16px;height:16px;transition:transform var(--t-fast) var(--ease)}
.btn-link:hover .ico{transform:translateX(3px)}
.navy .btn-link{color:var(--on-navy);border-color:var(--on-navy)}
.navy .btn-link:hover{color:var(--blue);border-color:var(--blue)}
.btn-row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-3)}
.ico{width:1em;height:1em;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:butt;stroke-linejoin:miter;flex:none}

/* ===== Eyebrow + section head ===== */
.eyebrow{display:inline-flex;align-items:center;gap:10px;font-size:var(--fs-label);font-weight:500;letter-spacing:var(--track-label);text-transform:uppercase;color:var(--ink-2);line-height:1}
.eyebrow .ch{font-variant-numeric:tabular-nums}
.eyebrow i{width:5px;height:5px;background:var(--blue);flex:none}
.navy .eyebrow{color:var(--on-navy-muted)}
.sec-head{display:grid;gap:var(--sp-3);margin-bottom:var(--sp-6);justify-items:start}
.sec-head.center{justify-items:center;text-align:center}
.sec-head.center h2{max-width:20ch}
.sec-head .lead{margin-top:var(--sp-1)}

/* ===== Tag ===== */
.tags{display:flex;flex-wrap:wrap;gap:8px}
.tag{font-size:var(--fs-label);font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2);border:1px solid var(--line);background:var(--surface);padding:7px 10px;line-height:1;white-space:nowrap}
.navy .tag{color:var(--on-navy-muted);border-color:var(--line-on-navy);background:transparent}

/* ===== Stat ===== */
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--col-gap)}
.stat{border-top:1px solid var(--navy);padding-top:var(--sp-2)}
.stat b{display:block;font-size:var(--fs-h1);font-weight:800;letter-spacing:var(--track-h1);line-height:1;font-variant-numeric:tabular-nums;color:var(--ink)}
.stat b small{font-size:.42em;font-weight:600;letter-spacing:0;margin-left:.15em}
.stat span{display:block;margin-top:var(--sp-2);font-size:var(--fs-small);font-weight:400;color:var(--muted);max-width:26ch}
.stat.sm b{font-size:var(--fs-h2)}
.navy .stat{border-color:var(--line-on-navy)}
.navy .stat b{color:var(--on-navy)}
@media (max-width:899px){.stats{grid-template-columns:repeat(2,1fr)}}

/* ===== Diagram frame ===== */
.diagram{position:relative;background:var(--bg);border:1px solid var(--line);overflow:hidden}
.diagram svg{width:100%;height:auto}
.diagram .fig{position:absolute;left:var(--sp-2);bottom:var(--sp-2);font-size:var(--fs-label);font-weight:500;letter-spacing:var(--track-label);text-transform:uppercase;color:var(--ink-2)}
.navy .diagram{background:transparent;border-color:var(--line-on-navy)}
.navy .diagram .fig{color:var(--on-navy-muted)}
```

- [ ] **Step 2: Add the foundation sections to the styleguide**

Insert into `styleguide.html`, replacing the comment `<!-- Task 7 adds: … -->`:

```html
  <section class="sg-sec" id="sg-colour">
    <div class="wrap">
      <h2>Colour</h2>
      <div class="sg-row">
        <div class="sg-swatch"><i style="background:#07162D"></i><span>--navy #07162D</span></div>
        <div class="sg-swatch"><i style="background:#1E7BFF"></i><span>--blue #1E7BFF</span></div>
        <div class="sg-swatch"><i style="background:#F8FAFC"></i><span>--bg #F8FAFC</span></div>
        <div class="sg-swatch"><i style="background:#FFFFFF"></i><span>--surface #FFFFFF</span></div>
        <div class="sg-swatch"><i style="background:#E5EAF2"></i><span>--line #E5EAF2</span></div>
        <div class="sg-swatch"><i style="background:#64748B"></i><span>--muted #64748B</span></div>
        <div class="sg-swatch"><i style="background:#334155"></i><span>--ink-2 #334155</span></div>
      </div>
      <p class="sg-note" style="margin-top:24px">Ratio across any viewport — 80 navy · 15 white · 5 blue:</p>
      <div class="sg-ratio"><i></i><i></i><i></i></div>
      <table class="sg-table" style="margin-top:24px">
        <tr><th>Pair</th><th>Ratio</th><th>Use</th></tr>
        <tr><td>navy on bg</td><td>15.6 : 1</td><td>all text</td></tr>
        <tr><td>muted on white</td><td>4.7 : 1</td><td>text 14px and up</td></tr>
        <tr><td>ink-2 on white</td><td>9.9 : 1</td><td>11px labels</td></tr>
        <tr><td>on-navy-muted on navy</td><td>8.4 : 1</td><td>secondary on navy</td></tr>
        <tr><td>blue on navy</td><td>4.6 : 1</td><td>hover links on navy, 14px+</td></tr>
        <tr><td>blue on white</td><td>4.0 : 1</td><td>never for text — active nodes and CTA hover fill only</td></tr>
      </table>
    </div>
  </section>

  <section class="sg-sec" id="sg-type">
    <div class="wrap sg-type">
      <h2>Type</h2>
      <p class="display">Intelligence. Engineered.</p>
      <h1>Building intelligent systems for modern businesses.</h1>
      <h2 style="max-width:none">One system. Four layers. Each one feeds the next.</h2>
      <h3>Order to invoice, without the retyping.</h3>
      <p class="lead">Lead — We connect your orders, stock, invoices and customers into one system that updates itself.</p>
      <p>Body — Every client reaches us having already done the hardest part: a business that works. What follows is the system we build around it, one layer at a time.</p>
      <p class="small">Small 14 / 500 — used for nav, buttons, meta.</p>
      <span class="label">Label 11 / 500 / .14em — eyebrows, tags, figure captions</span>
      <p class="sg-note">Inter 400 / 500 / 600 / 700 / 800. Headings tight-tracked. Numbers always <code>tabular-nums</code>.</p>
    </div>
  </section>

  <section class="sg-sec" id="sg-space">
    <div class="wrap">
      <h2>Spacing and grid</h2>
      <div class="sg-space">
        <i style="--w:8px"></i><i style="--w:16px"></i><i style="--w:24px"></i><i style="--w:32px"></i><i style="--w:48px"></i><i style="--w:64px"></i><i style="--w:96px"></i><i style="--w:128px"></i>
      </div>
      <p class="sg-note">8 · 16 · 24 · 32 · 48 · 64 · 96 · 128 · 160 · 192 · 240 · 320. Section padding 96 / 128 / 160 by breakpoint. 12-column grid, 24px gap, 1440 max, gutters 24 / 40 / 64. Toggle the grid with the button bottom-right.</p>
      <div class="grid" style="margin-top:24px">
        <div class="c-7" style="border:1px solid var(--line);padding:16px">c-7</div>
        <div class="c-5" style="border:1px solid var(--line);padding:16px">c-5</div>
        <div class="c-4" style="border:1px solid var(--line);padding:16px">c-4</div>
        <div class="c-4" style="border:1px solid var(--line);padding:16px">c-4</div>
        <div class="c-4" style="border:1px solid var(--line);padding:16px">c-4</div>
      </div>
    </div>
  </section>

  <section class="sg-sec" id="sg-shape">
    <div class="wrap">
      <h2>Shape and elevation</h2>
      <div class="sg-row">
        <div style="width:96px;height:64px;border:1px solid var(--navy)"></div>
        <div style="width:96px;height:64px;border:1px solid var(--navy);border-radius:2px"></div>
        <div style="width:96px;height:64px;background:var(--navy);border-radius:0 32px 32px 0"></div>
        <div style="width:96px;height:64px;background:var(--surface);border:1px solid var(--line);box-shadow:var(--lift);transform:translateY(-4px)"></div>
      </div>
      <p class="sg-note">Radius 0 by default · 2px for inputs where a hairline needs softening · full only on D-derived shapes (flat left, round right). No resting shadow; the lift appears on hover only.</p>
    </div>
  </section>

  <section class="sg-sec" id="sg-buttons">
    <div class="wrap">
      <h2>Buttons</h2>
      <div class="btn-row">
        <a class="btn btn-primary" href="#">Book a systems review</a>
        <a class="btn btn-secondary" href="#">Secondary</a>
        <a class="btn-link" href="#">Text link <svg class="ico"><use href="#i-arrow"/></svg></a>
      </div>
      <div class="sg-navy btn-row navy" style="margin-top:24px">
        <a class="btn btn-on-navy" href="#">On navy</a>
        <a class="btn-link" href="#">Text link on navy <svg class="ico"><use href="#i-arrow"/></svg></a>
      </div>
      <p class="sg-note">One primary per section. Hover swaps the fill to blue — the only place blue fills a large area.</p>
    </div>
  </section>

  <section class="sg-sec" id="sg-labels">
    <div class="wrap">
      <h2>Eyebrow, tag-line, tags</h2>
      <div class="sg-row">
        <span class="eyebrow"><span class="ch">01</span><i></i>What we build</span>
        <span class="tag-line">Data<i></i>Automation<i></i>AI<i></i>Websites</span>
      </div>
      <div class="tags" style="margin-top:24px"><span class="tag">Power BI</span><span class="tag">SQL</span><span class="tag">REST APIs</span><span class="tag">Claude</span></div>
      <div class="sec-head" style="margin-top:48px;margin-bottom:0">
        <span class="eyebrow"><span class="ch">02</span><i></i>Section head</span>
        <h2>Eyebrow, heading, lead — in that order, every time.</h2>
        <p class="lead">The chapter number counts the argument. FAQ and the close are unnumbered because they are not part of it.</p>
      </div>
    </div>
  </section>

  <section class="sg-sec" id="sg-stat">
    <div class="wrap">
      <h2>Stat</h2>
      <ul class="stats">
        <li class="stat"><b data-count="1284">0</b><span>Orders this month</span></li>
        <li class="stat"><b data-count="32.4" data-dec="1" data-suffix="%">0%</b><span>Gross margin</span></li>
        <li class="stat"><b>4–6<small>wks</small></b><span>First working system live</span></li>
        <li class="stat"><b>0</b><span>Lock-in — every account stays yours</span></li>
      </ul>
      <p class="sg-note">Numbers count up once on reveal (1400ms, cubic ease-out). Non-numeric stats stay static.</p>
    </div>
  </section>

  <section class="sg-sec" id="sg-diagram">
    <div class="wrap">
      <h2>Diagram frame</h2>
      <div class="diagram" style="max-width:480px">
        <svg viewBox="0 0 480 240" aria-hidden="true"><rect x="40" y="40" width="160" height="120" fill="none" stroke="#07162D" stroke-opacity=".28"/><rect x="234" y="94" width="12" height="12" fill="#1E7BFF"/><path d="M200 100h34" stroke="#07162D" stroke-opacity=".28"/></svg>
        <span class="fig">Fig. 00 — Frame</span>
      </div>
      <p class="sg-note">Every graphic sits in a frame: 1px line, bg fill, caption bottom-left. On navy the frame goes transparent with a light hairline.</p>
    </div>
  </section>
```

- [ ] **Step 3: Check**

Run:
```bash
node tmp_check.js styleguide.html --expect ".btn-primary,.eyebrow,.stats,.diagram,#sg-type .display" --shots
```
Expected: all `ok`, `ALL OK`. In `tmp_styleguide_html_1440.png`: display line at 96px, buttons with 0 radius, stats with a hairline above each number, the diagram frame captioned. In `tmp_styleguide_html_390.png`: stats in two columns, display at 56px.

- [ ] **Step 4: Commit**

```bash
git add assets/css/components.css styleguide.html && git commit -m "Add buttons, eyebrow, tags, stat and diagram frame to the system

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: Graphics — shared primitives, Intelligence Grid (6), Intelligence Mesh (1)

**Files:**
- Modify: `assets/css/graphics.css` (replace contents)
- Modify: `assets/js/site.js` (append the mesh hub hook)
- Modify: `styleguide.html` (add `#sg-graphics` with the first two systems)

- [ ] **Step 1: Write the graphics stylesheet foundation**

Replace `assets/css/graphics.css` with:

```css
/* ============================================================
   graphics.css — the six graphic systems and their shared primitives.
   6 Intelligence Grid   .igrid           CSS background, no SVG file
   1 Intelligence Mesh   svg.mesh         scrubbed by --p on a [data-scrub] ancestor
   2 Data Flow           svg.flow         .draw on .in, traveller .tr while .run   (Task 9)
   3 Automation Loop     svg.loop         .draw on .in, traveller .tr while .run   (Task 9)
   4 System Blueprint    svg.bp           .draw on .in                              (Task 10)
   5 Signal Pulse Net    svg.pulse-net    site.js cycles .pn.on                     (Task 10)
   Shared rules: strokes are navy hairlines, nodes are squares, one blue element per composition.
   Every SVG path that draws carries pathLength="1" so dash math is unit-free.
   ============================================================ */

/* ===== 6. Intelligence Grid — square dots on a 32px lattice ===== */
.igrid{position:relative}
.igrid::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect x='15' y='15' width='2' height='2' fill='%2307162D'/%3E%3C/svg%3E");opacity:.06}
.igrid.on-navy::before{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect x='15' y='15' width='2' height='2' fill='%23F8FAFC'/%3E%3C/svg%3E");opacity:.08}
/* Blueprint lines — hero only, 64px, fading out below the fold */
.bp-lines::after{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(7,22,45,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(7,22,45,.05) 1px,transparent 1px);background-size:64px 64px;-webkit-mask-image:linear-gradient(#000 55%,transparent);mask-image:linear-gradient(#000 55%,transparent)}
.igrid > *,.bp-lines > *{position:relative;z-index:1}

/* ===== Shared SVG primitives ===== */
.g-line{fill:none;stroke:var(--navy);stroke-opacity:.28;stroke-width:1}
.g-line.soft{stroke-opacity:.12}
.g-line.dash{stroke-dasharray:3 4}
.g-node{fill:var(--bg);stroke:var(--navy);stroke-width:1.2}
.g-node.on,.g-sig{fill:var(--blue);stroke:var(--blue)}
.g-fill{fill:var(--navy)}
.g-cut{fill:var(--bg)}
.g-lbl{font-family:var(--font);font-size:9px;font-weight:500;letter-spacing:1.2px;fill:var(--ink-2);text-transform:uppercase}
.g-lbl.sm{font-size:7px;letter-spacing:1px}
.navy .g-line{stroke:var(--on-navy)}
.navy .g-node{fill:var(--navy);stroke:var(--on-navy)}
.navy .g-fill{fill:var(--on-navy)}
.navy .g-cut{fill:var(--navy)}
.navy .g-lbl{fill:var(--on-navy-muted)}

/* Travellers (verb 3) — a blue square along an offset-path, only while [data-run] is on screen */
.tr{fill:var(--blue);opacity:0;offset-rotate:0deg;offset-anchor:center;transform-box:fill-box;transform-origin:center}
.js .run .tr{opacity:1;animation:travel 4s linear infinite}
.js .run .loop .tr,.js .loop.run .tr{animation-duration:6s}
@keyframes travel{from{offset-distance:0%}to{offset-distance:100%}}
@supports not (offset-path:path('M0 0h1')){.tr{display:none}}

/* Square ripple — shared by the mesh hub and the pulse network */
@keyframes ripple{0%{opacity:.7;transform:scale(1)}100%{opacity:0;transform:scale(2.4)}}

/* ===== 1. Intelligence Mesh ===== */
.mesh{width:100%;height:auto;overflow:visible}
.mesh .mn{opacity:clamp(0,(var(--p,1) - var(--t,0)) * 6,1)}
.mesh .me{stroke-dasharray:1;stroke-dashoffset:calc(1 - clamp(0,(var(--p,1) - var(--t,0)) * 5,1))}
.mesh .hub .core{transition:fill var(--t-base),stroke var(--t-base)}
.mesh .hub .rip{fill:none;stroke:var(--blue);stroke-width:1;opacity:0;transform-box:fill-box;transform-origin:center}
.mesh.on .hub .core{fill:var(--blue);stroke:var(--blue)}
.js .mesh.on .hub .rip{animation:ripple 3s var(--ease) infinite}

@media (prefers-reduced-motion:reduce){
  .tr,.mesh .hub .rip{display:none}
  .mesh .mn{opacity:1}
  .mesh .me{stroke-dashoffset:0}
}
```

- [ ] **Step 2: Append the mesh hub hook to site.js**

Append to `assets/js/site.js`, immediately before the line `measure();` near the end:

```js
  /* ---------- 1b. mesh hub — lights once the scrub has passed 92% ---------- */
  document.querySelectorAll('[data-scrub] .mesh').forEach(function (mesh) {
    mesh.closest('[data-scrub]').addEventListener('scrub', function (e) { mesh.classList.toggle('on', e.detail > 0.92); });
  });
```

- [ ] **Step 3: Add the graphics section to the styleguide with the mesh**

Insert into `styleguide.html`, replacing the comment `<!-- Task 8–10 add: … -->`. The mesh section carries `data-scrub` so it scrubs from its own scroll travel here, exactly as `#signal` will on the homepage. The `<svg class="mesh">` block below is the canonical mesh; Task 14 pastes it into `index.html` unchanged.

```html
  <section class="sg-sec" id="sg-graphics">
    <div class="wrap">
      <h2>Graphics</h2>
      <p class="sg-note" style="margin-bottom:32px">Six systems, all derived from the mark. Hand-authored SVG, no libraries. Strokes are navy hairlines, nodes are squares, one blue element per composition.</p>

      <h3>6 — Intelligence Grid</h3>
      <div class="igrid" style="height:160px;border:1px solid var(--line)"></div>
      <div class="igrid on-navy" style="height:160px;background:var(--navy);margin-top:16px"></div>
      <p class="sg-note">2px square dots on a 32px lattice at 6% (8% on navy). Background only. The hero layers 64px blueprint lines on top.</p>
    </div>
  </section>

  <section class="sg-sec" id="sg-mesh" data-scrub data-scrub-start=".85" data-scrub-len="1.1">
    <div class="wrap">
      <h3>1 — Intelligence Mesh</h3>
      <div class="diagram" style="padding:32px 24px">
        <svg class="mesh" viewBox="0 0 1200 300" role="img" aria-labelledby="mesh-t">
          <title id="mesh-t">Scattered business records connecting, left to right, into one network with a single highlighted decision point</title>
          <g class="edges">
            <line class="me g-line" pathLength="1" x1="60" y1="210" x2="160" y2="110" style="--t:.08"/>
            <line class="me g-line" pathLength="1" x1="60" y1="210" x2="280" y2="190" style="--t:.13"/>
            <line class="me g-line" pathLength="1" x1="160" y1="110" x2="280" y2="190" style="--t:.13"/>
            <line class="me g-line" pathLength="1" x1="160" y1="110" x2="360" y2="60" style="--t:.18"/>
            <line class="me g-line" pathLength="1" x1="280" y1="190" x2="360" y2="60" style="--t:.18"/>
            <line class="me g-line" pathLength="1" x1="280" y1="190" x2="470" y2="230" style="--t:.23"/>
            <line class="me g-line" pathLength="1" x1="360" y1="60" x2="560" y2="120" style="--t:.29"/>
            <line class="me g-line" pathLength="1" x1="470" y1="230" x2="560" y2="120" style="--t:.29"/>
            <line class="me g-line" pathLength="1" x1="470" y1="230" x2="730" y2="200" style="--t:.39"/>
            <line class="me g-line" pathLength="1" x1="560" y1="120" x2="650" y2="40" style="--t:.34"/>
            <line class="me g-line" pathLength="1" x1="560" y1="120" x2="730" y2="200" style="--t:.39"/>
            <line class="me g-line" pathLength="1" x1="650" y1="40" x2="830" y2="100" style="--t:.45"/>
            <line class="me g-line" pathLength="1" x1="730" y1="200" x2="830" y2="100" style="--t:.45"/>
            <line class="me g-line" pathLength="1" x1="730" y1="200" x2="910" y2="250" style="--t:.51"/>
            <line class="me g-line" pathLength="1" x1="830" y1="100" x2="960" y2="170" style="--t:.57"/>
            <line class="me g-line" pathLength="1" x1="910" y1="250" x2="960" y2="170" style="--t:.57"/>
            <line class="me g-line" pathLength="1" x1="830" y1="100" x2="1080" y2="60" style="--t:.63"/>
            <line class="me g-line" pathLength="1" x1="910" y1="250" x2="1150" y2="220" style="--t:.69"/>
            <line class="me g-line" pathLength="1" x1="1080" y1="60" x2="1150" y2="220" style="--t:.69"/>
            <line class="me g-line" pathLength="1" x1="960" y1="170" x2="1040" y2="150" style="--t:.77"/>
            <line class="me g-line" pathLength="1" x1="1080" y1="60" x2="1040" y2="150" style="--t:.77"/>
            <line class="me g-line" pathLength="1" x1="1150" y1="220" x2="1040" y2="150" style="--t:.77"/>
          </g>
          <g class="nodes">
            <rect class="mn g-node" x="55" y="205" width="10" height="10" style="--t:0"/>
            <rect class="mn g-node" x="155" y="105" width="10" height="10" style="--t:.05"/>
            <rect class="mn g-node" x="275" y="185" width="10" height="10" style="--t:.10"/>
            <rect class="mn g-node" x="355" y="55" width="10" height="10" style="--t:.15"/>
            <rect class="mn g-node" x="465" y="225" width="10" height="10" style="--t:.20"/>
            <rect class="mn g-node" x="555" y="115" width="10" height="10" style="--t:.26"/>
            <rect class="mn g-node" x="645" y="35" width="10" height="10" style="--t:.31"/>
            <rect class="mn g-node" x="725" y="195" width="10" height="10" style="--t:.36"/>
            <rect class="mn g-node" x="825" y="95" width="10" height="10" style="--t:.42"/>
            <rect class="mn g-node" x="905" y="245" width="10" height="10" style="--t:.48"/>
            <rect class="mn g-node" x="955" y="165" width="10" height="10" style="--t:.54"/>
            <rect class="mn g-node" x="1075" y="55" width="10" height="10" style="--t:.60"/>
            <rect class="mn g-node" x="1145" y="215" width="10" height="10" style="--t:.66"/>
            <g class="hub">
              <rect class="rip" x="1033" y="143" width="14" height="14"/>
              <rect class="mn core g-node" x="1033" y="143" width="14" height="14" style="--t:.74"/>
            </g>
          </g>
        </svg>
        <span class="fig">Fig. 01 — Intelligence mesh</span>
      </div>
      <p class="sg-note">Thirteen square nodes and one hub. Each node and edge carries its own threshold <code>--t</code>; the section writes <code>--p</code> as it scrolls and CSS does the rest — pause halfway and it sits halfway. The hub turns blue and ripples once <code>--p</code> passes .92.</p>
    </div>
  </section>
```

- [ ] **Step 4: Verify the scrub drives the mesh**

Run:
```bash
node -e "
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});
p.on('pageerror',e=>console.log('PAGEERROR',e));
await p.goto('http://localhost:8090/styleguide.html',{waitUntil:'networkidle'});
const sec=await p.\$('#sg-mesh');
const y=await sec.evaluate(e=>e.getBoundingClientRect().top+window.scrollY);
await p.evaluate(y=>window.scrollTo(0,y-900*0.85+10),y);await p.waitForTimeout(300);
console.log('p early', await sec.evaluate(e=>e.style.getPropertyValue('--p')), 'first node', await p.\$eval('#sg-mesh .mn',e=>getComputedStyle(e).opacity), 'last node', await p.\$eval('#sg-mesh .hub .core',e=>getComputedStyle(e).opacity));
await p.evaluate(y=>window.scrollTo(0,y+2000),y);await p.waitForTimeout(300);
console.log('p late', await sec.evaluate(e=>e.style.getPropertyValue('--p')), 'hub on', await sec.evaluate(e=>e.querySelector('.mesh').classList.contains('on')));
await b.close()})()"
```
Expected: `p early` a small number (below 0.15), first node opacity greater than `0` (it is `clamp(0, p × 6, 1)`, so roughly six times `p early`), last node (the hub core) opacity `0`; then `p late 1.0000 hub on true`. The point is that the left of the mesh lights before the right, and everything is lit with the hub blue at the end.

- [ ] **Step 5: Screenshot and commit**

Run `node tmp_check.js styleguide.html --expect ".mesh,.igrid" --shots` — expected `ALL OK`. In the 1440 screenshot the mesh shows fully drawn (the checker scrolls to the bottom first) with a blue hub at the right.

```bash
git add assets/css/graphics.css assets/js/site.js styleguide.html && git commit -m "Add the graphic primitives, the intelligence grid and the mesh

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: Graphics — Data Flow Architecture (2), Automation Loop (3)

**Files:**
- Modify: `assets/css/graphics.css` (append)
- Modify: `styleguide.html` (add to `#sg-graphics` area)

- [ ] **Step 1: Append the flow and loop CSS**

Append to `assets/css/graphics.css`:

```css
/* ===== 2. Data Flow Architecture ===== */
.flow{width:100%;height:auto}
.flow .proc .notch{transform-box:fill-box;transform-origin:center}
.js .in .flow .proc .notch,.js .flow.in .proc .notch{animation:notch 900ms var(--ease) 1100ms 1 both}
@keyframes notch{0%{transform:translateX(0)}45%{transform:translateX(5px)}100%{transform:translateX(0)}}

/* ===== 3. Automation Loop ===== */
.loop{width:100%;height:auto}
.loop .arc{stroke-width:1.5}

@media (prefers-reduced-motion:reduce){
  .flow .proc .notch{animation:none}
}
```

- [ ] **Step 2: Add both graphics to the styleguide**

Insert into `styleguide.html` directly after the closing `</section>` of `#sg-mesh`. Both `<svg>` blocks are canonical: Task 13 pastes the flow into the hero and Task 14 pastes the loop into the Automation module, unchanged.

```html
  <section class="sg-sec" id="sg-flow">
    <div class="wrap grid">
      <div class="c-6">
        <h3>2 — Data Flow Architecture</h3>
        <div class="diagram reveal" data-run style="padding:24px">
          <svg class="flow" viewBox="0 0 520 400" role="img" aria-labelledby="flow-t">
            <title id="flow-t">Orders, stock, invoices and customer records flow into one processing system and out as a decision</title>
            <g class="g-lbl"><text x="0" y="64">Orders</text><text x="0" y="154">Stock</text><text x="0" y="244">Invoices</text><text x="0" y="334">Customers</text></g>
            <path class="g-line draw" pathLength="1" d="M108 60H170V200H228" style="--i:0"/>
            <path class="g-line draw" pathLength="1" d="M108 150H170V200" style="--i:1"/>
            <path class="g-line draw" pathLength="1" d="M108 240H170V200" style="--i:2"/>
            <path class="g-line draw" pathLength="1" d="M108 330H170V200" style="--i:3"/>
            <path class="g-line draw" pathLength="1" d="M376 200H440" style="--i:5"/>
            <rect class="g-node" x="96" y="54" width="12" height="12"/>
            <rect class="g-node" x="96" y="144" width="12" height="12"/>
            <rect class="g-node" x="96" y="234" width="12" height="12"/>
            <rect class="g-node" x="96" y="324" width="12" height="12"/>
            <g class="proc">
              <path class="g-fill" d="M228 125h72a75 75 0 0 1 0 150h-72z"/>
              <path class="g-cut" d="M252 150h48a50 50 0 0 1 0 100h-48z"/>
              <path class="g-fill" d="M266 168h34a32 32 0 0 1 0 64h-34z"/>
              <path class="g-cut notch" d="M266 168l12 12v40l-12 12z"/>
            </g>
            <text class="g-lbl sm" x="228" y="110">Processing · Automation · AI</text>
            <rect class="g-node" x="440" y="194" width="12" height="12"/>
            <text class="g-lbl" x="446" y="232" text-anchor="middle">Decision</text>
            <rect class="tr" width="8" height="8" style="offset-path:path('M102 60H170V200H228L376 200H446')"/>
          </svg>
          <span class="fig">Fig. 02 — Data flow</span>
        </div>
        <p class="sg-note">Four inputs on the left, one decision on the right, the D in between. Paths draw left to right on reveal; a blue square travels the route while the diagram is on screen; the inner notch shifts once as the first signal passes.</p>
      </div>
      <div class="c-6">
        <h3>3 — Automation Loop</h3>
        <div class="diagram reveal" data-run style="padding:24px">
          <svg class="loop" viewBox="0 0 320 320" role="img" aria-labelledby="loop-t">
            <title id="loop-t">A signal enters at the top, runs the outer loop and returns down the spine to run again</title>
            <path class="g-line dash" d="M100 24V296"/>
            <path class="g-line draw arc" pathLength="1" d="M100 24h60a136 136 0 0 1 0 272h-60" style="--i:0;stroke-opacity:.6"/>
            <path class="g-line draw arc" pathLength="1" d="M100 60h60a100 100 0 0 1 0 200h-60" style="--i:1;stroke-opacity:.42"/>
            <path class="g-line draw arc" pathLength="1" d="M100 96h60a64 64 0 0 1 0 128h-60" style="--i:2;stroke-opacity:.28"/>
            <path class="g-line draw arc" pathLength="1" d="M100 132h60a28 28 0 0 1 0 56h-60" style="--i:3;stroke-opacity:.16"/>
            <g class="g-lbl sm"><text x="170" y="16">Trigger</text><text x="304" y="164" text-anchor="end">Run</text><text x="170" y="312">Record</text></g>
            <rect class="g-node" x="94" y="18" width="12" height="12"/>
            <rect class="tr" width="8" height="8" style="offset-path:path('M100 24h60a136 136 0 0 1 0 272h-60V24')"/>
          </svg>
          <span class="fig">Fig. 03 — Automation loop</span>
        </div>
        <p class="sg-note">The nested D made literal: four concentric half-D arcs fading inward, a dashed spine, one input square. The signal runs the outer arc and returns up the spine, six seconds a lap, only while on screen.</p>
      </div>
    </div>
  </section>
```

- [ ] **Step 3: Verify draw and traveller states**

Run:
```bash
node -e "
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});
p.on('pageerror',e=>console.log('PAGEERROR',e));
await p.goto('http://localhost:8090/styleguide.html',{waitUntil:'networkidle'});
console.log('draw before', await p.\$eval('.flow .draw',e=>getComputedStyle(e).strokeDashoffset));
await p.\$eval('#sg-flow',e=>e.scrollIntoView());await p.waitForTimeout(1600);
console.log('draw after', await p.\$eval('.flow .draw',e=>getComputedStyle(e).strokeDashoffset));
console.log('run', await p.\$eval('#sg-flow .diagram',e=>e.classList.contains('run')), 'tr opacity', await p.\$eval('.flow .tr',e=>getComputedStyle(e).opacity), 'tr anim', await p.\$eval('.flow .tr',e=>getComputedStyle(e).animationName));
await b.close()})()"
```
Expected: `draw before 1px` (or `1`), `draw after 0px` (or `0`), `run true`, `tr opacity 1`, `tr anim travel`.

- [ ] **Step 4: Check and commit**

Run `node tmp_check.js styleguide.html --expect ".flow,.loop" --shots` — expected `ALL OK`. The 1440 screenshot shows the two diagrams side by side, fully drawn.

```bash
git add assets/css/graphics.css styleguide.html && git commit -m "Add the data flow and automation loop graphics

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: Graphics — System Blueprint (4), Signal Pulse Network (5), icons, module figures

**Files:**
- Modify: `assets/css/graphics.css` (append)
- Modify: `styleguide.html` (add to the graphics area, plus `#sg-icons`)

- [ ] **Step 1: Append the blueprint, pulse network and module-figure CSS**

Append to `assets/css/graphics.css`:

```css
/* ===== 4. System Blueprint ===== */
.bp{width:100%;height:auto}
.bp .bp-grid{fill:none;stroke:var(--navy);stroke-opacity:.09;stroke-width:1}
.bp .dim{stroke-dasharray:3 4}

/* ===== 5. Signal Pulse Network ===== */
.pulse-net{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.pulse-net .pe{fill:none;stroke:var(--on-navy);stroke-opacity:.16;stroke-width:1}
.pulse-net .pn .core{fill:var(--navy);stroke:var(--on-navy);stroke-opacity:.45;stroke-width:1;transition:fill var(--t-base),stroke var(--t-base),stroke-opacity var(--t-base)}
.pulse-net .pn .rip{fill:none;stroke:var(--blue);stroke-width:1;opacity:0;transform-box:fill-box;transform-origin:center}
.pulse-net .pn.on .core{fill:var(--blue);stroke:var(--blue);stroke-opacity:1}
.js .pulse-net .pn.on .rip{animation:ripple 2.4s var(--ease) 1 both}

/* ===== Module figures (services spine) ===== */
.m-fig svg{width:100%;height:auto}
.m-fig .bar{fill:var(--navy);fill-opacity:.55}
.m-fig .bar.on{fill:var(--blue);fill-opacity:1}

@media (prefers-reduced-motion:reduce){
  .pulse-net .pn .rip{display:none}
}
```

- [ ] **Step 2: Add the blueprint, pulse network, module figures and icons to the styleguide**

Insert into `styleguide.html` directly after the closing `</section>` of `#sg-flow`. The three blueprints are canonical for the three homepage case tiles (Task 15); the pulse network is canonical for `#close` (Task 16); the four module figures are canonical for `#system` (Task 14).

```html
  <section class="sg-sec" id="sg-bp">
    <div class="wrap">
      <h3>4 — System Blueprint</h3>
      <div class="grid">
        <div class="c-4 diagram reveal">
          <svg class="bp" viewBox="0 0 480 320" role="img" aria-labelledby="bp-a-t">
            <title id="bp-a-t">Blueprint of a sales and stock dashboard fed by billing and stock data</title>
            <defs><pattern id="bpg-a" width="32" height="32" patternUnits="userSpaceOnUse"><path class="bp-grid" d="M32 0H0V32"/></pattern></defs>
            <rect width="480" height="320" fill="url(#bpg-a)"/>
            <rect class="g-line draw" pathLength="1" x="64" y="64" width="192" height="128" style="--i:0"/>
            <rect class="g-line draw" pathLength="1" x="288" y="64" width="128" height="56" style="--i:1"/>
            <rect class="g-line draw" pathLength="1" x="288" y="136" width="128" height="56" style="--i:2"/>
            <path class="g-line draw" pathLength="1" d="M256 92H288M256 164H288" style="--i:3"/>
            <path class="g-line draw dim" pathLength="1" d="M64 224V240M256 224V240M64 232H256" style="--i:4"/>
            <path class="g-line draw dim" pathLength="1" d="M416 120a96 96 0 0 1-32 72" style="--i:5"/>
            <g class="g-lbl sm"><text x="66" y="58">Module A — Sales &amp; stock dashboard</text><text x="290" y="58">Billing</text><text x="290" y="130">Stock</text><text x="160" y="254" text-anchor="middle">refresh: daily</text><text x="404" y="212" text-anchor="end">r = 96</text></g>
            <rect class="g-sig" x="252" y="122" width="8" height="8"/>
          </svg>
          <span class="fig">Fig. 04a — Dashboard</span>
        </div>
        <div class="c-4 diagram reveal">
          <svg class="bp" viewBox="0 0 480 320" role="img" aria-labelledby="bp-b-t">
            <title id="bp-b-t">Blueprint of an order-to-invoice workflow connecting three input channels</title>
            <defs><pattern id="bpg-b" width="32" height="32" patternUnits="userSpaceOnUse"><path class="bp-grid" d="M32 0H0V32"/></pattern></defs>
            <rect width="480" height="320" fill="url(#bpg-b)"/>
            <rect class="g-line draw" pathLength="1" x="32" y="64" width="96" height="40" style="--i:0"/>
            <rect class="g-line draw" pathLength="1" x="32" y="136" width="96" height="40" style="--i:0"/>
            <rect class="g-line draw" pathLength="1" x="32" y="208" width="96" height="40" style="--i:0"/>
            <path class="g-line draw" pathLength="1" d="M128 84H160V156H192M128 156H192M128 228H160V156" style="--i:1"/>
            <rect class="g-line draw" pathLength="1" x="192" y="128" width="80" height="56" style="--i:2"/>
            <path class="g-line draw" pathLength="1" d="M272 156H304" style="--i:3"/>
            <rect class="g-line draw" pathLength="1" x="304" y="128" width="80" height="56" style="--i:3"/>
            <path class="g-line draw" pathLength="1" d="M384 156H416" style="--i:4"/>
            <rect class="g-line draw" pathLength="1" x="416" y="128" width="40" height="56" style="--i:4"/>
            <path class="g-line draw dim" pathLength="1" d="M192 256V272M456 256V272M192 264H456" style="--i:5"/>
            <g class="g-lbl sm"><text x="34" y="58">WhatsApp</text><text x="34" y="130">Email</text><text x="34" y="202">Billing</text><text x="194" y="122">Order</text><text x="306" y="122">Invoice</text><text x="418" y="122">Paid</text><text x="324" y="286" text-anchor="middle">retyping: 0</text></g>
            <rect class="g-sig" x="228" y="152" width="8" height="8"/>
          </svg>
          <span class="fig">Fig. 04b — Workflow</span>
        </div>
        <div class="c-4 diagram reveal">
          <svg class="bp" viewBox="0 0 480 320" role="img" aria-labelledby="bp-c-t">
            <title id="bp-c-t">Blueprint of an enquiry, follow-up and quote pipeline with automatic reminders</title>
            <defs><pattern id="bpg-c" width="32" height="32" patternUnits="userSpaceOnUse"><path class="bp-grid" d="M32 0H0V32"/></pattern></defs>
            <rect width="480" height="320" fill="url(#bpg-c)"/>
            <rect class="g-line draw" pathLength="1" x="64" y="64" width="352" height="48" style="--i:0"/>
            <rect class="g-line draw" pathLength="1" x="112" y="136" width="256" height="48" style="--i:1"/>
            <rect class="g-line draw" pathLength="1" x="160" y="208" width="160" height="48" style="--i:2"/>
            <path class="g-line draw" pathLength="1" d="M240 112V136M240 184V208" style="--i:3"/>
            <path class="g-line draw dim" pathLength="1" d="M368 160h32a48 48 0 0 1-48 48" style="--i:4"/>
            <path class="g-line draw dim" pathLength="1" d="M48 64H32V256H48" style="--i:5"/>
            <g class="g-lbl sm"><text x="66" y="58">Enquiry — inbox, form, WhatsApp</text><text x="114" y="130">Follow-up — reminders automatic</text><text x="162" y="202">Quote</text><text x="20" y="168" transform="rotate(-90 20 168)" text-anchor="middle">pipeline: 1</text></g>
            <rect class="g-sig" x="236" y="228" width="8" height="8"/>
          </svg>
          <span class="fig">Fig. 04c — Pipeline</span>
        </div>
      </div>
      <p class="sg-note">Technical drawings: a 32px construction grid at 9%, measured rectangles, dashed dimension lines with ticks, 7px caps labels, one measured arc. Lines draw on reveal, then hold still.</p>
    </div>
  </section>

  <section class="sg-sec" id="sg-pulse">
    <div class="wrap">
      <h3>5 — Signal Pulse Network</h3>
      <div class="navy" style="position:relative;height:360px;overflow:hidden">
        <svg class="pulse-net" viewBox="0 0 1440 480" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <g class="edges">
            <line class="pe" x1="120" y1="120" x2="300" y2="60"/><line class="pe" x1="120" y1="120" x2="420" y2="220"/><line class="pe" x1="300" y1="60" x2="600" y2="140"/><line class="pe" x1="420" y1="220" x2="600" y2="140"/><line class="pe" x1="600" y1="140" x2="760" y2="80"/><line class="pe" x1="600" y1="140" x2="880" y2="260"/><line class="pe" x1="760" y1="80" x2="1040" y2="120"/><line class="pe" x1="880" y1="260" x2="1040" y2="120"/><line class="pe" x1="1040" y1="120" x2="1180" y2="40"/><line class="pe" x1="1040" y1="120" x2="1320" y2="200"/><line class="pe" x1="1180" y1="40" x2="1320" y2="200"/><line class="pe" x1="120" y1="120" x2="200" y2="340"/><line class="pe" x1="420" y1="220" x2="200" y2="340"/><line class="pe" x1="420" y1="220" x2="520" y2="380"/><line class="pe" x1="880" y1="260" x2="520" y2="380"/><line class="pe" x1="880" y1="260" x2="720" y2="300"/><line class="pe" x1="720" y1="300" x2="960" y2="400"/><line class="pe" x1="1320" y1="200" x2="960" y2="400"/><line class="pe" x1="1320" y1="200" x2="1240" y2="360"/><line class="pe" x1="960" y1="400" x2="1240" y2="360"/><line class="pe" x1="520" y1="380" x2="960" y2="400"/>
          </g>
          <g class="pn"><rect class="rip" x="113" y="113" width="14" height="14"/><rect class="core" x="115" y="115" width="10" height="10"/></g>
          <g class="pn"><rect class="rip" x="293" y="53" width="14" height="14"/><rect class="core" x="295" y="55" width="10" height="10"/></g>
          <g class="pn"><rect class="rip" x="413" y="213" width="14" height="14"/><rect class="core" x="415" y="215" width="10" height="10"/></g>
          <g class="pn"><rect class="rip" x="593" y="133" width="14" height="14"/><rect class="core" x="595" y="135" width="10" height="10"/></g>
          <g class="pn"><rect class="rip" x="753" y="73" width="14" height="14"/><rect class="core" x="755" y="75" width="10" height="10"/></g>
          <g class="pn"><rect class="rip" x="873" y="253" width="14" height="14"/><rect class="core" x="875" y="255" width="10" height="10"/></g>
          <g class="pn"><rect class="rip" x="1033" y="113" width="14" height="14"/><rect class="core" x="1035" y="115" width="10" height="10"/></g>
          <g class="pn"><rect class="rip" x="1173" y="33" width="14" height="14"/><rect class="core" x="1175" y="35" width="10" height="10"/></g>
          <g class="pn"><rect class="rip" x="1313" y="193" width="14" height="14"/><rect class="core" x="1315" y="195" width="10" height="10"/></g>
          <g class="pn"><rect class="rip" x="193" y="333" width="14" height="14"/><rect class="core" x="195" y="335" width="10" height="10"/></g>
          <g class="pn"><rect class="rip" x="513" y="373" width="14" height="14"/><rect class="core" x="515" y="375" width="10" height="10"/></g>
          <g class="pn"><rect class="rip" x="713" y="293" width="14" height="14"/><rect class="core" x="715" y="295" width="10" height="10"/></g>
          <g class="pn"><rect class="rip" x="953" y="393" width="14" height="14"/><rect class="core" x="955" y="395" width="10" height="10"/></g>
          <g class="pn"><rect class="rip" x="1233" y="353" width="14" height="14"/><rect class="core" x="1235" y="355" width="10" height="10"/></g>
        </svg>
      </div>
      <p class="sg-note">Fourteen nodes on navy. One is active at a time: blue fill, a square ripple, 2.4 seconds, then the signal moves on. Runs only while on screen. Background for the closing statement and the contact page.</p>
    </div>
  </section>

  <section class="sg-sec" id="sg-mfig">
    <div class="wrap">
      <h3>Module figures</h3>
      <div class="grid">
        <div class="c-3 m-fig diagram reveal" style="padding:16px">
          <svg viewBox="0 0 200 90" aria-hidden="true"><rect class="g-node" x="10" y="10" width="10" height="10"/><rect class="g-node" x="10" y="40" width="10" height="10"/><rect class="g-node" x="10" y="70" width="10" height="10"/><path class="g-line draw" pathLength="1" d="M20 15H60V45H100M20 45H100M20 75H60V45" style="--i:0"/><rect class="g-line draw" pathLength="1" x="100" y="20" width="80" height="50" style="--i:1"/><rect class="bar" x="110" y="50" width="8" height="12"/><rect class="bar" x="124" y="40" width="8" height="22"/><rect class="bar" x="138" y="32" width="8" height="30"/><rect class="bar" x="152" y="44" width="8" height="18"/><rect class="bar on" x="166" y="26" width="8" height="36"/></svg>
        </div>
        <div class="c-3 m-fig diagram reveal" style="padding:16px">
          <svg viewBox="0 0 200 90" aria-hidden="true"><path class="g-line dash" d="M60 15V75"/><path class="g-line draw" pathLength="1" d="M60 15h50a30 30 0 0 1 0 60H60" style="--i:0;stroke-width:1.5"/><path class="g-line draw" pathLength="1" d="M60 30h50a15 15 0 0 1 0 30H60" style="--i:1;stroke-width:1.5;stroke-opacity:.4"/><rect class="g-sig" x="55" y="10" width="10" height="10"/><rect class="g-node" x="135" y="40" width="10" height="10"/></svg>
        </div>
        <div class="c-3 m-fig diagram reveal" style="padding:16px">
          <svg viewBox="0 0 200 90" aria-hidden="true"><path class="g-fill" d="M70 20h30a25 25 0 0 1 0 50H70z"/><path class="g-cut" d="M82 32h18a13 13 0 0 1 0 26H82z"/><path class="g-fill" d="M82 32l8 8v10l-8 8z"/><path class="g-line draw" pathLength="1" d="M20 45H70" style="--i:0"/><path class="g-line draw" pathLength="1" d="M125 45H160" style="--i:1"/><rect class="g-node" x="10" y="40" width="10" height="10"/><rect class="g-sig" x="160" y="40" width="10" height="10"/></svg>
        </div>
        <div class="c-3 m-fig diagram reveal" style="padding:16px">
          <svg viewBox="0 0 200 90" aria-hidden="true"><rect class="g-line draw" pathLength="1" x="20" y="10" width="160" height="70" style="--i:0"/><path class="g-line draw" pathLength="1" d="M20 24H180" style="--i:1"/><rect class="g-fill" x="30" y="34" width="70" height="8" fill-opacity=".8"/><rect class="g-fill" x="30" y="48" width="50" height="5" fill-opacity=".3"/><rect class="g-sig" x="30" y="60" width="28" height="10"/><path class="g-line draw" pathLength="1" d="M120 50H160" style="--i:2"/><rect class="g-node" x="160" y="45" width="10" height="10"/></svg>
        </div>
      </div>
      <p class="sg-note">One 200×90 figure per service module — Data, Automation, AI, Websites — each a compressed quotation of the larger graphic it belongs to.</p>
    </div>
  </section>

  <section class="sg-sec" id="sg-icons">
    <div class="wrap">
      <h2>Icons</h2>
      <div class="sg-row" style="gap:32px">
        <svg class="ico" style="width:24px;height:24px"><use href="#i-data"/></svg>
        <svg class="ico" style="width:24px;height:24px"><use href="#i-automation"/></svg>
        <svg class="ico" style="width:24px;height:24px"><use href="#i-ai"/></svg>
        <svg class="ico" style="width:24px;height:24px"><use href="#i-websites"/></svg>
        <svg class="ico" style="width:24px;height:24px"><use href="#i-arrow"/></svg>
        <svg class="ico" style="width:24px;height:24px"><use href="#i-plus"/></svg>
        <svg class="ico" style="width:24px;height:24px"><use href="#i-whatsapp"/></svg>
        <svg class="ico" style="width:24px;height:24px"><use href="#i-mail"/></svg>
      </div>
      <p class="sg-note">24px grid, 1.5px navy stroke, butt caps and mitre joins — square terminals, never rounded. Eight icons, built from the three primitives: square, hairline, arc.</p>
    </div>
  </section>
```

- [ ] **Step 3: Verify the pulse network cycles**

Run:
```bash
node -e "
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});
p.on('pageerror',e=>console.log('PAGEERROR',e));
await p.goto('http://localhost:8090/styleguide.html',{waitUntil:'networkidle'});
await p.\$eval('#sg-pulse',e=>e.scrollIntoView());await p.waitForTimeout(400);
const a=await p.\$\$eval('.pulse-net .pn.on',n=>n.length);await p.waitForTimeout(2600);
const idx=await p.\$\$eval('.pulse-net .pn',n=>n.findIndex(e=>e.classList.contains('on')));
console.log('one on', a===1, 'index now', idx, 'icons', await p.\$\$eval('#sg-icons use',n=>n.length));
await b.close()})()"
```
Expected: `one on true index now <0..13> icons 8`.

- [ ] **Step 4: Check and commit**

Run `node tmp_check.js styleguide.html --expect ".bp,.pulse-net,.m-fig,#sg-icons" --shots` — expected `ALL OK`.

```bash
git add assets/css/graphics.css styleguide.html && git commit -m "Add the blueprint, pulse network, module figures and icons

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 11: Module row, case tile, insight row, statement band, form, FAQ

**Files:**
- Modify: `assets/css/components.css` (append)
- Modify: `styleguide.html` (add sections)

- [ ] **Step 1: Append the component CSS**

Append to `assets/css/components.css`:

```css
/* ===== Module row (services spine) =====
   .spine carries --p from the scrub; ::after is the filled part of the spine.
   site.js steppers mark each .module .done / .live. */
.spine{--spine-x:128px;position:relative;border-top:1px solid var(--line)}
.spine::before{content:"";position:absolute;left:var(--spine-x);top:0;bottom:0;width:1px;background:var(--hairline-soft)}
.spine::after{content:"";position:absolute;left:var(--spine-x);top:0;width:1px;height:calc(var(--p,0) * 100%);background:var(--navy);transition:height 120ms linear}
.module{position:relative;display:grid;grid-template-columns:var(--spine-x) minmax(0,1fr) 28%;gap:var(--sp-5);padding:var(--sp-5) 0;border-bottom:1px solid var(--line)}
.module .node{position:absolute;left:calc(var(--spine-x) - 6px);top:calc(var(--sp-5) + 9px);width:12px;height:12px;background:var(--bg);border:1px solid var(--navy);transition:background var(--t-fast),border-color var(--t-fast),box-shadow var(--t-fast)}
.module.done .node{background:var(--navy)}
.module.live .node{background:var(--blue);border-color:var(--blue);box-shadow:0 0 0 6px var(--blue-soft)}
.module .m-id{padding-right:var(--sp-3)}
.module .m-id .label{display:block;margin-bottom:10px}
.module .m-id h3{font-size:var(--fs-h3);color:var(--ink-2);transition:color var(--t-fast)}
.module.live .m-id h3,.module.done .m-id h3{color:var(--ink)}
.module .m-body p{color:var(--muted)}
.module .m-body .tags{margin-top:var(--sp-3)}
.module .m-fig{align-self:start;padding:16px}
@media (max-width:1199px){.spine{--spine-x:104px}.module{gap:var(--sp-4);grid-template-columns:var(--spine-x) minmax(0,1fr) 32%}}
@media (max-width:899px){
  .spine{--spine-x:16px}
  .module{grid-template-columns:1fr;gap:var(--sp-3);padding-left:var(--sp-5)}
  .module .node{top:calc(var(--sp-5) + 26px)}
  .module .m-fig{max-width:320px}
}

/* ===== Case tile ===== */
.cases{border-top:1px solid var(--line)}
.case{display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-6);padding:var(--sp-6) 0;border-bottom:1px solid var(--line);align-items:center}
.case:nth-child(even) .case-copy{order:2}
.case-copy{display:grid;gap:var(--sp-3);justify-items:start}
.case-copy .meta{display:flex;flex-wrap:wrap;gap:var(--sp-2);align-items:center}
.case-copy h3{font-size:var(--fs-h2);letter-spacing:var(--track-h2);line-height:var(--lh-h2);max-width:16ch}
.case-copy dl{display:grid;gap:var(--sp-2);max-width:var(--measure-lead)}
.case-copy dt{font-size:var(--fs-label);font-weight:500;letter-spacing:var(--track-label);text-transform:uppercase;color:var(--ink-2);margin-bottom:4px}
.case-copy dd{color:var(--muted)}
.case-copy .stats{grid-template-columns:repeat(3,1fr);margin-top:var(--sp-2);width:100%}
.case-copy .stat b{font-size:var(--fs-h3)}
.case-copy .stat span{margin-top:var(--sp-1);font-size:13px}
.case .diagram{transition:transform var(--t-fast) var(--ease),box-shadow var(--t-fast)}
.case:hover .diagram{transform:translateY(-4px);box-shadow:var(--lift)}
@media (max-width:899px){.case{grid-template-columns:1fr;gap:var(--sp-4)}.case:nth-child(even) .case-copy{order:0}}

/* ===== Insight row ===== */
.insights-list{border-top:1px solid var(--line)}
.insight{display:grid;grid-template-columns:144px minmax(0,1fr) 24px;gap:var(--sp-4);padding:var(--sp-4) 0;border-bottom:1px solid var(--line);align-items:start;transition:background var(--t-fast)}
.insight:hover{background:var(--surface)}
.insight .cat{padding-top:6px}
.insight h3{font-size:var(--fs-h3);font-weight:600;letter-spacing:var(--track-h3)}
.insight p{color:var(--muted);margin-top:6px;font-size:var(--fs-small);font-weight:400;max-width:60ch}
.insight .ico{width:20px;height:20px;margin-top:6px;transition:transform var(--t-fast) var(--ease)}
.insight:hover .ico{transform:translateX(4px)}
@media (max-width:639px){.insight{grid-template-columns:1fr;gap:var(--sp-1)}.insight .ico{display:none}}

/* ===== Statement band ===== */
.stmt{position:relative;overflow:hidden;padding-block:var(--sp-10)}
.stmt .stmt-in{position:relative;z-index:1;display:grid;gap:var(--sp-4);justify-items:start}
.stmt .display{color:var(--on-navy);max-width:12ch}
.stmt .pulse-net{opacity:.7}
@media (max-width:639px){.stmt{padding-block:var(--sp-8)}}

/* ===== Form ===== */
.form{display:grid;gap:var(--sp-3)}
.form .row{display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3)}
.field{display:grid;gap:8px}
.field > span{font-size:var(--fs-label);font-weight:500;letter-spacing:var(--track-label);text-transform:uppercase;color:var(--ink-2)}
.field > span em{font-style:normal;text-transform:none;letter-spacing:0;color:var(--muted)}
.field input,.field textarea{width:100%;background:var(--surface);border:1px solid var(--line-strong);border-radius:var(--r-0);padding:12px 14px;font-size:var(--fs-body);color:var(--ink);transition:border-color var(--t-fast),box-shadow var(--t-fast)}
.field input::placeholder,.field textarea::placeholder{color:var(--muted)}
.field input:focus,.field textarea:focus{outline:0;border-color:var(--navy);box-shadow:inset 0 0 0 1px var(--navy)}
.field textarea{min-height:140px;resize:vertical}
.form .actions{display:flex;flex-wrap:wrap;gap:var(--sp-3);align-items:center}
.form .note{font-size:var(--fs-small);color:var(--muted);font-weight:400}
@media (max-width:639px){.form .row{grid-template-columns:1fr}}

/* ===== FAQ ===== */
.faq{border-top:1px solid var(--line)}
.faq details{border-bottom:1px solid var(--line)}
.faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:var(--sp-3);padding:var(--sp-3) 0;font-size:var(--fs-lead);font-weight:600;letter-spacing:-.01em;color:var(--ink)}
.faq summary::-webkit-details-marker{display:none}
.faq summary .plus{flex:none;width:20px;height:20px;position:relative;transition:transform var(--t-fast) var(--ease)}
.faq summary .plus::before,.faq summary .plus::after{content:"";position:absolute;left:9px;top:2px;width:2px;height:16px;background:var(--navy)}
.faq summary .plus::after{transform:rotate(90deg)}
.faq details[open] summary .plus{transform:rotate(45deg)}
.faq details > p{padding:0 0 var(--sp-3);color:var(--muted);max-width:var(--measure)}
```

- [ ] **Step 2: Add the component sections to the styleguide**

Insert into `styleguide.html`, replacing the comment `<!-- Task 11 adds: … -->`:

```html
  <section class="sg-sec" id="sg-module" data-scrub data-scrub-start=".6" data-scrub-len=".9" data-steps=".module">
    <div class="wrap">
      <h2>Module row</h2>
      <div class="spine">
        <div class="module">
          <i class="node"></i>
          <div class="m-id"><span class="label">01</span><h3>Data</h3></div>
          <div class="m-body"><p>Your orders, stock, invoices and customer records — pulled from the tools you already use into one source of truth. Dashboards that show what is happening today, not last month.</p><div class="tags"><span class="tag">Power BI</span><span class="tag">SQL</span><span class="tag">PostgreSQL</span><span class="tag">Google Sheets</span></div></div>
          <div class="m-fig diagram"><svg viewBox="0 0 200 90" aria-hidden="true"><rect class="g-node" x="10" y="10" width="10" height="10"/><rect class="g-node" x="10" y="40" width="10" height="10"/><rect class="g-node" x="10" y="70" width="10" height="10"/><path class="g-line draw" pathLength="1" d="M20 15H60V45H100M20 45H100M20 75H60V45" style="--i:0"/><rect class="g-line draw" pathLength="1" x="100" y="20" width="80" height="50" style="--i:1"/><rect class="bar" x="110" y="50" width="8" height="12"/><rect class="bar" x="124" y="40" width="8" height="22"/><rect class="bar" x="138" y="32" width="8" height="30"/><rect class="bar" x="152" y="44" width="8" height="18"/><rect class="bar on" x="166" y="26" width="8" height="36"/></svg></div>
        </div>
        <div class="module">
          <i class="node"></i>
          <div class="m-id"><span class="label">02</span><h3>Automation</h3></div>
          <div class="m-body"><p>The repetitive steps between those records — order to invoice, stock alerts, payment follow-ups — run on their own. Your people handle exceptions, not routine.</p><div class="tags"><span class="tag">REST APIs</span><span class="tag">Webhooks</span><span class="tag">Python</span><span class="tag">Scheduled jobs</span></div></div>
          <div class="m-fig diagram"><svg viewBox="0 0 200 90" aria-hidden="true"><path class="g-line dash" d="M60 15V75"/><path class="g-line draw" pathLength="1" d="M60 15h50a30 30 0 0 1 0 60H60" style="--i:0;stroke-width:1.5"/><path class="g-line draw" pathLength="1" d="M60 30h50a15 15 0 0 1 0 30H60" style="--i:1;stroke-width:1.5;stroke-opacity:.4"/><rect class="g-sig" x="55" y="10" width="10" height="10"/><rect class="g-node" x="135" y="40" width="10" height="10"/></svg></div>
        </div>
      </div>
      <p class="sg-note">Rows along one hairline spine. The spine fills as the section scrolls; the node at the current row turns blue, rows above turn navy. Each row's figure draws when the row reveals. Under 900px the spine moves to the left edge and the row stacks.</p>
    </div>
  </section>

  <section class="sg-sec" id="sg-case">
    <div class="wrap">
      <h2>Case tile</h2>
      <div class="cases">
        <article class="case reveal">
          <div class="case-copy">
            <div class="meta"><span class="eyebrow"><i></i>Retail</span><span class="label" style="color:var(--muted)">Illustrative engagement</span></div>
            <h3>One view of sales and stock, refreshed daily.</h3>
            <dl>
              <div><dt>Context</dt><dd>Weekly reporting depended on several spreadsheets, each maintained by a different person.</dd></div>
              <div><dt>System</dt><dd>A central sales and inventory dashboard, fed straight from billing and stock data.</dd></div>
              <div><dt>Outcome</dt><dd>Management gained one view of performance, refreshed daily instead of assembled weekly.</dd></div>
            </dl>
            <ul class="stats">
              <li class="stat"><b>Daily</b><span>Refresh, was weekly</span></li>
              <li class="stat"><b>1</b><span>Dashboard replacing several sheets</span></li>
              <li class="stat"><b>0</b><span>Monday report builds</span></li>
            </ul>
          </div>
          <div class="diagram">
            <svg class="bp" viewBox="0 0 480 320" aria-hidden="true"><defs><pattern id="bpg-sg" width="32" height="32" patternUnits="userSpaceOnUse"><path class="bp-grid" d="M32 0H0V32"/></pattern></defs><rect width="480" height="320" fill="url(#bpg-sg)"/><rect class="g-line draw" pathLength="1" x="64" y="64" width="192" height="128" style="--i:0"/><rect class="g-line draw" pathLength="1" x="288" y="64" width="128" height="56" style="--i:1"/><rect class="g-line draw" pathLength="1" x="288" y="136" width="128" height="56" style="--i:2"/><path class="g-line draw" pathLength="1" d="M256 92H288M256 164H288" style="--i:3"/><path class="g-line draw dim" pathLength="1" d="M64 224V240M256 224V240M64 232H256" style="--i:4"/><g class="g-lbl sm"><text x="66" y="58">Module A — Sales &amp; stock dashboard</text><text x="290" y="58">Billing</text><text x="290" y="130">Stock</text><text x="160" y="254" text-anchor="middle">refresh: daily</text></g><rect class="g-sig" x="252" y="122" width="8" height="8"/></svg>
            <span class="fig">Fig. 04a — Dashboard</span>
          </div>
        </article>
      </div>
      <p class="sg-note">Editorial, not a card: hairlines top and bottom, copy in one column and a blueprint in the other, sides alternating down the page. Context / System / Outcome, then three stats. Hover lifts the drawing 4px.</p>
    </div>
  </section>

  <section class="sg-sec" id="sg-insight">
    <div class="wrap">
      <h2>Insight row</h2>
      <div class="insights-list">
        <a class="insight" href="#"><span class="cat label">Data</span><div><h3>Why your dashboard is a month late</h3><p>Reporting lag is a plumbing problem, not a people problem. Where the days go between a sale and the number.</p></div><svg class="ico"><use href="#i-arrow"/></svg></a>
        <a class="insight" href="#"><span class="cat label">Automation</span><div><h3>Order-to-invoice: the six steps nobody should do by hand</h3><p>The handoffs between a WhatsApp order and a paid invoice, and which of them a machine should own.</p></div><svg class="ico"><use href="#i-arrow"/></svg></a>
      </div>
      <p class="sg-note">Category, title, one-line dek, arrow. No thumbnails. Reads like a research desk, not a blog.</p>
    </div>
  </section>

  <section class="sg-sec" id="sg-stmt">
    <div class="wrap"><h2>Statement band</h2></div>
    <div class="stmt navy" style="margin-top:24px">
      <svg class="pulse-net" viewBox="0 0 1440 480" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <line class="pe" x1="120" y1="120" x2="420" y2="220"/><line class="pe" x1="420" y1="220" x2="880" y2="260"/><line class="pe" x1="880" y1="260" x2="1320" y2="200"/><line class="pe" x1="420" y1="220" x2="600" y2="60"/><line class="pe" x1="880" y1="260" x2="1040" y2="80"/>
        <g class="pn"><rect class="rip" x="113" y="113" width="14" height="14"/><rect class="core" x="115" y="115" width="10" height="10"/></g>
        <g class="pn"><rect class="rip" x="413" y="213" width="14" height="14"/><rect class="core" x="415" y="215" width="10" height="10"/></g>
        <g class="pn"><rect class="rip" x="873" y="253" width="14" height="14"/><rect class="core" x="875" y="255" width="10" height="10"/></g>
        <g class="pn"><rect class="rip" x="1313" y="193" width="14" height="14"/><rect class="core" x="1315" y="195" width="10" height="10"/></g>
        <g class="pn"><rect class="rip" x="593" y="53" width="14" height="14"/><rect class="core" x="595" y="55" width="10" height="10"/></g>
        <g class="pn"><rect class="rip" x="1033" y="73" width="14" height="14"/><rect class="core" x="1035" y="75" width="10" height="10"/></g>
      </svg>
      <div class="wrap stmt-in">
        <p class="display">Intelligence.<br>Engineered.</p>
        <p class="lead">One working system at a time. Tell us where the week gets stuck.</p>
        <a class="btn btn-on-navy" href="#">Book a systems review</a>
      </div>
    </div>
  </section>

  <section class="sg-sec" id="sg-form">
    <div class="wrap grid">
      <div class="c-5"><h2>Form</h2><p class="sg-note">Caps labels, 0-radius inputs, 1px line, navy focus. Fields are the ported set. Submit fires the GA4 <code>generate_lead</code> event; with the placeholder endpoint the handler opens WhatsApp with the message prefilled.</p></div>
      <form class="c-7 form" action="FORM_ENDPOINT" method="POST">
        <div class="row">
          <label class="field"><span>Your name</span><input type="text" name="name" required autocomplete="name"></label>
          <label class="field"><span>Business name</span><input type="text" name="business" required autocomplete="organization"></label>
        </div>
        <div class="row">
          <label class="field"><span>Phone or WhatsApp</span><input type="tel" name="phone" required autocomplete="tel" inputmode="tel"></label>
          <label class="field"><span>Email <em>(optional)</em></span><input type="email" name="email" autocomplete="email"></label>
        </div>
        <label class="field"><span>What takes the most time right now?</span><textarea name="message" rows="3" required placeholder="e.g. we re-type every order into three different sheets"></textarea></label>
        <div class="actions">
          <button type="submit" class="btn btn-primary">Show me what to fix <svg class="ico"><use href="#i-arrow"/></svg></button>
          <a class="btn-link" href="https://wa.me/917877640693" target="_blank" rel="noopener">Prefer WhatsApp? <svg class="ico"><use href="#i-arrow"/></svg></a>
        </div>
        <p class="note">We reply within one working day. No sales pitch, no obligation, and we don't add you to a mailing list.</p>
      </form>
    </div>
  </section>

  <section class="sg-sec" id="sg-faq">
    <div class="wrap">
      <h2>FAQ</h2>
      <div class="faq" style="max-width:820px">
        <details><summary>What does this cost?<i class="plus"></i></summary><p>It depends on how many systems have to talk to each other. We quote a fixed price before any work starts, so there is no meter running.</p></details>
        <details><summary>Do I have to stop using Excel?<i class="plus"></i></summary><p>No. Most of our work connects the tools you already use rather than replacing them.</p></details>
      </div>
      <p class="sg-note">Native <code>&lt;details&gt;</code>: keyboard and screen-reader behaviour for free. The plus rotates 45° to a cross.</p>
    </div>
  </section>
```

- [ ] **Step 3: Verify the stepper and FAQ**

Run:
```bash
node -e "
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});
p.on('pageerror',e=>console.log('PAGEERROR',e));
await p.goto('http://localhost:8090/styleguide.html',{waitUntil:'networkidle'});
const y=await p.\$eval('#sg-module',e=>e.getBoundingClientRect().top+window.scrollY);
await p.evaluate(y=>window.scrollTo(0,y-900*.6+40),y);await p.waitForTimeout(300);
console.log('first live', await p.\$eval('#sg-module .module',e=>e.classList.contains('live')));
await p.evaluate(y=>window.scrollTo(0,y+3000),y);await p.waitForTimeout(300);
console.log('first done', await p.\$eval('#sg-module .module',e=>e.classList.contains('done')), 'last live', await p.\$eval('#sg-module .module:last-child',e=>e.classList.contains('live')));
await p.click('#sg-faq summary');console.log('faq open', await p.\$eval('#sg-faq details',e=>e.open));
await b.close()})()"
```
Expected: `first live true`, `first done true last live true`, `faq open true`.

- [ ] **Step 4: Check and commit**

Run `node tmp_check.js styleguide.html --expect ".spine,.case,.insight,.stmt,.form,.faq" --shots` — expected `ALL OK`. At 390 the module rows stack with the spine at the left edge and the form fields in one column.

```bash
git add assets/css/components.css styleguide.html && git commit -m "Add module row, case tile, insight row, statement band, form and FAQ

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 12: Splash + FLIP morph, motion and rules sections

**Files:**
- Modify: `assets/css/components.css` (append)
- Modify: `assets/js/site.js` (append)
- Create: `docs/partials/splash.html`
- Modify: `styleguide.html` (add `#sg-motion`, `#sg-rules`)

- [ ] **Step 1: Write the splash partial**

Create `docs/partials/splash.html`. It is pasted into `index.html` only (directly after the icons sprite), never into other pages:

```html
<div class="splash" id="splash" aria-hidden="true">
  <div class="splash-in">
    <svg class="splash-mark" viewBox="0 0 104 96"><rect class="sig" x="0" y="0" width="16" height="16"/><rect x="0" y="24" width="16" height="72" fill="currentColor"/><path fill="currentColor" fill-rule="evenodd" d="M28 0h28a48 48 0 0 1 0 96H28V0zm16 16v64h12a32 32 0 0 0 0-64H44z"/><path fill="currentColor" d="M52 28h8a20 20 0 0 1 0 40h-8V28z"/><path class="notch" d="M52 28l8 8v24l-8 8V28z"/></svg>
    <span class="tag-line">Data<i></i>Automation<i></i>AI<i></i>Websites</span>
  </div>
</div>
```

- [ ] **Step 2: Append the splash CSS**

Append to `assets/css/components.css`:

```css
/* ===== Splash (Frame 01) =====
   Plays once per session. html.no-splash (set inline in <head>) hides it before first paint
   for repeat visits and reduced motion; html.no-js hides it too. site.js runs the FLIP morph
   into the nav mark and removes the overlay. */
.splash{position:fixed;inset:0;z-index:100;background:var(--surface);display:grid;place-items:center;transition:opacity var(--t-base) var(--ease)}
.no-splash .splash,.no-js .splash{display:none}
.splash.out{opacity:0;pointer-events:none}
.splash-in{display:grid;justify-items:center;gap:var(--sp-4)}
.splash-mark{width:104px;height:96px;color:var(--navy);transform-origin:0 0;transition:transform var(--t-base) var(--ease)}
.splash-mark .sig{fill:var(--blue);transform-box:fill-box;transform-origin:center;animation:sigPulse 700ms var(--ease) 300ms 1 both}
.splash-mark .notch{fill:var(--surface)}
.splash .tag-line{opacity:0;animation:fadeUp var(--t-base) var(--ease) 800ms 1 both;transition:opacity var(--t-fast)}
.splash.morph .tag-line{opacity:0;animation:none}
.splash-active .nav .lockup .mark{opacity:0}
@keyframes sigPulse{0%{opacity:0;transform:scale(.6)}55%{opacity:1;transform:scale(1.3)}100%{opacity:1;transform:scale(1)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
```

- [ ] **Step 3: Append the splash script**

Append to `assets/js/site.js`, immediately before the line `measure();` near the end:

```js
  /* ---------- 9. splash — Frame 01, once per session ---------- */
  (function splash() {
    var el = document.getElementById('splash');
    if (!el) return;
    var html = document.documentElement;
    if (html.classList.contains('no-splash') || reduced()) { el.remove(); return; }
    html.classList.add('splash-active');
    var mark = el.querySelector('.splash-mark');
    var navMark = document.querySelector('.nav .lockup .mark');
    var done = false;
    var finish = function () {
      if (done) return;
      done = true;
      el.classList.add('out');
      html.classList.remove('splash-active');
      setTimeout(function () { el.remove(); }, 650);
      try { sessionStorage.setItem('dayamSplash', '1'); } catch (e) {}
    };
    var go = function () {
      if (done) return;
      var a = mark.getBoundingClientRect(), b = navMark ? navMark.getBoundingClientRect() : null;
      if (!b || !b.width) { finish(); return; }
      el.classList.add('morph');
      mark.style.transform = 'translate(' + (b.left - a.left) + 'px,' + (b.top - a.top) + 'px) scale(' + (b.width / a.width) + ')';
      mark.addEventListener('transitionend', finish, { once: true });
      setTimeout(finish, 800);
    };
    var start = function () { setTimeout(go, 1400); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
    el.addEventListener('click', finish);
  })();
```

- [ ] **Step 4: Add the motion and rules sections to the styleguide**

Insert into `styleguide.html`, replacing the comment `<!-- Task 12 adds: … -->`:

```html
  <section class="sg-sec" id="sg-motion">
    <div class="wrap">
      <h2>Motion</h2>
      <table class="sg-table">
        <tr><th>Verb</th><th>What moves</th><th>How</th></tr>
        <tr><td>Reveal</td><td>Any block</td><td><code>.reveal</code> — opacity 0→1, 16px rise, 600ms, staggered 60ms by <code>--i</code></td></tr>
        <tr><td>Draw</td><td>SVG lines</td><td><code>.draw</code> + <code>pathLength="1"</code> — dashoffset 1→0, 900ms, staggered 120ms</td></tr>
        <tr><td>Travel</td><td>One blue square</td><td><code>.tr</code> on an <code>offset-path</code>, 4–6s linear loop, only while <code>[data-run]</code> is on screen</td></tr>
        <tr><td>Scrub</td><td>Mesh, spine, rail</td><td><code>[data-scrub]</code> writes <code>--p</code> from its own scroll travel, smoothstep eased; CSS interpolates</td></tr>
      </table>
      <p class="sg-note">Tokens: 200 / 600 / 1200ms, <code>cubic-bezier(.2,.7,.2,1)</code>. Hover: lift −4px + shadow on tiles, fill swap on buttons. No parallax, no cursor effects, no marquees. Under <code>prefers-reduced-motion</code> every verb resolves to its finished frame.</p>
      <p class="sg-note">Splash (Frame 01): white overlay, mark centred, blue square pulses once at 300ms, tag-line at 800ms, morph into the nav slot at 1400ms, gone by 2100ms. Once per session; never under reduced motion; never without JS.</p>
    </div>
  </section>

  <section class="sg-sec" id="sg-rules">
    <div class="wrap">
      <h2>Rules</h2>
      <ol style="list-style:decimal;padding-left:20px;max-width:64ch;display:grid;gap:12px">
        <li><b>Nodes are squares.</b> Never circles.</li>
        <li><b>One blue element per composition.</b> The active node, the live cursor, or the CTA.</li>
        <li><b>Radius 0 / 2px / full.</b> Sharp by default; full only on D-derived shapes.</li>
        <li><b>Flat left, round right.</b> Input face is flat, delivery face is the arc.</li>
        <li><b>Left to right</b> is the only story direction.</li>
        <li><b>Hairlines, not shadows.</b> Shadow appears on hover lift only.</li>
        <li><b>Inter 700–800 tight-tracked headings; 11px caps labels</b> mirror the tag-line.</li>
        <li><b>No gradients, no photography of people, no illustration</b> outside the six systems.</li>
      </ol>
    </div>
  </section>
```

- [ ] **Step 5: Verify the splash on a test copy**

The styleguide never carries the splash. Test it with a temporary copy of the styleguide that does:

```bash
node -e "
const fs=require('fs');let h=fs.readFileSync('styleguide.html','utf8');const s=fs.readFileSync('docs/partials/splash.html','utf8');
h=h.replace('<main id=\"main\"', s+'\n<main id=\"main\"');fs.writeFileSync('tmp_splash.html',h);"
node -e "
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});
p.on('pageerror',e=>console.log('PAGEERROR',e));
await p.goto('http://localhost:8090/tmp_splash.html',{waitUntil:'domcontentloaded'});
console.log('splash visible', await p.\$eval('#splash',e=>getComputedStyle(e).display!=='none'), 'nav mark hidden', await p.\$eval('.nav .lockup .mark',e=>getComputedStyle(e).opacity)==='0');
await p.waitForTimeout(1700);console.log('morph', await p.\$eval('#splash',e=>e.classList.contains('morph')), 'transform', (await p.\$eval('.splash-mark',e=>e.style.transform)).slice(0,40));
await p.waitForTimeout(1200);console.log('removed', await p.\$('#splash')===null, 'flag', await p.evaluate(()=>sessionStorage.getItem('dayamSplash')));
await p.reload({waitUntil:'domcontentloaded'});console.log('second load hidden', await p.evaluate(()=>document.documentElement.classList.contains('no-splash')));
const c=await b.newContext({reducedMotion:'reduce'});const q=await c.newPage();await q.goto('http://localhost:8090/tmp_splash.html',{waitUntil:'domcontentloaded'});
console.log('reduced hidden', await q.evaluate(()=>document.documentElement.classList.contains('no-splash')));
await b.close()})()"
rm tmp_splash.html
```
Expected:
```
splash visible true nav mark hidden true
morph true transform translate(<n>px,<n>px) scale(0.26…)
removed true flag 1
second load hidden true
reduced hidden true
```

- [ ] **Step 6: Check and commit**

Run `node tmp_check.js styleguide.html --expect "#sg-motion,#sg-rules" --shots` — expected `ALL OK`.

```bash
git add assets/css/components.css assets/js/site.js docs/partials/splash.html styleguide.html && git commit -m "Add the session splash with its FLIP morph, and document motion and rules

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 13: Homepage — head, splash, hero (Frame 02), proof strip

**Files:**
- Create: `index.html`
- Modify: `assets/css/components.css` (append homepage section layout)

- [ ] **Step 1: Append the hero and proof layout CSS**

Append to `assets/css/components.css`:

```css
/* ===== Homepage sections ===== */
.hero{position:relative;padding-top:calc(var(--nav-h) + var(--sp-8));padding-bottom:var(--sp-8);overflow:hidden}
.hero .grid{align-items:center}
.hero-copy{display:grid;gap:var(--sp-4);justify-items:start}
.hero-copy h1{max-width:13ch}
.hero-copy .lead{max-width:46ch}
.hero-copy .sectors{font-size:var(--fs-small);font-weight:400;color:var(--muted);max-width:52ch}
.hero-fig .diagram{padding:24px}
@media (max-width:899px){.hero{padding-top:calc(var(--nav-h) + var(--sp-6));padding-bottom:var(--sp-6)}.hero-fig .diagram{max-width:560px}}

.proof{padding-block:var(--sp-6)}
```

- [ ] **Step 2: Create the homepage**

Create `index.html`. Fill the head partial with:
- TITLE = `Intelligent Business Systems — Data, Automation, AI & Websites | Dayam Insights`
- DESCRIPTION = `Dayam Insights builds intelligent business systems for growing companies: one source of truth for your data, automation that removes routine work, AI grounded in your own records, and websites wired into the same system.`
- CANONICAL = `https://dayaminsights.com/`

The `<!-- §… -->` markers are replaced by Tasks 14–16.

```html
<!DOCTYPE html>
<html lang="en" class="no-js">
<head>
<!-- paste docs/partials/head.html with the three slots filled as above -->
<!-- Task 16 inserts the JSON-LD schema block here -->
</head>
<body>
<!-- paste docs/partials/icons.html -->
<!-- paste docs/partials/splash.html -->
<!-- paste docs/partials/nav.html (no aria-current on the homepage) -->

<main id="main">

<!-- HERO — Frame 02 -->
<section class="hero igrid bp-lines" id="hero" aria-labelledby="h-hero">
  <div class="wrap grid">
    <div class="c-7 hero-copy">
      <span class="tag-line reveal">Data<i></i>Automation<i></i>AI<i></i>Websites</span>
      <h1 class="reveal" id="h-hero" style="--i:1">Building intelligent systems for modern businesses.</h1>
      <p class="lead reveal" style="--i:2">We connect your orders, stock, invoices and customers into one system that updates itself — and shows you what to do next.</p>
      <div class="btn-row reveal" style="--i:3">
        <a class="btn btn-primary" href="contact.html">Book a systems review</a>
        <a class="btn-link" href="#system">See how it works <svg class="ico"><use href="#i-arrow"/></svg></a>
      </div>
      <p class="sectors reveal" style="--i:4">For growing businesses that have outgrown spreadsheets, manual processes and disconnected tools — retail, manufacturing, distribution, clinics and professional services.</p>
    </div>
    <div class="c-5 hero-fig reveal" style="--i:2" data-run>
      <div class="diagram">
        <svg class="flow" viewBox="0 0 520 400" role="img" aria-labelledby="flow-t">
          <title id="flow-t">Orders, stock, invoices and customer records flow into one processing system and out as a decision</title>
          <g class="g-lbl"><text x="0" y="64">Orders</text><text x="0" y="154">Stock</text><text x="0" y="244">Invoices</text><text x="0" y="334">Customers</text></g>
          <path class="g-line draw" pathLength="1" d="M108 60H170V200H228" style="--i:0"/>
          <path class="g-line draw" pathLength="1" d="M108 150H170V200" style="--i:1"/>
          <path class="g-line draw" pathLength="1" d="M108 240H170V200" style="--i:2"/>
          <path class="g-line draw" pathLength="1" d="M108 330H170V200" style="--i:3"/>
          <path class="g-line draw" pathLength="1" d="M376 200H440" style="--i:5"/>
          <rect class="g-node" x="96" y="54" width="12" height="12"/>
          <rect class="g-node" x="96" y="144" width="12" height="12"/>
          <rect class="g-node" x="96" y="234" width="12" height="12"/>
          <rect class="g-node" x="96" y="324" width="12" height="12"/>
          <g class="proc">
            <path class="g-fill" d="M228 125h72a75 75 0 0 1 0 150h-72z"/>
            <path class="g-cut" d="M252 150h48a50 50 0 0 1 0 100h-48z"/>
            <path class="g-fill" d="M266 168h34a32 32 0 0 1 0 64h-34z"/>
            <path class="g-cut notch" d="M266 168l12 12v40l-12 12z"/>
          </g>
          <text class="g-lbl sm" x="228" y="110">Processing · Automation · AI</text>
          <rect class="g-node" x="440" y="194" width="12" height="12"/>
          <text class="g-lbl" x="446" y="232" text-anchor="middle">Decision</text>
          <rect class="tr" width="8" height="8" style="offset-path:path('M102 60H170V200H228L376 200H446')"/>
        </svg>
        <span class="fig">Fig. 01 — Data flow</span>
      </div>
    </div>
  </div>
</section>

<!-- PROOF STRIP -->
<section class="proof band" aria-label="How we work, in numbers">
  <div class="wrap">
    <ul class="stats reveal-group">
      <li class="stat sm reveal"><b>4–6<small>wks</small></b><span>First working system live</span></li>
      <li class="stat sm reveal" style="--i:1"><b>1</b><span>Fixed price, quoted before work starts</span></li>
      <li class="stat sm reveal" style="--i:2"><b>0</b><span>Lock-in — every account and login stays yours</span></li>
      <li class="stat sm reveal" style="--i:3"><b>India</b><span>Remote-first, nationwide; on site where it helps</span></li>
    </ul>
  </div>
</section>

<!-- §signal -->
<!-- §system -->
<!-- §work -->
<!-- §how -->
<!-- §insights -->
<!-- §faq -->
<!-- §close -->
<!-- §contact -->

</main>

<!-- paste docs/partials/footer.html -->
</body>
</html>
```

- [ ] **Step 3: Check, including the splash path**

Run:
```bash
node tmp_check.js index.html --expect "#splash,.nav,#hero h1,.hero-fig .flow,.proof .stat" --shots --splash
node tmp_check.js index.html --expect ".nav,#hero h1" --rm
```
Expected: first run — `#splash` may report `visible=false` if the check lands after the morph; every other line `ok`, no console errors, no overflow at any width. Second run — `ALL OK` under reduced motion. Open `tmp_index_html_1440.png`: headline in 7 columns, the data-flow diagram in 5, blueprint lines faint behind, four stats on a white band beneath. `tmp_index_html_390.png`: stacked, h1 at 44px, diagram under the copy, stats 2×2.

- [ ] **Step 4: Taste pass**

Invoke `/taste:taste` on the hero: headline line breaks at 1440 and 390, lead measure, gap between CTA row and sectors line, diagram padding, reveal stagger feel. Apply its adjustments to `components.css` / `index.html`.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/css/components.css && git commit -m "Build the homepage hero and proof strip

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 14: Homepage — #signal (Frame 03) and #system (Frame 04)

**Files:**
- Modify: `index.html` (replace `<!-- §signal -->` and `<!-- §system -->`)
- Modify: `assets/css/components.css` (append)

- [ ] **Step 1: Append the signal layout CSS**

Append to `assets/css/components.css`:

```css
.signal .mesh-wrap{padding:var(--sp-4) 0}
.signal .captions{margin-top:var(--sp-5)}
.signal .captions li{border-top:1px solid var(--line);padding-top:var(--sp-2)}
.signal .captions .label{display:block;margin-bottom:8px}
.signal .captions p{color:var(--muted);font-size:var(--fs-small);font-weight:400}
.system .spine{margin-top:var(--sp-2)}
.system .module .node{background:var(--surface)}
```

- [ ] **Step 2: Replace `<!-- §signal -->`**

```html
<!-- SIGNAL — Frame 03: business data becoming intelligence -->
<section class="signal sec" id="signal" data-scrub data-scrub-start=".85" data-scrub-len="1.1" aria-labelledby="h-signal">
  <div class="wrap">
    <div class="sec-head center reveal">
      <span class="eyebrow"><i></i>Signal</span>
      <h2 id="h-signal">Business data becoming intelligence.</h2>
    </div>
    <div class="mesh-wrap">
      <svg class="mesh" viewBox="0 0 1200 300" role="img" aria-labelledby="mesh-t">
        <title id="mesh-t">Scattered business records connecting, left to right, into one network with a single highlighted decision point</title>
        <g class="edges">
          <line class="me g-line" pathLength="1" x1="60" y1="210" x2="160" y2="110" style="--t:.08"/>
          <line class="me g-line" pathLength="1" x1="60" y1="210" x2="280" y2="190" style="--t:.13"/>
          <line class="me g-line" pathLength="1" x1="160" y1="110" x2="280" y2="190" style="--t:.13"/>
          <line class="me g-line" pathLength="1" x1="160" y1="110" x2="360" y2="60" style="--t:.18"/>
          <line class="me g-line" pathLength="1" x1="280" y1="190" x2="360" y2="60" style="--t:.18"/>
          <line class="me g-line" pathLength="1" x1="280" y1="190" x2="470" y2="230" style="--t:.23"/>
          <line class="me g-line" pathLength="1" x1="360" y1="60" x2="560" y2="120" style="--t:.29"/>
          <line class="me g-line" pathLength="1" x1="470" y1="230" x2="560" y2="120" style="--t:.29"/>
          <line class="me g-line" pathLength="1" x1="470" y1="230" x2="730" y2="200" style="--t:.39"/>
          <line class="me g-line" pathLength="1" x1="560" y1="120" x2="650" y2="40" style="--t:.34"/>
          <line class="me g-line" pathLength="1" x1="560" y1="120" x2="730" y2="200" style="--t:.39"/>
          <line class="me g-line" pathLength="1" x1="650" y1="40" x2="830" y2="100" style="--t:.45"/>
          <line class="me g-line" pathLength="1" x1="730" y1="200" x2="830" y2="100" style="--t:.45"/>
          <line class="me g-line" pathLength="1" x1="730" y1="200" x2="910" y2="250" style="--t:.51"/>
          <line class="me g-line" pathLength="1" x1="830" y1="100" x2="960" y2="170" style="--t:.57"/>
          <line class="me g-line" pathLength="1" x1="910" y1="250" x2="960" y2="170" style="--t:.57"/>
          <line class="me g-line" pathLength="1" x1="830" y1="100" x2="1080" y2="60" style="--t:.63"/>
          <line class="me g-line" pathLength="1" x1="910" y1="250" x2="1150" y2="220" style="--t:.69"/>
          <line class="me g-line" pathLength="1" x1="1080" y1="60" x2="1150" y2="220" style="--t:.69"/>
          <line class="me g-line" pathLength="1" x1="960" y1="170" x2="1040" y2="150" style="--t:.77"/>
          <line class="me g-line" pathLength="1" x1="1080" y1="60" x2="1040" y2="150" style="--t:.77"/>
          <line class="me g-line" pathLength="1" x1="1150" y1="220" x2="1040" y2="150" style="--t:.77"/>
        </g>
        <g class="nodes">
          <rect class="mn g-node" x="55" y="205" width="10" height="10" style="--t:0"/>
          <rect class="mn g-node" x="155" y="105" width="10" height="10" style="--t:.05"/>
          <rect class="mn g-node" x="275" y="185" width="10" height="10" style="--t:.10"/>
          <rect class="mn g-node" x="355" y="55" width="10" height="10" style="--t:.15"/>
          <rect class="mn g-node" x="465" y="225" width="10" height="10" style="--t:.20"/>
          <rect class="mn g-node" x="555" y="115" width="10" height="10" style="--t:.26"/>
          <rect class="mn g-node" x="645" y="35" width="10" height="10" style="--t:.31"/>
          <rect class="mn g-node" x="725" y="195" width="10" height="10" style="--t:.36"/>
          <rect class="mn g-node" x="825" y="95" width="10" height="10" style="--t:.42"/>
          <rect class="mn g-node" x="905" y="245" width="10" height="10" style="--t:.48"/>
          <rect class="mn g-node" x="955" y="165" width="10" height="10" style="--t:.54"/>
          <rect class="mn g-node" x="1075" y="55" width="10" height="10" style="--t:.60"/>
          <rect class="mn g-node" x="1145" y="215" width="10" height="10" style="--t:.66"/>
          <g class="hub">
            <rect class="rip" x="1033" y="143" width="14" height="14"/>
            <rect class="mn core g-node" x="1033" y="143" width="14" height="14" style="--t:.74"/>
          </g>
        </g>
      </svg>
    </div>
    <ol class="captions grid">
      <li class="c-4 reveal"><span class="label">01 — Collect</span><p>Every order, stock movement and invoice, wherever it lands — WhatsApp, email, billing software, a sheet.</p></li>
      <li class="c-4 reveal" style="--i:1"><span class="label">02 — Connect</span><p>Records that used to live in five places, joined into one, with every number meaning the same thing everywhere.</p></li>
      <li class="c-4 reveal" style="--i:2"><span class="label">03 — Decide</span><p>The number you need, before the moment passes. Not a report assembled on Monday about last week.</p></li>
    </ol>
  </div>
</section>
```

- [ ] **Step 3: Replace `<!-- §system -->`**

```html
<!-- SYSTEM — Frame 04: four layers on one spine -->
<section class="system sec band" id="system" data-scrub data-scrub-start=".6" data-scrub-len=".85" data-steps=".module" aria-labelledby="h-system">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow"><span class="ch">01</span><i></i>What we build</span>
      <h2 id="h-system">One system. Four layers. Each one feeds the next.</h2>
      <p class="lead">Not four services to pick from. One architecture, built in the order that pays back soonest — usually data first, because everything else runs on it.</p>
    </div>
    <div class="spine">
      <article class="module reveal" id="data">
        <i class="node"></i>
        <div class="m-id"><span class="label">01</span><h3>Data</h3></div>
        <div class="m-body">
          <p>Your orders, stock, invoices and customer records — pulled from the tools you already use into one source of truth. Dashboards that show what is happening today, not last month.</p>
          <div class="tags"><span class="tag">Power BI</span><span class="tag">SQL</span><span class="tag">PostgreSQL</span><span class="tag">Google Sheets</span><span class="tag">Microsoft 365</span></div>
        </div>
        <div class="m-fig diagram"><svg viewBox="0 0 200 90" aria-hidden="true"><rect class="g-node" x="10" y="10" width="10" height="10"/><rect class="g-node" x="10" y="40" width="10" height="10"/><rect class="g-node" x="10" y="70" width="10" height="10"/><path class="g-line draw" pathLength="1" d="M20 15H60V45H100M20 45H100M20 75H60V45" style="--i:0"/><rect class="g-line draw" pathLength="1" x="100" y="20" width="80" height="50" style="--i:1"/><rect class="bar" x="110" y="50" width="8" height="12"/><rect class="bar" x="124" y="40" width="8" height="22"/><rect class="bar" x="138" y="32" width="8" height="30"/><rect class="bar" x="152" y="44" width="8" height="18"/><rect class="bar on" x="166" y="26" width="8" height="36"/></svg></div>
      </article>
      <article class="module reveal" id="automation">
        <i class="node"></i>
        <div class="m-id"><span class="label">02</span><h3>Automation</h3></div>
        <div class="m-body">
          <p>The repetitive steps between those records — order to invoice, stock alerts, payment follow-ups — run on their own. Your people handle exceptions, not routine.</p>
          <div class="tags"><span class="tag">REST APIs</span><span class="tag">Webhooks</span><span class="tag">Python</span><span class="tag">Scheduled jobs</span><span class="tag">Your billing software</span></div>
        </div>
        <div class="m-fig diagram"><svg viewBox="0 0 200 90" aria-hidden="true"><path class="g-line dash" d="M60 15V75"/><path class="g-line draw" pathLength="1" d="M60 15h50a30 30 0 0 1 0 60H60" style="--i:0;stroke-width:1.5"/><path class="g-line draw" pathLength="1" d="M60 30h50a15 15 0 0 1 0 30H60" style="--i:1;stroke-width:1.5;stroke-opacity:.4"/><rect class="g-sig" x="55" y="10" width="10" height="10"/><rect class="g-node" x="135" y="40" width="10" height="10"/></svg></div>
      </article>
      <article class="module reveal" id="ai">
        <i class="node"></i>
        <div class="m-id"><span class="label">03</span><h3>AI</h3></div>
        <div class="m-body">
          <p>Assistants grounded in your own data. Ask which customers are late this week and get an answer from your records — not from the internet.</p>
          <div class="tags"><span class="tag">Claude</span><span class="tag">OpenAI</span><span class="tag">Document processing</span><span class="tag">Threshold alerts</span></div>
        </div>
        <div class="m-fig diagram"><svg viewBox="0 0 200 90" aria-hidden="true"><path class="g-fill" d="M70 20h30a25 25 0 0 1 0 50H70z"/><path class="g-cut" d="M82 32h18a13 13 0 0 1 0 26H82z"/><path class="g-fill" d="M82 32l8 8v10l-8 8z"/><path class="g-line draw" pathLength="1" d="M20 45H70" style="--i:0"/><path class="g-line draw" pathLength="1" d="M125 45H160" style="--i:1"/><rect class="g-node" x="10" y="40" width="10" height="10"/><rect class="g-sig" x="160" y="40" width="10" height="10"/></svg></div>
      </article>
      <article class="module reveal" id="websites">
        <i class="node"></i>
        <div class="m-id"><span class="label">04</span><h3>Websites</h3></div>
        <div class="m-body">
          <p>The public face of the system. Fast, indexed, and wired to the same records — so an enquiry lands in your pipeline, not an inbox.</p>
          <div class="tags"><span class="tag">Websites &amp; landing pages</span><span class="tag">Forms → CRM</span><span class="tag">Your own cloud</span></div>
        </div>
        <div class="m-fig diagram"><svg viewBox="0 0 200 90" aria-hidden="true"><rect class="g-line draw" pathLength="1" x="20" y="10" width="160" height="70" style="--i:0"/><path class="g-line draw" pathLength="1" d="M20 24H180" style="--i:1"/><rect class="g-fill" x="30" y="34" width="70" height="8" fill-opacity=".8"/><rect class="g-fill" x="30" y="48" width="50" height="5" fill-opacity=".3"/><rect class="g-sig" x="30" y="60" width="28" height="10"/><path class="g-line draw" pathLength="1" d="M120 50H160" style="--i:2"/><rect class="g-node" x="160" y="45" width="10" height="10"/></svg></div>
      </article>
    </div>
    <p class="small muted" style="margin-top:var(--sp-4)">Everything runs in cloud accounts you own. Backed up daily. You keep the logins.</p>
  </div>
</section>
```

- [ ] **Step 4: Check**

Run:
```bash
node tmp_check.js index.html --expect "#signal .mesh,#system .module,#system #websites" --shots
node -e "
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});
await p.addInitScript(()=>sessionStorage.setItem('dayamSplash','1'));
await p.goto('http://localhost:8090/index.html',{waitUntil:'networkidle'});
await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await p.waitForTimeout(600);
console.log('mesh on', await p.\$eval('#signal .mesh',e=>e.classList.contains('on')), 'last module live', await p.\$eval('#websites',e=>e.classList.contains('live')), 'spine p', await p.\$eval('#system',e=>e.style.getPropertyValue('--p')));
await b.close()})()"
```
Expected: `ALL OK`; then `mesh on true last module live true spine p 1.0000`.

- [ ] **Step 5: Taste pass**

Invoke `/taste:taste` on `#signal` and `#system`: the scrub windows (`data-scrub-start`, `data-scrub-len`) so the mesh completes just before the captions arrive and the spine fills at reading pace; the module row's vertical rhythm; tag wrapping at 1024.

- [ ] **Step 6: Commit**

```bash
git add index.html assets/css/components.css && git commit -m "Add the signal mesh and the four-layer system spine to the homepage

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 15: Homepage — #work (Frame 05), #how, #insights (Frame 06)

**Files:**
- Modify: `index.html` (replace `<!-- §work -->`, `<!-- §how -->`, `<!-- §insights -->`)
- Modify: `assets/css/components.css` (append rail CSS)

- [ ] **Step 1: Append the rail CSS**

Append to `assets/css/components.css`:

```css
/* ===== Rail (#how) — four steps on one horizontal hairline, filled by --p ===== */
.rail{position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:var(--col-gap);padding-top:var(--sp-4)}
.rail::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:var(--hairline-soft)}
.rail::after{content:"";position:absolute;left:0;top:0;height:1px;width:calc(var(--p,0) * 100%);background:var(--navy);transition:width 120ms linear}
.step{position:relative;padding-right:var(--sp-3)}
.step .node{position:absolute;left:0;top:calc(-1 * var(--sp-4) - 6px);width:12px;height:12px;background:var(--bg);border:1px solid var(--navy);transition:background var(--t-fast),border-color var(--t-fast),box-shadow var(--t-fast)}
.band .step .node{background:var(--surface)}
.step.done .node{background:var(--navy)}
.step.live .node{background:var(--blue);border-color:var(--blue);box-shadow:0 0 0 6px var(--blue-soft)}
.step .label{display:block;margin-bottom:10px}
.step h3{color:var(--ink-2);transition:color var(--t-fast)}
.step.live h3,.step.done h3{color:var(--ink)}
.step p{color:var(--muted);margin-top:8px;font-size:var(--fs-small);font-weight:400}
@media (max-width:899px){.rail{grid-template-columns:1fr 1fr;row-gap:var(--sp-5)}.rail .step:nth-child(n+3) .node{display:none}}
@media (max-width:639px){
  .rail{grid-template-columns:1fr;padding-top:0;padding-left:var(--sp-4);row-gap:0}
  .rail::before{right:auto;bottom:0;width:1px;height:auto}
  .rail::after{width:1px;height:calc(var(--p,0) * 100%);transition:height 120ms linear}
  .step{padding:var(--sp-3) 0}
  .rail .step .node{display:block;left:calc(-1 * var(--sp-4) - 6px);top:calc(var(--sp-3) + 2px)}
}
.work .cases{margin-top:var(--sp-2)}
.work .more{margin-top:var(--sp-4)}
.insights .more{margin-top:var(--sp-4)}
```

- [ ] **Step 2: Replace `<!-- §work -->`**

```html
<!-- WORK — Frame 05: illustrative engagements -->
<section class="work sec" id="work" aria-labelledby="h-work">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow"><span class="ch">02</span><i></i>Engagements</span>
      <h2 id="h-work">Real business problems, and the systems that solve them.</h2>
      <p class="lead">The three shapes of work we are asked for most often, written as examples rather than client case studies. Named projects replace them as clients agree to be named.</p>
    </div>
    <div class="cases">
      <article class="case reveal">
        <div class="case-copy">
          <div class="meta"><span class="eyebrow"><i></i>Retail</span><span class="label" style="color:var(--muted)">Illustrative engagement</span></div>
          <h3>One view of sales and stock, refreshed daily.</h3>
          <dl>
            <div><dt>Context</dt><dd>Weekly reporting depended on several spreadsheets, each maintained by a different person.</dd></div>
            <div><dt>System</dt><dd>A central sales and inventory dashboard, fed straight from billing and stock data.</dd></div>
            <div><dt>Outcome</dt><dd>Management gained one view of performance, refreshed daily instead of assembled weekly.</dd></div>
          </dl>
          <ul class="stats">
            <li class="stat"><b>Daily</b><span>Refresh, was weekly</span></li>
            <li class="stat"><b>1</b><span>Dashboard replacing several sheets</span></li>
            <li class="stat"><b>0</b><span>Monday report builds</span></li>
          </ul>
        </div>
        <div class="diagram">
          <svg class="bp" viewBox="0 0 480 320" role="img" aria-labelledby="bp-a-t"><title id="bp-a-t">Blueprint of a sales and stock dashboard fed by billing and stock data</title><defs><pattern id="bpg-a" width="32" height="32" patternUnits="userSpaceOnUse"><path class="bp-grid" d="M32 0H0V32"/></pattern></defs><rect width="480" height="320" fill="url(#bpg-a)"/><rect class="g-line draw" pathLength="1" x="64" y="64" width="192" height="128" style="--i:0"/><rect class="g-line draw" pathLength="1" x="288" y="64" width="128" height="56" style="--i:1"/><rect class="g-line draw" pathLength="1" x="288" y="136" width="128" height="56" style="--i:2"/><path class="g-line draw" pathLength="1" d="M256 92H288M256 164H288" style="--i:3"/><path class="g-line draw dim" pathLength="1" d="M64 224V240M256 224V240M64 232H256" style="--i:4"/><path class="g-line draw dim" pathLength="1" d="M416 120a96 96 0 0 1-32 72" style="--i:5"/><g class="g-lbl sm"><text x="66" y="58">Module A — Sales &amp; stock dashboard</text><text x="290" y="58">Billing</text><text x="290" y="130">Stock</text><text x="160" y="254" text-anchor="middle">refresh: daily</text><text x="404" y="212" text-anchor="end">r = 96</text></g><rect class="g-sig" x="252" y="122" width="8" height="8"/></svg>
          <span class="fig">Fig. 04a — Dashboard</span>
        </div>
      </article>
      <article class="case reveal">
        <div class="case-copy">
          <div class="meta"><span class="eyebrow"><i></i>Distribution</span><span class="label" style="color:var(--muted)">Illustrative engagement</span></div>
          <h3>Order to invoice, without the retyping.</h3>
          <dl>
            <div><dt>Context</dt><dd>Orders and stock updates were handled by hand, across WhatsApp, email and a billing system.</dd></div>
            <div><dt>System</dt><dd>An automated order-to-invoice workflow connecting the tools already in use.</dd></div>
            <div><dt>Outcome</dt><dd>Less repetitive admin, fewer manual handoffs, and a clear record of where each order stands.</dd></div>
          </dl>
          <ul class="stats">
            <li class="stat"><b>3→1</b><span>Channels into one flow</span></li>
            <li class="stat"><b>0</b><span>Orders retyped</span></li>
            <li class="stat"><b>Live</b><span>Status of every order</span></li>
          </ul>
        </div>
        <div class="diagram">
          <svg class="bp" viewBox="0 0 480 320" role="img" aria-labelledby="bp-b-t"><title id="bp-b-t">Blueprint of an order-to-invoice workflow connecting three input channels</title><defs><pattern id="bpg-b" width="32" height="32" patternUnits="userSpaceOnUse"><path class="bp-grid" d="M32 0H0V32"/></pattern></defs><rect width="480" height="320" fill="url(#bpg-b)"/><rect class="g-line draw" pathLength="1" x="32" y="64" width="96" height="40" style="--i:0"/><rect class="g-line draw" pathLength="1" x="32" y="136" width="96" height="40" style="--i:0"/><rect class="g-line draw" pathLength="1" x="32" y="208" width="96" height="40" style="--i:0"/><path class="g-line draw" pathLength="1" d="M128 84H160V156H192M128 156H192M128 228H160V156" style="--i:1"/><rect class="g-line draw" pathLength="1" x="192" y="128" width="80" height="56" style="--i:2"/><path class="g-line draw" pathLength="1" d="M272 156H304" style="--i:3"/><rect class="g-line draw" pathLength="1" x="304" y="128" width="80" height="56" style="--i:3"/><path class="g-line draw" pathLength="1" d="M384 156H416" style="--i:4"/><rect class="g-line draw" pathLength="1" x="416" y="128" width="40" height="56" style="--i:4"/><path class="g-line draw dim" pathLength="1" d="M192 256V272M456 256V272M192 264H456" style="--i:5"/><g class="g-lbl sm"><text x="34" y="58">WhatsApp</text><text x="34" y="130">Email</text><text x="34" y="202">Billing</text><text x="194" y="122">Order</text><text x="306" y="122">Invoice</text><text x="418" y="122">Paid</text><text x="324" y="286" text-anchor="middle">retyping: 0</text></g><rect class="g-sig" x="228" y="152" width="8" height="8"/></svg>
          <span class="fig">Fig. 04b — Workflow</span>
        </div>
      </article>
      <article class="case reveal">
        <div class="case-copy">
          <div class="meta"><span class="eyebrow"><i></i>Professional services</span><span class="label" style="color:var(--muted)">Illustrative engagement</span></div>
          <h3>Every enquiry answered, every follow-up on time.</h3>
          <dl>
            <div><dt>Context</dt><dd>Enquiries were tracked in an inbox and followed up whenever somebody remembered.</dd></div>
            <div><dt>System</dt><dd>An automated enquiry, follow-up and CRM workflow with reminders built in.</dd></div>
            <div><dt>Outcome</dt><dd>Faster first response, and far less leakage between enquiry and quote.</dd></div>
          </dl>
          <ul class="stats">
            <li class="stat"><b>1</b><span>Pipeline, replacing an inbox</span></li>
            <li class="stat"><b>0</b><span>Follow-ups left to memory</span></li>
            <li class="stat"><b>Auto</b><span>Reminders on every open enquiry</span></li>
          </ul>
        </div>
        <div class="diagram">
          <svg class="bp" viewBox="0 0 480 320" role="img" aria-labelledby="bp-c-t"><title id="bp-c-t">Blueprint of an enquiry, follow-up and quote pipeline with automatic reminders</title><defs><pattern id="bpg-c" width="32" height="32" patternUnits="userSpaceOnUse"><path class="bp-grid" d="M32 0H0V32"/></pattern></defs><rect width="480" height="320" fill="url(#bpg-c)"/><rect class="g-line draw" pathLength="1" x="64" y="64" width="352" height="48" style="--i:0"/><rect class="g-line draw" pathLength="1" x="112" y="136" width="256" height="48" style="--i:1"/><rect class="g-line draw" pathLength="1" x="160" y="208" width="160" height="48" style="--i:2"/><path class="g-line draw" pathLength="1" d="M240 112V136M240 184V208" style="--i:3"/><path class="g-line draw dim" pathLength="1" d="M368 160h32a48 48 0 0 1-48 48" style="--i:4"/><path class="g-line draw dim" pathLength="1" d="M48 64H32V256H48" style="--i:5"/><g class="g-lbl sm"><text x="66" y="58">Enquiry — inbox, form, WhatsApp</text><text x="114" y="130">Follow-up — reminders automatic</text><text x="162" y="202">Quote</text><text x="20" y="168" transform="rotate(-90 20 168)" text-anchor="middle">pipeline: 1</text></g><rect class="g-sig" x="236" y="228" width="8" height="8"/></svg>
          <span class="fig">Fig. 04c — Pipeline</span>
        </div>
      </article>
    </div>
    <div class="more reveal"><a class="btn-link" href="case-studies.html">All engagements <svg class="ico"><use href="#i-arrow"/></svg></a></div>
  </div>
</section>
```

- [ ] **Step 3: Replace `<!-- §how -->`**

```html
<!-- HOW — after you say yes -->
<section class="how sec band" id="how" data-scrub data-scrub-start=".7" data-scrub-len=".8" data-steps=".step" aria-labelledby="h-how">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow"><span class="ch">03</span><i></i>How an engagement runs</span>
      <h2 id="h-how">The most expensive problem first.</h2>
      <p class="lead">No unnecessary complexity, and no technology for technology's sake. We build the process costing you the most, and show you what changed before anyone mentions phase two.</p>
    </div>
    <ol class="rail">
      <li class="step"><i class="node"></i><span class="label">01 — Week 1</span><h3>Discover</h3><p>We sit with how the business actually runs, and find where time, money and information get stuck.</p></li>
      <li class="step"><i class="node"></i><span class="label">02 — Week 1–2</span><h3>Prioritise</h3><p>We identify the problem with the biggest operational or commercial impact, and show you what we would build.</p></li>
      <li class="step"><i class="node"></i><span class="label">03 — Week 2–6</span><h3>Build</h3><p>We design, integrate and deploy it, then hand it over with instructions in plain language.</p></li>
      <li class="step"><i class="node"></i><span class="label">04 — Ongoing</span><h3>Improve</h3><p>We measure what changed, then identify the next opportunity. One working system at a time.</p></li>
    </ol>
  </div>
</section>
```

- [ ] **Step 4: Replace `<!-- §insights -->`**

```html
<!-- INSIGHTS — Frame 06 -->
<section class="insights sec" id="insights" aria-labelledby="h-insights">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow"><span class="ch">04</span><i></i>Insights</span>
      <h2 id="h-insights">Notes from the systems desk.</h2>
      <p class="lead">Short, specific pieces on where the days go in a growing business and what to do about it. No marketing.</p>
    </div>
    <div class="insights-list reveal-group">
      <a class="insight reveal" href="insights.html"><span class="cat label">Data</span><div><h3>Why your dashboard is a month late</h3><p>Reporting lag is a plumbing problem, not a people problem. Where the days go between a sale and the number.</p></div><svg class="ico"><use href="#i-arrow"/></svg></a>
      <a class="insight reveal" href="insights.html" style="--i:1"><span class="cat label">Automation</span><div><h3>Order-to-invoice: the six steps nobody should do by hand</h3><p>The handoffs between a WhatsApp order and a paid invoice, and which of them a machine should own.</p></div><svg class="ico"><use href="#i-arrow"/></svg></a>
      <a class="insight reveal" href="insights.html" style="--i:2"><span class="cat label">AI</span><div><h3>What an AI assistant grounded in your data actually answers</h3><p>Not the internet's opinion. Your records, your definitions, your numbers — and the questions it should refuse.</p></div><svg class="ico"><use href="#i-arrow"/></svg></a>
    </div>
    <div class="more reveal"><a class="btn-link" href="insights.html">All insights <svg class="ico"><use href="#i-arrow"/></svg></a></div>
  </div>
</section>
```

- [ ] **Step 5: Check**

Run:
```bash
node tmp_check.js index.html --expect "#work .case,#how .step,#insights .insight" --shots
node -e "
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});
await p.addInitScript(()=>sessionStorage.setItem('dayamSplash','1'));
await p.goto('http://localhost:8090/index.html',{waitUntil:'networkidle'});
await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await p.waitForTimeout(600);
console.log('rail p', await p.\$eval('#how',e=>e.style.getPropertyValue('--p')), 'step4 live', await p.\$eval('#how .step:last-child',e=>e.classList.contains('live')), 'bp drawn', await p.\$eval('#work .bp .draw',e=>parseFloat(getComputedStyle(e).strokeDashoffset)===0));
await b.close()})()"
```
Expected: `ALL OK`; `rail p 1.0000 step4 live true bp drawn true`. In the 1440 screenshot, case tiles alternate copy/diagram sides; at 390 they stack and the rail becomes a vertical line on the left.

- [ ] **Step 6: Taste pass**

Invoke `/taste:taste` on `#work`, `#how`, `#insights`: tile vertical padding, stat trio sizing under the h3, the rail scrub window, insight row hover.

- [ ] **Step 7: Commit**

```bash
git add index.html assets/css/components.css && git commit -m "Add engagements, the engagement rail and insights to the homepage

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 16: Homepage — #faq, #close (Frame 07), #contact, form fallback, schema

**Files:**
- Modify: `index.html` (replace `<!-- §faq -->`, `<!-- §close -->`, `<!-- §contact -->`; insert schema in `<head>`)
- Modify: `assets/js/site.js` (append form fallback)
- Modify: `assets/css/components.css` (append contact layout)

- [ ] **Step 1: Append the contact layout CSS**

Append to `assets/css/components.css`:

```css
.contact .grid{align-items:start}
.contact-copy{display:grid;gap:var(--sp-3);justify-items:start}
.faq-sec .faq{max-width:820px}
```

- [ ] **Step 2: Append the form fallback to site.js**

Append to `assets/js/site.js`, immediately before the line `measure();` near the end:

```js
  /* ---------- 10. contact form — GA4 lead event; WhatsApp prefill while the endpoint is a placeholder ---------- */
  document.querySelectorAll('form.form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (typeof window.gtag === 'function') window.gtag('event', 'generate_lead', { method: 'form' });
      var action = form.getAttribute('action') || '';
      if (action.indexOf('FORM_ENDPOINT') === -1) return; /* real endpoint: let it post */
      e.preventDefault();
      var d = new FormData(form);
      var text = 'Hi Dayam Insights, I am ' + (d.get('name') || '') + ' from ' + (d.get('business') || '') + '. ' +
        (d.get('message') || '') + ' You can reach me on ' + (d.get('phone') || '') + '.';
      window.open('https://wa.me/917877640693?text=' + encodeURIComponent(text), '_blank', 'noopener');
    });
  });
```

- [ ] **Step 3: Replace `<!-- §faq -->`**

The visible answers are the FAQPage schema answers verbatim; keep the two in sync.

```html
<!-- FAQ -->
<section class="faq-sec sec" id="faq" aria-labelledby="h-faq">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="eyebrow"><i></i>Questions</span>
      <h2 id="h-faq">Before you get in touch.</h2>
    </div>
    <div class="faq reveal">
      <details><summary>What does this cost?<i class="plus"></i></summary><p>It depends on how many systems have to talk to each other. We quote a fixed price before any work starts, so there is no meter running. If your budget and the scope do not meet, we will tell you on the first call.</p></details>
      <details><summary>How long before I see something working?<i class="plus"></i></summary><p>Most first projects are live in four to six weeks. We start with the single process costing you the most time, so you get something working before committing to anything larger.</p></details>
      <details><summary>Do I have to stop using Excel?<i class="plus"></i></summary><p>No. Most of our work connects the tools you already use rather than replacing them. Your team can keep entering data the way they do today; it just stops needing to be re-typed into three other places.</p></details>
      <details><summary>My data is a mess. Some of it is on paper.<i class="plus"></i></summary><p>That is the normal starting point. Part of the first phase is getting what exists into one place and agreeing what each number means. You do not need to tidy anything up before talking to us.</p></details>
      <details><summary>Do I need someone technical on my team?<i class="plus"></i></summary><p>No. Everything we build is meant to be run by the people already doing the job. We hand over written instructions in plain language and train whoever will be using it.</p></details>
      <details><summary>What happens after it is built? Am I locked in?<i class="plus"></i></summary><p>Everything runs in accounts you own and you keep the logins. If you stop working with us, the dashboards and automations keep running.</p></details>
      <details><summary>Do you work with businesses outside your city?<i class="plus"></i></summary><p>Yes. We work with businesses across India, and most of the work happens remotely. What we build is cloud-based, so where you are matters far less than what your process looks like. We visit where a visit genuinely helps.</p></details>
      <details><summary>Do you provide ongoing support?<i class="plus"></i></summary><p>Yes, if you want it. We hand over written instructions in plain language and train whoever will be using the system, so most clients need us less than they expect to. Where you do want us on call, we agree what that covers and what it costs while we are scoping the work, not after it. Everything runs in accounts you own either way, so nothing stops working if you decide not to continue.</p></details>
      <details><summary>What if I am not sure what I need?<i class="plus"></i></summary><p>That is the usual case. Describe the part of the week that frustrates you most and we will tell you whether it is worth automating, including when the honest answer is that it is not.</p></details>
      <details><summary>Can you connect to the software we already use?<i class="plus"></i></summary><p>Usually, yes. The goal is normally to improve the systems you already have rather than move you onto something completely new. Where a tool offers an export, an API or a database connection, we can work with it; where it offers none of those, we will tell you what the workaround costs before you commit.</p></details>
      <details><summary>Can you work with our ERP or CRM?<i class="plus"></i></summary><p>Yes, where a suitable integration or data connection is available. Send us the name of the system on the first call and we will confirm what is possible with it before quoting.</p></details>
      <details><summary>What size businesses do you work with?<i class="plus"></i></summary><p>Growing businesses where manual processes, reporting or disconnected systems have started to become a bottleneck: past the point where one person can hold everything in their head, but not yet running a full in-house technology team.</p></details>
      <details><summary>How long does an automation project take?<i class="plus"></i></summary><p>It depends on how many systems have to talk to each other and how clean the data is. A single workflow is usually far quicker than a connected set of them. We scope the first piece so you see something working early, and give you a date for that piece before work starts.</p></details>
    </div>
  </div>
</section>
```

- [ ] **Step 4: Replace `<!-- §close -->`**

```html
<!-- CLOSE — Frame 07 -->
<section class="close stmt navy" id="close" aria-labelledby="h-close">
  <svg class="pulse-net" viewBox="0 0 1440 480" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <g class="edges">
      <line class="pe" x1="120" y1="120" x2="300" y2="60"/><line class="pe" x1="120" y1="120" x2="420" y2="220"/><line class="pe" x1="300" y1="60" x2="600" y2="140"/><line class="pe" x1="420" y1="220" x2="600" y2="140"/><line class="pe" x1="600" y1="140" x2="760" y2="80"/><line class="pe" x1="600" y1="140" x2="880" y2="260"/><line class="pe" x1="760" y1="80" x2="1040" y2="120"/><line class="pe" x1="880" y1="260" x2="1040" y2="120"/><line class="pe" x1="1040" y1="120" x2="1180" y2="40"/><line class="pe" x1="1040" y1="120" x2="1320" y2="200"/><line class="pe" x1="1180" y1="40" x2="1320" y2="200"/><line class="pe" x1="120" y1="120" x2="200" y2="340"/><line class="pe" x1="420" y1="220" x2="200" y2="340"/><line class="pe" x1="420" y1="220" x2="520" y2="380"/><line class="pe" x1="880" y1="260" x2="520" y2="380"/><line class="pe" x1="880" y1="260" x2="720" y2="300"/><line class="pe" x1="720" y1="300" x2="960" y2="400"/><line class="pe" x1="1320" y1="200" x2="960" y2="400"/><line class="pe" x1="1320" y1="200" x2="1240" y2="360"/><line class="pe" x1="960" y1="400" x2="1240" y2="360"/><line class="pe" x1="520" y1="380" x2="960" y2="400"/>
    </g>
    <g class="pn"><rect class="rip" x="113" y="113" width="14" height="14"/><rect class="core" x="115" y="115" width="10" height="10"/></g>
    <g class="pn"><rect class="rip" x="293" y="53" width="14" height="14"/><rect class="core" x="295" y="55" width="10" height="10"/></g>
    <g class="pn"><rect class="rip" x="413" y="213" width="14" height="14"/><rect class="core" x="415" y="215" width="10" height="10"/></g>
    <g class="pn"><rect class="rip" x="593" y="133" width="14" height="14"/><rect class="core" x="595" y="135" width="10" height="10"/></g>
    <g class="pn"><rect class="rip" x="753" y="73" width="14" height="14"/><rect class="core" x="755" y="75" width="10" height="10"/></g>
    <g class="pn"><rect class="rip" x="873" y="253" width="14" height="14"/><rect class="core" x="875" y="255" width="10" height="10"/></g>
    <g class="pn"><rect class="rip" x="1033" y="113" width="14" height="14"/><rect class="core" x="1035" y="115" width="10" height="10"/></g>
    <g class="pn"><rect class="rip" x="1173" y="33" width="14" height="14"/><rect class="core" x="1175" y="35" width="10" height="10"/></g>
    <g class="pn"><rect class="rip" x="1313" y="193" width="14" height="14"/><rect class="core" x="1315" y="195" width="10" height="10"/></g>
    <g class="pn"><rect class="rip" x="193" y="333" width="14" height="14"/><rect class="core" x="195" y="335" width="10" height="10"/></g>
    <g class="pn"><rect class="rip" x="513" y="373" width="14" height="14"/><rect class="core" x="515" y="375" width="10" height="10"/></g>
    <g class="pn"><rect class="rip" x="713" y="293" width="14" height="14"/><rect class="core" x="715" y="295" width="10" height="10"/></g>
    <g class="pn"><rect class="rip" x="953" y="393" width="14" height="14"/><rect class="core" x="955" y="395" width="10" height="10"/></g>
    <g class="pn"><rect class="rip" x="1233" y="353" width="14" height="14"/><rect class="core" x="1235" y="355" width="10" height="10"/></g>
  </svg>
  <div class="wrap stmt-in">
    <p class="display reveal" id="h-close">Intelligence.<br>Engineered.</p>
    <p class="lead reveal" style="--i:1">One working system at a time. Tell us where the week gets stuck.</p>
    <a class="btn btn-on-navy reveal" style="--i:2" href="#contact">Book a systems review</a>
  </div>
</section>
```

- [ ] **Step 5: Replace `<!-- §contact -->`**

```html
<!-- CONTACT -->
<section class="contact sec" id="contact" aria-labelledby="h-contact">
  <div class="wrap grid">
    <div class="c-5 contact-copy reveal">
      <span class="eyebrow"><i></i>Contact</span>
      <h2 id="h-contact">Tell us where the week gets stuck.</h2>
      <p class="lead">Describe the part of the week that frustrates you most. We will tell you whether it is worth automating — including when the honest answer is that it is not.</p>
      <a class="btn-link" href="https://wa.me/917877640693?text=Hi%20Dayam%20Insights%2C%20I%27d%20like%20to%20talk%20about%20automating%20my%20business." target="_blank" rel="noopener"><svg class="ico"><use href="#i-whatsapp"/></svg> Prefer WhatsApp? Let's talk</a>
    </div>
    <form class="c-7 form reveal" style="--i:1" action="FORM_ENDPOINT" method="POST" id="contactForm">
      <div class="row">
        <label class="field"><span>Your name</span><input type="text" name="name" required autocomplete="name"></label>
        <label class="field"><span>Business name</span><input type="text" name="business" required autocomplete="organization"></label>
      </div>
      <div class="row">
        <label class="field"><span>Phone or WhatsApp</span><input type="tel" name="phone" required autocomplete="tel" inputmode="tel"></label>
        <label class="field"><span>Email <em>(optional)</em></span><input type="email" name="email" autocomplete="email"></label>
      </div>
      <label class="field"><span>What takes the most time right now?</span><textarea name="message" rows="3" required placeholder="e.g. we re-type every order into three different sheets"></textarea></label>
      <div class="actions">
        <button type="submit" class="btn btn-primary">Show me what to fix <svg class="ico"><use href="#i-arrow"/></svg></button>
      </div>
      <p class="note">We reply within one working day. No sales pitch, no obligation, and we don't add you to a mailing list.</p>
    </form>
  </div>
</section>
```

- [ ] **Step 6: Insert the schema in `<head>`**

Replace `<!-- Task 16 inserts the JSON-LD schema block here -->` with:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ProfessionalService",
      "@id": "https://dayaminsights.com/#org",
      "name": "Dayam Insights",
      "url": "https://dayaminsights.com/",
      "description": "Dayam Insights builds intelligent business systems for growing companies: one source of truth for their data, automation that removes routine work, AI assistants grounded in their own records, and websites wired into the same system. We work around the tools a business already uses.",
      "slogan": "Data · Automation · AI · Websites",
      "email": "dayaminsights@gmail.com",
      "telephone": "+91-78776-40693",
      "logo": "https://dayaminsights.com/og-image.png",
      "image": "https://dayaminsights.com/og-image.png",
      "areaServed": { "@type": "Country", "name": "India" },
      "knowsAbout": [
        "Business intelligence",
        "Data integration",
        "Workflow automation",
        "Power BI",
        "SQL",
        "Python",
        "REST API integration",
        "AI assistants grounded in business data",
        "Order to invoice processing",
        "Inventory and stock reporting",
        "Conversion-focused web development"
      ],
      "audience": {
        "@type": "BusinessAudience",
        "description": "Growing Indian businesses — retail and multi-store, distribution and wholesale, manufacturing, e-commerce, clinics and professional services — past the point where one person can hold every process in their head, but not yet running an in-house technology team."
      },
      "serviceType": [
        "Business intelligence dashboards",
        "Power BI dashboard development",
        "Management and KPI reporting automation",
        "Workflow automation",
        "Order to invoice automation",
        "System and data integration",
        "AI assistants for business",
        "Document processing automation",
        "Website design and development",
        "Conversion-focused landing pages"
      ]
    },
    {
      "@type": "FAQPage",
      "@id": "https://dayaminsights.com/#faq",
      "mainEntity": [
        { "@type": "Question", "name": "What does this cost?", "acceptedAnswer": { "@type": "Answer", "text": "It depends on how many systems have to talk to each other. We quote a fixed price before any work starts, so there is no meter running. If your budget and the scope do not meet, we will tell you on the first call." } },
        { "@type": "Question", "name": "How long before I see something working?", "acceptedAnswer": { "@type": "Answer", "text": "Most first projects are live in four to six weeks. We start with the single process costing you the most time, so you get something working before committing to anything larger." } },
        { "@type": "Question", "name": "Do I have to stop using Excel?", "acceptedAnswer": { "@type": "Answer", "text": "No. Most of our work connects the tools you already use rather than replacing them. Your team can keep entering data the way they do today; it just stops needing to be re-typed into three other places." } },
        { "@type": "Question", "name": "My data is a mess. Some of it is on paper.", "acceptedAnswer": { "@type": "Answer", "text": "That is the normal starting point. Part of the first phase is getting what exists into one place and agreeing what each number means. You do not need to tidy anything up before talking to us." } },
        { "@type": "Question", "name": "Do I need someone technical on my team?", "acceptedAnswer": { "@type": "Answer", "text": "No. Everything we build is meant to be run by the people already doing the job. We hand over written instructions in plain language and train whoever will be using it." } },
        { "@type": "Question", "name": "What happens after it is built? Am I locked in?", "acceptedAnswer": { "@type": "Answer", "text": "Everything runs in accounts you own and you keep the logins. If you stop working with us, the dashboards and automations keep running." } },
        { "@type": "Question", "name": "Do you work with businesses outside your city?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. We work with businesses across India, and most of the work happens remotely. What we build is cloud-based, so where you are matters far less than what your process looks like. We visit where a visit genuinely helps." } },
        { "@type": "Question", "name": "Do you provide ongoing support?", "acceptedAnswer": { "@type": "Answer", "text": "Yes, if you want it. We hand over written instructions in plain language and train whoever will be using the system, so most clients need us less than they expect to. Where you do want us on call, we agree what that covers and what it costs while we are scoping the work, not after it. Everything runs in accounts you own either way, so nothing stops working if you decide not to continue." } },
        { "@type": "Question", "name": "What if I am not sure what I need?", "acceptedAnswer": { "@type": "Answer", "text": "That is the usual case. Describe the part of the week that frustrates you most and we will tell you whether it is worth automating, including when the honest answer is that it is not." } },
        { "@type": "Question", "name": "Can you connect to the software we already use?", "acceptedAnswer": { "@type": "Answer", "text": "Usually, yes. The goal is normally to improve the systems you already have rather than move you onto something completely new. Where a tool offers an export, an API or a database connection, we can work with it; where it offers none of those, we will tell you what the workaround costs before you commit." } },
        { "@type": "Question", "name": "Can you work with our ERP or CRM?", "acceptedAnswer": { "@type": "Answer", "text": "Yes, where a suitable integration or data connection is available. Send us the name of the system on the first call and we will confirm what is possible with it before quoting." } },
        { "@type": "Question", "name": "What size businesses do you work with?", "acceptedAnswer": { "@type": "Answer", "text": "Growing businesses where manual processes, reporting or disconnected systems have started to become a bottleneck: past the point where one person can hold everything in their head, but not yet running a full in-house technology team." } },
        { "@type": "Question", "name": "How long does an automation project take?", "acceptedAnswer": { "@type": "Answer", "text": "It depends on how many systems have to talk to each other and how clean the data is. A single workflow is usually far quicker than a connected set of them. We scope the first piece so you see something working early, and give you a date for that piece before work starts." } }
      ]
    }
  ]
}
</script>
```

- [ ] **Step 7: Check structure, schema and the form fallback**

Run:
```bash
node tmp_check.js index.html --expect "#faq details,#close .display,#close .pulse-net,#contact form,.footer" --shots
node -e "
const fs=require('fs');const h=fs.readFileSync('index.html','utf8');
const count=(re)=>(h.match(re)||[]).length;
console.log('section open/close', count(/<section\b/g), count(/<\/section>/g));
console.log('div open/close', count(/<div\b/g), count(/<\/div>/g));
console.log('svg open/close', count(/<svg\b/g), count(/<\/svg>/g));
console.log('faq visible', count(/<details>/g), 'faq schema', count(/\"@type\": \"Question\"/g));
console.log('markers left', count(/<!-- §/g));
const ld=h.match(/<script type=\"application\/ld\+json\">([\s\S]*?)<\/script>/)[1];JSON.parse(ld);console.log('schema parses');"
node -e "
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});
await p.addInitScript(()=>sessionStorage.setItem('dayamSplash','1'));
await p.goto('http://localhost:8090/index.html',{waitUntil:'networkidle'});
const popup=p.waitForEvent('popup',{timeout:4000}).then(pg=>pg.url()).catch(()=>'no popup');
await p.fill('#contactForm [name=name]','Test');await p.fill('#contactForm [name=business]','Co');await p.fill('#contactForm [name=phone]','9999');await p.fill('#contactForm [name=message]','orders retyped');
await p.click('#contactForm button[type=submit]');console.log('fallback →', (await popup).slice(0,60));
await b.close()})()"
```
Expected: `ALL OK`; equal open/close counts for section, div and svg; `faq visible 13 faq schema 13`; `markers left 0`; `schema parses`; `fallback → https://wa.me/917877640693?text=Hi%20Dayam%20Insights…`.

- [ ] **Step 8: Taste pass**

Invoke `/taste:taste` on `#faq`, `#close` and `#contact`: the display line break, pulse-network density behind the statement, contact copy-to-form ratio, FAQ summary size.

- [ ] **Step 9: Commit**

```bash
git add index.html assets/js/site.js assets/css/components.css && git commit -m "Finish the homepage: FAQ, closing statement, contact and schema

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 17: Stub pages and the contact page

**Files:**
- Create: `services.html`, `case-studies.html`, `insights.html`, `about.html` (stubs, `noindex`)
- Create: `contact.html` (real, indexable)
- Modify: `assets/css/components.css` (append `.stub`)

- [ ] **Step 1: Append the stub CSS**

Append to `assets/css/components.css`:

```css
.stub{padding-top:calc(var(--nav-h) + var(--sp-9));padding-bottom:var(--sp-9);min-height:70vh}
.stub .stub-in{display:grid;gap:var(--sp-3);justify-items:start}
.contact-page{padding-top:calc(var(--nav-h) + var(--sp-8))}
```

- [ ] **Step 2: Create the four stubs**

Each stub uses this exact template. Fill `{{…}}` per the table below; set `aria-current="page"` on the matching link in **both** the `.nav-links` block and the `.menu` block of the pasted nav.

```html
<!DOCTYPE html>
<html lang="en" class="no-js">
<head>
<!-- paste docs/partials/head.html with TITLE / DESCRIPTION / CANONICAL from the table -->
<meta name="robots" content="noindex,follow">
</head>
<body>
<!-- paste docs/partials/icons.html -->
<!-- paste docs/partials/nav.html — add aria-current="page" to this page's link in .nav-links and .menu -->
<main id="main">
  <section class="stub igrid" aria-labelledby="h-page">
    <div class="wrap stub-in">
      <span class="eyebrow"><i></i>{{EYEBROW}}</span>
      <h1 id="h-page">{{HEADING}}</h1>
      <p class="lead">{{LEAD}}</p>
      <div class="btn-row">
        <a class="btn btn-primary" href="{{PRIMARY_HREF}}">{{PRIMARY_TEXT}}</a>
        <a class="btn-link" href="contact.html">Talk to us <svg class="ico"><use href="#i-arrow"/></svg></a>
      </div>
    </div>
  </section>
</main>
<!-- paste docs/partials/footer.html -->
</body>
</html>
```

| File | TITLE | DESCRIPTION | CANONICAL | EYEBROW | HEADING | LEAD | PRIMARY_HREF / TEXT |
|---|---|---|---|---|---|---|---|
| `services.html` | `Services — Data, Automation, AI, Websites \| Dayam Insights` | `The four layers Dayam Insights builds: data, automation, AI and websites, as one connected system.` | `https://dayaminsights.com/services.html` | Services | Four layers. One system. | The full services page is in progress. The four layers — Data, Automation, AI and Websites — are described on the homepage today, in the order we usually build them. | `index.html#system` / See the four layers |
| `case-studies.html` | `Case Studies \| Dayam Insights` | `Engagements by Dayam Insights: the business problem, the system built, and what changed.` | `https://dayaminsights.com/case-studies.html` | Case studies | The problem, the system, what changed. | Named case studies are published as clients agree to be named. Three illustrative engagements — retail, distribution and professional services — are on the homepage today. | `index.html#work` / See the engagements |
| `insights.html` | `Insights \| Dayam Insights` | `Notes from the Dayam Insights systems desk on data, automation and AI for growing businesses.` | `https://dayaminsights.com/insights.html` | Insights | Notes from the systems desk. | The first pieces are being written. Until they are published, the questions we answer most often are in the FAQ on the homepage. | `index.html#faq` / Read the FAQ |
| `about.html` | `About \| Dayam Insights` | `Who Dayam Insights is and how an engagement runs.` | `https://dayaminsights.com/about.html` | About | Built around the tools you already use. | The full page is in progress. How an engagement runs — discover, prioritise, build, improve — is on the homepage today. | `index.html#how` / See how an engagement runs |

- [ ] **Step 3: Create the contact page**

Create `contact.html`. `aria-current="page"` goes on nothing in `.nav-links` (Contact is the CTA, not a link) — leave the nav as pasted.

```html
<!DOCTYPE html>
<html lang="en" class="no-js">
<head>
<!-- paste docs/partials/head.html with:
     TITLE       = Contact — Book a systems review | Dayam Insights
     DESCRIPTION = Tell Dayam Insights where the week gets stuck. We reply within one working day with whether it is worth automating.
     CANONICAL   = https://dayaminsights.com/contact.html -->
</head>
<body>
<!-- paste docs/partials/icons.html -->
<!-- paste docs/partials/nav.html -->
<main id="main">
  <section class="contact contact-page sec igrid" id="contact" aria-labelledby="h-contact">
    <div class="wrap grid">
      <div class="c-5 contact-copy reveal">
        <span class="eyebrow"><i></i>Contact</span>
        <h1 id="h-contact" class="h2">Tell us where the week gets stuck.</h1>
        <p class="lead">Describe the part of the week that frustrates you most. We will tell you whether it is worth automating — including when the honest answer is that it is not.</p>
        <a class="btn-link" href="https://wa.me/917877640693?text=Hi%20Dayam%20Insights%2C%20I%27d%20like%20to%20talk%20about%20automating%20my%20business." target="_blank" rel="noopener"><svg class="ico"><use href="#i-whatsapp"/></svg> Prefer WhatsApp? Let's talk</a>
        <a class="btn-link" href="mailto:dayaminsights@gmail.com"><svg class="ico"><use href="#i-mail"/></svg> dayaminsights@gmail.com</a>
      </div>
      <form class="c-7 form reveal" style="--i:1" action="FORM_ENDPOINT" method="POST" id="contactForm">
        <div class="row">
          <label class="field"><span>Your name</span><input type="text" name="name" required autocomplete="name"></label>
          <label class="field"><span>Business name</span><input type="text" name="business" required autocomplete="organization"></label>
        </div>
        <div class="row">
          <label class="field"><span>Phone or WhatsApp</span><input type="tel" name="phone" required autocomplete="tel" inputmode="tel"></label>
          <label class="field"><span>Email <em>(optional)</em></span><input type="email" name="email" autocomplete="email"></label>
        </div>
        <label class="field"><span>What takes the most time right now?</span><textarea name="message" rows="3" required placeholder="e.g. we re-type every order into three different sheets"></textarea></label>
        <div class="actions">
          <button type="submit" class="btn btn-primary">Show me what to fix <svg class="ico"><use href="#i-arrow"/></svg></button>
        </div>
        <p class="note">We reply within one working day. No sales pitch, no obligation, and we don't add you to a mailing list.</p>
      </form>
    </div>
  </section>
</main>
<!-- paste docs/partials/footer.html -->
</body>
</html>
```

- [ ] **Step 4: Check every page and every internal link**

Run:
```bash
for f in services.html case-studies.html insights.html about.html; do node tmp_check.js $f --expect ".nav,.stub h1,.footer" || exit 1; done
node tmp_check.js contact.html --expect ".nav,#contact form,.footer" --shots
node -e "
const fs=require('fs');const pages=['index.html','services.html','case-studies.html','insights.html','about.html','contact.html','styleguide.html'];
let bad=0;for(const pg of pages){const h=fs.readFileSync(pg,'utf8');const links=[...h.matchAll(/href=\"([^\"#:]+)(#[^\"]*)?\"/g)].map(m=>m[1]);
for(const l of new Set(links)){if(!fs.existsSync(l)){console.log('MISSING',pg,'→',l);bad++}}}
console.log(bad?bad+' missing':'all internal hrefs resolve');
for(const pg of pages.slice(1,5)){const h=fs.readFileSync(pg,'utf8');console.log(pg,'aria-current count',(h.match(/aria-current=\"page\"/g)||[]).length)}"
```
Expected: every check `ALL OK`; `all internal hrefs resolve`; each stub reports `aria-current count 2`.

- [ ] **Step 5: Commit**

```bash
git add services.html case-studies.html insights.html about.html contact.html assets/css/components.css && git commit -m "Add the contact page and stubs for services, case studies, insights and about

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 18: Verification pass, notes, sitemap

**Files:**
- Modify: `PROJECT_NOTES.md` (replace contents)
- Modify: `sitemap.xml`
- Create: `tmp_axe.js` (temporary; delete after)

- [ ] **Step 1: Full checker run on every page, both motion modes**

Run:
```bash
for f in index.html styleguide.html contact.html services.html case-studies.html insights.html about.html; do node tmp_check.js $f --shots || exit 1; node tmp_check.js $f --rm || exit 1; done
node tmp_check.js index.html --splash
```
Expected: every run ends `ALL OK`. Open the four `tmp_index_html_*.png` files and confirm: no clipped diagrams, no orphaned single words in the h1 at 390, footer columns stack cleanly, the mesh is fully drawn at the bottom of the page.

- [ ] **Step 2: axe-core accessibility run**

Run:
```bash
npm install --no-save axe-core
```
Create `tmp_axe.js`:
```js
const { chromium } = require('playwright'); const fs = require('fs');
const axe = fs.readFileSync(require.resolve('axe-core'), 'utf8');
(async () => {
  const b = await chromium.launch(); let total = 0;
  for (const pg of ['index.html', 'contact.html', 'services.html', 'styleguide.html']) {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    await p.addInitScript(() => sessionStorage.setItem('dayamSplash', '1'));
    await p.goto('http://localhost:8090/' + pg, { waitUntil: 'networkidle' });
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(800);
    await p.addScriptTag({ content: axe });
    const r = await p.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }));
    console.log(pg, 'violations:', r.violations.length);
    for (const v of r.violations) { total++; console.log('  ', v.id, '-', v.help, '-', v.nodes.length, 'node(s):', v.nodes[0].target[0]); }
    await p.close();
  }
  await b.close(); process.exit(total ? 1 : 0);
})();
```
Run `node tmp_axe.js`. Expected: `violations: 0` for each page. Fix anything reported (typical: a decorative SVG missing `aria-hidden`, a link with only an icon) and re-run until clean. Then `rm tmp_axe.js`.

- [ ] **Step 3: Lighthouse**

Run:
```bash
npx --yes lighthouse http://localhost:8090/ --preset=desktop --quiet --chrome-flags="--headless=new" --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=tmp_lh.json && node -e "const r=require('./tmp_lh.json').categories;for(const k in r)console.log(k,Math.round(r[k].score*100))"
```
Expected: performance ≥ 95, accessibility ≥ 95, best-practices ≥ 95, seo ≥ 95. If `npx lighthouse` cannot find Chrome, set `CHROME_PATH` to the Playwright Chromium binary printed by `node -e "console.log(require('playwright').chromium.executablePath())"` and re-run. If a score is below target, the report's `audits` section names the cause; fix and re-run. `rm tmp_lh.json` when done (it is not gitignored).

- [ ] **Step 4: Page weight**

Run:
```bash
node -e "const fs=require('fs');let t=0;for(const f of ['index.html','assets/css/tokens.css','assets/css/base.css','assets/css/components.css','assets/css/graphics.css','assets/js/site.js']){const s=fs.statSync(f).size;t+=s;console.log(f,(s/1024).toFixed(1)+'KB')}console.log('total',(t/1024).toFixed(1)+'KB')"
```
Expected: total under 250KB.

- [ ] **Step 5: Rewrite PROJECT_NOTES.md**

Replace the contents of `PROJECT_NOTES.md` with:

```markdown
# Dayam Insights — Site Notes

Static multi-page site, no build step, GitHub Pages. Rebuilt 2026-09 around the logo-derived executive visual system. Spec: `docs/superpowers/specs/2026-09-16-executive-system-foundation-homepage-design.md`. Plan: `docs/superpowers/plans/2026-09-16-executive-system-foundation-homepage.md`. The previous single-page site is archived at `docs/archive/index-2026-09-rust.html`.

## Files
- Pages: `index.html` (homepage), `contact.html` (real), `services.html` / `case-studies.html` / `insights.html` / `about.html` (stubs, `noindex`, replaced by sub-projects 3–6), `styleguide.html` (living design system, `noindex`, linked from the footer).
- CSS, loaded in this order: `assets/css/tokens.css` (`:root` only) → `base.css` (reset, type, `.wrap`/`.grid`, motion verb pre-states) → `components.css` (nav, footer, every component, homepage section layout) → `graphics.css` (the six SVG systems).
- JS: `assets/js/site.js`, deferred. One rAF scroll bus; every observer lives here.
- Partials: `docs/partials/head.html`, `nav.html`, `footer.html`, `icons.html`, `splash.html` are the canonical copies pasted into each page. **Edit the partial, then re-paste into every page** — there is no include mechanism. Each non-home page sets `aria-current="page"` on its own link in both `.nav-links` and `.menu`.
- Logo: `assets/svg/mark.svg`, `wordmark.svg`, `lockup.svg`; `favicon.svg`. Inline copies of the mark in nav/footer use `currentColor` for navy and `.sig` for the blue square.

## Design system (see styleguide.html)
- Colour: navy `#07162D`, blue `#1E7BFF`, bg `#F8FAFC`, surface `#FFF`, line `#E5EAF2`, muted `#64748B` (14px+ only), ink-2 `#334155` (labels). 80 navy / 15 white / 5 blue. One blue element per composition.
- Type: Inter 400/500/600/700/800. `--fs-display` 56→96, `--fs-h1` 44→72, `--fs-h2` 36→52, `--fs-h3` 24→30, lead 18→22, body 17, small 14, label 11 caps .14em.
- Space: 8px base, `--sp-1..12`. Section padding `--sec` = 96 / 128 / 160. Grid 12 col, 24px gap, 1440 max, gutters 24 / 40 / 64. Breakpoints 640 / 900 / 1200.
- Shape: radius 0 by default; 2px; full only for D-derived arcs. No resting shadow; `--lift` on hover.
- Rules: nodes are squares; flat-left / round-right; left→right story direction; hairlines not shadows; no gradients, no people photography.

## Motion (four verbs, all in base.css / graphics.css)
- **Reveal** `.reveal` (+ `--i` stagger) and `.reveal-group`; observer adds `.in` once at 15%.
- **Draw** `.draw` on SVG elements with `pathLength="1"`; triggered by an `.in` ancestor.
- **Travel** `.tr` square on an inline `offset-path`; runs only while its `[data-run]` ancestor has `.run`.
- **Scrub** `[data-scrub]` receives `--p` 0→1 (smoothstep) from its own scroll travel; `data-scrub-start` (fraction of viewport height where p=0, default .75) and `data-scrub-len` (fraction of section height over which p reaches 1, default 1). `[data-steps=".sel"]` marks children `.done` / `.live` from `--p`. Sections dispatch a `scrub` event with `detail = p`.
- All pre-states are scoped under `html.js` (the head script flips `no-js`→`js`), so no-JS renders the finished frame. `prefers-reduced-motion` kills every transition/animation, pins `--p` to 1, hides travellers and ripples, skips the splash. **Any new pre-state needs a reduced-motion override**, especially on pseudo-elements and SVG children.
- Splash: `#splash` (homepage only). Head script adds `html.no-splash` when `sessionStorage.dayamSplash` is set or reduced motion is on, so it never paints on repeat visits. site.js FLIP-morphs the mark into the nav slot after 1400ms and removes the overlay.

## Graphics (graphics.css; canonical markup lives in styleguide.html)
1 Intelligence Mesh `svg.mesh` (scrubbed; `.on` lights the hub past p=.92) · 2 Data Flow `svg.flow` (hero) · 3 Automation Loop `svg.loop` · 4 System Blueprint `svg.bp` (case tiles; pattern ids must be unique per page: `bpg-a/b/c`) · 5 Signal Pulse Network `svg.pulse-net` (site.js cycles `.pn.on` every 2.4s while visible) · 6 Intelligence Grid `.igrid` / `.igrid.on-navy` (CSS background); `.bp-lines` adds 64px blueprint lines in the hero.

## Homepage sections (top to bottom)
`#splash` → `#hero` (7/5, data flow) → `.proof` (four facts) → `#signal` (mesh, scrubbed) → `#system` (spine modules `#data #automation #ai #websites`, scrubbed + stepped) → `#work` (three illustrative case tiles) → `#how` (rail, scrubbed + stepped) → `#insights` (three rows → `insights.html`) → `#faq` (13 `<details>`, mirrored in FAQPage schema) → `#close` (navy statement, pulse network) → `#contact` (form) → footer.

## Content status
- Case tiles and insight rows are illustrative / working titles. Named case studies replace the tiles as clients agree; insight articles ship with sub-project 5.
- Contact form `action="FORM_ENDPOINT"` is deliberate: site.js opens WhatsApp with the message prefilled until a real endpoint exists. Replacing the action is the only change needed.

## Verification
`node tmp_serve.js` (port 8090) + `node tmp_check.js <page> [--rm] [--splash] [--shots] [--expect a,b]` — visibility, horizontal overflow at 390/768/1280/1440, console errors, screenshots. Both files are gitignored; their source is in the plan (Task 0). Preview without the server by opening any page directly in a browser.

## Conventions
- Copy: headlines executive and precise; body plain and concrete, numbers over adjectives. No "leverage / empower / unlock / seamless".
- After a structural edit, verify tag balance (`<section>`, `<div>`, `<svg>` open/close counts) and that no `<!-- § -->` markers remain.
- New graphics: square nodes, navy hairlines, exactly one blue element, `pathLength="1"` on anything that draws, `aria-hidden` unless the diagram carries a `<title>`.
```

- [ ] **Step 6: Update the sitemap**

Replace `sitemap.xml` with (stubs are `noindex`, so only the two real pages are listed):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://dayaminsights.com/</loc>
    <lastmod>2026-09-16</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://dayaminsights.com/contact.html</loc>
    <lastmod>2026-09-16</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

Set `<lastmod>` to the actual ship date if it differs.

- [ ] **Step 7: Confirm the working tree is clean of temp files**

Run:
```bash
git status --short
```
Expected: only `M PROJECT_NOTES.md`, `M sitemap.xml` and the untouched `?? docs/superpowers/plans/2026-06-15-agency-pipeline-mvp.md`. If `tmp_lh.json`, `tmp_axe.js` or `tmp_probe.html` appear, delete them.

- [ ] **Step 8: Commit**

```bash
git add PROJECT_NOTES.md sitemap.xml && git commit -m "Document the executive system and update the sitemap

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 19: Review and merge

- [ ] **Step 1: Request review**

Invoke `superpowers:requesting-code-review` against `executive-system` vs `main`. Address findings; re-run `node tmp_check.js index.html --shots` and `node tmp_check.js index.html --rm` after any fix.

- [ ] **Step 2: Finish the branch**

Invoke `superpowers:finishing-a-development-branch`. Recommended outcome: merge `executive-system` into `main` with a merge commit (the branch history is the design record), then delete the branch. GitHub Pages deploys from `main`; check https://dayaminsights.com/ within a few minutes for the new homepage, the splash on first load, and no splash on reload.

- [ ] **Step 3: Record follow-ups**

Open the next brainstorm for sub-project 3 (Services page) with these carried-over notes: the horizontal rail variant of the services modules is the Services page hero; the Automation Loop and Data Flow graphics are canonical in `styleguide.html`; `og-image.png` still shows the old brand and needs regenerating (1200×630, navy lockup on `#F8FAFC`, tag-line beneath).

---

## Self-review against the spec

| Spec section | Task |
|---|---|
| §2 decisions (port meta/schema/GA4/FAQ/form, register, illustrative content, static pages, splash once/session) | 5 (head partial, GA4), 13, 16, 17 |
| §3 DNA and rules | 4 (mark), 8 (primitives), 12 (rules section) |
| §4 file architecture | 1, 2, 3, 5, 17 |
| §5 tokens (colour, type clamps, spacing, grid, radius, motion) | 2, 3 |
| §6 components (nav, footer, buttons, eyebrow, section head, module, case, insight, stat, statement, form, FAQ, tag, diagram) | 5, 7, 11 |
| §7 graphics 1–6, logo assets, icons, dividers | 4, 8, 9, 10 — dividers: the `.band` hairlines and `.hairline` rule in base.css cover the full-bleed hairline; the `.divider.d` half-D variant is not used by any homepage section and is deferred to the Services page (YAGNI) |
| §8 homepage sections 0–10 | 13, 14, 15, 16 |
| §9 motion verbs, hover, reduced motion, no-JS | 3, 6, 8, 12 |
| §10 responsive table | 3 (grid), 7/11/13/15 (per-component breakpoints) |
| §11 accessibility and performance | 18 |
| §12 styleguide | 5, 7, 8, 9, 10, 11, 12 |
| §13 build order | matches task order |
| §15 risks — FLIP after fonts, offset-path fallback, font swap | 12 (`document.fonts.ready`), 8 (`@supports` fallback), font `display=swap` in the head partial; `size-adjust` on a fallback face is deferred unless Lighthouse reports CLS > 0 in Task 18 |

Placeholders: the only `{{…}}` slots are the head partial's three fields and the stub template's fields, each filled by a table in the same task. Type consistency: `--p`, `.live`/`.done`, `.in`, `.run`, `.draw`, `.tr`, `.pn`, `.mn`/`.me`, `data-scrub-start`/`data-scrub-len`/`data-steps` are used with the same names in site.js (Task 6), graphics.css (Tasks 8–10), components.css (Tasks 11, 15) and the page markup (Tasks 13–16).
