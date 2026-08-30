# Dayam Insights — Design System Specification

**Date:** 2026-08-30
**Status:** Approved direction, pending founder/contact facts
**Scope:** Token system + component specs for `index.html`. Implementation of P0/P1 audit findings follows in a separate plan.

---

## 0. Decisions that produced this spec

| Decision | Chosen | Consequence |
|---|---|---|
| Positioning | **Direction A — SME operations** | Retailers, distributors, small manufacturers. Plain language. ₹ formatting. All five services retained. WhatsApp-first contact stays. |
| Visual direction | **Reposition — warm accent on cold ground** | Navy → near-black with a green bias. Blue/violet/cyan → one burnt-amber accent. Gradient CTAs removed. |
| Proof handling | **Relabel as worked examples** | `#results` quotes deleted. Section retitled. Figures marked as modelled. |
| Implementation scope | **Design system + P0 + P1** | 16 audit findings. |

**Non-goals.** No build step. No framework. No CSS preprocessor. `index.html` stays a single self-contained file deployable to GitHub Pages. No component library — this system is expressed as CSS custom properties plus a small set of utility classes.

---

## 1. Design principles

These are the rules that resolve arguments later. When a decision is unclear, apply them in order.

1. **Restraint reads as expensive.** Every effect must justify itself. The default answer to "should this animate?" is no.
2. **One accent.** Boldness spent in one place. Everything around it stays neutral.
3. **Semantic colour is not decoration.** Green means good. Amber means attention. If they appear anywhere else, they stop meaning anything.
4. **Motion belongs to data.** Chart bars, counters, pipeline builds — these communicate. Floating chips do not.
5. **Nothing off-scale.** A font size, spacing value, or radius that is not in this document is a bug.
6. **Contrast is a constraint, not a preference.** Every text/background pair ships at AA or better. Values are recorded below, measured, not estimated.

---

## 2. Colour

### 2.1 Ground and surfaces

Near-black with a slight green bias. Not navy — navy is what every AI-era landing page uses, and the bias is what stops this reading as pure grey.

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0A0D0F` | Page ground |
| `--bg-2` | `#0E1214` | Alternating section bands, full-bleed panels |
| `--surface` | `#14181B` | Raised cards — the default card fill |
| `--surface-2` | `#1B2023` | Elevated / hover state, nested cards |
| `--surface-sunken` | `#070A0B` | Inset wells, mockup interiors, code |

**Replaces:** six ad-hoc `rgba()` card gradients (`.service-card`, `.prob`, `.res`, `.why`, `.tech-item`, `.browser-mock`). All cards now use `--surface` or `--surface-sunken`. No card gradients.

### 2.2 Lines

| Token | Value | Use |
|---|---|---|
| `--line` | `rgba(240,241,239,.09)` | Default borders, dividers, table rules |
| `--line-strong` | `rgba(240,241,239,.18)` | Emphasised borders, hover state, mockup chrome |

### 2.3 Text

| Token | Hex | Contrast on `--bg` | Use |
|---|---|---|---|
| `--text` | `#F0F1EF` | **17.01 : 1** ✓ | Headings, primary copy, stat values |
| `--text-2` | `#C7CBC8` | **11.4 : 1** ✓ | Sub-headings, emphasised body |
| `--muted` | `#9BA3A5` | **7.59 : 1** ✓ | Body copy, descriptions |
| `--muted-2` | `#798285` | **4.96 : 1** ✓ | Captions, labels, footnotes — min 11px |

`--muted-2` replaces the old `#6B7794`, which measured **4.40 : 1** and failed AA at the 11–13px sizes it was used at. This is audit finding P0-7.

### 2.4 Accent

One accent. Burnt amber. Chosen because a warm accent on a cold ground is what dark-mode consultancy sites use, and precisely no AI landing-page template does.

| Token | Hex | Contrast on `--bg` | Use |
|---|---|---|---|
| `--accent` | `#D06A40` | **5.40 : 1** ✓ | Links, eyebrows, icons, chart bars, primary button fill |
| `--accent-hover` | `#E07A4E` | 6.5 : 1 ✓ | Hover state on accent fills and text |
| `--accent-soft` | `rgba(208,106,64,.12)` | — | Tints, icon backgrounds, hover fills |
| `--accent-line` | `rgba(208,106,64,.35)` | — | Accent borders, focus rings on accent surfaces |
| `--on-accent` | `#0A0D0F` | **5.40 : 1** ✓ | Text on an accent fill |

`#D06A40` is deliberately calibrated to clear AA **both** as text on the ground and as a fill carrying near-black text. One token does both jobs, so there is no light/dark accent pair to keep in sync.

**Removed:** `--accent-2` (`#8B5CF6` violet), `--accent-3` (`#22D3EE` cyan), and every `linear-gradient(135deg, accent, accent-2)`. Gradient-clipped text is removed in all five places it appeared.

### 2.5 Semantic

Reserved. These never appear as decoration.

| Token | Hex | Contrast | Meaning |
|---|---|---|---|
| `--good` | `#4E9E7A` | **6.03 : 1** ✓ | Positive delta, completed step, "what we do" tag |
| `--warn` | `#D9AE3F` | **9.22 : 1** ✓ | Needs attention — low stock, reorder alert |

`--warn` is pulled distinctly yellow so it never reads as a second accent beside the orange. The `#problem` card icons move from `--warn` to `--muted` — they are not warnings, they are illustrations, and using `--warn` there was diluting it.

### 2.6 Focus

| Token | Hex | Use |
|---|---|---|
| `--focus` | `#8FB8FF` | Focus ring — a cool blue, deliberately the only cool hue in the system, so keyboard focus is unmistakable against the warm palette |

### 2.7 Full token block

```css
:root{
  /* ground */
  --bg:#0A0D0F;
  --bg-2:#0E1214;
  --surface:#14181B;
  --surface-2:#1B2023;
  --surface-sunken:#070A0B;

  /* lines */
  --line:rgba(240,241,239,.09);
  --line-strong:rgba(240,241,239,.18);

  /* text */
  --text:#F0F1EF;
  --text-2:#C7CBC8;
  --muted:#9BA3A5;
  --muted-2:#798285;

  /* accent */
  --accent:#D06A40;
  --accent-hover:#E07A4E;
  --accent-soft:rgba(208,106,64,.12);
  --accent-line:rgba(208,106,64,.35);
  --on-accent:#0A0D0F;

  /* semantic */
  --good:#4E9E7A;
  --warn:#D9AE3F;
  --focus:#8FB8FF;
}
```

---

## 3. Typography

### 3.1 Families

| Role | Family | Weights | Applies to |
|---|---|---|---|
| Display / UI | **Instrument Sans** | 500, 600, 700 | All headings, buttons, nav, card titles, stats, labels, any text under 15px |
| Body | **Source Serif 4** | 400, 600, 400i | Running prose only — paragraphs of two or more lines |
| Data | **IBM Plex Mono** | 400, 500 | Numbers, timings, tags, step markers, code |

**On the sans/serif split.** The approved direction specified Source Serif 4 as the body face. It is scoped here to *running prose only*, with Instrument Sans carrying all UI text and anything under 15px. Reason: a serif at 11–13px on a near-black ground, on the mid-range Android screens this audience uses, is a readability risk that a serif at 17px in a paragraph is not. This keeps the editorial differentiation exactly where it earns its place and removes it where it would cost legibility.

**Replaces:** Inter (5 weights) + JetBrains Mono (2 weights). Inter + JetBrains Mono is the most-used pairing in AI-generated interfaces and was the audit's single strongest "template" signal.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">
```

Fallback stacks are mandatory:
```css
--font-ui:'Instrument Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
--font-body:'Source Serif 4','Iowan Old Style',Georgia,serif;
--font-mono:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
```

### 3.2 Scale

Eight sizes. Replaces the eighteen hardcoded values currently in the file, five of which were on half-pixels.

| Token | Desktop | Tablet | Mobile | Line height | Tracking | Family |
|---|---|---|---|---|---|---|
| `--fs-h1` | 60px | 44px | 34px | 1.04 | −0.03em | UI 700 |
| `--fs-h2` | 40px | 34px | 28px | 1.10 | −0.022em | UI 700 |
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
- **Uppercase labels always carry `+0.12em` tracking.** Uppercase without tracking is the most common amateur typography tell.

---

## 4. Spacing

One scale. Values not on it are bugs.

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

The current file uses `54px` in five places (`.prob-grid`, `.proc-grid`, `.res-grid`, `.tech-groups`, `.why-grid` top margins) and `26px`/`30px`/`18px` ad hoc. All collapse to `--sp-7` (48) or `--sp-8` (64).

**Section padding is uniform.** The inline `style="padding:10px 24px …"` on `#cta` is removed; that section uses standard `.pad` like every other.

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
- Wide content (mockups, tables) scrolls inside its own `overflow-x:auto` container.
- Full-bleed panels use `margin-inline:calc(50% - 50vw); width:100vw` on a container with `overflow-x:clip`, **not** the current `left:50%;transform:translateX(-50%)` hack. This lets `body{overflow-x:hidden}` be removed, which currently masks a real overflow and risks breaking `position:sticky`.

**Breakpoints** — unchanged, they are correct:
- `1000px` — grids collapse to single column, hero morph disables
- `760px` — mobile layout, nav collapses to menu

---

## 6. Radius

Three values plus a pill. Replaces the thirteen currently in use.

| Token | Value | Use |
|---|---|---|
| `--r-sm` | 6px | Tags, chips, inputs, small icon wells, mockup blocks |
| `--r-md` | 12px | All cards, buttons, icon containers, mockup frames |
| `--r-lg` | 20px | CTA band, full-bleed showcase panels |
| `--r-pill` | 999px | Eyebrows, status pills, progress bars only |

---

## 7. Elevation

Two levels. Currently the file has an inconsistent model where mockups get a shadow and content cards get none.

| Token | Value | Use |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,.4)` | Raised cards |
| `--shadow-md` | `0 1px 2px rgba(0,0,0,.4), 0 12px 32px -20px rgba(0,0,0,.85)` | Mockups, CTA band, menu overlay |

Flat surfaces (`--surface-sunken`) take no shadow. Borders do the separating.

---

## 8. Components

### 8.1 Buttons

All variants: `--fs-small` (15px), UI 600, `padding:13px 22px`, `--r-md`, **min-height 44px**, `--t-fast` transitions.

| Variant | Fill | Text | Border | Hover |
|---|---|---|---|---|
| **Primary** | `--accent` | `--on-accent` | none | `--accent-hover` + `translateY(-2px)` |
| **Secondary** | transparent | `--text` | `1px --line-strong` | `background:rgba(240,241,239,.05)` + `translateY(-2px)` |
| **Ghost** | none | `--muted` | none | `color:--text`, arrow nudges 3px |

**Focus is mandatory on all three** — audit finding P0-8:
```css
.btn:focus-visible,
.nav-links a:focus-visible,
.foot-col a:focus-visible,
a.card:focus-visible{
  outline:2px solid var(--focus);
  outline-offset:2px;
}
```
No gradient fills. The `linear-gradient(135deg,var(--accent),var(--accent-2))` on `.btn-primary` is removed.

### 8.2 Cards

| Property | Raised | Flat |
|---|---|---|
| Background | `--surface` | `--surface-sunken` |
| Border | `1px --line` | `1px --line` |
| Radius | `--r-md` | `--r-md` |
| Padding | `--sp-5` (24px) | `--sp-5` |
| Shadow | `--shadow-sm` | none |
| Hover | `translateY(-2px)` + border → `--line-strong` | same |

**Hover applies only to cards that are links.** `.tech-item`, `.prob`, `.res`, `.why` are not links and lose their hover entirely — audit finding P1 / P2. This is what restores meaning to the hover state on the cards that *are* clickable.

### 8.3 Eyebrow

```
--r-pill · padding 7px 14px · 1px --line
background --accent-soft · color --accent
--fs-label · uppercase · +0.12em
6px dot in --accent, no glow
```
The `box-shadow:0 0 10px` glow on the dot is removed.

### 8.4 Icon container

```
40px or 48px square · --r-md
background --accent-soft · 1px --line
icon 22px · stroke --accent · stroke-width 2
```
One icon treatment, replacing the current five (`.s-icon`, `.pic`, `.wic`, `.fl-icon`, `.dk` variants), each of which had its own gradient and border colour.

### 8.5 Stat

```
value   --fs-h3 · UI 700 · --text · tabular-nums
label   --fs-micro · --muted-2
```
Flat `--text`, not gradient-clipped. Gradient text is removed everywhere — it was applied five ways with three different gradient directions, and it is invisible in high-contrast modes.

### 8.6 Section head

```
eyebrow          --sp-4 below
h2               --fs-h2 · balance · max-width --maxw-text
intro paragraph  --fs-body · --muted · max-width --maxw-text
                 --sp-6 below before content
```

---

## 9. Motion

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

**Reveal.** `opacity 0→1` + `translateY(16px→0)`, `--t-reveal`, stagger `60ms`, capped at `180ms` total. Replaces the current 800ms/26px/320ms, which meant the fourth card in a row finished 1.12s after entry — slow enough that a scrolling reader outran it.

**Hover.** `translateY(-2px)`, `--t-fast`. One value, replacing the current six (2px, 3px, 4px, 4px, 5px, and a 3px sideways slide).

**Counters.** 900ms, cubic ease-out. Down from 1400ms. Only on numbers that mean something — the count-up on "5 services" is removed.

**Data motion keeps its full budget.** Chart bars, funnel widths, KPI reveals, the browser build sequence and the pipeline flow are the only animations that carry information, and they get the time the decoration was using. Mockup build sequences compress to ≤1.2s total.

**Ambient: at most one.** Currently thirteen infinite loops run simultaneously.

### 9.3 Removed

| Element | Was | Why |
|---|---|---|
| `.glow-chip` ×7 | `cardFloat` 8s infinite + `backdrop-filter:blur(6px)` | Decorative, no meaning, 7 compositing layers |
| `.scroll-path-layer` ×3 | Fixed bezier travel across the whole page | Decorative, desktop-only, competes with content |
| `.service-card` float | `cardFloat` 7s infinite | Reads as a toy |
| `.glow-orb` ×7 of 8 | `float` 9–13s + 50–70px blur + JS parallax | Most expensive thing on the page for a mobile GPU |
| `riseLine`/`riseDot` | 3s infinite micro-wiggle on trend arrows | Marginal |
| `.fl-arrow` wiggle | Horizontal flow arrow bobbing vertically | Semantically wrong |
| `.grid-lines` | Fixed 64px grid overlay at `opacity:.5` | Second-strongest template signal after the gradient |
| Hero pin excess | `270vh` stage, morph completes at `100vh` | ~70vh of dead pinned scroll |

**Hero pin** becomes `height:130vh` with progress divided by `innerHeight * 0.75`, so the morph completes at 75% of the pin and the hero releases immediately after.

### 9.4 Reduced motion

The current blanket rule kills every transition including hover and focus feedback, which users with vestibular sensitivity still need.

```css
@media(prefers-reduced-motion:reduce){
  *{animation:none!important}
  *{transition-duration:var(--t-fast)!important}
  .reveal,.card-reveal{opacity:1!important;transform:none!important}
  html{scroll-behavior:auto}
}
```
Positional motion goes. Colour and opacity feedback stays.

---

## 10. Accessibility floor

Non-negotiable. Every item is a ship blocker.

- All text/background pairs at **AA or better**. Values recorded in §2 and measured, not estimated.
- **`:focus-visible`** on every interactive element, using `--focus`.
- **`<main>`** wrapping the page content, plus a skip-to-content link as the first focusable element.
- **`aria-hidden="true"`** on every decorative SVG.
- **`aria-labelledby`** on each `<section>`, pointing at its heading.
- **Touch targets ≥ 44×44px.** Current `.nav-toggle` is 42px; footer links are ~22px tall.
- **Real `<button>`** for the mobile menu toggle, with `aria-expanded`. The current element is an `<a>` pointing at WhatsApp sitting in the hamburger position.

---

## 11. Performance floor

- **No raster images** except the OG card and the founder photo. Current architecture is correct and is preserved.
- **Scroll handlers read `scrollY` only.** All `getBoundingClientRect()` and `document.createRange()` measurements are cached on load and resize. The current loop forces ~11 synchronous reflows per frame, including two text measurements re-run 60×/second on text that never changes.
- **One `backdrop-filter` on the page** — the sticky nav. The other ten come from decorative chips that are being removed.
- **Three font weights per family maximum.**
- **No third-party script without a real ID.** GA4 either carries the real Measurement ID or the block is removed.

---

## 12. Migration map

Old token → new token, for the implementation pass.

| Old | New | Note |
|---|---|---|
| `--bg:#070b16` | `--bg:#0A0D0F` | |
| `--bg-2:#0a0f1f` | `--bg-2:#0E1214` | |
| `--surface:#0e1426` | `--surface:#14181B` | |
| `--surface-2:#121a30` | `--surface-2:#1B2023` | Was dead — declared, never used |
| `--text:#eef2fb` | `--text:#F0F1EF` | |
| `--muted:#9aa6c2` | `--muted:#9BA3A5` | |
| `--muted-2:#6b7794` | `--muted-2:#798285` | **Was 4.40:1 — AA failure** |
| `--accent:#4f7dff` | `--accent:#D06A40` | |
| `--accent-2:#8b5cf6` | *removed* | All gradients using it are removed |
| `--accent-3:#22d3ee` | *removed* | Eyebrow/icon uses → `--accent` |
| `--good:#34d399` | `--good:#4E9E7A` | |
| `--warn:#fbbf24` | `--warn:#D9AE3F` | Pulled yellower to separate from the amber accent |
| `--radius:16px` | `--r-md:12px` | |
| `--radius-lg:24px` | `--r-lg:20px` | |
| `--ease` | `--ease-out` / `--ease` | Split into entry vs state |
| `--shadow` | `--shadow-md` | Plus new `--shadow-sm` |

---

## 13. Open items — facts required before implementation

These block specific P0/P1 findings. Nothing is invented; each ships as a clearly-marked sentinel until supplied.

| # | Needed | Blocks | Sentinel until supplied |
|---|---|---|---|
| 1 | Real domain email | P0-1 | `hello@dayaminsights.com` — assumed, needs mailbox created |
| 2 | Founder name, role, one-paragraph bio, photo, LinkedIn URL | P1-3 | `FOUNDER_NAME` / `FOUNDER_BIO` / `FOUNDER_LINKEDIN` |
| 3 | City + state | P0-7 (local SEO), hero qualifier | `CITY, STATE` |
| 4 | Display phone number | P0-5 | `+91 78776 40693` — taken from the existing `wa.me` link, confirm it is public |
| 5 | GA4 Measurement ID | P0-7 | `G-XXXXXXXXXX` — block is removed if none supplied |
| 6 | Form endpoint (Formspree / Netlify / Web3Forms) | P0-5 | `FORM_ENDPOINT` |
| 7 | Booking link (Cal.com / Calendly) | P0-5, P1-1 | Omitted if none — form + WhatsApp carry it |
| 8 | Revenue band for the hero qualifier | P0-4 | `₹1–20 crore` — assumed, confirm |
| 9 | Which four numeric claims you can defend, with baselines | P1-4 | The other ten are cut |

---

## 14. What this spec does not cover

Deferred to a later phase, deliberately:

- Service pages (`/dashboards`, `/automation`, `/websites`). Section ordering and naming in the P1 pass are structured so the split does not require a rewrite.
- A real named case study. The `#results` section is being relabelled honestly in the meantime; the layout is built so one can drop in.
- Light theme. This page commits to a single dark visual world. Every colour is painted explicitly so nothing borrows from a host ground.
