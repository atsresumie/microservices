# ATSResumie Microservices

> Comprehensive documentation for the **atsresumie-microservice** repository — the backend services that power ATSResumie's PDF compilation pipeline.

---

## Table of Contents

- [Overview](#overview)
- [Repository Structure](#repository-structure)
- [System Architecture](#system-architecture)
- [latex-backend Service](#latex-backend-service)
  - [Purpose](#purpose)
  - [Tech Stack](#tech-stack)
  - [Source Code Layout](#source-code-layout)
  - [API Reference](#api-reference)
  - [Environment Variables](#environment-variables)
  - [Security & Hardening](#security--hardening)
  - [Request Lifecycle](#request-lifecycle)
  - [Error Handling](#error-handling)
- [Docker Deployment](#docker-deployment)
  - [Dockerfile Breakdown](#dockerfile-breakdown)
  - [Build & Run](#build--run)
- [Local Development](#local-development)
- [Integration with ATSResumie Frontend](#integration-with-atsresumie-frontend)
- [ATS_Score (Planned)](#ats_score-planned)
- [License](#license)

---

## Overview

ATSResumie helps users tailor resumes to job descriptions and export optimized resumes as PDF/DOCX. This repository houses **microservices** that support the main ATSResumie frontend application:

| Service | Status | Description |
|---------|--------|-------------|
| `latex-backend` | ✅ Active | Self-hosted LaTeX → PDF compilation API |
| `ATS_Score` | 🚧 Planned | ATS scoring engine (not yet implemented) |

The `latex-backend` service was created to replace direct dependency on the public `latex-online.cc` compile endpoint, improving control over security, timeouts, payload limits, and deployment portability.

---

## Repository Structure

```
atsresumie-microservice/
├── ATS_Score/                     # Planned ATS scoring service (empty)
├── docs/
│   └── Backend_Context.md         # AI editing context for the backend
├── latex-backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── env.ts             # Environment variable parsing & defaults
│   │   ├── routes/
│   │   │   └── compile.ts         # POST /compile/pdf route handler
│   │   ├── services/
│   │   │   └── latexCompiler.ts   # latexmk execution & temp workspace mgmt
│   │   └── server.ts              # Express app bootstrap & middleware
│   ├── Dockerfile                 # Multi-stage production image
│   ├── .dockerignore
│   ├── .env.example               # Runtime config template
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── Frontend_Context.md
├── LICENSE                        # MIT License
├── .gitignore
└── microservice.md                # ← This file
```

---

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   ATSResumie Platform                     │
│                                                          │
│  ┌─────────────┐    ┌──────────┐    ┌────────────────┐  │
│  │  Next.js App │───▶│ Supabase │    │ Claude AI API  │  │
│  │  (Frontend)  │    │ (Auth/DB │    │ (LaTeX Gen)    │  │
│  │              │    │  Storage)│    └───────┬────────┘  │
│  └──────┬───────┘    └──────────┘            │           │
│         │                              LaTeX source      │
│         │ POST /compile/pdf                  │           │
│         ▼                                    ▼           │
│  ┌────────────────────────────────────────────────┐      │
│  │           latex-backend (this repo)             │      │
│  │  Express + latexmk + TeX Live (Docker)          │      │
│  │  Receives LaTeX source → returns compiled PDF   │      │
│  └────────────────────────────────────────────────┘      │
│         │                                                │
│         ▼                                                │
│  ┌─────────────┐                                        │
│  │ CloudConvert │  (optional PDF → DOCX conversion)     │
│  └─────────────┘                                        │
└──────────────────────────────────────────────────────────┘
```

---

## latex-backend Service

### Purpose

A standalone Express server that:

- Accepts raw LaTeX source text via HTTP
- Compiles it into a PDF using `latexmk` (TeX Live)
- Returns the binary PDF in the response
- Runs in an isolated Docker container for production deployment

### Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | ≥ 20 | Runtime |
| Express | 4.x | HTTP framework |
| TypeScript | 5.x | Type safety |
| tsx | 4.x | Dev server with watch mode |
| latexmk | (TeX Live) | LaTeX compilation orchestrator |
| TeX Live | (Debian bookworm) | LaTeX distribution (base, recommended, extra, xetex) |
| Docker | — | Production containerization |

### Source Code Layout

#### `src/server.ts` — Application Entry Point

Bootstraps the Express application:

- Configures `express.text()` body parser with configurable size limit (accepts `application/text`, `text/plain`, `text/*`)
- Assigns a unique `x-request-id` to every request (uses incoming header if present, otherwise generates a UUID)
- Registers the `GET /health` endpoint inline
- Mounts compile routes via `compileRoutes(env)`
- On startup:
  1. Verifies `latexmk` is available on `PATH` via `spawnSync`
  2. Creates the temp root directory
  3. Starts listening on the configured `host:port`
- Logs structured JSON errors on startup failure and exits with code 1

#### `src/config/env.ts` — Environment Configuration

Exports a typed `EnvConfig` interface and `getEnvConfig()` function that reads from `process.env` with safe defaults:

| Config Key | Type | Default | Description |
|------------|------|---------|-------------|
| `host` | string | `0.0.0.0` | Bind address |
| `port` | number | `8080` | Listen port |
| `requestBodyLimitBytes` | number | `1048576` (1 MB) | Express body parser limit |
| `latexMaxLength` | number | `500000` (500 KB) | Max LaTeX source length |
| `compileTimeoutMs` | number | `30000` (30s) | latexmk process timeout |
| `tempRootDir` | string | `/tmp/latex-work` | Base directory for temp workspaces |

Numeric values use a `parsePositiveInt()` helper that falls back to the default for missing, non-finite, or non-positive values.

#### `src/routes/compile.ts` — Compile Route Handler

Defines `POST /compile/pdf` with the following logic:

1. **Validation** — Rejects requests with empty/non-string bodies (`400 validation_error`) and bodies exceeding `latexMaxLength` (`413 payload_too_large`)
2. **Filename resolution** — Reads `?filename=` query param, falls back to `x-filename` header, defaults to `resume.pdf`. Sanitizes to alphanumeric/underscores/dots and ensures `.pdf` extension
3. **Compilation** — Delegates to `compileLatexToPdf()` service
4. **Success response** — Returns the PDF binary with `application/pdf` content type and `Content-Disposition: attachment`
5. **Error handling** — Maps `CompileError` instances to structured JSON; catches unexpected errors as `500 internal_error`

Also includes a `debugLog()` utility function that POSTs telemetry to a local debug agent (fire-and-forget, errors are silently caught).

#### `src/services/latexCompiler.ts` — Compilation Engine

The core compilation service:

- **`CompileError` class** — Custom error with `statusCode`, `code`, and optional `details` fields
- **`compileLatexToPdf(input)`** — Main function:
  1. Creates an isolated temp directory under `tempRootDir` using `mkdtemp()`
  2. Writes the LaTeX source to `input.tex`
  3. Executes `latexmk` via `runLatexMk()`
  4. Reads the resulting `input.pdf`
  5. Cleans up the temp directory in a `finally` block (always runs)
- **`runLatexMk(workingDir, timeoutMs)`** — Spawns `latexmk` with:
  - `-pdf` — produce PDF output
  - `-interaction=nonstopmode` — don't pause on errors
  - `-halt-on-error` — stop on first error
  - `-file-line-error` — detailed error locations
  - `-no-shell-escape` — security hardening
  - Captures both stdout and stderr
  - Uses a `setTimeout` to enforce compile timeout (kills process with `SIGKILL`)
  - On exit code `0`: resolves with log output
  - On non-zero exit: rejects with `compile_failed` (422)
  - On timeout: rejects with `compile_timeout` (504)
  - On spawn error: rejects with `compiler_unavailable` (500)
- **`tailLog(output, maxLines)`** — Extracts the last N lines of latexmk output for error detail reporting

---

### API Reference

#### `GET /health`

Health check endpoint for container orchestration.

**Response:**

```json
{
  "status": "ok",
  "uptimeSeconds": 124
}
```

---

#### `POST /compile/pdf`

Compiles LaTeX source into a PDF document.

**Request:**

| Field | Location | Required | Description |
|-------|----------|----------|-------------|
| Body | body | ✅ | Raw LaTeX source text |
| Content-Type | header | ✅ | `application/text` or `text/plain` |
| filename | query param | ❌ | Output PDF filename (default: `resume.pdf`) |
| x-filename | header | ❌ | Alternative way to set filename |
| x-request-id | header | ❌ | Trace ID (auto-generated if absent) |

**Example Request:**

```bash
curl -X POST "http://localhost:8080/compile/pdf?filename=resume.pdf" \
  -H "Content-Type: application/text" \
  --data-binary @- \
  --output resume.pdf <<'EOF'
\documentclass{article}
\begin{document}
Hello, World!
\end{document}
EOF
```

**Success Response (200):**

| Header | Value |
|--------|-------|
| content-type | `application/pdf` |
| content-disposition | `attachment; filename="resume.pdf"` |
| x-request-id | UUID trace ID |
| x-compile-log-size | Size of latexmk log output (bytes) |

Body: Binary PDF data.

**Error Response:**

```json
{
  "error": "<error_code>",
  "message": "<human-readable message>",
  "details": "<optional latexmk log tail>"
}
```

**Error Codes:**

| Code | HTTP Status | Trigger |
|------|-------------|---------|
| `validation_error` | 400 | Empty or non-string body |
| `payload_too_large` | 413 | LaTeX source exceeds `LATEX_MAX_LENGTH` |
| `compile_failed` | 422 | latexmk exited with non-zero code |
| `compile_timeout` | 504 | Compilation exceeded `COMPILE_TIMEOUT_MS` |
| `compiler_unavailable` | 500 | latexmk binary not found or spawn failed |
| `missing_artifact` | 500 | PDF file not found after compilation |
| `internal_error` | 500 | Unexpected server error |

---

### Environment Variables

Configured via `.env` file or container environment. See `.env.example`:

```bash
HOST=0.0.0.0
PORT=8080
REQUEST_BODY_LIMIT_BYTES=1048576
LATEX_MAX_LENGTH=500000
COMPILE_TIMEOUT_MS=30000
TEMP_ROOT_DIR=/tmp/latex-work
```

All numeric values fall back to their defaults if missing or invalid.

---

### Security & Hardening

| Measure | Implementation |
|---------|----------------|
| **No shell escape** | `latexmk` runs with `-no-shell-escape`, preventing LaTeX from executing arbitrary system commands |
| **Payload limits** | Express body parser limited to `REQUEST_BODY_LIMIT_BYTES`; LaTeX source validated against `LATEX_MAX_LENGTH` |
| **Compile timeout** | Processes killed via `SIGKILL` after `COMPILE_TIMEOUT_MS` |
| **Temp isolation** | Each request gets its own `mkdtemp()` workspace, cleaned up in `finally` block |
| **Non-root runtime** | Docker container runs as `node` user (not root) |
| **Filename sanitization** | Output filenames stripped of special characters; only alphanumeric, underscore, dot, and hyphen allowed |
| **Request tracing** | `x-request-id` header propagated/generated for every request |

---

### Request Lifecycle

```
1. Client sends POST /compile/pdf with LaTeX body
     │
2. Express text body parser applies REQUEST_BODY_LIMIT_BYTES
     │
3. Request ID middleware assigns/propagates x-request-id
     │
4. Compile route handler validates body & length
     │
5. Filename resolved from ?filename, x-filename, or default
     │
6. compileLatexToPdf() called:
     │
     ├─ mkdtemp() creates isolated workspace
     │
     ├─ LaTeX source written to input.tex
     │
     ├─ latexmk spawned with safety flags
     │    ├─ stdout/stderr captured
     │    ├─ Timeout enforced via setTimeout + SIGKILL
     │    └─ Exit code checked
     │
     ├─ input.pdf read from workspace
     │
     └─ Workspace cleaned up (finally block)
     │
7. PDF binary returned with appropriate headers
     │
8. On error: structured JSON error response
```

---

### Error Handling

The service uses a custom `CompileError` class that carries:

- `statusCode` — HTTP status to return
- `code` — Machine-readable error code string
- `details` — Optional tail of latexmk output (last 40 lines) for debugging

All errors are logged as structured JSON to stdout/stderr with the `requestId` for traceability. The `sendJsonError()` helper ensures a consistent response shape across all error paths.

---

## Docker Deployment

### Dockerfile Breakdown

The Dockerfile uses a **multi-stage build**:

**Stage 1 — `build`** (Node 20 bookworm-slim):
- Installs npm dependencies
- Compiles TypeScript → JavaScript via `npm run build`

**Stage 2 — `runtime`** (Node 20 bookworm-slim):
- Installs TeX Live packages: `latexmk`, `texlive-latex-base`, `texlive-latex-recommended`, `texlive-latex-extra`, `texlive-fonts-recommended`, `texlive-xetex`, `fonts-lmodern`, `lmodern`, `fonts-dejavu`
- Copies only production `node_modules` and compiled `dist/`
- Creates temp workspace directory with proper ownership
- Runs as non-root `node` user
- Exposes port `8080`

### Build & Run

```bash
# Build the image
docker build -t latex-backend ./latex-backend

# Run the container
docker run --rm -p 8080:8080 --env-file ./latex-backend/.env.example latex-backend

# Verify it's running
curl http://localhost:8080/health
```

---

## Local Development

### Prerequisites

- **Node.js** ≥ 20
- **latexmk** + a TeX Live distribution on PATH:
  - macOS: `brew install --cask mactex-no-gui`
  - Linux: Install TeX Live packages that include `latexmk`

### Setup

```bash
cd latex-backend

# Install dependencies
npm install

# Start dev server with hot reload
npm run dev
```

The dev server uses `tsx watch` for automatic restarts on file changes.

Default URL: `http://localhost:8080`

### Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `tsx watch src/server.ts` | Dev server with hot reload |
| `build` | `tsc -p tsconfig.json` | Compile TypeScript to `dist/` |
| `start` | `node dist/server.js` | Run compiled production build |
| `lint` | `eslint .` | Lint the codebase |
| `check` | `tsc --noEmit` | Type-check without emitting |

### TypeScript Configuration

- **Target:** ES2022
- **Module:** NodeNext (ESM with `.js` extensions in imports)
- **Strict mode** enabled
- Output to `dist/`, source from `src/`

---

## Integration with ATSResumie Frontend

The frontend (Next.js) integrates with this backend by:

1. Setting `LATEX_BACKEND_URL` in the frontend runtime environment
2. Replacing compile calls from `latex-online.cc` to `${LATEX_BACKEND_URL}/compile/pdf`
3. Sending raw LaTeX source as `text/plain` body to `POST /compile/pdf`
4. Receiving binary PDF in the response
5. Preserving existing frontend response/error contracts and worker retry/backoff/storage behavior

---

## ATS_Score (Planned)

The `ATS_Score/` directory is reserved for a future ATS (Applicant Tracking System) scoring service. This service is not yet implemented.

---

## License

This project is licensed under the **MIT License**. See [LICENSE](./LICENSE) for details.

Copyright © 2026 Atsresumie.

---

_Last updated: 2026-03-23_
