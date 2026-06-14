# AI Agency Pipeline — MVP Design

## Context

This spec covers a **new, separate project** — not part of the Dayam Insights static landing page in this repo. It will live in a sibling repo/folder: `C:/Users/USER/Documents/GitHub/agency-pipeline/`.

The long-term goal (from the original request) is a multi-agent "AI agency" system that autonomously finds business leads, evaluates them, researches their online presence, generates redesign concepts, and produces client-ready proposals — eventually scaling into a SaaS product.

That full system is too large for a single spec/implementation cycle. This document scopes the **first MVP slice**: a single-lead pipeline with manual lead input, proving out the orchestrator, DB, AI abstraction, and all 5 agent interfaces end-to-end. Lead generation (scraping Google Maps/Places, Instagram discovery) and reply-handling/escalation are explicitly deferred to later phases.

## Decisions Made

- **Location**: new sibling repo `agency-pipeline/`.
- **MVP scope**: single lead, manual input → full pipeline run → proposal output. No scraping-based lead sourcing yet.
- **Agent order**: Research → Score → Creative → Proposal (reordered from the original Lead→Score→Research→Creative→Proposal, because scoring needs research signals to be meaningful).
- **Backend**: Python 3.12 + FastAPI.
- **AI provider**: Claude (Anthropic) primary, behind a provider-agnostic abstraction so OpenAI can be added later.
- **Research depth**: real website fetch + screenshot via Playwright, fed to Claude (vision + text) for UX/branding evaluation. No Google Reviews / Instagram API integration yet (Phase 2).
- **Creative output**: text wireframe + copywriting + design system guidance, **plus** a generated static HTML demo landing page (via Claude).
- **Proposal output**: Markdown proposal + email draft. PDF generation deferred (trivial follow-up via pandoc/WeasyPrint once content quality is validated).
- **Queue**: Celery + Redis from day 1 (matches target architecture, avoids rework).
- **Escalation/reply-handling**: deferred entirely — no outreach is sent yet in MVP, so nothing to reply to. Future phase: inbox/reply-watcher agent.
- **Lead Generation Agent**: interface/stub only in MVP; real sourcing (Google Places/Maps, Instagram business discovery) is Phase 2.

## Architecture Overview

```
FastAPI (api service)
  POST /leads            -> create lead record
  POST /leads/{id}/run   -> create pipeline_run, enqueue Celery chain
  GET  /leads/{id}       -> lead + latest run status + all results
  GET  /pipeline-runs/{id} -> status/current_step/error for polling
  GET  /static/demos/{lead_id}.html -> generated demo page

Celery chain (worker service):
  research_task -> score_task -> creative_task -> proposal_task

Each task:
  1. Load PipelineContext (lead + prior results) from Postgres
  2. Run the corresponding Agent.run(context)
  3. Persist result row
  4. Update pipeline_runs.current_step / status
  5. On failure: retry (3x, exponential backoff); on final failure, mark run failed + store error_message

Redis: Celery broker + result backend
Postgres: all persistent state (leads, pipeline_runs, per-stage result tables)
Playwright: used inside research_task to screenshot + extract text from the lead's website
```

## Data Model (PostgreSQL via SQLAlchemy)

```
leads
  id (uuid, pk)
  business_name (str)
  website_url (str, nullable)
  location (str)
  category (str)
  social_links (jsonb)         # list of URLs
  reason_for_lead (text)
  created_at (timestamptz)

pipeline_runs
  id (uuid, pk)
  lead_id (fk -> leads.id)
  status (enum: pending|running|completed|failed)
  current_step (enum: research|score|creative|proposal|done)
  error_message (text, nullable)
  created_at, updated_at (timestamptz)

research_results
  id (uuid, pk)
  lead_id (fk -> leads.id)
  pipeline_run_id (fk -> pipeline_runs.id)
  screenshot_path (str, nullable)
  brand_tone (text)
  visual_style (text)
  pain_points (jsonb)          # list[str]
  opportunities (jsonb)        # list[str]
  sentiment_summary (text)
  raw_page_text (text)         # truncated extracted DOM text
  created_at (timestamptz)

lead_scores
  id (uuid, pk)
  lead_id (fk -> leads.id)
  pipeline_run_id (fk -> pipeline_runs.id)
  score (int, 0-100)
  priority (enum: low|medium|high)
  reasons (jsonb)               # list[str]
  created_at (timestamptz)

creative_concepts
  id (uuid, pk)
  lead_id (fk -> leads.id)
  pipeline_run_id (fk -> pipeline_runs.id)
  wireframe_text (text)
  copywriting (jsonb)            # structured: hero, sections, CTAs etc.
  design_system (jsonb)          # colors, fonts, style direction, animation ideas
  demo_html_path (str)
  created_at (timestamptz)

proposals
  id (uuid, pk)
  lead_id (fk -> leads.id)
  pipeline_run_id (fk -> pipeline_runs.id)
  proposal_markdown (text)
  email_subject (str)
  email_body (text)
  created_at (timestamptz)
```

Each pipeline run produces one row per stage table (tagged by `pipeline_run_id`), so re-running a lead creates a fresh run with full history preserved — nothing is overwritten.

## Folder Structure

```
agency-pipeline/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── pyproject.toml
├── alembic/                       # DB migrations
├── app/
│   ├── main.py                    # FastAPI app entrypoint
│   ├── config.py                  # pydantic Settings (config-driven via .env)
│   ├── db/
│   │   ├── models.py              # SQLAlchemy models (schema above)
│   │   ├── session.py
│   │   └── crud.py
│   ├── api/
│   │   ├── leads.py                # endpoints
│   │   └── schemas.py              # Pydantic request/response models
│   ├── ai/
│   │   ├── client.py               # AIClient protocol + AnthropicClient impl
│   │   └── prompts/
│   │       ├── research.py
│   │       ├── scoring.py
│   │       ├── creative.py
│   │       └── proposal.py
│   ├── agents/
│   │   ├── base.py                 # BaseAgent ABC: async run(context) -> dict
│   │   ├── lead_gen.py              # interface/stub only (Phase 2)
│   │   ├── research_agent.py
│   │   ├── scoring_agent.py
│   │   ├── creative_agent.py
│   │   └── proposal_agent.py
│   ├── orchestrator/
│   │   ├── celery_app.py
│   │   ├── tasks.py                 # one Celery task per agent step
│   │   └── pipeline.py              # chain assembly, context loading, retry/error handling
│   ├── scraping/
│   │   └── website_capture.py       # Playwright screenshot + DOM text extraction
│   └── static/demos/                 # generated demo HTML pages served from here
├── tests/
│   ├── test_agents/
│   ├── test_api/
│   └── test_orchestrator/
└── docs/
```

## API Contract (MVP)

| Method | Path | Purpose |
|---|---|---|
| POST | `/leads` | Create a lead (business_name, website, location, category, social_links, reason_for_lead) → `{lead_id}` |
| POST | `/leads/{lead_id}/run` | Create a `pipeline_runs` row, enqueue Celery chain → `{pipeline_run_id}` |
| GET | `/leads/{lead_id}` | Lead details + latest run status + all stage results if present |
| GET | `/pipeline-runs/{run_id}` | `status`, `current_step`, `error_message` (for polling) |
| GET | `/static/demos/{lead_id}.html` | Generated demo landing page |

## Agent Interface

```python
class BaseAgent(ABC):
    name: str

    @abstractmethod
    async def run(self, context: PipelineContext) -> dict:
        """Returns a dict matching this agent's output schema."""
```

`PipelineContext` holds: `lead` (ORM object), accumulated prior-stage results (typed), and a DB session. Each Celery task: loads context from Postgres → instantiates and runs the agent → persists the resulting row in the appropriate table → updates `pipeline_runs.current_step` (and `status` on the final step).

## AI Client Abstraction

```python
class AIClient(Protocol):
    async def complete(self, system: str, user: str, images: list[bytes] | None = None) -> str: ...
    async def complete_json(self, system: str, user: str, schema: type[BaseModel], images: list[bytes] | None = None) -> BaseModel: ...
```

- `AnthropicClient` is the MVP implementation (Claude, via the Anthropic SDK), supporting both text and image inputs (for the research agent's screenshot analysis).
- Provider selected via `.env` (`AI_PROVIDER=anthropic`); structure leaves room for an `OpenAIClient` later without touching agent code.
- Each agent's prompt lives in `app/ai/prompts/<agent>.py` as a template function, keeping prompt content out of agent logic.

## Per-Agent Output Schemas (Pydantic, matching original spec shapes)

```python
# ResearchOutput
{ "brand_tone": str, "visual_style": str, "pain_points": list[str],
  "opportunities": list[str], "sentiment_summary": str }

# ScoreOutput
{ "score": int, "priority": "low"|"medium"|"high", "reasons": list[str] }

# CreativeOutput
{ "wireframe_text": str, "copywriting": dict, "design_system": dict, "demo_html_path": str }

# ProposalOutput
{ "proposal_markdown": str, "email_subject": str, "email_body": str }
```

## Docker Compose Services

- `api` — FastAPI/uvicorn
- `worker` — Celery worker (same image, different command)
- `redis` — broker + result backend
- `postgres` — primary datastore

Shared Dockerfile installs Playwright + browser binaries so `worker` can run `website_capture.py`.

## Error Handling & Retries

- Celery task retry policy: 3 attempts, exponential backoff (e.g. 30s, 2m, 8m).
- On final failure: `pipeline_runs.status = failed`, `error_message` populated, chain halts (later stages not run).
- AI client and Playwright calls are wrapped with explicit error handling so a single bad response/timeout triggers task retry rather than crashing the worker.
- All agent calls and Celery task transitions logged (structured logging, e.g. `structlog` or stdlib `logging` with JSON formatter).

## Out of Scope for MVP (documented as future phases)

- **Phase 2**: Lead Generation Agent real implementation — Google Maps/Places API sourcing, business directory scraping, Instagram business discovery; batch lead ingestion.
- **Phase 2**: Research Agent extensions — Google Reviews sentiment analysis, Instagram branding/content analysis.
- **Phase 3**: PDF generation for proposals.
- **Phase 3**: Reply-handling / escalation agent — watches for replies to sent proposals/emails and escalates high-intent ones to a human.
- **Phase 3+**: SaaS-ification — multi-tenant auth, billing, frontend dashboard (Next.js + Tailwind) for managing leads/pipelines.

## Testing Strategy

- Unit tests per agent: mock `AIClient` and Playwright, assert output schema conformance and prompt construction.
- API tests: FastAPI `TestClient`, exercise `/leads` and `/leads/{id}/run` against a test Postgres (or sqlite for fast unit tests where feasible).
- Orchestrator test: run the Celery chain in eager mode (`CELERY_ALWAYS_EAGER=True`) against a seeded lead, assert all 4 result rows are created and `pipeline_runs.status == completed`.
- One end-to-end smoke test with a real (but small/cheap) Claude call against a stable test website, gated behind an env flag (skipped by default in CI unless `RUN_LIVE_AI_TESTS=1`).
