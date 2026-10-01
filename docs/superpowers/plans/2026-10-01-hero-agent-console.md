# Hero Agent Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage hero's `.hero-system` index with a live console for the existing site chatbot: an animated "signal field" canvas, the latest exchange, four starter questions, an input, and opt-in spoken replies through the browser's own voices.

**Architecture:** `assets/js/chat.js` stays the single owner of the conversation and gains a tiny broadcast API on `window.DayamChat` (`send`, `on`, `last`, `open`, `cardNode`, `svc`, `busy`, `setHero`) plus a `dayamchat:ready` event. A new `assets/js/hero.js`, loaded on `index.html` only, renders the console from those broadcasts: a canvas Field, the Console view, and a Voice queue over `speechSynthesis`. The console markup ships visible (so it does not pop in above the headline on phones once chat.js starts, which is after load), is hidden by a `<noscript>` rule without JS and by `hero.js` when chat.js is switched off, and keeps its buttons disabled until chat.js is ready. The Cloudflare Worker does not change.

**Tech Stack:** Static HTML/CSS/vanilla ES5-style JS (no build step, GitHub Pages). Playwright 1.49 check scripts in `tools/checks/` run against the local preview server `tools/serve.js` on :8090, with the Worker mocked at the network layer.

**Spec:** `docs/superpowers/specs/2026-10-01-hero-agent-console-design.md`

---

## Ground rules for the engineer

- Work from the repo root: `C:\Users\USER\Documents\GitHub\dayam insights\website` (bash: `cd "/c/Users/USER/Documents/GitHub/dayam insights/website"`).
- `tools/` is **gitignored** (local-only). The check script you write, `tools/checks/hero.js`, is never committed. Commits contain only served files and docs.
- Match the code style of the file you are in: `chat.js`/`site.js` are ES5 (`var`, `function`), two-space indent, comments explain *why*.
- The site's shapes are all square: no `border-radius` anywhere.
- Reduced motion: the global rule `@media(prefers-reduced-motion:reduce){*{animation:none!important}}` exists in `site.css`. Any new animation must land on its natural state with the animation removed (use `both` fill with the pre-state only in `from`).
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```

## File map

| File | Responsibility | Change |
|---|---|---|
| `assets/js/chat.js` | Conversation owner (state, Worker stream, panel) | Add broadcast API, `last()`, `svcOf()`, hero hooks; `fail()` returns its message |
| `assets/js/hero.js` | Homepage console: Field (canvas), Console (view), Voice (speech) | **Create** |
| `index.html` | Homepage | Replace `.hero-stage` content with console markup; `<noscript>` hides it; add `hero.js`; bump asset versions |
| `assets/css/site.css` | All page styles | Add `.hc*` console styles; console-first order ≤1000px; delete `.hero-system`/`.hs-*` |
| `assets/js/site.js` | Shared page behaviour | Delete the `hsWalk` block |
| other 8 `.html` pages | — | Bump `site.css`, `site.js`, `chat.js` version queries |
| `PROJECT_NOTES.md` | Project notes | Rewrite hero notes |
| `tools/checks/hero.js` | Playwright suite for the console (not committed) | **Create** |
| `tools/checks/chat.js` | Existing widget suite (not committed) | One block moves from `index.html` to `websites.html` |

---

### Task 0: Baseline

**Files:** none changed.

- [ ] **Step 1: Confirm a clean tree on the spec commit**

Run: `git status --short && git log --oneline -3`
Expected: no output from status; top commits are `Correct the launcher-tuck note in the hero console spec` and `Add the hero agent console design spec`.

- [ ] **Step 2: Start the preview server (leave it running in its own terminal / background)**

Run: `node tools/serve.js`
Expected: `serving on http://localhost:8090`

- [ ] **Step 3: Run the existing chat suite to get a baseline**

Run: `node tools/checks/chat.js`
Expected: ends with `all passed`.
If it fails with `Executable doesn't exist at ...headless_shell...`, run `npx playwright install chromium` and re-run. If any other check fails *before you have changed anything*, stop and report it: it is not caused by this work.

---

### Task 1: Broadcast API in chat.js

**Files:**
- Create: `tools/checks/hero.js`
- Modify: `assets/js/chat.js` (state section ~line 104, `send()` ~365-430, `fail()` ~435-460, `init()` ~620)

- [ ] **Step 1: Create the check script with its runner and the API tests**

Create `tools/checks/hero.js`:

```js
// Hero agent console suite (homepage). The Worker is mocked at the network layer, as in chat.js.
// Run from the repo root with the preview server up (node tools/serve.js): node tools/checks/hero.js
const { chromium } = require('playwright');
const B = 'http://localhost:8090/';
const API = 'http://localhost:8787/chat';
const CORS = { 'Access-Control-Allow-Origin': 'http://localhost:8090', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const SIG = 'a'.repeat(64);
const sse = (evs) => evs.map(([e, d]) => 'event: ' + e + '\ndata: ' + JSON.stringify(d) + '\n\n').join('');
const ok200 = (evs) => ({ status: 200, headers: Object.assign({ 'Content-Type': 'text/event-stream' }, CORS), body: sse(evs) });
const err = (code, status) => ({ status: status || 503, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS), body: JSON.stringify({ error: code }) });
const later = (ms, r) => new Promise((res) => setTimeout(() => res(r), ms));
const AUTO = [['text', { delta: 'That is the first thing we would **automate**. ' }], ['text', { delta: 'Most teams win back a day a week.' }],
  ['card', { kind: 'page', page: 'automation', href: '/automation.html', reason: 'Orders without re-typing' }],
  ['done', { append: [], sig: SIG }]];
const tests = [];

// ---- API (chat.js broadcasts) ----
tests.push(async ({ ok, open }) => {
  const { ctx, p } = await open('index.html', () => ok200(AUTO));
  await p.evaluate(() => { window.__ev = []; DayamChat.on((type, d) => window.__ev.push([type, d])); });
  await p.evaluate(() => DayamChat.send('We re-type orders'));
  await p.waitForFunction(() => window.__ev.some((e) => e[0] === 'done'));
  const ev = await p.evaluate(() => window.__ev);
  const kinds = ev.map((e) => e[0]).join(',');
  ok(kinds === 'turn,delta,delta,card,done', 'api: broadcasts turn, deltas, card, done in order (got ' + kinds + ')');
  ok(ev[0][1].text === 'We re-type orders', 'api: turn carries the question');
  ok(ev[1][1].delta.startsWith('That is the first'), 'api: delta carries the streamed text');
  ok(ev[3][1].svc === 'svc-auto' && ev[3][1].card.page === 'automation', 'api: card carries the card and its service class');
  ok(await p.evaluate(() => { const l = DayamChat.last(); return l.question === 'We re-type orders' && l.items.some((e) => e.who === 'card'); }), 'api: last() returns the latest exchange');
  ok(await p.evaluate(() => DayamChat.svc({ kind: 'page', page: 'websites' }) === 'svc-grow' && DayamChat.svc({ kind: 'whatsapp' }) === ''), 'api: svc() maps a card to its service class');
  ok(await p.$eval('.dc-log', (e) => e.textContent.includes('We re-type orders')), 'api: the panel log holds the same exchange');
  ok(await p.evaluate(() => DayamChat.busy() === false), 'api: busy() is false after done');
  await ctx.close();
});
tests.push(async ({ ok, open }) => {
  const { ctx, p } = await open('index.html', () => err('unavailable'));
  await p.evaluate(() => { window.__ev = []; DayamChat.on((type, d) => window.__ev.push([type, d])); });
  await p.evaluate(() => DayamChat.send('Hello there'));
  await p.waitForFunction(() => window.__ev.some((e) => e[0] === 'error'));
  const ev = await p.evaluate(() => window.__ev);
  const e = ev.find((x) => x[0] === 'error')[1];
  ok(ev.map((x) => x[0]).join(',') === 'turn,error', 'api: a failed turn broadcasts turn then error');
  ok(e.code === 'unavailable' && e.text === 'Hello there' && /answer right now/.test(e.message), 'api: error carries code, the question to retry, and the panel message');
  await ctx.close();
});
tests.push(async ({ ok, open }) => {
  const { ctx, p } = await open('index.html');
  ok(await p.evaluate(() => window.__ready === true), 'api: dayamchat:ready fires once DayamChat is set');
  await ctx.close();
});

// ---- tests above this line ----

(async () => {
  const br = await chromium.launch();
  let fail = 0;
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };

  // One page with the Worker mocked. `api(body, n)` returns a fulfil object, a promise of one, or 'abort'.
  // `init` runs before any page script (stubs). The ready flag is recorded for the API test.
  async function open(url, api, ctxOpts, init) {
    const ctx = await br.newContext(Object.assign({ viewport: { width: 1440, height: 900 } }, ctxOpts || {}));
    await ctx.addInitScript(() => {
      try { sessionStorage.setItem('dayamSplash', '1'); } catch (e) {}
      document.addEventListener('dayamchat:ready', () => { window.__ready = !!window.DayamChat; });
    });
    if (init) await ctx.addInitScript(init);
    const p = await ctx.newPage();
    const errors = [], sent = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.route(API, async (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      const body = JSON.parse(req.postData());
      sent.push(body);
      const r = await (api || (() => ok200([['text', { delta: 'Hello.' }], ['done', { append: [], sig: SIG }]])))(body, sent.length);
      return r === 'abort' ? route.abort() : route.fulfill(r);
    });
    await p.goto(B + url, { waitUntil: 'load' });
    await p.waitForFunction(() => window.DayamChat && window.DayamChat.send, null, { timeout: 8000 });
    return { ctx, p, errors, sent };
  }

  for (const t of tests) await t({ ok, open, br });
  await br.close();
  console.log(fail ? '\n' + fail + ' failed' : '\nall passed');
  process.exit(fail ? 1 : 0);
})();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tools/checks/hero.js`
Expected: FAIL — `open` times out on `window.DayamChat.send` (`page.waitForFunction: Timeout 8000ms exceeded`), because `DayamChat` has no `send` yet.

- [ ] **Step 3: Add the listener plumbing to chat.js**

In `assets/js/chat.js`, find:

```js
  var launch, dot, nudge, panel, logEl, chipsEl, form, input, sendBtn, typing, busy = false;
```

Add directly below it:

```js

  // ===== Listeners: the homepage hero (hero.js) mirrors every turn =====
  // send() stays the one place a turn happens; anything else on the page
  // (today only the hero console) watches it through these broadcasts.
  var listeners = [], hero = null;
  function emit(type, data){
    listeners.forEach(function(fn){ try { fn(type, data); } catch (e) {} });
  }
  function svcOf(card){ return card && card.kind === 'page' ? ((CARDS[card.page] || {}).svc || '') : ''; }
  // The visitor's latest question and everything that answered it.
  function last(){
    for (var i = state.log.length - 1; i >= 0; i--) {
      if (state.log[i].who === 'me') return { question: state.log[i].text, items: state.log.slice(i + 1) };
    }
    return null;
  }
```

- [ ] **Step 4: Broadcast from send()**

In `send()`, find:

```js
    var meBubble = addBubble('me', text);
    state.log.push({ who: 'me', text: text });
```

Replace with:

```js
    var meBubble = addBubble('me', text);
    state.log.push({ who: 'me', text: text });
    emit('turn', { text: text });
```

Find:

```js
    var bot = null, botEntry = null, botText = '', answered = false, gotDone = false;
```

Replace with:

```js
    var bot = null, botEntry = null, botText = '', answered = false, gotDone = false, failure = null;
```

In the `text` handler, find:

```js
        botText += d.delta;
        botEntry.text = botText;
        bot.innerHTML = md(botText);
        scrollLog();
      },
```

Replace with:

```js
        botText += d.delta;
        botEntry.text = botText;
        bot.innerHTML = md(botText);
        scrollLog();
        emit('delta', { delta: d.delta });
      },
```

In the `card` handler, find:

```js
        closeBot();
        showTyping(false);
        addCard(d);
        showTyping(true);
```

Replace with:

```js
        closeBot();
        showTyping(false);
        addCard(d);
        emit('card', { card: d, svc: svcOf(d) });
        showTyping(true);
```

Find:

```js
    }).catch(function(err){
      showTyping(false);
      fail((err && err.code) || 'unavailable', text, answered ? null : meBubble);
    }).then(function(){
      showTyping(false);
      logEl.removeAttribute('aria-busy');
      busy = false;
      sendBtn.disabled = false;
      save();
      if (!isOpen()) setUnread(true);
    });
```

Replace with:

```js
    }).catch(function(err){
      showTyping(false);
      var code = (err && err.code) || 'unavailable';
      // `text` is what to put back for a retry: nothing if part of a reply already landed.
      failure = { code: code, text: answered ? '' : text, message: fail(code, text, answered ? null : meBubble) };
    }).then(function(){
      showTyping(false);
      logEl.removeAttribute('aria-busy');
      busy = false;
      sendBtn.disabled = false;
      save();
      if (!isOpen()) setUnread(true);
      emit(failure ? 'error' : 'done', failure || {});
    });
```

- [ ] **Step 5: Make fail() return its message**

Find the whole `fail` function:

```js
  function fail(code, text, meBubble){
    if (code === 'reset') {
      state = fresh();
      state.used = true;
      state.nudged = true;
      state.open = isOpen();
      logEl.innerHTML = '';
      note('Sorry, I had to restart our chat. Could you send that again?');
      input.value = text;
      autosize();
      return;
    }
    if (meBubble) {
      meBubble.remove();
      for (var i = state.log.length - 1; i >= 0; i--) {
        if (state.log[i].who === 'me') { state.log.splice(i, 1); break; }
      }
      input.value = text;
      autosize();
    }
    note(code === 'rate_limited' || code === 'limit_reached'
      ? 'That’s more messages than I can take right now. The quickest way on from here is a person: WhatsApp us, or [use the contact form](' + contactHref() + ').'
      : 'I can’t answer right now. You can reach a person on WhatsApp, or [use the contact form](' + contactHref() + ').');
    addCard({ kind: 'whatsapp', summary: '' });
  }
```

Replace with:

```js
  // Returns the message it showed, so the hero console can show the same words.
  function fail(code, text, meBubble){
    var msg;
    if (code === 'reset') {
      state = fresh();
      state.used = true;
      state.nudged = true;
      state.open = isOpen();
      logEl.innerHTML = '';
      msg = 'Sorry, I had to restart our chat. Could you send that again?';
      note(msg);
      input.value = text;
      autosize();
      return msg;
    }
    if (meBubble) {
      meBubble.remove();
      for (var i = state.log.length - 1; i >= 0; i--) {
        if (state.log[i].who === 'me') { state.log.splice(i, 1); break; }
      }
      input.value = text;
      autosize();
    }
    msg = code === 'rate_limited' || code === 'limit_reached'
      ? 'That’s more messages than I can take right now. The quickest way on from here is a person: WhatsApp us, or [use the contact form](' + contactHref() + ').'
      : 'I can’t answer right now. You can reach a person on WhatsApp, or [use the contact form](' + contactHref() + ').';
    note(msg);
    addCard({ kind: 'whatsapp', summary: '' });
    return msg;
  }
```

- [ ] **Step 6: Publish the API and the ready event**

In `init()`, find:

```js
    window.DayamChat = { md: md, parseSSE: parseSSE, safeHref: safeHref, state: function(){ return state; } };
```

Replace with:

```js
    window.DayamChat = {
      md: md, parseSSE: parseSSE, safeHref: safeHref, state: function(){ return state; },
      send: send, last: last, cardNode: cardNode, svc: svcOf,
      busy: function(){ return busy; },
      open: function(){ track('chat_open', { source: 'hero' }); setOpen(true); },
      on: function(fn){ listeners.push(fn); },
      setHero: function(api){ hero = api; }
    };
    // chat.js starts late (after load, when idle); hero.js waits for this.
    document.dispatchEvent(new Event('dayamchat:ready'));
```

- [ ] **Step 7: Run the hero suite**

Run: `node tools/checks/hero.js`
Expected: every line `ok`, ends `all passed`.

- [ ] **Step 8: Run the existing chat suite (no regressions)**

Run: `node tools/checks/chat.js`
Expected: `all passed`.

- [ ] **Step 9: Commit**

```bash
git add assets/js/chat.js
git commit -m "$(cat <<'EOF'
Let the page listen to the chatbot's turns

chat.js broadcasts each turn (question, streamed text, page card, done
or error) and exposes send/last/open on window.DayamChat, so the
homepage hero can drive the same conversation as the panel.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Console markup and styles; remove the index

**Files:**
- Modify: `index.html:277-291` (hero-stage), `index.html:610-611` (scripts), asset versions on all 9 pages
- Modify: `assets/css/site.css` (hero section ~206, ~323-347, ~456-457, ~477-498, ~1666-1677; new block)
- Modify: `assets/js/site.js:518-546` (hsWalk)
- Test: `tools/checks/hero.js`

- [ ] **Step 1: Add the static-markup tests**

In `tools/checks/hero.js`, insert above the line `// ---- tests above this line ----`:

```js
// ---- Markup: shipped hidden, the old index gone, no JS = no console ----
tests.push(async ({ ok, br }) => {
  const raw = await (await fetch(B + 'index.html')).text();
  ok(/<div class="hc" id="heroConsole"/.test(raw) && /<noscript><style>[\s\S]*\.hero-stage\{display:none\}[\s\S]*<\/style><\/noscript>/.test(raw), 'markup: the console is in the page, and hidden without JS');
  ok(!/hero-system|hs-row/.test(raw), 'markup: the .hero-system index is gone');
  ok(/assets\/js\/hero\.js\?v=\w+" defer/.test(raw), 'markup: hero.js is loaded, deferred and versioned');
  ok((raw.match(/class="hc-chip"/g) || []).length === 4, 'markup: four starter questions');
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(B + 'index.html');
  ok(!(await p.isVisible('#heroConsole')) && await p.isVisible('#h-hero'), 'no JS: console stays hidden, the headline shows');
  await ctx.close();
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `node tools/checks/hero.js`
Expected: `FAIL markup: the console is in the page, and hidden without JS`, `FAIL markup: the .hero-system index is gone`, `FAIL markup: hero.js is loaded...`, `FAIL markup: four starter questions`. (`no JS: …` may already pass: `#heroConsole` does not exist yet, so it is not visible.)

- [ ] **Step 3: Replace the hero-stage markup in index.html**

In `index.html`, replace this whole block (from the comment through the `.hero-stage` closing `</div>`):

```html
    <!-- The things we build, drawn as one system in the order of the slogan:
         See, Automate, Grow — with the chatbot beside Automate, because it is
         the service page buyers search for by name. The blue square is the
         signal: it walks the rows once, then rests on the one being read. -->
    <div class="hero-stage">
      <nav class="hero-system" aria-label="What we build">
        <span class="hs-signal" aria-hidden="true"></span>
        <a class="hs-row svc-see" href="dashboards.html"><b>See</b><span class="hs-body"><span class="hs-name">Dashboards &amp; analytics</span><span class="hs-line">One live view of sales, stock and cash.</span></span><i class="arrow" aria-hidden="true">&rarr;</i></a>
        <a class="hs-row svc-auto" href="automation.html"><b>Automate</b><span class="hs-body"><span class="hs-name">Workflow automation</span><span class="hs-line">The repetitive steps between your tools, done without a person.</span></span><i class="arrow" aria-hidden="true">&rarr;</i></a>
        <a class="hs-row svc-auto" href="ai-chatbot.html"><b>Answer</b><span class="hs-body"><span class="hs-name">AI chatbot</span><span class="hs-line">Customer questions answered on your site and WhatsApp, from your own stock and prices.</span></span><i class="arrow" aria-hidden="true">&rarr;</i></a>
        <a class="hs-row svc-grow" href="websites.html"><b>Grow</b><span class="hs-body"><span class="hs-name">Websites &amp; digital</span><span class="hs-line">A site that turns visitors into enquiries.</span></span><i class="arrow" aria-hidden="true">&rarr;</i></a>
      </nav>
    </div>
```

with:

```html
    <!-- The agent console: the site chatbot, in the hero. It ships visible so it
         never pops in above the headline; without JS a noscript rule hides it,
         and hero.js hides it when chat.js is switched off, so there is never a
         dead input. Its buttons wait until chat.js is ready. The field behind
         it reacts as the agent reads and answers, in the colour of the service
         the answer points to. One conversation with the panel.
         Spec: docs/superpowers/specs/2026-10-01-hero-agent-console-design.md -->
    <div class="hero-stage">
      <div class="hc" id="heroConsole" role="region" aria-label="Ask our AI agent" data-mode="idle">
        <div class="hc-stage">
          <canvas aria-hidden="true"></canvas>
          <p class="hc-status"><i aria-hidden="true"></i><span class="hc-status-text">Listening</span></p>
        </div>
        <div class="hc-answer" aria-live="polite">
          <p class="hc-hint">Ask about your own business: orders, stock, enquiries, reports.</p>
        </div>
        <div class="hc-chips">
          <button type="button" class="hc-chip">We re-type every order into Tally</button>
          <button type="button" class="hc-chip">I can&rsquo;t see sales and stock in one place</button>
          <button type="button" class="hc-chip">Customers ask the same questions all day</button>
          <button type="button" class="hc-chip">Our site gets visits, not enquiries</button>
        </div>
        <form class="hc-ask">
          <label class="hc-sr" for="hcInput">Ask our AI agent</label>
          <input id="hcInput" class="hc-input" type="text" maxlength="1000" autocomplete="off" enterkeyhint="send" placeholder="What&rsquo;s slowing your business down?">
          <button type="button" class="hc-voice" aria-pressed="false" aria-label="Read replies aloud">
            <svg class="off" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM17 9l4 6M21 9l-4 6"/></svg>
            <svg class="on" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM17 8a5 5 0 0 1 0 8M19.5 5.5a9 9 0 0 1 0 13"/></svg>
          </button>
          <button type="submit" class="hc-send" aria-label="Send"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
        </form>
      </div>
    </div>
```

- [ ] **Step 4: Load hero.js and bump asset versions**

In `index.html`, find:

```html
<script src="assets/js/chat.js?v=20260920a" defer></script>
```

Replace with:

```html
<script src="assets/js/chat.js?v=20260920a" defer></script>
<script src="assets/js/hero.js?v=20261001a" defer></script>
```

In the `<noscript><style>` block in `index.html`'s `<head>`, find the line:

```css
  .hs-signal{display:none}
```

Replace it with:

```css
  .hero-stage{display:none}
```

Then bump the shared assets on every page (all three files change in this plan):

Run:
```bash
sed -i 's/site\.css?v=20260920a/site.css?v=20261001a/; s/site\.js?v=20260919c/site.js?v=20261001a/; s/chat\.js?v=20260920a/chat.js?v=20261001a/' *.html
grep -c 'v=20261001a' *.html
```
Expected: `index.html:4`, and `:3` for each of `404.html ai-chatbot.html automation.html dashboards.html faq.html how-we-work.html privacy.html websites.html`.

Create `assets/js/hero.js` for now so the page does not 404 and this commit never shows a dead console (Task 3 replaces it):

```js
/* Homepage hero: the agent console. Hidden until the next commit wires it up. */
(function(){
  var c = document.getElementById('heroConsole');
  if (c) c.hidden = true;
})();
```

- [ ] **Step 5: Delete the .hero-system styles**

In `assets/css/site.css`:

1. Find `a:not(.btn,.hs-row) .arrow{display:none}` and replace with `a:not(.btn) .arrow{display:none}`.
2. Delete the block that starts with the comment `/* An open index, not a boxed menu on graph paper (premium pass): one ink rule` and ends with the line `.hs-signal.on{opacity:1}` (inclusive; ~25 lines: `.hero-system`, every `.hs-row…`, `.hs-body`, `.hs-name`, `.hs-line`, `.hs-signal…`).
3. Delete these two lines (in the hero entrance section):
   ```css
   .hero-system{animation:heroFrame 500ms var(--ease) 700ms both}
   .hs-row{animation:heroRise 520ms var(--ease-out) both}
   ```
4. Delete the four lines `.hs-row:nth-child(2){animation-delay:900ms}` … `.hs-row:nth-child(5){animation-delay:1140ms}`.
5. Delete this whole media block:
   ```css
   @media(max-width:640px){
     .hs-row{grid-template-columns:minmax(0,1fr) 20px;row-gap:2px;padding:14px 0 14px 22px}
     .hs-row b{grid-column:1}
     .hs-body{grid-column:1}
     .hs-row .arrow{grid-column:2;grid-row:1 / span 2;align-self:center}
     .hs-line{display:none}
     .hs-signal{width:9px;height:9px;left:0}
   }
   ```
6. Find:
   ```css
   /* Homepage: the three rows and cards each wear their service. The card’s
      still sits on its tint and multiplies into it, so a pale wireframe reads
      as that service’s colour instead of grey. */
   .hs-row b{color:var(--svc-ink)}
   @media (hover:hover) and (pointer:fine){
     .hs-row:hover b{color:var(--svc-ink)}
     .hs-row:hover .arrow{color:var(--svc-ink)}
     .vcard:hover{border-color:var(--svc)}
   }
   ```
   Replace with:
   ```css
   /* Homepage: the cards each wear their service. The card’s still sits on
      its tint and multiplies into it, so a pale wireframe reads as that
      service’s colour instead of grey. */
   @media (hover:hover) and (pointer:fine){
     .vcard:hover{border-color:var(--svc)}
   }
   ```

Run: `grep -n "hs-\|hero-system" assets/css/site.css`
Expected: no output.

- [ ] **Step 6: Put the console first in the single-column hero**

In `assets/css/site.css`, inside `@media(max-width:1000px){ … }` of the hero, find:

```css
  .hero-copy{grid-column:1;grid-row:1}
  .hero-stage{grid-column:1;grid-row:2;align-self:auto}
```

Replace with:

```css
  /* Console first on one column (owner, 2026-10-01): the agent is what the hero is for.
     min-width:0 stops the phone's one-line chip row from widening the 1fr track. */
  .hero-stage{grid-column:1;grid-row:1;align-self:auto;min-width:0}
  .hero-copy{grid-column:1;grid-row:2}
```

- [ ] **Step 7: Add the console styles**

In `assets/css/site.css`, directly after the line `.hero-logos .hl svg{width:15px;height:15px;color:var(--muted-2);flex:0 0 auto}`, add:

```css

/* ===== Hero: the agent console =====
   The site chatbot in the hero, as a navy panel like the site's other mocks:
   the signal field (canvas, drawn by hero.js), the latest exchange, four
   starter questions and the input. On desktop the console holds one height
   so the copy beside it never moves while a reply streams in.
   Spec: docs/superpowers/specs/2026-10-01-hero-agent-console-design.md */
.hc{--hc-line:rgba(159,176,200,.16);--hc-line-2:rgba(159,176,200,.28);--hc-dim:#7D8FAA;
  position:relative;display:flex;flex-direction:column;height:600px;background:var(--panel);border:1px solid var(--panel);color:var(--on-panel);
  animation:heroFrame 500ms var(--ease) 700ms both}
.hc[hidden]{display:none}
.hero-stage:has(> .hc[hidden]){display:none}
.hc-stage{position:relative;flex:0 0 300px;border-bottom:1px solid var(--hc-line)}
.hc-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.hc-status{position:absolute;left:20px;top:16px;margin:0;display:flex;align-items:center;gap:10px;font-family:var(--font-ui);font-size:13px;color:var(--on-panel-muted)}
.hc-status i{width:7px;height:7px;background:var(--hc-dim)}
.hc[data-mode=thinking] .hc-status i{background:var(--accent);animation:hcBlink 600ms steps(2) infinite}
.hc[data-mode=speaking] .hc-status i{background:var(--accent)}
@keyframes hcBlink{50%{opacity:.25}}
.hc-answer{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:20px 24px 8px;font-size:16.5px;line-height:1.5}
.hc-hint{margin:0;color:var(--on-panel-muted)}
.hc-q{margin:0 0 6px;font-size:14px;color:var(--on-panel-muted)}
.hc-text p{margin:0}
.hc-text p+p,.hc-text p+ul,.hc-text ul+p{margin-top:8px}
.hc-text ul{margin:0;padding-left:18px}
.hc-text a{color:var(--on-panel);text-decoration:underline;text-underline-offset:3px}
/* The agent's page cards (chat.js cardNode), turned over for the navy panel. */
.hc .dc-card{width:100%;margin-top:12px;background:transparent;border:1px solid var(--hc-line-2);border-left:3px solid var(--svc);color:var(--on-panel)}
.hc .dc-card-plain,.hc .dc-card-wa{--svc:var(--on-panel-muted)}
.hc .dc-card-r{color:var(--on-panel-muted)}
.hc .dc-card-go{color:var(--svc)}
.hc .dc-card-plain .dc-card-go,.hc .dc-card-wa .dc-card-go{color:var(--on-panel)}
.hc-full{display:block;margin:12px 0 4px;padding:0;border:0;background:none;color:var(--on-panel);font:500 14px var(--font-ui);text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--hc-line-2);cursor:pointer}
.hc-chips{display:flex;flex-wrap:wrap;gap:8px;padding:10px 24px 16px}
.hc-chips[hidden]{display:none}
.hc-chip{min-height:36px;padding:0 12px;border:1px solid var(--hc-line-2);background:transparent;color:var(--on-panel-muted);font:500 13.5px/1.2 var(--font-ui);text-align:left;cursor:pointer;transition:color var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease)}
@media (hover:hover) and (pointer:fine){.hc-chip:hover:not(:disabled){color:var(--on-panel);border-color:var(--on-panel-muted)}}
.hc-chip:disabled{opacity:.5;cursor:default}
.hc-ask{display:flex;align-items:stretch;flex:0 0 58px;border-top:1px solid var(--hc-line)}
.hc-input{flex:1 1 auto;min-width:0;padding:0 24px;border:0;border-radius:0;background:transparent;color:var(--on-panel);font:400 16px var(--font-ui);caret-color:var(--accent)}
.hc-input::placeholder{color:var(--hc-dim);opacity:1}
.hc-input:focus{outline:none}
.hc-input:focus-visible{outline:2px solid var(--focus-invert);outline-offset:-2px}
.hc-voice,.hc-send{flex:0 0 58px;display:grid;place-items:center;border:0;cursor:pointer}
.hc-voice{background:transparent;color:var(--on-panel-muted);border-left:1px solid var(--hc-line)}
.hc-voice[hidden]{display:none}
.hc-voice[aria-pressed=true]{background:var(--panel-2);color:var(--on-panel)}
.hc-voice .on,.hc-voice[aria-pressed=true] .off{display:none}
.hc-voice[aria-pressed=true] .on{display:block}
.hc-send{background:var(--accent-hover);color:#fff}
.hc-send:disabled{background:var(--panel-2);color:var(--hc-dim);cursor:default}
.hc :is(.hc-chip,.hc-voice,.hc-send,.hc-full,.dc-card):focus-visible{outline:2px solid var(--focus-invert);outline-offset:-2px}
.hc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media(max-width:1000px){
  .hc{height:auto}
  .hc-answer{flex:none;max-height:260px}
}
@media(max-width:599px){
  .hc-stage{flex-basis:240px}
  .hc-status{left:16px;top:12px}
  .hc-answer{padding:16px 16px 6px;font-size:15.5px}
  .hc-chips{flex-wrap:nowrap;overflow-x:auto;padding:10px 16px 14px;scrollbar-width:none}
  .hc-chips::-webkit-scrollbar{display:none}
  .hc-chip{flex:none;white-space:nowrap}
  .hc-input{padding:0 16px}
  .hc-voice,.hc-send{flex-basis:52px}
}
```

- [ ] **Step 8: Delete hsWalk from site.js**

In `assets/js/site.js`, delete the whole block from the comment line `  // ===== Hero: the signal on the system =====` down to and including the closing `  }` of `if (heroSys){ … }` (the line after `window.addEventListener('resize', function(){ hsPut(hsHome); }, {passive:true});`). Keep the following line `  // Nodes and arrows share the walk, so the pulse travels the connectors too.` and everything after it.

Run: `grep -n "heroSys\|hsWalk\|hs-row" assets/js/site.js`
Expected: no output.

- [ ] **Step 9: Run the suites**

Run: `node tools/checks/hero.js`
Expected: the four `markup:` lines and `no JS:` are `ok`; the API tests still `ok`. `all passed`.

Run: `node tools/checks/site.js`
Expected: passes (it has no `.hero-system` checks). If a check fails on the hero, read it: a failure about the hero layout is expected only if it asserted the old index; report anything else.

- [ ] **Step 10: Commit**

```bash
git add index.html 404.html ai-chatbot.html automation.html dashboards.html faq.html how-we-work.html privacy.html websites.html assets/css/site.css assets/js/site.js assets/js/hero.js
git commit -m "$(cat <<'EOF'
Replace the hero index with the agent console markup

The See/Automate/Answer/Grow index and its walking signal go; the hero
stage now holds the console (field, answer, four starter questions,
input, voice toggle). It is hidden without JS, and hero.js keeps it
hidden until the next commit wires it up. On one column the console
comes first.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: hero.js — Field and Console

**Files:**
- Modify (fill): `assets/js/hero.js`
- Test: `tools/checks/hero.js`

- [ ] **Step 1: Add the console behaviour tests**

In `tools/checks/hero.js`, insert above `// ---- tests above this line ----`:

```js
// ---- Console ----
// Ready = visible and its send button enabled (it waits for chat.js).
const hc = (p) => p.waitForSelector('#heroConsole:not([hidden]) .hc-send:not([disabled])', { timeout: 8000 });
const status = (p) => p.textContent('.hc-status-text');
tests.push(async ({ ok, br }) => {
  // chat.js switched off (empty ENDPOINT): no dead console.
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.route(/assets\/js\/chat\.js/, async (route) => {
    const r = await route.fetch();
    route.fulfill({ response: r, body: (await r.text()).replace(/var ENDPOINT = [^;]+;/, "var ENDPOINT = '';") });
  });
  await p.goto(B + 'index.html', { waitUntil: 'load' });
  await p.waitForTimeout(500);
  ok(!(await p.isVisible('#heroConsole')) && await p.isVisible('#h-hero'), 'chat.js off: the console goes, the headline stays');
  await ctx.close();
});
tests.push(async ({ ok, open }) => {
  const { ctx, p, errors } = await open('index.html', (body, n) => n === 1 ? later(900, ok200(AUTO)) : ok200([['text', { delta: 'Noted.' }], ['done', { append: [], sig: SIG }]]));
  await hc(p);
  ok(await status(p) === 'Listening', 'console: shows, Listening');
  ok((await p.$$('.hc-chip')).length === 4 && await p.isVisible('.hc-chips'), 'console: four starter questions before the first message');
  ok(await p.$eval('#heroConsole', (e) => e.dataset.svc === ''), 'console: field starts in the brand blue');
  await p.click('.hc-chip >> nth=0');
  await p.waitForTimeout(250);
  ok(await status(p) === 'Reading your question' && await p.$eval('#heroConsole', (e) => e.dataset.mode === 'thinking'), 'console: Reading your question while the Worker thinks');
  ok((await p.textContent('.hc-q')) === 'We re-type every order into Tally', 'console: the question shows above the answer');
  ok(!(await p.isVisible('.hc-chips')), 'console: chips leave once something is asked');
  ok(await p.$eval('.hc-send', (e) => e.disabled), 'console: send is disabled while a reply is coming');
  await p.waitForFunction(() => document.querySelector('#heroConsole').dataset.mode === 'idle');
  ok((await p.innerHTML('.hc-answer')).includes('<strong>automate</strong>'), 'console: streamed reply renders as markdown');
  ok(!!(await p.$('.hc-answer .dc-card.svc-auto')), 'console: the page card shows in the automation colour');
  ok(await p.$eval('#heroConsole', (e) => e.dataset.svc === 'svc-auto'), 'console: field takes the card\'s service colour');
  ok(await status(p) === 'Listening' && !(await p.$eval('.hc-send', (e) => e.disabled)), 'console: back to Listening, send enabled');
  ok(!(await p.$('.hc-full')), 'console: no full-conversation link after one turn');
  await p.fill('#hcInput', 'Billing is in Tally');
  await p.press('#hcInput', 'Enter');
  await p.waitForSelector('.hc-full');
  ok(await p.$eval('#hcInput', (e) => e.value === ''), 'console: input clears on send');
  ok(await p.$eval('#heroConsole', (e) => e.dataset.svc === ''), 'console: a new question resets the colour');
  ok(await p.$eval('.dc-log', (e) => e.textContent.includes('We re-type every order into Tally') && e.textContent.includes('Billing is in Tally')), 'console: the panel log holds both turns');
  await p.click('.hc-full');
  ok(await p.isVisible('.dc-panel'), 'console: See full conversation opens the panel');
  ok(errors.length === 0, 'console: no page errors' + (errors.length ? ' — ' + errors.join(' | ') : ''));
  await ctx.close();
});
tests.push(async ({ ok, open }) => {
  const { ctx, p } = await open('index.html', () => err('unavailable'));
  await hc(p);
  await p.fill('#hcInput', 'Can you help?');
  await p.press('#hcInput', 'Enter');
  await p.waitForSelector('.hc-answer .dc-card-wa');
  ok((await p.textContent('.hc-answer')).includes('answer right now'), 'error: the panel\'s message shows in the hero');
  ok(await p.$eval('#hcInput', (e) => e.value === 'Can you help?'), 'error: the question goes back into the input');
  ok(await status(p) === 'Listening' && !(await p.$eval('.hc-send', (e) => e.disabled)), 'error: back to Listening, send enabled');
  await ctx.close();
});
tests.push(async ({ ok, open }) => {
  // A returning visitor: the latest exchange is restored, the chips stay away.
  const { ctx, p } = await open('index.html', () => ok200(AUTO));
  await hc(p);
  await p.click('.hc-chip >> nth=1');
  await p.waitForFunction(() => document.querySelector('#heroConsole').dataset.mode === 'idle' && document.querySelector('.hc-answer .dc-card'));
  await p.reload({ waitUntil: 'load' });
  await hc(p);
  ok((await p.textContent('.hc-q')) === 'I can’t see sales and stock in one place', 'restore: the latest question comes back');
  ok(!!(await p.$('.hc-answer .dc-card.svc-auto')) && await p.$eval('#heroConsole', (e) => e.dataset.svc === 'svc-auto'), 'restore: its card and colour come back');
  ok(!(await p.isVisible('.hc-chips')), 'restore: chips stay hidden');
  await ctx.close();
});
tests.push(async ({ ok, open }) => {
  const { ctx, p } = await open('index.html', () => ok200(AUTO), { reducedMotion: 'reduce' });
  await hc(p);
  ok(await p.$eval('#heroConsole', (e) => e.dataset.field === 'still'), 'reduced motion: the field is a still frame');
  await p.click('.hc-chip >> nth=0');
  await p.waitForFunction(() => document.querySelector('#heroConsole').dataset.mode === 'idle' && document.querySelector('.hc-answer .dc-card'));
  ok(await p.$eval('#heroConsole', (e) => e.dataset.field === 'still'), 'reduced motion: still after a reply');
  await ctx.close();
});
tests.push(async ({ ok, open }) => {
  const { ctx, p } = await open('index.html', null, { viewport: { width: 1440, height: 900 } });
  await hc(p);
  ok(await p.$eval('#heroConsole', (e) => e.dataset.field === 'running'), 'desktop: the field animates while on screen');
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await p.waitForFunction(() => document.querySelector('#heroConsole').dataset.field === 'still');
  ok(true, 'desktop: the field pauses once scrolled away');
  const h = await p.$eval('#heroConsole', (e) => e.offsetHeight);
  ok(h === 600, 'desktop: the console holds 600px (got ' + h + ')');
  await ctx.close();
});
tests.push(async ({ ok, open }) => {
  const { ctx, p } = await open('index.html', null, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await hc(p);
  const m = await p.evaluate(() => ({
    order: document.querySelector('#heroConsole').getBoundingClientRect().top < document.querySelector('#h-hero').getBoundingClientRect().top,
    overflow: document.documentElement.scrollWidth > innerWidth,
    chipsScroll: document.querySelector('.hc-chips').scrollWidth > document.querySelector('.hc-chips').clientWidth,
    ph: document.querySelector('#hcInput').placeholder,
    font: getComputedStyle(document.querySelector('#hcInput')).fontSize,
    stage: document.querySelector('.hc-stage').offsetHeight
  }));
  ok(m.order, 'phone: the console sits above the headline');
  ok(!m.overflow, 'phone: no horizontal scroll at 390px');
  ok(m.chipsScroll, 'phone: the chip row scrolls sideways');
  ok(m.ph === 'Ask about your business', 'phone: short placeholder');
  ok(m.font === '16px', 'phone: input is 16px (no iOS zoom)');
  ok(m.stage === 240, 'phone: field is 240px tall (got ' + m.stage + ')');
  await ctx.close();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node tools/checks/hero.js`
Expected: every `console:`/`error:`/`restore:`/`reduced motion:`/`desktop:`/`phone:` test fails — `page.waitForSelector: Timeout 8000ms exceeded` (the placeholder hero.js hides the console). `chat.js off` passes for the same reason.

- [ ] **Step 3: Let chat.js say it will start**

`chat.js` and `hero.js` are both deferred and run in page order, so `hero.js` can tell at once whether chat.js is going to start (it bails out early with no endpoint or no `fetch`). In `assets/js/chat.js`, find:

```js
  if (!ENDPOINT || !window.fetch || !window.JSON || !document.currentScript) return;
```

Replace with:

```js
  if (!ENDPOINT || !window.fetch || !window.JSON || !document.currentScript) return;
  // Read by hero.js, which runs next: the widget will start (after load, when idle).
  window.DayamChatLoading = true;
```

- [ ] **Step 4: Write hero.js**

Replace the contents of `assets/js/hero.js` with:

```js
/* Homepage hero: the agent console. The site chatbot (chat.js, window.DayamChat)
   driven from the hero, with the signal field drawn behind the conversation:
   a grid of squares whose centre breathes, which sweeps while the agent reads
   the question and sends a ring out with every piece of the reply, in the
   colour of the service the answer points to.
   Spec: docs/superpowers/specs/2026-10-01-hero-agent-console-design.md */
(function(){
  'use strict';

  var root = document.getElementById('heroConsole');
  if (!root) return;
  // Hiding the whole stage (not just the console) leaves no empty grid cell or gap.
  var stage = root.closest('.hero-stage') || root;
  // chat.js (deferred, earlier in the page) sets this only once it knows it will
  // start. Without it the console would be a dead input, so it goes.
  if (!window.DayamChatLoading || !window.HTMLCanvasElement || !('IntersectionObserver' in window)) {
    stage.hidden = true;
    return;
  }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = window.matchMedia('(max-width: 599px)');
  // Field colour per service class, as "r,g,b": the --see, --auto and --grow tokens.
  var RGB = { 'svc-see': '30,123,255', 'svc-auto': '255,154,31', 'svc-grow': '22,179,100' };
  var BLUE = '30,123,255';
  var STATUS = { idle: 'Listening', thinking: 'Reading your question', speaking: 'Answering' };
  var PLACEHOLDER = { wide: 'What’s slowing your business down?', small: 'Ask about your business' };

  // ===== Field =====
  // `host` gets data-field="running" while the loop runs and "still" otherwise,
  // so the loop's state can be checked from outside.
  function Field(cv, host){
    var ctx = cv.getContext('2d'), W = 0, H = 0, t = 0, last = 0, raf = 0, on = false;
    var mode = 'idle', energy = 0, target = 0, rgb = BLUE, rings = [], idleAt = 0;

    function size(){
      var d = Math.min(2, window.devicePixelRatio || 1);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * d); cv.height = Math.round(H * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    // Brightness at distance `dist` from the centre from every ring still travelling.
    function ringsAt(dist){
      var v = 0;
      for (var i = 0; i < rings.length; i++) {
        var age = t - rings[i].t0, x = dist - age * 240;
        v += rings[i].a * Math.exp(-x * x / 288) * Math.exp(-age * 1.1);
      }
      return v * .75;
    }
    function draw(){
      ctx.clearRect(0, 0, W, H);
      var cell = 20, cx = W / 2, cy = H / 2, reach = Math.min(W, H) * .75, sweep = t * 3.2;
      for (var y = 0; y <= H / cell + 1; y++) for (var x = 0; x <= W / cell + 1; x++) {
        var px = x * cell, py = y * cell, dx = px - cx, dy = py - cy, d = Math.sqrt(dx * dx + dy * dy);
        var v = ringsAt(d);
        if (mode === 'thinking' && !reduce) {
          var da = Math.abs(((Math.atan2(dy, dx) - sweep) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
          v += Math.max(0, 1 - da * 2.2) * Math.max(0, 1 - d / (reach * .8)) * .7;
        }
        v += Math.max(0, 1 - d / (34 + energy * 20)) * (.6 + energy * .4);   // the core
        v += .04 + .03 * Math.sin(x * .7 + y * 1.3 + t * .8);                // the breath
        v = Math.min(1, v) * Math.max(0, 1 - d / reach);
        var s = 2 + v * 6;
        ctx.fillStyle = v > .28 ? 'rgba(' + rgb + ',' + (.2 + v * .8) + ')' : 'rgba(159,176,200,' + (.06 + v * .9) + ')';
        ctx.fillRect(px - s / 2, py - s / 2, s, s);
      }
    }
    function frame(now){
      raf = 0;
      var dt = last ? Math.min(.05, (now - last) / 1000) : 0;
      last = now; t += dt;
      target *= Math.pow(.02, dt);
      energy += (target - energy) * Math.min(1, dt * 12);
      if (mode === 'idle' && t - idleAt > 3.2) { idleAt = t; rings.push({ t0: t, a: .25 }); }
      rings = rings.filter(function(r){ return t - r.t0 < 3; });
      draw();
      if (on) raf = requestAnimationFrame(frame);
    }

    size();
    draw();
    host.setAttribute('data-field', 'still');
    addEventListener('resize', function(){ size(); draw(); }, { passive: true });

    return {
      // Loop only while on screen, and never under reduced motion (one still frame instead).
      run: function(yes){
        on = !!yes && !reduce;
        if (on && !raf) { last = 0; raf = requestAnimationFrame(frame); }
        if (!on && raf) { cancelAnimationFrame(raf); raf = 0; }
        host.setAttribute('data-field', on ? 'running' : 'still');
      },
      mode: function(m){ mode = m; if (!on) draw(); },
      pulse: function(a){
        if (reduce) return;
        target = Math.min(1, a);
        rings.push({ t0: t, a: a });
        if (rings.length > 40) rings.shift();
      },
      colour: function(c){ rgb = c; if (!on) draw(); }
    };
  }

  // ===== Console =====
  // Drawn at once; wired to the conversation when chat.js is ready.
  (function(){
    var Chat = null;
    var statusEl = root.querySelector('.hc-status-text');
    var answer = root.querySelector('.hc-answer');
    var chips = root.querySelector('.hc-chips');
    var form = root.querySelector('.hc-ask');
    var input = root.querySelector('.hc-input');
    var sendBtn = root.querySelector('.hc-send');
    var mode = 'idle', visible = false, segEl = null, segText = '';
    var field = Field(root.querySelector('.hc-stage canvas'), root);

    function setMode(m){
      mode = m;
      root.setAttribute('data-mode', m);
      statusEl.textContent = STATUS[m];
      field.mode(m);
    }
    function setColour(svc){
      root.setAttribute('data-svc', svc || '');
      field.colour(RGB[svc] || BLUE);
    }
    function setBusy(on){
      sendBtn.disabled = on;
      Array.prototype.forEach.call(chips.querySelectorAll('button'), function(b){ b.disabled = on; });
    }
    function asked(){ return Chat.state().log.filter(function(e){ return e.who === 'me'; }).length; }
    function keepDown(){ answer.scrollTop = answer.scrollHeight; }

    // The answer area holds the latest exchange only: the question, then the
    // reply as text segments with any cards between them.
    function showQuestion(text){
      answer.innerHTML = '';
      segEl = null;
      var q = document.createElement('p');
      q.className = 'hc-q';
      q.textContent = text;
      answer.appendChild(q);
    }
    function addText(delta){
      if (!segEl) {
        segEl = document.createElement('div');
        segEl.className = 'hc-text';
        answer.appendChild(segEl);
        segText = '';
      }
      segText += delta;
      segEl.innerHTML = Chat.md(segText);
      keepDown();
    }
    function addCard(card){
      segEl = null;
      answer.appendChild(Chat.cardNode(card));
      keepDown();
    }
    function addFullLink(){
      if (asked() < 2 || answer.querySelector('.hc-full')) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'hc-full';
      b.textContent = 'See full conversation';
      b.addEventListener('click', function(){ Chat.open(); });
      answer.appendChild(b);
      keepDown();
    }

    // A returning visitor (the conversation follows them between pages) sees
    // where they left off, not the empty prompt.
    function restore(){
      var prev = Chat.last();
      if (!prev) return;
      chips.hidden = true;
      showQuestion(prev.question);
      prev.items.forEach(function(e){
        if (e.who === 'card') {
          addCard(e.card);
          if (e.card.kind === 'page') setColour(Chat.svc(e.card));
        } else if (e.who === 'bot') {
          segEl = null;
          addText(e.text);
        }
      });
      addFullLink();
    }

    // Every turn, wherever it was asked (here or in the panel).
    function onTurn(type, d){
      if (type === 'turn') {
        input.value = '';
        chips.hidden = true;
        showQuestion(d.text);
        setColour('');
        setBusy(true);
        setMode('thinking');
      } else if (type === 'delta') {
        if (mode !== 'speaking') setMode('speaking');
        addText(d.delta);
        field.pulse(.55 + Math.random() * .45);
      } else if (type === 'card') {
        addCard(d.card);
        if (d.card.kind === 'page') setColour(d.svc);
      } else if (type === 'done') {
        setBusy(false);
        addFullLink();
        setMode('idle');
      } else if (type === 'error') {
        setBusy(false);
        segEl = null;
        addText(d.message);
        if (d.code !== 'reset') addCard({ kind: 'whatsapp', summary: '' });
        if (d.text) input.value = d.text;
        setMode('idle');
      }
    }

    // Until chat.js is ready the buttons wait. A disabled default button also
    // blocks Enter, so nothing is sent into the void.
    setColour('');
    setMode('idle');
    setBusy(true);

    chips.addEventListener('click', function(e){
      var b = e.target.closest('.hc-chip');
      if (Chat && b && !b.disabled) Chat.send(b.textContent);
    });
    form.addEventListener('submit', function(e){
      e.preventDefault();
      if (Chat) Chat.send(input.value);
    });

    function placeholder(){ input.placeholder = small.matches ? PLACEHOLDER.small : PLACEHOLDER.wide; }
    placeholder();
    if (small.addEventListener) small.addEventListener('change', placeholder);

    // "Visible" for the header button and the nudge means a quarter of the console
    // is on screen; the field runs whenever any of it is.
    new IntersectionObserver(function(es){
      visible = es[0].intersectionRatio >= .25;
      field.run(es[0].isIntersecting);
    }, { threshold: [0, .25] }).observe(root);

    function wire(){
      Chat = window.DayamChat;
      if (!Chat || !Chat.on) { stage.hidden = true; return; }
      Chat.on(onTurn);
      Chat.setHero({
        visible: function(){ return visible; },
        focus: function(){ input.focus(); }
      });
      setBusy(Chat.busy());
      restore();
    }
    if (window.DayamChat && window.DayamChat.send) wire();
    else document.addEventListener('dayamchat:ready', wire, { once: true });
  })();
})();
```

- [ ] **Step 5: Bump versions so returning visitors get both files**

A cached chat.js without `DayamChatLoading` would make the new hero.js hide the console, so chat.js moves too.

Run:
```bash
sed -i 's/hero\.js?v=20261001a/hero.js?v=20261001b/' index.html
sed -i 's/chat\.js?v=20261001a/chat.js?v=20261001b/' *.html
grep -c 'chat\.js?v=20261001b' *.html; grep -c 'hero\.js?v=20261001b' index.html
```
Expected: `1` for each of the 9 pages, then `1`.

- [ ] **Step 6: Run the hero suite**

Run: `node tools/checks/hero.js`
Expected: all `ok`, `all passed`. Note the markup test regex `hero\.js\?v=\w+` accepts `20261001b`.

- [ ] **Step 7: Run the chat suite**

Run: `node tools/checks/chat.js`
Expected: `all passed`. Anything failing: fix before committing.

- [ ] **Step 8: Commit**

```bash
git add assets/js/hero.js assets/js/chat.js 404.html ai-chatbot.html automation.html dashboards.html faq.html how-we-work.html index.html privacy.html websites.html
git commit -m "$(cat <<'EOF'
Bring the hero console to life

hero.js wires the console up once chat.js is ready (and hides it if
chat.js is switched off), mirrors each turn
(question, streamed reply, cards, errors) and draws the signal field:
a sweep while the agent reads, a ring per piece of reply, the colour of
the service the answer points to. The field pauses off screen and is a
still frame under reduced motion.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Voice

**Files:**
- Modify: `assets/js/hero.js`
- Test: `tools/checks/hero.js`

- [ ] **Step 1: Add the voice tests**

In `tools/checks/hero.js`, insert above `// ---- tests above this line ----`:

```js
// ---- Voice (speechSynthesis stubbed: records what would be spoken) ----
const fakeSpeech = () => {
  window.__spoken = []; window.__cancels = 0;
  const voices = [{ name: 'Microsoft David', lang: 'en-US' }, { name: 'Google UK English Female', lang: 'en-GB' }, { name: 'Google हिन्दी', lang: 'hi-IN' }];
  window.SpeechSynthesisUtterance = function(text){ this.text = text; };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    getVoices: () => voices,
    speak: (u) => { window.__spoken.push({ text: u.text, voice: u.voice && u.voice.name }); setTimeout(() => u.onend && u.onend(), 5); },
    cancel: () => { window.__cancels++; },
    addEventListener: () => {}
  } });
};
tests.push(async ({ ok, open }) => {
  const reply = [['text', { delta: 'One. Two? ' }], ['text', { delta: 'Three' }], ['done', { append: [], sig: SIG }]];
  const { ctx, p } = await open('index.html', () => ok200(reply), null, fakeSpeech);
  await hc(p);
  ok(await p.$eval('.hc-voice', (e) => !e.hidden && e.getAttribute('aria-pressed') === 'false'), 'voice: toggle shows, off on arrival');
  await p.click('.hc-chip >> nth=0');
  await p.waitForFunction(() => document.querySelector('#heroConsole').dataset.mode === 'idle');
  ok(await p.evaluate(() => window.__spoken.length === 0), 'voice: nothing is spoken while it is off');
  await p.click('.hc-voice');
  ok(await p.$eval('.hc-voice', (e) => e.getAttribute('aria-pressed') === 'true'), 'voice: toggle switches on');
  await p.fill('#hcInput', 'Say it');
  await p.press('#hcInput', 'Enter');
  await p.waitForFunction(() => window.__spoken.length === 3 && document.querySelector('#heroConsole').dataset.mode === 'idle');
  const spoken = await p.evaluate(() => window.__spoken);
  ok(spoken.map((s) => s.text).join('|') === 'One.|Two?|Three', 'voice: one utterance per sentence, the last flushed at done (got ' + spoken.map((s) => s.text).join('|') + ')');
  ok(spoken.every((s) => s.voice === 'Google UK English Female'), 'voice: English uses Google UK English Female first');
  const before = await p.evaluate(() => window.__cancels);
  await p.fill('#hcInput', 'Again');
  await p.press('#hcInput', 'Enter');
  ok(await p.evaluate((b) => window.__cancels > b, before), 'voice: a new question cancels speech');
  await p.reload({ waitUntil: 'load' });
  await hc(p);
  ok(await p.$eval('.hc-voice', (e) => e.getAttribute('aria-pressed') === 'true'), 'voice: the choice is kept for the visit');
  await ctx.close();
});
tests.push(async ({ ok, open }) => {
  const reply = [['text', { delta: 'यह पहली चीज़ है। ' }], ['text', { delta: 'هذا أول شيء. ' }], ['done', { append: [], sig: SIG }]];
  const { ctx, p } = await open('index.html', () => ok200(reply), null, fakeSpeech);
  await hc(p);
  await p.click('.hc-voice');
  await p.click('.hc-chip >> nth=0');
  await p.waitForFunction(() => document.querySelector('#heroConsole').dataset.mode === 'idle');
  await p.waitForTimeout(100);
  const spoken = await p.evaluate(() => window.__spoken);
  ok(spoken.length === 1 && spoken[0].voice === 'Google हिन्दी', 'voice: Hindi goes to the Google Hindi voice; Arabic with no voice stays text-only');
  await ctx.close();
});
tests.push(async ({ ok, open }) => {
  const { ctx, p } = await open('index.html', null, null, () => {
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined });
  });
  await hc(p);
  ok(await p.$eval('.hc-voice', (e) => e.hidden), 'voice: no speech support, no toggle');
  await ctx.close();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node tools/checks/hero.js`
Expected: `FAIL voice: toggle switches on` (nothing toggles yet), `FAIL voice: one utterance per sentence…`, `FAIL voice: no speech support, no toggle`, and the Hindi test fails (nothing spoken). The first voice line (`toggle shows, off on arrival`) may pass.

- [ ] **Step 3: Add the Voice module**

In `assets/js/hero.js`, find the line:

```js
  // ===== Console =====
```

Insert directly above it:

```js
  // ===== Voice =====
  // The browser's own voices (free; the owner compared them with OpenAI TTS and
  // chose these). Off on arrival, kept for the visit. One utterance per sentence:
  // Chrome cuts long utterances off at ~15 s, and speech can start before the
  // reply has finished streaming. A reply with no voice for its language stays
  // text-only rather than being read in the wrong accent.
  var VOICE_KEY = 'dayamVoice';
  var PREFER = {
    en: [/^Google UK English Female$/, /^Google US English$/, /natural/i],
    hi: [/^Google हिन्दी$/],
    ar: []
  };
  function Voice(){
    var synth = window.speechSynthesis;
    var ok = !!synth && typeof window.SpeechSynthesisUtterance === 'function';
    var on = false, queue = [], busy = false, onWord = function(){}, onDone = function(){};
    try { on = ok && sessionStorage.getItem(VOICE_KEY) === '1'; } catch (e) {}
    if (ok) synth.getVoices();   // Chrome loads the list lazily; ask early.

    function lang(text){ return /[\u0900-\u097F]/.test(text) ? 'hi' : /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en'; }
    function pick(code){
      var all = synth.getVoices().filter(function(v){ return String(v.lang).toLowerCase().indexOf(code) === 0; });
      for (var i = 0; i < PREFER[code].length; i++) {
        for (var j = 0; j < all.length; j++) if (PREFER[code][i].test(all[j].name)) return all[j];
      }
      return all[0] || null;
    }
    // What a person would read aloud: link text without the URL, no markdown marks.
    function plain(s){
      return String(s).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '')
        .replace(/[*_`#>]/g, '').replace(/^\s*[-•]\s+/gm, '').replace(/\s+/g, ' ').trim();
    }
    function next(){
      if (busy) return;
      if (!queue.length) { onDone(); return; }
      var text = queue.shift(), v = pick(lang(text));
      if (!v) { next(); return; }
      var u = new SpeechSynthesisUtterance(text);
      u.voice = v;
      u.lang = v.lang;
      u.onboundary = function(e){ if (!e.name || e.name === 'word') onWord(); };
      u.onend = u.onerror = function(){ busy = false; next(); };
      busy = true;
      synth.speak(u);
    }
    return {
      supported: ok,
      on: function(){ return on; },
      set: function(yes){
        on = ok && !!yes;
        try { sessionStorage.setItem(VOICE_KEY, on ? '1' : '0'); } catch (e) {}
        if (!on) this.stop();
      },
      say: function(sentence){
        if (!on) return;
        var s = plain(sentence);
        if (s) { queue.push(s); next(); }
      },
      stop: function(){ queue = []; busy = false; if (ok) synth.cancel(); },
      speaking: function(){ return busy || queue.length > 0; },
      hooks: function(word, done){ onWord = word; onDone = done; }
    };
  }

```

- [ ] **Step 4: Wire the voice into the console**

In `start()` in `assets/js/hero.js`:

(a) Find:

```js
    var mode = 'idle', visible = false, segEl = null, segText = '';
```

Replace with:

```js
    var spk = root.querySelector('.hc-voice');
    var mode = 'idle', visible = false, segEl = null, segText = '', pending = '';
    var voice = Voice();
```

(b) Find:

```js
    function asked(){ return Chat.state().log.filter(function(e){ return e.who === 'me'; }).length; }
```

Insert directly above it:

```js
    // Hand every finished sentence in `buf` to the voice; return the unfinished rest.
    function speakSentences(buf){
      var re = /([.!?।؟]+["”’)]*)\s+|\n+/g, m, cut = 0;
      while ((m = re.exec(buf))) {
        voice.say(buf.slice(cut, m.index + (m[1] ? m[1].length : 0)));
        cut = re.lastIndex;
      }
      return buf.slice(cut);
    }
```

(c) Replace the whole `function onTurn(type, d){ … }` function (from its comment line `// Every turn, wherever it was asked` to its closing `}`) with:

```js
    // Every turn, wherever it was asked (here or in the panel).
    function onTurn(type, d){
      if (type === 'turn') {
        voice.stop();
        pending = '';
        input.value = '';
        chips.hidden = true;
        showQuestion(d.text);
        setColour('');
        setBusy(true);
        setMode('thinking');
      } else if (type === 'delta') {
        if (mode !== 'speaking') setMode('speaking');
        addText(d.delta);
        // With the voice on, the rings follow the spoken words instead.
        if (!voice.on()) field.pulse(.55 + Math.random() * .45);
        pending = speakSentences(pending + d.delta);
      } else if (type === 'card') {
        addCard(d.card);
        if (d.card.kind === 'page') setColour(d.svc);
      } else if (type === 'done') {
        setBusy(false);
        if (pending.trim()) voice.say(pending);
        pending = '';
        addFullLink();
        if (!voice.speaking()) setMode('idle');
      } else if (type === 'error') {
        voice.stop();
        pending = '';
        setBusy(false);
        segEl = null;
        addText(d.message);
        if (d.code !== 'reset') addCard({ kind: 'whatsapp', summary: '' });
        if (d.text) input.value = d.text;
        setMode('idle');
      }
    }

    voice.hooks(
      function(){ field.pulse(.55 + Math.random() * .45); },
      function(){ if (!sendBtn.disabled) setMode('idle'); }
    );
    if (!voice.supported) spk.hidden = true;
    spk.setAttribute('aria-pressed', String(voice.on()));
    spk.addEventListener('click', function(){
      voice.set(!voice.on());
      spk.setAttribute('aria-pressed', String(voice.on()));
    });
```

- [ ] **Step 5: Bump hero.js's version**

In `index.html`, change `assets/js/hero.js?v=20261001b` to `assets/js/hero.js?v=20261001c`.

- [ ] **Step 6: Run the hero suite**

Run: `node tools/checks/hero.js`
Expected: all `ok`, `all passed`.

- [ ] **Step 7: Commit**

```bash
git add assets/js/hero.js index.html
git commit -m "$(cat <<'EOF'
Read hero replies aloud when the visitor asks

A speaker toggle, off on arrival and kept for the visit, reads each
sentence as it streams with the browser's own voices: Google UK English
Female first for English, Google Hindi for Hindi, text-only when there
is no voice for the language. The field's rings follow the spoken words.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Homepage behaviour of the header button, nudge and unread dot

**Files:**
- Modify: `assets/js/chat.js` (`send()` final `.then`, `armNudge()` `fire()`, `wireOpeners()`)
- Modify: `tools/checks/chat.js:117-126` (menu block)
- Test: `tools/checks/hero.js`

- [ ] **Step 1: Add the tests**

In `tools/checks/hero.js`, insert above `// ---- tests above this line ----`:

```js
// ---- The rest of the widget defers to the hero while it is on screen ----
tests.push(async ({ ok, open }) => {
  const { ctx, p } = await open('index.html', () => ok200(AUTO));
  await hc(p);
  await p.click('.nav-cta .nav-ask');
  ok(await p.evaluate(() => document.activeElement.id === 'hcInput') && !(await p.isVisible('.dc-panel')), 'header button: with the hero on screen it focuses the hero input');
  await p.click('.hc-chip >> nth=0');
  await p.waitForFunction(() => document.querySelector('#heroConsole').dataset.mode === 'idle' && document.querySelector('.hc-answer .dc-card'));
  ok(await p.$eval('.dc-dot', (e) => e.hidden), 'unread dot: a reply read in the hero does not light it');
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * .5));
  await p.waitForTimeout(300);
  await p.click('.nav-cta .nav-ask');
  ok(await p.isVisible('.dc-panel'), 'header button: once the hero has scrolled away it opens the panel');
  await ctx.close();
});
tests.push(async ({ ok, open }) => {
  // The nudge fires at 20 s; with the console on screen it waits.
  const { ctx, p } = await open('index.html');
  await hc(p);
  await p.waitForTimeout(21500);
  ok(!(await p.$('.dc-nudge')), 'nudge: held back while the hero console is on screen');
  await ctx.close();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node tools/checks/hero.js`
Expected: `FAIL header button: with the hero on screen it focuses the hero input`, `FAIL unread dot: …`, `FAIL nudge: held back …`.

- [ ] **Step 3: Header and menu buttons focus the hero while it is on screen**

In `assets/js/chat.js`, in `wireOpeners()`, find:

```js
        if (toggle && toggle.getAttribute('aria-expanded') === 'true') toggle.click();
        if (isOpen()) { setOpen(false); return; }
```

Replace with:

```js
        if (toggle && toggle.getAttribute('aria-expanded') === 'true') toggle.click();
        if (isOpen()) { setOpen(false); return; }
        // On the homepage the agent is already in the hero: go there instead of opening a second view.
        if (hero && hero.visible()) { track('chat_open', { source: 'nav-hero' }); hero.focus(); return; }
```

- [ ] **Step 4: Hold the nudge while the hero is on screen**

In `armNudge()`, find:

```js
      // Over the form: try again once it has scrolled away.
      if (formOnScreen()) { clearTimeout(t); t = setTimeout(fire, 6000); return; }
```

Replace with:

```js
      // Over the form, or with the hero console in view: try again once it has scrolled away.
      if (formOnScreen() || (hero && hero.visible())) { clearTimeout(t); t = setTimeout(fire, 6000); return; }
```

- [ ] **Step 5: No unread dot for a reply the visitor watched in the hero**

In `send()`'s final `.then`, find:

```js
      if (!isOpen()) setUnread(true);
      emit(failure ? 'error' : 'done', failure || {});
```

Replace with:

```js
      if (!isOpen() && !(hero && hero.visible())) setUnread(true);
      emit(failure ? 'error' : 'done', failure || {});
```

- [ ] **Step 6: Move the menu test off the homepage**

In `tools/checks/chat.js`, find:

```js
    const { ctx, p } = await open('index.html', null, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    ok(await p.$eval('.nav-cta .nav-ask', (e) => e.offsetHeight === 44 && e.offsetWidth === 44 && e.textContent.trim() === 'Talk to our AI agent'), 'phone header at 390: the 44px square, label kept for screen readers');
```

Replace `open('index.html'` in that line with `open('websites.html'` (the homepage's menu button now focuses the hero console, which Task 5's hero suite covers):

```js
    const { ctx, p } = await open('websites.html', null, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
```

- [ ] **Step 7: Bump chat.js's version on every page**

Run:
```bash
sed -i 's/chat\.js?v=20261001b/chat.js?v=20261001c/' *.html
grep -c 'chat\.js?v=20261001c' *.html
```
Expected: `1` for each of the 9 pages.

- [ ] **Step 8: Run both suites**

Run: `node tools/checks/hero.js`
Expected: `all passed` (takes ~25 s longer for the nudge wait).

Run: `node tools/checks/chat.js`
Expected: `all passed`.

- [ ] **Step 9: Commit**

```bash
git add assets/js/chat.js 404.html ai-chatbot.html automation.html dashboards.html faq.html how-we-work.html index.html privacy.html websites.html
git commit -m "$(cat <<'EOF'
Let the homepage hero lead while it is on screen

With the console in view, the header and menu "Talk to our AI agent"
focus the hero input instead of opening the panel, the nudge waits, and
a reply read in the hero does not light the unread dot.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Visual pass, notes, full verification

**Files:**
- Modify: `PROJECT_NOTES.md:11`, `PROJECT_NOTES.md:39`
- Create (not committed): `tmp/hero-*.png`

- [ ] **Step 1: Screenshot desktop and phone mid-answer**

Create `tools/checks/hero-shots.js`:

```js
// Hero console screenshots for a visual check, into tmp/. Preview server must be up.
const { chromium } = require('playwright');
const CORS = { 'Access-Control-Allow-Origin': 'http://localhost:8090', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const sse = (evs) => evs.map(([e, d]) => 'event: ' + e + '\ndata: ' + JSON.stringify(d) + '\n\n').join('');
const REPLY = sse([
  ['text', { delta: 'That is the first thing we would **automate**. Orders from WhatsApp or your site go straight into Tally, and the invoice goes back to the customer on its own.' }],
  ['card', { kind: 'page', page: 'automation', href: '/automation.html', reason: 'Orders, invoices and follow-ups without re-typing' }],
  ['done', { append: [], sig: 'a'.repeat(64) }]
]);
(async () => {
  const br = await chromium.launch();
  for (const [name, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['tablet', { width: 820, height: 1180 }, true], ['phone', { width: 390, height: 844 }, true]]) {
    const ctx = await br.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.route('http://localhost:8787/chat', (r) => r.request().method() === 'OPTIONS'
      ? r.fulfill({ status: 204, headers: CORS })
      : r.fulfill({ status: 200, headers: Object.assign({ 'Content-Type': 'text/event-stream' }, CORS), body: REPLY }));
    await p.goto('http://localhost:8090/index.html', { waitUntil: 'load' });
    await p.waitForSelector('#heroConsole:not([hidden])');
    await p.waitForTimeout(1500);
    await p.screenshot({ path: 'tmp/hero-' + name + '-idle.png' });
    await p.click('.hc-chip >> nth=0');
    await p.waitForSelector('.hc-answer .dc-card');
    await p.waitForTimeout(400);
    await p.screenshot({ path: 'tmp/hero-' + name + '-answer.png' });
    await ctx.close();
  }
  await br.close();
  console.log('tmp/hero-{desktop,tablet,phone}-{idle,answer}.png');
})();
```

Run: `node tools/checks/hero-shots.js`
Expected: prints the file list; six PNGs in `tmp/`.

- [ ] **Step 2: Review the screenshots against the spec**

Open each PNG. Check, and fix in `site.css` (then re-run Step 1) if not true:
- Desktop: copy left, console right; console top and the h1 top roughly level; no clipped text in the answer; the card's left rule is saffron; status dot top-left reads "Listening".
- Tablet (820): one column, console first, full width, no horizontal scroll.
- Phone: console directly under the nav; field 240px; chips in one row with the 2nd chip cut off at the edge; input row 52px buttons, placeholder "Ask about your business".
- No rounded corners anywhere.

- [ ] **Step 3: Update PROJECT_NOTES.md**

In `PROJECT_NOTES.md` line 11, find `hero (three rows in the slogan’s order)` and replace with `hero (copy beside the agent console; console first on one column)`.

Line 39 starts with `- Hero (rebuilt 2026-09-17):`. Replace that whole line with:

```markdown
- Hero (agent console, 2026-10-01; spec `docs/superpowers/specs/2026-10-01-hero-agent-console-design.md`): headline, one sentence, one button + one link on the left; on the right `#heroConsole` (`.hc`), the site chatbot in the hero, shipped `hidden` and shown by `assets/js/hero.js` (homepage only) once `chat.js` fires `dayamchat:ready`. A navy panel, 600px tall on desktop so the copy never moves: the **signal field** (canvas: a 20px grid of squares; idle breath, a sweep while the agent reads, a ring per streamed piece of reply or per spoken word, the colour of the service of the agent's page card), the latest exchange only (question, reply, cards, "See full conversation" from turn two), four starter questions (one per service, gone after the first question), input, voice toggle, send. One conversation with the panel: `chat.js` broadcasts `turn/delta/card/done/error` through `DayamChat.on`, and while a quarter of the console is on screen the header/menu agent button focuses the hero input, the nudge waits and replies do not light the unread dot. **Voice**: browser `speechSynthesis` only (owner compared OpenAI TTS and chose free), off on arrival, kept in sessionStorage `dayamVoice`, one utterance per sentence; Google UK English Female → Google US English → any "Natural" → any `en`; Google हिन्दी → any `hi`; any `ar`; no voice = text only. Under `max-width:1000px` the console comes first (owner: "the Jarvis interface should come on top"); field 240px under 600px, chips scroll sideways. Reduced motion: one still frame; off screen: the loop pauses (`data-field` running/still). The `.hero-system` index, its CSS and `hsWalk` were deleted. Check suite: `tools/checks/hero.js`. h1 is `clamp(34px,3.75vw,54px)` (stacked: sized to the column) so the longest authored line ("Your business shouldn’t", 11.04em) never wraps.
```

- [ ] **Step 4: Run every suite**

Run: `node tools/checks/hero.js && node tools/checks/chat.js && node tools/checks/site.js`
Expected: each ends `all passed` (or the suite's own success line). Paste the tail of each output into your report.

- [ ] **Step 5: Manual voice check in a real browser (cannot be automated)**

With the server up, open `http://localhost:8090/index.html` in **Chrome**. Switch the speaker on, click "We re-type every order into Tally" (against the live Worker you need `cd chat-worker && npx wrangler dev` running on :8787 with `.dev.vars` set; otherwise the error path shows). Confirm: the reply is read in Google UK English Female, sentence by sentence, the rings follow the voice, and asking again stops the old speech. Report what you heard.

- [ ] **Step 6: Commit**

```bash
git add PROJECT_NOTES.md
git commit -m "$(cat <<'EOF'
Note the hero agent console in the project notes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Do not push**

Leave `main` ahead of `origin/main`. The owner decides when to push (pushing publishes the site on GitHub Pages).
