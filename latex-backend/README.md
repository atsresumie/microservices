# latex-backend

Standalone Express-based LaTeX compilation backend for ATSResumie.

This service replaces direct use of `latex-online.cc` by providing a self-hosted
PDF compile API that can be deployed as a Docker container.

## What this service does

- Compiles LaTeX source into PDF (`POST /compile/pdf`)
- Exposes a health endpoint (`GET /health`)
- Uses per-request temporary work directories
- Enforces payload and timeout limits
- Runs `latexmk` with `-no-shell-escape` for safer compilation

## API

### `GET /health`

Returns service liveness/readiness metadata.

Example response:

```json
{
  "status": "ok",
  "uptimeSeconds": 124
}
```

### `POST /compile/pdf`

Request body:

```json
{
  "latex": "\\documentclass{article}\\begin{document}Hello\\end{document}",
  "filename": "resume.pdf"
}
```

- `latex` (required): full LaTeX document source
- `filename` (optional): download filename for response header

Success response:

- Status: `200`
- Content-Type: `application/pdf`
- Body: binary PDF

Error response shape:

```json
{
  "error": "compile_failed",
  "message": "LaTeX compilation failed"
}
```

Possible error codes:

- `validation_error`
- `payload_too_large`
- `compile_timeout`
- `compile_failed`
- `compiler_unavailable`
- `missing_artifact`
- `internal_error`

## Local development

```bash
npm install
npm run dev
```

Default local URL: `http://localhost:8080`

## Environment variables

See `.env.example`.

- `HOST` (default `0.0.0.0`)
- `PORT` (default `8080`)
- `REQUEST_BODY_LIMIT_BYTES` (default `1048576`)
- `LATEX_MAX_LENGTH` (default `500000`)
- `COMPILE_TIMEOUT_MS` (default `30000`)
- `TEMP_ROOT_DIR` (default `/tmp/latex-work`)

## Build and run with Docker

Build image:

```bash
docker build -t latex-backend .
```

Run container:

```bash
docker run --rm -p 8080:8080 --env-file .env.example latex-backend
```

## ATSResumie integration target

When integrating this backend into ATSResumie:

- Replace compile calls to `latex-online.cc` with `${LATEX_BACKEND_URL}/compile/pdf`
- Keep frontend response/error contracts unchanged
- Keep worker retry/backoff and storage behavior unchanged
