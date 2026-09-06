# Content, IA & Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `index.html`'s message, section order and conversion path so a Tier-2 India SME owner understands what is being sold, believes it, and can act — without fabricating a single fact.

**Architecture:** Builds on the completed visual system migration (`2026-08-30-visual-system-migration.md`). The token layer, type scale, section rhythm and component set are settled and must not be re-litigated. This plan changes copy, section order and markup only. Every claim that depends on a fact the business has not supplied ships as a `[data-sentinel]` element — visually obvious in a browser, greppable in source, and gated by a pre-launch check.

**Tech Stack:** HTML5, CSS custom properties (inline), vanilla JS (inline). No build step, no framework, no test runner. Verification via a Node static server plus Playwright.

**Prerequisite:** branch `visual-system-migration` merged or checked out. `git log --oneline -1` should show `e13fe6e` or a descendant.

---

## The problem this plan solves

The audit's positioning findings, none of which the visual migration touched:

| # | Finding | Task |
|---|---|---|
| P0-1 | No real contact route beyond a Gmail address and one WhatsApp link | 9 |
| P0-2 | Three case studies with quotes attributed to nobody, under a heading claiming they are real | 5 |
| P0-3 | No mobile navigation — the hamburger is an `<a>` pointing at WhatsApp | 8 |
| P0-4 | Hero sells "one team, five services" — a supplier's frame, not a buyer's problem | 2 |
| P0-5 | Single conversion path: WhatsApp or a Gmail `mailto:` | 9 |
| P1-1 | No FAQ, no schema beyond a bare Organization block | 10 |
| P1-3 | No founder, no faces, no location — nothing that says a person is behind this | 7 |
| P1-5 | Four competing vocabularies: hero cards, section titles, nav "Solutions", footer "Outcomes" | 3 |
| P1-6 | `#tech` lists Snowflake, dbt, LangChain and vector search to a buyer who counts stock by hand | 6 |
| — | Section order puts proof before the thing being proved, and jargon before value | 4 |

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `index.html` | The entire site | Modify throughout |
| `tmp_serve.js` | Static server on :8090 | Create, temporary, gitignored |
| `tmp_check.js` | Playwright assertions | Create, temporary, gitignored |

`.gitignore` already covers `tmp_serve.js`, `tmp_check.js`, `tmp_*.png`, `node_modules/`.

**Task order matters.** Task 1 must land first (it defines the sentinel vocabulary every later task uses). Task 4 (reorder) must come after Tasks 2–3 and before Tasks 7/10, which insert new sections into the reordered page.

---

## The sentinel contract

Nothing in this plan invents a fact about the business. Where a fact is required and missing, the markup ships as:

```html
<span data-sentinel="founder-name">FOUNDER_NAME</span>
```

Plan 1 already shipped the style (dashed amber outline, tinted background). The pre-launch gate is:

```bash
grep -c 'data-sentinel' index.html   # must return 0 before go-live
```

The nine outstanding facts, from the design spec §14.2:

| Key | Needed for |
|---|---|
| `contact-email` | Task 1, 9 |
| `founder-name`, `founder-role`, `founder-bio`, `founder-photo`, `founder-linkedin` | Task 7 |
| `city`, `state` | Tasks 1, 10 |
| `phone` | Task 9 |
| `form-endpoint` | Task 9 |
| `revenue-band` | Task 2 |
| `booking-link` | Task 9 (omitted if none) |
| `result-1` … `result-3` | Task 5 |

---

## Task 0: Verification harness

**Files:** Create `tmp_serve.js`, `tmp_check.js` (both temporary)

- [ ] **Step 1: Confirm Playwright is present**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node -e "require.resolve('playwright');console.log('ok')"
```
Expected: `ok`. If it fails, run `npm install --no-save playwright@1.49.1 && npx playwright install chromium`.

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

Start it:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && (node tmp_serve.js > /dev/null 2>&1 &) ; sleep 2; curl -sf http://localhost:8090/index.html -o /dev/null && echo OK
```
Expected: `OK`

- [ ] **Step 3: Write the check script**

Create `tmp_check.js`:

```js
const { chromium } = require('playwright');
(async()=>{
  const browser=await chromium.launch();const errs=[];const out={};
  let ctx=await browser.newContext({viewport:{width:1440,height:900}});
  let page=await ctx.newPage();
  page.on('pageerror',e=>errs.push('d:'+e.message));
  page.on('console',m=>{if(m.type()==='error')errs.push('d:'+m.text());});
  await page.goto('http://localhost:8090/index.html',{waitUntil:'networkidle'});

  out.sectionOrder=await page.evaluate(()=>Array.from(document.querySelectorAll('main section')).map(s=>s.id));
  out.rhythm=await page.evaluate(()=>Array.from(document.querySelectorAll('main section')).map(s=>getComputedStyle(s,'::before').backgroundColor==='rgba(0, 0, 0, 0)'?'white':'band').join(' '));
  out.sentinels=await page.evaluate(()=>Array.from(document.querySelectorAll('[data-sentinel]')).map(e=>e.dataset.sentinel));
  out.h1=await page.evaluate(()=>document.querySelector('h1').textContent.trim());
  out.navLinks=await page.evaluate(()=>Array.from(document.querySelectorAll('.nav-links a')).map(a=>a.textContent.trim()));
  out.a11y=await page.evaluate(()=>({main:document.querySelectorAll('main').length,skip:!!document.querySelector('a.skip-link'),lab:Array.from(document.querySelectorAll('section')).filter(s=>s.hasAttribute('aria-labelledby')).length,tot:document.querySelectorAll('section').length,bareSvg:Array.from(document.querySelectorAll('svg')).filter(s=>!s.hasAttribute('aria-hidden')&&!s.closest('[aria-hidden]')).length}));
  out.schemaTypes=await page.evaluate(()=>Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s=>{try{const j=JSON.parse(s.textContent);return j['@type'];}catch(e){return 'PARSE_ERROR';}}));
  out.formAction=await page.evaluate(()=>{const f=document.querySelector('form');return f?f.getAttribute('action'):null;});
  out.deadLinks=await page.evaluate(()=>Array.from(document.querySelectorAll('a[href^="#"]')).map(a=>a.getAttribute('href')).filter(h=>h!=='#'&&!document.querySelector(h)));
  out.blurCount=await page.evaluate(()=>{let n=0;document.querySelectorAll('*').forEach(el=>{const s=getComputedStyle(el);if((s.filter&&s.filter.includes('blur'))||(s.backdropFilter&&s.backdropFilter!=='none'))n++;});return n;});
  await ctx.close();

  ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  page=await ctx.newPage();
  page.on('pageerror',e=>errs.push('m:'+e.message));
  await page.goto('http://localhost:8090/index.html',{waitUntil:'networkidle'});
  out.mobile=await page.evaluate(()=>({ovf:document.documentElement.scrollWidth>document.documentElement.clientWidth,sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
  out.menu=await page.evaluate(()=>{const b=document.querySelector('.nav-toggle');return b?{tag:b.tagName,expanded:b.getAttribute('aria-expanded'),controls:b.getAttribute('aria-controls')}:null;});
  await page.screenshot({path:'tmp_mobile.png'});
  await ctx.close();await browser.close();
  out.consoleErrors=errs;
  console.log(JSON.stringify(out,null,1));
})();
```

- [ ] **Step 4: Baseline run**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```

Record the current state:
- `sectionOrder` is `["top","problem","process","results","tech","growth","intelligence","why","cta"]`
- `rhythm` is `white band white band white band white band white`
- `sentinels` is `[]`
- `schemaTypes` is `["Organization"]`
- `formAction` is `null`
- `menu.tag` is `A` — the P0-3 bug
- `consoleErrors` is `[]`

No commit — temp files only.

---

## Task 1: Sentinel vocabulary and shared contact constants

Establishes the mechanism every later task depends on.

**Files:** Modify `index.html`

- [ ] **Step 1: Add a sentinel legend comment above `</head>`**

Find the line `</style>` that closes the inline stylesheet, and immediately after `</head>` opening context — specifically, find:

```html
</style>
</head>
```

Replace with:

```html
</style>
<!-- ============================================================
     SENTINELS — every [data-sentinel] element below marks a fact
     the business has not yet supplied. They render with a dashed
     amber outline so they cannot be missed in a browser.

     Before go-live:  grep -c 'data-sentinel' index.html   -> must be 0

     Outstanding:
       contact-email    real domain mailbox (hello@dayaminsights.com?)
       phone            is +91 78776 40693 public? display as text?
       city / state     for local SEO and the FAQ
       revenue-band     hero qualifier, currently "Rs 1-20 crore"
       founder-*        name, role, bio, photo, LinkedIn
       form-endpoint    Formspree / Netlify / Web3Forms URL
       booking-link     Cal.com / Calendly (optional)
       result-1..3      which numeric claims are defensible
     ============================================================ -->
</head>
```

- [ ] **Step 2: Verify the sentinel style survived the visual migration**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && grep -c 'data-sentinel' index.html
```
Expected: at least `2` — the CSS rule plus the comment. The rule should read:
```css
[data-sentinel]{outline:2px dashed var(--warn);outline-offset:2px;background:rgba(138,90,11,.08)}
```
If it is missing, add it next to the `:focus-visible` rule.

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Document the sentinel contract

Adds a legend listing every fact the business has not supplied, and the
one-line grep that gates go-live. The [data-sentinel] style already
shipped with the visual migration; this makes the outstanding list
visible to anyone opening the file.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Rewrite the hero

The hero currently sells the supplier's org chart ("One team. Five services. Zero confusion.") rather than the buyer's problem.

**Files:** Modify `index.html` — the `.hero-copy` block

- [ ] **Step 1: Replace the hero copy**

Find:

```html
    <span class="eyebrow reveal"><span class="dot"></span>For growing businesses</span>
    <h1 class="reveal" id="h-hero" data-d="1">Stop losing time and money to manual work.<br>Start growing with <span class="grad">DAYAM</span></h1>
    <p class="sub reveal" data-d="2">Get more customers, automate repetitive tasks, track your business in real time, and scale faster with one team handling everything.</p>
    <p class="tagline reveal" data-d="2">One team. Five services. Zero confusion.</p>
    <div class="hero-cta reveal" data-d="3">
      <a href="#cta" class="btn btn-primary">Book a Free Consultation <span class="arrow">→</span></a>
      <a href="#results" class="btn btn-ghost">See Our Work</a>
    </div>
    <div class="hero-meta reveal" data-d="4">
      <div class="m"><b data-count="40" data-suffix="%">0%</b><span>Less Time on Admin</span></div>
      <div class="m"><b data-count="3" data-suffix="x">0x</b><span>Faster Decisions</span></div>
      <div class="m"><b>5</b><span>Services, One Team</span></div>
    </div>
```

Replace with:

```html
    <span class="eyebrow reveal"><span class="dot"></span>For retailers, distributors &amp; manufacturers</span>
    <h1 class="reveal" id="h-hero" data-d="1">Your business runs on five spreadsheets. It shouldn't have to.</h1>
    <p class="sub reveal" data-d="2">We connect your orders, stock and invoices into one system that updates itself — and put your numbers on one screen you can check from your phone.</p>
    <p class="tagline reveal" data-d="2">Built for businesses doing <span data-sentinel="revenue-band">RS_1_TO_20_CRORE</span> a year</p>
    <div class="hero-cta reveal" data-d="3">
      <a href="#contact" class="btn btn-primary">Show me what to automate first <span class="arrow">→</span></a>
      <a href="#intelligence" class="btn btn-ghost">See a dashboard we built</a>
    </div>
    <div class="hero-meta reveal" data-d="4">
      <div class="m"><b><span data-sentinel="lead-time">4–6 WEEKS</span></b><span>from first call to a live system</span></div>
      <div class="m"><b><span data-sentinel="pricing-model">FIXED PRICE</span></b><span>quoted before any work starts</span></div>
      <div class="m"><b>You own it</b><span>your data, your accounts, your logins</span></div>
    </div>
```

Four deliberate decisions:

1. **The `<br>` is gone.** It forced a bad break at 390px. Line control now comes from `text-wrap:balance` and the container width, both already in the system.
2. **"DAYAM" in rust caps is gone.** Shouting the vendor's own name is the opposite of a buyer-focused hero, and it was the only remaining use of the `.grad` span.
3. **The three stats are replaced by three commitments,** two of which are sentinels. The old set was "40% Less Time on Admin / 3x Faster Decisions / 5 Services" — two unverifiable claims and one piece of vendor trivia. Lead time and pricing model are business practices only the owner can confirm, so they are marked. "You own it" is a positioning statement the business fully controls, so it ships as-is.
4. **The primary CTA changes from "Book a Free Consultation" to "Show me what to automate first."** The first asks the visitor to give up time; the second describes what they receive. It points at `#contact`, created in Task 9.

- [ ] **Step 2: Remove the now-unused `.grad` rule**

Find and delete:
```css
.hero h1 .grad{color:var(--accent)}
```

Verify nothing else uses it:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && grep -c 'grad' index.html
```
Expected: `0`

- [ ] **Step 3: Verify**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```
Expected:
- `h1` is `Your business runs on five spreadsheets. It shouldn't have to.`
- `sentinels` contains `revenue-band`, `lead-time`, `pricing-model`
- `deadLinks` contains `#contact` — expected until Task 9 creates it
- `consoleErrors` is `[]`

- [ ] **Step 4: Check the headline at 390px**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node -e "
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
const p=await b.newPage({viewport:{width:390,height:844},isMobile:true});
await p.goto('http://localhost:8090/index.html',{waitUntil:'networkidle'});
const r=await p.evaluate(()=>{const h=document.querySelector('h1');const s=getComputedStyle(h);return {fontSize:s.fontSize,lines:Math.round(h.getBoundingClientRect().height/parseFloat(s.lineHeight)),overflow:h.scrollWidth>h.clientWidth};});
console.log(JSON.stringify(r));await b.close();})();"
```
Expected: `fontSize` around `34px`, `lines` of 3 or 4, `overflow` is `false`.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Rewrite the hero around the buyer's problem

The hero sold the supplier's org chart - 'One team. Five services. Zero
confusion.' - and led with the vendor's own name shouted in caps. A
visitor learned what we are before learning what they get.

It now opens on the reader's situation, states the mechanism in one
sentence, and offers a first step that describes what they receive
rather than what they give up: 'Show me what to automate first' instead
of 'Book a Free Consultation'.

Drops the hard <br>, which forced a bad break at 390px; line control
comes from text-wrap:balance and the container width.

The three stats were two unverifiable claims and one piece of vendor
trivia (40% less admin, 3x faster decisions, 5 services). They become
three commitments about how the work runs. Lead time and pricing model
are business practices only the owner can confirm, so they ship as
sentinels; 'You own it' is fully within the business's control and
ships as written.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Unify the service vocabulary

The site names its services four different ways: hero cards, section headings, nav "Solutions", footer "Outcomes". A visitor cannot tell whether "Unlock Business Intelligence" and "Dashboards" are the same purchase.

**Canonical names, used everywhere from now on:** Dashboards · Automation · AI Assistants · Websites & Apps · Marketing

**Files:** Modify `index.html` — nav, footer, section eyebrows

- [ ] **Step 1: Rewrite the nav links**

Find:
```html
    <nav class="nav-links">
      <a href="#problem">Problems</a>
      <a href="#growth">Solutions</a>
      <a href="#process">Process</a>
      <a href="#results">Results</a>
      <a href="#tech">Technology</a>
    </nav>
```

Replace with:
```html
    <nav class="nav-links">
      <a href="#problem">The problem</a>
      <a href="#intelligence">What we do</a>
      <a href="#process">How it works</a>
      <a href="#results">Results</a>
      <a href="#faq">FAQ</a>
    </nav>
```

`#faq` is created in Task 10 and will be a dead link until then.

- [ ] **Step 2: Rewrite the footer columns**

Find:
```html
      <div class="foot-col">
        <h5>Outcomes</h5>
        <a href="#automation">Automate Operations</a>
        <a href="#dashboards">Unlock Business Intelligence</a>
        <a href="#growth">Build Digital Products</a>
        <a href="#intelligence">Scale with AI</a>
      </div>
```

Replace with:
```html
      <div class="foot-col">
        <h5>Services</h5>
        <a href="#dashboards">Dashboards</a>
        <a href="#automation">Automation</a>
        <a href="#growth">Websites &amp; Apps</a>
        <a href="#marketing">Marketing</a>
      </div>
```

- [ ] **Step 3: Point the "Built for" column at real anchors**

Find:
```html
      <div class="foot-col">
        <h5>Built for</h5>
        <a href="#top">Retail</a>
        <a href="#top">Distribution</a>
        <a href="#top">E-commerce</a>
        <a href="#top">Manufacturing</a>
      </div>
```

Replace with:
```html
      <div class="foot-col">
        <h5>Built for</h5>
        <span>Retail &amp; multi-store</span>
        <span>Distribution &amp; wholesale</span>
        <span>E-commerce</span>
        <span>Manufacturing</span>
      </div>
```

Four links that all pointed at `#top` were not navigation — they were decoration that punished anyone who clicked. As plain text they still communicate who this is for.

Add the matching style next to `.foot-col a`:
```css
.foot-col span{display:block;color:var(--muted);font-family:var(--font-ui);font-size:var(--fs-small);padding:var(--sp-2) 0}
```

- [ ] **Step 4: Update the Company column**

Find:
```html
        <h5>Company</h5>
        <a href="#process">Our process</a>
        <a href="#results">Results</a>
        <a href="#tech">Technology</a>
        <a href="#cta">Book a call</a>
```

Replace with:
```html
        <h5>Company</h5>
        <a href="#process">How it works</a>
        <a href="#results">Results</a>
        <a href="#faq">FAQ</a>
        <a href="#contact">Talk to us</a>
```

- [ ] **Step 5: Verify**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```
Expected: `navLinks` is `["The problem","What we do","How it works","Results","FAQ"]`, `deadLinks` contains `#faq` and `#contact` (both created later), `consoleErrors` is `[]`.

- [ ] **Step 6: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Unify the service vocabulary

The site named its services four ways: hero cards said Dashboards and
Automation, section headings said 'Know where to put your next rupee',
the nav said Solutions, and the footer said Outcomes with a fifth set of
names again - 'Unlock Business Intelligence', 'Scale with AI'. A visitor
could not tell whether two of those were the same purchase.

Everything now uses one set: Dashboards, Automation, AI Assistants,
Websites & Apps, Marketing.

Also converts the footer's 'Built for' column from four links that all
pointed at #top into plain text. They were not navigation; they punished
anyone who clicked one.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Reorder the page

Current order puts proof before the thing being proved, and a stack of engineering jargon at position 5, before the visitor has learned what any of it is for.

**Current:** hero → problem → process → results → tech → growth → intelligence → why → cta

**New:** hero → problem → **intelligence** → **growth** → process → results → why → **founder** → tech → **faq** → contact/cta

**Files:** Modify `index.html` — move whole `<section>` blocks

- [ ] **Step 1: Confirm the section boundaries before moving anything**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && grep -n '^<section\|^</section>\|^<!-- ' index.html | sed -n '1,60p'
```

Record the start and end line of each section. Every section in this file starts at column 0 with `<section` and ends at column 0 with `</section>`, each preceded by an HTML comment banner. Move complete comment-plus-section units.

- [ ] **Step 2: Move `#intelligence` and `#growth` above `#process`**

Cut the block beginning `<!-- INTELLIGENCE: DASHBOARDS & AUTOMATION -->` through its closing `</section>`, and the block beginning `<!-- GROWTH: WEBSITES & APPS + MARKETING -->` through its closing `</section>`.

Paste both immediately after the closing `</section>` of `#problem`, in this order: `#intelligence` first, then `#growth`.

Rationale: `#intelligence` holds the two inverted mockups, which are the strongest proof of capability on the page. They currently appear at roughly 60% scroll depth, after most visitors have left. Moving the pair up puts the demonstration immediately after the pain.

- [ ] **Step 3: Move `#tech` below `#why`**

Cut the block beginning `<!-- TECH -->` through its closing `</section>` and paste it immediately after the closing `</section>` of `#why`.

- [ ] **Step 4: Re-apply the band alternation**

The reorder invalidates the `.band` classes. The rhythm must alternate strictly. Set each section's class exactly as follows:

| Section | Class |
|---|---|
| `#top` | `hero wrap` (unchanged) |
| `#problem` | `pad wrap band` |
| `#intelligence` | `pad wrap web-show` |
| `#growth` | `pad wrap web-show band` |
| `#process` | `pad wrap` |
| `#results` | `pad wrap band` |
| `#why` | `pad wrap` |
| `#tech` | `pad wrap band` |
| `#cta` | `pad wrap` |

Note `#intelligence` is deliberately **not** a band: its inverted dashboard and pipeline mockups read at full strength against white.

Apply with:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node -e "
const fs=require('fs');let h=fs.readFileSync('index.html','utf8');
const want={problem:'pad wrap band',intelligence:'pad wrap web-show',growth:'pad wrap web-show band',process:'pad wrap',results:'pad wrap band',why:'pad wrap',tech:'pad wrap band',cta:'pad wrap'};
let n=0;
h=h.replace(/<section class=\"([^\"]*)\" id=\"([a-z]+)\"/g,(m,cls,id)=>{
  if(!(id in want)) return m; n++;
  return '<section class=\"'+want[id]+'\" id=\"'+id+'\"';
});
fs.writeFileSync('index.html',h);console.log('rewrote '+n+' section classes');
"
```
Expected: `rewrote 8 section classes`

- [ ] **Step 5: Restore `.web-show` top padding**

`#intelligence` is now the first showcase and follows a band, so it needs normal top padding. Confirm `.web-show` no longer sets `padding-top:0`:

```bash
cd "c:/Users/USER/Documents/GitHub/website" && grep -n '\.web-show{' index.html
```
Expected: `.web-show{position:relative;isolation:isolate}` — no `padding-top`. If `padding-top:0` is present, remove it.

- [ ] **Step 6: Verify order and rhythm**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```
Expected:
- `sectionOrder` is `["top","problem","intelligence","growth","process","results","why","tech","cta"]`
- `rhythm` is `white band white band white band white band white`
- `consoleErrors` is `[]`

- [ ] **Step 7: Confirm tag balance**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && for t in section div span main; do o=$(grep -o "<$t[ >]" index.html | wc -l); c=$(grep -o "</$t>" index.html | wc -l); printf '%-8s open=%-4s close=%-4s %s\n' "$t" "$o" "$c" "$([ "$o" = "$c" ] && echo OK || echo MISMATCH)"; done
```
Expected: all `OK`.

- [ ] **Step 8: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Reorder the page around the buyer's journey

The order put proof before the thing being proved, and a stack of
engineering jargon at position five - Power BI, BigQuery, dbt, Snowflake,
LangChain - before the visitor had learned what any of it was for.

Dashboards & Automation and Websites & Marketing move up to sit directly
after the problem. Those two sections hold the four hand-built mockups,
including the two inverted panels that are the strongest demonstration of
capability on the page, and they previously appeared at roughly 60%
scroll depth - past the point most visitors leave.

Technology drops below Why us, where a buyer who already wants the
outcome can check the stack if they care.

Band alternation is re-applied across the new order. #intelligence stays
white so its inverted mockups read at full strength.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Reframe `#results` as worked examples

Three case studies carry quotation marks around sentences no named person said, under a heading asserting they are real client outcomes. This is the single largest credibility risk on the page: a buyer who suspects one fabricated detail discounts everything else.

**Files:** Modify `index.html` — the `#results` section

- [ ] **Step 1: Rewrite the section head**

Find:
```html
    <span class="eyebrow"><span class="dot"></span>Measurable outcomes</span>
    <h2 class="title" id="h-results">Results our partners can put a number on.</h2>
    <p>Representative outcomes from engagements across retail, distribution and manufacturing.</p>
```

Replace with:
```html
    <span class="eyebrow"><span class="dot"></span>What to expect</span>
    <h2 class="title" id="h-results">What a project like this typically returns.</h2>
    <p>Worked examples, modelled on real implementations rather than drawn from one client. Your numbers will be different — we size them with you on the first call, before you commit to anything.</p>
```

- [ ] **Step 2: Delete all three fabricated quotes**

Delete these three lines entirely:
```html
      <div class="quote">"We stopped guessing on Mondays. The numbers are just there."</div>
```
```html
      <div class="quote">"Inventory finally matches reality. Fewer emergencies, better cash."</div>
```
```html
      <div class="quote">"It's like we hired a back-office team that never sleeps."</div>
```

- [ ] **Step 3: Label each card as a worked example**

In each of the three `.res` cards, find the `.sector` line and prepend a label. The three become:

```html
      <div class="sector">Worked example · multi-store retailer</div>
```
```html
      <div class="sector">Worked example · regional distributor</div>
```
```html
      <div class="sector">Worked example · manufacturing SME</div>
```

- [ ] **Step 4: Mark the three figures as sentinels**

Each `.big` figure needs confirming as defensible or replacing. Wrap each:

```html
      <div class="big mono" data-sentinel="result-1" data-count="40" data-suffix="%">0%</div>
```
```html
      <div class="big mono" data-sentinel="result-2" data-count="63" data-suffix="%">0%</div>
```
```html
      <div class="big mono" data-sentinel="result-3" data-count="22" data-suffix="h">0h</div>
```

- [ ] **Step 5: Delete the now-unused `.quote` rule**

Find and delete:
```css
.res .quote{margin-top:var(--sp-4);padding-top:var(--sp-4);border-top:1px solid var(--line);font-family:var(--font-body);font-size:var(--fs-small);color:var(--muted);font-style:italic}
```

Verify:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && grep -c 'quote' index.html
```
Expected: `0`

- [ ] **Step 6: Add a real-proof placeholder note**

Immediately after the closing `</div>` of `.res-grid`, add:

```html
  <p class="res-note reveal" data-d="4">Working with us and happy to say so? A named case study here — your company, your number, your words — replaces all three of these. <a href="#contact">Tell us</a>.</p>
```

And the style, next to the other `.res` rules:
```css
.res-note{margin-top:var(--sp-6);text-align:center;font-family:var(--font-ui);font-size:var(--fs-small);color:var(--muted-2);max-width:var(--maxw-text);margin-inline:auto}
.res-note a{color:var(--accent);text-decoration:underline;text-underline-offset:3px}
```

- [ ] **Step 7: Verify**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```
Expected: `sentinels` contains `result-1`, `result-2`, `result-3`; `consoleErrors` is `[]`.

- [ ] **Step 8: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Reframe results as worked examples and delete the fabricated quotes

Three case studies carried quotation marks around sentences no named
person said - 'We stopped guessing on Mondays', 'It's like we hired a
back-office team that never sleeps' - under a heading asserting they were
real client outcomes, with a sub-line that quietly said 'representative'.

That is the largest credibility risk on the page. A buyer who suspects
one fabricated detail discounts everything else on the site, including
the parts that are true.

The quotes are deleted. The section now says plainly what these are:
worked examples, modelled rather than drawn from one client, with the
numbers sized on the first call. Each figure is marked as a sentinel
pending confirmation that it is defensible.

Adds a short line inviting a real named case study, which would replace
all three.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Collapse the technology section

Sixteen items including Snowflake, dbt, LangChain and vector search, sold to a buyer who counts stock by hand. This section currently signals "we will overcharge you" rather than "we are competent".

**Files:** Modify `index.html` — the `#tech` section

- [ ] **Step 1: Rewrite the section head**

Find:
```html
    <span class="eyebrow"><span class="dot"></span>Under the hood</span>
    <h2 class="title" id="h-tech">Proven technology, chosen for fit — not fashion.</h2>
    <p>We build on tools your business can rely on and your team can grow with.</p>
```

Replace with:
```html
    <span class="eyebrow"><span class="dot"></span>Under the hood</span>
    <h2 class="title" id="h-tech">We work with what you already use.</h2>
    <p>Your team keeps its Excel sheets, its WhatsApp and its billing software. We connect them rather than replacing them — so nobody has to learn a new system on day one.</p>
```

- [ ] **Step 2: Replace all four technology columns**

Find the entire `<div class="tech-groups">` block, from its opening tag through its closing `</div>`, and replace with:

```html
  <div class="tech-groups">
    <div class="tech-col reveal" data-d="1">
      <h4>What you already have</h4>
      <div class="tech-list">
        <div class="tech-item"><span class="td"></span>Excel &amp; Google Sheets</div>
        <div class="tech-item"><span class="td"></span>Your billing software</div>
        <div class="tech-item"><span class="td"></span>WhatsApp</div>
      </div>
    </div>
    <div class="tech-col reveal" data-d="2">
      <h4>What we add</h4>
      <div class="tech-list">
        <div class="tech-item"><span class="td"></span>Power BI dashboards</div>
        <div class="tech-item"><span class="td"></span>Automated workflows</div>
        <div class="tech-item"><span class="td"></span>AI assistants</div>
      </div>
    </div>
    <div class="tech-col reveal" data-d="3">
      <h4>Where it runs</h4>
      <div class="tech-list">
        <div class="tech-item"><span class="td"></span>Your own cloud account</div>
        <div class="tech-item"><span class="td"></span>Backed up daily</div>
        <div class="tech-item"><span class="td"></span>Access you control</div>
      </div>
    </div>
    <div class="tech-col reveal" data-d="4">
      <h4>If your team asks</h4>
      <div class="tech-list">
        <div class="tech-item"><span class="td"></span>Python &amp; SQL</div>
        <div class="tech-item"><span class="td"></span>PostgreSQL</div>
        <div class="tech-item"><span class="td"></span>Claude &amp; OpenAI</div>
      </div>
    </div>
  </div>
```

Cut entirely: BigQuery, dbt, Snowflake, n8n / Zapier, LangChain, Vector search, React / Next.js, Node, Supabase, AWS, Google Cloud, Docker, Vercel. Sixteen items become twelve, and the framing moves from a capability list to an answer to the buyer's real question — *do I have to throw away what I have?*

The fourth column keeps the genuinely technical names for the one visitor in twenty who has an IT person, under a heading that says exactly who it is for.

- [ ] **Step 3: Verify**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && for s in Snowflake dbt LangChain 'Vector search' Supabase Docker Vercel BigQuery; do printf '%-16s %s\n' "$s" "$(grep -c "$s" index.html || echo 0)"; done
```
Expected: every count is `0`.

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Rewrite the technology section for the actual buyer

Sixteen items including Snowflake, dbt, LangChain and vector search, sold
to someone who counts stock by hand. To that reader the list does not
signal competence - it signals that this will be expensive and that they
will not understand the invoice.

The section now answers the question they actually have: do I have to
throw away what I already use? Three columns say no, one column keeps
the genuinely technical names under a heading that says who they are
for.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: Add the founder block

The site currently has no person, no face, no location. A prospect handing over their business data has no idea who they are dealing with.

**Files:** Modify `index.html` — insert a new section after `#why`

- [ ] **Step 1: Add the founder section**

Immediately after the closing `</section>` of `#why`, insert:

```html
<!-- FOUNDER -->
<section class="pad wrap band" id="founder" aria-labelledby="h-founder">
  <div class="founder-grid reveal">
    <div class="founder-photo">
      <div class="founder-photo-slot" data-sentinel="founder-photo">FOUNDER_PHOTO</div>
    </div>
    <div class="founder-copy">
      <span class="eyebrow"><span class="dot"></span>Who you'll be working with</span>
      <h2 class="title" id="h-founder">You'll deal with the person who builds it.</h2>
      <p>No account manager, no handover to a junior team. The person who scopes your project is the person who builds it and the person who picks up the phone six months later.</p>
      <p class="founder-bio"><span data-sentinel="founder-bio">FOUNDER_BIO — two or three sentences: what you did before this, what kinds of businesses you have worked with, and why you started Dayam Insights.</span></p>
      <div class="founder-id">
        <b><span data-sentinel="founder-name">FOUNDER_NAME</span></b>
        <span><span data-sentinel="founder-role">FOUNDER_ROLE</span> · <span data-sentinel="city">CITY, STATE</span></span>
      </div>
      <a class="founder-link" href="#" data-sentinel="founder-linkedin">FOUNDER_LINKEDIN</a>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add the founder styles**

Add next to the `.why` rules:

```css
/* ===== Founder ===== */
.founder-grid{display:grid;grid-template-columns:260px 1fr;gap:var(--sp-7);align-items:start}
.founder-photo-slot{
  aspect-ratio:1;border-radius:var(--r-md);display:grid;place-items:center;
  background:var(--surface-sunken);border:1px solid var(--line);
  font-family:var(--font-mono);font-size:var(--fs-label);color:var(--muted-2);text-align:center;padding:var(--sp-4);
}
.founder-copy p{font-size:var(--fs-body);color:var(--muted);max-width:var(--maxw-text)}
.founder-bio{margin-top:var(--sp-4)}
.founder-id{margin-top:var(--sp-5);padding-top:var(--sp-4);border-top:1px solid var(--line)}
.founder-id b{display:block;font-family:var(--font-ui);font-size:var(--fs-h4);font-weight:600;color:var(--ink)}
.founder-id span{display:block;font-family:var(--font-ui);font-size:var(--fs-micro);color:var(--muted-2);margin-top:var(--sp-1)}
.founder-link{display:inline-block;margin-top:var(--sp-4);font-family:var(--font-ui);font-size:var(--fs-small);font-weight:600;color:var(--accent);text-decoration:underline;text-underline-offset:3px}
@media(max-width:760px){
  .founder-grid{grid-template-columns:1fr;gap:var(--sp-5)}
  .founder-photo{max-width:180px}
}
```

- [ ] **Step 3: Re-apply the band alternation**

Inserting `#founder` after `#why` breaks the alternation. Reset all nine content sections:

| Section | Class |
|---|---|
| `#problem` | `pad wrap band` |
| `#intelligence` | `pad wrap web-show` |
| `#growth` | `pad wrap web-show band` |
| `#process` | `pad wrap` |
| `#results` | `pad wrap band` |
| `#why` | `pad wrap` |
| `#founder` | `pad wrap band` |
| `#tech` | `pad wrap` |
| `#cta` | `pad wrap band` |

Apply with the same script as Task 4 Step 4, with the updated map:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node -e "
const fs=require('fs');let h=fs.readFileSync('index.html','utf8');
const want={problem:'pad wrap band',intelligence:'pad wrap web-show',growth:'pad wrap web-show band',process:'pad wrap',results:'pad wrap band',why:'pad wrap',founder:'pad wrap band',tech:'pad wrap',cta:'pad wrap band'};
let n=0;
h=h.replace(/<section class=\"([^\"]*)\" id=\"([a-z]+)\"/g,(m,cls,id)=>{if(!(id in want))return m;n++;return '<section class=\"'+want[id]+'\" id=\"'+id+'\"';});
fs.writeFileSync('index.html',h);console.log('rewrote '+n);
"
```
Expected: `rewrote 9`

- [ ] **Step 4: Verify**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```
Expected:
- `sectionOrder` includes `founder` between `why` and `tech`
- `rhythm` is `white band white band white band white band white band` — ten sections, still strictly alternating
- `a11y.lab` equals `a11y.tot`
- `sentinels` contains `founder-photo`, `founder-bio`, `founder-name`, `founder-role`, `founder-linkedin`, `city`

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Add the founder block

The site had no person, no face and no location. A prospect being asked
to hand over their sales and stock data had no idea who they would be
dealing with, and for a business this size that is usually the deciding
question.

Everything factual ships as a sentinel - name, role, bio, photo,
LinkedIn, city - so nothing is invented. The surrounding claim, that you
deal with the person who builds it rather than an account manager, is a
positioning statement the business controls.

Band alternation re-applied across ten sections.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: Build the mobile navigation

The hamburger is an `<a>` pointing at WhatsApp. There is no menu. On mobile the nav links are hidden with no replacement, so the only in-page navigation is scrolling.

**Files:** Modify `index.html` — nav markup, styles, inline script

- [ ] **Step 1: Replace the toggle with a real button and add the menu**

Find:
```html
      <a class="nav-toggle" href="https://wa.me/917877640693?text=Hi%20Dayam%20Insights%2C%20I%27d%20like%20to%20book%20a%20free%20consultation." target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp">
```
through its closing `</a>`, and replace the whole element with:

```html
      <button class="nav-toggle" id="navToggle" type="button" aria-expanded="false" aria-controls="mobileMenu" aria-label="Open menu">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"><path class="nt-open" d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="nt-close" d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
```

Then, immediately after the closing `</header>`, insert the menu panel:

```html
<div class="mobile-menu" id="mobileMenu" hidden>
  <nav class="mm-links" aria-label="Main">
    <a href="#problem">The problem</a>
    <a href="#intelligence">What we do</a>
    <a href="#process">How it works</a>
    <a href="#results">Results</a>
    <a href="#faq">FAQ</a>
  </nav>
  <div class="mm-cta">
    <a href="#contact" class="btn btn-primary">Show me what to automate first <span class="arrow">→</span></a>
    <a href="https://wa.me/917877640693?text=Hi%20Dayam%20Insights%2C%20I%27d%20like%20to%20talk%20about%20automating%20my%20business." target="_blank" rel="noopener" class="btn btn-ghost">Chat on WhatsApp</a>
  </div>
</div>
```

- [ ] **Step 2: Add the menu styles**

Add next to the nav rules:

```css
/* ===== Mobile menu ===== */
.nav-toggle .nt-close{display:none}
.nav-toggle[aria-expanded="true"] .nt-open{display:none}
.nav-toggle[aria-expanded="true"] .nt-close{display:block}
.mobile-menu{
  position:fixed;top:72px;left:0;right:0;bottom:0;z-index:99;
  background:var(--bg);border-top:1px solid var(--line);
  padding:var(--sp-5);display:flex;flex-direction:column;gap:var(--sp-5);
  overflow-y:auto;
}
.mm-links{display:flex;flex-direction:column}
.mm-links a{
  font-family:var(--font-ui);font-size:var(--fs-h4);font-weight:600;color:var(--ink);
  padding:var(--sp-4) 0;border-bottom:1px solid var(--line);min-height:44px;
}
.mm-cta{display:flex;flex-direction:column;gap:var(--sp-3);margin-top:auto;padding-top:var(--sp-5)}
.mm-cta .btn{width:100%}
@media(min-width:761px){
  .mobile-menu{display:none!important}
}
```

Note `hidden` on the element plus `[hidden]{display:none}` from the browser default handles the closed state; the JS toggles the attribute.

- [ ] **Step 3: Wire up the toggle**

Add to the inline `<script>`, immediately before the closing `})();`:

```js
  // ===== Mobile menu =====
  var navToggle = document.getElementById('navToggle');
  var mobileMenu = document.getElementById('mobileMenu');
  if (navToggle && mobileMenu){
    function setMenu(open){
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      mobileMenu.hidden = !open;
      // Stop the page scrolling behind an open full-height menu.
      document.body.style.overflow = open ? 'hidden' : '';
    }
    navToggle.addEventListener('click', function(){
      setMenu(navToggle.getAttribute('aria-expanded') !== 'true');
    });
    // Any in-page link closes the menu before the scroll happens.
    mobileMenu.addEventListener('click', function(e){
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && navToggle.getAttribute('aria-expanded') === 'true'){
        setMenu(false);
        navToggle.focus();
      }
    });
    // Leaving mobile width with the menu open would otherwise strand
    // body{overflow:hidden} on a desktop layout.
    window.addEventListener('resize', function(){
      if (window.innerWidth > 760 && navToggle.getAttribute('aria-expanded') === 'true') setMenu(false);
    }, {passive:true});
  }
```

- [ ] **Step 4: Verify the menu works**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node -e "
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8090/index.html',{waitUntil:'networkidle'});
  const t=await p.\$('#navToggle');
  console.log('tag:',await p.evaluate(()=>document.getElementById('navToggle').tagName));
  console.log('closed:',await p.evaluate(()=>document.getElementById('mobileMenu').hidden));
  await t.click(); await p.waitForTimeout(300);
  console.log('after click -> expanded:',await p.evaluate(()=>document.getElementById('navToggle').getAttribute('aria-expanded')),'hidden:',await p.evaluate(()=>document.getElementById('mobileMenu').hidden));
  console.log('body locked:',await p.evaluate(()=>document.body.style.overflow));
  await p.screenshot({path:'tmp_menu.png'});
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  console.log('after Esc -> expanded:',await p.evaluate(()=>document.getElementById('navToggle').getAttribute('aria-expanded')),'body:',JSON.stringify(await p.evaluate(()=>document.body.style.overflow)));
  console.log('errors:',JSON.stringify(errs));
  await b.close();
})();"
```
Expected:
```
tag: BUTTON
closed: true
after click -> expanded: true hidden: false
body locked: hidden
after Esc -> expanded: false body: ""
errors: []
```

- [ ] **Step 5: Confirm touch targets**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node -e "
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const p=await ctx.newPage();
  await p.goto('http://localhost:8090/index.html',{waitUntil:'networkidle'});
  await (await p.\$('#navToggle')).click(); await p.waitForTimeout(300);
  const small=await p.evaluate(()=>Array.from(document.querySelectorAll('#mobileMenu a')).map(a=>({t:a.textContent.trim().slice(0,22),h:Math.round(a.getBoundingClientRect().height)})).filter(x=>x.h<44));
  console.log('under 44px:',JSON.stringify(small));
  await b.close();
})();"
```
Expected: `under 44px: []`

- [ ] **Step 6: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Build a real mobile menu

The hamburger was an <a> pointing at WhatsApp. Tapping what looks
universally like a menu button navigated the visitor off the site to a
third-party app - and there was no menu at all, so on mobile the only
way to reach any section was to scroll and hope.

It is now a real <button> with aria-expanded and aria-controls, opening a
full-height panel with the five section links and both CTAs. WhatsApp is
still there, as one of two clearly labelled actions rather than disguised
as navigation.

Escape closes and returns focus to the button; any link closes before
scrolling; crossing back to desktop width closes and releases the body
scroll lock rather than stranding it on a desktop layout.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: Build the conversion path

The only ways to make contact are a WhatsApp deep link and a `mailto:` to a Gmail address. There is no form, no phone number shown as text, and no way to reach the business without leaving the page.

**Files:** Modify `index.html` — replace the `#cta` section

- [ ] **Step 1: Replace the CTA section entirely**

Find the whole `#cta` section, from `<section class="pad wrap band" id="cta"` through its closing `</section>`, and replace with:

```html
<!-- CONTACT -->
<section class="pad wrap band" id="cta" aria-labelledby="h-cta">
  <div class="cta-band reveal" id="contact">
    <span class="eyebrow"><span class="dot"></span>No pitch, no obligation</span>
    <h2 id="h-cta">Tell us what's eating your week.</h2>
    <p>Send this and we'll reply with the one process worth automating first, roughly what it would cost, and how long it would take. If the answer is "you don't need us yet", we'll say that instead.</p>

    <form class="contact-form" action="FORM_ENDPOINT" method="POST" data-sentinel="form-endpoint">
      <div class="cf-row">
        <label class="cf-field">
          <span>Your name</span>
          <input type="text" name="name" required autocomplete="name">
        </label>
        <label class="cf-field">
          <span>Business name</span>
          <input type="text" name="business" required autocomplete="organization">
        </label>
      </div>
      <div class="cf-row">
        <label class="cf-field">
          <span>Phone or WhatsApp</span>
          <input type="tel" name="phone" required autocomplete="tel" inputmode="tel">
        </label>
        <label class="cf-field">
          <span>Email <em>(optional)</em></span>
          <input type="email" name="email" autocomplete="email">
        </label>
      </div>
      <label class="cf-field">
        <span>What takes the most time right now?</span>
        <textarea name="message" rows="3" required placeholder="e.g. we re-type every order into three different sheets"></textarea>
      </label>
      <button type="submit" class="btn btn-primary cf-submit">Send it <span class="arrow">→</span></button>
      <p class="cf-note">We reply within one working day. We don't add you to a mailing list.</p>
    </form>

    <div class="cta-alt">
      <span class="cta-alt-label">Or reach us directly</span>
      <div class="cta-alt-links">
        <a href="https://wa.me/917877640693?text=Hi%20Dayam%20Insights%2C%20I%27d%20like%20to%20talk%20about%20automating%20my%20business." target="_blank" rel="noopener">WhatsApp <span data-sentinel="phone">+91 78776 40693</span></a>
        <a href="mailto:dayaminsights@gmail.com"><span data-sentinel="contact-email">dayaminsights@gmail.com</span></a>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add the form styles**

Add next to the `.cta-band` rules:

```css
/* ===== Contact form (inside the inverted panel) ===== */
.contact-form{max-width:560px;margin:var(--sp-7) auto 0;text-align:left;display:flex;flex-direction:column;gap:var(--sp-4)}
.cf-row{display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-4)}
.cf-field{display:flex;flex-direction:column;gap:var(--sp-2)}
.cf-field > span{font-family:var(--font-mono);font-size:var(--fs-label);letter-spacing:.12em;text-transform:uppercase;color:var(--on-panel-muted)}
.cf-field > span em{font-style:normal;text-transform:none;letter-spacing:0}
.cf-field input,.cf-field textarea{
  font-family:var(--font-ui);font-size:var(--fs-small);color:var(--on-panel);
  background:var(--panel-2);border:1px solid var(--line-invert);border-radius:var(--r-sm);
  padding:12px 14px;min-height:44px;width:100%;
  transition:border-color var(--t-fast) var(--ease);
}
.cf-field textarea{resize:vertical;min-height:88px}
.cf-field input::placeholder,.cf-field textarea::placeholder{color:var(--on-panel-muted);opacity:.7}
.cf-field input:hover,.cf-field textarea:hover{border-color:rgba(247,247,245,.28)}
.cf-field input:focus-visible,.cf-field textarea:focus-visible{outline:2px solid var(--focus-invert);outline-offset:2px;border-color:transparent}
.cf-submit{align-self:flex-start;margin-top:var(--sp-2)}
.cf-note{font-family:var(--font-ui);font-size:var(--fs-micro);color:var(--on-panel-muted);margin:0}
.cta-alt{margin-top:var(--sp-7);padding-top:var(--sp-5);border-top:1px solid var(--line-invert)}
.cta-alt-label{display:block;font-family:var(--font-mono);font-size:var(--fs-label);letter-spacing:.12em;text-transform:uppercase;color:var(--on-panel-muted);margin-bottom:var(--sp-3)}
.cta-alt-links{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--sp-3) var(--sp-6)}
.cta-alt-links a{font-family:var(--font-ui);font-size:var(--fs-small);color:var(--accent-on-panel);text-decoration:underline;text-underline-offset:3px;padding:var(--sp-2) 0}
@media(max-width:760px){
  .cf-row{grid-template-columns:1fr}
  .contact-form{margin-top:var(--sp-6)}
  .cf-submit{align-self:stretch}
}
```

- [ ] **Step 3: Guard the form against submitting to a placeholder**

Add to the inline `<script>`, before the closing `})();`:

```js
  // ===== Contact form =====
  // Until a real endpoint is pasted into action=, intercept the submit and
  // hand the visitor to WhatsApp with their message pre-filled, so the form
  // is never a dead end even in this interim state.
  var contactForm = document.querySelector('.contact-form');
  if (contactForm){
    contactForm.addEventListener('submit', function(e){
      var action = contactForm.getAttribute('action') || '';
      if (action.indexOf('FORM_ENDPOINT') === -1) return; // real endpoint, let it post
      e.preventDefault();
      var d = new FormData(contactForm);
      var text = 'Hi Dayam Insights, I\'m ' + (d.get('name')||'') +
                 ' from ' + (d.get('business')||'') + '. ' +
                 (d.get('message')||'') +
                 ' You can reach me on ' + (d.get('phone')||'') + '.';
      window.open('https://wa.me/917877640693?text=' + encodeURIComponent(text), '_blank', 'noopener');
    });
  }
```

- [ ] **Step 4: Track the lead event on submit as well as on link clicks**

Find the existing `generate_lead` handler near the bottom of the script and confirm it guards on `typeof window.gtag === 'function'`. Add the form to what it watches by inserting, inside the same block:

```js
  if (contactForm){
    contactForm.addEventListener('submit', function(){
      if (typeof window.gtag === 'function'){
        window.gtag('event', 'generate_lead', { method: 'form' });
      }
    });
  }
```

- [ ] **Step 5: Verify**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```
Expected: `formAction` is `FORM_ENDPOINT`, `sentinels` contains `form-endpoint`, `phone`, `contact-email`, and `deadLinks` no longer contains `#contact`.

- [ ] **Step 6: Check form contrast inside the inverted panel**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node -e "
const {chromium}=require('playwright');
function lum(c){const a=c.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2]}
function ratio(f,b){const x=lum(f),y=lum(b);const hi=Math.max(x,y),lo=Math.min(x,y);return +((hi+0.05)/(lo+0.05)).toFixed(2)}
function P(s){const m=s.match(/\d+(\.\d+)?/g);return m?[+m[0],+m[1],+m[2]]:[0,0,0]}
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});
await p.goto('http://localhost:8090/index.html',{waitUntil:'networkidle'});
const r=await p.evaluate(()=>{const i=document.querySelector('.cf-field input');const l=document.querySelector('.cf-field > span');const n=document.querySelector('.cf-note');
return {inputFg:getComputedStyle(i).color,inputBg:getComputedStyle(i).backgroundColor,labelFg:getComputedStyle(l).color,noteFg:getComputedStyle(n).color,panel:getComputedStyle(document.querySelector('.cta-band')).backgroundColor};});
console.log('input text on field :',ratio(P(r.inputFg),P(r.inputBg)));
console.log('label on panel      :',ratio(P(r.labelFg),P(r.panel)));
console.log('note on panel       :',ratio(P(r.noteFg),P(r.panel)));
await b.close();})();"
```
Expected: every ratio is at least `4.5`.

- [ ] **Step 7: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Build a real conversion path

The only ways to make contact were a WhatsApp deep link and a mailto: to
a Gmail address. Both require leaving the page, and a free Gmail address
on a site selling data infrastructure undercuts the whole proposition.

Adds a five-field form inside the inverted CTA panel, asking for the one
thing that actually qualifies a lead - what takes the most time right
now - and promising a specific reply rather than a call: the first
process worth automating, rough cost, rough timeline.

Until a real endpoint is pasted into action=, submitting hands the
visitor to WhatsApp with their answers pre-filled, so the form is never a
dead end in the interim. The endpoint, phone number and email all ship as
sentinels.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: Add the FAQ and schema

No FAQ, and schema limited to a bare `Organization` block. Both matter for AI search, which increasingly answers questions rather than returning links.

**Files:** Modify `index.html` — new section before `#cta`, plus JSON-LD

- [ ] **Step 1: Add the FAQ section**

Immediately before the `<!-- CONTACT -->` comment, insert:

```html
<!-- FAQ -->
<section class="pad wrap" id="faq" aria-labelledby="h-faq">
  <div class="section-head center reveal">
    <span class="eyebrow"><span class="dot"></span>Before you ask</span>
    <h2 class="title" id="h-faq">The questions we get every week.</h2>
  </div>
  <div class="faq-list">
    <details class="faq-item reveal" data-d="1">
      <summary>What does this cost?</summary>
      <div class="faq-body"><p>It depends on how many systems have to talk to each other, but most first projects land between a dashboard for one part of the business and a full order-to-invoice automation. We quote a fixed price before any work starts, so there is no meter running. If your budget and the scope do not meet, we will tell you on the first call.</p></div>
    </details>
    <details class="faq-item reveal" data-d="2">
      <summary>How long before I see something working?</summary>
      <div class="faq-body"><p>Most first projects are live in <span data-sentinel="lead-time">4–6 WEEKS</span>. We deliberately start with the single process costing you the most time, so you get something working — and can judge whether we are worth continuing with — before committing to anything larger.</p></div>
    </details>
    <details class="faq-item reveal" data-d="3">
      <summary>Do I have to stop using Excel?</summary>
      <div class="faq-body"><p>No. Most of our work connects the tools you already use rather than replacing them. Your team can keep entering data the way they do today; the difference is that it stops needing to be re-typed into three other places.</p></div>
    </details>
    <details class="faq-item reveal" data-d="4">
      <summary>My data is a mess. Some of it is on paper.</summary>
      <div class="faq-body"><p>That is the normal starting point, not a problem. Part of the first phase is getting what exists into one place and agreeing what each number actually means. You do not need to tidy anything up before talking to us.</p></div>
    </details>
    <details class="faq-item reveal" data-d="1">
      <summary>Do I need someone technical on my team?</summary>
      <div class="faq-body"><p>No. Everything we build is meant to be run by the people already doing the job. We hand over written instructions in plain language, and we train whoever will be using it.</p></div>
    </details>
    <details class="faq-item reveal" data-d="2">
      <summary>What happens after it is built? Am I locked in?</summary>
      <div class="faq-body"><p>Everything runs in accounts you own, and you keep the logins. If you stop working with us, the dashboards and automations keep running. We offer ongoing support if you want it, but nothing breaks if you do not.</p></div>
    </details>
    <details class="faq-item reveal" data-d="3">
      <summary>Do you work with businesses outside your city?</summary>
      <div class="faq-body"><p>Yes. We are based in <span data-sentinel="city">CITY, STATE</span> and work with businesses across India. Most of the work happens remotely, with visits where they are genuinely useful.</p></div>
    </details>
    <details class="faq-item reveal" data-d="4">
      <summary>What if I am not sure what I need?</summary>
      <div class="faq-body"><p>That is the usual case, and it is what the first conversation is for. Describe the part of the week that frustrates you most and we will tell you whether it is worth automating — including when the honest answer is that it is not.</p></div>
    </details>
  </div>
</section>
```

- [ ] **Step 2: Add the FAQ styles**

```css
/* ===== FAQ ===== */
.faq-list{max-width:var(--maxw-text);margin:var(--sp-7) auto 0;border-top:1px solid var(--line)}
.faq-item{border-bottom:1px solid var(--line)}
.faq-item summary{
  list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:var(--sp-4);
  font-family:var(--font-ui);font-size:var(--fs-h4);font-weight:600;color:var(--ink);
  padding:var(--sp-5) 0;min-height:44px;
}
.faq-item summary::-webkit-details-marker{display:none}
.faq-item summary::after{
  content:"";flex:0 0 auto;width:11px;height:11px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);
  transform:rotate(45deg);transition:transform var(--t-base) var(--ease);margin-right:4px;
}
.faq-item[open] summary::after{transform:rotate(-135deg)}
.faq-item summary:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.faq-body{padding:0 0 var(--sp-5)}
.faq-body p{font-size:var(--fs-body);color:var(--muted);margin:0}
```

`<details>`/`<summary>` gives keyboard operation, screen-reader semantics and no-JS behaviour for free. Do not replace it with a JS accordion.

- [ ] **Step 3: Replace the schema block**

Find the existing `<script type="application/ld+json">` block containing the `Organization` definition and replace it with:

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
      "description": "Dashboards, workflow automation and AI assistants for Indian SMEs. We connect orders, stock and invoices into one system that updates itself.",
      "email": "dayaminsights@gmail.com",
      "telephone": "+91-78776-40693",
      "logo": "https://dayaminsights.com/og-image.png",
      "image": "https://dayaminsights.com/og-image.png",
      "areaServed": { "@type": "Country", "name": "India" },
      "serviceType": [
        "Business intelligence dashboards",
        "Workflow automation",
        "AI assistants",
        "Website and app development",
        "Digital marketing"
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
        { "@type": "Question", "name": "Do you work with businesses outside your city?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. We work with businesses across India. Most of the work happens remotely, with visits where they are genuinely useful." } },
        { "@type": "Question", "name": "What if I am not sure what I need?", "acceptedAnswer": { "@type": "Answer", "text": "That is the usual case. Describe the part of the week that frustrates you most and we will tell you whether it is worth automating, including when the honest answer is that it is not." } }
      ]
    }
  ]
}
</script>
```

The `telephone` and `email` values must be updated when those sentinels are resolved. `address` is deliberately omitted rather than invented; add a `PostalAddress` once the city is confirmed.

- [ ] **Step 4: Re-apply the band alternation**

Adding `#faq` breaks the alternation again. Final map for eleven sections:

```bash
cd "c:/Users/USER/Documents/GitHub/website" && node -e "
const fs=require('fs');let h=fs.readFileSync('index.html','utf8');
const want={problem:'pad wrap band',intelligence:'pad wrap web-show',growth:'pad wrap web-show band',process:'pad wrap',results:'pad wrap band',why:'pad wrap',founder:'pad wrap band',tech:'pad wrap',faq:'pad wrap band',cta:'pad wrap'};
let n=0;
h=h.replace(/<section class=\"([^\"]*)\" id=\"([a-z]+)\"/g,(m,cls,id)=>{if(!(id in want))return m;n++;return '<section class=\"'+want[id]+'\" id=\"'+id+'\"';});
fs.writeFileSync('index.html',h);console.log('rewrote '+n);
"
```
Expected: `rewrote 10`

- [ ] **Step 5: Validate the JSON-LD parses**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node -e "
const fs=require('fs');const h=fs.readFileSync('index.html','utf8');
const m=[...h.matchAll(/<script type=\"application\/ld\+json\">([\s\S]*?)<\/script>/g)];
m.forEach((x,i)=>{try{const j=JSON.parse(x[1]);const t=j['@graph']?j['@graph'].map(g=>g['@type']).join(', '):j['@type'];console.log('block '+i+': OK ->',t);}catch(e){console.log('block '+i+': PARSE ERROR',e.message);}});
console.log('blocks found:',m.length);
"
```
Expected: `block 0: OK -> ProfessionalService, FAQPage` and `blocks found: 1`.

- [ ] **Step 6: Verify FAQ keyboard operation**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node -e "
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});
await p.goto('http://localhost:8090/index.html',{waitUntil:'networkidle'});
const s=await p.\$('.faq-item summary');
await s.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
console.log('open after Enter:',await p.evaluate(()=>document.querySelector('.faq-item').open));
console.log('summary height:',await p.evaluate(()=>Math.round(document.querySelector('.faq-item summary').getBoundingClientRect().height)));
console.log('count:',await p.evaluate(()=>document.querySelectorAll('.faq-item').length));
await b.close();})();"
```
Expected: `open after Enter: true`, `summary height` at least `44`, `count: 8`.

- [ ] **Step 7: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Add an FAQ and expand the schema

Eight questions an SME owner actually asks before spending money on
this - what it costs, whether Excel has to go, whether their messy data
disqualifies them, whether they are locked in afterwards. Several are
objections the rest of the page never answered.

Built on <details>/<summary>, which gives keyboard operation,
screen-reader semantics and correct no-JS behaviour without any script.

Schema goes from a bare Organization block to a @graph with
ProfessionalService and FAQPage. This matters more than usual here:
AI search answers questions rather than returning links, and an FAQPage
is the most directly quotable structure available. Address is omitted
rather than invented, pending the city.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 11: Add a mid-page CTA

The page runs from the hero to the contact section with no way to act in between. A visitor convinced by the dashboard demonstration must scroll to the bottom.

**Files:** Modify `index.html`

- [ ] **Step 1: Insert a CTA strip after `#growth`**

Immediately after the closing `</section>` of `#growth`, insert:

```html
<!-- MID-PAGE CTA -->
<div class="wrap">
  <div class="mid-cta reveal">
    <p>Not sure which of these you need first?</p>
    <a href="#contact" class="btn btn-primary">Tell us what's slowing you down <span class="arrow">→</span></a>
  </div>
</div>
```

- [ ] **Step 2: Add the style**

```css
/* ===== Mid-page CTA ===== */
.mid-cta{
  display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:var(--sp-4) var(--sp-6);
  padding:var(--sp-6);margin:var(--sp-8) 0;
  border:1px solid var(--line);border-radius:var(--r-md);background:var(--surface);
}
.mid-cta p{font-family:var(--font-ui);font-size:var(--fs-h4);font-weight:600;color:var(--ink);margin:0}
@media(max-width:760px){
  .mid-cta{flex-direction:column;gap:var(--sp-4);text-align:center}
  .mid-cta .btn{width:100%}
}
```

The strip sits between two sections rather than inside either, so it does not disturb the band alternation.

- [ ] **Step 3: Verify the rhythm is intact**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```
Expected: `rhythm` is still strictly alternating, `deadLinks` is `[]`.

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && git add index.html && git commit -m "Add a mid-page CTA

The page ran from the hero to the contact section with no way to act in
between. A visitor convinced by the dashboard demonstration had to keep
scrolling past four more sections to do anything about it.

Placed between sections rather than inside one, so the band alternation
is undisturbed.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 12: Final verification sweep

**Files:** none modified.

- [ ] **Step 1: Full harness run**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node tmp_check.js
```

Every one of these must hold:

| Field | Required |
|---|---|
| `sectionOrder` | `["top","problem","intelligence","growth","process","results","why","founder","tech","faq","cta"]` |
| `rhythm` | strictly alternating, starting `white band white band …` |
| `h1` | `Your business runs on five spreadsheets. It shouldn't have to.` |
| `navLinks` | `["The problem","What we do","How it works","Results","FAQ"]` |
| `schemaTypes` | contains `ProfessionalService` and `FAQPage` |
| `formAction` | `FORM_ENDPOINT` |
| `menu.tag` | `BUTTON` |
| `menu.expanded` | `false` |
| `menu.controls` | `mobileMenu` |
| `deadLinks` | `[]` |
| `a11y.main` | `1` |
| `a11y.skip` | `true` |
| `a11y.lab` | equals `a11y.tot` |
| `a11y.bareSvg` | `0` |
| `blurCount` | `0` |
| `mobile.ovf` | `false` |
| `consoleErrors` | `[]` |

- [ ] **Step 2: Confirm no fabricated proof survives**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && for s in 'stopped guessing on Mondays' 'never sleeps' 'matches reality' 'class="quote"' 'Representative outcomes'; do printf '%-32s %s\n' "$s" "$(grep -c "$s" index.html || echo 0)"; done
```
Expected: every count is `0`.

- [ ] **Step 3: List every outstanding sentinel**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && grep -o 'data-sentinel="[a-z0-9-]*"' index.html | sort | uniq -c | sort -rn
```

Expected keys: `revenue-band`, `lead-time` (×2), `pricing-model`, `result-1`, `result-2`, `result-3`, `founder-photo`, `founder-bio`, `founder-name`, `founder-role`, `founder-linkedin`, `city` (×2), `form-endpoint`, `phone`, `contact-email`.

This list is the handoff to the business owner. Print it into the final report.

- [ ] **Step 4: Confirm tag and brace balance**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && for t in section div span svg a main button form details summary label; do o=$(grep -o "<$t[ >]" index.html | wc -l); c=$(grep -o "</$t>" index.html | wc -l); printf '%-9s open=%-4s close=%-4s %s\n' "$t" "$o" "$c" "$([ "$o" = "$c" ] && echo OK || echo MISMATCH)"; done; echo "braces: $(grep -o '{' index.html | wc -l) / $(grep -o '}' index.html | wc -l)"
```
Expected: all `OK`, braces matching.

- [ ] **Step 5: Keyboard pass**

Load `http://localhost:8090/index.html` in a real browser at 390px and confirm:

1. First Tab reveals "Skip to content".
2. The menu button opens the panel; Escape closes it and returns focus to the button.
3. Every FAQ summary opens on Enter and shows a visible focus ring.
4. Every form field shows the lighter `--focus-invert` ring inside the dark panel.
5. Focus order follows visual order with no traps.

- [ ] **Step 6: Reduced-motion pass**

Run:
```bash
cd "c:/Users/USER/Documents/GitHub/website" && node -e "
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8090/index.html',{waitUntil:'networkidle'});
console.log(JSON.stringify(await p.evaluate(()=>({hidden:Array.from(document.querySelectorAll('.reveal')).filter(e=>getComputedStyle(e).opacity==='0').length,hover:getComputedStyle(document.querySelector('.btn-primary')).transitionDuration}))),'errors:',JSON.stringify(errs));
await b.close();})();"
```
Expected: `{"hidden":0,"hover":"0.12s"}` and `errors: []`.

- [ ] **Step 7: Clean up**

```bash
cd "c:/Users/USER/Documents/GitHub/website" && pkill -f tmp_serve.js; rm -f tmp_serve.js tmp_check.js tmp_*.png; git status --short
```
Expected: no untracked `tmp_*` files.

---

## Self-review

**Audit coverage.** Every content finding maps to a task: P0-1→9, P0-2→5, P0-3→8, P0-4→2, P0-5→9, P1-1→10, P1-3→7, P1-5→3, P1-6→6, section order→4, mid-page CTA→11.

**Placeholder scan.** No `TBD`, no "add error handling", no "similar to Task N". Every step that changes code shows the code. The `FORM_ENDPOINT` and `FOUNDER_*` strings are deliberate sentinels, not unfinished steps, and Task 12 Step 3 enumerates them as the handoff list.

**Consistency.** `#contact` is the anchor used by the hero (Task 2), footer (Task 3), results note (Task 5), mobile menu (Task 8) and mid-page CTA (Task 11); it is created in Task 9. Between Task 2 and Task 9 it is a dead link, which the harness reports and Task 12 requires to be empty. `#faq` behaves the same way between Tasks 3 and 10. The band-alternation map is rewritten in Tasks 4, 7 and 10 as sections are inserted; only the Task 10 map is final.

**Ordering risk.** Task 4 moves whole sections; Tasks 7 and 10 insert new ones. All three re-run the alternation script. Running them out of order leaves the rhythm wrong but breaks nothing structurally — the harness catches it.

**What this plan does not do.** No service pages, no real case study, no blog. The section order and naming are structured so a later `/dashboards` split does not require a rewrite.

---

## Handoff

After Task 12, the remaining work is entirely facts, not code. The sentinel list from Task 12 Step 3 is the complete set of decisions only the business can make.
