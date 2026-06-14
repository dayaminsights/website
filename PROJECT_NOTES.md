# Dayam Insights — Landing Page Notes

Single self-contained `index.html` (no build step, GitHub Pages ready). Inline `<style>` + inline vanilla JS. Targets Tier-2 India audience — plain language, no jargon.

## Design system (CSS vars in `:root`)
- Colors: `--bg:#070b16`, `--bg-2:#0a0f1f`, `--surface:#0e1426`, `--surface-2:#121a30`, `--line:rgba(148,163,184,.14)`, `--line-strong:rgba(148,163,184,.26)`, `--text:#eef2fb`, `--muted:#9aa6c2`, `--muted-2:#6b7794`
- Accents: `--accent:#4f7dff` (blue), `--accent-2:#8b5cf6` (violet), `--accent-3:#22d3ee` (cyan), `--good:#34d399` (green), `--warn:#fbbf24` (amber)
- Layout: `--radius:16px`, `--radius-lg:24px`, `--maxw:1180px`, `--ease:cubic-bezier(.22,.61,.36,1)`, `--shadow:0 24px 60px -24px rgba(2,6,20,.85)`
- Fonts: Inter (body) + JetBrains Mono (`.mono`)

## Animation conventions
- `.reveal` + `.in` (toggled by IntersectionObserver) for scroll-triggered fade/slide-up. `data-d="1..4"` = stagger delay via `transition-delay`.
- Reveal variants for scroll rhythm: `.reveal-scale` (fade + slight scale-up, used on `#process`/`#tech` section heads), `.reveal-left`/`.reveal-right` (slide in from side, used on `.web-grid web-block` rows — direction matches whether copy or visual is on that side). Collapse to translateY on mobile (`@media max-width:1000px`).
- `prefers-reduced-motion: reduce` disables all animation globally — always add exceptions when adding new keyframes (incl. `.glow-orb{translate:none!important}`).
- Animated counters: `data-count`, `data-prefix`, `data-suffix`, `data-dec` attributes + `animateCount()` JS (rAF, cubic ease-out, 1400ms).
- "Build-up" pattern (`.bm-block`/`.dk`/`.flow-node` etc.): base `opacity:0;transform:translateY(Npx)` → parent `.web-visual.in` reveals with per-child `transition-delay`.
- SVG icons: `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`.
- JS reveal selector includes `.reveal, .reveal-scale, .reveal-left, .reveal-right, .hero-visual, .web-visual` — any new animated visual block should get one of these classes to be observed.
- Scroll progress bar: `#scrollBar` (inside `.scroll-progress`, fixed top of page) — width set as % of scroll in the rAF-batched scroll handler.
- Parallax: `.glow-orb` elements get a JS-driven `translate` (standalone CSS property, coexists with the `float` keyframe `transform` animation) based on their container's position in viewport — subtle, gated by `prefers-reduced-motion`.
- Scroll-driven layout morph: `.hero-morph-stage` (200vh wrapper) + `position:sticky` hero + `applyHeroMorph(progress)` lerps/snaps inline styles between STATE_A/STATE_B tables based on `heroMorphProgress()` (0-1 over first 100vh of stage scroll). Gated by `heroMorphEnabled` (desktop + motion-OK only); CSS media queries provide the STATE_B fallback for mobile/reduced-motion.

## Page structure (section order, top to bottom)
1. `#top` — Hero: `.hero-grid` = `.hero-copy` (left: two-line headline — plain line + `.grad` gradient line "Start growing with AI.", tagline, CTAs, stats) + `.hero-visual` (right: 5 service cards in 2-col grid, "AI Assistants" spans both columns)
   - Hero cards link to: Websites & Apps + Marketing → `#growth` / `#marketing`, Dashboards → `#dashboards`, Automation → `#automation`
2. `#problem` — 4 pain-point cards (spreadsheets, typos, late data, scaling pain)
3. `#process` — 4-step process (Audit → Architect → Automate → Accelerate)
4. `#results` — measurable outcomes / case-study style metrics
5. `#tech` — tech stack groups
6. `#growth` (`.web-show`) — combined **Websites & Apps + Marketing** showcase
   - Block 1: browser-mock that builds itself + search-ranking card (`.browser-mock`, `.search-mock`)
   - Block 2 `#marketing` (`.web-grid.rev`): campaign-mock (social post + engagement stats) + funnel-mock (Reach → Clicks → New customers)
7. `#intelligence` (`.web-show`) — combined **Dashboards + Automation** showcase
   - Block 1 `#dashboards`: dash-mock (KPI cards + weekly bar chart)
   - Block 2 `#automation` (`.web-grid.rev`): flow-mock (3-step pipeline: order → stock/dashboard update → invoice sent)
8. `#why` — 4 reasons / differentiators grid
9. `#cta` — final consultation CTA band
10. Footer

Note: the old `#solutions` section ("Four outcomes" grid: Automate Operations, Unlock BI, Build Digital Products, Scale with AI) was **removed** — it duplicated the hero service cards and the `#growth`/`#intelligence` showcases. Nav "Solutions" link and footer "Outcomes" column links now point to `#growth`/`#dashboards`/`#automation`/`#top` instead.

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
