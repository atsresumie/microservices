# LaTeX to PDF Conversion Context

> Context document for AI assistants detailing the `latex-backend` microservice.

---

## Overview

The `latex-backend` is a dedicated, self-hosted LaTeX to PDF compilation API used by ATSResumie to export tailored resumes. It replaces external dependencies (like `latex-online.cc`) to improve security, reliability, timeouts, and payload limits.

---

## Tech Stack

- **Runtime:** Node.js (≥ 20) with Express
- **Language:** TypeScript
- **Compilation Engine:** `latexmk` orchestrating TeX Live binaries (Debian bookworm environment)
- **Deployment:** Docker multi-stage build running as a non-root `node` user

---

## Compilation Workflow

1. A client sends a raw LaTeX string payload via `POST /compile/pdf` (`application/text` or `text/plain`).
2. Express parses the body, enforcing a strict byte limit (`REQUEST_BODY_LIMIT_BYTES`), and validates the LaTeX string length against (`LATEX_MAX_LENGTH`).
3. The custom `x-request-id` middleware tags the request for telemetry.
4. The backend initializes an isolated, ephemeral temp directory via `mkdtemp()`.
5. The un-compiled `.tex` source text is written within the temp workspace.
6. The `latexmk` binary is spawned natively using `child_process.spawn`.
7. `latexmk` runs with strict sandboxing arguments (e.g., `-no-shell-escape`, `-interaction=nonstopmode`, `-halt-on-error`, `-file-line-error`).
8. A timer is set for `COMPILE_TIMEOUT_MS`. If compilation blocks or stalls, `SIGKILL` abruptly halts execution.
9. Upon exit code `0`, the compiled `input.pdf` binary file is read and streamed back to the user (`application/pdf`).
10. Finally, a `try...finally` block guarantees that the OS completely and persistently cleans up the temporary directory to avoid server bloat.

---

## Project Structure

The `latex-backend/` directory is structured as follows:

- `src/server.ts` - Application entry point, attaches endpoints, performs `PATH` checks, and invokes middleware.
- `src/routes/` - E.g., `compile.ts` serving endpoints like `/compile/pdf` and routing parsing parameters.
- `src/services/latexCompiler.ts` - Core engine logic wrapping `latexmk`, handling errors, formatting output tails, and workspace destruction.
- `src/config/env.ts` - Environment parser and central hub for variables (`host`, `port`, `latexMaxLength`).
- `Dockerfile` - Builds `latex-backend` with all required minimum TeX Live packages (`texlive-latex-base/recommended/extra`, `texlive-xetex`, `fonts-lmodern`, etc.).

---

## Security & Hardening

Given the history of vulnerabilities around evaluating dynamic LaTeX:

1. **Shell Escaping Blocked:** The `-no-shell-escape` flag strictly negates arbitrary OS command execution during typesetting.
2. **Payload Protection:** Requests exceeding `LATEX_MAX_LENGTH` are immediately dropped with a `413 payload_too_large` error code.
3. **Workspace Isolation:** Concurrency concerns are averted; every user request processes inside its standalone `mkdtemp` folder.
4. **Resiliency:** Timeout closures guarantee protection against algorithmic halts, deep evaluation recursion, and unclosed brackets slowing down server IO loops.
5. **No Root Privileges:** The Docker layer forcefully assumes the `node` user identity over `root`, protecting the host OS boundary.

---

## API Error Shape Checklist

All errors map to a centralized `CompileError` format emitted universally by the Express handlers.

```json
{
  "error": "compile_failed", 
  "message": "LaTeX compilation failed. Check the generated output for specifics.",
  "details": "(Optional tail 40 lines of standard latexmk logs output)"
}
```

Standard codes include: `validation_error` (400), `payload_too_large` (413), `compile_failed` (422), `compile_timeout` (504), `compiler_unavailable` (500), and `missng_artifact` (500).
