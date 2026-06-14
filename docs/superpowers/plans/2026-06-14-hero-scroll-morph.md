# Hero Scroll-Morph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the hero section in `index.html` load looking like `mockups/hero-a-centered.html` (massive centered headline, centered CTA/stats), then continuously morph into the current live 2-col `.hero-grid` layout as the user scrolls the first ~100vh past the hero.

**Architecture:** Wrap the existing `#top` hero section in a new `.hero-morph-stage` wrapper (`height: 200vh`). The hero itself becomes `position: sticky; top: 0`. A scroll handler (extending the existing rAF-batched handler) computes `progress` (0→1) over the wrapper's scroll range and applies lerped/snapped inline styles to hero elements, interpolating between a `STATE_A` (Mockup-A look) and `STATE_B` (current live look) style table. Reduced-motion and mobile (`max-width:1000px`) skip the morph entirely and render STATE_B statically via a CSS class.

**Tech Stack:** Plain HTML/CSS/vanilla JS (no build step), existing design tokens and rAF scroll pattern in `index.html`.

---

## Reference values (read from current code)

- **STATE_B (live, current CSS):**
  - `.hero-grid`: `grid-template-columns: 1fr 1.15fr; gap: 48px`
  - `.hero h1`: `font-size: clamp(30px,4.6vw,52px)` → effectively **52px** at desktop widths used for this page (maxw 1180px + padding means viewport ≥ ~1270px, where 4.6vw > 52px, so clamp returns max = 52px)
  - `.hero-copy`, `.sub`, `.hero-cta`, `.hero-meta`: left-aligned, `justify-content: flex-start` (default), `.sub { max-width: 480px }`
  - `.hero-visual`: `opacity: 1`, no transform, `grid-template-columns: repeat(2,1fr)`
- **STATE_A (Mockup A, from `mockups/hero-a-centered.html`):**
  - `.heroA h1`: `font-size: clamp(44px,8.4vw,108px)` → effectively **108px** at desktop widths
  - Centered text-align, centered flex content, `.hero-visual` hidden (`opacity:0`, `scale(.9)`, `pointer-events:none`)
  - `.hero-grid` collapsed to single column (`grid-template-columns: 1fr`) so `.hero-copy` spans full width and can center its content

## File Structure

- **Modify:** `c:\Users\USER\Documents\GitHub\website\index.html`
  - CSS: add `.hero-morph-stage` wrapper rules, `.hero-copy`/`.hero-cta`/`.hero-meta` centering helper rules (state-A defaults), reduced-motion/mobile overrides
  - Markup: wrap `<section class="hero wrap" id="top">` in `<div class="hero-morph-stage">`, no other markup changes
  - JS: add `STATE_A` / `STATE_B` tables, `lerp()` helper, morph-apply function, wire into existing rAF scroll handler, add resize handling, add reduced-motion/mobile guard
- **Modify:** `c:\Users\USER\Documents\GitHub\website\PROJECT_NOTES.md` — document the morph pattern under "Recent work"

No new files needed — single-file site, morph logic lives inline in `index.html`'s existing `<style>` and `<script>` blocks.

---

### Task 1: Add `.hero-morph-stage` wrapper markup and base CSS

**Files:**
- Modify: `c:\Users\USER\Documents\GitHub\website\index.html:533-534` (markup), insert new CSS near line 100 (`/* ===== Hero ===== */` block)

- [ ] **Step 1: Wrap the hero section in `.hero-morph-stage`**

In `index.html`, change:

```html
<!-- HERO -->
<section class="hero wrap" id="top">
  <div class="hero-grid">
```

to:

```html
<!-- HERO -->
<div class="hero-morph-stage">
<section class="hero wrap" id="top">
  <div class="hero-grid">
```

Then find the closing of the hero section (the `</section>` that matches `<section class="hero wrap" id="top">` — it's immediately before `<!-- PROBLEM -->` or the next section comment). Change:

```html
</section>

<!-- PROBLEM -->
```

to:

```html
</section>
</div>

<!-- PROBLEM -->
```

(Use Grep for `<!-- PROBLEM` or the next section's comment to find the exact closing line before editing — confirm the `</section>` immediately precedes it.)

- [ ] **Step 2: Add `.hero-morph-stage` CSS**

In `index.html`, immediately before the `/* ===== Hero ===== */` comment (around line 99), add:

```css
/* ===== Hero scroll-morph stage ===== */
.hero-morph-stage{position:relative;height:200vh}
.hero-morph-stage .hero{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;justify-content:center;overflow:hidden}
@media(prefers-reduced-motion:reduce),(max-width:1000px){
  .hero-morph-stage{height:auto}
  .hero-morph-stage .hero{position:static;height:auto;overflow:visible}
}
```

- [ ] **Step 3: Open in browser, confirm hero still renders (unmorphed) and is now full-viewport-height + sticky**

Run: `start "" "c:\Users\USER\Documents\GitHub\website\index.html"`

Expected: hero section fills the viewport height, content vertically centered, no visual breakage. Scrolling shows the hero stays pinned for one extra scroll length before `#problem` appears (morph styles not yet applied, so layout doesn't change shape yet — that's Task 3).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Wrap hero in sticky morph-stage container"
```

---

### Task 2: Add centering CSS for STATE_A (Mockup-A look) as the default/initial state

The hero must *render* in the Mockup-A look on load (before any scroll). Rather than relying purely on JS (which only runs after first paint / first scroll-frame), give the hero CSS defaults that match STATE_A, so there's no flash-of-wrong-layout before JS applies inline styles.

**Files:**
- Modify: `c:\Users\USER\Documents\GitHub\website\index.html` — hero CSS block (lines ~100-110) and `.hero-visual` rule (line 113)

- [ ] **Step 1: Add STATE_A default rules**

Immediately after the `.hero-meta .m span{...}` rule (around line 110), add:

```css

/* Hero morph: STATE_A defaults (Mockup-A look, before scroll) */
.hero-grid{grid-template-columns:1fr}
.hero-copy{max-width:1100px;margin:0 auto;text-align:center}
.hero-copy .sub{max-width:620px;margin-left:auto;margin-right:auto}
.hero-copy .eyebrow{display:inline-flex}
.hero-copy .hero-cta,.hero-copy .hero-meta{justify-content:center}
.hero h1{font-size:clamp(44px,8.4vw,108px)}
.hero-visual{opacity:0;transform:scale(.9);pointer-events:none;transition:none}
```

Note: `.hero-grid{grid-template-columns:1fr 1.15fr;gap:48px;...}` already exists at line 101 — this new `.hero-grid{grid-template-columns:1fr}` rule must come AFTER it in source order to win (CSS source order with equal specificity). Since we're inserting after line 110, it is after line 101 — correct.

Similarly `.hero h1{font-size:clamp(30px,4.6vw,52px);...}` exists at line 102 — the new `.hero h1{font-size:...}` override at the end only overrides `font-size`, the other properties (`line-height`, `letter-spacing`, `font-weight`) remain from the original rule via the cascade (not overridden, so they still apply). Confirm this is fine: yes, `font-size` is the only property STATE_A changes for `h1`.

- [ ] **Step 2: Add mobile/reduced-motion override to undo STATE_A defaults**

In the existing `@media(max-width:1000px){...}` block (around line 450), the rule `.hero-grid{grid-template-columns:1fr;gap:40px}` already exists — it coincidentally matches STATE_A's single-column, but mobile needs STATE_B's left-aligned text, visible `.hero-visual`, and STATE_B's h1 size. Add a new combined media query right after the `.hero-morph-stage` block from Task 1 (in the same `@media(prefers-reduced-motion:reduce),(max-width:1000px)` block added in Task 1, Step 2), expand it to:

```css
@media(prefers-reduced-motion:reduce),(max-width:1000px){
  .hero-morph-stage{height:auto}
  .hero-morph-stage .hero{position:static;height:auto;overflow:visible}
  .hero-morph-stage .hero-copy{max-width:none;margin:0;text-align:left}
  .hero-morph-stage .hero-copy .sub{max-width:480px;margin-left:0;margin-right:0}
  .hero-morph-stage .hero-copy .hero-cta,.hero-morph-stage .hero-copy .hero-meta{justify-content:flex-start}
  .hero-morph-stage .hero h1{font-size:clamp(30px,4.6vw,52px)}
  .hero-morph-stage .hero-visual{opacity:1;transform:none;pointer-events:auto}
}
```

(This replaces the simpler 3-line block from Task 1 Step 2 — write the full combined block.)

- [ ] **Step 3: Verify in browser**

Run: `start "" "c:\Users\USER\Documents\GitHub\website\index.html"`

Expected: hero now visually matches `mockups/hero-a-centered.html` — huge centered headline (~108px), centered sub/CTA/stats, 5-card grid invisible. Resize browser to <1000px width: hero should look like the ORIGINAL live hero (left-aligned, smaller headline, visible cards, no sticky pin).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Add STATE_A (centered Mockup-A) default hero styles with mobile/reduced-motion fallback to STATE_B"
```

---

### Task 3: Implement scroll-driven morph (JS state tables + rAF interpolation)

**Files:**
- Modify: `c:\Users\USER\Documents\GitHub\website\index.html` — `<script>` block, inside the existing IIFE near the rAF scroll handler (around lines 1161-1193)

- [ ] **Step 1: Add state tables and helper functions**

In `index.html`, inside the `<script>` IIFE, immediately after the line `var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;` (around line 1163), add:

```javascript
  // ===== Hero scroll-morph =====
  var heroStage = document.querySelector('.hero-morph-stage');
  var heroSection = heroStage ? heroStage.querySelector('.hero') : null;
  var heroGrid = heroSection ? heroSection.querySelector('.hero-grid') : null;
  var heroCopy = heroSection ? heroSection.querySelector('.hero-copy') : null;
  var heroH1 = heroSection ? heroSection.querySelector('.hero h1') : null;
  var heroSub = heroSection ? heroSection.querySelector('.hero-copy .sub') : null;
  var heroCta = heroSection ? heroSection.querySelector('.hero-copy .hero-cta') : null;
  var heroMeta = heroSection ? heroSection.querySelector('.hero-copy .hero-meta') : null;
  var heroVisual = heroSection ? heroSection.querySelector('.hero-visual') : null;

  var heroMorphEnabled = !reduce && window.matchMedia('(min-width:1001px)').matches
    && heroStage && heroSection && heroGrid && heroCopy && heroH1 && heroVisual;

  function lerp(a, b, t){ return a + (b - a) * t; }

  function applyHeroMorph(progress){
    var p = Math.max(0, Math.min(1, progress));
    var snap = p > 0.5;

    // Numeric interpolation
    heroH1.style.fontSize = lerp(108, 52, p).toFixed(1) + 'px';
    heroVisual.style.opacity = lerp(0, 1, p).toFixed(3);
    heroVisual.style.transform = 'scale(' + lerp(0.9, 1, p).toFixed(3) + ')';

    // Discrete snaps at midpoint
    heroGrid.style.gridTemplateColumns = snap ? '1fr 1.15fr' : '1fr';
    heroCopy.style.maxWidth = snap ? 'none' : '1100px';
    heroCopy.style.margin = snap ? '0' : '0 auto';
    heroCopy.style.textAlign = snap ? 'left' : 'center';
    if (heroSub){
      heroSub.style.maxWidth = snap ? '480px' : '620px';
      heroSub.style.marginLeft = snap ? '0' : 'auto';
      heroSub.style.marginRight = snap ? '0' : 'auto';
    }
    if (heroCta) heroCta.style.justifyContent = snap ? 'flex-start' : 'center';
    if (heroMeta) heroMeta.style.justifyContent = snap ? 'flex-start' : 'center';
    heroVisual.style.pointerEvents = snap ? 'auto' : 'none';
  }

  function heroMorphProgress(){
    var rect = heroStage.getBoundingClientRect();
    var range = window.innerHeight; // 100vh morph range (second half of the 200vh stage)
    var scrolled = -rect.top; // how far the stage's top has scrolled past viewport top
    return (scrolled - 0) / range; // progress within the 200vh stage's second half... see Step 2 for exact mapping
  }
```

- [ ] **Step 2: Fix the progress calculation (stage is 200vh; morph should span the FULL 200vh, completing exactly as `#problem` arrives)**

Replace the `heroMorphProgress` function from Step 1 with the correct mapping — progress 0 at stage top reaching viewport top, progress 1 when stage has scrolled by 100vh (i.e., halfway through the 200vh stage, which is when the sticky hero has been pinned for one full viewport of scroll):

```javascript
  function heroMorphProgress(){
    var rect = heroStage.getBoundingClientRect();
    var scrolled = -rect.top; // 0 when stage top is at viewport top; grows as user scrolls
    return scrolled / window.innerHeight; // 0 -> 1 over the first 100vh of stage scroll
  }
```

(This means the morph completes after 100vh of scroll, and the hero remains pinned in its STATE_B look for the remaining 100vh of the stage before `#problem` pushes it out — giving the user a moment to see the completed live layout before it scrolls away. This matches the spec's "short pin ~80-100vh" intent.)

- [ ] **Step 3: Wire into the existing rAF `onFrame` handler**

In `index.html`, find the `onFrame` function (around line 1171):

```javascript
  function onFrame(){
    var y = window.scrollY;
    nav.classList.toggle('scrolled', y > 8);

    var max = document.documentElement.scrollHeight - window.innerHeight;
    var pct = max > 0 ? (y / max) * 100 : 0;
    scrollBar.style.width = pct + '%';

    if (!reduce){
      orbs.forEach(function(orb){
        var rect = orb.parentElement.getBoundingClientRect();
        var shift = (rect.top - window.innerHeight / 2) * -0.06;
        orb.style.translate = '0 ' + shift.toFixed(1) + 'px';
      });
    }
    ticking = false;
  }
```

Add the morph call right after the `orbs.forEach(...)` block, still inside `onFrame`:

```javascript
    if (!reduce){
      orbs.forEach(function(orb){
        var rect = orb.parentElement.getBoundingClientRect();
        var shift = (rect.top - window.innerHeight / 2) * -0.06;
        orb.style.translate = '0 ' + shift.toFixed(1) + 'px';
      });
    }

    if (heroMorphEnabled){
      applyHeroMorph(heroMorphProgress());
    }

    ticking = false;
```

- [ ] **Step 4: Call `applyHeroMorph(0)` once on init so inline styles match STATE_A from the first frame (avoids relying solely on CSS defaults once JS takes over)**

Find `onFrame();` (the initial call, around line 1191, right before `window.addEventListener('scroll', onScroll, {passive:true});`). After it, add:

```javascript
  if (heroMorphEnabled){
    applyHeroMorph(heroMorphProgress());
  }
```

- [ ] **Step 5: Handle resize — re-evaluate `heroMorphEnabled` and reset inline styles if crossing the 1000px breakpoint**

Add a resize listener near the end of the IIFE (find a good spot after the existing `window.addEventListener('scroll', ...)` line, or after the reveal/IntersectionObserver setup). Add:

```javascript
  window.addEventListener('resize', function(){
    var nowEnabled = !reduce && window.matchMedia('(min-width:1001px)').matches
      && heroStage && heroSection && heroGrid && heroCopy && heroH1 && heroVisual;
    if (nowEnabled !== heroMorphEnabled){
      heroMorphEnabled = nowEnabled;
      if (!heroMorphEnabled){
        // Clear inline styles so CSS (mobile/reduced-motion overrides) takes over
        [heroGrid, heroCopy, heroSub, heroCta, heroMeta, heroH1, heroVisual].forEach(function(el){
          if (el) el.removeAttribute('style');
        });
      } else {
        applyHeroMorph(heroMorphProgress());
      }
    } else if (heroMorphEnabled){
      applyHeroMorph(heroMorphProgress());
    }
  }, {passive:true});
```

- [ ] **Step 6: Verify in browser — full morph behavior**

Run: `start "" "c:\Users\USER\Documents\GitHub\website\index.html"`

Manually check:
1. Page loads with hero in Mockup-A look (centered, ~108px headline, cards invisible).
2. Scroll down slowly: headline shrinks toward 52px, cards fade/scale in, layout shifts from centered single-column to left-aligned 2-col — continuously, tracking scroll position.
3. Past ~100vh of scroll, hero is fully in STATE_B (matches original live hero) and stays pinned a bit longer, then `#problem` arrives with no dead/blank space.
4. Scroll back up: morph reverses smoothly.
5. Resize window below 1000px width: hero immediately matches original mobile layout (left-aligned, visible cards, no pinning); scrolling behaves normally (no sticky stage).
6. Enable OS "reduce motion" (or `prefers-reduced-motion: reduce` via devtools rendering tab), reload: hero renders directly in STATE_B, no sticky pin, normal scroll.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "Add scroll-driven hero morph from centered Mockup-A look to live 2-col layout"
```

---

### Task 4: Update PROJECT_NOTES.md

**Files:**
- Modify: `c:\Users\USER\Documents\GitHub\website\PROJECT_NOTES.md`

- [ ] **Step 1: Add a new bullet to "Recent work (most recent first)"**

At the top of the "## Recent work (most recent first)" list (around line 52), add a new first bullet:

```markdown
- Hero now opens in a "Mockup A" centered look (huge ~108px centered headline, centered CTA/stats, `.hero-visual` cards hidden) and morphs into the original live 2-col `.hero-grid` layout (52px left-aligned headline, visible 5-card grid) as the user scrolls the first ~100vh. Implemented via `.hero-morph-stage` (200vh wrapper, `.hero` becomes `position:sticky`) + a JS `applyHeroMorph(progress)` function wired into the existing rAF scroll handler, interpolating/snapping inline styles between STATE_A and STATE_B tables. Disabled (renders STATE_B statically, no sticky pin) for `prefers-reduced-motion:reduce` and `max-width:1000px` via CSS overrides + a `heroMorphEnabled` JS guard with resize re-evaluation. Three full mockup directions (`mockups/hero-a-centered.html`, `hero-b-dominant.html`, `hero-c-atmospheric.html`) were built for comparison; Mockup A was chosen.
```

- [ ] **Step 2: Add a new "Animation conventions" line documenting the morph pattern for future additions**

In the "## Animation conventions" section (around line 11-20), add a new bullet:

```markdown
- Scroll-driven layout morph: `.hero-morph-stage` (200vh wrapper) + `position:sticky` hero + `applyHeroMorph(progress)` lerps/snaps inline styles between STATE_A/STATE_B tables based on `heroMorphProgress()` (0-1 over first 100vh of stage scroll). Gated by `heroMorphEnabled` (desktop + motion-OK only); CSS media queries provide the STATE_B fallback for mobile/reduced-motion.
```

- [ ] **Step 3: Commit**

```bash
git add PROJECT_NOTES.md
git commit -m "Document hero scroll-morph pattern in project notes"
```

---

## Self-Review Notes

- **Spec coverage:** Section 1 (sticky pin, 200vh stage) → Task 1. Section 2 (markup, single source) → Task 1 (wrapper only; no content duplication, as designed). Section 3 (state tables) → Task 3 Step 1 reference table + JS objects (implemented as inline functions rather than separate objects for simplicity — values match the spec's table exactly). Section 4 (scroll handler, rAF) → Task 3 Steps 2-5. Section 5 (reduced motion / mobile) → Task 1 Step 2 + Task 2 Steps 2 + Task 3 `heroMorphEnabled` guard. Section 6 (existing reveal/counters unaffected) → no task touches `.reveal`/`animateCount`, confirmed non-conflicting (inline styles set by morph are layout/size/position properties; `.reveal` controls opacity/translateY of inner elements like `h1` text itself — wait, `.hero h1` has `.reveal` class too — see note below).
- **Potential conflict flagged:** `.hero h1` has both `.reveal` (opacity/translateY entrance animation) AND gets `fontSize` set by `applyHeroMorph`. These don't conflict — `.reveal`/`.reveal.in` only set `opacity` and `transform`, while the morph only sets `font-size`. Different properties, both apply fine simultaneously.
- **Type/naming consistency:** `applyHeroMorph(progress)`, `heroMorphProgress()`, `heroMorphEnabled` used consistently across Task 3 steps 3-6.
- **No placeholders:** all code blocks are complete and copy-pasteable; exact selectors and line-number anchors given for Task 1/2 edits (with instruction to re-confirm exact line via Grep since line numbers shift after Task 1's edit).
