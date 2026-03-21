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

Request:

- `Content-Type`: `application/text` (or `text/plain`)
- Body: raw LaTeX source text
- Optional filename:
  - query param: `?filename=resume.pdf`, or
  - header: `x-filename: resume.pdf`

Example:

```bash
curl -X POST "http://localhost:8080/compile/pdf?filename=resume.pdf" \
  -H "Content-Type: application/text" \
  --data-binary "\\documentclass{article}\\begin{document}Hello\\end{document}" \
  --output resume.pdf
```

For larger payloads, prefer heredoc to avoid shell escaping issues:

```bash
curl -X POST "http://localhost:8080/compile/pdf?filename=resume.pdf" \
  -H "Content-Type: application/text" \
  --data-binary @- \
  --output resume.pdf <<'EOF'
\documentclass{article}
\begin{document}
Hello
\end{document}
EOF
```

Success response:

- Status: `200`
- Content-Type: `application/pdf`
- Body: binary PDF

Error response shape:

```json
{
  "error": "compile_failed",
  "message": "LaTeX compilation failed",
  "details": "...latexmk output tail..."
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

## Troubleshooting

- `{"error":"compile_failed",...}` usually means LaTeX source is invalid, not that the API is down.
- Check `details` in the JSON response for the exact TeX error and line number.
- Common example:
  - `Missing $ inserted` means unbalanced math delimiters.
  - Wrong: `Inline math:  = mc^2$ \\`
  - Correct: `Inline math: $E = mc^2$ \\`

## Local development

### Requirements

`latexmk` and a LaTeX distribution must be available on your host PATH.

- macOS (Homebrew): `brew install --cask mactex-no-gui`
- Linux: install TeX Live packages that include `latexmk`

Check:

```bash
which latexmk
latexmk -v
```

```bash
npm install
npm run dev
```

Default local URL: `http://localhost:8080`

If `latexmk` is not installed locally, use Docker instead.

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
