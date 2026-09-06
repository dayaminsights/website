# The handoff ladder — design

Date: 2026-09-06
Status: awaiting review
Mockup: `mockups/ladder-handoff.html` (the approved direction)
Rejected alternatives: `mockups/ladder-directions.html` (A the Ascent, B the Track, C the Stack)

## Why this section exists

The site currently says what we build. It does not say where a client is when
they arrive, or how far the work goes after the first project. The ladder says
both, and it answers a question the site has never answered: **why would anyone
buy the top of the range?**

The answer is that nobody does. A Create-stage owner cannot picture Elevate;
describing it to them reads as another company's brochure. So the section is
not built to sell Elevate. It is built to do three things:

1. **Let a visitor recognise themselves.** "You built it. It already works."
   An owner reads that and thinks *that is us*. Self-diagnosis, not a pitch.
2. **Establish that the rungs are sequential.** This is the competitive
   argument and it is honest: *you cannot skip a rung — an AI assistant sitting
   on five disconnected spreadsheets is just a faster way to be wrong.* It
   disqualifies anyone selling AI to an unintegrated business without naming
   a competitor.
3. **Make the ask the handoff, not the ladder.** CTA is "Hand us the rest".

Elevate earns its place as **retention, not acquisition** — the reason a client
stays past project one, and the reason we are not a one-off vendor.

## The framing: a handoff, not a diagnosis

Rung 01 is the client's own work and it is **finished**. Everything below the
handoff line is ours. That boundary is the point of the section, so it is a
full-width band with its own copy, not a border treatment.

| Rung | Owner | One line |
|---|---|---|
| 01 Create | **Yours · done** | You built it. It already works. |
| — handoff — | | Everything below this line is our work. |
| 02 Innovate | Ours | Rethink the process before automating it. |
| 03 Integrate | Ours | One number, entered once. |
| 04 Automate | Ours | The repetitive steps stop being typed. |
| 05 Accelerate | Ours | Decisions get made on today's numbers. |
| 06 Elevate | Ours | The business does what it could not before. |

**Innovate sits before Integrate deliberately**: redesign the process on paper
before wiring it up, so we do not pave a cowpath. If the intended order was
Integrate first, the copy for both rungs has to change.

Each rung opens to reveal four things: the symptom (how you know you are here),
**What we do**, **What changes**, and **Tools**.

## Tools — the open question

Tools appear as mono chips in the rung where they are used, rather than in a
decontextualised list. The current chips use **only what the site already
claims elsewhere**. Nothing was invented.

| Rung | Chips (provisional) |
|---|---|
| 01 Create | *Your business* (dashed, not a tool) |
| 02 Innovate | *No software yet — your data, your team, a whiteboard* (dashed) |
| 03 Integrate | REST APIs · Webhooks · Python & SQL · PostgreSQL · Microsoft 365 · Google Sheets |
| 04 Automate | Python · Scheduled jobs · WhatsApp · Your billing software · Email & document processing |
| 05 Accelerate | Power BI · SQL · Automated reporting · Threshold alerts |
| 06 Elevate | Claude · OpenAI · Websites & landing pages · Your own cloud |

**`TOOLS_STACK` — needs the founder's real list before launch.** Specifically
unknown: what automation actually runs on (n8n / Make / Zapier / custom
Python), and whether WhatsApp integration is the Business API or manual. Ship
the section with these provisional chips only if they are confirmed accurate;
otherwise mark them with a `data-sentinel` like the rest of the page.

Keep Innovate's "no software yet" chip whatever else changes. It is the most
credible line in the section because it proves the site's existing claim that
we do not start with technology.

## Placement and what it replaces

Insert directly after `#problem`. That section lists four symptoms; the ladder
is the sequence out of them.

- **`#tech` is removed.** Its tool lists move into the rungs. Its trust line
  survives as a strip under the ladder: *runs in cloud accounts you own ·
  backed up daily · you keep the logins*. Nav and footer links to `#tech` must
  be repointed or dropped.
- **`#process` stays, re-titled.** Discover → Prioritise → Build → Improve
  answers "what happens after I sign", which the ladder does not. Its `<h2>`
  and eyebrow change to **"How an engagement runs"** so two sections never both
  claim "how we work". Its copy is otherwise unchanged.

Resulting order: hero → positioning → problem → **ladder** → dashboards →
automation/AI → websites → mid-CTA → work → how an engagement runs → about →
FAQ → CTA.

Net page height should stay roughly flat: the ladder adds ~1,690px desktop,
`#tech` removes ~900px, so expect ~+800px against a page currently 12,257px at
1440. Acceptable; re-measure after implementation.

## Markup and behaviour

One `<section class="pad wrap band" id="ladder" aria-labelledby="h-ladder">`.
Rungs are generated from a `RUNGS` array in the existing inline script, matching
how nothing else on the page is generated — **on reflection, build the rungs as
static HTML instead.** The page has no other client-rendered content, and static
markup keeps the copy greppable, indexable without JS, and consistent with the
rest of `index.html`. The mockup generates them only to keep the three
directions comparable.

Each rung:

```
<div class="rung" style="--w:33%">
  <button class="rung-head" aria-expanded="false" aria-controls="rung-03">…</button>
  <div class="rung-body" id="rung-03" hidden>…</div>
</div>
```

- `<button>` + `aria-expanded` + `aria-controls`, body toggled with `hidden`.
  Not `<details>`: the climb rule has to stay visible while the rung is closed,
  and `<details>` hides every non-summary child.
- Rung 02 open by default, so the section never reads as a bare list.
- JS is one delegated click handler; no library.

## Motion

Reuses the page's existing vocabulary, adds no new keyframes:

- Section head and each rung carry `.reveal` with `data-d` stagger.
- Tool chips stagger in on open, reusing the `.points li` nth-child pattern.
- The climb rule (`.rung::after`, width set per rung) is at low opacity when
  closed and full when open.
- `prefers-reduced-motion`: rungs render open-capable but unanimated; add the
  new selectors to the existing reduced-motion block.

## Responsive

Verified in the mockup at 1280 and 390: 1,687px and 1,826px tall, no horizontal
overflow, identical interaction model at both sizes because the body opens in
place rather than swapping a panel elsewhere.

- ≤860px: the one-line summary column is dropped from the head, the body grid
  collapses to one column, and the handoff band stacks.
- Tool chips wrap; the long dashed chips set `white-space:normal`.

## SEO

- The rung names and their copy are strong semantic content for "business
  automation", "system integration", "reporting automation", "AI assistants" —
  provided the rungs are static HTML (see above).
- Rung `<h3>`s sit under the section `<h2>`; heading order stays clean.
- Removing `#tech` drops no schema. Consider adding the rung list to the
  Organization `serviceType` array if the tool chips change.

## Verification

1. Tag balance, brace balance, no dead anchors, JSON-LD parses.
2. No `#tech` references left in nav, footer or mockups.
3. Ratio sweep at the established 11 viewports — no horizontal overflow, and
   re-measure total page height.
4. Keyboard: every rung reachable by Tab, toggles on Enter and Space,
   `aria-expanded` flips, focus ring visible.
5. Reduced motion: nothing animating, nothing stranded hidden.
6. With JS disabled, all rung copy is still in the DOM and readable.

## Out of scope

- A "which rung am I on?" interactive quiz. The CTA does that job for now.
- Per-rung pricing or timelines.
- Rewriting `#process` copy beyond its title and eyebrow.
