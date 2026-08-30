# Dayam Insights — Design System Specification

**Date:** 2026-08-30
**Version:** v2 — light ground
**Status:** Approved and settled. Facts in §14.2 ship as sentinels until supplied.
**Scope:** Token system + component specs for `index.html`. Implementation of P0/P1 audit findings follows in a separate plan.

> **v2 supersedes v1.** v1 specified a near-black ground with a burnt-amber accent. The direction changed to a white ground with black. The type scale, spacing scale, radii, motion tokens and accessibility floors carry over unchanged; colour, elevation and the mockup treatment are rebuilt.

---

## 0. Decisions that produced this spec

| Decision | Chosen | Consequence |
|---|---|---|
| Positioning | **Direction A — SME operations** | Retailers, distributors, small manufacturers. Plain language. ₹ formatting. All five services retained. WhatsApp-first contact stays. |
| Visual direction | **White ground, black ink, inverted panels** | Dark navy → white. The "black" is not only type: whole sections invert to a near-black panel as the page's structural emphasis. |
| Proof handling | **Relabel as worked examples** | `#results` quotes deleted. Section retitled. Figures marked as modelled. |
| Implementation scope | **Design system + P0 + P1** | 16 audit findings. |

**Non-goals.** No build step. No framework. No CSS preprocessor. `index.html` stays a single self-contained file deployable to GitHub Pages. No component library — this system is expressed as CSS custom properties plus a small set of utility classes.

---

## 1. Design principles

These are the rules that resolve arguments later. When a decision is unclear, apply them in order.

1. **The page is white; emphasis is black.** Inversion is the primary structural device, replacing the gradients, glows and blurs that a dark ground invited. A black section on a white page is louder than any gradient.
2. **Borders do the separating, not shadows.** On a light ground, hairlines read as precision and shadows read as cheap. Shadow is reserved for genuinely floating things.
3. **One accent, used sparingly.** Boldness spent in one place. Everything around it stays achromatic.
4. **Semantic colour is not decoration.** Green means good. Amber means attention. If they appear anywhere else, they stop meaning anything.
5. **Motion belongs to data.** Chart bars, counters, pipeline builds — these communicate. Floating chips do not.
6. **Nothing off-scale.** A font size, spacing value, or radius that is not in this document is a bug.
7. **Contrast is a constraint, not a preference.** Every text/background pair ships at AA or better. Values below are measured, not estimated.

**Why light.** Analytics and AI-automation sites are overwhelmingly dark — the dark navy landing page is the category default and was the audit's strongest "template" finding. A white ground with black type and inverted panels is the register of a printed consultancy report, not a startup landing page, and it removes the entire class of effects (glow orbs, blur layers, gradient text) that were reading as generated.

---

## 2. Colour

### 2.1 Ground and surfaces

Pure white page. A near-white band for alternation. A near-black panel for inversion.

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#FFFFFF` | Page ground |
| `--bg-2` | `#F0EFEA` | Alternating section bands. Measured against white at **1.15 : 1** — perceptible as a band without reading as a stripe. An earlier `#F7F7F5` measured 1.07 : 1, below the threshold of perception on most screens, so the alternation existed in the CSS but not to the eye. |
| `--surface` | `#FFFFFF` | Cards. On a band they separate by border; on white they separate by border plus `--shadow-sm` |
| `--surface-sunken` | `#F2F2EF` | Inset wells, mockup interiors, code, table headers |
| `--placeholder` | `#DCDBD5` | Wireframe placeholder bars inside mockups. `--surface-sunken` measured 1.12 : 1 against the white mockup interior, so the bars representing page content were invisible. |
| `--panel` | `#111315` | **Inverted panel** — CTA band, dashboard mockups, one showcase section |
| `--panel-2` | `#1B1E21` | Raised surface *inside* an inverted panel |

**On `--panel`.** This is the direction's structural idea. Rather than decorating a white page, one or two sections invert completely. The dashboard and automation mockups become black panels on white, which reads as a real product screenshot rather than an illustration — a credibility gain the dark version could not get, because on a dark page a dark mockup is just more dark page.

### 2.2 Lines

| Token | Hex | Use |
|---|---|---|
| `--line` | `#E4E4E0` | Default borders, dividers, table rules |
| `--line-strong` | `#C9C9C3` | Emphasised borders, hover state, section rules |
| `--line-invert` | `rgba(247,247,245,.14)` | Borders inside an inverted panel |

### 2.3 Text on white

| Token | Hex | Contrast on `--bg` | Use |
|---|---|---|---|
| `--ink` | `#111315` | **18.62 : 1** ✓ | Headings, primary copy, stat values |
| `--ink-2` | `#3A3E44` | **10.76 : 1** ✓ | Sub-headings, emphasised body |
| `--muted` | `#555B63` | **6.85 : 1** ✓ | Body copy, descriptions |
| `--muted-2` | `#676D75` | **5.22 : 1** on white, **4.54 : 1** on `--bg-2` ✓ | Captions, labels, footnotes — min 11px |

A light ground compresses the usable grey range: everything from `--muted` down sits between 4.5 : 1 and 7 : 1, so there are four ink levels rather than the five a dark ground allows. This is a real constraint of the direction, not an oversight — do not add a fifth by inventing a lighter grey, because it will fail AA.

### 2.4 Text on `--panel`

| Token | Hex | Contrast on `--panel` | Use |
|---|---|---|---|
| `--on-panel` | `#F7F7F5` | **17.4 : 1** ✓ | Headings and primary copy inside an inverted panel |
| `--on-panel-muted` | `#9BA0A6` | **7.4 : 1** ✓ | Secondary copy inside an inverted panel |

### 2.5 Accent

**Rust — `#A94F26`. Settled.** Chosen over deep green (`#1F6B4A`) and ink blue (`#1B4B8F`). Rust on white with black is a printed-report combination: uncommon in this category, and it keeps green free to mean "good" rather than doubling as the brand hue. Ink blue was rejected as the consultancy default — highest contrast, least differentiation.

| Token | Hex | Contrast on white | Use |
|---|---|---|---|
| `--accent` | `#A94F26` | **5.47 : 1** ✓ | Links, eyebrows, icons, chart bars, accent rules |
| `--accent-hover` | `#8E4120` | 7.1 : 1 ✓ | Hover on accent text and fills |
| `--accent-soft` | `rgba(169,79,38,.08)` | — | Tints, icon wells, hover fills |
| `--accent-line` | `rgba(169,79,38,.30)` | — | Accent borders |
| `--accent-on-panel` | `#D7855C` | 6.9 : 1 on `--panel` ✓ | The accent *inside* an inverted panel, where `#A94F26` would fail |

The accent and the focus ring are deliberately different hues — rust and `--focus:#1B4B8F` — so a focused element never reads as an accent element.

**Primary buttons are black, not accent.** `--ink` fill with `--bg` text is 18.6 : 1 and is the strongest call-to-action available on a white page. The accent is reserved for links, data and emphasis — which keeps it meaning something. This is the single biggest difference from the dark version, where the accent had to carry the button because black-on-black is not a button.

### 2.6 Semantic

Reserved. Never decorative.

| Token | Hex | Contrast on white | Meaning |
|---|---|---|---|
| `--good` | `#1F6B4A` | **6.44 : 1** ✓ | Positive delta, completed step, "what we do" tag |
| `--warn` | `#8A5A0B` | **5.91 : 1** ✓ | Needs attention — low stock, reorder alert |

Inside an inverted panel these lighten to `--good-invert:#5FBF8F` (6.0 : 1 on `--panel`) and `--warn-invert:#D9AE3F` (9.2 : 1 on `--panel`).

With rust as the accent, green stays purely semantic — which is the main reason rust won.

### 2.7 Focus

| Token | Hex | Use |
|---|---|---|
| `--focus` | `#1B4B8F` | Focus ring on white — 8.57 : 1 |
| `--focus-invert` | `#8FB8FF` | Focus ring inside an inverted panel — 9.8 : 1 |

Blue is the only cool hue in an otherwise warm-and-achromatic system, so a focus ring is never mistakable for an accent element.

### 2.8 Token block

```css
:root{
  /* ground */
  --bg:#FFFFFF;
  --bg-2:#F0EFEA;
  --surface:#FFFFFF;
  --surface-sunken:#F2F2EF;
  --placeholder:#DCDBD5;
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
  --muted-2:#676D75;

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
}
```

### 2.9 Removed from the current site

| Removed | Was | Why |
|---|---|---|
| `--accent-2` | `#8B5CF6` violet | Every blue→violet gradient goes with it — the strongest AI-startup signature there is |
| `--accent-3` | `#22D3EE` cyan | Eyebrow and icon uses move to `--accent` |
| Gradient text | 5 uses, 3 directions | Invisible in high-contrast modes; a template signal |
| `.grid-lines` | 64px fixed overlay | Meaningless on white; was the second-strongest template signal |
| `.glow-orb` | ×8, 50–70px blur | Blurred glows do not exist on a white ground. Replaced by hairlines and inverted panels. |
| `.glow-chip`, `.scroll-path-layer` | ×10, `backdrop-filter` | Decorative, no meaning, ten compositing layers |
| `--shadow` heavy | `0 24px 60px -24px rgba(2,6,20,.85)` | Calibrated for a dark ground; on white it reads as a cheap drop shadow |

---

## 3. Typography

Unchanged from v1. The family and scale decisions are independent of ground colour.

### 3.1 Families

| Role | Family | Weights | Applies to |
|---|---|---|---|
| Display / UI | **Instrument Sans** | 500, 600, 700 | All headings, buttons, nav, card titles, stats, labels, any text under 15px |
| Body | **Source Serif 4** | 400, 600, 400i | Running prose only — paragraphs of two or more lines |
| Data | **IBM Plex Mono** | 400, 500 | Numbers, timings, tags, step markers, code |

The serif reads noticeably better on white than it did on near-black, which removes the readability caveat that scoped it in v1. It stays scoped to running prose anyway — UI text under 15px is still sans, because that is what UI text is.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">
```

```css
--font-ui:'Instrument Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
--font-body:'Source Serif 4','Iowan Old Style',Georgia,serif;
--font-mono:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
```

**One light-ground adjustment.** Text on white appears optically heavier than the same weight on dark. Body weight stays 400, but headings drop from 700 to **600** at h2 and below — on white, 700 reads as shouting. h1 keeps 700.

### 3.2 Scale

Eight sizes. Replaces the eighteen hardcoded values currently in the file, five of which were on half-pixels.

| Token | Desktop | Tablet | Mobile | Line height | Tracking | Family |
|---|---|---|---|---|---|---|
| `--fs-h1` | 60px | 44px | 34px | 1.04 | −0.03em | UI 700 |
| `--fs-h2` | 40px | 34px | 28px | 1.10 | −0.022em | UI 600 |
| `--fs-h3` | 24px | 22px | 20px | 1.25 | −0.012em | UI 600 |
| `--fs-h4` | 19px | 19px | 18px | 1.30 | −0.005em | UI 600 |
| `--fs-body` | 17px | 17px | 16px | 1.60 | 0 | Body 400 |
| `--fs-small` | 15px | 15px | 15px | 1.50 | 0 | UI 400 |
| `--fs-micro` | 13px | 13px | 13px | 1.40 | +0.02em | UI 500 |
| `--fs-label` | 11px | 11px | 11px | 1.30 | +0.12em | Mono 500, uppercase |

```css
--fs-h1:clamp(34px,5vw,60px);
--fs-h2:clamp(28px,3.6vw,40px);
--fs-h3:clamp(20px,2.4vw,24px);
--fs-h4:clamp(18px,2vw,19px);
--fs-body:clamp(16px,1.2vw,17px);
--fs-small:15px;
--fs-micro:13px;
--fs-label:11px;
```

### 3.3 Rules

- **Measure:** 62–68 characters for prose. `--maxw-text:680px` at 17px lands at ~66.
- **`text-wrap:balance`** on every h1, h2, h3 and on `.eyebrow`.
- **`text-wrap:pretty`** on paragraphs, to prevent orphans.
- **No hard `<br>` in headings.** The current hero `<br>` forces a bad break on mobile. Line control comes from `max-width` and `balance`.
- **`font-variant-numeric:tabular-nums`** on every stat, KPI, table column, and counter.
- **Uppercase labels always carry `+0.12em` tracking.**
- **`-webkit-font-smoothing:antialiased` is removed.** It is correct for light text on dark and wrong for dark text on light, where it thins the strokes. Default rendering on a light ground.

---

## 4. Spacing

Unchanged from v1. One scale; values not on it are bugs.

| Token | Value | Use |
|---|---|---|
| `--sp-1` | 4px | Icon-to-label gaps, tag padding |
| `--sp-2` | 8px | Inline gaps, tight stacks |
| `--sp-3` | 12px | Card-internal gaps |
| `--sp-4` | 16px | Paragraph rhythm, default gap |
| `--sp-5` | 24px | Card padding, grid gaps |
| `--sp-6` | 32px | Heading → content |
| `--sp-7` | 48px | Sub-block separation |
| `--sp-8` | 64px | Block separation |
| `--sp-9` | 96px | Section padding — `clamp(64px,8vw,96px)` |
| `--sp-10` | 128px | Major narrative breaks |

The current file uses `54px` in five places and `26px`/`30px`/`18px` ad hoc. All collapse to `--sp-7` or `--sp-8`. The inline `style="padding:10px 24px …"` on `#cta` is removed; that section uses standard `.pad`.

**Light-ground note.** White needs more air than dark — a dark ground visually absorbs whitespace, a white one exposes it. Section padding sits at `--sp-9` minimum, and inverted panels get `--sp-10` internal padding so they read as deliberate blocks rather than filled boxes.

---

## 5. Layout

| Token | Value | Use |
|---|---|---|
| `--maxw` | 1180px | Page container — unchanged, already correct |
| `--maxw-text` | 680px | Any prose column, section intros |
| `--maxw-narrow` | 520px | Card copy, hero sub, showcase paragraphs |
| Gutter | 24px desktop / 20px mobile | `.wrap` horizontal padding |

**Grid rules**
- Sibling groups use `gap`, never per-element margins.
- Wide content scrolls inside its own `overflow-x:auto` container.
- Full-bleed panels use `margin-inline:calc(50% - 50vw); width:100vw` on a container with `overflow-x:clip`, **not** the current `left:50%;transform:translateX(-50%)` hack. This lets `body{overflow-x:hidden}` be removed, which currently masks a real overflow and risks breaking `position:sticky`.

**Section rhythm.** With a white ground the page needs a visible alternation or it becomes an undifferentiated scroll. Sections alternate strictly:

| # | Section | Ground |
|---|---|---|
| 1 | `#top` hero | white |
| 2 | `#problem` | **band** |
| 3 | `#process` | white |
| 4 | `#results` | **band** |
| 5 | `#tech` | white |
| 6 | `#growth` | **band** |
| 7 | `#intelligence` | white — so the inverted dashboard and pipeline mockups inside it read at full strength |
| 8 | `#why` | **band** |
| 9 | `#cta` | white, containing the inverted panel |

The band is applied with a `.band` utility whose `::before` goes full-bleed via `margin-inline:calc(50% - 50vw)`, plus a hairline top and bottom rule. The rule is what makes the boundary land: the two grounds are deliberately close in value, so the line does the work the colour cannot.

Two inverted panels maximum. A third stops being emphasis. Currently there is one full inverted section — the final CTA — plus the two inverted mockups inside `#intelligence`.

**This was the single largest miss of the first implementation pass.** The rhythm was specified here but no task applied it, so nine sections shipped as three perceived zones: five consecutive white sections, one merged band where `.web-show + .web-show` deliberately removed the divider between `#growth` and `#intelligence`, then two more white. Compounding it, `--bg-2` was too light to see. Both are fixed.

**Breakpoints** — unchanged: `1000px` grids collapse and the hero morph disables; `760px` mobile layout and the nav collapses to a menu.

---

## 6. Radius

Three values plus a pill. Replaces the thirteen currently in use.

| Token | Value | Use |
|---|---|---|
| `--r-sm` | 6px | Tags, chips, inputs, small icon wells, mockup blocks |
| `--r-md` | 12px | All cards, buttons, icon containers, mockup frames |
| `--r-lg` | 20px | Inverted panels, CTA band |
| `--r-pill` | 999px | Eyebrows, status pills, progress bars only |

---

## 7. Elevation

On a light ground, borders separate and shadows float. Most things do not float.

| Token | Value | Use |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(17,19,21,.06)` | Cards sitting on `--bg-2` |
| `--shadow-md` | `0 1px 2px rgba(17,19,21,.06), 0 12px 28px -16px rgba(17,19,21,.18)` | Mockups, mobile menu overlay, sticky nav when scrolled |

Cards on white use **border only, no shadow**. Cards on `--bg-2` use border plus `--shadow-sm`. The old `0 24px 60px -24px rgba(2,6,20,.85)` was calibrated for a dark ground and reads as a cheap drop shadow on white.

---

## 8. Components

### 8.1 Buttons

All variants: `--fs-small` (15px), UI 600, `padding:13px 22px`, `--r-md`, **min-height 44px**, `--t-fast` transitions.

| Variant | Fill | Text | Border | Hover |
|---|---|---|---|---|
| **Primary** | `--ink` | `--bg` | none | `#000` + `translateY(-2px)` |
| **Secondary** | `--bg` | `--ink` | `1px --line-strong` | `background:--bg-2` + `translateY(-2px)` |
| **Ghost** | none | `--muted` | none | `color:--ink`, arrow nudges 3px |
| **Primary on panel** | `--on-panel` | `--panel` | none | `#FFF` + `translateY(-2px)` |

**Focus is mandatory on all variants** — audit finding P0-8:
```css
.btn:focus-visible,
.nav-links a:focus-visible,
.foot-col a:focus-visible,
a.card:focus-visible{
  outline:2px solid var(--focus);
  outline-offset:2px;
}
.panel :focus-visible{outline-color:var(--focus-invert)}
```
No gradient fills anywhere.

### 8.2 Cards

| Property | On white | On `--bg-2` | Inside a panel |
|---|---|---|---|
| Background | `--bg` | `--surface` | `--panel-2` |
| Border | `1px --line` | `1px --line` | `1px --line-invert` |
| Radius | `--r-md` | `--r-md` | `--r-md` |
| Padding | `--sp-5` | `--sp-5` | `--sp-5` |
| Shadow | none | `--shadow-sm` | none |
| Hover | `translateY(-2px)` + border → `--line-strong` | same | border → `rgba(247,247,245,.28)` |

**Hover applies only to cards that are links.** `.tech-item`, `.prob`, `.res`, `.why` lose their hover entirely — none are links. This is what restores meaning to the hover state on the cards that *are* clickable.

### 8.3 Eyebrow

```
--r-pill · padding 7px 14px · 1px --accent-line
background --accent-soft · color --accent
--fs-label · uppercase · +0.12em · mono
6px dot in --accent, no glow
```
Inside a panel: `--accent-on-panel` on `rgba(247,247,245,.06)`.

### 8.4 Icon container

```
40px or 48px square · --r-md
background --accent-soft · 1px --line
icon 22px · stroke --accent · stroke-width 2
```
One treatment, replacing the current five (`.s-icon`, `.pic`, `.wic`, `.fl-icon`, `.dk`), each of which had its own gradient and border colour.

### 8.5 Stat

```
value   --fs-h3 · UI 700 · --ink · tabular-nums
label   --fs-micro · --muted-2
```
Flat `--ink`, never gradient-clipped. Inside a panel, `--on-panel`.

### 8.6 Inverted panel

The direction's signature component.

```
background --panel · --r-lg
padding --sp-10 (128px) desktop, --sp-8 mobile
full-bleed via margin-inline:calc(50% - 50vw)
all text tokens swap to the on-panel set
accent swaps to --accent-on-panel
focus ring swaps to --focus-invert
```
Used for: the dashboard/automation showcase, and the final CTA. Two maximum.

---

## 9. Motion

Unchanged from v1 except where a light ground changes the effect.

### 9.1 Tokens

| Token | Value | Use |
|---|---|---|
| `--t-fast` | 120ms | Hover, focus, colour |
| `--t-base` | 240ms | State changes, layout shifts |
| `--t-reveal` | 450ms | Scroll entry |
| `--t-data` | 800ms | Chart bars, funnel widths |
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` | Entry, reveal |
| `--ease` | `cubic-bezier(.4,0,.2,1)` | State change |

### 9.2 Rules

**Reveal.** `opacity 0→1` + `translateY(16px→0)`, `--t-reveal`, stagger `60ms`, capped at `180ms`. Replaces 800ms/26px/320ms, which meant the fourth card in a row finished 1.12s after entry.

**Hover.** `translateY(-2px)`, `--t-fast`. One value, replacing six.

**Counters.** 900ms, cubic ease-out, only on numbers that mean something. The count-up on "5 services" is removed.

**Data motion keeps its full budget** — chart bars, funnel widths, KPI reveals, browser build, pipeline flow. Mockup sequences compress to ≤1.2s total.

**Ambient: none.** On a dark ground the budget was "at most one glow". On white there is nothing to glow — the ambient layer is deleted outright rather than reduced.

### 9.3 Removed

| Element | Was | Why |
|---|---|---|
| `.glow-chip` ×7 | `cardFloat` 8s infinite + `backdrop-filter` | Decorative; and blurred glows do not exist on white |
| `.scroll-path-layer` ×3 | Fixed bezier travel across the page | Decorative, desktop-only, competes with content |
| `.service-card` float | `cardFloat` 7s infinite | Reads as a toy |
| `.glow-orb` ×8 | `float` + 50–70px blur + JS parallax | Meaningless on a white ground; was the mobile GPU budget |
| `riseLine`/`riseDot` | 3s infinite micro-wiggle | Marginal |
| `.fl-arrow` wiggle | Horizontal arrow bobbing vertically | Semantically wrong |
| `.grid-lines` | Fixed 64px overlay at `opacity:.5` | Template signal; illegible on white |
| Hero pin excess | `270vh` stage, morph completes at `100vh` | ~70vh of dead pinned scroll → `130vh`, progress ÷ `innerHeight*0.75` |

Thirteen infinite loops become **zero**.

### 9.4 Reduced motion

```css
@media(prefers-reduced-motion:reduce){
  *{animation:none!important}
  *{transition-duration:var(--t-fast)!important}
  .reveal,.card-reveal{opacity:1!important;transform:none!important}
  html{scroll-behavior:auto}
}
```
Positional motion goes. Colour and opacity feedback stays — the current blanket rule kills hover and focus feedback, which vestibular-sensitive users still need.

---

## 10. Mockup treatment

The four hand-built mockups (browser build, search ranking, KPI dashboard, pipeline flow) were designed for a dark ground and need rebuilding, not recolouring.

| Mockup | v1 (dark) | v2 (light) |
|---|---|---|
| Browser build | Dark chrome on dark page — low separation | **White chrome, `--line` border, `--shadow-md`.** Reads as a real browser window because real browser chrome is light. |
| Search ranking | Dark card overlapping the browser | Same, on `--surface` with `--shadow-md`. The "you are #1" row keeps `--good` at 6.44 : 1. |
| KPI dashboard | Dark card on dark page | **Inverted `--panel`.** A black dashboard on a white page reads as a product screenshot — the single biggest credibility gain available from this direction. |
| Pipeline flow | Dark card on dark page | **Inverted `--panel`**, same section as the dashboard. |

The dashboard and pipeline sitting inside one inverted panel is also what supplies the section rhythm in §5.

---

## 11. Accessibility floor

Non-negotiable. Every item is a ship blocker.

- All text/background pairs at **AA or better**, measured — including inside inverted panels, which are a separate contrast context.
- **`:focus-visible`** on every interactive element, using `--focus` on white and `--focus-invert` on panels.
- **`<main>`** plus a skip-to-content link as the first focusable element.
- **`aria-hidden="true"`** on every decorative SVG.
- **`aria-labelledby`** on each `<section>`.
- **Touch targets ≥ 44×44px.** Current `.nav-toggle` is 42px; footer links are ~22px tall.
- **Real `<button>`** for the mobile menu, with `aria-expanded`. The current element is an `<a>` pointing at WhatsApp sitting in the hamburger position.
- **`color-scheme:light`** declared, so form controls and scrollbars render correctly.

---

## 12. Performance floor

- **No raster images** except the OG card and the founder photo.
- **Scroll handlers read `scrollY` only.** All rect and range measurements cached on load and resize. The current loop forces ~11 synchronous reflows per frame, including two `document.createRange()` text measurements re-run 60×/second on text that never changes.
- **Zero `backdrop-filter`.** The sticky nav uses an opaque `--bg` with a border when scrolled, which is cheaper and looks better on white than a blur.
- **Zero `filter:blur()`.** The eight blurred orbs are gone.
- **Three font weights per family, maximum.**
- **No third-party script without a real ID.**

A white ground with no blur, no backdrop-filter and no infinite animation is materially cheaper to render than what exists now — this direction is a performance win as well as a positioning one.

---

## 13. Migration map

| Old | New | Note |
|---|---|---|
| `--bg:#070b16` | `--bg:#FFFFFF` | |
| `--bg-2:#0a0f1f` | `--bg-2:#F7F7F5` | |
| `--surface:#0e1426` | `--surface:#FFFFFF` / `--panel:#111315` | Split — most cards go white, mockups invert |
| `--surface-2:#121a30` | `--surface-sunken:#F2F2EF` | Was dead — declared, never used |
| `--line:rgba(148,163,184,.14)` | `--line:#E4E4E0` | Solid, not alpha — cleaner on white |
| `--text:#eef2fb` | `--ink:#111315` | |
| `--muted:#9aa6c2` | `--muted:#555B63` | |
| `--muted-2:#6b7794` | `--muted-2:#676D75` | **Was 4.40 : 1 — AA failure.** Measured at baseline as 4.39 : 1. |
| `--accent:#4f7dff` | `--accent:#A94F26` | Rust |
| `--accent-2:#8b5cf6` | *removed* | |
| `--accent-3:#22d3ee` | *removed* | |
| `--good:#34d399` | `--good:#1F6B4A` | |
| `--warn:#fbbf24` | `--warn:#8A5A0B` | |
| `--radius:16px` | `--r-md:12px` | |
| `--radius-lg:24px` | `--r-lg:20px` | |
| `--shadow` | `--shadow-sm` / `--shadow-md` | Recalibrated for a light ground |
| `--ease` | `--ease-out` / `--ease` | Split into entry vs state |

---

## 14. Open items

### 14.1 Design decisions

None outstanding. Positioning, ground, accent, type, scale and motion are all settled.

### 14.2 Facts deferred — ship as sentinels

The build proceeds without these. Nothing is invented: each ships as a `data-sentinel` marked element that is visually obvious in a browser and greppable in the source, so nothing placeholder can reach production unnoticed.

```html
<span data-sentinel="founder-name">FOUNDER_NAME</span>
```

```css
[data-sentinel]{
  outline:2px dashed var(--warn);
  outline-offset:2px;
  background:rgba(138,90,11,.08);
}
```

A pre-launch check is `grep -c 'data-sentinel' index.html` — it must return 0 before go-live.

| # | Needed | Blocks | Sentinel |
|---|---|---|---|
| 1 | Real domain email | P0-1 | `hello@dayaminsights.com` — assumed, needs mailbox created |
| 2 | Founder name, role, one-paragraph bio, photo, LinkedIn URL | P1-3 | `FOUNDER_NAME` / `FOUNDER_BIO` / `FOUNDER_LINKEDIN` |
| 3 | City + state | P0-7, hero qualifier | `CITY, STATE` |
| 4 | Display phone number | P0-5 | `+91 78776 40693` — from the existing `wa.me` link, confirm it is public |
| 5 | GA4 Measurement ID | P0-7 | `G-XXXXXXXXXX` — block is removed if none supplied |
| 6 | Form endpoint | P0-5 | `FORM_ENDPOINT` |
| 7 | Booking link | P0-5, P1-1 | Omitted if none — form + WhatsApp carry it |
| 8 | Revenue band for the hero qualifier | P0-4 | `₹1–20 crore` — assumed, confirm |
| 9 | Which four numeric claims you can defend, with baselines | P1-4 | The other ten are cut |

---

## 15. Out of scope

Deferred deliberately:

- Service pages (`/dashboards`, `/automation`, `/websites`). Section ordering and naming in the P1 pass are structured so the split does not require a rewrite.
- A real named case study. `#results` is relabelled honestly in the meantime; the layout accepts one when it exists.
- Dark theme. This page commits to a single light visual world. Every colour is painted explicitly, `color-scheme:light` is declared, and nothing borrows from a host ground.
