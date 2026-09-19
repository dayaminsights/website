# AI Agency Pipeline MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-lead, manually-seeded multi-agent pipeline (Research -> Score -> Creative -> Proposal) orchestrated by Celery, backed by Postgres, exposed via FastAPI, producing a Markdown proposal + email draft + static HTML demo page for one business.

**Architecture:** FastAPI app exposes `/leads` CRUD + `/leads/{id}/run`. Running a lead enqueues a Celery chain of 4 tasks (one per agent), each loading a `PipelineContext` from Postgres, calling an `AIClient` (Claude via Anthropic SDK), and persisting a result row. Research agent additionally uses Playwright to screenshot + extract text from the lead's website. Local dev/tests run without Docker via a Python venv, sqlite for fast unit tests, and `CELERY_TASK_ALWAYS_EAGER=True` for orchestrator tests; Docker Compose (Postgres + Redis + api + worker) is provided for real deployment.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0 + Alembic, Celery + Redis, PostgreSQL, Playwright, Anthropic SDK (`anthropic` package), Pydantic v2, pytest.

**New repo location:** `C:/Users/USER/Documents/GitHub/agency-pipeline/` (separate git repo from this `website` repo).

---

## Conventions for this plan

- All commands below assume PowerShell, working directory `C:/Users/USER/Documents/GitHub/agency-pipeline`.
- Python invoked via `py -3.12` for venv creation; after `.venv\Scripts\Activate.ps1` is run, `python`/`pip` resolve to the venv.
- Unit tests for agents/AI client/DB models use sqlite + mocked `AIClient` — no Docker/Postgres/Redis needed.
- Orchestrator tests use `CELERY_TASK_ALWAYS_EAGER=True` + sqlite — no real Redis needed.
- Docker Compose (Task 14) is the only place real Postgres/Redis/Playwright-in-container are required.

---

### Task 1: Repo scaffold + dependencies

**Files:**
- Create: `C:/Users/USER/Documents/GitHub/agency-pipeline/pyproject.toml`
- Create: `C:/Users/USER/Documents/GitHub/agency-pipeline/.gitignore`
- Create: `C:/Users/USER/Documents/GitHub/agency-pipeline/.env.example`
- Create: `C:/Users/USER/Documents/GitHub/agency-pipeline/app/__init__.py`
- Create: `C:/Users/USER/Documents/GitHub/agency-pipeline/README.md`

- [ ] **Step 1: Create directory structure and git repo**

```powershell
New-Item -ItemType Directory -Force -Path "C:/Users/USER/Documents/GitHub/agency-pipeline"
Set-Location "C:/Users/USER/Documents/GitHub/agency-pipeline"
git init
New-Item -ItemType Directory -Force -Path app, app/db, app/api, app/ai, app/ai/prompts, app/agents, app/orchestrator, app/scraping, app/static, app/static/demos, tests, tests/test_agents, tests/test_api, tests/test_orchestrator, alembic
```

- [ ] **Step 2: Write `pyproject.toml`**

```toml
[project]
name = "agency-pipeline"
version = "0.1.0"
description = "Multi-agent AI pipeline: research, score, design, and propose website redesigns for leads."
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "sqlalchemy>=2.0",
    "alembic>=1.13",
    "psycopg[binary]>=3.2",
    "celery>=5.4",
    "redis>=5.0",
    "pydantic>=2.8",
    "pydantic-settings>=2.4",
    "anthropic>=0.40",
    "playwright>=1.47",
    "python-dotenv>=1.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3",
    "pytest-asyncio>=0.24",
    "httpx>=0.27",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 3: Write `.gitignore`**

```
.venv/
__pycache__/
*.pyc
.env
*.db
app/static/demos/*.html
.pytest_cache/
```

- [ ] **Step 4: Write `.env.example`**

```
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-replace-me
ANTHROPIC_MODEL=claude-sonnet-4-6
DATABASE_URL=postgresql+psycopg://agency:agency@localhost:5432/agency
REDIS_URL=redis://localhost:6379/0
DEMO_STATIC_DIR=app/static/demos
```

- [ ] **Step 5: Create empty `app/__init__.py` and minimal `README.md`**

`app/__init__.py` — empty file.

`README.md`:
```markdown
# Agency Pipeline (MVP)

Single-lead AI pipeline: Research -> Score -> Creative -> Proposal.

## Local dev setup

```powershell
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
playwright install chromium
copy .env.example .env   # then fill in ANTHROPIC_API_KEY
```

## Running tests

```powershell
pytest
```

## Running the full stack (Docker)

```powershell
docker compose up --build
```
```

- [ ] **Step 6: Create venv and install dependencies**

```powershell
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
playwright install chromium
```

- [ ] **Step 7: Commit**

```powershell
git add pyproject.toml .gitignore .env.example app/__init__.py README.md
git commit -m "Scaffold agency-pipeline project structure and dependencies"
```

---

### Task 2: Config (pydantic Settings)

**Files:**
- Create: `app/config.py`
- Test: `tests/test_config.py`

- [ ] **Step 1: Write failing test**

```python
# tests/test_config.py
import os

from app.config import Settings


def test_settings_load_from_env(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    monkeypatch.setenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///test.db")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("DEMO_STATIC_DIR", "app/static/demos")

    settings = Settings()

    assert settings.ai_provider == "anthropic"
    assert settings.anthropic_api_key == "sk-test"
    assert settings.anthropic_model == "claude-sonnet-4-6"
    assert settings.database_url == "sqlite:///test.db"
    assert settings.redis_url == "redis://localhost:6379/0"
    assert settings.demo_static_dir == "app/static/demos"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_config.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.config'`

- [ ] **Step 3: Write `app/config.py`**

```python
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ai_provider: str = "anthropic"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"

    database_url: str = "postgresql+psycopg://agency:agency@localhost:5432/agency"
    redis_url: str = "redis://localhost:6379/0"

    demo_static_dir: str = "app/static/demos"


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_config.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add app/config.py tests/test_config.py
git commit -m "Add pydantic Settings for app configuration"
```

---

### Task 3: DB models (SQLAlchemy)

**Files:**
- Create: `app/db/__init__.py`
- Create: `app/db/models.py`
- Create: `app/db/session.py`
- Test: `tests/test_db_models.py`

- [ ] **Step 1: Write failing test**

```python
# tests/test_db_models.py
import uuid

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.models import (
    Base,
    Lead,
    PipelineRun,
    PipelineStatus,
    PipelineStep,
    Priority,
    ResearchResult,
    LeadScore,
    CreativeConcept,
    Proposal,
)


def test_create_lead_and_pipeline_run():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        lead = Lead(
            business_name="Joe's Pizza",
            website_url="https://joespizza.example",
            location="Mumbai, India",
            category="restaurant",
            social_links=["https://instagram.com/joespizza"],
            reason_for_lead="Outdated website, no online ordering",
        )
        session.add(lead)
        session.commit()

        run = PipelineRun(
            lead_id=lead.id,
            status=PipelineStatus.pending,
            current_step=PipelineStep.research,
        )
        session.add(run)
        session.commit()

        assert isinstance(lead.id, uuid.UUID)
        assert run.lead_id == lead.id
        assert run.status == PipelineStatus.pending


def test_stage_result_tables_link_to_lead_and_run():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        lead = Lead(
            business_name="Glow Salon",
            website_url=None,
            location="Pune, India",
            category="salon",
            social_links=[],
            reason_for_lead="No website",
        )
        session.add(lead)
        session.commit()

        run = PipelineRun(
            lead_id=lead.id,
            status=PipelineStatus.running,
            current_step=PipelineStep.research,
        )
        session.add(run)
        session.commit()

        research = ResearchResult(
            lead_id=lead.id,
            pipeline_run_id=run.id,
            screenshot_path=None,
            brand_tone="warm, friendly",
            visual_style="dated, low-contrast",
            pain_points=["no online booking", "no mobile menu"],
            opportunities=["add booking widget", "modernize palette"],
            sentiment_summary="Reviews mention great service but confusing site",
            raw_page_text="Welcome to Glow Salon...",
        )
        score = LeadScore(
            lead_id=lead.id,
            pipeline_run_id=run.id,
            score=78,
            priority=Priority.high,
            reasons=["no website", "high-value industry"],
        )
        creative = CreativeConcept(
            lead_id=lead.id,
            pipeline_run_id=run.id,
            wireframe_text="Hero -> Services -> Gallery -> Booking -> Footer",
            copywriting={"hero_headline": "Look Good. Feel Great."},
            design_system={"palette": ["#1a1a1a", "#f5e6d3"]},
            demo_html_path="app/static/demos/glow-salon.html",
        )
        proposal = Proposal(
            lead_id=lead.id,
            pipeline_run_id=run.id,
            proposal_markdown="# Proposal for Glow Salon",
            email_subject="A fresh new look for Glow Salon",
            email_body="Hi team, ...",
        )
        session.add_all([research, score, creative, proposal])
        session.commit()

        assert research.lead_id == lead.id
        assert research.pipeline_run_id == run.id
        assert score.priority == Priority.high
        assert creative.design_system["palette"][0] == "#1a1a1a"
        assert proposal.email_subject.startswith("A fresh")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_db_models.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.db.models'`

- [ ] **Step 3: Write `app/db/__init__.py`** (empty file)

- [ ] **Step 4: Write `app/db/models.py`**

```python
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator, CHAR


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class GUID(TypeDecorator):
    """Platform-independent UUID type: stores as CHAR(36) in sqlite, native UUID in Postgres."""

    impl = CHAR(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import UUID as PG_UUID

            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return str(value)
        if not isinstance(value, uuid.UUID):
            return str(uuid.UUID(value))
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(value)


class Base(DeclarativeBase):
    pass


class PipelineStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class PipelineStep(str, enum.Enum):
    research = "research"
    score = "score"
    creative = "creative"
    proposal = "proposal"
    done = "done"


class Priority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    business_name: Mapped[str] = mapped_column(String, nullable=False)
    website_url: Mapped[str | None] = mapped_column(String, nullable=True)
    location: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    social_links: Mapped[list] = mapped_column(JSON, default=list)
    reason_for_lead: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    pipeline_runs: Mapped[list["PipelineRun"]] = relationship(back_populates="lead")


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("leads.id"), nullable=False)
    status: Mapped[PipelineStatus] = mapped_column(
        Enum(PipelineStatus), default=PipelineStatus.pending
    )
    current_step: Mapped[PipelineStep] = mapped_column(
        Enum(PipelineStep), default=PipelineStep.research
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    lead: Mapped["Lead"] = relationship(back_populates="pipeline_runs")


class ResearchResult(Base):
    __tablename__ = "research_results"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("leads.id"), nullable=False)
    pipeline_run_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("pipeline_runs.id"), nullable=False
    )
    screenshot_path: Mapped[str | None] = mapped_column(String, nullable=True)
    brand_tone: Mapped[str] = mapped_column(Text, default="")
    visual_style: Mapped[str] = mapped_column(Text, default="")
    pain_points: Mapped[list] = mapped_column(JSON, default=list)
    opportunities: Mapped[list] = mapped_column(JSON, default=list)
    sentiment_summary: Mapped[str] = mapped_column(Text, default="")
    raw_page_text: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class LeadScore(Base):
    __tablename__ = "lead_scores"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("leads.id"), nullable=False)
    pipeline_run_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("pipeline_runs.id"), nullable=False
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    priority: Mapped[Priority] = mapped_column(Enum(Priority), nullable=False)
    reasons: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class CreativeConcept(Base):
    __tablename__ = "creative_concepts"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("leads.id"), nullable=False)
    pipeline_run_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("pipeline_runs.id"), nullable=False
    )
    wireframe_text: Mapped[str] = mapped_column(Text, default="")
    copywriting: Mapped[dict] = mapped_column(JSON, default=dict)
    design_system: Mapped[dict] = mapped_column(JSON, default=dict)
    demo_html_path: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Proposal(Base):
    __tablename__ = "proposals"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("leads.id"), nullable=False)
    pipeline_run_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("pipeline_runs.id"), nullable=False
    )
    proposal_markdown: Mapped[str] = mapped_column(Text, default="")
    email_subject: Mapped[str] = mapped_column(String, default="")
    email_body: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
```

- [ ] **Step 5: Write `app/db/session.py`**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings
from app.db.models import Base

_engine = None
_SessionLocal = None


def get_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
        _engine = create_engine(settings.database_url, connect_args=connect_args)
    return _engine


def get_session_factory():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=get_engine(), expire_on_commit=False)
    return _SessionLocal


def init_db() -> None:
    Base.metadata.create_all(get_engine())


def get_db() -> Session:
    factory = get_session_factory()
    db = factory()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pytest tests/test_db_models.py -v`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```powershell
git add app/db/__init__.py app/db/models.py app/db/session.py tests/test_db_models.py
git commit -m "Add SQLAlchemy models for leads, pipeline runs, and per-stage results"
```

---

### Task 4: AI client abstraction (Anthropic)

**Files:**
- Create: `app/ai/__init__.py`
- Create: `app/ai/client.py`
- Test: `tests/test_ai_client.py`

- [ ] **Step 1: Write failing test**

```python
# tests/test_ai_client.py
import json
from unittest.mock import MagicMock

import pytest
from pydantic import BaseModel

from app.ai.client import AnthropicClient


class _Output(BaseModel):
    score: int
    label: str


def test_complete_returns_text_from_first_content_block():
    fake_message = MagicMock()
    fake_message.content = [MagicMock(text="hello world")]

    fake_anthropic = MagicMock()
    fake_anthropic.messages.create.return_value = fake_message

    client = AnthropicClient(api_key="sk-test", model="claude-sonnet-4-6", sdk_client=fake_anthropic)

    result = client.complete(system="You are helpful.", user="Say hi")

    assert result == "hello world"
    fake_anthropic.messages.create.assert_called_once()
    _, kwargs = fake_anthropic.messages.create.call_args
    assert kwargs["model"] == "claude-sonnet-4-6"
    assert kwargs["system"] == "You are helpful."
    assert kwargs["messages"][0]["role"] == "user"


def test_complete_json_parses_and_validates_schema():
    payload = json.dumps({"score": 87, "label": "high"})
    fake_message = MagicMock()
    fake_message.content = [MagicMock(text=payload)]

    fake_anthropic = MagicMock()
    fake_anthropic.messages.create.return_value = fake_message

    client = AnthropicClient(api_key="sk-test", model="claude-sonnet-4-6", sdk_client=fake_anthropic)

    result = client.complete_json(system="sys", user="user", schema=_Output)

    assert isinstance(result, _Output)
    assert result.score == 87
    assert result.label == "high"


def test_complete_json_strips_markdown_code_fences():
    payload = "```json\n" + json.dumps({"score": 50, "label": "medium"}) + "\n```"
    fake_message = MagicMock()
    fake_message.content = [MagicMock(text=payload)]

    fake_anthropic = MagicMock()
    fake_anthropic.messages.create.return_value = fake_message

    client = AnthropicClient(api_key="sk-test", model="claude-sonnet-4-6", sdk_client=fake_anthropic)

    result = client.complete_json(system="sys", user="user", schema=_Output)

    assert result.score == 50


def test_complete_with_images_attaches_image_blocks():
    fake_message = MagicMock()
    fake_message.content = [MagicMock(text="ok")]

    fake_anthropic = MagicMock()
    fake_anthropic.messages.create.return_value = fake_message

    client = AnthropicClient(api_key="sk-test", model="claude-sonnet-4-6", sdk_client=fake_anthropic)

    client.complete(system="sys", user="describe this", images=[b"fake-png-bytes"])

    _, kwargs = fake_anthropic.messages.create.call_args
    content_blocks = kwargs["messages"][0]["content"]
    assert any(block["type"] == "image" for block in content_blocks)
    assert any(block["type"] == "text" for block in content_blocks)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_ai_client.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.ai.client'`

- [ ] **Step 3: Write `app/ai/__init__.py`** (empty file)

- [ ] **Step 4: Write `app/ai/client.py`**

```python
import base64
import json
import re
from typing import Protocol

import anthropic
from pydantic import BaseModel


class AIClient(Protocol):
    def complete(self, system: str, user: str, images: list[bytes] | None = None) -> str: ...

    def complete_json(
        self,
        system: str,
        user: str,
        schema: type[BaseModel],
        images: list[bytes] | None = None,
    ) -> BaseModel: ...


_CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def _strip_code_fences(text: str) -> str:
    return _CODE_FENCE_RE.sub("", text).strip()


def _build_content_blocks(user: str, images: list[bytes] | None) -> list[dict]:
    blocks: list[dict] = []
    for image_bytes in images or []:
        blocks.append(
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": base64.b64encode(image_bytes).decode("ascii"),
                },
            }
        )
    blocks.append({"type": "text", "text": user})
    return blocks


class AnthropicClient:
    def __init__(self, api_key: str, model: str, sdk_client: anthropic.Anthropic | None = None):
        self.model = model
        self._client = sdk_client or anthropic.Anthropic(api_key=api_key)

    def complete(self, system: str, user: str, images: list[bytes] | None = None) -> str:
        message = self._client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=system,
            messages=[{"role": "user", "content": _build_content_blocks(user, images)}],
        )
        return message.content[0].text

    def complete_json(
        self,
        system: str,
        user: str,
        schema: type[BaseModel],
        images: list[bytes] | None = None,
    ) -> BaseModel:
        raw = self.complete(system=system, user=user, images=images)
        cleaned = _strip_code_fences(raw)
        data = json.loads(cleaned)
        return schema.model_validate(data)


def build_ai_client(provider: str, api_key: str, model: str) -> AIClient:
    if provider == "anthropic":
        return AnthropicClient(api_key=api_key, model=model)
    raise ValueError(f"Unsupported AI provider: {provider}")
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_ai_client.py -v`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```powershell
git add app/ai/__init__.py app/ai/client.py tests/test_ai_client.py
git commit -m "Add provider-agnostic AI client with Anthropic implementation"
```

---

### Task 5: Website capture (Playwright)

**Files:**
- Create: `app/scraping/__init__.py`
- Create: `app/scraping/website_capture.py`
- Test: `tests/test_website_capture.py`

This module fetches a URL with a headless browser, saves a PNG screenshot, and extracts visible page text. It's wrapped so the Research agent can call a single function and get back `(screenshot_bytes, page_text)`.

- [ ] **Step 1: Write failing test**

```python
# tests/test_website_capture.py
from unittest.mock import MagicMock

from app.scraping.website_capture import capture_website


def test_capture_website_returns_screenshot_and_text(monkeypatch):
    fake_page = MagicMock()
    fake_page.screenshot.return_value = b"fake-png-bytes"
    fake_page.inner_text.return_value = "Welcome to Joe's Pizza. Order now!"

    fake_browser = MagicMock()
    fake_browser.new_page.return_value = fake_page

    fake_chromium = MagicMock()
    fake_chromium.launch.return_value = fake_browser

    fake_playwright_ctx = MagicMock()
    fake_playwright_ctx.chromium = fake_chromium

    fake_playwright_cm = MagicMock()
    fake_playwright_cm.__enter__.return_value = fake_playwright_ctx
    fake_playwright_cm.__exit__.return_value = None

    monkeypatch.setattr(
        "app.scraping.website_capture.sync_playwright",
        lambda: fake_playwright_cm,
    )

    screenshot_bytes, page_text = capture_website("https://joespizza.example")

    assert screenshot_bytes == b"fake-png-bytes"
    assert "Joe's Pizza" in page_text
    fake_page.goto.assert_called_once_with("https://joespizza.example", wait_until="load", timeout=30000)
    fake_browser.close.assert_called_once()


def test_capture_website_returns_none_on_navigation_error(monkeypatch):
    fake_page = MagicMock()
    fake_page.goto.side_effect = Exception("net::ERR_NAME_NOT_RESOLVED")

    fake_browser = MagicMock()
    fake_browser.new_page.return_value = fake_page

    fake_chromium = MagicMock()
    fake_chromium.launch.return_value = fake_browser

    fake_playwright_ctx = MagicMock()
    fake_playwright_ctx.chromium = fake_chromium

    fake_playwright_cm = MagicMock()
    fake_playwright_cm.__enter__.return_value = fake_playwright_ctx
    fake_playwright_cm.__exit__.return_value = None

    monkeypatch.setattr(
        "app.scraping.website_capture.sync_playwright",
        lambda: fake_playwright_cm,
    )

    screenshot_bytes, page_text = capture_website("https://does-not-exist.example")

    assert screenshot_bytes is None
    assert page_text is None
    fake_browser.close.assert_called_once()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_website_capture.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.scraping.website_capture'`

- [ ] **Step 3: Write `app/scraping/__init__.py`** (empty file)

- [ ] **Step 4: Write `app/scraping/website_capture.py`**

```python
import logging

from playwright.sync_api import sync_playwright

logger = logging.getLogger(__name__)

MAX_PAGE_TEXT_CHARS = 8000


def capture_website(url: str) -> tuple[bytes | None, str | None]:
    """Fetch `url` in a headless browser, returning (screenshot_png_bytes, visible_text).

    Returns (None, None) if the page cannot be loaded.
    """
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            page = browser.new_page()
            try:
                page.goto(url, wait_until="load", timeout=30000)
            except Exception:
                logger.warning("Failed to load %s for capture", url, exc_info=True)
                return None, None

            screenshot_bytes = page.screenshot(full_page=False)
            page_text = page.inner_text("body")[:MAX_PAGE_TEXT_CHARS]
            return screenshot_bytes, page_text
        finally:
            browser.close()
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_website_capture.py -v`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```powershell
git add app/scraping/__init__.py app/scraping/website_capture.py tests/test_website_capture.py
git commit -m "Add Playwright-based website screenshot and text capture"
```

---

### Task 6: Agent base class, pipeline context, and output schemas

**Files:**
- Create: `app/agents/__init__.py`
- Create: `app/agents/base.py`
- Create: `app/agents/schemas.py`
- Test: `tests/test_agents/test_base.py`

`PipelineContext` bundles everything an agent needs: the `Lead` row, the `AIClient`, and any prior-stage results already computed in this run. `BaseAgent` is a tiny ABC. `schemas.py` holds the Pydantic output models for all 4 agents (used by `complete_json` and by the orchestrator when persisting rows).

- [ ] **Step 1: Write failing test**

```python
# tests/test_agents/test_base.py
import pytest

from app.agents.base import BaseAgent, PipelineContext
from app.agents.schemas import ResearchOutput, ScoreOutput


class _EchoAgent(BaseAgent):
    name = "echo"

    def run(self, context: PipelineContext) -> dict:
        return {"lead_name": context.lead.business_name}


def test_pipeline_context_holds_lead_and_prior_results():
    fake_lead = type("FakeLead", (), {"business_name": "Joe's Pizza"})()
    fake_client = object()

    context = PipelineContext(lead=fake_lead, ai_client=fake_client)

    assert context.lead.business_name == "Joe's Pizza"
    assert context.research is None
    assert context.score is None


def test_base_agent_subclass_runs_and_returns_dict():
    fake_lead = type("FakeLead", (), {"business_name": "Joe's Pizza"})()
    context = PipelineContext(lead=fake_lead, ai_client=object())

    agent = _EchoAgent()
    result = agent.run(context)

    assert result == {"lead_name": "Joe's Pizza"}


def test_research_output_schema_round_trip():
    output = ResearchOutput(
        brand_tone="warm",
        visual_style="dated",
        pain_points=["no booking"],
        opportunities=["add booking"],
        sentiment_summary="mixed",
    )
    assert output.pain_points == ["no booking"]


def test_score_output_schema_validates_priority():
    output = ScoreOutput(score=80, priority="high", reasons=["no website"])
    assert output.priority == "high"

    with pytest.raises(ValueError):
        ScoreOutput(score=80, priority="urgent", reasons=[])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_agents/test_base.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.agents.base'`

- [ ] **Step 3: Write `app/agents/__init__.py`** (empty file)

- [ ] **Step 4: Write `app/agents/schemas.py`**

```python
from typing import Literal

from pydantic import BaseModel, Field


class ResearchOutput(BaseModel):
    brand_tone: str
    visual_style: str
    pain_points: list[str]
    opportunities: list[str]
    sentiment_summary: str


class ScoreOutput(BaseModel):
    score: int = Field(ge=0, le=100)
    priority: Literal["low", "medium", "high"]
    reasons: list[str]


class CreativeOutput(BaseModel):
    wireframe_text: str
    copywriting: dict
    design_system: dict
    demo_html: str


class ProposalOutput(BaseModel):
    proposal_markdown: str
    email_subject: str
    email_body: str
```

- [ ] **Step 5: Write `app/agents/base.py`**

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from app.agents.schemas import CreativeOutput, ProposalOutput, ResearchOutput, ScoreOutput


@dataclass
class PipelineContext:
    lead: Any
    ai_client: Any
    research: ResearchOutput | None = None
    score: ScoreOutput | None = None
    creative: CreativeOutput | None = None
    proposal: ProposalOutput | None = None
    extra: dict = field(default_factory=dict)


class BaseAgent(ABC):
    name: str

    @abstractmethod
    def run(self, context: PipelineContext) -> dict:
        """Execute this agent's work and return a dict matching its output schema."""
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pytest tests/test_agents/test_base.py -v`
Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```powershell
New-Item -ItemType File -Force -Path tests/test_agents/__init__.py | Out-Null
git add app/agents/__init__.py app/agents/base.py app/agents/schemas.py tests/test_agents/
git commit -m "Add BaseAgent, PipelineContext, and per-agent output schemas"
```

---

### Task 7: Research Agent

**Files:**
- Create: `app/ai/prompts/research.py`
- Create: `app/agents/research_agent.py`
- Test: `tests/test_agents/test_research_agent.py`

The Research Agent: if `lead.website_url` is set, capture a screenshot + page text via `capture_website`; build a prompt with the lead's info + page text; call `ai_client.complete_json` (with the screenshot image if available) against `ResearchOutput`. If no website or capture fails, run text-only with a prompt noting "no website available".

- [ ] **Step 1: Write failing test**

```python
# tests/test_agents/test_research_agent.py
from unittest.mock import MagicMock

from app.agents.base import PipelineContext
from app.agents.research_agent import ResearchAgent
from app.agents.schemas import ResearchOutput


def _make_lead(website_url="https://joespizza.example"):
    return type(
        "FakeLead",
        (),
        {
            "business_name": "Joe's Pizza",
            "website_url": website_url,
            "location": "Mumbai, India",
            "category": "restaurant",
            "social_links": ["https://instagram.com/joespizza"],
            "reason_for_lead": "Outdated website",
        },
    )()


def test_research_agent_uses_screenshot_when_website_available(monkeypatch):
    fake_output = ResearchOutput(
        brand_tone="casual",
        visual_style="dated, cluttered",
        pain_points=["no online menu"],
        opportunities=["add online ordering"],
        sentiment_summary="Customers love the food, hate the site",
    )
    fake_client = MagicMock()
    fake_client.complete_json.return_value = fake_output

    monkeypatch.setattr(
        "app.agents.research_agent.capture_website",
        lambda url: (b"fake-png", "Welcome to Joe's Pizza"),
    )

    context = PipelineContext(lead=_make_lead(), ai_client=fake_client)
    agent = ResearchAgent()

    result = agent.run(context)

    assert result == fake_output.model_dump()
    _, kwargs = fake_client.complete_json.call_args
    assert kwargs["images"] == [b"fake-png"]
    assert "Joe's Pizza" in kwargs["user"]
    assert kwargs["schema"] is ResearchOutput


def test_research_agent_handles_missing_website(monkeypatch):
    fake_output = ResearchOutput(
        brand_tone="unknown",
        visual_style="no website to evaluate",
        pain_points=["no website at all"],
        opportunities=["build a first website"],
        sentiment_summary="No online presence to assess",
    )
    fake_client = MagicMock()
    fake_client.complete_json.return_value = fake_output

    context = PipelineContext(lead=_make_lead(website_url=None), ai_client=fake_client)
    agent = ResearchAgent()

    result = agent.run(context)

    assert result == fake_output.model_dump()
    _, kwargs = fake_client.complete_json.call_args
    assert kwargs.get("images") in (None, [])
    assert "no website" in kwargs["user"].lower()


def test_research_agent_handles_capture_failure(monkeypatch):
    fake_output = ResearchOutput(
        brand_tone="unknown",
        visual_style="site unreachable",
        pain_points=["site appears to be down"],
        opportunities=["relaunch with a reliable host"],
        sentiment_summary="Could not load site",
    )
    fake_client = MagicMock()
    fake_client.complete_json.return_value = fake_output

    monkeypatch.setattr(
        "app.agents.research_agent.capture_website",
        lambda url: (None, None),
    )

    context = PipelineContext(lead=_make_lead(), ai_client=fake_client)
    agent = ResearchAgent()

    result = agent.run(context)

    assert result == fake_output.model_dump()
    _, kwargs = fake_client.complete_json.call_args
    assert kwargs.get("images") in (None, [])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_agents/test_research_agent.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.agents.research_agent'`

- [ ] **Step 3: Write `app/ai/prompts/research.py`**

```python
RESEARCH_SYSTEM_PROMPT = """You are a senior web design consultant analyzing a small business's \
online presence ahead of a website redesign pitch. You are direct, specific, and avoid generic \
advice. Respond with ONLY a JSON object matching the requested schema -- no prose, no markdown \
code fences."""


def build_research_prompt(
    *,
    business_name: str,
    location: str,
    category: str,
    social_links: list[str],
    reason_for_lead: str,
    website_url: str | None,
    page_text: str | None,
    has_screenshot: bool,
) -> str:
    lines = [
        f"Business name: {business_name}",
        f"Location: {location}",
        f"Category: {category}",
        f"Social links: {', '.join(social_links) if social_links else 'none provided'}",
        f"Initial lead notes: {reason_for_lead or 'none'}",
    ]

    if website_url and page_text:
        lines.append(f"Website URL: {website_url}")
        lines.append("A screenshot of the live homepage is attached." if has_screenshot else "")
        lines.append("Extracted homepage text:")
        lines.append(page_text)
    elif website_url and not page_text:
        lines.append(f"Website URL: {website_url}")
        lines.append("The website could not be loaded (likely down, broken, or unreachable).")
    else:
        lines.append("This business has no website at all.")

    lines.append("")
    lines.append(
        "Analyze the brand tone, visual style, pain points, opportunities for a redesign, "
        "and a one-sentence sentiment summary (treat lack of a website or a broken site as "
        "a major pain point and opportunity)."
    )
    lines.append(
        "Return JSON with exactly these keys: brand_tone, visual_style, pain_points "
        "(array of strings), opportunities (array of strings), sentiment_summary."
    )

    return "\n".join(line for line in lines if line)
```

- [ ] **Step 4: Write `app/agents/research_agent.py`**

```python
from app.agents.base import BaseAgent, PipelineContext
from app.agents.schemas import ResearchOutput
from app.ai.prompts.research import RESEARCH_SYSTEM_PROMPT, build_research_prompt
from app.scraping.website_capture import capture_website


class ResearchAgent(BaseAgent):
    name = "research"

    def run(self, context: PipelineContext) -> dict:
        lead = context.lead

        screenshot_bytes: bytes | None = None
        page_text: str | None = None

        if lead.website_url:
            screenshot_bytes, page_text = capture_website(lead.website_url)

        prompt = build_research_prompt(
            business_name=lead.business_name,
            location=lead.location,
            category=lead.category,
            social_links=list(lead.social_links or []),
            reason_for_lead=lead.reason_for_lead or "",
            website_url=lead.website_url,
            page_text=page_text,
            has_screenshot=screenshot_bytes is not None,
        )

        images = [screenshot_bytes] if screenshot_bytes else None

        output: ResearchOutput = context.ai_client.complete_json(
            system=RESEARCH_SYSTEM_PROMPT,
            user=prompt,
            schema=ResearchOutput,
            images=images,
        )

        result = output.model_dump()
        result["_screenshot_bytes"] = screenshot_bytes
        return result
```

Note: `_screenshot_bytes` is an internal key (not part of `ResearchOutput`) that the Celery task uses to save the screenshot to disk and populate `research_results.screenshot_path`. The orchestrator task (Task 11) pops this key before validating against `ResearchOutput`.

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_agents/test_research_agent.py -v`
Expected: PASS (3 tests)

Note: the tests above compare `result == fake_output.model_dump()`, but the implementation adds `_screenshot_bytes`. Update the test assertions to account for this key:

- [ ] **Step 5b: Fix test assertions for `_screenshot_bytes` key**

In `tests/test_agents/test_research_agent.py`, change each `assert result == fake_output.model_dump()` to:

```python
    expected = fake_output.model_dump()
    expected["_screenshot_bytes"] = result.get("_screenshot_bytes")
    assert result == expected
```

Apply this to all three test functions (replacing the single-line assertion in each). Then re-run:

Run: `pytest tests/test_agents/test_research_agent.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```powershell
git add app/ai/prompts/research.py app/agents/research_agent.py tests/test_agents/test_research_agent.py
git commit -m "Add Research Agent: website capture + Claude vision analysis"
```

---

### Task 8: Scoring Agent

**Files:**
- Create: `app/ai/prompts/scoring.py`
- Create: `app/agents/scoring_agent.py`
- Test: `tests/test_agents/test_scoring_agent.py`

The Scoring Agent runs after Research and uses `context.research` (a `ResearchOutput`) plus the lead's category/location to produce a `ScoreOutput` via `complete_json`.

- [ ] **Step 1: Write failing test**

```python
# tests/test_agents/test_scoring_agent.py
from unittest.mock import MagicMock

from app.agents.base import PipelineContext
from app.agents.scoring_agent import ScoringAgent
from app.agents.schemas import ResearchOutput, ScoreOutput


def _make_lead():
    return type(
        "FakeLead",
        (),
        {
            "business_name": "Joe's Pizza",
            "website_url": "https://joespizza.example",
            "location": "Mumbai, India",
            "category": "restaurant",
            "social_links": [],
            "reason_for_lead": "Outdated website",
        },
    )()


def test_scoring_agent_uses_research_output_in_prompt():
    research = ResearchOutput(
        brand_tone="casual",
        visual_style="dated, cluttered",
        pain_points=["no online menu", "slow site"],
        opportunities=["add online ordering"],
        sentiment_summary="Customers love the food, hate the site",
    )
    fake_score = ScoreOutput(score=82, priority="high", reasons=["no online ordering", "high-value industry"])

    fake_client = MagicMock()
    fake_client.complete_json.return_value = fake_score

    context = PipelineContext(lead=_make_lead(), ai_client=fake_client, research=research)
    agent = ScoringAgent()

    result = agent.run(context)

    assert result == fake_score.model_dump()
    _, kwargs = fake_client.complete_json.call_args
    assert kwargs["schema"] is ScoreOutput
    assert "no online menu" in kwargs["user"]
    assert "restaurant" in kwargs["user"]


def test_scoring_agent_raises_if_research_missing():
    fake_client = MagicMock()
    context = PipelineContext(lead=_make_lead(), ai_client=fake_client, research=None)
    agent = ScoringAgent()

    try:
        agent.run(context)
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "research" in str(exc).lower()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_agents/test_scoring_agent.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.agents.scoring_agent'`

- [ ] **Step 3: Write `app/ai/prompts/scoring.py`**

```python
SCORING_SYSTEM_PROMPT = """You are a lead-qualification analyst for a web design agency. Given \
research findings about a business's online presence, score how strong a redesign opportunity \
this lead is. Respond with ONLY a JSON object matching the requested schema -- no prose, no \
markdown code fences."""


def build_scoring_prompt(
    *,
    business_name: str,
    category: str,
    location: str,
    has_website: bool,
    brand_tone: str,
    visual_style: str,
    pain_points: list[str],
    opportunities: list[str],
    sentiment_summary: str,
) -> str:
    lines = [
        f"Business name: {business_name}",
        f"Category: {category}",
        f"Location: {location}",
        f"Has existing website: {'yes' if has_website else 'no'}",
        f"Brand tone: {brand_tone}",
        f"Visual style: {visual_style}",
        f"Pain points: {', '.join(pain_points) if pain_points else 'none identified'}",
        f"Opportunities: {', '.join(opportunities) if opportunities else 'none identified'}",
        f"Sentiment summary: {sentiment_summary}",
        "",
        "Score this lead from 0-100 on how strong a website-redesign opportunity it is. "
        "Consider: no website or outdated/poor UX, weak branding, negative or mixed sentiment, "
        "and whether the industry (e.g. restaurants, clinics, salons, real estate) is high-value "
        "for a redesign pitch.",
        "Assign a priority of low, medium, or high based on the score.",
        "Return JSON with exactly these keys: score (integer 0-100), priority "
        "('low'|'medium'|'high'), reasons (array of short strings explaining the score).",
    ]
    return "\n".join(lines)
```

- [ ] **Step 4: Write `app/agents/scoring_agent.py`**

```python
from app.agents.base import BaseAgent, PipelineContext
from app.agents.schemas import ScoreOutput
from app.ai.prompts.scoring import SCORING_SYSTEM_PROMPT, build_scoring_prompt


class ScoringAgent(BaseAgent):
    name = "score"

    def run(self, context: PipelineContext) -> dict:
        if context.research is None:
            raise ValueError("ScoringAgent requires context.research to be set")

        lead = context.lead
        research = context.research

        prompt = build_scoring_prompt(
            business_name=lead.business_name,
            category=lead.category,
            location=lead.location,
            has_website=bool(lead.website_url),
            brand_tone=research.brand_tone,
            visual_style=research.visual_style,
            pain_points=research.pain_points,
            opportunities=research.opportunities,
            sentiment_summary=research.sentiment_summary,
        )

        output: ScoreOutput = context.ai_client.complete_json(
            system=SCORING_SYSTEM_PROMPT,
            user=prompt,
            schema=ScoreOutput,
        )

        return output.model_dump()
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_agents/test_scoring_agent.py -v`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```powershell
git add app/ai/prompts/scoring.py app/agents/scoring_agent.py tests/test_agents/test_scoring_agent.py
git commit -m "Add Scoring Agent using research findings"
```

---

### Task 9: Creative Agent

**Files:**
- Create: `app/ai/prompts/creative.py`
- Create: `app/agents/creative_agent.py`
- Test: `tests/test_agents/test_creative_agent.py`

The Creative Agent makes two `ai_client` calls:
1. `complete_json` against `CreativeOutput`-minus-`demo_html` (wireframe, copywriting, design_system) -- actually simplest to keep `CreativeOutput` as-is and have the first call return everything except `demo_html`, then a second call generates the HTML. To keep schemas simple, this agent uses **two schemas internally**: a `_ConceptOutput` (wireframe_text, copywriting, design_system) for call 1, and a plain string (raw HTML) for call 2 via `complete`. The agent then assembles a `CreativeOutput`.

- [ ] **Step 1: Write failing test**

```python
# tests/test_agents/test_creative_agent.py
from unittest.mock import MagicMock

from app.agents.base import PipelineContext
from app.agents.creative_agent import CreativeAgent, ConceptOutput
from app.agents.schemas import ResearchOutput, ScoreOutput


def _make_lead():
    return type(
        "FakeLead",
        (),
        {
            "business_name": "Joe's Pizza",
            "website_url": "https://joespizza.example",
            "location": "Mumbai, India",
            "category": "restaurant",
            "social_links": [],
            "reason_for_lead": "Outdated website",
        },
    )()


def _make_context(fake_client):
    research = ResearchOutput(
        brand_tone="casual",
        visual_style="dated, cluttered",
        pain_points=["no online menu"],
        opportunities=["add online ordering"],
        sentiment_summary="Customers love the food, hate the site",
    )
    score = ScoreOutput(score=82, priority="high", reasons=["no online ordering"])
    return PipelineContext(lead=_make_lead(), ai_client=fake_client, research=research, score=score)


def test_creative_agent_combines_concept_and_html():
    fake_concept = ConceptOutput(
        wireframe_text="Hero -> Menu -> Gallery -> Order CTA -> Footer",
        copywriting={"hero_headline": "Mumbai's Favorite Pizza, Now Online"},
        design_system={"palette": ["#c0392b", "#fdf6e3"], "style": "warm, modern, casual"},
    )

    fake_client = MagicMock()
    fake_client.complete_json.return_value = fake_concept
    fake_client.complete.return_value = "<html><body><h1>Joe's Pizza</h1></body></html>"

    context = _make_context(fake_client)
    agent = CreativeAgent()

    result = agent.run(context)

    assert result["wireframe_text"] == fake_concept.wireframe_text
    assert result["copywriting"] == fake_concept.copywriting
    assert result["design_system"] == fake_concept.design_system
    assert "<h1>Joe's Pizza</h1>" in result["demo_html"]

    # First call: concept JSON, using research + score context
    concept_kwargs = fake_client.complete_json.call_args.kwargs
    assert concept_kwargs["schema"] is ConceptOutput
    assert "no online menu" in concept_kwargs["user"]

    # Second call: HTML generation, using the concept just produced
    html_kwargs = fake_client.complete.call_args.kwargs
    assert "Mumbai's Favorite Pizza, Now Online" in html_kwargs["user"]


def test_creative_agent_strips_markdown_fences_from_html():
    fake_concept = ConceptOutput(
        wireframe_text="Hero -> CTA",
        copywriting={"hero_headline": "Headline"},
        design_system={"palette": ["#000000"]},
    )
    fake_client = MagicMock()
    fake_client.complete_json.return_value = fake_concept
    fake_client.complete.return_value = "```html\n<html><body>Hi</body></html>\n```"

    context = _make_context(fake_client)
    agent = CreativeAgent()

    result = agent.run(context)

    assert result["demo_html"].startswith("<html>")
    assert "```" not in result["demo_html"]


def test_creative_agent_raises_if_research_or_score_missing():
    fake_client = MagicMock()
    context = PipelineContext(lead=_make_lead(), ai_client=fake_client, research=None, score=None)
    agent = CreativeAgent()

    try:
        agent.run(context)
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "research" in str(exc).lower() or "score" in str(exc).lower()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_agents/test_creative_agent.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.agents.creative_agent'`

- [ ] **Step 3: Write `app/ai/prompts/creative.py`**

```python
CREATIVE_CONCEPT_SYSTEM_PROMPT = """You are a senior web designer creating a redesign concept \
for a small business. Respond with ONLY a JSON object matching the requested schema -- no \
prose, no markdown code fences."""

CREATIVE_HTML_SYSTEM_PROMPT = """You are a senior front-end developer. Generate a single, \
self-contained HTML document (inline <style>, no external dependencies, no build step) for a \
landing page demo based on the given concept. Respond with ONLY the HTML document -- no prose, \
no markdown code fences."""


def build_concept_prompt(
    *,
    business_name: str,
    category: str,
    location: str,
    brand_tone: str,
    visual_style: str,
    pain_points: list[str],
    opportunities: list[str],
    score: int,
    priority: str,
) -> str:
    lines = [
        f"Business name: {business_name}",
        f"Category: {category}",
        f"Location: {location}",
        f"Current brand tone: {brand_tone}",
        f"Current visual style: {visual_style}",
        f"Pain points to address: {', '.join(pain_points) if pain_points else 'none'}",
        f"Opportunities to leverage: {', '.join(opportunities) if opportunities else 'none'}",
        f"Lead score: {score} (priority: {priority})",
        "",
        "Create a redesign concept for this business's website. Provide:",
        "- wireframe_text: a text-based description of the landing page structure, "
        "section by section, top to bottom",
        "- copywriting: a JSON object with keys like hero_headline, hero_subheadline, "
        "section_headlines (object mapping section name to headline), and cta_text",
        "- design_system: a JSON object with keys like palette (array of hex colors), "
        "fonts (object with heading/body), style (short description e.g. 'modern, minimal, "
        "warm'), and animation_ideas (array of short strings)",
        "",
        "Return JSON with exactly these keys: wireframe_text, copywriting, design_system.",
    ]
    return "\n".join(lines)


def build_html_prompt(
    *,
    business_name: str,
    category: str,
    wireframe_text: str,
    copywriting: dict,
    design_system: dict,
) -> str:
    lines = [
        f"Business name: {business_name}",
        f"Category: {category}",
        "",
        "Wireframe structure:",
        wireframe_text,
        "",
        f"Copywriting: {copywriting}",
        f"Design system: {design_system}",
        "",
        "Generate a single self-contained HTML document implementing this concept as a "
        "landing page demo. Use inline <style> only, no external assets or fonts that "
        "require network access (use web-safe font stacks). Make it visually polished "
        "and responsive.",
    ]
    return "\n".join(lines)
```

- [ ] **Step 4: Write `app/agents/creative_agent.py`**

```python
import re

from pydantic import BaseModel

from app.agents.base import BaseAgent, PipelineContext
from app.ai.prompts.creative import (
    CREATIVE_CONCEPT_SYSTEM_PROMPT,
    CREATIVE_HTML_SYSTEM_PROMPT,
    build_concept_prompt,
    build_html_prompt,
)

_CODE_FENCE_RE = re.compile(r"^```(?:html)?\s*|\s*```$", re.MULTILINE)


class ConceptOutput(BaseModel):
    wireframe_text: str
    copywriting: dict
    design_system: dict


class CreativeAgent(BaseAgent):
    name = "creative"

    def run(self, context: PipelineContext) -> dict:
        if context.research is None or context.score is None:
            raise ValueError("CreativeAgent requires context.research and context.score to be set")

        lead = context.lead
        research = context.research
        score = context.score

        concept_prompt = build_concept_prompt(
            business_name=lead.business_name,
            category=lead.category,
            location=lead.location,
            brand_tone=research.brand_tone,
            visual_style=research.visual_style,
            pain_points=research.pain_points,
            opportunities=research.opportunities,
            score=score.score,
            priority=score.priority,
        )

        concept: ConceptOutput = context.ai_client.complete_json(
            system=CREATIVE_CONCEPT_SYSTEM_PROMPT,
            user=concept_prompt,
            schema=ConceptOutput,
        )

        html_prompt = build_html_prompt(
            business_name=lead.business_name,
            category=lead.category,
            wireframe_text=concept.wireframe_text,
            copywriting=concept.copywriting,
            design_system=concept.design_system,
        )

        raw_html = context.ai_client.complete(
            system=CREATIVE_HTML_SYSTEM_PROMPT,
            user=html_prompt,
        )
        demo_html = _CODE_FENCE_RE.sub("", raw_html).strip()

        return {
            "wireframe_text": concept.wireframe_text,
            "copywriting": concept.copywriting,
            "design_system": concept.design_system,
            "demo_html": demo_html,
        }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_agents/test_creative_agent.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```powershell
git add app/ai/prompts/creative.py app/agents/creative_agent.py tests/test_agents/test_creative_agent.py
git commit -m "Add Creative Agent: redesign concept + static HTML demo generation"
```

---

### Task 10: Proposal Agent

**Files:**
- Create: `app/ai/prompts/proposal.py`
- Create: `app/agents/proposal_agent.py`
- Test: `tests/test_agents/test_proposal_agent.py`

The Proposal Agent uses `context.research`, `context.score`, and `context.creative` to produce a `ProposalOutput` (Markdown proposal + email subject/body) via `complete_json`.

- [ ] **Step 1: Write failing test**

```python
# tests/test_agents/test_proposal_agent.py
from unittest.mock import MagicMock

from app.agents.base import PipelineContext
from app.agents.proposal_agent import ProposalAgent
from app.agents.schemas import CreativeOutput, ProposalOutput, ResearchOutput, ScoreOutput


def _make_lead():
    return type(
        "FakeLead",
        (),
        {
            "business_name": "Joe's Pizza",
            "website_url": "https://joespizza.example",
            "location": "Mumbai, India",
            "category": "restaurant",
            "social_links": [],
            "reason_for_lead": "Outdated website",
        },
    )()


def _make_full_context(fake_client):
    research = ResearchOutput(
        brand_tone="casual",
        visual_style="dated, cluttered",
        pain_points=["no online menu"],
        opportunities=["add online ordering"],
        sentiment_summary="Customers love the food, hate the site",
    )
    score = ScoreOutput(score=82, priority="high", reasons=["no online ordering"])
    creative = CreativeOutput(
        wireframe_text="Hero -> Menu -> Gallery -> Order CTA -> Footer",
        copywriting={"hero_headline": "Mumbai's Favorite Pizza, Now Online"},
        design_system={"palette": ["#c0392b", "#fdf6e3"], "style": "warm, modern, casual"},
        demo_html="<html><body>Demo</body></html>",
    )
    return PipelineContext(
        lead=_make_lead(), ai_client=fake_client, research=research, score=score, creative=creative
    )


def test_proposal_agent_builds_prompt_from_full_context():
    fake_proposal = ProposalOutput(
        proposal_markdown="# Proposal for Joe's Pizza\n\n...",
        email_subject="A fresh new website for Joe's Pizza",
        email_body="Hi team at Joe's Pizza, ...",
    )
    fake_client = MagicMock()
    fake_client.complete_json.return_value = fake_proposal

    context = _make_full_context(fake_client)
    agent = ProposalAgent()

    result = agent.run(context)

    assert result == fake_proposal.model_dump()
    _, kwargs = fake_client.complete_json.call_args
    assert kwargs["schema"] is ProposalOutput
    assert "Mumbai's Favorite Pizza, Now Online" in kwargs["user"]
    assert "no online menu" in kwargs["user"]
    assert "82" in kwargs["user"]


def test_proposal_agent_raises_if_prior_stages_missing():
    fake_client = MagicMock()
    context = PipelineContext(lead=_make_lead(), ai_client=fake_client)
    agent = ProposalAgent()

    try:
        agent.run(context)
        assert False, "expected ValueError"
    except ValueError:
        pass
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_agents/test_proposal_agent.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.agents.proposal_agent'`

- [ ] **Step 3: Write `app/ai/prompts/proposal.py`**

```python
PROPOSAL_SYSTEM_PROMPT = """You are an account strategist at a web design agency writing a \
client-ready proposal. Tone: confident, friendly, plain language (avoid jargon), tailored to \
the specific business. Respond with ONLY a JSON object matching the requested schema -- no \
prose, no markdown code fences."""


def build_proposal_prompt(
    *,
    business_name: str,
    category: str,
    location: str,
    pain_points: list[str],
    opportunities: list[str],
    sentiment_summary: str,
    score: int,
    priority: str,
    reasons: list[str],
    wireframe_text: str,
    copywriting: dict,
    design_system: dict,
) -> str:
    lines = [
        f"Business name: {business_name}",
        f"Category: {category}",
        f"Location: {location}",
        f"Pain points identified: {', '.join(pain_points) if pain_points else 'none'}",
        f"Opportunities: {', '.join(opportunities) if opportunities else 'none'}",
        f"Sentiment summary: {sentiment_summary}",
        f"Lead score: {score} (priority: {priority})",
        f"Scoring reasons: {', '.join(reasons) if reasons else 'none'}",
        "",
        "Redesign concept summary:",
        f"Wireframe: {wireframe_text}",
        f"Copywriting highlights: {copywriting}",
        f"Design direction: {design_system}",
        "",
        "Write a client-ready proposal with these sections (as Markdown): a personalized "
        "introduction, problems identified, proposed redesign solution, visual concept "
        "summary, business benefits, and a call-to-action.",
        "Also write a short outreach email (subject + body) introducing this proposal, "
        "in plain friendly language, inviting the business owner to review the demo and "
        "reply if interested.",
        "Return JSON with exactly these keys: proposal_markdown, email_subject, email_body.",
    ]
    return "\n".join(lines)
```

- [ ] **Step 4: Write `app/agents/proposal_agent.py`**

```python
from app.agents.base import BaseAgent, PipelineContext
from app.agents.schemas import ProposalOutput
from app.ai.prompts.proposal import PROPOSAL_SYSTEM_PROMPT, build_proposal_prompt


class ProposalAgent(BaseAgent):
    name = "proposal"

    def run(self, context: PipelineContext) -> dict:
        if context.research is None or context.score is None or context.creative is None:
            raise ValueError(
                "ProposalAgent requires context.research, context.score, and context.creative"
            )

        lead = context.lead
        research = context.research
        score = context.score
        creative = context.creative

        prompt = build_proposal_prompt(
            business_name=lead.business_name,
            category=lead.category,
            location=lead.location,
            pain_points=research.pain_points,
            opportunities=research.opportunities,
            sentiment_summary=research.sentiment_summary,
            score=score.score,
            priority=score.priority,
            reasons=score.reasons,
            wireframe_text=creative.wireframe_text,
            copywriting=creative.copywriting,
            design_system=creative.design_system,
        )

        output: ProposalOutput = context.ai_client.complete_json(
            system=PROPOSAL_SYSTEM_PROMPT,
            user=prompt,
            schema=ProposalOutput,
        )

        return output.model_dump()
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_agents/test_proposal_agent.py -v`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```powershell
git add app/ai/prompts/proposal.py app/agents/proposal_agent.py tests/test_agents/test_proposal_agent.py
git commit -m "Add Proposal Agent: client-ready proposal and email draft"
```

---

### Task 11: Orchestrator (Celery chain + DB persistence)

**Files:**
- Create: `app/orchestrator/__init__.py`
- Create: `app/orchestrator/celery_app.py`
- Create: `app/orchestrator/pipeline.py`
- Create: `app/orchestrator/tasks.py`
- Test: `tests/test_orchestrator/test_pipeline.py`

This is the core of the system. `pipeline.py` holds DB-aware helper functions (load context, persist each stage's result, update `pipeline_runs`). `tasks.py` defines 4 Celery tasks (one per agent) chained together. `celery_app.py` configures the Celery app from `Settings`.

Tests run with `CELERY_TASK_ALWAYS_EAGER=True` and a sqlite DB, with `AIClient` mocked via monkeypatching `build_ai_client` and `capture_website` stubbed to avoid real Playwright/network calls.

- [ ] **Step 1: Write failing test**

```python
# tests/test_orchestrator/test_pipeline.py
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.agents.schemas import CreativeOutput, ProposalOutput, ResearchOutput, ScoreOutput
from app.db.models import Base, Lead, PipelineRun, PipelineStatus, PipelineStep
from app.orchestrator import pipeline, tasks


@pytest.fixture
def db_session_factory(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)

    monkeypatch.setattr(pipeline, "get_session_factory", lambda: factory)
    return factory


@pytest.fixture
def seeded_lead(db_session_factory):
    with db_session_factory() as session:
        lead = Lead(
            business_name="Joe's Pizza",
            website_url="https://joespizza.example",
            location="Mumbai, India",
            category="restaurant",
            social_links=[],
            reason_for_lead="Outdated website",
        )
        session.add(lead)
        session.commit()

        run = PipelineRun(
            lead_id=lead.id,
            status=PipelineStatus.pending,
            current_step=PipelineStep.research,
        )
        session.add(run)
        session.commit()

        return lead.id, run.id


def _fake_ai_client():
    research = ResearchOutput(
        brand_tone="casual",
        visual_style="dated",
        pain_points=["no online menu"],
        opportunities=["add online ordering"],
        sentiment_summary="Mixed",
    )
    score = ScoreOutput(score=82, priority="high", reasons=["no online ordering"])
    creative = CreativeOutput(
        wireframe_text="Hero -> Menu -> Footer",
        copywriting={"hero_headline": "Headline"},
        design_system={"palette": ["#000"]},
        demo_html="<html><body>Demo</body></html>",
    )
    proposal = ProposalOutput(
        proposal_markdown="# Proposal",
        email_subject="Subject",
        email_body="Body",
    )

    client = MagicMock()

    def complete_json(system, user, schema, images=None):
        if schema is ResearchOutput:
            return research
        if schema is ScoreOutput:
            return score
        if schema.__name__ == "ConceptOutput":
            return schema(
                wireframe_text=creative.wireframe_text,
                copywriting=creative.copywriting,
                design_system=creative.design_system,
            )
        if schema is ProposalOutput:
            return proposal
        raise AssertionError(f"Unexpected schema {schema}")

    client.complete_json.side_effect = complete_json
    client.complete.return_value = creative.demo_html
    return client


def test_full_pipeline_chain_completes_and_persists_all_stages(
    db_session_factory, seeded_lead, monkeypatch, tmp_path
):
    lead_id, run_id = seeded_lead

    monkeypatch.setattr(pipeline, "build_ai_client", lambda *a, **k: _fake_ai_client())
    monkeypatch.setattr(
        "app.agents.research_agent.capture_website", lambda url: (b"fake-png", "Welcome")
    )
    monkeypatch.setattr(pipeline, "DEMO_STATIC_DIR", str(tmp_path))

    tasks.celery_app.conf.task_always_eager = True

    chain = pipeline.build_pipeline_chain(str(lead_id), str(run_id))
    chain.apply().get()

    with db_session_factory() as session:
        run = session.get(PipelineRun, run_id)
        assert run.status == PipelineStatus.completed
        assert run.current_step == PipelineStep.done

        from app.db.models import CreativeConcept, LeadScore, Proposal, ResearchResult

        research_row = session.query(ResearchResult).filter_by(pipeline_run_id=run_id).one()
        assert research_row.brand_tone == "casual"
        assert research_row.screenshot_path is not None

        score_row = session.query(LeadScore).filter_by(pipeline_run_id=run_id).one()
        assert score_row.score == 82

        creative_row = session.query(CreativeConcept).filter_by(pipeline_run_id=run_id).one()
        assert creative_row.demo_html_path.endswith(".html")

        proposal_row = session.query(Proposal).filter_by(pipeline_run_id=run_id).one()
        assert proposal_row.email_subject == "Subject"


def test_pipeline_marks_run_failed_on_agent_error(db_session_factory, seeded_lead, monkeypatch):
    lead_id, run_id = seeded_lead

    broken_client = MagicMock()
    broken_client.complete_json.side_effect = RuntimeError("AI provider down")

    monkeypatch.setattr(pipeline, "build_ai_client", lambda *a, **k: broken_client)
    monkeypatch.setattr(
        "app.agents.research_agent.capture_website", lambda url: (b"fake-png", "Welcome")
    )

    tasks.celery_app.conf.task_always_eager = True
    tasks.celery_app.conf.task_eager_propagates = False

    chain = pipeline.build_pipeline_chain(str(lead_id), str(run_id))
    chain.apply()

    with db_session_factory() as session:
        run = session.get(PipelineRun, run_id)
        assert run.status == PipelineStatus.failed
        assert run.error_message is not None
        assert "AI provider down" in run.error_message
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_orchestrator/ -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.orchestrator.pipeline'`

- [ ] **Step 3: Write `app/orchestrator/__init__.py`** (empty file)

- [ ] **Step 4: Write `app/orchestrator/celery_app.py`**

```python
from celery import Celery

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "agency_pipeline",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
)
```

- [ ] **Step 5: Write `app/orchestrator/pipeline.py`**

```python
import logging
import os
import uuid

from app.agents.base import PipelineContext
from app.agents.creative_agent import CreativeAgent
from app.agents.proposal_agent import ProposalAgent
from app.agents.research_agent import ResearchAgent
from app.agents.schemas import CreativeOutput, ProposalOutput, ResearchOutput, ScoreOutput
from app.agents.scoring_agent import ScoringAgent
from app.ai.client import build_ai_client
from app.config import get_settings
from app.db.models import (
    CreativeConcept,
    LeadScore,
    PipelineRun,
    PipelineStatus,
    PipelineStep,
    Proposal,
    ResearchResult,
)
from app.db.session import get_session_factory

logger = logging.getLogger(__name__)

settings = get_settings()
DEMO_STATIC_DIR = settings.demo_static_dir


def _ai_client():
    return build_ai_client(settings.ai_provider, settings.anthropic_api_key, settings.anthropic_model)


def _mark_failed(run_id: str, exc: Exception) -> None:
    factory = get_session_factory()
    with factory() as session:
        run = session.get(PipelineRun, uuid.UUID(run_id))
        run.status = PipelineStatus.failed
        run.error_message = str(exc)
        session.commit()


def run_research_step(lead_id: str, run_id: str) -> None:
    factory = get_session_factory()
    with factory() as session:
        from app.db.models import Lead

        lead = session.get(Lead, uuid.UUID(lead_id))
        run = session.get(PipelineRun, uuid.UUID(run_id))
        run.status = PipelineStatus.running
        run.current_step = PipelineStep.research
        session.commit()

        try:
            context = PipelineContext(lead=lead, ai_client=_ai_client())
            result = ResearchAgent().run(context)
        except Exception as exc:
            logger.exception("Research step failed for lead %s", lead_id)
            _mark_failed(run_id, exc)
            raise

        screenshot_bytes = result.pop("_screenshot_bytes", None)
        screenshot_path = None
        if screenshot_bytes:
            os.makedirs(DEMO_STATIC_DIR, exist_ok=True)
            screenshot_path = os.path.join(DEMO_STATIC_DIR, f"{lead_id}-screenshot.png")
            with open(screenshot_path, "wb") as f:
                f.write(screenshot_bytes)

        research_output = ResearchOutput.model_validate(result)

        row = ResearchResult(
            lead_id=lead.id,
            pipeline_run_id=run.id,
            screenshot_path=screenshot_path,
            brand_tone=research_output.brand_tone,
            visual_style=research_output.visual_style,
            pain_points=research_output.pain_points,
            opportunities=research_output.opportunities,
            sentiment_summary=research_output.sentiment_summary,
            raw_page_text="",
        )
        session.add(row)
        session.commit()


def run_score_step(lead_id: str, run_id: str) -> None:
    factory = get_session_factory()
    with factory() as session:
        from app.db.models import Lead

        lead = session.get(Lead, uuid.UUID(lead_id))
        run = session.get(PipelineRun, uuid.UUID(run_id))
        run.current_step = PipelineStep.score
        session.commit()

        research_row = (
            session.query(ResearchResult).filter_by(pipeline_run_id=run.id).one()
        )
        research_output = ResearchOutput(
            brand_tone=research_row.brand_tone,
            visual_style=research_row.visual_style,
            pain_points=research_row.pain_points,
            opportunities=research_row.opportunities,
            sentiment_summary=research_row.sentiment_summary,
        )

        try:
            context = PipelineContext(lead=lead, ai_client=_ai_client(), research=research_output)
            result = ScoringAgent().run(context)
        except Exception as exc:
            logger.exception("Score step failed for lead %s", lead_id)
            _mark_failed(run_id, exc)
            raise

        score_output = ScoreOutput.model_validate(result)

        row = LeadScore(
            lead_id=lead.id,
            pipeline_run_id=run.id,
            score=score_output.score,
            priority=score_output.priority,
            reasons=score_output.reasons,
        )
        session.add(row)
        session.commit()


def run_creative_step(lead_id: str, run_id: str) -> None:
    factory = get_session_factory()
    with factory() as session:
        from app.db.models import Lead

        lead = session.get(Lead, uuid.UUID(lead_id))
        run = session.get(PipelineRun, uuid.UUID(run_id))
        run.current_step = PipelineStep.creative
        session.commit()

        research_row = (
            session.query(ResearchResult).filter_by(pipeline_run_id=run.id).one()
        )
        score_row = session.query(LeadScore).filter_by(pipeline_run_id=run.id).one()

        research_output = ResearchOutput(
            brand_tone=research_row.brand_tone,
            visual_style=research_row.visual_style,
            pain_points=research_row.pain_points,
            opportunities=research_row.opportunities,
            sentiment_summary=research_row.sentiment_summary,
        )
        score_output = ScoreOutput(
            score=score_row.score, priority=score_row.priority, reasons=score_row.reasons
        )

        try:
            context = PipelineContext(
                lead=lead,
                ai_client=_ai_client(),
                research=research_output,
                score=score_output,
            )
            result = CreativeAgent().run(context)
        except Exception as exc:
            logger.exception("Creative step failed for lead %s", lead_id)
            _mark_failed(run_id, exc)
            raise

        os.makedirs(DEMO_STATIC_DIR, exist_ok=True)
        demo_html_path = os.path.join(DEMO_STATIC_DIR, f"{lead_id}.html")
        with open(demo_html_path, "w", encoding="utf-8") as f:
            f.write(result["demo_html"])

        row = CreativeConcept(
            lead_id=lead.id,
            pipeline_run_id=run.id,
            wireframe_text=result["wireframe_text"],
            copywriting=result["copywriting"],
            design_system=result["design_system"],
            demo_html_path=demo_html_path,
        )
        session.add(row)
        session.commit()


def run_proposal_step(lead_id: str, run_id: str) -> None:
    factory = get_session_factory()
    with factory() as session:
        from app.db.models import Lead

        lead = session.get(Lead, uuid.UUID(lead_id))
        run = session.get(PipelineRun, uuid.UUID(run_id))
        run.current_step = PipelineStep.proposal
        session.commit()

        research_row = (
            session.query(ResearchResult).filter_by(pipeline_run_id=run.id).one()
        )
        score_row = session.query(LeadScore).filter_by(pipeline_run_id=run.id).one()
        creative_row = (
            session.query(CreativeConcept).filter_by(pipeline_run_id=run.id).one()
        )

        research_output = ResearchOutput(
            brand_tone=research_row.brand_tone,
            visual_style=research_row.visual_style,
            pain_points=research_row.pain_points,
            opportunities=research_row.opportunities,
            sentiment_summary=research_row.sentiment_summary,
        )
        score_output = ScoreOutput(
            score=score_row.score, priority=score_row.priority, reasons=score_row.reasons
        )
        with open(creative_row.demo_html_path, encoding="utf-8") as f:
            demo_html = f.read()
        creative_output = CreativeOutput(
            wireframe_text=creative_row.wireframe_text,
            copywriting=creative_row.copywriting,
            design_system=creative_row.design_system,
            demo_html=demo_html,
        )

        try:
            context = PipelineContext(
                lead=lead,
                ai_client=_ai_client(),
                research=research_output,
                score=score_output,
                creative=creative_output,
            )
            result = ProposalAgent().run(context)
        except Exception as exc:
            logger.exception("Proposal step failed for lead %s", lead_id)
            _mark_failed(run_id, exc)
            raise

        proposal_output = ProposalOutput.model_validate(result)

        row = Proposal(
            lead_id=lead.id,
            pipeline_run_id=run.id,
            proposal_markdown=proposal_output.proposal_markdown,
            email_subject=proposal_output.email_subject,
            email_body=proposal_output.email_body,
        )
        session.add(row)

        run.current_step = PipelineStep.done
        run.status = PipelineStatus.completed
        session.commit()


def build_pipeline_chain(lead_id: str, run_id: str):
    from celery import chain

    from app.orchestrator.tasks import (
        creative_task,
        proposal_task,
        research_task,
        score_task,
    )

    return chain(
        research_task.s(lead_id, run_id),
        score_task.s(lead_id, run_id),
        creative_task.s(lead_id, run_id),
        proposal_task.s(lead_id, run_id),
    )
```

- [ ] **Step 6: Write `app/orchestrator/tasks.py`**

```python
from celery import shared_task

from app.orchestrator.celery_app import celery_app
from app.orchestrator.pipeline import (
    run_creative_step,
    run_proposal_step,
    run_research_step,
    run_score_step,
)

RETRY_KWARGS = {"max_retries": 3, "default_retry_delay": 30}


@celery_app.task(bind=True, **RETRY_KWARGS)
def research_task(self, lead_id: str, run_id: str):
    try:
        run_research_step(lead_id, run_id)
    except Exception as exc:
        raise self.retry(exc=exc)
    return lead_id, run_id


@celery_app.task(bind=True, **RETRY_KWARGS)
def score_task(self, prev_result, lead_id: str, run_id: str):
    try:
        run_score_step(lead_id, run_id)
    except Exception as exc:
        raise self.retry(exc=exc)
    return lead_id, run_id


@celery_app.task(bind=True, **RETRY_KWARGS)
def creative_task(self, prev_result, lead_id: str, run_id: str):
    try:
        run_creative_step(lead_id, run_id)
    except Exception as exc:
        raise self.retry(exc=exc)
    return lead_id, run_id


@celery_app.task(bind=True, **RETRY_KWARGS)
def proposal_task(self, prev_result, lead_id: str, run_id: str):
    try:
        run_proposal_step(lead_id, run_id)
    except Exception as exc:
        raise self.retry(exc=exc)
    return lead_id, run_id
```

Note: `chain(research_task.s(lead_id, run_id), score_task.s(lead_id, run_id), ...)` -- each subsequent task receives the previous task's return value as its **first** positional argument (`prev_result`), followed by the bound `lead_id, run_id`. `research_task` has no `prev_result` since it's first in the chain.

- [ ] **Step 7: Run test to verify it passes**

Run: `pytest tests/test_orchestrator/ -v`
Expected: PASS (2 tests)

If `test_pipeline_marks_run_failed_on_agent_error` fails because Celery's eager retry still raises after retries exhausted and the exception propagates out of `chain.apply()` (even with `task_eager_propagates = False`), wrap the `chain.apply()` call in the test with a `try/except Exception: pass` block -- the assertions on DB state afterward are what matter, not whether `.apply()` itself raises.

- [ ] **Step 8: Commit**

```powershell
New-Item -ItemType File -Force -Path tests/test_orchestrator/__init__.py | Out-Null
git add app/orchestrator/ tests/test_orchestrator/
git commit -m "Add Celery orchestrator: chained agent tasks with DB persistence and retries"
```

---

### Task 12: FastAPI app and API endpoints

**Files:**
- Create: `app/api/__init__.py`
- Create: `app/api/schemas.py`
- Create: `app/api/leads.py`
- Create: `app/main.py`
- Test: `tests/test_api/test_leads.py`

Endpoints: `POST /leads`, `POST /leads/{lead_id}/run`, `GET /leads/{lead_id}`, `GET /pipeline-runs/{run_id}`. `/leads/{id}/run` enqueues the Celery chain via `pipeline.build_pipeline_chain(...).delay()` (or `.apply()` if `task_always_eager` is set, which `.delay()` respects automatically). Static demo files served via FastAPI `StaticFiles` at `/static/demos`.

- [ ] **Step 1: Write failing test**

```python
# tests/test_api/test_leads.py
import uuid
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models import Base, PipelineRun, PipelineStatus, PipelineStep
import app.db.session as db_session
import app.api.leads as leads_api
from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)

    monkeypatch.setattr(db_session, "get_session_factory", lambda: factory)
    monkeypatch.setattr(leads_api, "get_session_factory", lambda: factory)

    return TestClient(app)


def test_create_lead_returns_id(client):
    response = client.post(
        "/leads",
        json={
            "business_name": "Joe's Pizza",
            "website": "https://joespizza.example",
            "location": "Mumbai, India",
            "category": "restaurant",
            "social_links": ["https://instagram.com/joespizza"],
            "reason_for_lead": "Outdated website",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert "lead_id" in body
    uuid.UUID(body["lead_id"])


def test_get_lead_returns_details_and_empty_results_before_run(client):
    create_resp = client.post(
        "/leads",
        json={
            "business_name": "Glow Salon",
            "website": None,
            "location": "Pune, India",
            "category": "salon",
            "social_links": [],
            "reason_for_lead": "No website",
        },
    )
    lead_id = create_resp.json()["lead_id"]

    response = client.get(f"/leads/{lead_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["business_name"] == "Glow Salon"
    assert body["latest_run"] is None
    assert body["research"] is None
    assert body["score"] is None
    assert body["creative"] is None
    assert body["proposal"] is None


def test_run_pipeline_enqueues_chain_and_returns_run_id(client, monkeypatch):
    create_resp = client.post(
        "/leads",
        json={
            "business_name": "Joe's Pizza",
            "website": "https://joespizza.example",
            "location": "Mumbai, India",
            "category": "restaurant",
            "social_links": [],
            "reason_for_lead": "Outdated website",
        },
    )
    lead_id = create_resp.json()["lead_id"]

    fake_chain = MagicMock()
    monkeypatch.setattr(leads_api, "build_pipeline_chain", lambda *a, **k: fake_chain)

    response = client.post(f"/leads/{lead_id}/run")

    assert response.status_code == 202
    body = response.json()
    assert "pipeline_run_id" in body
    uuid.UUID(body["pipeline_run_id"])
    fake_chain.delay.assert_called_once()


def test_get_pipeline_run_status(client, monkeypatch):
    create_resp = client.post(
        "/leads",
        json={
            "business_name": "Joe's Pizza",
            "website": "https://joespizza.example",
            "location": "Mumbai, India",
            "category": "restaurant",
            "social_links": [],
            "reason_for_lead": "Outdated website",
        },
    )
    lead_id = create_resp.json()["lead_id"]

    fake_chain = MagicMock()
    monkeypatch.setattr(leads_api, "build_pipeline_chain", lambda *a, **k: fake_chain)
    run_resp = client.post(f"/leads/{lead_id}/run")
    run_id = run_resp.json()["pipeline_run_id"]

    response = client.get(f"/pipeline-runs/{run_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "pending"
    assert body["current_step"] == "research"
    assert body["error_message"] is None


def test_get_lead_not_found_returns_404(client):
    response = client.get(f"/leads/{uuid.uuid4()}")
    assert response.status_code == 404


def test_run_pipeline_for_unknown_lead_returns_404(client):
    response = client.post(f"/leads/{uuid.uuid4()}/run")
    assert response.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_api/ -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.main'`

- [ ] **Step 3: Write `app/api/__init__.py`** (empty file)

- [ ] **Step 4: Write `app/api/schemas.py`**

```python
import uuid

from pydantic import BaseModel


class LeadCreateRequest(BaseModel):
    business_name: str
    website: str | None = None
    location: str
    category: str
    social_links: list[str] = []
    reason_for_lead: str = ""


class LeadCreateResponse(BaseModel):
    lead_id: uuid.UUID


class RunPipelineResponse(BaseModel):
    pipeline_run_id: uuid.UUID


class PipelineRunStatusResponse(BaseModel):
    id: uuid.UUID
    status: str
    current_step: str
    error_message: str | None


class ResearchResultResponse(BaseModel):
    brand_tone: str
    visual_style: str
    pain_points: list[str]
    opportunities: list[str]
    sentiment_summary: str
    screenshot_path: str | None


class LeadScoreResponse(BaseModel):
    score: int
    priority: str
    reasons: list[str]


class CreativeConceptResponse(BaseModel):
    wireframe_text: str
    copywriting: dict
    design_system: dict
    demo_html_path: str


class ProposalResponse(BaseModel):
    proposal_markdown: str
    email_subject: str
    email_body: str


class LeadDetailResponse(BaseModel):
    id: uuid.UUID
    business_name: str
    website_url: str | None
    location: str
    category: str
    social_links: list[str]
    reason_for_lead: str
    latest_run: PipelineRunStatusResponse | None
    research: ResearchResultResponse | None
    score: LeadScoreResponse | None
    creative: CreativeConceptResponse | None
    proposal: ProposalResponse | None
```

- [ ] **Step 5: Write `app/api/leads.py`**

```python
import uuid

from fastapi import APIRouter, HTTPException

from app.api.schemas import (
    CreativeConceptResponse,
    LeadCreateRequest,
    LeadCreateResponse,
    LeadDetailResponse,
    LeadScoreResponse,
    PipelineRunStatusResponse,
    ProposalResponse,
    ResearchResultResponse,
    RunPipelineResponse,
)
from app.db.models import (
    CreativeConcept,
    Lead,
    LeadScore,
    PipelineRun,
    PipelineStatus,
    PipelineStep,
    Proposal,
    ResearchResult,
)
from app.db.session import get_session_factory
from app.orchestrator.pipeline import build_pipeline_chain

router = APIRouter()


@router.post("/leads", response_model=LeadCreateResponse, status_code=201)
def create_lead(payload: LeadCreateRequest):
    factory = get_session_factory()
    with factory() as session:
        lead = Lead(
            business_name=payload.business_name,
            website_url=payload.website,
            location=payload.location,
            category=payload.category,
            social_links=payload.social_links,
            reason_for_lead=payload.reason_for_lead,
        )
        session.add(lead)
        session.commit()
        return LeadCreateResponse(lead_id=lead.id)


@router.post("/leads/{lead_id}/run", response_model=RunPipelineResponse, status_code=202)
def run_pipeline(lead_id: uuid.UUID):
    factory = get_session_factory()
    with factory() as session:
        lead = session.get(Lead, lead_id)
        if lead is None:
            raise HTTPException(status_code=404, detail="Lead not found")

        run = PipelineRun(
            lead_id=lead.id,
            status=PipelineStatus.pending,
            current_step=PipelineStep.research,
        )
        session.add(run)
        session.commit()

        chain = build_pipeline_chain(str(lead.id), str(run.id))
        chain.delay()

        return RunPipelineResponse(pipeline_run_id=run.id)


@router.get("/leads/{lead_id}", response_model=LeadDetailResponse)
def get_lead(lead_id: uuid.UUID):
    factory = get_session_factory()
    with factory() as session:
        lead = session.get(Lead, lead_id)
        if lead is None:
            raise HTTPException(status_code=404, detail="Lead not found")

        latest_run = (
            session.query(PipelineRun)
            .filter_by(lead_id=lead.id)
            .order_by(PipelineRun.created_at.desc())
            .first()
        )

        research = score = creative = proposal = None
        if latest_run is not None:
            research_row = (
                session.query(ResearchResult).filter_by(pipeline_run_id=latest_run.id).first()
            )
            if research_row:
                research = ResearchResultResponse(
                    brand_tone=research_row.brand_tone,
                    visual_style=research_row.visual_style,
                    pain_points=research_row.pain_points,
                    opportunities=research_row.opportunities,
                    sentiment_summary=research_row.sentiment_summary,
                    screenshot_path=research_row.screenshot_path,
                )

            score_row = session.query(LeadScore).filter_by(pipeline_run_id=latest_run.id).first()
            if score_row:
                score = LeadScoreResponse(
                    score=score_row.score, priority=score_row.priority, reasons=score_row.reasons
                )

            creative_row = (
                session.query(CreativeConcept).filter_by(pipeline_run_id=latest_run.id).first()
            )
            if creative_row:
                creative = CreativeConceptResponse(
                    wireframe_text=creative_row.wireframe_text,
                    copywriting=creative_row.copywriting,
                    design_system=creative_row.design_system,
                    demo_html_path=creative_row.demo_html_path,
                )

            proposal_row = session.query(Proposal).filter_by(pipeline_run_id=latest_run.id).first()
            if proposal_row:
                proposal = ProposalResponse(
                    proposal_markdown=proposal_row.proposal_markdown,
                    email_subject=proposal_row.email_subject,
                    email_body=proposal_row.email_body,
                )

        latest_run_response = None
        if latest_run is not None:
            latest_run_response = PipelineRunStatusResponse(
                id=latest_run.id,
                status=latest_run.status.value,
                current_step=latest_run.current_step.value,
                error_message=latest_run.error_message,
            )

        return LeadDetailResponse(
            id=lead.id,
            business_name=lead.business_name,
            website_url=lead.website_url,
            location=lead.location,
            category=lead.category,
            social_links=lead.social_links,
            reason_for_lead=lead.reason_for_lead,
            latest_run=latest_run_response,
            research=research,
            score=score,
            creative=creative,
            proposal=proposal,
        )


@router.get("/pipeline-runs/{run_id}", response_model=PipelineRunStatusResponse)
def get_pipeline_run(run_id: uuid.UUID):
    factory = get_session_factory()
    with factory() as session:
        run = session.get(PipelineRun, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="Pipeline run not found")

        return PipelineRunStatusResponse(
            id=run.id,
            status=run.status.value,
            current_step=run.current_step.value,
            error_message=run.error_message,
        )
```

- [ ] **Step 6: Write `app/main.py`**

```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.leads import router as leads_router
from app.config import get_settings
from app.db.session import init_db

settings = get_settings()

app = FastAPI(title="Agency Pipeline", version="0.1.0")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


app.include_router(leads_router)
app.mount("/static/demos", StaticFiles(directory=settings.demo_static_dir, check_dir=False), name="demos")
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pytest tests/test_api/ -v`
Expected: PASS (6 tests)

If `app.mount(...)` fails at import time because `app/static/demos` doesn't exist yet, create it with a `.gitkeep`:

```powershell
New-Item -ItemType Directory -Force -Path app/static/demos | Out-Null
New-Item -ItemType File -Force -Path app/static/demos/.gitkeep | Out-Null
```

(`check_dir=False` on `StaticFiles` avoids a hard failure if the directory is missing, but creating it keeps things tidy and is needed for Docker COPY later.)

- [ ] **Step 8: Commit**

```powershell
New-Item -ItemType File -Force -Path tests/test_api/__init__.py | Out-Null
git add app/api/ app/main.py app/static/demos/.gitkeep tests/test_api/
git commit -m "Add FastAPI app with lead and pipeline-run endpoints"
```

---

### Task 13: Alembic migrations

**Files:**
- Create: `alembic.ini`
- Create: `alembic/env.py`
- Create: `alembic/script.py.mako`
- Create: `alembic/versions/0001_initial.py`

This task wires Alembic to `app.db.models.Base` and generates the initial migration covering all 6 tables. No new pytest here -- verification is running `alembic upgrade head` against a throwaway sqlite DB and checking tables exist.

- [ ] **Step 1: Write `alembic.ini`**

```ini
[alembic]
script_location = alembic
prepend_sys_path = .
sqlalchemy.url =

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

- [ ] **Step 2: Write `alembic/env.py`**

```python
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import get_settings
from app.db.models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    return get_settings().database_url


def run_migrations_offline() -> None:
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_url()
    connectable = engine_from_config(configuration, prefix="sqlalchemy.", poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 3: Write `alembic/script.py.mako`**

```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 4: Create `alembic/versions/` directory and write the initial migration**

```powershell
New-Item -ItemType Directory -Force -Path alembic/versions | Out-Null
```

Write `alembic/versions/0001_initial.py`:

```python
"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-06-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pipeline_status = sa.Enum("pending", "running", "completed", "failed", name="pipelinestatus")
    pipeline_step = sa.Enum("research", "score", "creative", "proposal", "done", name="pipelinestep")
    priority = sa.Enum("low", "medium", "high", name="priority")

    op.create_table(
        "leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("business_name", sa.String(), nullable=False),
        sa.Column("website_url", sa.String(), nullable=True),
        sa.Column("location", sa.String(), nullable=False),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("social_links", sa.JSON(), nullable=False),
        sa.Column("reason_for_lead", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "pipeline_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id"), nullable=False),
        sa.Column("status", pipeline_status, nullable=False),
        sa.Column("current_step", pipeline_step, nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "research_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id"), nullable=False),
        sa.Column("pipeline_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("pipeline_runs.id"), nullable=False),
        sa.Column("screenshot_path", sa.String(), nullable=True),
        sa.Column("brand_tone", sa.Text(), nullable=False),
        sa.Column("visual_style", sa.Text(), nullable=False),
        sa.Column("pain_points", sa.JSON(), nullable=False),
        sa.Column("opportunities", sa.JSON(), nullable=False),
        sa.Column("sentiment_summary", sa.Text(), nullable=False),
        sa.Column("raw_page_text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "lead_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id"), nullable=False),
        sa.Column("pipeline_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("pipeline_runs.id"), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("priority", priority, nullable=False),
        sa.Column("reasons", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "creative_concepts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id"), nullable=False),
        sa.Column("pipeline_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("pipeline_runs.id"), nullable=False),
        sa.Column("wireframe_text", sa.Text(), nullable=False),
        sa.Column("copywriting", sa.JSON(), nullable=False),
        sa.Column("design_system", sa.JSON(), nullable=False),
        sa.Column("demo_html_path", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "proposals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id"), nullable=False),
        sa.Column("pipeline_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("pipeline_runs.id"), nullable=False),
        sa.Column("proposal_markdown", sa.Text(), nullable=False),
        sa.Column("email_subject", sa.String(), nullable=False),
        sa.Column("email_body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("proposals")
    op.drop_table("creative_concepts")
    op.drop_table("lead_scores")
    op.drop_table("research_results")
    op.drop_table("pipeline_runs")
    op.drop_table("leads")
    sa.Enum(name="priority").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="pipelinestep").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="pipelinestatus").drop(op.get_bind(), checkfirst=True)
```

- [ ] **Step 5: Verify migration runs against a throwaway sqlite DB**

```powershell
$env:DATABASE_URL = "sqlite:///alembic_check.db"
alembic upgrade head
```

Expected: command completes without error, creating `alembic_check.db` with all 6 tables (plus `alembic_version`). Note: sqlite doesn't enforce the `sa.Enum` types as native enums (they become `VARCHAR` with a CHECK constraint), which is fine for this verification.

Clean up afterward:

```powershell
Remove-Item alembic_check.db -ErrorAction SilentlyContinue
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
```

- [ ] **Step 6: Commit**

```powershell
git add alembic.ini alembic/
git commit -m "Add Alembic migrations for initial schema"
```

---

### Task 14: Docker Compose + Dockerfile

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

- [ ] **Step 1: Write `Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libdbus-1-3 libxcb1 libxkbcommon0 libx11-6 libxcomposite1 libxdamage1 \
    libxext6 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --no-cache-dir -e ".[dev]"

RUN playwright install chromium

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: agency
      POSTGRES_PASSWORD: agency
      POSTGRES_DB: agency
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U agency"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build: .
    command: >
      sh -c "alembic upgrade head &&
             uvicorn app.main:app --host 0.0.0.0 --port 8000"
    ports:
      - "8000:8000"
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql+psycopg://agency:agency@postgres:5432/agency
      REDIS_URL: redis://redis:6379/0
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./app/static/demos:/app/app/static/demos

  worker:
    build: .
    command: celery -A app.orchestrator.celery_app.celery_app worker --loglevel=info
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql+psycopg://agency:agency@postgres:5432/agency
      REDIS_URL: redis://redis:6379/0
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./app/static/demos:/app/app/static/demos

volumes:
  postgres_data:
```

- [ ] **Step 3: Write `.dockerignore`**

```
.venv/
__pycache__/
*.pyc
.pytest_cache/
*.db
.env
.git/
```

- [ ] **Step 4: Commit**

```powershell
git add Dockerfile docker-compose.yml .dockerignore
git commit -m "Add Docker Compose setup for api, worker, postgres, and redis"
```

Note: Building/running this compose stack requires Docker Desktop, which is not installed on this machine per the environment check during planning. This task produces the files for when Docker is available; it is not run as part of local verification in Task 15.

---

### Task 15: End-to-end smoke test and final docs

**Files:**
- Create: `tests/test_smoke.py`
- Modify: `README.md`

A gated smoke test that runs the full pipeline against a real Claude API call (and a real, stable test page) -- skipped unless `RUN_LIVE_AI_TESTS=1` and `ANTHROPIC_API_KEY` is set. Also updates the README with the API walkthrough (example input -> output flow for a single lead), matching the spec's "Output Requirements".

- [ ] **Step 1: Write `tests/test_smoke.py`**

```python
# tests/test_smoke.py
import os
import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.db.models import Base, Lead, PipelineRun, PipelineStatus, PipelineStep
from app.orchestrator import pipeline, tasks

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_LIVE_AI_TESTS") != "1" or not os.environ.get("ANTHROPIC_API_KEY"),
    reason="Set RUN_LIVE_AI_TESTS=1 and ANTHROPIC_API_KEY to run live smoke test",
)


def test_full_pipeline_against_real_claude_and_test_site(tmp_path, monkeypatch):
    get_settings.cache_clear()

    db_path = tmp_path / "smoke.db"
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr(pipeline, "get_session_factory", lambda: factory)
    monkeypatch.setattr(pipeline, "DEMO_STATIC_DIR", str(tmp_path))

    with factory() as session:
        lead = Lead(
            business_name="Example Domain Co",
            website_url="https://example.com",
            location="Remote",
            category="technology",
            social_links=[],
            reason_for_lead="Minimal placeholder site, needs full redesign",
        )
        session.add(lead)
        session.commit()

        run = PipelineRun(
            lead_id=lead.id, status=PipelineStatus.pending, current_step=PipelineStep.research
        )
        session.add(run)
        session.commit()
        lead_id, run_id = lead.id, run.id

    tasks.celery_app.conf.task_always_eager = True

    chain = pipeline.build_pipeline_chain(str(lead_id), str(run_id))
    chain.apply().get()

    with factory() as session:
        run = session.get(PipelineRun, run_id)
        assert run.status == PipelineStatus.completed

        from app.db.models import Proposal

        proposal = session.query(Proposal).filter_by(pipeline_run_id=run_id).one()
        assert len(proposal.proposal_markdown) > 0
        assert len(proposal.email_subject) > 0
```

- [ ] **Step 2: Run the full test suite (smoke test will skip)**

```powershell
pytest -v
```

Expected: all non-smoke tests PASS; `tests/test_smoke.py::test_full_pipeline_against_real_claude_and_test_site` shows `SKIPPED`.

- [ ] **Step 3: Update `README.md` with the example input -> output flow**

Append this section to `README.md`:

```markdown
## Example: running a single lead through the pipeline

1. Start Postgres + Redis (via Docker, or local installs) and the API + worker:

   ```powershell
   docker compose up --build
   ```

2. Create a lead:

   ```powershell
   curl -X POST http://localhost:8000/leads -H "Content-Type: application/json" -d '{
     "business_name": "Joe'\''s Pizza",
     "website": "https://joespizza.example",
     "location": "Mumbai, India",
     "category": "restaurant",
     "social_links": ["https://instagram.com/joespizza"],
     "reason_for_lead": "Outdated website, no online ordering"
   }'
   ```

   Response:

   ```json
   { "lead_id": "11111111-2222-3333-4444-555555555555" }
   ```

3. Kick off the pipeline:

   ```powershell
   curl -X POST http://localhost:8000/leads/11111111-2222-3333-4444-555555555555/run
   ```

   Response:

   ```json
   { "pipeline_run_id": "66666666-7777-8888-9999-000000000000" }
   ```

4. Poll for status:

   ```powershell
   curl http://localhost:8000/pipeline-runs/66666666-7777-8888-9999-000000000000
   ```

   Response (while running):

   ```json
   { "id": "...", "status": "running", "current_step": "creative", "error_message": null }
   ```

   Response (when done):

   ```json
   { "id": "...", "status": "completed", "current_step": "done", "error_message": null }
   ```

5. Fetch the full result:

   ```powershell
   curl http://localhost:8000/leads/11111111-2222-3333-4444-555555555555
   ```

   Returns the lead plus `research`, `score`, `creative` (including `demo_html_path`), and
   `proposal` (Markdown + email draft).

6. View the generated demo landing page at:

   `http://localhost:8000/static/demos/11111111-2222-3333-4444-555555555555.html`

## Running the live smoke test

```powershell
$env:RUN_LIVE_AI_TESTS = "1"
pytest tests/test_smoke.py -v
```

Requires `ANTHROPIC_API_KEY` set in `.env` or the environment. Makes real calls to the
Anthropic API and fetches `https://example.com` -- only run this manually, not in CI by default.

## Future phases (not in this MVP)

- **Lead Generation Agent**: real sourcing from Google Maps/Places, business directories, and
  Instagram business discovery, with batch ingestion.
- **Research Agent extensions**: Google Reviews sentiment analysis, Instagram branding analysis.
- **PDF proposal generation** (e.g. via pandoc or WeasyPrint from `proposal_markdown`).
- **Reply-handling / escalation agent**: watches for replies to sent proposals and escalates
  high-intent leads to a human.
- **SaaS-ification**: multi-tenant auth, billing, and a Next.js + Tailwind dashboard.
```

- [ ] **Step 4: Commit**

```powershell
git add tests/test_smoke.py README.md
git commit -m "Add gated live smoke test and document example pipeline run"
```

---

## Summary

After completing all 15 tasks, the repo contains:

- A FastAPI app (`app/main.py`) exposing lead creation, pipeline triggering, status polling, and result retrieval, plus static demo serving.
- 4 working agents (Research, Scoring, Creative, Proposal) behind a shared `BaseAgent`/`PipelineContext` interface, each with their own prompts and unit tests using a mocked `AIClient`.
- A provider-agnostic `AIClient` (Anthropic implementation) supporting text and image inputs and structured JSON output.
- Playwright-based website screenshot/text capture for the Research agent.
- A Celery-based orchestrator chaining all 4 agent steps with per-step DB persistence, retries, and failure handling, fully testable without Docker via `task_always_eager` + sqlite.
- SQLAlchemy models + Alembic migrations for all 6 tables (leads, pipeline_runs, and one result table per stage).
- Docker Compose + Dockerfile for running the full stack (Postgres, Redis, api, worker) once Docker is available.
- A gated live smoke test and README walkthrough demonstrating the full example input -> output flow for a single lead.

Lead Generation (real scraping/API sourcing), Google Reviews/Instagram research, PDF generation, and reply-escalation are explicitly out of scope and documented as future phases per the design spec.
