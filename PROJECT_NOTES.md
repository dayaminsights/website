# Dayam Insights — Landing Page Notes

Single self-contained `index.html` (no build step, GitHub Pages ready). Inline `<style>` + inline vanilla JS. Targets Tier-2 India audience — plain language, no jargon.

## Design system (CSS vars in `:root`)
Light editorial palette (visual-system-migration), not the old dark one:
- Ground: `--bg:#FAF9F7`-family with `--surface:#FFFFFF`, `--surface-sunken:#F2F2EF`, `--placeholder:#DCDBD5`; inverted panels `--panel:#111315`, `--panel-2:#1B1E21`
- Lines: `--line:#E4E4E0`, `--line-strong:#C9C9C3`, `--line-invert:rgba(247,247,245,.14)`
- Ink: `--ink:#111315`, `--ink-2:#3A3E44`, `--muted:#555B63`, `--muted-2:#676D75`; on panels `--on-panel:#F7F7F5`, `--on-panel-muted:#9BA0A6`
- Accent is rust: `--accent:#A94F26` (+ `--accent-hover`, `--accent-soft`, `--accent-line`, `--accent-on-panel:#D7855C`); semantic `--good:#1F6B4A`, `--warn:#8A5A0B` with `-invert` variants for panels
- Fonts: Instrument Sans (`--font-ui`), Source Serif 4 (`--font-body`, the default), IBM Plex Mono (`--font-mono` / `.mono`)
- Scale: `--fs-h1`…`--fs-label` clamps, `--sp-1`…`--sp-10` spacing, `--r-sm/md/lg/pill` radii, `--maxw:1180px`, `--maxw-text:720px`, `--maxw-narrow:520px`

## Animation conventions
- `.reveal` + `.in` (toggled by IntersectionObserver) for scroll-triggered fade/slide-up. `data-d="1..4"` = stagger delay via `transition-delay`.
- Reveal variants for scroll rhythm: `.reveal-scale` (fade + slight scale-up, used on `#process` section heads), `.reveal-left`/`.reveal-right` (slide in from side, used on `.web-grid web-block` rows — direction matches whether copy or visual is on that side). Collapse to translateY on mobile (`@media max-width:1000px`).
- `prefers-reduced-motion: reduce` disables all animation globally (`*{animation:none!important}`) — **always add an exception when adding a new keyframe or a transform pre-state**, or the element is stranded in it. Pseudo-elements and SVG children are not covered by the class-based resets: `.rung::after`, `.proc-line i`, `.sy-dot` and `.sy-out` each need their own override. The hero entrance is the exception that needs none, because every pre-state lives only in a `from` keyframe with `fill-mode:both`, so dropping the animation leaves the natural state.
- Animated counters: `data-count`, `data-prefix`, `data-suffix`, `data-dec` attributes + `animateCount()` JS (rAF, cubic ease-out, 1400ms).
- "Build-up" pattern (`.bm-block`/`.dk`/`.flow-node` etc.): base `opacity:0;transform:translateY(Npx)` → parent `.web-visual.in` reveals with per-child `transition-delay`.
- **Looping pipelines**: `pulse(root, selector, stepMs, holdMs, restMs)` walks a `.lit` class along a diagram's children and loops, but only while that diagram is on screen (its own IntersectionObserver starts and stops it, and `mouseenter` replays a pass). Used by `.hero-pipe` (`.pipe-step`) and `.flow-mock` (`.flow-node,.fl-arrow` — nodes and connectors share the walk so the pulse travels the arrows too). Returns a no-op under `prefers-reduced-motion`.
- **Reading-order stagger**: `.points li`, `.uc`, `.res-lines > div` and `.tech-item` start at `opacity:0` and are revealed by `.in` on their reveal parent with 180–480ms `nth-child` delays, so a heading lands before its supporting rows.
- Ladder rungs stagger via an inline `--i` custom property (`transition-delay:calc(var(--i) * 55ms)`) rather than `data-d`, because there are six of them plus the handoff row and `data-d` only defines 1–4. Tool chips stagger on `.rung.open` with `nth-of-type` delays.
- `.proc-line` carries `.reveal` but overrides it to draw with `scaleX(0) → scaleX(1)`; `.proc-line.reveal` beats `.reveal` on specificity.
- SVG icons: `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`.
- JS reveal selector is `.reveal, .reveal-scale, .reveal-left, .reveal-right, .web-visual` — any new animated visual block should get one of these classes to be observed.
- Scroll progress bar: `#scrollBar` (inside `.scroll-progress`, fixed top of page) — width set as % of scroll in the rAF-batched scroll handler.
- **Hero entrance** is the one sequence on the page driven by CSS animation on load rather than by the observer, because the hero is above the fold and an observer that fires immediately is just a slower way to do the same thing. Keyframes `heroGround` / `heroLine` / `heroRise` / `heroPanel`; timeline is ground 0–700ms, eyebrow 200, the three masked `h1 .ln` lines 380/470/560, subhead 800, CTA 960, trust 1080, pillar panel 1200. The hero visual's own `.in` delays start at 860ms so the composition assembles left to right rather than both halves racing.
- **Masked line reveal**: `<span class="ln"><span>text</span></span>` with `overflow:hidden` on the outer and `translateY` on the inner. `overflow:hidden` on an auto-height block clips the pre-state without ever clipping a line that *wraps* — the block just grows — so this degrades safely at narrow widths. Used on the hero h1 and the final CTA h2, nowhere else.
- **Scroll-linked, not just revealed**: `#signal` (scrubbed continuously from scroll position), `#process` (`--pp` fill + done/active states), and the ladder climb rule. Everything else on the page is still a one-shot fade.
- The process row is driven from the **section's own scroll travel**, not per-step observers: all four steps are side by side, so they enter the viewport in the same frame and a per-step observer marks the row finished before it has been read. `measureProcess()` caches the offset; `updateProcess()` runs inside the existing rAF handler and never reads layout.

## Page structure (section order, top to bottom)
1. `#top` — Hero. Copy column (eyebrow → "Your business shouldn't need you to run every little thing." → what we build → CTA pair → audience line + sector row) beside `.hero-stage` (`.hero-pipe` 5-step pipeline: Order in → Automation → Stock & invoice → Dashboard → Decision, sitting over the `.lap` laptop). `.hero-services` is the three-pillar strip (See / Automate / Grow) linking to `#dashboards` / `#automation` / `#websites`
2. `#positioning` — `.stmt-band`: the one-sentence positioning statement + supporting line, hairline rules above and below
3. `#problem` (band) — four numbered pain cards: manual work, disconnected data, slow decisions, growth bottlenecks
4. `#ladder` — the handoff ladder. Rung 01 Create is tagged **Yours · done**, then a `.handoff` band, then rungs 02–06 (Innovate, Integrate, Automate, Accelerate, Elevate) tagged **Ours**, each opening to symptom / what we do / what changes / tools. Static HTML rungs + one delegated click handler
5. `#signal` (band, `.scrolly`) — the signature scroll section. See its own heading below
6. `#dashboards` (`.web-show`) — SEE. One block, `.dash-mock`
7. `#automation` (`.web-show`) — AUTOMATE. Two blocks: workflow automation (`.flow-mock`, five nodes: WhatsApp → Order → Invoice → Payment → Dashboard) and `#ai` (`.ai-mock` assistant panel: question → sources it reads → answer)
8. `#websites` (`.web-show band`) — GROW. One block: `.browser-mock` + `.search-mock` (a visitor journey, not a search-ranking claim)
9. mid-page CTA
10. `#work` — three example projects as Problem / Solution / Outcome (`.res-lines`), each tagged "Example project"
11. `#process` (band) — **"How an engagement runs"**: Discover → Prioritise → Build → Improve. Retitled so it and the ladder never both claim "how we work" — the ladder is the arc across years, this is what happens after you sign
12. `#faq` — 13 questions, mirrored in the FAQPage schema
13. `#cta` (band) — contact form + WhatsApp route
14. Footer

**`#about` (founder) is currently removed** — pulled on request while the founder facts do not exist. The rewritten markup and its CSS are parked in `docs/removed-founder-section.html` with restore instructions at the top; the nav link was taken out of `.nav-links`, `.mm-links` and the footer "Company" column. Its chapter number was `09`, the last one, so nothing needed renumbering. Note the page lost its "why trust us" section: proof now rests on the sector row, the ladder, the example projects and the FAQ.

Section heads carry a chapter number via `data-ch` on `.eyebrow` (01 problem → 08 process). FAQ and CTA are deliberately unnumbered: they are the close, not part of the argument.

## `#signal` — the one scroll interaction that argues something
Eighteen `<circle class="sy-dot">` elements each hold up to three position sets as inline custom properties: `--sx/--sy` scattered, `--gx/--gy` tabulated (3 rows × 6), and on the seven tagged `.key`, `--cx/--cy` plotted onto a weekday series. The geometry is authored into the markup, so it is static, indexable and needs no JS to compute.

**The visual is scrubbed, not stepped.** JS writes five phase numbers on the section each frame and CSS interpolates everything from them in `calc()`. Pause halfway through the section and the dots sit halfway. Scroll is never intercepted or retimed — the page scrolls exactly as far as the wheel says and only the drawing reacts, which is the line between scroll-*linked* and scroll-*jacking*.

| var | drives |
|---|---|
| `--t1` | scattered → tabulated (all 18 dots) |
| `--t2` | tabulated → plotted (the 7 `.key` dots); the other 11 fade to a field |
| `--t3` | the series line (`stroke-dashoffset: calc(1 - var(--t3))`) and the axis |
| `--t4` | area fill and the peak marker |
| `--t5` | the two `.sy-out` action rows |

Dot position composes the two moves rather than replacing them — `--lx/--ly` lerp scatter→grid, and `.sy-dot.key` lerps from `var(--lx)` on to `--cx/--cy`, so `--t2` continues from wherever `--t1` left the point instead of snapping. **Nothing in the scrubbed set has a CSS `transition`**: the reader's scroll is the timeline, so a transition only adds lag between the wheel and the picture. The one exception is `fill`, which steps at a threshold and does need easing.

`updateSignal()` maps scroll to progress `p` (0 = step 1 centred, 1 = step 5 centred) and runs each phase through a **smoothstep** (`seg()`), so phases ease in and out instead of starting and stopping on a hard edge. The windows deliberately **overlap** — the line starts drawing at `p=.42` while points are still landing until `p=.52` — which is what makes it read as watching something happen rather than watching five slides. `data-stage` is still written, but now only feeds the `.sy-state` readout text, the dot fill colour and the lit step.

Runs inside the existing rAF handler; `measureSignal()` caches the offsets so the loop never reads layout. Below 901px and under `prefers-reduced-motion`, `syStatic()` pins every phase to 1 (the finished, readable frame) and CSS drops the sticky pin. The CSS defaults are also `1`, and a `<noscript>` block releases the rest of the page's reveals, so the no-JS path gets the finished frame rather than an empty panel. This is the only sticky section on the page.

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
- **Premium pass (2026-09-06).** Six things changed:
  1. **Sentinels retired.** `grep -c data-sentinel index.html` is now 0 and the `[data-sentinel]` amber-outline rule is gone. The live site had been showing visitors literal `FOUNDER_NAME` / `FOUNDER_BIO` / `SUPPORT_MODEL` text in dashed amber boxes. Each block was rewritten to read as finished copy using only confirmed facts — the founder section now closes on a "Talk to the person who'll build it" CTA and a `.founder-mark` brand tile instead of a grey photo slot; the lead-time and support FAQs now say what the FAQPage schema already published. The outstanding facts are listed in a `FACTS STILL TO SUPPLY` comment in `<head>`, with the exact insertion points.
  2. **Type scale.** `--fs-h2` 40→46px, `--fs-h3` 24→27px, `--fs-body` 17→18px, `--maxw-text` 680→720px. Hero h1 30–44px → 32–52px on three authored masked lines, and `.hero-grid` went 1fr/1.14fr → 1.06fr/1fr to give the headline the width it now measures.
  3. **Chapter markers.** `.eyebrow` is no longer a tinted pill. It is a rust rule + `data-ch` number + label (`—— 03 / WHAT ACTUALLY CHANGES`). `.eyebrow .dot` is now that rule and carries `order:-1`, because `::before` (the number) is otherwise the first flex item. Chapters run problem → process; FAQ and CTA stay unnumbered as the close.
  4. **`#signal` — the signature scroll section** (see its own heading below).
  5. **Motion made scroll-linked.** Ladder rungs draw their climb rule (`scaleX`, per-rung `--i` delay, transform delay set per-property so opening a rung is not delayed). `#process` gained done/active/ahead states and a rust progress fill driven by `--pp`.
  6. **Dead code.** ~48 lines of hero-morph leftovers deleted (`.hero-visual`, `.service-card`, `.card-reveal`, all `.s-*`) — none matched any markup. Source Serif 4's `ital` axis dropped from the font URL; nothing on the page uses serif italic.
- Fixed two long-standing layout bugs found while auditing: `.lap-tag` used `align-self:flex-start` inside `.lap-inner`, which is a **grid**, so the "Example dashboard" tag stretched the full panel width (now `justify-self:start`); and the FAQPage schema was missing the 13th question.
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
