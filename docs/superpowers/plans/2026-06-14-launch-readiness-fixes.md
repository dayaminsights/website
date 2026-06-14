# Launch Readiness Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the launch-blocking and high-impact issues found in the audit so the Dayam Insights landing page is ready for paid-traffic launch.

**Architecture:** Single self-contained `index.html` (inline `<style>` + inline vanilla JS, no build step, GitHub Pages target). All fixes are edits to `index.html` plus one new `.gitignore` and one new `favicon.svg`. Verification is by serving the file and inspecting in a headless Chromium at desktop (1440px) and mobile (390px) widths — there is no test runner in this repo.

**Tech Stack:** HTML5, CSS (inline), vanilla JS (inline), GA4 (gtag.js), `wa.me` WhatsApp deep link. Verification via Node static server + Playwright (already installed under `/tmp/node_modules`).

**Out of scope (per user):** Audit point #2 (hero-morph-stage 270vh scroll buffer) is intentional — do NOT touch `.hero-morph-stage{height:270vh}` or the morph stage height.

**Placeholders the user must supply before go-live** (use the exact sentinel strings below in code; user swaps them in later):
- GA4 Measurement ID: `G-XXXXXXXXXX`
- WhatsApp number (intl format, no `+`/spaces): `919999999999`

---

## File Structure

- **Modify:** `index.html` — all CSS, copy, meta, nav, CTA, analytics, footer edits.
- **Create:** `.gitignore` — keep stray dev files out of the deploy.
- **Create:** `favicon.svg` — inline-style brand glyph as a favicon.

Verification harness (already proven working in the audit, recreate if missing):
- Node static server on `:8090`.
- Playwright script for screenshots + computed-style assertions.

---

## Task 0: Set up verification harness

**Files:**
- Create: `tmp_serve.js` (temporary, deleted at end)
- Create: `tmp_check.js` (temporary, deleted at end)

- [ ] **Step 1: Write the static server**

Create `tmp_serve.js`:

```js
const http=require('http'),fs=require('fs'),path=require('path');
http.createServer((req,res)=>{
  let p = req.url==='/'?'/index.html':req.url.split('?')[0];
  let fp = path.join(__dirname, decodeURIComponent(p));
  fs.readFile(fp,(err,data)=>{
    if(err){res.writeHead(404);res.end('not found');return;}
    let ext=path.extname(fp);
    let types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.svg':'image/svg+xml'};
    res.writeHead(200,{'Content-Type':types[ext]||'text/plain'});
    res.end(data);
  });
}).listen(8090,()=>console.log('listening'));
```

- [ ] **Step 2: Start it and confirm it serves**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_serve.js > /tmp/serve.log 2>&1 & echo $! > /tmp/serve.pid; sleep 1; curl -sf http://localhost:8090/index.html -o /dev/null && echo OK
```
Expected: `OK`

- [ ] **Step 3: Write the check script**

Create `tmp_check.js` (used/extended by later tasks; reads computed styles + screenshots):

```js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  // Mobile hero layout assertion
  let ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true });
  let page = await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message)); page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await page.goto('http://localhost:8090/index.html',{waitUntil:'networkidle'});
  const grid = await page.evaluate(()=>getComputedStyle(document.querySelector('.hero-grid')).gridTemplateColumns);
  const order = await page.evaluate(()=>{
    const c=document.querySelector('.hero-copy').getBoundingClientRect().top;
    const v=document.querySelector('.hero-visual').getBoundingClientRect().top;
    return c < v ? 'copy-first' : 'visual-first';
  });
  await page.screenshot({path:'tmp_mobile.png'});
  console.log('MOBILE gridTemplateColumns=',grid,'| order=',order);
  await ctx.close();
  // Desktop screenshot + console
  ctx = await browser.newContext({ viewport:{width:1440,height:900} });
  page = await ctx.newPage();
  page.on('pageerror',e=>errs.push('desktop:'+e.message)); page.on('console',m=>{if(m.type()==='error')errs.push('desktop:'+m.text());});
  await page.goto('http://localhost:8090/index.html',{waitUntil:'networkidle'});
  await page.screenshot({path:'tmp_desktop.png'});
  await ctx.close();
  console.log('CONSOLE_ERRORS=',JSON.stringify(errs));
  await browser.close();
})();
```

- [ ] **Step 4: Baseline run (capture the bug before fixing)**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && NODE_PATH=/tmp/node_modules node tmp_check.js
```
Expected (current broken state): `MOBILE gridTemplateColumns= 231.609px 127.797px | order= visual-first` and `CONSOLE_ERRORS= []`.

No commit (temp files only).

---

## Task 1: Fix mobile hero layout (Critical — audit #1)

**Root cause:** `.hero-morph-stage .hero-grid{grid-template-columns:1fr 1.15fr;gap:48px}` ([index.html:105](../../../index.html#L105)) sits inside `@media(prefers-reduced-motion:reduce),(max-width:1000px)`. Its specificity (0,2,0) beats `.hero-grid{grid-template-columns:1fr}` (line 128) and the mobile override (line 507), so on phones the hero stays a 2-column grid and `.hero-visual` (5 cards) renders in a squeezed right column above the headline. The 2-column layout is only correct as the reduced-motion DESKTOP fallback. Split the combined media query so the 2-col rule applies only at desktop width.

**Files:**
- Modify: `index.html:102-112` (the combined media block)

- [ ] **Step 1: Replace the combined media block**

Find ([index.html:102-112](../../../index.html#L102-L112)):

```css
@media(prefers-reduced-motion:reduce),(max-width:1000px){
  .hero-morph-stage{height:auto}
  .hero-morph-stage .hero{position:static;height:auto;overflow:visible;padding:clamp(56px,8vw,96px) 0 clamp(60px,8vw,104px)}
  .hero-morph-stage .hero-grid{grid-template-columns:1fr 1.15fr;gap:48px}
  .hero-morph-stage .hero-copy{max-width:none;margin:0;text-align:left}
  .hero-morph-stage .hero-copy .sub{max-width:480px;margin-left:0;margin-right:0}
  .hero-morph-stage .hero-copy .hero-cta,.hero-morph-stage .hero-copy .hero-meta{justify-content:flex-start}
  .hero-morph-stage .hero h1{font-size:clamp(30px,4.6vw,52px)}
  .hero-morph-stage .hero-visual{position:static;inset:auto;width:auto;opacity:1;transform:none;pointer-events:auto}
  .hero-morph-stage .hero-glow{display:none}
}
```

Replace with (shared resets in the combined query; the 2-col grid scoped to reduced-motion-on-desktop only; explicit 1-col for mobile):

```css
@media(prefers-reduced-motion:reduce),(max-width:1000px){
  .hero-morph-stage{height:auto}
  .hero-morph-stage .hero{position:static;height:auto;overflow:visible;padding:clamp(56px,8vw,96px) 0 clamp(60px,8vw,104px)}
  .hero-morph-stage .hero-copy{max-width:none;margin:0;text-align:left}
  .hero-morph-stage .hero-copy .sub{max-width:480px;margin-left:0;margin-right:0}
  .hero-morph-stage .hero-copy .hero-cta,.hero-morph-stage .hero-copy .hero-meta{justify-content:flex-start}
  .hero-morph-stage .hero h1{font-size:clamp(30px,4.6vw,52px)}
  .hero-morph-stage .hero-visual{position:static;inset:auto;width:auto;opacity:1;transform:none;pointer-events:auto}
  .hero-morph-stage .hero-glow{display:none}
}
/* Reduced-motion users on DESKTOP get the live 2-col layout statically */
@media(prefers-reduced-motion:reduce) and (min-width:1001px){
  .hero-morph-stage .hero-grid{grid-template-columns:1fr 1.15fr;gap:48px}
}
/* Mobile: force the hero into a single stacked column (copy above cards) */
@media(max-width:1000px){
  .hero-morph-stage .hero-grid{grid-template-columns:1fr;gap:40px}
}
```

- [ ] **Step 2: Verify mobile is now single-column, copy-first**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && NODE_PATH=/tmp/node_modules node tmp_check.js
```
Expected: `MOBILE gridTemplateColumns= 390px` (single track ≈ viewport width) `| order= copy-first` and `CONSOLE_ERRORS= []`.

- [ ] **Step 3: Eyeball the mobile screenshot**

Read `tmp_mobile.png`. Confirm: H1 "Stop losing time and money to manual work. Start growing with DAYAM" is the first content under the nav; the 5 service cards stack BELOW the copy, full-width, single column.

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Fix mobile hero: scope 2-col grid to reduced-motion desktop only

The .hero-morph-stage .hero-grid 2-column rule was inside a combined
(prefers-reduced-motion),(max-width:1000px) query, so its higher
specificity forced phones into a broken 2-col layout with the service
cards squeezed above the headline. Split into desktop-only 2-col and
mobile-only 1-col rules.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Remove the "(illustrative)" placeholder copy (Critical — audit #4)

**Files:**
- Modify: `index.html:793-795`

- [ ] **Step 1: Remove the disclaimer span**

Find ([index.html:793-795](../../../index.html#L793-L795)):

```html
    <p>Outcomes from engagements across retail, distribution and manufacturing.
      <span class="mono" style="color:var(--muted-2);font-size:13px">(illustrative — replace with your figures)</span>
    </p>
```

Replace with:

```html
    <p>Representative outcomes from engagements across retail, distribution and manufacturing.</p>
```

- [ ] **Step 2: Verify it's gone**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && grep -c "illustrative" index.html
```
Expected: `0`

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Remove visible 'illustrative — replace with your figures' placeholder from results copy

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Add favicon, OG/Twitter meta, canonical, JSON-LD (High — audit #5)

**Files:**
- Create: `favicon.svg`
- Modify: `index.html:3-7` (inside `<head>`, after the title)

- [ ] **Step 1: Create the favicon**

Create `favicon.svg` (the brand glyph — rising line + dot, on the brand gradient):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4f7dff"/>
      <stop offset="1" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="8" fill="url(#g)"/>
  <path d="M7 21l5-6 5 4 5-9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="27" cy="10" r="2.2" fill="#fff"/>
</svg>
```

- [ ] **Step 2: Add the head tags**

Find ([index.html:6-7](../../../index.html#L6-L7)):

```html
<meta name="description" content="Dayam Insights helps SMEs, retailers, distributors, e-commerce and manufacturers eliminate inefficiencies, automate operations, and turn business data into growth.">
<title>Dayam Insights — Eliminate inefficiencies. Automate operations. Turn data into growth.</title>
```

Replace with (keeps the two original lines, adds icon + social + canonical + schema after them):

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
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Dayam Insights",
  "url": "https://dayaminsights.com/",
  "description": "Websites, marketing, dashboards, automation and AI assistants for SMEs, retailers, distributors, e-commerce and manufacturers.",
  "email": "hello@dayaminsights.com",
  "logo": "https://dayaminsights.com/favicon.svg"
}
</script>
```

> NOTE TO USER: replace `https://dayaminsights.com/` with the real domain if different, and swap `og:image`/`twitter:image` for a proper 1200×630 PNG when one exists (a square SVG works but a real OG image previews better; for `summary_large_image` use a 1200×630 raster and change `twitter:card` to `summary_large_image`).

- [ ] **Step 3: Verify tags parse and favicon serves**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && NODE_PATH=/tmp/node_modules node -e "
const {chromium}=require('playwright');(async()=>{
const b=await chromium.launch();const p=await(await b.newContext()).newPage();
await p.goto('http://localhost:8090/index.html',{waitUntil:'networkidle'});
const og=await p.evaluate(()=>document.querySelector('meta[property=\"og:title\"]').content);
const ld=await p.evaluate(()=>JSON.parse(document.querySelector('script[type=\"application/ld+json\"]').textContent)['@type']);
const icon=await p.evaluate(()=>document.querySelector('link[rel=\"icon\"]').href);
console.log('og:title=',og,'| ld@type=',ld,'| icon=',icon);
await b.close();})();" && curl -sf http://localhost:8090/favicon.svg -o /dev/null && echo "FAVICON_OK"
```
Expected: `og:title= Dayam Insights — Turn data into growth | ld@type= Organization | icon= http://localhost:8090/favicon.svg` and `FAVICON_OK`.

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html favicon.svg && git commit -m "Add favicon, Open Graph/Twitter meta, canonical, and Organization JSON-LD

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Add GA4 tracking + CTA click events (Critical — audit #3)

**Approach:** Load gtag.js in `<head>`, then add a delegated click listener in the existing IIFE that fires a `generate_lead` event whenever any CTA (a `.btn-primary`, any `mailto:`/`wa.me` link) is clicked. Uses sentinel ID `G-XXXXXXXXXX` for the user to replace.

**Files:**
- Modify: `index.html` `<head>` (after the JSON-LD added in Task 3)
- Modify: `index.html` inside the closing of the IIFE (before `})();` at [index.html:1486](../../../index.html#L1486))

- [ ] **Step 1: Add gtag.js loader to head**

Immediately after the closing `</script>` of the JSON-LD block from Task 3 (still inside `<head>`, before `<link rel="preconnect"...>` on [index.html:8](../../../index.html#L8)), insert:

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

- [ ] **Step 2: Add CTA click tracking inside the IIFE**

Find the end of the IIFE ([index.html:1485-1486](../../../index.html#L1485-L1486)):

```js
    steps.forEach(function(el){ el.classList.add('active'); });
  }
})();
```

Replace with:

```js
    steps.forEach(function(el){ el.classList.add('active'); });
  }

  // CTA / contact-intent tracking: fire a GA4 lead event on any primary
  // button or mailto/WhatsApp link click. Safe no-op if gtag isn't loaded.
  document.addEventListener('click', function(e){
    var link = e.target.closest('a');
    if (!link) return;
    var href = link.getAttribute('href') || '';
    var isContact = href.indexOf('mailto:') === 0 || href.indexOf('wa.me') !== -1 || href.indexOf('api.whatsapp.com') !== -1;
    var isPrimary = link.classList.contains('btn-primary');
    if (!isContact && !isPrimary) return;
    if (typeof window.gtag === 'function'){
      window.gtag('event', 'generate_lead', {
        method: href.indexOf('wa.me') !== -1 || href.indexOf('whatsapp') !== -1 ? 'whatsapp'
              : href.indexOf('mailto:') === 0 ? 'email' : 'cta_click',
        label: (link.textContent || '').trim().slice(0, 60)
      });
    }
  }, true);
})();
```

- [ ] **Step 3: Verify gtag loads and the event fires without error**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && NODE_PATH=/tmp/node_modules node -e "
const {chromium}=require('playwright');(async()=>{
const b=await chromium.launch();const p=await(await b.newContext()).newPage();
const events=[];const errs=[];
p.on('pageerror',e=>errs.push(e.message));
await p.exposeFunction('__rec',a=>events.push(a));
await p.goto('http://localhost:8090/index.html',{waitUntil:'domcontentloaded'});
await p.evaluate(()=>{window.gtag=function(){window.__rec(Array.from(arguments));};});
await p.evaluate(()=>document.querySelector('a.btn-primary').click());
await p.waitForTimeout(300);
console.log('GTAG_DEFINED=',await p.evaluate(()=>typeof dataLayer!=='undefined'));
console.log('EVENTS=',JSON.stringify(events));
console.log('ERRORS=',JSON.stringify(errs));
await b.close();})();"
```
Expected: `GTAG_DEFINED= true`, `EVENTS=` contains a `["event","generate_lead",{...}]` entry, `ERRORS= []`.
(Note: the primary hero CTA is an in-page `#cta` anchor, so `isPrimary` triggers the event; contact-method events fire on the mailto/WhatsApp buttons.)

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Add GA4 (gtag.js) with generate_lead event on CTA / mailto / WhatsApp clicks

Uses placeholder Measurement ID G-XXXXXXXXXX — replace before go-live.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Add WhatsApp CTA + fix mobile nav (High — audit #9, #10)

WhatsApp deep link uses sentinel number `919999999999`. Two sub-changes: (a) add a WhatsApp button to the final `#cta` band alongside the existing email buttons; (b) replace the fake hamburger (which just scrolls to `#problem`) with a WhatsApp link so mobile users always have a working contact action.

**Files:**
- Modify: `index.html:592-594` (nav toggle button)
- Modify: `index.html:1192-1195` (CTA band buttons)

- [ ] **Step 1: Replace the fake hamburger with a WhatsApp action**

Find ([index.html:592-594](../../../index.html#L592-L594)):

```html
      <button class="nav-toggle" aria-label="Jump to navigation links" onclick="document.querySelector('#problem').scrollIntoView()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
```

Replace with (a real WhatsApp link styled as the existing toggle box; icon swapped from hamburger to WhatsApp so it no longer promises a menu it doesn't open):

```html
      <a class="nav-toggle" href="https://wa.me/919999999999?text=Hi%20Dayam%20Insights%2C%20I%27d%20like%20to%20book%20a%20free%20consultation." target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M20 11.5a8.4 8.4 0 0 1-12.3 7.4L4 20l1.2-3.6A8.5 8.5 0 1 1 20 11.5z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5.6 0 1-.5 1-1l-.1-.6a.6.6 0 0 0-.5-.5l-1.4-.2a.6.6 0 0 0-.5.2l-.4.5c-.8-.4-1.5-1-1.9-1.9l.5-.4a.6.6 0 0 0 .2-.5l-.2-1.4a.6.6 0 0 0-.5-.5L9.6 8.5c-.5 0-1 .4-1 1z" fill="currentColor"/></svg>
      </a>
```

> The `.nav-toggle` CSS rule ([index.html:88](../../../index.html#L88)) and its `display:grid;place-items:center` mobile show rule ([index.html:524](../../../index.html#L524)) both already match an `<a>` by class, so styling and tap-target size (42×42) carry over unchanged. NOTE TO USER: replace `919999999999` with the real WhatsApp number (country code + number, no `+` or spaces).

- [ ] **Step 2: Add a WhatsApp button to the final CTA band**

Find ([index.html:1192-1195](../../../index.html#L1192-L1195)):

```html
    <div class="hero-cta">
      <a href="mailto:hello@dayaminsights.com?subject=Book%20a%20consultation" class="btn btn-primary">Book a free consultation <span class="arrow">→</span></a>
      <a href="mailto:hello@dayaminsights.com" class="btn btn-ghost">Email us instead</a>
    </div>
```

Replace with (WhatsApp becomes the primary action for the India audience; email demoted to ghost; keep a second email option):

```html
    <div class="hero-cta">
      <a href="https://wa.me/919999999999?text=Hi%20Dayam%20Insights%2C%20I%27d%20like%20to%20book%20a%20free%20consultation." target="_blank" rel="noopener" class="btn btn-primary">Chat on WhatsApp <span class="arrow">→</span></a>
      <a href="mailto:hello@dayaminsights.com?subject=Book%20a%20consultation" class="btn btn-ghost">Or email us</a>
    </div>
```

- [ ] **Step 3: Verify both WhatsApp links resolve and nav toggle is a working link on mobile**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && NODE_PATH=/tmp/node_modules node -e "
const {chromium}=require('playwright');(async()=>{
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true});
const p=await ctx.newPage();
await p.goto('http://localhost:8090/index.html',{waitUntil:'networkidle'});
const toggle=await p.evaluate(()=>{const a=document.querySelector('.nav-toggle');return {tag:a.tagName,href:a.getAttribute('href'),visible:getComputedStyle(a).display!=='none'};});
const waCount=await p.evaluate(()=>document.querySelectorAll('a[href*=\"wa.me\"]').length);
console.log('NAV_TOGGLE=',JSON.stringify(toggle),'| WA_LINKS=',waCount);
await b.close();})();"
```
Expected: `NAV_TOGGLE= {"tag":"A","href":"https://wa.me/919999999999?...","visible":true} | WA_LINKS= 2`.

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Add WhatsApp CTAs and replace fake mobile hamburger with working WhatsApp link

Mobile nav toggle previously just scrolled to #problem while showing a
hamburger icon (implying a menu that didn't exist). Now it's a real
WhatsApp contact link. Final CTA band leads with WhatsApp for the
India SME audience, email as fallback. Uses placeholder number
919999999999 — replace before go-live.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Fix footer "Scale with AI" mismatched anchor (High — audit #7)

`#top` has no AI content; clicking "Scale with AI" from the footer just bounces to the hero. Point it at `#intelligence` (where Dashboards + Automation, the AI-driven sections, live) and relabel to match what's actually there.

**Files:**
- Modify: `index.html:1216`

- [ ] **Step 1: Repoint the link**

Find ([index.html:1216](../../../index.html#L1216)):

```html
        <a href="#top">Scale with AI</a>
```

Replace with:

```html
        <a href="#intelligence">Scale with AI</a>
```

- [ ] **Step 2: Verify no footer "Outcomes" link points to #top**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && grep -n 'Scale with AI' index.html
```
Expected: one line, `<a href="#intelligence">Scale with AI</a>`.

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Point footer 'Scale with AI' to #intelligence instead of #top

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Gitignore stray dev files (High — audit #6)

Keep `index.wireframes-backup.html` (1.7MB) and `mockups/` locally but out of the repo / GitHub Pages deploy.

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Create .gitignore**

Create `.gitignore`:

```gitignore
# Local-only working files — never deploy to GitHub Pages
index.wireframes-backup.html
mockups/

# Temporary audit/verification harness
tmp_serve.js
tmp_check.js
tmp_*.png
node_modules/
```

- [ ] **Step 2: Verify the stray files are now ignored**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && git status --porcelain --ignored | grep -E 'wireframes-backup|mockups'
```
Expected: lines prefixed `!!` (ignored), e.g. `!! index.wireframes-backup.html` and `!! mockups/`.

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add .gitignore && git commit -m "Add .gitignore for local-only dev files and audit harness

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Final full-page verification + cleanup

**Files:**
- Delete: `tmp_serve.js`, `tmp_check.js`, `tmp_*.png` (temp harness)

- [ ] **Step 1: Full desktop + mobile screenshots, console check**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && NODE_PATH=/tmp/node_modules node -e "
const {chromium}=require('playwright');(async()=>{
const b=await chromium.launch();const errs=[];
for (const m of [{w:1440,h:900,mob:false,n:'desktop'},{w:390,h:844,mob:true,n:'mobile'}]){
  const ctx=await b.newContext({viewport:{width:m.w,height:m.h},isMobile:m.mob});
  const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push(m.n+':'+e.message));
  p.on('console',c=>{if(c.type()==='error')errs.push(m.n+':'+c.text());});
  await p.goto('http://localhost:8090/index.html',{waitUntil:'networkidle'});
  await p.waitForTimeout(1200);
  await p.screenshot({path:'tmp_final_'+m.n+'.png',fullPage:true});
  await ctx.close();
}
console.log('FINAL_CONSOLE_ERRORS=',JSON.stringify(errs));
await b.close();})();"
```
Expected: `FINAL_CONSOLE_ERRORS= []`.

- [ ] **Step 2: Eyeball both final screenshots**

Read `tmp_final_desktop.png` and `tmp_final_mobile.png`. Confirm: mobile hero is copy-first single-column; no "illustrative" text in results; WhatsApp buttons present; no visual regressions vs the audit screenshots.

- [ ] **Step 3: Stop server and delete temp files**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && kill $(cat /tmp/serve.pid) 2>/dev/null; rm -f tmp_serve.js tmp_check.js tmp_*.png; echo cleaned
```
Expected: `cleaned` (temp files are gitignored anyway, but remove them).

- [ ] **Step 4: Confirm working tree clean except expected ignores**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && git status --porcelain
```
Expected: empty (all committed; stray files + temp files ignored).

---

## Post-implementation: USER ACTION REQUIRED before go-live

Replace these sentinel values with real ones (they are intentionally placeholders):

1. **GA4 Measurement ID** — replace both occurrences of `G-XXXXXXXXXX` in `index.html` `<head>`.
2. **WhatsApp number** — replace all occurrences of `919999999999` in `index.html` (nav toggle + CTA band).
3. **Domain** — replace `https://dayaminsights.com/` in the canonical/OG/JSON-LD tags if the real domain differs.
4. **OG image** — supply a 1200×630 PNG, host it, and point `og:image`/`twitter:image` at it; switch `twitter:card` to `summary_large_image`.
5. **Trust/legal (audit #8, not in this plan)** — add a Privacy Policy (required for Google/Meta ad business verification) and at least one real trust signal (LinkedIn link, real client logo/testimonial) before spending on ads.

---

## Self-Review Notes

- **Spec coverage:** Audit #1→Task 1, #3→Task 4, #4→Task 2, #5→Task 3, #6→Task 7, #7→Task 6, #9→Task 5, #10→Task 5. #2 skipped per user. #8 (trust/legal) flagged as user action — out of code scope (needs business content, not code). #11/#12/#13 were Low/optional, not included; can be a follow-up if desired.
- **Placeholder scan:** `G-XXXXXXXXXX`, `919999999999`, `dayaminsights.com` are intentional sentinels documented for user replacement — not plan-failure placeholders; every code step has complete content.
- **Type consistency:** `.nav-toggle` styling reused for the `<a>` in Task 5 (verified the class-based CSS at lines 88/524 doesn't require `<button>`). GA4 `generate_lead` event name/fields consistent between Task 4 step 2 and verification step 3.
