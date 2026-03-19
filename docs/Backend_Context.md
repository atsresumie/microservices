# ATSResumie Backend Context

> This document gives AI assistants concise backend context for safe and consistent code changes.

---

## Project Purpose

ATSResumie helps users tailor resumes to job descriptions and export optimized resumes as PDF/DOCX.

This repository now includes a dedicated `latex-backend` service so PDF compilation can be self-hosted
instead of relying directly on external LaTeX compile providers.

---

## High-Level System

- **Frontend app:** Next.js application (ATSResumie product UI and API routes)
- **Core backend services:** Supabase (auth, database, storage, edge functions)
- **AI generation:** Claude-based resume LaTeX generation pipeline
- **PDF compilation:** `latex-backend` (Express + `latexmk` + TeX Live in Docker)
- **DOCX conversion:** CloudConvert pipeline (PDF -> DOCX)

---

## Why `latex-backend` exists

- Remove direct dependency on public compile endpoints
- Improve control over security, timeout, and payload limits
- Keep ATSResumie frontend/export contracts stable while swapping compile infrastructure
- Allow portable deployment with a single Docker image

---

## `latex-backend` responsibilities

- Accept LaTeX source via `POST /compile/pdf`
- Compile with `latexmk` in an isolated temp directory per request
- Return binary PDF (`application/pdf`)
- Expose `GET /health` for container health checks
- Enforce hardening defaults:
  - request body limits
  - max LaTeX size
  - compile timeout
  - `-no-shell-escape`
  - temp artifact cleanup

---

## API Contract Notes

### Compile endpoint

- Route: `POST /compile/pdf`
- Request: `{ latex: string, filename?: string }`
- Success: PDF binary response
- Error shape:

```json
{
  "error": "compile_failed",
  "message": "LaTeX compilation failed"
}
```

### Health endpoint

- Route: `GET /health`
- Response includes basic status and uptime

---

## Expected Integration Pattern

When wiring ATSResumie app/worker code:

1. Introduce `LATEX_BACKEND_URL` in runtime env.
2. Replace compile calls from `latex-online.cc` to `${LATEX_BACKEND_URL}/compile/pdf`.
3. Preserve existing frontend-visible response and error behavior.
4. Preserve worker retry/backoff/storage behavior.

---

## Backend Folder Overview

`latex-backend/` contains:

- `src/server.ts` - Express app bootstrap and middleware
- `src/routes/compile.ts` - compile route and API responses
- `src/services/latexCompiler.ts` - `latexmk` execution and temp workspace handling
- `src/config/env.ts` - environment parsing/defaults
- `Dockerfile` - production image (Node + TeX Live + non-root runtime)
- `.env.example` - runtime config template

---

## AI Editing Guidance

When changing backend code:

- Keep response contracts stable unless explicitly requested
- Avoid adding shell-escape or unsafe execution flags
- Keep compile timeout and payload guardrails
- Favor deterministic JSON error shape (`error`, `message`)
- Do not break Docker portability (single container deployment)

---

_Last updated: 2026-03-18_
