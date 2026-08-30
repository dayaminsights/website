# Visual System Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `index.html` from the dark-navy visual system to the light-ground design system in `docs/superpowers/specs/2026-08-30-design-system-design.md`, and fix the technical P0 findings from the audit — without changing any copy or section order.

**Architecture:** `index.html` is a single self-contained file: one inline `<style>` block (lines 43–595) and one inline `<script>` (lines 1277–1554). The migration works top-down through the stylesheet: swap the `:root` token block first so every downstream rule inherits new values, then fix the rules that hardcode colours or reference removed tokens, then delete the decoration layer, then rebuild the four mockups for a light ground. HTML changes are limited to `<head>` metadata, removing decorative elements, and adding landmarks. No copy changes, no section reordering — those are Plan 2.

**Tech Stack:** HTML5, CSS custom properties (inline), vanilla JS (inline), Google Fonts, GA4. Verification via a Node static server plus Playwright for computed-style assertions and screenshots at 1440px and 390px. No build step, no framework.

**Scope boundary:** This plan is presentation and technical only. It delivers audit findings P0-6 (hero pin), P0-7 (analytics, OG image, contrast), P0-8 (focus states), P1-2 (delete animation), P1-7 (scroll perf), P1-8 (type and radius scale), plus the full colour and elevation migration. It explicitly does **not** touch the hero copy, section order, services naming, `#results` framing, founder block, mobile nav, contact form or FAQ — those are Plan 2 (`2026-08-30-content-ia-conversion.md`).

**Reference:** The design system spec is the source of truth for every value. Where this plan and the spec disagree, the spec wins and this plan is wrong.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `index.html` | The entire site — `<head>` meta, inline `<style>`, markup, inline `<script>` | Modify throughout |
| `og-image.png` | 1200×630 social preview card | Create (Task 9) |
| `robots.txt` | Crawler directives + sitemap pointer | Create (Task 9) |
| `sitemap.xml` | Single-URL sitemap | Create (Task 9) |
| `tmp_serve.js` | Static server on :8090 for verification | Create, temporary, gitignored |
| `tmp_check.js` | Playwright assertions + screenshots | Create, temporary, gitignored |

`.gitignore` already covers `tmp_serve.js`, `tmp_check.js`, `tmp_*.png` and `node_modules/`. No change needed.

**Task order is a dependency chain.** Task 1 (tokens) must land before Tasks 2–8, because those tasks assume the new token names exist. Tasks 9–11 are independent of each other but all assume Task 1.

---

## Task 0: Verification harness

**Files:**
- Create: `tmp_serve.js` (temporary)
- Create: `tmp_check.js` (temporary)

- [ ] **Step 1: Install Playwright locally**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && npm install --no-save playwright@1.49.1 && npx playwright install chromium
```
Expected: npm completes, then `npx playwright install chromium` reports a downloaded browser (or "is already installed").

- [ ] **Step 2: Write the static server**

Create `tmp_serve.js`:

```js
const http=require('http'),fs=require('fs'),path=require('path');
http.createServer((req,res)=>{
  let p = req.url==='/'?'/index.html':req.url.split('?')[0];
  let fp = path.join(__dirname, decodeURIComponent(p));
  fs.readFile(fp,(err,data)=>{
    if(err){res.writeHead(404);res.end('not found');return;}
    let ext=path.extname(fp);
    let types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.svg':'image/svg+xml','.xml':'application/xml','.txt':'text/plain'};
    res.writeHead(200,{'Content-Type':types[ext]||'text/plain'});
    res.end(data);
  });
}).listen(8090,()=>console.log('listening'));
```

- [ ] **Step 3: Start it and confirm it serves**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_serve.js > /tmp/serve.log 2>&1 & sleep 1; curl -sf http://localhost:8090/index.html -o /dev/null && echo OK
```
Expected: `OK`

- [ ] **Step 4: Write the check script**

Create `tmp_check.js`. This is the full harness used by every later task — later tasks read specific lines of its output.

```js
const { chromium } = require('playwright');

// Relative luminance + contrast ratio, per WCAG 2.1
function lum(rgb){
  const c = rgb.map(v=>{
    v = v/255;
    return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
  });
  return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2];
}
function ratio(fg,bg){
  const a = lum(fg), b = lum(bg);
  const hi = Math.max(a,b), lo = Math.min(a,b);
  return (hi+0.05)/(lo+0.05);
}
function parse(s){
  const m = s.match(/\d+(\.\d+)?/g);
  return m ? [ +m[0], +m[1], +m[2] ] : [0,0,0];
}

(async () => {
  const browser = await chromium.launch();
  const errs = [];
  const out = {};

  // ---------- desktop ----------
  let ctx = await browser.newContext({ viewport:{width:1440,height:900} });
  let page = await ctx.newPage();
  page.on('pageerror', e=>errs.push('desktop:'+e.message));
  page.on('console', m=>{ if(m.type()==='error') errs.push('desktop:'+m.text()); });
  await page.goto('http://localhost:8090/index.html',{waitUntil:'networkidle'});

  out.tokens = await page.evaluate(()=>{
    const s = getComputedStyle(document.documentElement);
    const names = ['--bg','--bg-2','--surface','--surface-sunken','--panel','--panel-2',
                   '--line','--line-strong','--ink','--ink-2','--muted','--muted-2',
                   '--on-panel','--on-panel-muted','--accent','--accent-hover',
                   '--accent-on-panel','--good','--warn','--focus','--focus-invert'];
    const o = {};
    names.forEach(n=>o[n]=s.getPropertyValue(n).trim());
    return o;
  });

  out.bodyBg = await page.evaluate(()=>getComputedStyle(document.body).backgroundColor);
  out.bodyColor = await page.evaluate(()=>getComputedStyle(document.body).color);
  out.fonts = await page.evaluate(()=>({
    body: getComputedStyle(document.body).fontFamily,
    h1: document.querySelector('h1') ? getComputedStyle(document.querySelector('h1')).fontFamily : 'none'
  }));

  // decoration must be gone
  out.decoration = await page.evaluate(()=>({
    gridLines: document.querySelectorAll('.grid-lines').length,
    glowChips: document.querySelectorAll('.glow-chip').length,
    glowOrbs:  document.querySelectorAll('.glow-orb').length,
    pathLayer: document.querySelectorAll('.scroll-path-layer').length,
    bgField:   document.querySelectorAll('.bg-field').length
  }));

  // no blur / backdrop-filter anywhere
  out.blurCount = await page.evaluate(()=>{
    let n = 0;
    document.querySelectorAll('*').forEach(el=>{
      const s = getComputedStyle(el);
      if ((s.filter && s.filter.includes('blur')) ||
          (s.backdropFilter && s.backdropFilter !== 'none')) n++;
    });
    return n;
  });

  // infinite animations
  out.infiniteAnims = await page.evaluate(()=>{
    let n = 0;
    document.querySelectorAll('*').forEach(el=>{
      const s = getComputedStyle(el);
      if (s.animationIterationCount && s.animationIterationCount.split(',').some(v=>v.trim()==='infinite')) n++;
      ['::before','::after'].forEach(p=>{
        const ps = getComputedStyle(el,p);
        if (ps.animationIterationCount && ps.animationIterationCount.split(',').some(v=>v.trim()==='infinite')) n++;
      });
    });
    return n;
  });

  // landmarks + a11y
  out.a11y = await page.evaluate(()=>({
    main: document.querySelectorAll('main').length,
    skipLink: !!document.querySelector('a[href="#main"], a.skip-link'),
    sectionsLabelled: Array.from(document.querySelectorAll('section')).filter(s=>s.hasAttribute('aria-labelledby')).length,
    sectionsTotal: document.querySelectorAll('section').length,
    bareSvgs: Array.from(document.querySelectorAll('svg')).filter(s=>!s.hasAttribute('aria-hidden') && !s.closest('[aria-hidden]')).length
  }));

  // focus ring on the primary button
  const btn = await page.$('.btn-primary');
  if (btn) {
    await btn.focus();
    out.focusOutline = await page.evaluate(()=>{
      const s = getComputedStyle(document.activeElement);
      return { width:s.outlineWidth, style:s.outlineStyle, color:s.outlineColor };
    });
  }

  // hero morph stage height
  out.heroStageHeight = await page.evaluate(()=>{
    const el = document.querySelector('.hero-morph-stage');
    return el ? getComputedStyle(el).height : 'none';
  });

  // sentinel count
  out.sentinels = await page.evaluate(()=>document.querySelectorAll('[data-sentinel]').length);

  // contrast probes: element selector -> [fg, bg]
  out.contrast = await page.evaluate(()=>{
    const probes = {
      'body':               ['body','body'],
      'muted-2 sample':     ['.hero-meta .m span','body'],
      'section intro':      ['.section-head p','body']
    };
    const r = {};
    for (const [k,[fgSel,bgSel]] of Object.entries(probes)){
      const fg = document.querySelector(fgSel), bg = document.querySelector(bgSel);
      if (!fg || !bg) { r[k] = null; continue; }
      r[k] = { fg:getComputedStyle(fg).color, bg:getComputedStyle(bg).backgroundColor };
    }
    return r;
  });

  await page.screenshot({path:'tmp_desktop.png', fullPage:false});
  await page.screenshot({path:'tmp_desktop_full.png', fullPage:true});
  await ctx.close();

  // ---------- mobile ----------
  ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
  page = await ctx.newPage();
  page.on('pageerror', e=>errs.push('mobile:'+e.message));
  page.on('console', m=>{ if(m.type()==='error') errs.push('mobile:'+m.text()); });
  await page.goto('http://localhost:8090/index.html',{waitUntil:'networkidle'});

  out.mobile = await page.evaluate(()=>({
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    heroGrid: getComputedStyle(document.querySelector('.hero-grid')).gridTemplateColumns
  }));

  await page.screenshot({path:'tmp_mobile.png', fullPage:false});
  await ctx.close();

  await browser.close();

  // ---------- report ----------
  for (const [k,v] of Object.entries(out.contrast)){
    if (v) out.contrast[k] = { ...v, ratio:+ratio(parse(v.fg), parse(v.bg)).toFixed(2) };
  }
  console.log(JSON.stringify({ ...out, consoleErrors:errs }, null, 2));
})();
```

- [ ] **Step 5: Baseline run — capture the current state before any change**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```

Expected (current, pre-migration state — record these numbers, they are what the plan moves):
- `tokens["--bg"]` is `#070b16`
- `decoration.gridLines` is `1`, `glowChips` is `7`, `glowOrbs` is `8`, `pathLayer` is `1`
- `blurCount` is greater than `10`
- `infiniteAnims` is greater than `10`
- `a11y.main` is `0`, `a11y.skipLink` is `false`
- `heroStageHeight` is roughly `2430px` (270vh at 900px viewport)
- `consoleErrors` is `[]`

No commit — these files are gitignored.

---

## Task 1: Swap the token layer

This is the foundation. Every later task assumes these names exist.

**Files:**
- Modify: `index.html:44-64` (the `:root` block)

- [ ] **Step 1: Replace the `:root` block**

Find ([index.html:44-64](../../../index.html#L44-L64)):

```css
:root{
  --bg:#070b16;
  --bg-2:#0a0f1f;
  --surface:#0e1426;
  --surface-2:#121a30;
  --line:rgba(148,163,184,.14);
  --line-strong:rgba(148,163,184,.26);
  --text:#eef2fb;
  --muted:#9aa6c2;
  --muted-2:#6b7794;
  --accent:#4f7dff;
  --accent-2:#8b5cf6;
  --accent-3:#22d3ee;
  --good:#34d399;
  --warn:#fbbf24;
  --radius:16px;
  --radius-lg:24px;
  --maxw:1180px;
  --ease:cubic-bezier(.22,.61,.36,1);
  --shadow:0 24px 60px -24px rgba(2,6,20,.85);
}
```

Replace with:

```css
:root{
  color-scheme:light;

  /* ground */
  --bg:#FFFFFF;
  --bg-2:#F7F7F5;
  --surface:#FFFFFF;
  --surface-sunken:#F2F2EF;
  --panel:#111315;
  --panel-2:#1B1E21;

  /* lines */
  --line:#E4E4E0;
  --line-strong:#C9C9C3;
  --line-invert:rgba(247,247,245,.14);

  /* ink */
  --ink:#111315;
  --ink-2:#3A3E44;
  --muted:#555B63;
  --muted-2:#6E747C;

  /* on inverted panel */
  --on-panel:#F7F7F5;
  --on-panel-muted:#9BA0A6;

  /* accent — rust */
  --accent:#A94F26;
  --accent-hover:#8E4120;
  --accent-soft:rgba(169,79,38,.08);
  --accent-line:rgba(169,79,38,.30);
  --accent-on-panel:#D7855C;

  /* semantic */
  --good:#1F6B4A;
  --warn:#8A5A0B;
  --good-invert:#5FBF8F;
  --warn-invert:#D9AE3F;

  /* focus */
  --focus:#1B4B8F;
  --focus-invert:#8FB8FF;

  /* type */
  --font-ui:'Instrument Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --font-body:'Source Serif 4','Iowan Old Style',Georgia,serif;
  --font-mono:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;

  --fs-h1:clamp(34px,5vw,60px);
  --fs-h2:clamp(28px,3.6vw,40px);
  --fs-h3:clamp(20px,2.4vw,24px);
  --fs-h4:clamp(18px,2vw,19px);
  --fs-body:clamp(16px,1.2vw,17px);
  --fs-small:15px;
  --fs-micro:13px;
  --fs-label:11px;

  /* space */
  --sp-1:4px;
  --sp-2:8px;
  --sp-3:12px;
  --sp-4:16px;
  --sp-5:24px;
  --sp-6:32px;
  --sp-7:48px;
  --sp-8:64px;
  --sp-9:96px;
  --sp-10:128px;

  /* layout */
  --maxw:1180px;
  --maxw-text:680px;
  --maxw-narrow:520px;

  /* radius */
  --r-sm:6px;
  --r-md:12px;
  --r-lg:20px;
  --r-pill:999px;

  /* elevation */
  --shadow-sm:0 1px 2px rgba(17,19,21,.06);
  --shadow-md:0 1px 2px rgba(17,19,21,.06),0 12px 28px -16px rgba(17,19,21,.18);

  /* motion */
  --t-fast:120ms;
  --t-base:240ms;
  --t-reveal:450ms;
  --t-data:800ms;
  --ease-out:cubic-bezier(.22,1,.36,1);
  --ease:cubic-bezier(.4,0,.2,1);
}

/* Back-compat shims — removed in Task 8 once every reference is migrated.
   These keep the page rendering while the stylesheet is converted rule by rule. */
:root{
  --text:var(--ink);
  --surface-2:var(--surface-sunken);
  --accent-2:var(--accent);
  --accent-3:var(--accent);
  --radius:var(--r-md);
  --radius-lg:var(--r-lg);
  --shadow:var(--shadow-md);
}
```

The shim block is deliberate: it lets the page keep working between Task 1 and Task 8 instead of rendering broken for six tasks. Task 8 deletes it and proves no rule still depends on it.

- [ ] **Step 2: Update `body` for a light ground**

Find ([index.html:67-74](../../../index.html#L67-L74)):

```css
body{
  background:var(--bg);
  color:var(--text);
  font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
  line-height:1.6;
  -webkit-font-smoothing:antialiased;
  overflow-x:hidden;
}
```

Replace with:

```css
body{
  background:var(--bg);
  color:var(--ink);
  font-family:var(--font-body);
  font-size:var(--fs-body);
  line-height:1.6;
  overflow-x:hidden;
}
```

`-webkit-font-smoothing:antialiased` is removed: it is correct for light text on dark and thins the strokes when reversed. `overflow-x:hidden` stays for now — Task 7 removes it after fixing the underlying full-bleed overflow.

- [ ] **Step 3: Run the harness**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```
Expected:
- `tokens["--bg"]` is `#FFFFFF`
- `tokens["--accent"]` is `#A94F26`
- `tokens["--muted-2"]` is `#6E747C`
- `bodyBg` is `rgb(255, 255, 255)`
- `consoleErrors` is `[]`

The page will look wrong at this point — many rules still hardcode dark-ground colours. That is expected and Tasks 2–8 fix it.

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Swap token layer to the light-ground design system

Replaces the dark-navy :root block with the v2 token set: white ground,
near-black ink, rust accent, and the full type, space, radius, elevation
and motion scales.

Temporary back-compat shims map the old token names onto the new ones so
the page keeps rendering while the stylesheet is converted rule by rule.
Task 8 deletes them.

Removes -webkit-font-smoothing:antialiased, which is correct for light
text on dark and thins strokes when reversed.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Load the new typefaces and apply the scale

**Files:**
- Modify: `index.html:40-42` (font `<link>`s)
- Modify: `index.html:76` (`.mono`)
- Modify: `index.html:123-129` (`.eyebrow`, `.section-head`, `h2.title`, `.pad`)

- [ ] **Step 1: Replace the Google Fonts link**

Find ([index.html:40-42](../../../index.html#L40-L42)):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

Replace with:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Point `.mono` at the new mono family and add a UI-font rule**

Find ([index.html:76](../../../index.html#L76)):

```css
.mono{font-family:'JetBrains Mono',ui-monospace,monospace}
```

Replace with:

```css
.mono{font-family:var(--font-mono);font-variant-numeric:tabular-nums}
h1,h2,h3,h4,h5,.btn,.eyebrow,.nav-links a,.brand,th,label,button{font-family:var(--font-ui)}
```

- [ ] **Step 3: Apply the type scale to the section scaffolding**

Find ([index.html:123-129](../../../index.html#L123-L129)):

```css
.eyebrow{display:inline-flex;align-items:center;gap:9px;font-size:12.5px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:var(--accent-3);padding:7px 14px;border:1px solid var(--line);border-radius:999px;background:rgba(34,211,238,.05)}
.eyebrow .dot{width:6px;height:6px;border-radius:50%;background:var(--accent-3);box-shadow:0 0 10px var(--accent-3)}
.section-head{max-width:660px}
.section-head.center{margin:0 auto;text-align:center}
h2.title{font-size:clamp(28px,4vw,44px);font-weight:700;letter-spacing:-.025em;line-height:1.12;margin:18px 0 14px}
.section-head p{color:var(--muted);font-size:17px}
.pad{padding:clamp(56px,7vw,96px) 0}
```

Replace with:

```css
.eyebrow{display:inline-flex;align-items:center;gap:var(--sp-2);font-family:var(--font-mono);font-size:var(--fs-label);font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);padding:7px 14px;border:1px solid var(--accent-line);border-radius:var(--r-pill);background:var(--accent-soft)}
.eyebrow .dot{width:6px;height:6px;border-radius:50%;background:var(--accent)}
.section-head{max-width:var(--maxw-text)}
.section-head.center{margin:0 auto;text-align:center}
h2.title{font-size:var(--fs-h2);font-weight:600;letter-spacing:-.022em;line-height:1.10;margin:var(--sp-4) 0 var(--sp-3);text-wrap:balance}
.section-head p{color:var(--muted);font-size:var(--fs-body);text-wrap:pretty}
.pad{padding:clamp(64px,8vw,96px) 0}
```

The eyebrow dot loses its `box-shadow` glow — glows do not exist on a white ground. `h2` drops from 700 to 600 per spec §3.1.

- [ ] **Step 4: Run the harness**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```
Expected:
- `fonts.body` contains `Source Serif 4`
- `fonts.h1` contains `Instrument Sans`
- `consoleErrors` is `[]`

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Load Instrument Sans, Source Serif 4 and IBM Plex Mono

Replaces Inter + JetBrains Mono, the most-used pairing in AI-generated
interfaces and the audit's strongest template signal. The serif is scoped
to running prose; the sans carries all UI text.

Applies the type scale to the section scaffolding and drops the glow from
the eyebrow dot.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Delete the decoration layer

Removes eight glow orbs, seven glow chips, the scroll-path layer, the grid overlay and the ambient background field — plus every infinite animation that drove them.

**Files:**
- Modify: `index.html:81-95` (`.bg-field`, `.grid-lines`)
- Modify: `index.html:175-205` (`.hero-glow`, `.glow-chip`, `.scroll-path-layer`, `.path-chip`)
- Modify: `index.html:209-211` (`.hero-visual .glow-orb`, `@keyframes float`)
- Modify: `index.html:223-229` (service-card float)
- Modify: `index.html:258-265` (`riseLine`/`riseDot`)
- Modify: `index.html:292` (`.web-visual .glow-orb`)
- Modify: `index.html:598-610` (decorative markup)
- Modify: `index.html:641-651` (`.hero-glow` markup)

- [ ] **Step 1: Delete the ambient background CSS**

Find ([index.html:80-95](../../../index.html#L80-L95)):

```css
/* ===== Ambient background ===== */
.bg-field{position:fixed;inset:0;z-index:-2;pointer-events:none;overflow:hidden}
.bg-field::before{
  content:"";position:absolute;inset:0;
  background:
    radial-gradient(60% 50% at 18% 8%, rgba(79,125,255,.16), transparent 60%),
    radial-gradient(50% 50% at 85% 0%, rgba(139,92,246,.13), transparent 60%),
    radial-gradient(45% 45% at 50% 100%, rgba(34,211,238,.08), transparent 60%);
}
.grid-lines{position:fixed;inset:0;z-index:-1;pointer-events:none;
  background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);
  background-size:64px 64px;
  -webkit-mask-image:radial-gradient(circle at 50% 0%,#000,transparent 75%);
  mask-image:radial-gradient(circle at 50% 0%,#000,transparent 75%);
  opacity:.5;
}
```

Delete the entire block, including the `/* ===== Ambient background ===== */` comment.

- [ ] **Step 2: Delete the hero glow and scroll-path CSS**

Delete [index.html:175-205](../../../index.html#L175-L205) in full — from the comment `/* Floating glow chips around the centered STATE_A headline; fade out as the morph proceeds */` through the line `@media(max-width:1240px),(prefers-reduced-motion:reduce){.scroll-path-layer{display:none}}`.

That removes: `.hero-glow`, `.hero-glow .glow-orb`, `.hero-glow .glow-orb.ga`, `.hero-glow .glow-orb.gb`, `.glow-chip`, `.path-chip`, their `::before` gradient-border rules, `.glow-chip.c1` through `.c7`, `.glow-chip.mini`, `.scroll-path-layer`, `.scroll-path-layer svg`, `.scroll-path-layer path`, `.path-chip.pc2`, `.path-chip.pc3` and both reduced-motion overrides.

- [ ] **Step 3: Delete the hero-visual orbs and the `float` keyframe**

Find ([index.html:209-211](../../../index.html#L209-L211)):

```css
.hero-visual .glow-orb{position:absolute;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(79,125,255,.35),transparent 70%);filter:blur(50px);top:-60px;right:-50px;animation:float 9s ease-in-out infinite;pointer-events:none;z-index:0}
.hero-visual .glow-orb.b{background:radial-gradient(circle,rgba(139,92,246,.3),transparent 70%);top:auto;bottom:-70px;left:-50px;right:auto;animation-duration:11s;animation-delay:-3s}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(18px)}}
```

Delete all three lines.

- [ ] **Step 4: Delete the service-card float loop**

Find ([index.html:223-230](../../../index.html#L223-L230)):

```css
.hero-visual.in .card-reveal .service-card{animation:cardFloat 7s ease-in-out infinite}
.hero-visual.in .card-reveal:nth-child(3) .service-card{animation-delay:0s}
.hero-visual.in .card-reveal:nth-child(4) .service-card{animation-delay:-1.6s}
.hero-visual.in .card-reveal:nth-child(5) .service-card{animation-delay:-3.2s}
.hero-visual.in .card-reveal:nth-child(6) .service-card{animation-delay:-4.8s}
.hero-visual.in .card-reveal:nth-child(7) .service-card{animation-delay:-6.4s}
@keyframes cardFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@media(prefers-reduced-motion:reduce){.hero-visual.in .card-reveal .service-card{animation:none}}
```

Delete all eight lines.

- [ ] **Step 5: Delete the trend-arrow wiggle**

Find ([index.html:258-265](../../../index.html#L258-L265)):

```css
.service-card .s-grow .s-grow-trend .rise-line{animation:riseLine 3s ease-in-out infinite}
.service-card .s-grow .s-grow-trend .rise-dot{animation:riseDot 3s ease-in-out infinite}
@keyframes riseLine{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
@keyframes riseDot{0%,100%{transform:translate(0,0)}50%{transform:translate(1px,-2px)}}
@media(prefers-reduced-motion:reduce){
  .service-card .s-grow .s-grow-trend .rise-line,
  .service-card .s-grow .s-grow-trend .rise-dot{animation:none}
}
```

Delete all seven lines. `riseLine` is referenced by three other rules — Step 6 removes those too.

- [ ] **Step 6: Remove the remaining `riseLine` references and the web-visual orb**

Find and delete these four individual lines, which are now referencing a deleted keyframe:

[index.html:292](../../../index.html#L292):
```css
.web-visual .glow-orb{position:absolute;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(34,211,238,.22),transparent 70%);filter:blur(60px);top:-60px;right:-60px;pointer-events:none;z-index:0;animation:float 10s ease-in-out infinite}
```

[index.html:356](../../../index.html#L356):
```css
.web-visual.in .sm-rise svg{animation:riseLine 3s ease-in-out 1.6s infinite}
```

[index.html:443](../../../index.html#L443):
```css
.web-visual.in .fl-arrow svg{animation:riseLine 2.4s ease-in-out infinite}
```

In [index.html:358-361](../../../index.html#L358-L361), find:
```css
@media(prefers-reduced-motion:reduce){
  .web-visual.in .bm-live,
  .web-visual.in .sm-rise svg{animation:none}
}
```
Replace with:
```css
@media(prefers-reduced-motion:reduce){
  .web-visual.in .bm-live{animation:none}
}
```

In [index.html:448-451](../../../index.html#L448-L451), find:
```css
@media(prefers-reduced-motion:reduce){
  .web-visual.in .fl-arrow svg,
  .web-visual.in .flow-pulse::before{animation:none}
}
```
Replace with:
```css
@media(prefers-reduced-motion:reduce){
  .web-visual.in .flow-pulse::before{animation:none}
}
```

- [ ] **Step 7: Delete the decorative markup**

Find ([index.html:598-610](../../../index.html#L598-L610)):

```html
<div class="bg-field"></div>
<div class="grid-lines"></div>
<div class="scroll-progress" aria-hidden="true"><i id="scrollBar"></i></div>

<!-- Decorative scroll path: glow chips drift down the right margin as the page scrolls -->
<div class="scroll-path-layer" aria-hidden="true">
  <svg id="scrollPathSvg" viewBox="0 0 100 100" preserveAspectRatio="none">
    <path id="scrollPath" d="M92,0 C100,12 84,26 91,40 C98,54 85,68 92,82 C97,91 90,96 92,100" fill="none"/>
  </svg>
  <span class="path-chip pc1"><svg viewBox="0 0 24 24" fill="none"><path class="rise-line" d="M2 16l6-5 5 3 7-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle class="rise-dot" cx="20" cy="5" r="2" fill="currentColor"/></svg></span>
  <span class="path-chip pc2"><svg viewBox="0 0 24 24" fill="none"><path d="M3 11l8-7 8 7M5 10v9h4v-5h6v5h4v-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 3l6 2.4v3.2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
  <span class="path-chip pc3 mini"></span>
</div>
```

Replace with (keeping only the scroll progress bar, which the spec keeps):

```html
<div class="scroll-progress" aria-hidden="true"><i id="scrollBar"></i></div>
```

- [ ] **Step 8: Delete the hero-glow markup**

Find ([index.html:641-651](../../../index.html#L641-L651)) — the `<div class="hero-glow" id="heroGlow" aria-hidden="true">` element and all nine `<span>` children inside it, through its closing `</div>`. Delete the entire element.

- [ ] **Step 9: Delete the two `glow-orb` divs in the hero visual**

Find (inside `<div class="hero-visual" id="heroVisual">`, [index.html:671-672](../../../index.html#L671-L672)):

```html
    <div class="glow-orb"></div>
    <div class="glow-orb b"></div>
```

Delete both lines.

- [ ] **Step 10: Delete the four `glow-orb` divs in the showcase visuals**

Delete each of these four lines wherever they appear inside a `.web-visual`:

```html
      <div class="glow-orb"></div>
```
```html
      <div class="glow-orb b"></div>
```

There are four in total — one in `#webVisual`, one in `#marketingVisual`, one in `#dashVisual`, one in `#autoVisual`. Verify with `grep -c 'class="glow-orb' index.html`, which must return `0` afterwards.

- [ ] **Step 11: Remove the orphaned JS references**

In the inline script, find ([index.html:1293](../../../index.html#L1293)):
```js
  var heroGlow = heroSection ? heroSection.querySelector('.hero-glow') : null;
```
Replace with:
```js
  var heroGlow = null;
```

Find ([index.html:1411](../../../index.html#L1411)):
```js
  var orbs = document.querySelectorAll('.glow-orb');
```
Replace with:
```js
  var orbs = [];
```

Find ([index.html:1416-1419](../../../index.html#L1416-L1419)):
```js
  var scrollPath = document.getElementById('scrollPath');
  var pathChips = document.querySelectorAll('.path-chip');
  var pathChipOffsets = [0, -0.08, -0.16];
  var pathLength = scrollPath ? scrollPath.getTotalLength() : 0;
```
Replace with:
```js
  var scrollPath = null;
  var pathChips = [];
  var pathChipOffsets = [];
  var pathLength = 0;
```

These are deliberately nulled rather than deleted so `onFrame()` and `applyHeroMorph()` keep their existing guard clauses and stay valid. Task 6 rewrites `onFrame()` and removes the dead code entirely.

- [ ] **Step 12: Run the harness**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```
Expected:
- `decoration.gridLines` is `0`
- `decoration.glowChips` is `0`
- `decoration.glowOrbs` is `0`
- `decoration.pathLayer` is `0`
- `decoration.bgField` is `0`
- `blurCount` is `1` (only the sticky nav's `backdrop-filter`, removed in Task 5)
- `consoleErrors` is `[]`

- [ ] **Step 13: Verify no dangling references**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && for s in glow-orb glow-chip path-chip scroll-path grid-lines bg-field hero-glow riseLine riseDot cardFloat; do printf '%-14s %s\n' "$s" "$(grep -c "$s" index.html)"; done
```
Expected: every count is `0` except `hero-glow`, which is `1` (the nulled JS variable name `heroGlow` does not match the hyphenated string, so this should also be `0` — if it is `1`, an HTML reference survived and must be removed).

- [ ] **Step 14: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Delete the decoration layer

Removes eight blurred glow orbs, seven floating glow chips, the
scroll-path layer, the 64px grid overlay and the ambient radial-gradient
background, plus every infinite keyframe that drove them: float,
cardFloat, riseLine and riseDot.

None of these carried information, all of them were dark-ground effects
with no equivalent on white, and together they were the page's entire
mobile GPU budget: eight large blur filters and ten backdrop-filter
compositing layers.

JS references are nulled rather than deleted so the existing guard
clauses in onFrame() and applyHeroMorph() stay valid; Task 6 rewrites
that loop and removes the dead code.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Convert cards, buttons and surfaces to the light system

**Files:**
- Modify: `index.html` — `.btn*` (112–120), `.service-card` (221–256), `.prob` (455–468), `.proc` (471–479), `.res` (482–489), `.tech-item` (492–497), `.why` (500–506), `.cta-band` (509–514)

- [ ] **Step 1: Rewrite the buttons**

Find ([index.html:112-120](../../../index.html#L112-L120)):

```css
.btn{display:inline-flex;align-items:center;gap:9px;font-weight:600;font-size:14.5px;border-radius:11px;padding:11px 18px;cursor:pointer;border:1px solid transparent;transition:transform .18s var(--ease),box-shadow .25s var(--ease),background .25s,border-color .25s;white-space:nowrap}
.btn:active{transform:translateY(1px)}
.btn-primary{background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;box-shadow:0 10px 30px -10px rgba(79,125,255,.8)}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 16px 40px -12px rgba(79,125,255,.9)}
.btn-ghost{background:rgba(255,255,255,.03);border-color:var(--line-strong);color:var(--text)}
.btn-ghost:hover{background:rgba(255,255,255,.07);border-color:var(--line-strong);transform:translateY(-2px)}
.btn .arrow{transition:transform .2s var(--ease)}
.btn:hover .arrow{transform:translateX(3px)}
.nav-toggle{display:none;background:none;border:1px solid var(--line-strong);border-radius:10px;width:42px;height:42px;color:var(--text);cursor:pointer}
```

Replace with:

```css
.btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--sp-2);font-family:var(--font-ui);font-weight:600;font-size:var(--fs-small);border-radius:var(--r-md);padding:13px 22px;min-height:44px;cursor:pointer;border:1px solid transparent;white-space:nowrap;text-decoration:none;transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease),transform var(--t-fast) var(--ease)}
.btn:active{transform:translateY(1px)}
.btn-primary{background:var(--ink);color:var(--bg)}
.btn-primary:hover{background:#000;transform:translateY(-2px)}
.btn-ghost{background:var(--bg);border-color:var(--line-strong);color:var(--ink)}
.btn-ghost:hover{background:var(--bg-2);border-color:var(--ink);transform:translateY(-2px)}
.btn .arrow{transition:transform var(--t-fast) var(--ease)}
.btn:hover .arrow{transform:translateX(3px)}
.nav-toggle{display:none;background:none;border:1px solid var(--line-strong);border-radius:var(--r-md);width:44px;height:44px;color:var(--ink);cursor:pointer}
```

Primary is now black on white at 18.6 : 1, per spec §8.1. `.nav-toggle` goes 42px → 44px, meeting the touch-target floor.

- [ ] **Step 2: Rewrite the service cards**

Find ([index.html:221-222](../../../index.html#L221-L222)):

```css
.service-card{position:relative;z-index:1;display:flex;flex-direction:column;align-items:flex-start;gap:14px;height:100%;border:1px solid var(--line-strong);border-radius:var(--radius);padding:22px;background:linear-gradient(165deg,rgba(18,26,48,.92),rgba(10,15,31,.92));box-shadow:var(--shadow);transition:transform .35s var(--ease),border-color .35s,background .35s}
.service-card:hover{transform:translateY(-4px);border-color:var(--accent-3)}
```

Replace with:

```css
.service-card{position:relative;z-index:1;display:flex;flex-direction:column;align-items:flex-start;gap:var(--sp-3);height:100%;border:1px solid var(--line);border-radius:var(--r-md);padding:var(--sp-5);background:var(--surface);transition:transform var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease)}
a.service-card:hover{transform:translateY(-2px);border-color:var(--line-strong)}
```

The hover selector narrows from `.service-card` to `a.service-card` — the "AI Assistants" card is a `<div>`, not a link, and must not lift.

- [ ] **Step 3: Rewrite the service-card internals**

Find ([index.html:232-245](../../../index.html#L232-L245)) and replace the icon and text rules:

```css
.service-card .s-icon{flex:0 0 auto;width:48px;height:48px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(135deg,rgba(79,125,255,.18),rgba(139,92,246,.14));border:1px solid var(--line-strong)}
.service-card .s-icon svg{width:24px;height:24px;color:var(--accent-3)}
```
becomes:
```css
.service-card .s-icon{flex:0 0 auto;width:48px;height:48px;border-radius:var(--r-md);display:grid;place-items:center;background:var(--accent-soft);border:1px solid var(--accent-line)}
.service-card .s-icon svg{width:22px;height:22px;color:var(--accent)}
```

```css
.service-card .s-text h3{font-size:17px;font-weight:700;letter-spacing:-.01em;margin-bottom:5px}
.service-card .s-text p{font-size:13.5px;color:var(--muted);line-height:1.45}
```
becomes:
```css
.service-card .s-text h3{font-size:var(--fs-h4);font-weight:600;letter-spacing:-.005em;margin-bottom:var(--sp-1)}
.service-card .s-text p{font-family:var(--font-ui);font-size:var(--fs-small);color:var(--muted);line-height:1.5}
```

Then update the four accent-badge rules ([index.html:238-245](../../../index.html#L238-L245)):

```css
.service-card .s-mini i{display:block;width:6px;border-radius:3px;background:linear-gradient(180deg,var(--accent-3),var(--accent));opacity:.85}
.service-card .s-check{margin-top:auto;flex:0 0 auto;width:30px;height:30px;border-radius:50%;background:rgba(52,211,153,.14);border:1px solid rgba(52,211,153,.35);display:grid;place-items:center}
.service-card .s-check svg{width:15px;height:15px;color:var(--good)}
.service-card .s-pulse{margin-top:auto;flex:0 0 auto;width:30px;height:30px;border-radius:50%;background:rgba(79,125,255,.14);border:1px solid var(--line-strong);position:relative;display:grid;place-items:center}
```
becomes:
```css
.service-card .s-mini i{display:block;width:6px;border-radius:3px;background:var(--accent);opacity:.85}
.service-card .s-check{margin-top:auto;flex:0 0 auto;width:30px;height:30px;border-radius:50%;background:rgba(31,107,74,.1);border:1px solid rgba(31,107,74,.3);display:grid;place-items:center}
.service-card .s-check svg{width:15px;height:15px;color:var(--good)}
.service-card .s-pulse{margin-top:auto;flex:0 0 auto;width:30px;height:30px;border-radius:50%;background:var(--accent-soft);border:1px solid var(--accent-line);position:relative;display:grid;place-items:center}
```

And ([index.html:243-245](../../../index.html#L243-L245)):
```css
.service-card .s-pulse svg{width:14px;height:14px;color:var(--accent-3);position:relative}
.service-card .s-arrow-up{margin-top:auto;flex:0 0 auto;width:30px;height:30px;border-radius:50%;background:rgba(34,211,238,.14);border:1px solid rgba(34,211,238,.35);display:grid;place-items:center}
.service-card .s-arrow-up svg{width:14px;height:14px;color:var(--accent-3)}
```
becomes:
```css
.service-card .s-pulse svg{width:14px;height:14px;color:var(--accent);position:relative}
.service-card .s-arrow-up{margin-top:auto;flex:0 0 auto;width:30px;height:30px;border-radius:50%;background:var(--accent-soft);border:1px solid var(--accent-line);display:grid;place-items:center}
.service-card .s-arrow-up svg{width:14px;height:14px;color:var(--accent)}
```

Finally ([index.html:254-257](../../../index.html#L254-L257)) — the `.s-grow` icon colours:
```css
  .service-card .s-grow .s-grow-doc{width:18px;height:18px;color:var(--muted-2)}
  .service-card .s-grow .s-grow-arrow{width:14px;height:14px;color:var(--muted-2)}
  .service-card .s-grow .s-grow-browser{width:22px;height:22px;color:var(--accent-3)}
```
becomes:
```css
  .service-card .s-grow .s-grow-doc{width:18px;height:18px;color:var(--muted-2)}
  .service-card .s-grow .s-grow-arrow{width:14px;height:14px;color:var(--muted-2)}
  .service-card .s-grow .s-grow-browser{width:22px;height:22px;color:var(--accent)}
```

- [ ] **Step 4: Rewrite the problem cards**

Find ([index.html:455-468](../../../index.html#L455-L468)):

```css
.prob{border:1px solid var(--line);border-radius:var(--radius);padding:24px;background:linear-gradient(180deg,rgba(18,26,48,.5),rgba(10,15,31,.3));position:relative;overflow:hidden;transition:transform .3s var(--ease),border-color .3s;display:flex;flex-direction:column;height:100%}
.prob:hover{transform:translateY(-4px);border-color:var(--line-strong)}
.prob .pic{width:44px;height:44px;border-radius:11px;display:grid;place-items:center;border:1px solid rgba(251,191,36,.25);background:rgba(251,191,36,.07);margin-bottom:16px}
.prob .pic svg{width:21px;height:21px;color:var(--warn)}
.prob h3{font-size:16.5px;font-weight:600;letter-spacing:-.01em;margin-bottom:7px}
.prob p{font-size:14px;color:var(--muted)}
.prob .cost{margin-top:14px;font-size:12px;color:var(--warn);font-weight:500}
.prob .fix{margin-top:auto;padding-top:16px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:8px}
.prob .fix-tag{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--good)}
.prob .fix-tag svg{width:13px;height:13px;flex:0 0 auto}
.prob .fix p{font-size:13.5px;color:var(--text);line-height:1.5;min-height:3em}
.prob .fix .stat-row{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.prob .fix .stat{font-size:22px;font-weight:800;letter-spacing:-.02em;background:linear-gradient(120deg,var(--good),var(--accent-3));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.prob .fix .stat-label{font-size:12px;color:var(--muted-2)}
```

Replace with:

```css
.prob{border:1px solid var(--line);border-radius:var(--r-md);padding:var(--sp-5);background:var(--surface);position:relative;overflow:hidden;display:flex;flex-direction:column;height:100%}
.prob .pic{width:44px;height:44px;border-radius:var(--r-md);display:grid;place-items:center;border:1px solid var(--line);background:var(--surface-sunken);margin-bottom:var(--sp-4)}
.prob .pic svg{width:21px;height:21px;color:var(--muted)}
.prob h3{font-family:var(--font-ui);font-size:var(--fs-h4);font-weight:600;letter-spacing:-.005em;margin-bottom:var(--sp-2)}
.prob p{font-family:var(--font-ui);font-size:var(--fs-small);color:var(--muted)}
.prob .fix{margin-top:auto;padding-top:var(--sp-4);border-top:1px solid var(--line);display:flex;flex-direction:column;gap:var(--sp-2)}
.prob .fix-tag{display:inline-flex;align-items:center;gap:var(--sp-1);font-family:var(--font-mono);font-size:var(--fs-label);font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:var(--good)}
.prob .fix-tag svg{width:13px;height:13px;flex:0 0 auto}
.prob .fix p{font-family:var(--font-ui);font-size:var(--fs-small);color:var(--ink-2);line-height:1.5;min-height:3em}
.prob .fix .stat-row{display:flex;align-items:baseline;gap:var(--sp-2);flex-wrap:wrap}
.prob .fix .stat{font-family:var(--font-ui);font-size:var(--fs-h3);font-weight:700;letter-spacing:-.012em;color:var(--ink);font-variant-numeric:tabular-nums}
.prob .fix .stat-label{font-family:var(--font-ui);font-size:var(--fs-micro);color:var(--muted-2)}
```

Three changes beyond colour: the hover is removed (`.prob` is not a link), the `.pic` icon moves from `--warn` to `--muted` so warn stays semantic, and the gradient-clipped stat becomes flat `--ink`. The unused `.prob .cost` rule is dropped — grep confirms no markup uses it.

- [ ] **Step 5: Rewrite process, results, tech, why and the CTA band**

Find ([index.html:471-479](../../../index.html#L471-L479)) and replace the process rules:

```css
.proc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-top:54px;position:relative}
.proc-line{position:absolute;top:31px;left:8%;right:8%;height:2px;background:linear-gradient(90deg,transparent,var(--line-strong),var(--line-strong),transparent);z-index:0}
.proc{position:relative;z-index:1;padding:0 16px;text-align:center}
.proc .num{width:62px;height:62px;margin:0 auto 18px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:20px;background:var(--surface);border:1px solid var(--line-strong);position:relative;transition:background .4s var(--ease),box-shadow .4s var(--ease),border-color .4s,color .4s}
.proc .num::before{content:"";position:absolute;inset:-6px;border-radius:50%;border:1px solid var(--line);opacity:.6}
.proc.active .num{background:linear-gradient(135deg,var(--accent),var(--accent-2));border-color:transparent;box-shadow:0 10px 30px -8px rgba(79,125,255,.7);color:#fff}
.proc h3{font-size:17px;font-weight:600;letter-spacing:-.01em;margin-bottom:8px}
.proc p{font-size:13.5px;color:var(--muted);max-width:230px;margin:0 auto}
.proc .ptag{display:inline-block;margin-top:12px;font-size:11px;color:var(--accent-3);letter-spacing:.06em}
```

Replace with:

```css
.proc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-top:var(--sp-7);position:relative}
.proc-line{position:absolute;top:31px;left:8%;right:8%;height:1px;background:var(--line-strong);z-index:0}
.proc{position:relative;z-index:1;padding:0 var(--sp-4);text-align:center}
.proc .num{width:62px;height:62px;margin:0 auto var(--sp-4);border-radius:50%;display:grid;place-items:center;font-family:var(--font-mono);font-weight:500;font-size:var(--fs-h4);background:var(--bg);border:1px solid var(--line-strong);color:var(--muted);position:relative;transition:background var(--t-base) var(--ease),border-color var(--t-base) var(--ease),color var(--t-base) var(--ease)}
.proc.active .num{background:var(--ink);border-color:var(--ink);color:var(--bg)}
.proc h3{font-family:var(--font-ui);font-size:var(--fs-h4);font-weight:600;letter-spacing:-.005em;margin-bottom:var(--sp-2)}
.proc p{font-family:var(--font-ui);font-size:var(--fs-small);color:var(--muted);max-width:230px;margin:0 auto}
.proc .ptag{display:inline-block;margin-top:var(--sp-3);font-family:var(--font-mono);font-size:var(--fs-label);color:var(--accent);letter-spacing:.12em;text-transform:uppercase}
```

The `.proc .num::before` halo ring is deleted — decorative, and it reads as noise on white.

Find ([index.html:482-489](../../../index.html#L482-L489)) and replace the results rules:

```css
.res{border:1px solid var(--line);border-radius:var(--radius-lg);padding:30px;background:linear-gradient(180deg,rgba(18,26,48,.55),rgba(10,15,31,.35));transition:transform .3s var(--ease),border-color .3s}
.res:hover{transform:translateY(-5px);border-color:var(--line-strong)}
.res .sector{font-size:12px;color:var(--muted-2);letter-spacing:.08em;text-transform:uppercase}
.res .big{font-size:48px;font-weight:800;letter-spacing:-.03em;line-height:1;margin:14px 0 6px;background:linear-gradient(120deg,var(--accent-3),var(--accent));-webkit-background-clip:text;background-clip:text;color:transparent}
.res .metric{font-size:15px;font-weight:600;margin-bottom:10px}
.res p{font-size:14px;color:var(--muted)}
.res .quote{margin-top:18px;padding-top:16px;border-top:1px solid var(--line);font-size:13.5px;color:var(--muted);font-style:italic}
```

Replace with:

```css
.res{border:1px solid var(--line);border-radius:var(--r-md);padding:var(--sp-5);background:var(--surface)}
.res .sector{font-family:var(--font-mono);font-size:var(--fs-label);color:var(--muted-2);letter-spacing:.12em;text-transform:uppercase}
.res .big{font-family:var(--font-ui);font-size:48px;font-weight:700;letter-spacing:-.03em;line-height:1;margin:var(--sp-3) 0 var(--sp-1);color:var(--accent);font-variant-numeric:tabular-nums}
.res .metric{font-family:var(--font-ui);font-size:var(--fs-small);font-weight:600;margin-bottom:var(--sp-3)}
.res p{font-family:var(--font-ui);font-size:var(--fs-small);color:var(--muted)}
.res .quote{margin-top:var(--sp-4);padding-top:var(--sp-4);border-top:1px solid var(--line);font-family:var(--font-body);font-size:var(--fs-small);color:var(--muted);font-style:italic}
```

Find ([index.html:492-497](../../../index.html#L492-L497)) and replace the tech rules:

```css
.tech-col h4{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent-3);margin-bottom:16px}
.tech-list{display:grid;gap:10px}
.tech-item{display:flex;align-items:center;gap:11px;padding:13px 15px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.02);font-size:14px;font-weight:500;color:var(--text);transition:.25s}
.tech-item:hover{border-color:var(--line-strong);background:rgba(255,255,255,.05);transform:translateX(3px)}
.tech-item .td{width:8px;height:8px;border-radius:2px;background:var(--accent);flex:0 0 auto}
```

Replace with:

```css
.tech-col h4{font-family:var(--font-mono);font-size:var(--fs-label);letter-spacing:.12em;text-transform:uppercase;color:var(--muted-2);margin-bottom:var(--sp-4)}
.tech-list{display:grid;gap:var(--sp-2)}
.tech-item{display:flex;align-items:center;gap:var(--sp-3);padding:13px 15px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--surface);font-family:var(--font-ui);font-size:var(--fs-small);font-weight:500;color:var(--ink)}
.tech-item .td{width:8px;height:8px;border-radius:2px;background:var(--accent);flex:0 0 auto}
```

The `:hover` is removed — `.tech-item` is not a link, and 24 items sliding sideways was the clearest example of hover applied without meaning.

Find ([index.html:500-506](../../../index.html#L500-L506)) and replace the why rules:

```css
.why{display:flex;gap:18px;padding:26px;border:1px solid var(--line);border-radius:var(--radius);background:linear-gradient(180deg,rgba(18,26,48,.45),rgba(10,15,31,.25));transition:.3s}
.why:hover{border-color:var(--line-strong);transform:translateY(-3px)}
.why .wic{width:48px;height:48px;flex:0 0 auto;border-radius:12px;display:grid;place-items:center;background:linear-gradient(135deg,rgba(52,211,153,.16),rgba(34,211,238,.1));border:1px solid var(--line-strong)}
.why .wic svg{width:22px;height:22px;color:var(--good)}
.why h3{font-size:18px;font-weight:600;letter-spacing:-.015em;margin-bottom:6px}
.why p{font-size:14.5px;color:var(--muted)}
```

Replace with:

```css
.why{display:flex;gap:var(--sp-4);padding:var(--sp-5);border:1px solid var(--line);border-radius:var(--r-md);background:var(--surface)}
.why .wic{width:48px;height:48px;flex:0 0 auto;border-radius:var(--r-md);display:grid;place-items:center;background:var(--accent-soft);border:1px solid var(--accent-line)}
.why .wic svg{width:22px;height:22px;color:var(--accent)}
.why h3{font-family:var(--font-ui);font-size:var(--fs-h4);font-weight:600;letter-spacing:-.005em;margin-bottom:var(--sp-2)}
.why p{font-family:var(--font-ui);font-size:var(--fs-small);color:var(--muted)}
```

Find ([index.html:509-514](../../../index.html#L509-L514)) and replace the CTA band with the inverted-panel treatment from spec §8.6:

```css
.cta-band{position:relative;border:1px solid var(--line-strong);border-radius:var(--radius-lg);padding:clamp(40px,6vw,68px);text-align:center;overflow:hidden;background:linear-gradient(135deg,rgba(79,125,255,.14),rgba(139,92,246,.12))}
.cta-band::before{content:"";position:absolute;inset:0;background:radial-gradient(60% 120% at 50% 0%,rgba(79,125,255,.22),transparent 60%);pointer-events:none}
.cta-band h2{font-size:clamp(28px,4.4vw,46px);font-weight:800;letter-spacing:-.03em;line-height:1.1;position:relative}
.cta-band p{color:var(--muted);font-size:18px;margin:16px auto 0;max-width:560px;position:relative}
.cta-band .hero-cta{justify-content:center;margin-top:32px;position:relative}
.cta-sub{margin-top:18px;font-size:13px;color:var(--muted-2);position:relative}
```

Replace with:

```css
.cta-band{position:relative;border-radius:var(--r-lg);padding:clamp(40px,7vw,96px);text-align:center;background:var(--panel);color:var(--on-panel)}
.cta-band h2{font-family:var(--font-ui);font-size:var(--fs-h2);font-weight:600;letter-spacing:-.022em;line-height:1.10;color:var(--on-panel);text-wrap:balance}
.cta-band p{color:var(--on-panel-muted);font-size:var(--fs-body);margin:var(--sp-4) auto 0;max-width:var(--maxw-narrow);text-wrap:pretty}
.cta-band .hero-cta{justify-content:center;margin-top:var(--sp-6)}
.cta-band .btn-primary{background:var(--on-panel);color:var(--panel)}
.cta-band .btn-primary:hover{background:#fff}
.cta-band .btn-ghost{background:transparent;border-color:var(--line-invert);color:var(--on-panel)}
.cta-band .btn-ghost:hover{background:rgba(247,247,245,.08);border-color:var(--on-panel)}
.cta-band :focus-visible{outline-color:var(--focus-invert)}
.cta-sub{margin-top:var(--sp-4);font-family:var(--font-mono);font-size:var(--fs-micro);color:var(--on-panel-muted)}
```

- [ ] **Step 6: Run the harness**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```
Expected: `consoleErrors` is `[]`. Open `tmp_desktop_full.png` and confirm cards render as white with hairline borders and the CTA band renders as a black panel.

- [ ] **Step 7: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Convert cards, buttons and surfaces to the light system

Primary buttons become black on white (18.6:1), replacing the
blue-to-violet gradient fill. All six ad-hoc card gradient backgrounds
collapse to a single flat --surface with a hairline border.

Removes hover from .prob, .res, .why and .tech-item - none of them are
links, and 24 tech items sliding sideways on hover was the clearest case
of hover applied without meaning. Narrows the service-card hover to
a.service-card so the non-link AI Assistants card no longer lifts.

Moves the problem-card icons from --warn to --muted so warn stays
semantic, and replaces all gradient-clipped stat text with flat ink.

The CTA band becomes the first inverted panel.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Nav, footer, reveals and reduced motion

**Files:**
- Modify: `index.html:102-111` (nav), `98-99` (scroll progress), `516-523` (footer), `525-542` (reveals), `589-594` (reduced motion)

- [ ] **Step 1: Rewrite the nav without `backdrop-filter`**

Find ([index.html:102-111](../../../index.html#L102-L111)):

```css
header.nav{position:sticky;top:0;z-index:100;transition:background .3s var(--ease),border-color .3s var(--ease),backdrop-filter .3s}
header.nav.scrolled{background:rgba(7,11,22,.72);backdrop-filter:blur(14px) saturate(140%);border-bottom:1px solid var(--line)}
.nav-inner{display:flex;align-items:center;justify-content:space-between;height:72px}
.brand{display:flex;align-items:center;gap:11px;font-weight:700;letter-spacing:-.02em;font-size:18px}
.brand .glyph{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,var(--accent),var(--accent-2));display:grid;place-items:center;box-shadow:0 6px 20px -6px rgba(79,125,255,.7)}
.brand .glyph svg{width:18px;height:18px}
.nav-links{display:flex;align-items:center;gap:30px}
.nav-links a{color:var(--muted);font-size:14.5px;font-weight:500;transition:color .2s}
.nav-links a:hover{color:var(--text)}
.nav-cta{display:flex;align-items:center;gap:14px}
```

Replace with:

```css
header.nav{position:sticky;top:0;z-index:100;background:var(--bg);border-bottom:1px solid transparent;transition:border-color var(--t-base) var(--ease),box-shadow var(--t-base) var(--ease)}
header.nav.scrolled{border-bottom-color:var(--line);box-shadow:var(--shadow-sm)}
.nav-inner{display:flex;align-items:center;justify-content:space-between;height:72px}
.brand{display:flex;align-items:center;gap:var(--sp-3);font-family:var(--font-ui);font-weight:700;letter-spacing:-.02em;font-size:var(--fs-h4);color:var(--ink)}
.brand .glyph{width:34px;height:34px;border-radius:var(--r-sm);background:var(--ink);display:grid;place-items:center}
.brand .glyph svg{width:18px;height:18px}
.nav-links{display:flex;align-items:center;gap:var(--sp-6)}
.nav-links a{color:var(--muted);font-family:var(--font-ui);font-size:var(--fs-small);font-weight:500;transition:color var(--t-fast) var(--ease)}
.nav-links a:hover{color:var(--ink)}
.nav-cta{display:flex;align-items:center;gap:var(--sp-3)}
```

The nav is now an opaque white bar that grows a border and a hairline shadow on scroll — cheaper than `backdrop-filter` and correct on a light ground. The brand glyph loses its gradient and glow.

- [ ] **Step 2: Recolour the scroll progress bar**

Find ([index.html:98-99](../../../index.html#L98-L99)):

```css
.scroll-progress{position:fixed;top:0;left:0;right:0;height:2px;z-index:200;background:rgba(148,163,184,.08);pointer-events:none}
.scroll-progress i{display:block;height:100%;width:0%;background:linear-gradient(90deg,var(--accent-3),var(--accent),var(--accent-2));box-shadow:0 0 12px rgba(79,125,255,.6);transition:width .08s linear}
```

Replace with:

```css
.scroll-progress{position:fixed;top:0;left:0;right:0;height:2px;z-index:200;background:transparent;pointer-events:none}
.scroll-progress i{display:block;height:100%;width:0%;background:var(--accent);transition:width .08s linear}
```

- [ ] **Step 3: Rewrite the footer**

Find ([index.html:516-523](../../../index.html#L516-L523)):

```css
footer{border-top:1px solid var(--line);margin-top:clamp(64px,9vw,110px);padding:56px 0 40px}
.foot-grid{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:40px}
.foot-brand p{color:var(--muted);font-size:14px;margin-top:16px;max-width:300px}
.foot-col h5{font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted-2);margin-bottom:16px}
.foot-col a{display:block;color:var(--muted);font-size:14px;margin-bottom:11px;transition:color .2s}
.foot-col a:hover{color:var(--text)}
.foot-bottom{display:flex;justify-content:space-between;align-items:center;margin-top:48px;padding-top:26px;border-top:1px solid var(--line);font-size:13px;color:var(--muted-2);flex-wrap:wrap;gap:12px}
```

Replace with:

```css
footer{border-top:1px solid var(--line);margin-top:var(--sp-9);padding:var(--sp-8) 0 var(--sp-7);background:var(--bg-2)}
.foot-grid{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:var(--sp-7)}
.foot-brand p{font-family:var(--font-ui);color:var(--muted);font-size:var(--fs-small);margin-top:var(--sp-4);max-width:300px}
.foot-col h5{font-family:var(--font-mono);font-size:var(--fs-label);letter-spacing:.12em;text-transform:uppercase;color:var(--muted-2);margin-bottom:var(--sp-4)}
.foot-col a{display:block;color:var(--muted);font-family:var(--font-ui);font-size:var(--fs-small);padding:var(--sp-2) 0;transition:color var(--t-fast) var(--ease)}
.foot-col a:hover{color:var(--ink)}
.foot-bottom{display:flex;justify-content:space-between;align-items:center;margin-top:var(--sp-7);padding-top:var(--sp-5);border-top:1px solid var(--line);font-family:var(--font-mono);font-size:var(--fs-micro);color:var(--muted-2);flex-wrap:wrap;gap:var(--sp-3)}
```

Footer links move from `margin-bottom:11px` to `padding:8px 0`, which takes their hit area from ~22px to ~38px — closer to the 44px floor while keeping the visual rhythm. Task 7 finishes the touch-target work.

- [ ] **Step 4: Retime the reveals**

Find ([index.html:525-542](../../../index.html#L525-L542)):

```css
/* ===== Reveal animation ===== */
.reveal{opacity:0;transform:translateY(26px);transition:opacity .8s var(--ease),transform .8s var(--ease)}
.reveal.in{opacity:1;transform:none}
.reveal[data-d="1"]{transition-delay:.08s}
.reveal[data-d="2"]{transition-delay:.16s}
.reveal[data-d="3"]{transition-delay:.24s}
.reveal[data-d="4"]{transition-delay:.32s}

/* Reveal variants for scroll rhythm */
.reveal-scale{opacity:0;transform:translateY(22px) scale(.97);transition:opacity .9s var(--ease),transform .9s var(--ease)}
.reveal-scale.in{opacity:1;transform:none}
.reveal-left{opacity:0;transform:translateX(-34px);transition:opacity .85s var(--ease),transform .85s var(--ease)}
.reveal-left.in{opacity:1;transform:none}
.reveal-right{opacity:0;transform:translateX(34px);transition:opacity .85s var(--ease),transform .85s var(--ease)}
.reveal-right.in{opacity:1;transform:none}
@media(max-width:1000px){
  .reveal-left,.reveal-right{transform:translateY(22px)}
}
```

Replace with:

```css
/* ===== Reveal animation ===== */
.reveal,.reveal-scale,.reveal-left,.reveal-right{opacity:0;transform:translateY(16px);transition:opacity var(--t-reveal) var(--ease-out),transform var(--t-reveal) var(--ease-out)}
.reveal.in,.reveal-scale.in,.reveal-left.in,.reveal-right.in{opacity:1;transform:none}
.reveal[data-d="1"]{transition-delay:60ms}
.reveal[data-d="2"]{transition-delay:120ms}
.reveal[data-d="3"]{transition-delay:180ms}
.reveal[data-d="4"]{transition-delay:180ms}
```

All four reveal variants collapse to one behaviour. The directional and scale variants existed to manufacture rhythm that the section grounds now supply, the duration drops from 800–900ms to 450ms, travel from 26px to 16px, and the stagger caps at 180ms instead of 320ms — so the last card in a row now lands at 630ms instead of 1120ms. The class names are kept so no markup changes.

- [ ] **Step 5: Scope the reduced-motion rule**

Find ([index.html:589-594](../../../index.html#L589-L594)):

```css
@media(prefers-reduced-motion:reduce){
  *{animation:none!important;transition:none!important}
  .reveal,.card-reveal{opacity:1;transform:none}
  .glow-orb{translate:none!important}
  html{scroll-behavior:auto}
}
```

Replace with:

```css
@media(prefers-reduced-motion:reduce){
  *{animation:none!important}
  *{transition-duration:var(--t-fast)!important}
  .reveal,.reveal-scale,.reveal-left,.reveal-right,.card-reveal{opacity:1!important;transform:none!important}
  html{scroll-behavior:auto}
}
```

Positional motion goes; colour and opacity feedback survives. The old blanket `transition:none` killed hover and focus feedback, which vestibular-sensitive users still need.

- [ ] **Step 6: Run the harness**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```
Expected:
- `blurCount` is `0`
- `consoleErrors` is `[]`

- [ ] **Step 7: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Rework nav, footer, reveals and reduced motion

The sticky nav becomes an opaque white bar that grows a border and a
hairline shadow on scroll, removing the page's last backdrop-filter.
Page-wide blur and backdrop-filter count is now zero, down from eighteen.

Collapses the four reveal variants to one behaviour: 450ms, 16px travel,
60ms stagger capped at 180ms. The last card in a row now lands at 630ms
instead of 1120ms. Directional and scale variants existed to manufacture
scroll rhythm that the section grounds now supply.

Scopes the reduced-motion rule so colour and opacity feedback survives -
the previous blanket transition:none killed hover and focus feedback,
which vestibular-sensitive users still need.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Hero pin and scroll performance

Delivers audit findings P0-6 and P1-7.

**Files:**
- Modify: `index.html:132` (stage height)
- Modify: `index.html:1324-1406` (`applyHeroMorph`, `heroMorphProgress`)
- Modify: `index.html:1408-1458` (`onFrame`)

- [ ] **Step 1: Cut the stage height**

Find ([index.html:132](../../../index.html#L132)):

```css
.hero-morph-stage{position:relative;height:270vh}
```

Replace with:

```css
.hero-morph-stage{position:relative;height:130vh}
```

- [ ] **Step 2: Complete the morph at 75% of the pin**

Find ([index.html:1402-1406](../../../index.html#L1402-L1406)):

```js
  function heroMorphProgress(){
    var rect = heroStage.getBoundingClientRect();
    var scrolled = -rect.top; // 0 when stage top is at viewport top; grows as user scrolls
    return scrolled / window.innerHeight; // 0 -> 1 over the first 100vh of stage scroll
  }
```

Replace with:

```js
  function heroMorphProgress(){
    // Stage is 130vh with a 100vh sticky hero, so there are 30vh of scroll
    // inside it. Complete the morph at 75% of that, leaving a short settled
    // beat before the hero releases rather than ~70vh of dead pinned scroll.
    var scrolled = heroStageTop - heroStageRectTop();
    return scrolled / (window.innerHeight * 0.75);
  }
```

- [ ] **Step 3: Cache every measurement the morph needs**

Find ([index.html:1308-1322](../../../index.html#L1308-L1322)):

```js
  var heroCtaCenterOffset = 0;
  var heroMetaCenterOffset = 0;

  function rowGroupCenterOffset(row){
    if (!row || !row.firstElementChild || !row.lastElementChild) return 0;
    var rowRect = row.getBoundingClientRect();
    var groupWidth = row.lastElementChild.getBoundingClientRect().right - row.firstElementChild.getBoundingClientRect().left;
    return Math.max(0, (rowRect.width - groupWidth) / 2);
  }

  function measureHeroMorphOffsets(){
    if (!heroMorphEnabled) return;
    heroCtaCenterOffset = rowGroupCenterOffset(heroCta);
    heroMetaCenterOffset = rowGroupCenterOffset(heroMeta);
  }
```

Replace with:

```js
  var heroCtaCenterOffset = 0;
  var heroMetaCenterOffset = 0;
  var heroH1CenterOffset = 0;
  var heroEyebrowCenterOffset = 0;
  var heroTaglineCenterOffset = 0;
  var heroVisualStartWidth = 0;
  var heroStageTop = 0;

  function rowGroupCenterOffset(row){
    if (!row || !row.firstElementChild || !row.lastElementChild) return 0;
    var rowRect = row.getBoundingClientRect();
    var groupWidth = row.lastElementChild.getBoundingClientRect().right - row.firstElementChild.getBoundingClientRect().left;
    return Math.max(0, (rowRect.width - groupWidth) / 2);
  }

  // Width of an element's rendered TEXT, not its box. Block elements fill the
  // container, so a Range is the only way to get the widest line's width.
  function textCenterOffset(el, containerWidth){
    if (!el) return 0;
    var r = document.createRange();
    r.selectNodeContents(el);
    var w = r.getBoundingClientRect().width;
    r.detach && r.detach();
    return Math.max(0, (containerWidth - w) / 2);
  }

  function heroStageRectTop(){
    return heroStage.getBoundingClientRect().top;
  }

  // Everything here is layout-invariant during a scroll: content widths are
  // fixed, so these are measured once on init and on resize instead of being
  // re-read (and forcing a synchronous reflow) on every animation frame.
  function measureHeroMorphOffsets(){
    if (!heroMorphEnabled) return;
    heroStageTop = heroStage.getBoundingClientRect().top + window.scrollY;

    var copyWidth = heroCopy.getBoundingClientRect().width;
    heroCtaCenterOffset = rowGroupCenterOffset(heroCta);
    heroMetaCenterOffset = rowGroupCenterOffset(heroMeta);
    heroH1CenterOffset = textCenterOffset(heroH1, copyWidth);
    heroTaglineCenterOffset = textCenterOffset(heroTagline, copyWidth);
    heroEyebrowCenterOffset = heroEyebrow
      ? Math.max(0, (copyWidth - heroEyebrow.getBoundingClientRect().width) / 2)
      : 0;

    var containerWidth = heroSection.getBoundingClientRect().width;
    heroVisualStartWidth = (containerWidth - 48) * 1.15 / 2.15;
  }
```

- [ ] **Step 4: Rewrite `applyHeroMorph` to read only cached values**

Find [index.html:1324-1400](../../../index.html#L1324-L1400) — the whole `applyHeroMorph` function — and replace it with:

```js
  function applyHeroMorph(progress){
    var p = Math.max(0, Math.min(1, progress));
    var snap = p > 0.5;
    var slide = 1 - p; // 1 -> 0 across the whole range

    // Numeric interpolation
    heroH1.style.fontSize = lerp(60, 40, p).toFixed(1) + 'px';
    heroH1.style.lineHeight = lerp(1.04, 1.10, p).toFixed(3);
    heroH1.style.letterSpacing = lerp(-0.03, -0.022, p).toFixed(4) + 'em';

    // Cards fade/slide in faster than the overall morph (done by p=0.7) so
    // they're fully visible with room to spare before the stage finishes.
    var visualP = Math.min(1, p / 0.7);
    heroVisual.style.opacity = lerp(0, 1, visualP).toFixed(3);
    heroVisual.style.transform = 'translateX(' + lerp(60, 0, visualP).toFixed(1) + 'px)';

    // All offsets below are cached by measureHeroMorphOffsets(); nothing in
    // this function reads layout, so the scroll loop never forces a reflow.
    heroH1.style.transform = 'translateX(' + (heroH1CenterOffset * slide).toFixed(2) + 'px)';
    if (heroCta) heroCta.style.transform = 'translateX(' + (heroCtaCenterOffset * slide).toFixed(2) + 'px)';
    if (heroMeta) heroMeta.style.transform = 'translateX(' + (heroMetaCenterOffset * slide).toFixed(2) + 'px)';
    if (heroEyebrow) heroEyebrow.style.transform = 'translateX(' + (heroEyebrowCenterOffset * slide).toFixed(2) + 'px)';
    if (heroTagline) heroTagline.style.transform = 'translateX(' + (heroTaglineCenterOffset * slide).toFixed(2) + 'px)';

    // Discrete snaps at midpoint (CSS transition on max-width/margin eases these)
    heroGrid.style.gridTemplateColumns = snap ? '1fr 1.15fr' : '1fr';
    heroCopy.style.maxWidth = snap ? 'none' : '1100px';
    heroCopy.style.margin = snap ? '0' : '0 auto';
    if (heroSub){
      heroSub.style.maxWidth = snap ? 'var(--maxw-narrow)' : 'var(--maxw-text)';
      heroSub.style.marginLeft = snap ? '0' : 'auto';
      heroSub.style.marginRight = snap ? '0' : 'auto';
    }
    heroVisual.style.pointerEvents = snap ? 'auto' : 'none';
    heroVisual.style.position = snap ? 'relative' : 'absolute';
    heroVisual.style.top = snap ? 'auto' : '0';
    heroVisual.style.bottom = snap ? 'auto' : '0';
    heroVisual.style.right = snap ? 'auto' : '0';
    heroVisual.style.width = snap ? 'auto' : heroVisualStartWidth.toFixed(1) + 'px';
  }
```

The h1 interpolation moves from 78→52px to 60→40px, matching the new `--fs-h1` and `--fs-h2` scale.

- [ ] **Step 5: Rewrite `onFrame` to read scroll position only**

Find [index.html:1431-1452](../../../index.html#L1431-L1452) — the `onFrame` function — and replace with:

```js
  // Cached on load and resize; the scroll loop never reads layout.
  var docScrollMax = 0;
  function measureDocument(){
    docScrollMax = document.documentElement.scrollHeight - window.innerHeight;
  }

  function onFrame(){
    var y = window.scrollY;
    nav.classList.toggle('scrolled', y > 8);

    var pct = docScrollMax > 0 ? (y / docScrollMax) * 100 : 0;
    scrollBar.style.width = pct + '%';

    if (heroMorphEnabled){
      applyHeroMorph(heroMorphProgress());
    }
    ticking = false;
  }
```

The parallax loop, the `updatePathChips` call and the per-frame `scrollHeight` read are all gone. `scrollHeight` in particular was forcing a layout on every frame.

- [ ] **Step 6: Delete `updatePathChips` and wire up the new measurement**

Find and delete [index.html:1421-1429](../../../index.html#L1421-L1429) — the whole `updatePathChips` function, now uncalled.

Then find ([index.html:1456-1458](../../../index.html#L1456-L1458)):

```js
  measureHeroMorphOffsets();
  onFrame();
  window.addEventListener('scroll', onScroll, {passive:true});
```

Replace with:

```js
  measureDocument();
  measureHeroMorphOffsets();
  onFrame();
  window.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('load', function(){ measureDocument(); measureHeroMorphOffsets(); onFrame(); });
```

The `load` listener re-measures once webfonts have settled, since font swap changes both text widths and document height.

- [ ] **Step 7: Re-measure the document on resize**

Find ([index.html:1460-1461](../../../index.html#L1460-L1461)):

```js
  window.addEventListener('resize', function(){
    var nowEnabled = computeHeroMorphEnabled();
```

Replace with:

```js
  window.addEventListener('resize', function(){
    measureDocument();
    var nowEnabled = computeHeroMorphEnabled();
```

- [ ] **Step 8: Run the harness**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```
Expected:
- `heroStageHeight` is `1170px` (130vh at a 900px viewport)
- `consoleErrors` is `[]`

- [ ] **Step 9: Verify no per-frame layout reads remain**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && sed -n '/function onFrame/,/^  }/p' index.html | grep -cE 'getBoundingClientRect|createRange|scrollHeight|offsetWidth|offsetHeight|getComputedStyle'
```
Expected: `0`

- [ ] **Step 10: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Cut the hero pin to 130vh and remove per-frame layout reads

The stage was 270vh with a 100vh sticky hero and a morph that completed
at 100vh, leaving roughly 70vh of pinned scroll where nothing changed.
That is scroll-jacking at the highest-attention moment on the page. The
stage is now 130vh and the morph completes at 75% of the pin.

The scroll loop was forcing about eleven synchronous reflows per frame:
a getBoundingClientRect on every glow orb's parent, three more in the
morph, two document.createRange text measurements, and a scrollHeight
read - all interleaved with style writes. Every one of those values is
layout-invariant during a scroll, so they are now measured once on init,
on resize and on load, and the loop reads only window.scrollY.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: Section grounds, full-bleed fix, focus states and landmarks

Delivers audit finding P0-8 and the §5 section rhythm.

**Files:**
- Modify: `index.html:267-275` (`.web-show`), `77` (`.wrap`), `67-74` (`body`)
- Modify: `index.html:597-613` (skip link, `<main>` open), `1236` (`</main>`)
- Modify: `index.html:640, 741, 792, 828, 860, 907, 1069, 1198` (section `aria-labelledby`)

- [ ] **Step 1: Replace the full-bleed hack with a safe one**

Find ([index.html:267-275](../../../index.html#L267-L275)):

```css
.web-show{padding-top:0;position:relative;isolation:isolate}
.web-show::before{
  content:"";position:absolute;top:0;bottom:0;left:50%;width:100vw;transform:translateX(-50%);z-index:-1;
  background:linear-gradient(180deg,transparent,rgba(14,20,38,.55) 8%,rgba(14,20,38,.55) 92%,transparent);
  border-top:1px solid var(--line);border-bottom:1px solid var(--line);
}
.web-show + .web-show::before{border-top:none;background:linear-gradient(180deg,rgba(14,20,38,.55),rgba(14,20,38,.55) 92%,transparent)}
.web-show:has(+ .web-show)::before{border-bottom:none;background:linear-gradient(180deg,transparent,rgba(14,20,38,.55) 8%,rgba(14,20,38,.55))}
```

Replace with:

```css
.web-show{padding-top:0;position:relative;isolation:isolate}
.web-show::before{
  content:"";position:absolute;top:0;bottom:0;left:0;right:0;z-index:-1;
  margin-inline:calc(50% - 50vw);width:100vw;
  background:var(--bg-2);
  border-top:1px solid var(--line);border-bottom:1px solid var(--line);
}
.web-show + .web-show::before{border-top:none}
.web-show:has(+ .web-show)::before{border-bottom:none}
```

- [ ] **Step 2: Scope the overflow clip and remove it from `body`**

Find ([index.html:77](../../../index.html#L77)):

```css
.wrap{max-width:var(--maxw);margin:0 auto;padding:0 24px}
```

Replace with:

```css
.wrap{max-width:var(--maxw);margin:0 auto;padding:0 var(--sp-5)}
main{overflow-x:clip}
.skip-link{position:absolute;left:-9999px;top:0;z-index:300;background:var(--ink);color:var(--bg);font-family:var(--font-ui);font-size:var(--fs-small);font-weight:600;padding:12px 20px;border-radius:0 0 var(--r-sm) 0}
.skip-link:focus{left:0}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
[data-sentinel]{outline:2px dashed var(--warn);outline-offset:2px;background:rgba(138,90,11,.08)}
```

The single `:focus-visible` rule covers every interactive element at once, which is simpler and more reliable than enumerating selectors. `[data-sentinel]` makes any deferred fact visually obvious.

Then find in `body` ([index.html:67-74](../../../index.html#L67-L74), as rewritten in Task 1):

```css
  overflow-x:hidden;
```

Delete that line. `main{overflow-x:clip}` now contains the full-bleed panels without suppressing overflow globally, and without the `position:sticky` risk that `overflow:hidden` on `body` carries.

- [ ] **Step 3: Remove the now-redundant focus rule**

Find ([index.html:249-250](../../../index.html#L249-L250)):

```css
a.service-card{cursor:pointer}
a.service-card:focus-visible{outline:2px solid var(--accent-3);outline-offset:3px}
```

Replace with:

```css
a.service-card{cursor:pointer}
```

- [ ] **Step 4: Add the skip link and open `<main>`**

Find ([index.html:597-600](../../../index.html#L597-L600), as left by Task 3):

```html
<body>
<div class="scroll-progress" aria-hidden="true"><i id="scrollBar"></i></div>
```

Replace with:

```html
<body>
<a href="#main" class="skip-link">Skip to content</a>
<div class="scroll-progress" aria-hidden="true"><i id="scrollBar"></i></div>
```

Then find the line immediately after the closing `</header>` of the nav ([index.html:637](../../../index.html#L637)) and the `<!-- HERO -->` comment, and insert the `<main>` open tag between them:

```html
</header>

<main id="main">

<!-- HERO -->
<div class="hero-morph-stage">
```

- [ ] **Step 5: Close `<main>` before the footer**

Find ([index.html:1235-1238](../../../index.html#L1235-L1238)):

```html
</section>

<footer>
```

Replace with:

```html
</section>

</main>

<footer>
```

- [ ] **Step 6: Label every section**

Add an `id` to each section's heading and an `aria-labelledby` to the section. Apply all eight:

| Section tag at line | Add to `<section>` | Add to its `h1`/`h2` |
|---|---|---|
| 640 `id="top"` | `aria-labelledby="h-hero"` | `id="h-hero"` |
| 741 `id="problem"` | `aria-labelledby="h-problem"` | `id="h-problem"` |
| 792 `id="process"` | `aria-labelledby="h-process"` | `id="h-process"` |
| 828 `id="results"` | `aria-labelledby="h-results"` | `id="h-results"` |
| 860 `id="tech"` | `aria-labelledby="h-tech"` | `id="h-tech"` |
| 907 `id="growth"` | `aria-labelledby="h-growth"` | `id="h-growth"` |
| 1069 `id="intelligence"` | `aria-labelledby="h-intelligence"` | `id="h-intelligence"` |
| 1198 `id="why"` | `aria-labelledby="h-why"` | `id="h-why"` |
| 1225 `id="cta"` | `aria-labelledby="h-cta"` | `id="h-cta"` |

For example, [index.html:741-744](../../../index.html#L741-L744) becomes:

```html
<section class="pad wrap" id="problem" aria-labelledby="h-problem">
  <div class="section-head reveal">
    <span class="eyebrow"><span class="dot"></span>Sound familiar?</span>
    <h2 class="title" id="h-problem">Most businesses lose time and money in the same four places.</h2>
```

- [ ] **Step 7: Hide every decorative SVG**

Run this to find SVGs that are not already inside an `aria-hidden` container:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && grep -n '<svg' index.html | grep -v 'aria-hidden' | wc -l
```

Add `aria-hidden="true"` to each `<svg>` reported that is purely decorative — every SVG in `.s-icon`, `.pic`, `.wic`, `.fix-tag`, `.fl-icon`, `.bm-url`, `.sm-bar`, `.cm-stat`, `.brand .glyph`, and the `.btn` arrows. The only SVG that must NOT be hidden is one that is the sole content of a link or button with no text — in that case give the *link* an `aria-label` instead, which the WhatsApp `.nav-toggle` at line 631 already has.

- [ ] **Step 8: Run the harness**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```
Expected:
- `a11y.main` is `1`
- `a11y.skipLink` is `true`
- `a11y.sectionsLabelled` equals `a11y.sectionsTotal`
- `a11y.bareSvgs` is `0`
- `focusOutline.width` is `2px` and `focusOutline.style` is `solid`
- `mobile.horizontalOverflow` is `false`
- `consoleErrors` is `[]`

- [ ] **Step 9: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Add landmarks, focus states and a safe full-bleed technique

A single :focus-visible rule now covers every interactive element. Only
a.service-card had one before, so keyboard users tabbing to the primary
CTAs got the browser default on a dark ground, often invisible.

Adds <main>, a skip-to-content link, and aria-labelledby on all nine
sections.

Replaces the left:50%/translateX(-50%) full-bleed hack with
margin-inline:calc(50% - 50vw), which does not overflow, and moves the
clip from body{overflow-x:hidden} to main{overflow-x:clip}. The old rule
was masking a real overflow and risked breaking position:sticky, which
both the nav and the hero depend on.

Showcase panels move from a translucent navy gradient to a flat --bg-2
band, supplying the section rhythm a white ground needs.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: Remove the shims and prove nothing depends on them

**Files:**
- Modify: `index.html` — the shim block added in Task 1

- [ ] **Step 1: Find every surviving reference to a shimmed token**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && for t in 'var(--text)' 'var(--surface-2)' 'var(--accent-2)' 'var(--accent-3)' 'var(--radius)' 'var(--radius-lg)' 'var(--shadow)'; do printf '%-22s %s\n' "$t" "$(grep -c -- "$t" index.html)"; done
```

Every count must reach `0` before the shim block can be deleted. For each non-zero result, run `grep -n -- 'var(--text)' index.html` (substituting the token) and replace each hit using this mapping:

| Shimmed token | Replace with |
|---|---|
| `var(--text)` | `var(--ink)` — or `var(--on-panel)` if the rule is inside `.cta-band` or another inverted panel |
| `var(--surface-2)` | `var(--surface-sunken)` |
| `var(--accent-2)` | `var(--accent)` |
| `var(--accent-3)` | `var(--accent)` |
| `var(--radius)` | `var(--r-md)` |
| `var(--radius-lg)` | `var(--r-lg)` |
| `var(--shadow)` | `var(--shadow-md)` |

Note `var(--radius)` also matches `var(--radius-lg)` under `grep -c`, so resolve `--radius-lg` first.

- [ ] **Step 2: Re-run the check until all counts are zero**

Run the Step 1 command again.
Expected: all seven counts are `0`.

- [ ] **Step 3: Delete the shim block**

Find the block added in Task 1:

```css
/* Back-compat shims — removed in Task 8 once every reference is migrated.
   These keep the page rendering while the stylesheet is converted rule by rule. */
:root{
  --text:var(--ink);
  --surface-2:var(--surface-sunken);
  --accent-2:var(--accent);
  --accent-3:var(--accent);
  --radius:var(--r-md);
  --radius-lg:var(--r-lg);
  --shadow:var(--shadow-md);
}
```

Delete it in full.

- [ ] **Step 4: Sweep for hardcoded dark-ground colours**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && grep -nE 'rgba\((2|7|10|14|18|148,163,184|79,125,255|139,92,246|34,211,238|52,211,153|251,191,36)' index.html | grep -v '^[0-9]*:.*--' | head -40
```

Every hit is a colour literal from the old dark system. Replace each with the nearest token per the spec §13 migration map. Re-run until the command returns nothing.

- [ ] **Step 5: Run the harness**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```
Expected:
- `contrast["muted-2 sample"].ratio` is at least `4.5`
- `contrast["section intro"].ratio` is at least `4.5`
- `consoleErrors` is `[]`

- [ ] **Step 6: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Remove the back-compat token shims

Every reference to --text, --surface-2, --accent-2, --accent-3, --radius,
--radius-lg and --shadow is now migrated to the v2 token set, so the
temporary shim block from Task 1 is deleted.

Also sweeps out the remaining hardcoded dark-ground colour literals that
were never behind a token.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: Rebuild the four mockups for a light ground

Per spec §10. The browser and search mockups go light; the dashboard and pipeline become inverted panels.

**Files:**
- Modify: `index.html:294-361` (browser + search), `363-398` (campaign + funnel), `400-451` (dashboard + flow)

- [ ] **Step 1: Rebuild the browser mockup**

Find ([index.html:294-308](../../../index.html#L294-L308)) and replace:

```css
.browser-mock{position:relative;z-index:1;border:1px solid var(--line-strong);border-radius:var(--radius);overflow:hidden;background:var(--surface);box-shadow:var(--shadow)}
.bm-bar{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.02)}
.bm-dot{width:9px;height:9px;border-radius:50%;display:block}
.bm-dot.r{background:#f87171}
.bm-dot.y{background:#fbbf24}
.bm-dot.g{background:#34d399}
.bm-url{display:flex;align-items:center;gap:6px;margin:0 auto;padding:5px 14px;border-radius:7px;background:rgba(255,255,255,.04);color:var(--muted-2);font-size:12px}
.bm-url svg{color:var(--good)}
.bm-live{font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--good);opacity:0;transition:opacity .4s var(--ease)}
.web-visual.in .bm-live{animation:liveBlink 2.4s ease-in-out 2.6s infinite}

.bm-body{padding:22px;display:flex;flex-direction:column;gap:18px}
.bm-block{display:block;border-radius:6px;background:linear-gradient(100deg,rgba(148,163,184,.14),rgba(148,163,184,.22),rgba(148,163,184,.14));opacity:0;transform:translateY(10px) scaleX(.85);transform-origin:left;transition:opacity .5s var(--ease),transform .5s var(--ease)}
.web-visual.in .bm-block{opacity:1;transform:none}
```

With:

```css
.browser-mock{position:relative;z-index:1;border:1px solid var(--line);border-radius:var(--r-md);overflow:hidden;background:var(--surface);box-shadow:var(--shadow-md)}
.bm-bar{display:flex;align-items:center;gap:var(--sp-2);padding:var(--sp-3) var(--sp-4);border-bottom:1px solid var(--line);background:var(--surface-sunken)}
.bm-dot{width:9px;height:9px;border-radius:50%;display:block;background:var(--line-strong)}
.bm-url{display:flex;align-items:center;gap:var(--sp-1);margin:0 auto;padding:5px 14px;border-radius:var(--r-sm);background:var(--bg);border:1px solid var(--line);color:var(--muted-2);font-family:var(--font-mono);font-size:var(--fs-label)}
.bm-url svg{color:var(--good)}
.bm-live{font-family:var(--font-mono);font-size:var(--fs-label);font-weight:500;letter-spacing:.12em;color:var(--good);opacity:0;transition:opacity var(--t-base) var(--ease)}
.web-visual.in .bm-live{opacity:1;transition-delay:1.1s}

.bm-body{padding:var(--sp-5);display:flex;flex-direction:column;gap:var(--sp-4)}
.bm-block{display:block;border-radius:var(--r-sm);background:var(--surface-sunken);opacity:0;transform:translateY(10px) scaleX(.85);transform-origin:left;transition:opacity var(--t-reveal) var(--ease-out),transform var(--t-reveal) var(--ease-out)}
.web-visual.in .bm-block{opacity:1;transform:none}
```

The three coloured traffic-light dots become neutral, matching real light browser chrome. `liveBlink` becomes a one-shot fade — the blink was an infinite loop.

- [ ] **Step 2: Update the accent blocks inside the browser mockup**

Find ([index.html:311-322](../../../index.html#L311-L322)) and replace the three gradient-filled blocks:

```css
.bm-logo{width:34px;height:14px;border-radius:4px;background:linear-gradient(135deg,var(--accent),var(--accent-2))!important}
```
becomes:
```css
.bm-logo{width:34px;height:14px;border-radius:var(--r-sm);background:var(--ink)!important}
```

```css
.bm-cta{margin-left:auto;width:74px;height:24px;border-radius:7px;background:linear-gradient(135deg,var(--accent-3),var(--accent))!important}
```
becomes:
```css
.bm-cta{margin-left:auto;width:74px;height:24px;border-radius:var(--r-sm);background:var(--accent)!important}
```

```css
.bm-btn{width:120px;height:34px;border-radius:9px;margin-top:8px;background:linear-gradient(135deg,var(--accent),var(--accent-2))!important}
```
becomes:
```css
.bm-btn{width:120px;height:34px;border-radius:var(--r-sm);margin-top:var(--sp-2);background:var(--ink)!important}
```

And ([index.html:329](../../../index.html#L329)):
```css
.bm-icon{width:26px;height:26px;border-radius:7px;background:linear-gradient(135deg,rgba(79,125,255,.3),rgba(139,92,246,.22))!important}
```
becomes:
```css
.bm-icon{width:26px;height:26px;border-radius:var(--r-sm);background:var(--accent-soft)!important;border:1px solid var(--accent-line)}
```

- [ ] **Step 3: Delete the `liveBlink` keyframe**

Find ([index.html:342](../../../index.html#L342)):
```css
@keyframes liveBlink{0%,100%{opacity:1}50%{opacity:.35}}
```
Delete it, and delete the now-empty reduced-motion block at [index.html:358-361](../../../index.html#L358-L361):
```css
@media(prefers-reduced-motion:reduce){
  .web-visual.in .bm-live{animation:none}
}
```

- [ ] **Step 4: Rebuild the search-ranking card**

Find ([index.html:344-356](../../../index.html#L344-L356)) and replace:

```css
.search-mock{position:relative;z-index:2;margin:-32px 0 0 auto;width:min(290px,78%);border:1px solid var(--line-strong);border-radius:14px;padding:14px;background:linear-gradient(165deg,rgba(18,26,48,.97),rgba(10,15,31,.97));box-shadow:var(--shadow);opacity:0;transform:translateY(24px);transition:opacity .6s var(--ease) 1.05s,transform .6s var(--ease) 1.05s}
.web-visual.in .search-mock{opacity:1;transform:none}
.sm-bar{display:flex;align-items:center;gap:8px;color:var(--muted-2);font-size:12px;padding-bottom:10px;border-bottom:1px solid var(--line);margin-bottom:10px}
.sm-result{display:flex;align-items:center;gap:10px;padding:8px 0}
.sm-rank{flex:0 0 auto;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;background:rgba(148,163,184,.12);color:var(--muted)}
.sm-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.sm-text b{font-size:13px;font-weight:600}
.sm-text span{font-size:11.5px;color:var(--muted-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sm-you{border-radius:9px;background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.28);padding:8px 10px;margin:0 -10px 4px}
.sm-you .sm-rank{background:linear-gradient(135deg,var(--good),var(--accent-3));color:#06281d}
.sm-rise{margin-left:auto;flex:0 0 auto;color:var(--good)}
```

With:

```css
.search-mock{position:relative;z-index:2;margin:-32px 0 0 auto;width:min(290px,78%);border:1px solid var(--line);border-radius:var(--r-md);padding:var(--sp-4);background:var(--surface);box-shadow:var(--shadow-md);opacity:0;transform:translateY(16px);transition:opacity var(--t-reveal) var(--ease-out) .9s,transform var(--t-reveal) var(--ease-out) .9s}
.web-visual.in .search-mock{opacity:1;transform:none}
.sm-bar{display:flex;align-items:center;gap:var(--sp-2);color:var(--muted-2);font-family:var(--font-mono);font-size:var(--fs-label);padding-bottom:var(--sp-2);border-bottom:1px solid var(--line);margin-bottom:var(--sp-2)}
.sm-result{display:flex;align-items:center;gap:var(--sp-2);padding:var(--sp-2) 0}
.sm-rank{flex:0 0 auto;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-family:var(--font-mono);font-size:var(--fs-label);font-weight:500;background:var(--surface-sunken);color:var(--muted)}
.sm-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.sm-text b{font-family:var(--font-ui);font-size:var(--fs-micro);font-weight:600}
.sm-text span{font-family:var(--font-ui);font-size:var(--fs-label);color:var(--muted-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sm-you{border-radius:var(--r-sm);background:rgba(31,107,74,.07);border:1px solid rgba(31,107,74,.3);padding:var(--sp-2) var(--sp-3);margin:0 calc(var(--sp-3) * -1) var(--sp-1)}
.sm-you .sm-rank{background:var(--good);color:#fff}
.sm-rise{margin-left:auto;flex:0 0 auto;color:var(--good)}
```

- [ ] **Step 5: Rebuild the campaign and funnel mockups**

Find ([index.html:364-398](../../../index.html#L364-L398)) and apply these replacements:

```css
.campaign-mock{position:relative;z-index:1;border:1px solid var(--line-strong);border-radius:var(--radius);overflow:hidden;background:var(--surface);box-shadow:var(--shadow)}
.cm-bar{display:flex;align-items:center;gap:10px;padding:14px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.02)}
.cm-avatar{width:32px;height:32px;border-radius:50%;flex:0 0 auto;background:linear-gradient(135deg,var(--accent),var(--accent-2))}
```
becomes:
```css
.campaign-mock{position:relative;z-index:1;border:1px solid var(--line);border-radius:var(--r-md);overflow:hidden;background:var(--surface);box-shadow:var(--shadow-md)}
.cm-bar{display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-4);border-bottom:1px solid var(--line);background:var(--surface-sunken)}
.cm-avatar{width:32px;height:32px;border-radius:50%;flex:0 0 auto;background:var(--ink)}
```

```css
.cm-badge{font-size:11px;font-weight:700;letter-spacing:.04em;color:var(--accent-3);padding:5px 10px;border-radius:999px;border:1px solid var(--line-strong);background:rgba(34,211,238,.06)}
```
becomes:
```css
.cm-badge{font-family:var(--font-mono);font-size:var(--fs-label);font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);padding:5px 10px;border-radius:var(--r-pill);border:1px solid var(--accent-line);background:var(--accent-soft)}
```

```css
.cm-media{height:110px;border-radius:10px;background:linear-gradient(135deg,rgba(79,125,255,.22),rgba(139,92,246,.16),rgba(34,211,238,.16));opacity:0;transform:scale(.94);transition:opacity .6s var(--ease),transform .6s var(--ease)}
```
becomes:
```css
.cm-media{height:110px;border-radius:var(--r-sm);background:var(--surface-sunken);border:1px solid var(--line);opacity:0;transform:scale(.97);transition:opacity var(--t-reveal) var(--ease-out),transform var(--t-reveal) var(--ease-out)}
```

```css
.cm-stat{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted);font-weight:600}
.cm-stat svg{color:var(--muted-2)}
.cm-stat b{font-size:14px;color:var(--text);font-weight:700}
```
becomes:
```css
.cm-stat{display:flex;align-items:center;gap:var(--sp-1);font-family:var(--font-ui);font-size:var(--fs-micro);color:var(--muted);font-weight:600}
.cm-stat svg{color:var(--muted-2)}
.cm-stat b{font-size:var(--fs-small);color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums}
```

```css
.funnel-mock{position:relative;z-index:2;margin:-28px 0 0 auto;width:min(320px,84%);border:1px solid var(--line-strong);border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:14px;background:linear-gradient(165deg,rgba(18,26,48,.97),rgba(10,15,31,.97));box-shadow:var(--shadow);opacity:0;transform:translateY(24px);transition:opacity .6s var(--ease) 1.05s,transform .6s var(--ease) 1.05s}
```
becomes:
```css
.funnel-mock{position:relative;z-index:2;margin:-28px 0 0 auto;width:min(320px,84%);border:1px solid var(--line);border-radius:var(--r-md);padding:var(--sp-4);display:flex;flex-direction:column;gap:var(--sp-3);background:var(--surface);box-shadow:var(--shadow-md);opacity:0;transform:translateY(16px);transition:opacity var(--t-reveal) var(--ease-out) .9s,transform var(--t-reveal) var(--ease-out) .9s}
```

```css
.fn-label{font-size:12.5px;color:var(--muted)}
.fn-bar{height:8px;border-radius:99px;background:rgba(148,163,184,.12);overflow:hidden}
.fn-bar i{display:block;height:100%;border-radius:99px;width:0;background:linear-gradient(90deg,var(--accent),var(--accent-3));transition:width 1s var(--ease) 1.3s}
.web-visual.in .fn-bar i{width:var(--w)}
.fn-row.fn-good .fn-bar i{background:linear-gradient(90deg,var(--good),var(--accent-3))}
.fn-row b{font-size:13px;font-weight:700;text-align:right;color:var(--text)}
```
becomes:
```css
.fn-label{font-family:var(--font-ui);font-size:var(--fs-micro);color:var(--muted)}
.fn-bar{height:8px;border-radius:var(--r-pill);background:var(--surface-sunken);overflow:hidden}
.fn-bar i{display:block;height:100%;border-radius:var(--r-pill);width:0;background:var(--accent);transition:width var(--t-data) var(--ease-out) 1.1s}
.web-visual.in .fn-bar i{width:var(--w)}
.fn-row.fn-good .fn-bar i{background:var(--good)}
.fn-row b{font-family:var(--font-ui);font-size:var(--fs-micro);font-weight:700;text-align:right;color:var(--ink);font-variant-numeric:tabular-nums}
```

- [ ] **Step 6: Convert the dashboard mockup to an inverted panel**

Find ([index.html:401-427](../../../index.html#L401-L427)) and replace:

```css
.dash-mock{position:relative;z-index:1;border:1px solid var(--line-strong);border-radius:var(--radius);overflow:hidden;background:var(--surface);box-shadow:var(--shadow)}
.dash-body{padding:22px;display:flex;flex-direction:column;gap:20px}
.dash-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.dk{display:flex;flex-direction:column;gap:6px;padding:14px;border:1px solid var(--line);border-radius:10px;opacity:0;transform:translateY(10px);transition:opacity .5s var(--ease),transform .5s var(--ease)}
.web-visual.in .dk{opacity:1;transform:none}
.web-visual.in .dk:nth-child(1){transition-delay:.1s}
.web-visual.in .dk:nth-child(2){transition-delay:.2s}
.web-visual.in .dk:nth-child(3){transition-delay:.3s}
.dk-label{font-size:11.5px;color:var(--muted-2);letter-spacing:.04em;text-transform:uppercase}
.dk b{font-size:22px;font-weight:800;letter-spacing:-.02em;color:var(--text)}
.dk-delta{font-size:12px;font-weight:600}
.dk-delta.good{color:var(--good)}
.dk-delta.warn{color:var(--warn)}

.dash-chart{display:flex;flex-direction:column;gap:8px;padding-top:6px;border-top:1px solid var(--line)}
.dc-bars{display:flex;align-items:flex-end;gap:10px;height:90px}
.dc-bars i{display:block;flex:1 1 auto;border-radius:6px 6px 2px 2px;height:0;background:linear-gradient(180deg,var(--accent-3),var(--accent));transition:height 1s var(--ease)}
```

With:

```css
.dash-mock{position:relative;z-index:1;border:1px solid var(--panel);border-radius:var(--r-md);overflow:hidden;background:var(--panel);color:var(--on-panel);box-shadow:var(--shadow-md)}
.dash-mock .bm-bar{background:var(--panel-2);border-bottom-color:var(--line-invert)}
.dash-mock .bm-dot{background:rgba(247,247,245,.22)}
.dash-mock .bm-url{background:var(--panel);border-color:var(--line-invert);color:var(--on-panel-muted)}
.dash-mock .bm-live{color:var(--good-invert)}
.dash-body{padding:var(--sp-5);display:flex;flex-direction:column;gap:var(--sp-5)}
.dash-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--sp-3)}
.dk{display:flex;flex-direction:column;gap:var(--sp-2);padding:var(--sp-4);border:1px solid var(--line-invert);border-radius:var(--r-sm);background:var(--panel-2);opacity:0;transform:translateY(10px);transition:opacity var(--t-reveal) var(--ease-out),transform var(--t-reveal) var(--ease-out)}
.web-visual.in .dk{opacity:1;transform:none}
.web-visual.in .dk:nth-child(1){transition-delay:60ms}
.web-visual.in .dk:nth-child(2){transition-delay:120ms}
.web-visual.in .dk:nth-child(3){transition-delay:180ms}
.dk-label{font-family:var(--font-mono);font-size:var(--fs-label);color:var(--on-panel-muted);letter-spacing:.12em;text-transform:uppercase}
.dk b{font-family:var(--font-ui);font-size:var(--fs-h3);font-weight:700;letter-spacing:-.012em;color:var(--on-panel);font-variant-numeric:tabular-nums}
.dk-delta{font-family:var(--font-ui);font-size:var(--fs-micro);font-weight:600}
.dk-delta.good{color:var(--good-invert)}
.dk-delta.warn{color:var(--warn-invert)}

.dash-chart{display:flex;flex-direction:column;gap:var(--sp-2);padding-top:var(--sp-2);border-top:1px solid var(--line-invert)}
.dc-bars{display:flex;align-items:flex-end;gap:var(--sp-2);height:90px}
.dc-bars i{display:block;flex:1 1 auto;border-radius:var(--r-sm) var(--r-sm) 2px 2px;height:0;background:var(--accent-on-panel);transition:height var(--t-data) var(--ease-out)}
```

Then update the bar stagger ([index.html:419-425](../../../index.html#L419-L425)) to the capped values:

```css
.web-visual.in .dc-bars i:nth-child(1){transition-delay:.45s}
.web-visual.in .dc-bars i:nth-child(2){transition-delay:.52s}
.web-visual.in .dc-bars i:nth-child(3){transition-delay:.59s}
.web-visual.in .dc-bars i:nth-child(4){transition-delay:.66s}
.web-visual.in .dc-bars i:nth-child(5){transition-delay:.73s}
.web-visual.in .dc-bars i:nth-child(6){transition-delay:.8s}
.web-visual.in .dc-bars i:nth-child(7){transition-delay:.87s}
```
becomes:
```css
.web-visual.in .dc-bars i:nth-child(1){transition-delay:240ms}
.web-visual.in .dc-bars i:nth-child(2){transition-delay:290ms}
.web-visual.in .dc-bars i:nth-child(3){transition-delay:340ms}
.web-visual.in .dc-bars i:nth-child(4){transition-delay:390ms}
.web-visual.in .dc-bars i:nth-child(5){transition-delay:440ms}
.web-visual.in .dc-bars i:nth-child(6){transition-delay:490ms}
.web-visual.in .dc-bars i:nth-child(7){transition-delay:540ms}
```

And the chart labels ([index.html:427](../../../index.html#L427)):
```css
.dc-labels span{flex:1 1 auto;text-align:center;font-size:11px;color:var(--muted-2)}
```
becomes:
```css
.dc-labels span{flex:1 1 auto;text-align:center;font-family:var(--font-mono);font-size:var(--fs-label);color:var(--on-panel-muted)}
```

- [ ] **Step 7: Convert the pipeline flow to an inverted panel**

Find ([index.html:430-446](../../../index.html#L430-L446)) and replace:

```css
.flow-mock{position:relative;z-index:1;border:1px solid var(--line-strong);border-radius:var(--radius);padding:28px 22px;background:var(--surface);box-shadow:var(--shadow);display:flex;flex-direction:column;gap:22px}
.flow-row{display:flex;align-items:center;gap:14px}
.flow-node{flex:1 1 0;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:16px 10px;border:1px solid var(--line);border-radius:12px;font-size:12.5px;color:var(--muted);opacity:0;transform:translateY(10px);transition:opacity .5s var(--ease),transform .5s var(--ease),border-color .4s,background .4s}
.web-visual.in .flow-node{opacity:1;transform:none}
.web-visual.in .flow-node:nth-child(1){transition-delay:.1s}
.web-visual.in .flow-node:nth-child(3){transition-delay:.4s}
.web-visual.in .flow-node:nth-child(5){transition-delay:.7s}
.flow-node .fl-icon{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(135deg,rgba(79,125,255,.16),rgba(139,92,246,.12));border:1px solid var(--line-strong);color:var(--accent-3)}
.flow-node.fl-done{border-color:rgba(52,211,153,.35);background:rgba(52,211,153,.06);color:var(--text)}
.flow-node.fl-done .fl-icon{background:rgba(52,211,153,.14);border-color:rgba(52,211,153,.35);color:var(--good)}
.fl-arrow{flex:0 0 auto;color:var(--muted-2);opacity:0;transition:opacity .4s var(--ease)}
.web-visual.in .fl-arrow{opacity:1;transition-delay:.3s}
.web-visual.in .fl-arrow:nth-of-type(4){transition-delay:.6s}
.flow-foot{display:flex;align-items:center;gap:10px;padding-top:16px;border-top:1px solid var(--line);font-size:12.5px;color:var(--muted-2)}
.flow-pulse{width:9px;height:9px;border-radius:50%;background:var(--good);position:relative;flex:0 0 auto}
.web-visual.in .flow-pulse::before{content:"";position:absolute;inset:0;border-radius:50%;border:1px solid var(--good);animation:ping 2.4s ease-out infinite}
```

With:

```css
.flow-mock{position:relative;z-index:1;border:1px solid var(--panel);border-radius:var(--r-md);padding:var(--sp-6) var(--sp-5);background:var(--panel);color:var(--on-panel);box-shadow:var(--shadow-md);display:flex;flex-direction:column;gap:var(--sp-5)}
.flow-row{display:flex;align-items:center;gap:var(--sp-3)}
.flow-node{flex:1 1 0;display:flex;flex-direction:column;align-items:center;gap:var(--sp-2);text-align:center;padding:var(--sp-4) var(--sp-3);border:1px solid var(--line-invert);border-radius:var(--r-sm);background:var(--panel-2);font-family:var(--font-ui);font-size:var(--fs-micro);color:var(--on-panel-muted);opacity:0;transform:translateY(10px);transition:opacity var(--t-reveal) var(--ease-out),transform var(--t-reveal) var(--ease-out)}
.web-visual.in .flow-node{opacity:1;transform:none}
.web-visual.in .flow-node:nth-child(1){transition-delay:60ms}
.web-visual.in .flow-node:nth-child(3){transition-delay:120ms}
.web-visual.in .flow-node:nth-child(5){transition-delay:180ms}
.flow-node .fl-icon{width:38px;height:38px;border-radius:var(--r-sm);display:grid;place-items:center;background:rgba(215,133,92,.14);border:1px solid rgba(215,133,92,.3);color:var(--accent-on-panel)}
.flow-node.fl-done{border-color:rgba(95,191,143,.35);background:rgba(95,191,143,.08);color:var(--on-panel)}
.flow-node.fl-done .fl-icon{background:rgba(95,191,143,.16);border-color:rgba(95,191,143,.35);color:var(--good-invert)}
.fl-arrow{flex:0 0 auto;color:var(--on-panel-muted);opacity:0;transition:opacity var(--t-reveal) var(--ease-out)}
.web-visual.in .fl-arrow{opacity:1;transition-delay:100ms}
.web-visual.in .fl-arrow:nth-of-type(4){transition-delay:160ms}
.flow-foot{display:flex;align-items:center;gap:var(--sp-2);padding-top:var(--sp-4);border-top:1px solid var(--line-invert);font-family:var(--font-ui);font-size:var(--fs-micro);color:var(--on-panel-muted)}
.flow-pulse{width:9px;height:9px;border-radius:50%;background:var(--good-invert);position:relative;flex:0 0 auto}
```

The `ping` infinite loop is removed here. It is still used by `.s-pulse`, so the keyframe stays — Step 8 handles that one.

- [ ] **Step 8: Convert the last infinite loop to a one-shot**

Find ([index.html:242](../../../index.html#L242)):
```css
.service-card .s-pulse::before{content:"";position:absolute;inset:0;border-radius:50%;border:1px solid var(--accent);animation:ping 2.4s ease-out infinite}
```
Replace with:
```css
.service-card .s-pulse::before{content:"";position:absolute;inset:0;border-radius:50%;border:1px solid var(--accent-line)}
```

Then delete the now-unused keyframe ([index.html:246](../../../index.html#L246)):
```css
@keyframes ping{0%{transform:scale(.7);opacity:.8}100%{transform:scale(1.7);opacity:0}}
```

- [ ] **Step 9: Run the harness**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```
Expected:
- `infiniteAnims` is `0`
- `consoleErrors` is `[]`

Open `tmp_desktop_full.png` and confirm the browser and campaign mockups are light, and the dashboard and pipeline mockups are black panels.

- [ ] **Step 10: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Rebuild the four mockups for a light ground

The browser and campaign mockups go light, because real browser and
social chrome is light - on the dark version they were dark-on-dark and
read as illustrations rather than windows.

The KPI dashboard and the automation pipeline become inverted panels. A
black dashboard on a white page reads as a real product screenshot,
which is the credibility gain the dark version could not get because a
dark mockup on a dark page was just more dark page.

Converts the last three infinite loops - liveBlink and two ping pulses -
to one-shot transitions. The page now runs zero infinite animations,
down from thirteen.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: Analytics, social preview and crawl files

Delivers audit finding P0-7.

**Files:**
- Modify: `index.html:6-20` (meta), `32-39` (GA4)
- Create: `og-image.png`, `robots.txt`, `sitemap.xml`

- [ ] **Step 1: Remove the placeholder GA4 block**

Find ([index.html:32-39](../../../index.html#L32-L39)):

```html
<!-- Google Analytics 4 — replace G-XXXXXXXXXX with the real Measurement ID before go-live -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

Replace with:

```html
<!-- Google Analytics 4 — paste the real Measurement ID between the markers below
     and uncomment the block. Until then no analytics script is loaded, so the
     page does not ship ~130KB of JS reporting to a non-existent property.
     The generate_lead click handler at the bottom of the page is a safe no-op
     while gtag is undefined.
     GA4_MEASUREMENT_ID_GOES_HERE
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
-->
```

- [ ] **Step 2: Generate the OG image**

Create `tmp_og.js`:

```js
const { chromium } = require('playwright');
const html = `<!doctype html><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@600;700&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  *{margin:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:#FFFFFF;color:#111315;
       font-family:'Instrument Sans',sans-serif;display:flex;flex-direction:column;
       justify-content:space-between;padding:72px;border-bottom:14px solid #A94F26}
  .brand{display:flex;align-items:center;gap:14px;font-size:24px;font-weight:700;letter-spacing:-.02em}
  .glyph{width:44px;height:44px;border-radius:8px;background:#111315;display:grid;place-items:center}
  h1{font-size:74px;line-height:1.04;letter-spacing:-.03em;font-weight:700;max-width:16ch}
  .foot{display:flex;align-items:center;gap:28px;font-family:'IBM Plex Mono',monospace;
        font-size:17px;letter-spacing:.1em;text-transform:uppercase;color:#6E747C}
  .foot b{color:#A94F26;font-weight:500}
</style>
<div class="brand">
  <span class="glyph"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 16l4-5 4 3 4-7 4 5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="8" r="1.8" fill="#fff"/></svg></span>
  Dayam Insights
</div>
<h1>Your business runs on five spreadsheets. It shouldn't have to.</h1>
<div class="foot"><b>Dashboards</b><b>Automation</b><b>Websites</b><b>AI assistants</b></div>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1200,height:630}, deviceScaleFactor:1 });
  await p.setContent(html, { waitUntil:'networkidle' });
  await p.screenshot({ path:'og-image.png' });
  await b.close();
  console.log('og-image.png written');
})();
```

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_og.js && ls -la og-image.png
```
Expected: `og-image.png written` and a file of roughly 40–90 KB.

Then remove the generator:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && rm tmp_og.js
```

- [ ] **Step 3: Fix the meta block**

Find ([index.html:6-20](../../../index.html#L6-L20)):

```html
<meta name="description" content="Dayam Insights helps SMEs, retailers, distributors, e-commerce and manufacturers eliminate inefficiencies, automate operations, and turn business data into growth.">
<title>Dayam Insights — Eliminate inefficiencies. Automate operations. Turn data into growth.</title>
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<link rel="canonical" href="https://dayaminsights.com/">
<meta name="robots" content="index,follow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Dayam Insights">
<meta property="og:title" content="Dayam Insights — Turn data into growth">
<meta property="og:description" content="Websites, marketing, dashboards, automation & AI assistants — one team to help your business look professional online, get more customers, and save time on daily tasks.">
<meta property="og:url" content="https://dayaminsights.com/">
<meta property="og:image" content="https://dayaminsights.com/favicon.svg">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Dayam Insights — Turn data into growth">
<meta name="twitter:description" content="Websites, marketing, dashboards, automation & AI assistants — one team to help your business grow.">
<meta name="twitter:image" content="https://dayaminsights.com/favicon.svg">
```

Replace with:

```html
<meta name="description" content="Dashboards, automation and AI assistants for Indian SMEs. We connect your orders, stock and invoices into one system that updates itself. Live in 4–6 weeks.">
<title>Dashboards &amp; Business Automation for SMEs | Dayam Insights</title>
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<link rel="apple-touch-icon" href="og-image.png">
<link rel="canonical" href="https://dayaminsights.com/">
<meta name="robots" content="index,follow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Dayam Insights">
<meta property="og:title" content="Dashboards &amp; Business Automation for SMEs">
<meta property="og:description" content="We connect your orders, stock and invoices into one system that updates itself — and put your numbers on one screen you can check from your phone.">
<meta property="og:url" content="https://dayaminsights.com/">
<meta property="og:image" content="https://dayaminsights.com/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Dayam Insights — dashboards, automation, websites and AI assistants for Indian SMEs.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Dashboards &amp; Business Automation for SMEs">
<meta name="twitter:description" content="We connect your orders, stock and invoices into one system that updates itself.">
<meta name="twitter:image" content="https://dayaminsights.com/og-image.png">
```

Title goes from 89 characters to 57, which fits the SERP truncation point; description goes from 178 to 152.

- [ ] **Step 4: Create `robots.txt`**

Create `robots.txt`:

```
User-agent: *
Allow: /

Sitemap: https://dayaminsights.com/sitemap.xml
```

- [ ] **Step 5: Create `sitemap.xml`**

Create `sitemap.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://dayaminsights.com/</loc>
    <lastmod>2026-08-30</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

- [ ] **Step 6: Verify all three files serve**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && for f in og-image.png robots.txt sitemap.xml; do printf '%-14s ' "$f"; curl -s -o /dev/null -w '%{http_code} %{content_type}\n' "http://localhost:8090/$f"; done
```
Expected:
```
og-image.png   200 image/png
robots.txt     200 text/plain
sitemap.xml    200 application/xml
```

- [ ] **Step 7: Run the harness**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```
Expected: `consoleErrors` is `[]` — confirming that removing gtag did not break the `generate_lead` click handler, which guards on `typeof window.gtag === 'function'`.

- [ ] **Step 8: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html og-image.png robots.txt sitemap.xml && git commit -m "Fix analytics, social preview and crawl files

The GA4 block was live with the placeholder ID G-XXXXXXXXXX, so every
visitor downloaded roughly 130KB of analytics JavaScript that reported
nowhere. It is now commented out with a clearly marked insertion point.
The generate_lead click handler is kept and is a safe no-op while gtag
is undefined.

og:image pointed at favicon.svg. No social platform renders SVG in link
previews, so every WhatsApp share - the most common way this site will
be shared - previewed as a bare text link. Replaced with a real 1200x630
PNG, plus width, height and alt, and twitter:card upgraded to
summary_large_image.

Title trimmed from 89 to 57 characters and description from 178 to 152,
both inside their truncation points, and the title now leads with what
the business sells rather than three verbs.

Adds robots.txt and sitemap.xml, neither of which existed.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 11: Number formatting, counters and responsive sweep

**Files:**
- Modify: `index.html:1496-1523` (`animateCount`)
- Modify: `index.html:663-665` (hero stat markup)
- Modify: `index.html:544-588` (responsive block)

- [ ] **Step 1: Add Indian digit grouping to the counter**

Find ([index.html:1496-1512](../../../index.html#L1496-L1512)):

```js
  function animateCount(el){
    var target = parseFloat(el.getAttribute('data-count'));
    var dec = parseInt(el.getAttribute('data-dec')||'0',10);
    var prefix = el.getAttribute('data-prefix')||'';
    var suffix = el.getAttribute('data-suffix')||'';
    if (reduce){ el.textContent = prefix + target.toFixed(dec) + suffix; return; }
    var start = null, dur = 1400;
    function step(ts){
      if(!start) start = ts;
      var p = Math.min((ts-start)/dur, 1);
      var eased = 1 - Math.pow(1-p, 3);
      el.textContent = prefix + (target*eased).toFixed(dec) + suffix;
      if(p<1) requestAnimationFrame(step);
      else el.textContent = prefix + target.toFixed(dec) + suffix;
    }
    requestAnimationFrame(step);
  }
```

Replace with:

```js
  // Indian digit grouping: 48200 -> "48,200", 1240000 -> "12,40,000".
  // Applied to any value >= 1000 so ₹ figures and reach counts read correctly.
  var groupFmt = new Intl.NumberFormat('en-IN');
  function fmt(n, dec){
    if (dec > 0) return n.toFixed(dec);
    var v = Math.round(n);
    return v >= 1000 ? groupFmt.format(v) : String(v);
  }

  function animateCount(el){
    var target = parseFloat(el.getAttribute('data-count'));
    var dec = parseInt(el.getAttribute('data-dec')||'0',10);
    var prefix = el.getAttribute('data-prefix')||'';
    var suffix = el.getAttribute('data-suffix')||'';
    if (reduce){ el.textContent = prefix + fmt(target, dec) + suffix; return; }
    var start = null, dur = 900;
    function step(ts){
      if(!start) start = ts;
      var p = Math.min((ts-start)/dur, 1);
      var eased = 1 - Math.pow(1-p, 3);
      el.textContent = prefix + fmt(target*eased, dec) + suffix;
      if(p<1) requestAnimationFrame(step);
      else el.textContent = prefix + fmt(target, dec) + suffix;
    }
    requestAnimationFrame(step);
  }
```

Duration drops from 1400ms to 900ms per spec §9.2.

- [ ] **Step 2: Stop animating the service count**

Find ([index.html:665](../../../index.html#L665)):

```html
      <div class="m"><b data-count="5" data-suffix="">0</b><span>Services, One Team</span></div>
```

Replace with:

```html
      <div class="m"><b>5</b><span>Services, One Team</span></div>
```

Counting up to the number of your own service lines is motion spent on nothing. The other two hero stats keep their counters; Plan 2 replaces all three with defensible facts.

- [ ] **Step 3: Update the responsive block to the spacing scale**

Find ([index.html:561-588](../../../index.html#L561-L588)) — the `@media(max-width:760px)` block — and replace these rules inside it:

```css
  .service-card{padding:18px;gap:12px}
  .service-card .s-icon{width:44px;height:44px}
  .service-card .s-text h3{font-size:15.5px}
  .service-card .s-text p{font-size:12.5px}
```
becomes:
```css
  .service-card{padding:var(--sp-4);gap:var(--sp-3)}
  .service-card .s-icon{width:44px;height:44px}
  .service-card .s-text h3{font-size:var(--fs-h4)}
  .service-card .s-text p{font-size:var(--fs-micro)}
```

```css
  .search-mock{margin-top:-24px;padding:12px}
  .funnel-mock{margin-top:-20px;padding:14px;gap:12px}
```
becomes:
```css
  .search-mock{margin-top:-24px;padding:var(--sp-3)}
  .funnel-mock{margin-top:-20px;padding:var(--sp-4);gap:var(--sp-3)}
```

Then add these two rules at the end of the same block, before its closing brace:

```css
  .foot-col a{padding:var(--sp-3) 0}
  .cta-band{padding:var(--sp-7) var(--sp-5)}
```

- [ ] **Step 4: Replace the remaining `54px` margins**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && grep -n 'margin-top:54px' index.html
```

Replace every hit's `54px` with `var(--sp-7)`. There are five: `.prob-grid`, `.proc-grid`, `.res-grid`, `.tech-groups`, `.why-grid`. Also update `.web-show .section-head{margin-bottom:54px}` to `var(--sp-7)` and `.web-stats{margin-top:30px;padding-top:26px}` to `margin-top:var(--sp-6);padding-top:var(--sp-5)`.

Verify:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && grep -c '54px' index.html
```
Expected: `0`

- [ ] **Step 5: Remove the inline style on the CTA section**

Find ([index.html:1225](../../../index.html#L1225)):

```html
<section class="wrap" id="cta" style="padding:10px 24px clamp(40px,6vw,72px)">
```

Replace with:

```html
<section class="pad wrap" id="cta" aria-labelledby="h-cta">
```

If Task 7 already added `aria-labelledby` here, this step only removes the inline `style` and adds `pad`.

- [ ] **Step 6: Remove the inline style in the problem intro**

Find ([index.html:745](../../../index.html#L745)):

```html
    <p>If you're <strong style="color:var(--text)">stuck updating five different Excel sheets every week</strong>, double-checking numbers that still come out wrong, finding out what sold last month — next month, or losing customers who couldn't even find you online — you're not bad at running your business. Your business is just missing the right tools.</p>
```

Replace with:

```html
    <p>If you're <strong>stuck updating five different Excel sheets every week</strong>, double-checking numbers that still come out wrong, or finding out what sold last month — next month, you're not bad at running your business. Your business is just missing the right tools.</p>
```

Add the matching rule next to `.section-head p` in the stylesheet:

```css
.section-head p strong{color:var(--ink);font-weight:600}
```

This also trims the 60-word run-on sentence to two clauses, per the audit's typography finding. It is the one copy change in this plan, and it is made because the sentence structure was the defect.

- [ ] **Step 7: Run the harness at both widths**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```
Expected:
- `mobile.horizontalOverflow` is `false`
- `mobile.scrollWidth` equals `mobile.clientWidth`
- `consoleErrors` is `[]`

- [ ] **Step 8: Confirm the counters render grouped digits**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node -e "
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1440,height:900}});
  await p.goto('http://localhost:8090/index.html',{waitUntil:'networkidle'});
  await p.evaluate(()=>document.querySelector('#dashboards').scrollIntoView());
  await p.waitForTimeout(1800);
  const vals=await p.evaluate(()=>Array.from(document.querySelectorAll('#dashVisual [data-count]')).map(e=>e.textContent));
  console.log(vals);
  await b.close();
})();"
```
Expected: the array contains `₹48,200` — with the comma — not `₹48200`.

- [ ] **Step 9: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Format numbers, shorten counters, finish the spacing sweep

Counters wrote toFixed() output directly, so figures rendered as
₹48200 and 12400. They now use Intl.NumberFormat('en-IN'), giving
Indian digit grouping - ₹48,200 and 12,40,000. Duration drops from
1400ms to 900ms.

Removes the count-up on \"5 services\": animating the number of your own
service lines is motion spent on nothing.

Replaces the last five 54px margins and both inline style attributes
with scale values. The CTA section regains standard .pad spacing - its
inline padding:10px collapsed a 96px rhythm to 10px immediately before
the most important section on the page, which read as a layout bug at
the conversion moment.

Trims the problem-section intro from one 60-word run-on sentence to two.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 12: Final verification sweep

**Files:** none modified — verification only.

- [ ] **Step 1: Full harness run**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```

Every one of these must hold:

| Field | Required value |
|---|---|
| `tokens["--bg"]` | `#FFFFFF` |
| `tokens["--accent"]` | `#A94F26` |
| `tokens["--muted-2"]` | `#6E747C` |
| `bodyBg` | `rgb(255, 255, 255)` |
| `fonts.body` | contains `Source Serif 4` |
| `fonts.h1` | contains `Instrument Sans` |
| `decoration.*` | all `0` |
| `blurCount` | `0` |
| `infiniteAnims` | `0` |
| `a11y.main` | `1` |
| `a11y.skipLink` | `true` |
| `a11y.sectionsLabelled` | equals `a11y.sectionsTotal` |
| `a11y.bareSvgs` | `0` |
| `focusOutline.width` | `2px` |
| `heroStageHeight` | `1170px` |
| `mobile.horizontalOverflow` | `false` |
| `contrast[*].ratio` | every value ≥ `4.5` |
| `consoleErrors` | `[]` |

- [ ] **Step 2: Confirm no old-system references survive**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && for s in 'glow-orb' 'glow-chip' 'path-chip' 'grid-lines' 'bg-field' 'backdrop-filter' 'JetBrains' "'Inter'" 'accent-2' 'accent-3' 'var(--text)' '54px' 'G-XXXXXXXXXX' 'linear-gradient(135deg,var(--accent)'; do printf '%-34s %s\n' "$s" "$(grep -c -- "$s" index.html)"; done
```
Expected: every count is `0`, except `G-XXXXXXXXXX`, which is `2` — both inside the commented-out GA4 block awaiting a real ID.

- [ ] **Step 3: Confirm tag and brace balance**

This repo's convention (per `PROJECT_NOTES.md`) is to verify tag balance after any structural edit.

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && for t in section div span svg a main; do o=$(grep -o "<$t[ >]" index.html | wc -l); c=$(grep -o "</$t>" index.html | wc -l); printf '%-8s open=%-4s close=%-4s %s\n' "$t" "$o" "$c" "$([ "$o" = "$c" ] && echo OK || echo MISMATCH)"; done; echo "braces: $(grep -o '{' index.html | wc -l) open / $(grep -o '}' index.html | wc -l) close"
```
Expected: every tag reports `OK`, and the brace counts match.

- [ ] **Step 4: Confirm no orphaned keyframes or dead CSS**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && for k in $(grep -o '@keyframes [a-zA-Z]*' index.html | awk '{print $2}' | sort -u); do uses=$(grep -c "animation:$k\|animation: $k\|animation-name:$k" index.html); printf '%-12s declared, %s use(s) %s\n' "$k" "$uses" "$([ "$uses" -gt 0 ] && echo '' || echo '<-- ORPHANED, delete it')"; done```
Expected: every keyframe reports at least 1 use. Any line marked `ORPHANED` names a keyframe left behind by Tasks 3 or 9 — delete it.

- [ ] **Step 5: Visual review at both widths**

Open `tmp_desktop_full.png` and `tmp_mobile.png` and confirm:

- The page ground is white; the two showcase sections sit on a `--bg-2` band.
- The KPI dashboard and the automation pipeline render as black panels; the browser and campaign mockups render light.
- The final CTA band is a black panel with a white primary button.
- No blue, violet or cyan appears anywhere.
- No blurred glow, grid overlay or floating chip appears anywhere.
- Body copy renders in a serif; every heading, button, label and stat renders in a sans.
- Nothing is clipped, overlapping, or horizontally scrolling at 390px.

- [ ] **Step 6: Keyboard pass**

Load `http://localhost:8090/index.html` in a real browser. Press Tab from the top and confirm:

1. The first Tab reveals the "Skip to content" link at the top-left.
2. Every nav link, button and card link shows a visible blue focus ring.
3. The focus ring inside the black CTA band is the lighter `--focus-invert` blue, not the dark one.
4. Focus order follows visual order with no traps.

- [ ] **Step 7: Reduced-motion pass**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node -e "
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8090/index.html',{waitUntil:'networkidle'});
  const r=await p.evaluate(()=>({
    stage:getComputedStyle(document.querySelector('.hero-morph-stage')).height,
    revealsHidden:Array.from(document.querySelectorAll('.reveal')).filter(e=>getComputedStyle(e).opacity==='0').length,
    hoverStillTransitions:getComputedStyle(document.querySelector('.btn-primary')).transitionDuration
  }));
  console.log(JSON.stringify(r),'errors:',errs);
  await b.close();
})();"
```
Expected: `stage` is `auto` (the morph is disabled), `revealsHidden` is `0` (nothing stays invisible), `hoverStillTransitions` is `0.12s` (colour feedback survives), and `errors: []`.

- [ ] **Step 8: Stop the server and clean up**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && pkill -f tmp_serve.js; rm -f tmp_serve.js tmp_check.js tmp_*.png; git status --short
```
Expected: `git status --short` shows no untracked `tmp_*` files. `og-image.png`, `robots.txt` and `sitemap.xml` are already committed by Task 10.

- [ ] **Step 9: Confirm the working tree is clean**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && git status --short && git log --oneline -12
```
Expected: a clean tree, and eleven migration commits plus the two spec commits.

---

## Self-review

**Spec coverage.** Walking the spec section by section:

| Spec § | Requirement | Task |
|---|---|---|
| 2.1–2.8 | Full token block | 1 |
| 2.9 | Removed tokens and effects | 3, 8 |
| 3.1 | Font families and loading | 2 |
| 3.2 | Type scale | 1 (tokens), 2, 4, 5, 9 (applied) |
| 3.3 | `balance`, `pretty`, `tabular-nums`, no antialiasing | 1, 2, 4, 11 |
| 4 | Spacing scale | 1, 11 |
| 5 | Layout, containers, full-bleed, section rhythm | 7 |
| 6 | Radii | 1, 4, 9 |
| 7 | Elevation | 1, 4, 9 |
| 8.1 | Buttons incl. black primary and focus | 4, 7 |
| 8.2 | Cards, hover only on links | 4 |
| 8.3 | Eyebrow | 2 |
| 8.4 | Icon container | 4 |
| 8.5 | Stat | 4 |
| 8.6 | Inverted panel | 4 (CTA), 9 (mockups) |
| 9.1–9.2 | Motion tokens, reveal, hover, counters | 5, 11 |
| 9.3 | Removed animation | 3, 9 |
| 9.4 | Reduced motion | 5 |
| 10 | Mockup treatment | 9 |
| 11 | Accessibility floor | 7 |
| 12 | Performance floor | 3, 5, 6, 10 |
| 13 | Migration map | 8 |
| 14.2 | Sentinel styling | 7 |

Two spec items are deliberately **not** in this plan and belong to Plan 2, because both require copy or markup that does not yet exist:

- §14.2 sentinel *content* — Task 7 ships the `[data-sentinel]` style, but nothing uses it until the founder block and contact details land in Plan 2.
- §11's "real `<button>` for the mobile menu with `aria-expanded`" — the mobile nav is Plan 2. Task 4 does raise `.nav-toggle` to 44px so the touch-target floor is met in the meantime.

**Placeholder scan.** No `TBD`, no "add error handling", no "similar to Task N". Every step that changes code shows the code. The one intentional placeholder is the commented GA4 block in Task 10, which is a deliberate deliverable with a marked insertion point, not an unfinished step.

**Type and name consistency.** Checked across tasks: `measureHeroMorphOffsets`, `measureDocument`, `heroStageRectTop`, `textCenterOffset`, `heroVisualStartWidth`, `docScrollMax` and `fmt` are each defined once (Tasks 6 and 11) and referenced consistently afterwards. `--surface-sunken` is used throughout rather than the v1 name `--surface-2`. `--r-md` / `--r-sm` / `--r-lg` are used consistently; no task references the deleted `--radius`. The `.reveal` class names are preserved in Task 5 precisely so no markup change is needed.

**Ordering risk.** Task 1's shim block is what makes Tasks 2–7 safe to do in any order; Task 8 removes it and proves the migration is complete. Removing Task 1's shims early would break the page.

---

## Handoff

Plan complete. Plan 2 (`2026-08-30-content-ia-conversion.md`) covers the remaining audit findings: hero rewrite, section reorder, services section and naming, `#results` reframing, founder block, mobile navigation, contact form and conversion path, FAQ with schema, and the technology-section collapse.
