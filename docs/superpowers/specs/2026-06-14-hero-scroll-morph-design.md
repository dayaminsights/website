# Hero scroll-morph: centered hero → live 2-col hero

## Context

Current live hero (`index.html` `#top`) is a 2-col `.hero-grid` (`.hero-copy` left + `.hero-visual` 5-card grid right). User felt it "looks like a sub-header" — diagnosed as a scale/impact gap.

Three full-mockup directions were built (`mockups/hero-a-centered.html`, `hero-b-dominant.html`, `hero-c-atmospheric.html`). User picked **Mockup A** (full-bleed centered, massive headline, centered CTA/stats, 5-card strip below).

Rather than replace the live hero outright, user wants the page to **open looking like Mockup A**, then **morph into the current live 2-col hero** as the user scrolls down a bit.

## Goal

On page load: hero renders as Mockup A (centered, huge headline, centered CTA + stats, 5 service cards as a horizontal element below/around the headline).

On scroll (first ~100vh of scroll past the hero): hero continuously reshapes — headline shrinks and moves left, copy column narrows to its current live width, 5-card grid transitions into its current live 2-col position on the right, stats row moves from centered to left-aligned — ending in the exact current live `.hero-grid` layout. After the morph completes, the hero unpins and the page scrolls normally into `#problem`.

## Approach: rAF + lerped inline styles, single markup, sticky pin

### 1. Structure & sticky pin

- Wrap the existing hero `<section id="top">` in a new outer wrapper, e.g. `<div class="hero-morph-stage">`, with `height: 200vh` (100vh = initial hero view, 100vh = morph scroll range).
- `#top` (the hero section itself) becomes `position: sticky; top: 0; height: 100vh` (or current nav-offset height) inside that wrapper.
- While the wrapper's 200vh scrolls underneath, the sticky hero stays pinned in the viewport. Once the wrapper is exhausted, `#problem` (next section) pushes the hero out of view naturally — no manual unpin logic needed.
- Single set of markup serves both visual states — only inline styles (computed by JS) differ.

### 2. Markup changes to `#top`

Merge content from both the current live hero and `mockups/hero-a-centered.html`:

- `.hero-copy` (existing): eyebrow, two-line `h1` (`.grad` span), sub paragraph, CTA buttons (`.hero-cta`), stats row (`.hero-meta`, 3 counters) — **content unchanged**, only its computed styles morph.
- `.hero-visual` / `#heroVisual` (existing 5-card grid): **content unchanged** — same 5 `.service-card`s. Only its computed styles (opacity, scale, grid column width) morph.
- `.hero-grid` (existing 2-col container): `grid-template-columns` becomes a JS-driven inline style instead of fixed CSS, so it can morph from `"1fr"` (state A — visual column collapsed) to `"1fr 1.15fr"` (state B — live).

No new DOM elements needed beyond the `.hero-morph-stage` wrapper div.

### 3. State definitions (JS)

Two plain objects define the start (`STATE_A`, Mockup-A look) and end (`STATE_B`, current live look) inline-style values for each tracked element:

| Element | Property | STATE_A (load) | STATE_B (post-morph) |
|---|---|---|---|
| `.hero-grid` | `gridTemplateColumns` | `"1fr"` | `"1fr 1.15fr"` (snap at progress > 0.5) |
| `.hero-copy h1` | `fontSize` | Mockup-A clamp output (~108px @ wide) | current live clamp output |
| `.hero-copy h1`, `.sub`, `.hero-cta`, `.hero-meta` | `textAlign` / `justifyContent` | `center` | `flex-start` / `left` (snap at progress > 0.5) |
| `.hero-copy` | `maxWidth` + `margin` | `1100px` / `0 auto` (centered) | `none` / `0` (snap at progress > 0.5) |
| `.hero-visual` | `opacity` | `0` | `1` (lerp) |
| `.hero-visual` | `transform: scale()` | `0.9` | `1` (lerp) |
| `.hero-visual` | `pointerEvents` | `none` | `auto` (snap at progress > 0.5) |

Numeric properties (`fontSize`, `opacity`, `scale`, `maxWidth`) lerp continuously with `progress` (0→1). Non-numeric / discrete properties (`textAlign`, `justifyContent`, `gridTemplateColumns`, `pointerEvents`, `margin` shorthand) snap at the `progress > 0.5` midpoint, chosen so the discrete jump lands when other properties are already ~50% morphed — minimizes visible discontinuity.

Exact pixel/value numbers are taken directly from the existing live CSS (`index.html` hero rules) for STATE_B, and from `mockups/hero-a-centered.html`'s `.heroA` rules for STATE_A, at implementation time.

### 4. Scroll handler

Extends the existing rAF-batched scroll handler (same one driving `.glow-orb` parallax in `index.html`'s `<script>` block):

```
progress = clamp((scrollY - heroStageTop) / window.innerHeight, 0, 1)
```

Each rAF tick, for every tracked element: `lerp(STATE_A[prop], STATE_B[prop], progress)` for numeric props, threshold-snap for discrete props, applied via `el.style[prop] = value`.

- Computed once per rAF frame (not per scroll event) — matches existing pattern.
- Recompute `heroStageTop` and `window.innerHeight` on resize (existing resize-aware pattern should be checked/extended).

### 5. Reduced motion & mobile

- `prefers-reduced-motion: reduce`: skip the morph entirely — `.hero-morph-stage` height collapses to `100vh` (no extra scroll range, no sticky pin needed beyond normal flow), hero renders directly in STATE_B (current live layout) via a CSS class toggle, matching the existing global reduced-motion convention.
- `max-width: 1000px` (existing mobile breakpoint): same — disable sticky/morph, render directly in the current mobile hero layout (`.hero-grid` already collapses to 1-col on mobile today). Scroll-jacking on small screens is undesirable.
- Both cases: scroll handler early-returns / never attaches; `.hero-morph-stage` gets a `height: auto` (or `100%`) override and `#top` loses `position: sticky` via a media query / class, so layout falls back to normal flow.

### 6. Existing reveal/counter animations

- `.reveal` entrance animations (`data-d="1..4"`) and `animateCount()` stat counters fire on load as today via IntersectionObserver — hero is in view immediately, unaffected by morph.
- Morph's inline styles apply on top of `.reveal.in`'s final CSS state (`opacity:1; transform:none`), which is also STATE_A's resting point — no conflict, inline styles simply override position/size/layout properties the morph controls, while reveal controls its own opacity/translateY which settle before morph-relevant scrolling begins.

## Out of scope

- No changes to `mockups/*.html` files (reference only).
- No changes to `#problem` or any section below the hero.
- No new service-card content, copy changes, or new icons — purely layout/visual state interpolation of existing hero content.

## Testing / verification

- Manual: open `index.html`, confirm hero loads in Mockup-A layout, scroll ~1 viewport and confirm smooth morph into current live 2-col layout, confirm `#problem` appears immediately after morph completes (no dead scroll space).
- Manual: toggle OS reduced-motion, confirm hero renders directly in live layout with no sticky/scroll-jack behavior.
- Manual: resize to mobile width (<1000px), confirm hero renders in current mobile layout with no sticky/scroll-jack behavior.
- Manual: verify `.reveal` stagger animations and stat counters still play correctly on load.
