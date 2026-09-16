# Executive visual system — foundation + homepage

**Date:** 2026-09-16
**Status:** approved in brainstorm, awaiting written-spec review
**Sub-project:** 1 of 6 (foundation + homepage). Services, Case Studies, Insights, About and Contact follow as their own spec → plan → build cycles.

## 1. Goal

Rebuild dayaminsights.com as a multi-page site whose entire visual language derives from the Dayam Insights logo, positioned as a company that engineers business intelligence systems — not a web agency. Visitors should conclude "these people can redesign how our business operates."

This sub-project delivers the design system (as code plus a living `styleguide.html`), the shared nav and footer, the six proprietary SVG graphic systems, the motion system, the homepage, and stub pages for the other five routes so no link ships dead.

## 2. Decisions made in brainstorm

| Question | Decision |
|---|---|
| Relationship to live site | Replace. Port proven assets only: `<head>` meta + JSON-LD schema + GA4 (`G-24QJPZPKZR`), 13 FAQ questions + FAQPage schema, contact form (name / business / phone / email / message) with its WhatsApp-prefill fallback when `action="FORM_ENDPOINT"`, phone `+91-78776-40693`, email. |
| Audience / copy register | Both tiers. Headlines executive and precise; body plain, concrete, jargon-free. Numbers over adjectives. Banned words: leverage, empower, unlock, seamless, cutting-edge. |
| Content reality | Nothing real yet. Three case studies and three insight pieces written by Claude from current site substance, labelled "Illustrative engagement" / no fake client names. |
| Architecture | Static multi-page, no build step, GitHub Pages. Nav and footer duplicated per file. |
| Intro splash (Frame 01) | Once per session via `sessionStorage`; skipped under `prefers-reduced-motion`; hero renders underneath so LCP is not blocked. |
| Logo DNA reading | Approved (see §3). |
| Hero direction | A — editorial 7/5 split, Data Flow Architecture diagram on the right, blueprint grid background. |
| Services structure (Frame 04) | A — vertical spine modules, scroll-animated. Horizontal rail variant reserved for the Services page. |
| Build approach | Styleguide-first: build `styleguide.html` as the living system, compose `index.html` from it. |
| Polish | `/taste:taste` skill invoked per homepage section during build for motion and finish. |

## 3. Logo DNA (source of truth)

Reading of the mark, approved:

- **Blue square** (the dot of the *i*) — the one signal. Square, not round. Therefore every node in the system is a square; the blue square marks the single active point in any composition.
- **i-bar** — input. Vertical, hard-edged, flat. Input sits on the left of every composition.
- **Outer D** — the system boundary. Flat left face (input), semicircular right face (delivery).
- **Nested inner D** — processing layers. Concentric arcs represent the automation loop and iteration.
- **Inner diagonal notch** — transformation: data enters as one shape and leaves as another.
- **Vertical hairline** between mark and wordmark — the separator. Becomes section dividers, table rules, timeline spines.
- **Tagline dots** — blue square separators between letter-spaced caps become the site-wide label/eyebrow pattern.
- **Direction** — left to right: Input → Processing → Automation → Intelligence → Outcome.

Derived primitives: **Node** (8–16px square; navy outline idle, blue fill active), **Hairline** (1px navy at 20–35%; dashed = pending, solid = live), **Half-D arc** (flat-left, round-right), **Concentric arcs**, **Spine** (vertical rule), **Label** (11px caps, .14em tracking, blue square separator).

Rules that follow:

1. Nodes are squares, never circles.
2. One blue element per composition (active node, live cursor, or CTA).
3. Radius scale is 0 / 2px / full. Sharp by default; full only on D-derived shapes.
4. Where a shape is asymmetric, input side is flat, delivery side is the arc.
5. Left → right is the only story direction in diagrams, timelines and flows.
6. Hairlines, not shadows. Elevation is a 1px line and surface tone; shadow appears only on hover lift.
7. Inter 700–800 tight-tracked headings; 11px caps labels mirror the tagline.
8. No gradients, no photography of people, no illustration outside the six systems.

## 4. File architecture

```
index.html                    homepage
styleguide.html               living design system (noindex, linked from footer)
services.html                 stub this sub-project; full page in sub-project 3
case-studies.html             stub; sub-project 4
insights.html                 stub; sub-project 5
about.html                    stub; sub-project 6
contact.html                  stub carrying the ported form; full page in sub-project 6
assets/css/tokens.css         :root custom properties only
assets/css/base.css           reset, typography, grid, utilities, reveal states
assets/css/components.css     nav, footer, buttons, eyebrow, module, case tile, insight row, stat, statement band, form, FAQ, tag, diagram frame
assets/css/graphics.css       styles and keyframes for the six SVG systems
assets/js/site.js             nav, splash + FLIP, reveal observer, scroll-linked drivers, travellers, pulse network, counters, form fallback
assets/svg/mark.svg           redrawn logo mark
assets/svg/wordmark.svg       outlined wordmark
assets/svg/lockup.svg         mark + separator + wordmark
favicon.svg                   regenerated from mark
docs/archive/index-2026-09-rust.html   the retired page, kept for reference
```

The retired page's uncommitted ladder-heading edit is committed to `main` first so nothing is lost, then the archive copy is taken.

Stub pages carry the real nav, footer, `<head>` and a single statement section ("Services — full page in progress. Talk to us →") so every nav link resolves.

## 5. Foundation tokens

### Colour

Specified: `--navy:#07162D`, `--blue:#1E7BFF`, `--bg:#F8FAFC`, `--surface:#FFFFFF`, `--line:#E5EAF2`, `--muted:#64748B`.

Derived: `--ink-2:#334155` (labels, secondary text under 14px), `--line-strong:#CBD5E1`, `--blue-soft:rgba(30,123,255,.10)`, `--on-navy:#F8FAFC`, `--on-navy-muted:#9FB0C8`, `--line-on-navy:rgba(248,250,252,.14)`.

Ratio target across any viewport: roughly 80% navy-ink-and-navy-surfaces, 15% white, 5% blue. Blue is reserved for the single active element per composition and the primary CTA hover. No gradients, no additional hues.

Contrast: `--muted` on white is 4.7:1 and is used only at 14px or larger. Labels at 11px use `--ink-2` (9.9:1 on white).

### Typography

Inter from Google Fonts, weights 400/500/600/700/800, `display=swap`, `preconnect`. Stack: `Inter, "Neue Haas Grotesk", system-ui, sans-serif`.

| token | size | weight | tracking | line-height |
|---|---|---|---|---|
| `--fs-display` | clamp 56→96px | 800 | -.035em | 1.02 |
| `--fs-h1` | clamp 44→72px | 800 | -.03em | 1.02 |
| `--fs-h2` | clamp 36→52px | 700 | -.025em | 1.08 |
| `--fs-h3` | clamp 24→30px | 700 | -.02em | 1.2 |
| `--fs-lead` | clamp 18→22px | 400 | 0 | 1.5 |
| `--fs-body` | 17px | 400 | 0 | 1.55 |
| `--fs-small` | 14px | 500 | 0 | 1.5 |
| `--fs-label` | 11px, uppercase | 500 | .14em | 1 |

Max measure 68ch for body, 14ch for h2, 60ch for lead. Numbers use `font-variant-numeric: tabular-nums`.

### Spacing, grid, radius, elevation

- 8px base. `--sp-1` … `--sp-12` = 8, 16, 24, 32, 48, 64, 96, 128, 160, 192, 240, 320. Section padding `--sp-9` desktop, `--sp-7` mobile.
- `--maxw: 1440px`. Gutters 24px (<640), 24px (640–899), 40px (900–1199), 64px (≥1200). `.grid` is 12 columns with 24px column gap; column classes `.c-1` … `.c-12`. Breakpoints 640 / 900 / 1200.
- Radius `--r-0: 0`, `--r-1: 2px`, `--r-full: 999px`. Buttons, cards, inputs and frames use 0.
- No resting shadow. Hover lift: `translateY(-4px)` plus `0 12px 32px -16px rgba(7,22,45,.25)`.

### Motion tokens

`--t-fast: 200ms`, `--t-base: 600ms`, `--t-slow: 1200ms`, `--ease: cubic-bezier(.2,.7,.2,1)`. Hover scale 1.02 on tiles only.

## 6. Components

- **Nav** `.nav` — fixed, 72px, white, hairline bottom. Lockup left; Services · Case Studies · Insights · About centre-right at 14px/500; `.btn-primary` "Talk to us" → `contact.html`. After 8px scroll: 64px tall with `backdrop-filter`. Active page: 2px blue underline. Under 900px: hamburger opens a full-screen navy panel with links at `--fs-h2` and the tagline at the bottom.
- **Footer** `.footer` — navy. Row 1: lockup, one-line positioning, tagline with blue-square separators. Row 2: four columns — Services (Data, Automation, AI, Websites), Company (Case Studies, Insights, About, Contact), Contact (email, phone, WhatsApp), Location (India · remote). Row 3: hairline, © year, Privacy, Styleguide. Intelligence Grid at 5% behind. Columns stack 2×2 under 900px, 1 column under 640px.
- **Buttons** — `.btn-primary` navy fill / white text / 0 radius / 14px 600 / padding 14px 24px; hover swaps to blue fill. `.btn-secondary` 1px navy outline. `.btn-link` text with 1px underline and `→`. `.btn-on-navy` white fill for navy surfaces. One primary per section.
- **Eyebrow** `.eyebrow` — `--fs-label`, chapter number, blue square, text: `01 ▪ WHAT WE BUILD`.
- **Section head** `.sec-head` — eyebrow + h2 + lead. Left-aligned; `.center` variant for statements.
- **Module row** `.module` — services spine row: grid `12cqw / 1fr / 26%` on desktop; node on the spine; number, name, description, tags, mini-diagram. `.live` state driven by scroll.
- **Case tile** `.case` — editorial two-column: left has sector label, h3, three stat pairs; right has a System Blueprint SVG. Alternates sides. Hairlines top and bottom, no box, no shadow.
- **Insight row** `.insight` — date (tabular), category label, title 600, one-line dek, `→`. Hairline between rows. No thumbnails.
- **Stat** `.stat` — number at `--fs-h1` 800 tabular, 11px caps label beneath, hairline above. Counts up once on reveal.
- **Statement band** `.stmt` — navy full-bleed, `--fs-display`, one CTA.
- **Form** `.form` — 11px caps labels, 0-radius inputs with 1px `--line-strong`, focus 2px navy. Fields ported. Submit fires GA4 `generate_lead`; WhatsApp fallback preserved.
- **FAQ** `.faq` — `<details>` rows, hairline separated, `+` rotates 45° when open. 13 ported questions, FAQPage schema kept in sync.
- **Tag** `.tag` — 11px caps, 1px line, white surface.
- **Diagram frame** `.diagram` — 1px line, `--bg` fill, optional caption `FIG. 01 — DATA FLOW` bottom-left.

## 7. Graphic systems

All inline SVG, hand-authored, `viewBox`-scaled, no libraries. Stroke navy 1px at 25–35% opacity, square nodes 8–14px, exactly one blue element per composition. Motion is CSS driven by custom properties or `stroke-dashoffset`; JS only supplies scroll progress, `.in`, or the pulse index.

| # | System | Construction | Motion | Used in |
|---|---|---|---|---|
| 1 | Intelligence Mesh | 12–18 square nodes, hairline edges, each node group carries `--i` | Nodes fade in by `--i` × 60ms; edges draw; blue node ripples (square outline scales 1→2.4 over 3s, loops) | `#signal`, About |
| 2 | Data Flow Architecture | Input column → orthogonal paths → nested-D processor → outcome node | Paths draw left→right on reveal; 6px blue square travels the path via `offset-path` (4s loop); inner notch flips once | Hero, Services |
| 3 | Automation Loop | Three concentric half-D arcs, dashed spine, input square | Arcs draw on reveal; signal runs the outer arc and returns down the spine (6s loop) | Automation module, Services |
| 4 | System Blueprint | 4% grid, measured rectangles, dimension ticks, 5px caps labels, one measured arc | Static; dimension lines draw on reveal | Case tiles, case study pages |
| 5 | Signal Pulse Network | Sparse nodes, one active at a time | JS advances the active node every 2.4s: blue fill + square ripple; others at 25% | `#close` background, Contact |
| 6 | Intelligence Grid | 2px square dots on a 32px lattice as CSS `background-image` | None; 5% opacity. Hero adds 64px blueprint lines at 4.5% | Hero, footer, section bands |

Travellers and pulses run only while their diagram is on screen (IntersectionObserver starts and stops them). One traveller per diagram.

Logo assets: `mark.svg` redrawn faithfully (i-bar, blue square, nested D with notch), `wordmark.svg` as outlined Inter, `lockup.svg`. Clearspace = one blue-square unit. Minimum mark size 24px.

Icons: 24px grid, 1.5px navy stroke, square terminals (`stroke-linecap: butt`). Set of eight: data, automation, ai, websites, arrow-right, plus, whatsapp, mail.

Dividers: full-bleed hairline; `.divider.d` variant carries a 24px half-D arc at its left end.

## 8. Homepage

| # | Section | Frame | Content |
|---|---|---|---|
| 0 | `#splash` | 01 | White overlay, mark centred, blue square pulses once (400ms), tagline fades in. 1.4s total, then FLIP morph of the mark into the nav slot (600ms) and overlay removed. Sets `sessionStorage.dayamSplash = "1"`; skipped when set, under reduced motion, and hidden by `<noscript>`. Overlay never shifts layout. |
| 1 | `#hero` | 02 | Eyebrow = tagline. h1 "Building intelligent systems for modern businesses." Lead in plain register: orders, stock, invoices and customers connected into one system that updates itself and shows what to do next. Primary "Book a systems review" → `contact.html`; link "See how it works" → `#system`. Right five columns: Data Flow Architecture. Blueprint grid background. |
| 2 | `#proof` | — | Hairline strip of four stats ported from the current page (40% / 0 / 100% / 24/7 with their labels), tabular counters. |
| 3 | `#signal` | 03 | Full-width Intelligence Mesh, scroll-linked (`--p`): nodes light left→right, edges draw, blue ripple at the end. Overline "Business data becoming intelligence." Three captions: Collect · Connect · Decide. |
| 4 | `#system` | 04 | Eyebrow `01 ▪ WHAT WE BUILD`. h2 "One system. Four layers. Each one feeds the next." Vertical spine modules Data → Automation → AI → Websites. Blue node descends the spine with scroll; each row's mini-diagram draws when `.live`. Tags list the tools from the retired ladder. |
| 5 | `#work` | 05 | Eyebrow `02 ▪ ENGAGEMENTS`. Three case tiles, alternating, each labelled "Illustrative engagement", built from the retired page's three example projects as Context / System / Outcome plus three stats. Blueprint SVG per tile. Link to `case-studies.html`. |
| 6 | `#how` | — | Eyebrow `03 ▪ HOW AN ENGAGEMENT RUNS`. Discover → Prioritise → Build → Improve on a horizontal rail with scroll-linked progress fill. Copy ported. |
| 7 | `#insights` | 06 | Eyebrow `04 ▪ INSIGHTS`. Three insight rows with titles and deks written for this build (working titles: "Why your dashboard is a month late"; "Order-to-invoice: the six steps nobody should do by hand"; "What an AI assistant grounded in your data actually answers"). Link to `insights.html`. |
| 8 | `#faq` | — | Thirteen ported questions in `<details>`; schema kept. |
| 9 | `#close` | 07 | Navy statement band: "INTELLIGENCE. ENGINEERED." on two lines, one supporting line, single CTA "Book a systems review". Signal Pulse Network behind. Followed by the ported contact form block so the homepage converts without a page change. |
| 10 | Footer | — | As §6. |

## 9. Motion system

Four verbs only:

1. **Reveal** — `.reveal`: opacity 0→1 and `translateY(16px)`→0 over `--t-base` with `--ease`. IntersectionObserver adds `.in` once at 15% visibility. Stagger with `--i` × 60ms.
2. **Draw** — SVG `stroke-dashoffset` 1→0 over 900ms. Dimension lines, edges, arcs.
3. **Travel** — blue square along `offset-path`, linear, 4–6s loops, only while on screen.
4. **Scrub** — scroll-linked via a CSS custom property written inside one rAF handler; smoothstep eased; layout measured only on resize. Never intercepts scroll.

Hover: lift and shadow on tiles (200ms), fill swap on buttons. No parallax, cursor effects, marquees or auto-playing video.

Reduced motion: every transition, keyframe and observer pre-state is disabled; scrubbed sections pin to their end state; travellers and pulses do not run; splash is skipped. Every new pseudo-element or SVG pre-state gets an explicit override, per the existing project convention. `<noscript>` releases all reveals.

## 10. Responsive behaviour

| Breakpoint | Grid | Hero | Modules | Case tiles |
|---|---|---|---|---|
| ≥1200 | 12 col, 64px gutter | 7 / 5 | label / body / diagram | two-column, alternating |
| 900–1199 | 12 col, 40px | 7 / 5 | three columns, narrower | two-column |
| 640–899 | 6 col, 24px | stacked, diagram under copy | label / body, diagram under | stacked |
| <640 | 4 col, 24px | stacked, h1 44px | single column, spine 16px from left | stacked |

Nav collapses under 900px. Diagrams never overflow (`max-width: 100%`; frames clip).

## 11. Accessibility and performance

- WCAG AA throughout (see contrast notes in §5). Focus ring 2px blue with 2px offset. Skip link. Decorative SVG `aria-hidden`; meaningful diagrams get `role="img"` and a `<title>`.
- No JS or CSS libraries. Inter only, five weights. Inline SVG. Page weight target under 250KB excluding the font.
- Targets: LCP under 2.0s on a mid-range phone, CLS 0, Lighthouse ≥95 for performance, accessibility and SEO.

## 12. Styleguide page

`styleguide.html` sections: Logo (mark, wordmark, lockup, clearspace, minimum size) · DNA reading (the derivation diagram) · Colour (swatches, 80/15/5 bar, contrast table) · Type specimen · Spacing and grid overlay toggle · Radius and elevation · Buttons, forms, tags, eyebrows in every state · Module row, case tile, insight row, stat, FAQ · The six graphics live with motion · Icons · Motion (four verbs demonstrated, tokens listed) · Do / Don't (the eight rules). `noindex`, linked from the footer.

## 13. Build order

1. Commit the pending ladder-heading edit on `main`. Branch `executive-system`. Archive the old page. Scaffold files and `.gitignore` entries.
2. `tokens.css`, `base.css`, logo SVGs, favicon.
3. `styleguide.html` skeleton; each component added to it as it is built.
4. Graphics in order 6 → 1 → 2 → 3 → 4 → 5.
5. Nav, footer, splash.
6. Homepage sections top to bottom, with a `/taste:taste` pass per section.
7. Five stub pages.
8. Verification: Playwright screenshots at 390 / 768 / 1280 / 1440, console-error check, reduced-motion pass, axe-core, tag-balance grep, Lighthouse. Update `PROJECT_NOTES.md` and `sitemap.xml`.
9. Merge to `main`.

## 14. Out of scope

Full Services, Case Studies, Insights, About and Contact pages (sub-projects 3–6); OG image regeneration; real client content; a backend form endpoint; any CMS.

## 15. Risks

- **Splash FLIP misaligns** if the nav logo has not laid out when measured — measure after `document.fonts.ready`; fall back to a plain fade if the rect is zero.
- **`offset-path` unsupported** in Safari before 15.4 — traveller hidden, paths still draw.
- **Copy volume** — roughly 2,500 words of homepage copy plus three illustrative cases and three insight rows are written by Claude; user reviews before merge.
- **Font swap** shifts headline metrics briefly — `size-adjust` on the fallback face to hold CLS at 0.
