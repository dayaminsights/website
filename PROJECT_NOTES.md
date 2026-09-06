# Dayam Insights — Landing Page Notes

Single self-contained `index.html` (no build step, GitHub Pages ready). Inline `<style>` + inline vanilla JS. Targets Tier-2 India audience — plain language, no jargon.

## Design system (CSS vars in `:root`)
Light editorial palette (visual-system-migration), not the old dark one:
- Ground: `--bg:#FAF9F7`-family with `--surface:#FFFFFF`, `--surface-sunken:#F2F2EF`, `--placeholder:#DCDBD5`; inverted panels `--panel:#111315`, `--panel-2:#1B1E21`
- Lines: `--line:#E4E4E0`, `--line-strong:#C9C9C3`, `--line-invert:rgba(247,247,245,.14)`
- Ink: `--ink:#111315`, `--ink-2:#3A3E44`, `--muted:#555B63`, `--muted-2:#676D75`; on panels `--on-panel:#F7F7F5`, `--on-panel-muted:#9BA0A6`
- Accent is rust: `--accent:#A94F26` (+ `--accent-hover`, `--accent-soft`, `--accent-line`, `--accent-on-panel:#D7855C`); semantic `--good:#1F6B4A`, `--warn:#8A5A0B` with `-invert` variants for panels
- Fonts: Instrument Sans (`--font-ui`), Source Serif 4 (`--font-body`, the default), IBM Plex Mono (`--font-mono` / `.mono`)
- Scale: `--fs-h1`…`--fs-label` clamps, `--sp-1`…`--sp-10` spacing, `--r-sm/md/lg/pill` radii, `--maxw:1180px`, `--maxw-text:680px`, `--maxw-narrow:520px`

## Animation conventions
- `.reveal` + `.in` (toggled by IntersectionObserver) for scroll-triggered fade/slide-up. `data-d="1..4"` = stagger delay via `transition-delay`.
- Reveal variants for scroll rhythm: `.reveal-scale` (fade + slight scale-up, used on `#process` section heads), `.reveal-left`/`.reveal-right` (slide in from side, used on `.web-grid web-block` rows — direction matches whether copy or visual is on that side). Collapse to translateY on mobile (`@media max-width:1000px`).
- `prefers-reduced-motion: reduce` disables all animation globally — always add exceptions when adding new keyframes (incl. `.glow-orb{translate:none!important}`).
- Animated counters: `data-count`, `data-prefix`, `data-suffix`, `data-dec` attributes + `animateCount()` JS (rAF, cubic ease-out, 1400ms).
- "Build-up" pattern (`.bm-block`/`.dk`/`.flow-node` etc.): base `opacity:0;transform:translateY(Npx)` → parent `.web-visual.in` reveals with per-child `transition-delay`.
- **Looping pipelines**: `pulse(root, selector, stepMs, holdMs, restMs)` walks a `.lit` class along a diagram's children and loops, but only while that diagram is on screen (its own IntersectionObserver starts and stops it, and `mouseenter` replays a pass). Used by `.hero-pipe` (`.pipe-step`) and `.flow-mock` (`.flow-node,.fl-arrow` — nodes and connectors share the walk so the pulse travels the arrows too). Returns a no-op under `prefers-reduced-motion`.
- **Reading-order stagger**: `.points li`, `.uc`, `.res-lines > div` and `.tech-item` start at `opacity:0` and are revealed by `.in` on their reveal parent with 180–480ms `nth-child` delays, so a heading lands before its supporting rows.
- Ladder rungs stagger via an inline `--i` custom property (`transition-delay:calc(var(--i) * 55ms)`) rather than `data-d`, because there are six of them plus the handoff row and `data-d` only defines 1–4. Tool chips stagger on `.rung.open` with `nth-of-type` delays.
- `.proc-line` carries `.reveal` but overrides it to draw with `scaleX(0) → scaleX(1)`; `.proc-line.reveal` beats `.reveal` on specificity.
- SVG icons: `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`.
- JS reveal selector includes `.reveal, .reveal-scale, .reveal-left, .reveal-right, .hero-visual, .web-visual` — any new animated visual block should get one of these classes to be observed.
- Scroll progress bar: `#scrollBar` (inside `.scroll-progress`, fixed top of page) — width set as % of scroll in the rAF-batched scroll handler.
- Parallax: `.glow-orb` elements get a JS-driven `translate` (standalone CSS property, coexists with the `float` keyframe `transform` animation) based on their container's position in viewport — subtle, gated by `prefers-reduced-motion`.
- Scroll-driven layout morph: `.hero-morph-stage` (200vh wrapper) + `position:sticky` hero + `applyHeroMorph(progress)` lerps/snaps inline styles between STATE_A/STATE_B tables based on `heroMorphProgress()` (0-1 over first 100vh of stage scroll). Gated by `heroMorphEnabled` (desktop + motion-OK only); CSS media queries provide the STATE_B fallback for mobile/reduced-motion.

## Page structure (section order, top to bottom)
1. `#top` — Hero. Copy column (eyebrow → "Your business shouldn't need you to run every little thing." → what we build → CTA pair → audience line + sector row) beside `.hero-stage` (`.hero-pipe` 5-step pipeline: Order in → Automation → Stock & invoice → Dashboard → Decision, sitting over the `.lap` laptop). `.hero-services` is the three-pillar strip (See / Automate / Grow) linking to `#dashboards` / `#automation` / `#websites`
2. `#positioning` — `.stmt-band`: the one-sentence positioning statement + supporting line, hairline rules above and below
3. `#problem` (band) — four numbered pain cards: manual work, disconnected data, slow decisions, growth bottlenecks
4. `#ladder` — the handoff ladder. Rung 01 Create is tagged **Yours · done**, then a `.handoff` band, then rungs 02–06 (Innovate, Integrate, Automate, Accelerate, Elevate) tagged **Ours**, each opening to symptom / what we do / what changes / tools. Static HTML rungs + one delegated click handler
5. `#dashboards` (`.web-show`) — SEE. One block, `.dash-mock`
6. `#automation` (`.web-show`) — AUTOMATE. Two blocks: workflow automation (`.flow-mock`, five nodes: WhatsApp → Order → Invoice → Payment → Dashboard) and `#ai` (`.ai-mock` assistant panel: question → sources it reads → answer)
7. `#websites` (`.web-show band`) — GROW. One block: `.browser-mock` + `.search-mock` (a visitor journey, not a search-ranking claim)
8. mid-page CTA
9. `#work` — three example projects as Problem / Solution / Outcome (`.res-lines`), each tagged "Example project"
10. `#process` (band) — **"How an engagement runs"**: Discover → Prioritise → Build → Improve. Retitled so it and the ladder never both claim "how we work" — the ladder is the arc across years, this is what happens after you sign
11. `#about` — founder section, still sentinel-driven
12. `#faq` — 13 questions, mirrored in the FAQPage schema
13. `#cta` (band) — contact form + WhatsApp route
14. Footer

`#tech` was removed: its tool lists now live in the ladder rung that uses them, and its trust line survives as `.ladder-runs` (cloud accounts you own · backed up daily · you keep the logins).

The SEE/AUTOMATE/GROW pillar section was removed: its three `<h3>`s were the same sentences the three sections below use as their `<h2>`s. `.hero-services` is now the only pillar strip, and its cards name the capability ("Dashboards & analytics") while the sections below carry the promise. Nav "Solutions" points at `#dashboards`.

Nav is deliberately short: Solutions / Work / How it works / About / FAQ, plus "Find your bottleneck". It collapses to the menu button at 900px (not 760px) because brand + five links + two buttons measured 845px against a 768px viewport.

## Visual rhythm
- `.web-show` sections (`#growth`, `#intelligence`) get a full-bleed subtle panel background (`::before`, 100vw breakout) to visually separate the "showcase" sections from the plainer text sections. Adjacent `.web-show` sections share one continuous panel (no double border) via `.web-show + .web-show` / `:has()` selectors.

## Key shared classes for the "showcase" sections (#growth, #intelligence)
- `.web-show` — section wrapper, `padding-top:0`
- `.web-block` — one row (margin-bottom spacing between rows)
- `.web-grid` — 2-col grid (`1fr 1.1fr`), `.web-grid.rev` reverses order (visual left, copy right) via `order`
- `.web-copy` — left text column; `.title.sm` for h3 sub-headings, `.web-stats` for stat rows
- `.web-visual` — right animated visual column; gets `.in` class on scroll-into-view
- Responsive: `@media(max-width:1000px)` collapses `.web-grid` to 1 col (and resets `.rev` order); `@media(max-width:760px)` has further mobile tweaks (bm-cards, funnel, dash-kpis, flow-row)

## Recent work (most recent first)
- Hero now opens in a "Mockup A" centered look (huge ~108px centered headline, centered CTA/stats, `.hero-visual` cards hidden) and morphs into the original live 2-col `.hero-grid` layout (52px left-aligned headline, visible 5-card grid) as the user scrolls the first ~100vh. Implemented via `.hero-morph-stage` (200vh wrapper, `.hero` becomes `position:sticky`) + a JS `applyHeroMorph(progress)` function wired into the existing rAF scroll handler, interpolating/snapping inline styles between STATE_A and STATE_B tables. Disabled (renders STATE_B statically, no sticky pin) for `prefers-reduced-motion:reduce` and `max-width:1000px` via CSS overrides + a `heroMorphEnabled` JS guard with resize re-evaluation. Three full mockup directions (`mockups/hero-a-centered.html`, `hero-b-dominant.html`, `hero-c-atmospheric.html`) were built for comparison; Mockup A was chosen.
- Hero headline reworked into a two-line treatment (plain line + `.grad` gradient line "Start growing with AI."). Tried replacing the 5-card `.service-card` grid in `.hero-visual` with a vertical "growth loop" diagram — reverted per user feedback ("the previous one was better"); kept the original 5-card grid + `.service-card`/`.card-reveal`/`.s-*` classes and `cardFloat`/`riseDot` keyframes
- Fixed "What we do" tag misalignment across `#problem` cards via `.prob{display:flex;flex-direction:column;height:100%}` + `.prob .fix{margin-top:auto}` (pins fix block to bottom of equal-height grid cells)
- Reworked `#problem` cards: each now ends with a `.fix` block (green "What we do" tag + solution sentence + animated stat) pairing every pain point with the solution and a number (40%, 0, 100%, 24/7 — reused from hero/web-stats)
- Removed redundant `#solutions` section (4 outcome cards duplicated hero cards + showcases); added scroll progress bar, subtle parallax on `.glow-orb`s, and varied reveal animations (`.reveal-scale`, `.reveal-left/right`) plus full-bleed panel backgrounds on `.web-show` sections for a more premium scroll feel
- Added "ad creation, photos, product videos" messaging to AI Assistants hero card + "Scale with AI" solutions bullet
- Built `#growth` (Websites & Apps + Marketing) and `#intelligence` (Dashboards + Automation) sections at bottom of page, each with animated mockups; removed the old standalone `#websites` section (merged into `#growth`)
- Original Websites & Apps showcase (browser-mock + search-mock) was the first animated section built, using `/frontend-design` skill

## Conventions / preferences observed
- User wants plain, simple language (Tier-2 India audience) — avoid jargon in copy
- Reuse existing keyframes (`riseLine`, `riseDot`, `float`, `liveBlink`, `ping`, `cardFloat`) and gradient patterns rather than inventing new ones
- After any structural edit, verify tag balance: `<section>`, `<div>`, `<span>`, `<svg>`, `<a>` open/close counts + `{`/`}` brace balance via grep
- Preview changes by opening `index.html` directly in browser (`Start-Process` in PowerShell)
- No build step — just edit `index.html` directly
