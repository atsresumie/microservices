# latex-backend Microservice

> Self-hosted LaTeX → PDF compilation API for ATSResumie, replacing `latex-online.cc`.

---

## Purpose

A standalone Express server that:

- Accepts raw LaTeX source text via HTTP
- Compiles it into a PDF using `latexmk` (TeX Live)
- Returns the binary PDF in the response
- Runs in an isolated Docker container for production deployment

---

## API Reference

### `GET /health`

```json
{ "status": "ok", "uptimeSeconds": 124 }
```

### `POST /compile/pdf`

Compiles LaTeX source into a PDF document.

**Request:**

| Field | Location | Required | Description |
|-------|----------|----------|-------------|
| Body | body | ✅ | Raw LaTeX source text |
| Content-Type | header | ✅ | `application/text` or `text/plain` |
| filename | query param | ❌ | Output PDF filename (default: `resume.pdf`) |
| x-filename | header | ❌ | Alternative way to set filename |
| x-request-id | header | ❌ | Trace ID (auto-generated if absent) |

**Example:**

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

| Code | HTTP | Trigger |
|------|------|---------|
| `validation_error` | 400 | Empty or non-string body |
| `payload_too_large` | 413 | LaTeX exceeds `LATEX_MAX_LENGTH` |
| `compile_failed` | 422 | latexmk exited with non-zero code |
| `compile_timeout` | 504 | Exceeded `COMPILE_TIMEOUT_MS` |
| `compiler_unavailable` | 500 | latexmk not found or spawn failed |
| `missing_artifact` | 500 | PDF file not found after compilation |
| `internal_error` | 500 | Unexpected server error |

---

## Source Code

### `src/server.ts` — Application Entry Point

- Configures `express.text()` body parser with configurable size limit
- Assigns unique `x-request-id` to every request
- Registers `GET /health` endpoint
- Verifies `latexmk` is on `PATH` at startup via `spawnSync`
- Creates temp root directory, then starts listening

### `src/config/env.ts` — Environment Configuration

Reads from the shared root `.env` file via `dotenv`. Service-specific port: `LATEX_PORT` (falls back to `PORT`).

| Config | Env Var | Default |
|--------|---------|---------|
| host | `HOST` | `0.0.0.0` |
| port | `LATEX_PORT` | `8080` |
| requestBodyLimitBytes | `REQUEST_BODY_LIMIT_BYTES` | `1048576` (1 MB) |
| latexMaxLength | `LATEX_MAX_LENGTH` | `500000` |
| compileTimeoutMs | `COMPILE_TIMEOUT_MS` | `30000` (30s) |
| tempRootDir | `TEMP_ROOT_DIR` | `/tmp/latex-work` |

### `src/routes/compile.ts` — Compile Route Handler

1. Validates body is non-empty string
2. Checks length against `latexMaxLength`
3. Resolves filename from `?filename=`, `x-filename` header, or defaults to `resume.pdf`
4. Delegates to `compileLatexToPdf()`
5. Returns PDF binary with appropriate headers

### `src/services/latexCompiler.ts` — Compilation Engine

- **`CompileError`** — Custom error with `statusCode`, `code`, and optional `details`
- **`compileLatexToPdf(input)`**:
  1. Creates isolated temp directory via `mkdtemp()`
  2. Writes LaTeX source to `input.tex`
  3. Spawns `latexmk` with `-pdf -interaction=nonstopmode -halt-on-error -no-shell-escape`
  4. Reads resulting `input.pdf`
  5. Cleans up temp directory in `finally` block
- **Timeout enforcement** — kills process with `SIGKILL` after `compileTimeoutMs`

---

## Security & Hardening

| Measure | Detail |
|---------|--------|
| No shell escape | `-no-shell-escape` flag prevents arbitrary command execution |
| Payload limits | Express body limit + LaTeX length validation |
| Compile timeout | `SIGKILL` after configured timeout |
| Temp isolation | Per-request `mkdtemp()`, cleaned in `finally` |
| Non-root | Docker runs as `node` user |
| Filename sanitization | Only alphanumeric, underscore, dot, hyphen allowed |

---

## Request Lifecycle

```
Client → POST /compile/pdf
  → Express text body parser (REQUEST_BODY_LIMIT_BYTES)
    → Request ID middleware
      → Validate body & length
        → Resolve filename
          → mkdtemp() isolated workspace
            → Write input.tex
              → Spawn latexmk (with timeout)
                → Read input.pdf
                  → Cleanup workspace
                    → Return PDF binary
```

---

## Dockerfile

Multi-stage build on `node:20-bookworm-slim`:

**Stage 1 (build):** Install deps → compile TypeScript

**Stage 2 (runtime):** Install TeX Live packages (`latexmk`, `texlive-latex-base`, `texlive-latex-recommended`, `texlive-latex-extra`, `texlive-fonts-recommended`, `texlive-xetex`, `fonts-lmodern`, `fonts-dejavu`) → copy production deps + compiled JS → run as `node` user on port `8080`

```bash
docker build -t latex-backend ./latex-backend
docker run --rm -p 8080:8080 latex-backend
```

---

## Integration with ATSResumie Frontend

1. Set `LATEX_BACKEND_URL` in the frontend environment
2. Replace compile calls from `latex-online.cc` to `${LATEX_BACKEND_URL}/compile/pdf`
3. Send raw LaTeX source as `text/plain` body
4. Receive binary PDF response
5. Preserve existing frontend error handling and retry behavior

---

_Last updated: 2026-03-24_
