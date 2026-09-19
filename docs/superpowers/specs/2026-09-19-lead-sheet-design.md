# Lead sheet — design

Date: 2026-09-19
Status: approved by the owner in conversation
Builds on: `2026-09-19-site-chatbot-design.md`

## What and why

Every lead the website produces gets one row in a Google Sheet in the owner's own Google account (dayaminsights@gmail.com), so there is a single record of who came in, from where, and what they needed. Two sources:

- **contact-form submissions**, from the five pages that have a form;
- **chatbot leads**, whenever the bot calls `capture_lead`.

Out of scope (owner's choice): chatbot conversations where nobody left details.

Email through FormSubmit stays exactly as it is and remains the primary copy. The Sheet is a record alongside it.

The conversation of a chatbot lead is stored as JSON in its row. It is built from the history the Worker already holds, so there is no extra model call and no added AI cost.

## Architecture (owner chose option A)

```
contact form ─(site.js, copy)─▶ Worker POST /lead ─┐
chatbot capture_lead ─(Worker, background)─────────┴─▶ Apps Script web app (secret) ─▶ Sheet "Leads"
```

- **Apps Script** (`chat-worker/sheet/Code.gs`). The owner pastes it into the Sheet's script editor and deploys it as a web app.
  - `doPost` checks the shared secret, takes a script lock, and appends one row.
  - Any value starting with `=`, `+`, `-` or `@` is prefixed with `'`, so a visitor cannot plant a formula.
  - It writes the header row itself if the tab is empty.
- **Worker secrets** `SHEET_URL` (the web app URL) and `SHEET_TOKEN` (the shared secret).
  - Neither ever appears in page code.
  - If `SHEET_URL` is unset, every Sheet write is skipped, so the Worker behaves exactly as before setup.
- **`POST /lead`** (Worker) takes a contact-form copy.
  - Same origin allowlist and per-IP rate limiter as `/chat`.
  - Body is JSON, sent as `text/plain` so the browser skips a preflight.
  - Every field is cut to 2,000 characters; unknown fields are dropped.
  - It forwards in the background and answers `204` straight away.
- **Chatbot leads.** When `capture_lead` runs, the Worker builds the row from the lead plus the conversation so far and writes it in the background (`waitUntil`). The visitor's reply is not delayed.
  - A second `capture_lead` in the same conversation is marked `Chatbot update`.
- **`site.js`.** On a contact-form submit, before the FormSubmit request, it sends the copy with `fetch(..., {keepalive: true})`. The copy survives the native-POST fallback navigating away, and its failure is ignored.

## The row

Tab `Leads`, header row:

`Received | Source | Page | Name | Phone | Email | Business | Website | Systems | Need | Message | Readiness | Sector | Country | City | Preferred call time | Pages suggested | Conversation (JSON)`

- **Received**: written by Apps Script in Asia/Kolkata.
- **Source**: `Contact form`, `Chatbot` or `Chatbot update`.
- **Contact form**: Need = the "What do you need?" choice (`intent`), Message = `message`, and Email, Website and Systems when that page's form has them. The chatbot-only columns stay empty.
- **Chatbot**: Need = `service` plus any `also`, Message = `need_summary`, plus the classification columns and the pages the bot suggested.
- **Conversation (JSON)**, chatbot rows only: a compact array in order. Page notes are stripped and tool results are skipped.
  ```json
  [{"from":"visitor","text":"…"},{"from":"assistant","text":"…"},{"from":"card","page":"dashboards"},{"from":"whatsapp"},{"from":"lead"}]
  ```

## Failure

- A Sheet write that fails (Apps Script down, wrong secret, quota) is logged in Workers Logs and otherwise ignored.
- The visitor never sees it, and the email still goes out.

## Privacy

`privacy.html`: enquiries from the contact form and from the chat are also kept in a private Google Sheet in our Google account; for chat enquiries this includes the conversation.

## Testing

- **Worker unit tests:** the conversation-to-JSON builder; `/lead` (origin, rate limit, field cutting, forwarding with the secret, skipped when unset); a `capture_lead` turn writes one row with the transcript and `Chatbot update` on the second.
- **Widget suite:** a contact-form submit sends its copy to `/lead` with the form's fields.
- **Live:** after the owner deploys the script and sets the secrets, one clearly-marked test lead is sent through `/lead`, and the owner confirms the row.
