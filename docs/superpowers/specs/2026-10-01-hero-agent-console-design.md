# Hero agent console — design

Date: 2026-10-01
Status: awaiting review
Scope: the homepage hero (`index.html#top`). The right-hand `.hero-system` index is replaced by a live console for the existing site chatbot, with an animated "signal field" that reacts while the agent thinks and answers, and optional spoken replies through the browser's own voices. The Worker (`chat-worker/`) does not change.

## Why

The owner found the hero dull. The site sells AI chatbots and already runs one (`assets/js/chat.js` → Cloudflare Worker), but on the homepage it lives in a corner launcher and a header button. Putting the agent in the hero makes the first thing a visitor sees the product working: they ask about their own business and get an answer in seconds. The animated field gives it the "Jarvis" presence the owner asked for, without leaving the brand: it is made of the logo's square, on a navy panel, in the service colours.

## Decisions taken (owner, 2026-10-01)

| Question | Decision |
|---|---|
| Visual direction | **Signal field**: a grid of small squares; the centre breathes, and every word of a reply sends a ring out from it. Chosen over a rotating "square reactor" and over the logo itself as the face. |
| Voice | **Browser speech (`speechSynthesis`)**, $0. Preferred voices: Google UK English Female / Google US English for English, Google हिन्दी for Hindi. OpenAI TTS (~0.5¢ a reply) was heard and declined. |
| Voice default | **Opt-in.** A speaker toggle, off on arrival. |
| Relation to the existing chat | **One conversation, two views.** Hero and panel share the session; the hero shows the latest exchange only. |
| The `.hero-system` index | **Removed.** Routing is covered by the nav, `#value` below the hero and the agent's own page cards. |
| Hero colour | **Light hero, navy console** (the console is a navy panel like the site's other mocks). `#about` stays the page's navy band. |
| Phone layout | **Console first**, headline and the rest below it. |
| Desktop layout | **Side by side**: copy left, console right, as today's hero. |

## 1. What the visitor sees

### Desktop (≥1001px; the hero goes single-column at `max-width:1000px`)
Left column unchanged: the h1 (three masked lines), the hero paragraph, "Tell us what you need" + "See where we add value", the audience line and sector row. The h1 and paragraph text are not edited (SEO guardrail in `PROJECT_NOTES.md`).

Right column, the console, top to bottom:

1. **Stage** (~300px tall): the signal field on canvas, with a status line top-left: a 7px square and one of *Listening* / *Reading your question* / *Answering*.
2. **Answer area**: before any question, one dim line, *Ask about your own business: orders, stock, enquiries, reports.* After a question: the question small and dim, the reply streaming under it, the agent's page card (if it sends one), and from the second turn a *See full conversation* link. About seven lines show; the area scrolls inside and keeps the newest text in view.
3. **Starter questions**: four chips, one per service. They hide once the visitor has asked anything in this session.
   - We re-type every order into Tally (automation)
   - I can't see sales and stock in one place (dashboards)
   - Customers ask the same questions all day (chatbot)
   - Our site gets visits, not enquiries (websites)
4. **Input row**: text input (placeholder *What's slowing your business down?*), speaker toggle, send button (the blue square with an arrow).

### Phone and tablet (≤1000px, single column)
The console comes first, directly under the nav; the h1 follows it. Field 240px tall on phone widths (<600px). Chips sit in one row that scrolls sideways (the cut-off chip signals it). Placeholder shortens to *Ask about your business* under 600px. Input text stays 16px so iOS does not zoom. No horizontal page scroll at 390px.

### The field
- Grid of squares, 20px pitch, fading out toward the stage edges. Squares are drawn in muted grey-blue at rest and in the current colour where lit.
- **Idle**: the centre breathes slowly; a faint ring goes out every ~3 s.
- **Thinking** (question sent, no text yet): a sweep beam turns around the centre.
- **Answering**: each streamed text delta sends a ring out; with voice on, each spoken word boundary does instead, so motion stays in step with the voice.
- **Colour**: the brand blue until the agent sends a page card, then the colour of that card's service (`CARDS[page].svc` in `chat.js`): saffron `#FF9A1F` for automation and the chatbot, blue `#1E7BFF` for dashboards, green `#16B364` for websites, blue for pages with no service. The colour holds until the next question.

### Voice
- Speaker toggle, `aria-pressed`, label *Read replies aloud*. Off on arrival; the choice is kept in `sessionStorage` for the visit.
- When on, replies are read **one sentence per utterance** as sentences complete in the stream. This avoids Chrome cutting long Google-voice utterances off at ~15 s and lets speech start before the reply finishes.
- Markdown symbols and URLs are stripped before speaking; card text is not spoken.
- **Voice choice per reply language** (detected from the text's script: Devanagari → Hindi, Arabic script → Arabic, otherwise English; Hinglish in Latin script is read with the English voice):
  - English: *Google UK English Female* → *Google US English* → any voice with "Natural" in its name and an `en` lang → any `en` voice.
  - Hindi: *Google हिन्दी* → any `hi` voice.
  - Arabic: any `ar` voice.
  - No match: the reply stays text-only.
- A new question, or switching the toggle off, calls `speechSynthesis.cancel()` and clears the queue.

### One conversation
The hero, the header button and the corner launcher all drive the same chat session. On the homepage, while the console is on screen:
- the header *Talk to our AI agent* button focuses the hero input instead of opening the panel;
- the page nudge is held back;
- on phones the launcher stays tucked (`.dc-tucked`; `watchPage()` in `chat.js` already observes `.hero-stage`, which now holds the console, so this needs no change).

Once the console scrolls out of view, all three behave as they do today, and the panel holds the whole conversation, including what was asked in the hero.

A returning visitor (session already has a conversation) sees the latest question and reply in the hero rather than the empty prompt.

## 2. How it is built

### Files

| File | Change |
|---|---|
| `assets/js/chat.js` | Adds `window.DayamChat`: `send(text)`, `on(listener)`, `open()`, `md(text)`, `cardNode(card)`, `last()`, `busy()`, and `setHero(api)` for the homepage behaviour above. `send()` keeps its current behaviour (panel log, history, `sig`, leads, failures) and additionally broadcasts each step to listeners. |
| `assets/js/hero.js` (new) | Loaded on `index.html` only. Three sections: **Field** (canvas renderer, states, rings, colour), **Console** (chips, input, latest-exchange view, full-conversation link), **Voice** (voice choice, sentence queue, boundary pulses). |
| `index.html` | `.hero-stage` content replaced by the console markup, shipped `hidden`. `hero.js` script tag with a version query like the other assets. |
| `assets/css/site.css` | Console styles; console-first order in the single-column hero; `.hero-system` / `.hs-*` rules deleted. |
| `assets/js/site.js` | `hsWalk` deleted. |
| `PROJECT_NOTES.md` | Hero section and `index.html` page notes rewritten. |

### Broadcasts from `chat.js`

| Event | Payload | Hero does |
|---|---|---|
| `turn` | `{ text }` | Shows the question, clears the answer, status *Reading your question*, sweep beam, cancels speech. |
| `delta` | `{ delta, text }` (`text` = reply so far) | Renders `md(text)`, ring (voice off), queues completed sentences for voice. |
| `card` | `{ card, svc }` | Appends `cardNode(card)`, sets field colour from `svc`. |
| `done` | `{}` | Status *Listening*, re-enables send, flushes any last sentence to voice. |
| `error` | `{ code, text }` | Shows the panel's failure message and WhatsApp card, puts `text` back in the input, status *Listening*. |

These map one-to-one onto the Worker's existing SSE events (`text`, `card`, `done`, `error`); `lead` is not broadcast (the hero has nothing to show for it).

### Status wording
*Listening* (idle), *Reading your question* (sent, nothing back yet), *Answering* (text arriving or voice speaking).

## 3. Edge cases

| Situation | Behaviour |
|---|---|
| Worker down, rate-limited, or stalls (20 s, existing `STALL_MS`) | Same message and WhatsApp card as the panel; the question returns to the input; field idle. |
| `chat.js` off (empty `ENDPOINT`), no `fetch`, or no JS | Console stays `hidden`; the hero is the copy column alone. |
| Send while a reply streams | Disabled until `done`, as in the panel. |
| Message sent from the panel while the hero is visible | The hero shows it too. |
| Long reply, or the agent asking for contact details | Answer area scrolls inside; newest text in view; full-conversation link from turn two. |
| `prefers-reduced-motion` | One still frame of the field; no rings or sweep; status text still changes; voice unaffected. |
| Console off screen | Canvas loop paused by IntersectionObserver. |
| Tab hidden | rAF stops on its own; speech continues. |

### Accessibility
Answer area `aria-live="polite"`; canvas `aria-hidden="true"`; chips and the speaker toggle are `<button>`s; visible focus on every control; the input has an accessible name (*Ask our AI agent*).

## 4. Testing

New `tools/checks/hero.js` (Playwright, preview server on :8090, Worker mocked with SSE routes as in `chat-shots.js`):

1. A chip sends: question shown, streamed text rendered, status goes *Reading* → *Answering* → *Listening*.
2. A `card` event shows the card and sets the field colour to the service colour.
3. The panel log holds the same exchange; *See full conversation* opens it.
4. An `error` event shows the failure message and WhatsApp card; the input has the question back.
5. Voice toggle off on load; when on, `speechSynthesis.speak` (stubbed) is called once per sentence; a new question cancels.
6. Reduced motion: no animation frames after the first draw.
7. 390px: console above the h1, no horizontal scroll, chip row scrolls.
8. JS off: console hidden, hero lays out.

`tools/checks/chat.js` and `tools/checks/site.js` must still pass. Desktop and phone screenshots go to `tmp/` for a visual pass.

## Out of scope
Speech input (mic), paid TTS, a navy hero, any Worker change, the console on pages other than the homepage.
