# ATS_Score Microservice Context

> This document provides AI assistants with concise context regarding the `ATS_Score` microservice of the ATSResumie platform.

---

## Overview

The `ATS_Score` service is an AI-powered Applicant Tracking System (ATS) scoring engine. It uses **Claude Haiku 4.5** (via the Anthropic API) to evaluate resumes through forced tool-use, producing deterministic-structured JSON output with zero free-form generation.

It exposes two main scoring endpoints:

1. `POST /analyze`: **Job-targeted scoring**. Scores a provided resume text against a specific job description text.
2. `POST /analyze/general`: **General ATS-friendliness scoring**. Evaluates a resume PDF (uploaded via multipart form or fetched via a secure URL) based on standard ATS heuristics (section completeness, formatting, action verbs, etc.).

---

## Tech Stack

- **Runtime:** Node.js (≥ 20) with Express
- **Language:** TypeScript
- **AI Engine:** Anthropic Claude Haiku 4.5 (`claude-haiku-4-5`) via `@anthropic-ai/sdk`
- **Structured Output:** Forced tool-use (`tool_choice: { type: "tool" }`) with strict JSON schema validation
- **PDF Extraction:** `pdfjs-dist` (Mozilla PDF.js) for parsing text out of PDF buffers or remote URLs.
- **Deployment:** Dockerized using a multi-stage `node:20-bookworm-slim` output image.

---

## Project Structure

The `ATS_Score/` directory is structured as follows:

- `src/server.ts` - Express app bootstrap, request tracing, and middleware setup.
- `src/config/env.ts` - Safe environment validation; requires `ANTHROPIC_API_KEY`, defaults `ANTHROPIC_MODEL` to `claude-haiku-4-5`.
- `src/routes/`
  - `analyze.ts` - Handles job-targeted text-to-text scoring.
  - `analyzeGeneral.ts` - Handles PDF parsing context and general scoring evaluation.
- `src/services/`
  - `aiClient.ts` — Anthropic SDK singleton (`getAnthropicClient()`) and model getter.
  - `analyzer.ts` — Async `analyzeResume()`: calls Claude with `submit_score` tool for targeted scoring.
  - `generalScorer.ts` — Async `scoreResumeGeneral()`: calls Claude with `submit_score_general` tool for general ATS-friendliness scoring.
  - `pdfExtractor.ts` — PDF text extraction orchestration via `pdfjs`.

---

## Key Technical Principles

- **AI Engine via Tool Use:** Both scorers call Claude Haiku 4.5 with `tool_choice: { type: "tool" }` (forced tool call) and `temperature: 0`, guaranteeing structured JSON output matching the response type contracts exactly. No free-form text is ever generated.
- **Singleton SDK Client:** `aiClient.ts` lazily initialises one `Anthropic` instance per process and reuses it across all requests.
- **API Patterns:** Utilises an `x-request-id` header for request tracing throughout the stack, and outputs a consistent JSON error schema (`{ error, message }`).
- **Structured JSON Logging:** Logs metrics universally (stdout/stderr) containing `{ level, message, requestId, durationMs }` to simplify observability tools integration.

### Scoring Dimensions

**Targeted (`/analyze`) — `submit_score` tool:**
- Keyword Match (45%)
- Experience Relevance (20%)
- Section Completeness (15%)
- Formatting (10%)
- Keyword Distribution (10%)

**General (`/analyze/general`) — `submit_score_general` tool:**
- Section Completeness (25%)
- Formatting (20%)
- Keyword Strength (20%)
- Action Verbs (15%)
- Measurable Results (10%)
- Contact Info (10%)

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | **Yes** | — | Anthropic API key; service throws on startup if missing. |
| `ANTHROPIC_MODEL` | No | `claude-haiku-4-5` | Override the Claude model used for scoring. |
| `HOST` | No | `0.0.0.0` | Server bind address. |
| `ATS_PORT` / `PORT` | No | `8081` | Server listen port. |
| `REQUEST_BODY_LIMIT_BYTES` | No | `1048576` | Max request body size in bytes. |
| `MAX_INPUT_LENGTH` | No | `500000` | Max character length for text inputs. |

---

## Security & Guardrails

- Input validation rigorously restricts file sizes and string parameter lengths via environment-defined constraints (`REQUEST_BODY_LIMIT_BYTES`, `MAX_INPUT_LENGTH`).
- `ANTHROPIC_API_KEY` is validated at startup — the service refuses to start without it.
- All unexpected errors fall into centralised `500 internal_error` mapping.
- Structured isolation via custom error class (`PdfFetchError`, `error_code` enums, etc.) ensures zero system leaks to API consumers.
