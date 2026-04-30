# ATSResumie Microservices

Backend microservices powering the [ATSResumie](https://atsresume.com) platform — resume tailoring, ATS scoring, and PDF compilation.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      ATSResumie (Next.js)                       │
│                                                                  │
│  /api/export-pdf ────┐  /api/analyze ────┐  /api/score ────┐    │
│                       │                   │                 │    │
└───────────────────────┼───────────────────┼─────────────────┼────┘
                        ▼                   ▼                 ▼
             ┌──────────────────┐  ┌──────────────────────────────┐
             │  latex-backend   │  │         ATS_Score             │
             │  POST /compile   │  │  POST /analyze (with JD)     │
             │  :8080           │  │  POST /analyze/general (PDF) │
             └──────────────────┘  │  :8081                       │
                                   └──────────────────────────────┘
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| [`latex-backend`](./latex-backend) | 8080 | LaTeX → PDF compilation (Express + TeX Live) |
| [`ATS_Score`](./ATS_Score) | 8081 | Deterministic ATS resume scoring (Express + NLP) |

---

## Prerequisites

- **Node.js** ≥ 20
- **npm** (comes with Node.js)
- **Docker** (optional, for containerized deployment)
- **latexmk + TeX Live** (only for latex-backend local dev)
  - macOS: `brew install --cask mactex-no-gui`
  - Linux: `apt install latexmk texlive-latex-base texlive-latex-recommended`

---

## Quick Setup

### 1. Clone the repo

```bash
git clone https://github.com/atsresumie/microservices.git
cd microservices
```

### 2. Create the shared `.env` file

```bash
cp .env.example .env
```

This single `.env` at the root is the **source of truth** for both services. Edit it as needed:

```bash
# ─── Shared ───────────────────────────────────────────────
HOST=0.0.0.0
REQUEST_BODY_LIMIT_BYTES=1048576

# ─── latex-backend ────────────────────────────────────────
LATEX_PORT=8080
LATEX_MAX_LENGTH=500000
COMPILE_TIMEOUT_MS=30000
TEMP_ROOT_DIR=/tmp/latex-work

# ─── ATS_Score ────────────────────────────────────────────
ATS_PORT=8081
MAX_INPUT_LENGTH=500000
```

### 3. Run a service

**ATS_Score** (no extra dependencies):

```bash
cd ATS_Score
npm install
npm run dev   # → http://localhost:8081
```

**latex-backend** (requires latexmk):

```bash
cd latex-backend
npm install
npm run dev   # → http://localhost:8080
```

### 4. Verify

```bash
curl http://localhost:8081/health
curl http://localhost:8080/health
```

---

## Docker

Build and run either service without installing local dependencies:

```bash
# ATS_Score
docker build -t ats-score ./ATS_Score
docker run --rm -p 8081:8081 ats-score

# latex-backend
docker build -t latex-backend ./latex-backend
docker run --rm -p 8080:8080 latex-backend
```

---

## Scripts (per service)

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `tsx watch src/server.ts` | Dev server with hot reload |
| `build` | `tsc -p tsconfig.json` | Compile to `dist/` |
| `start` | `node dist/server.js` | Run production build |
| `check` | `tsc --noEmit` | Type-check only |
| `lint` | `eslint .` | Lint |

---

## Project Structure

```
atsresumie-microservice/
├── .env.example              # Shared env config (single source of truth)
├── ATS_Score/                 # ATS scoring microservice
├── latex-backend/             # LaTeX PDF compilation microservice
├── docs/
│   ├── FRONTEND-CONTEXT.md    # Frontend integration context
│   ├── LATEX-MICROSERVICE.md  # latex-backend deep documentation
│   └── ATS-SCORE-MICROSERVICE.md  # ATS_Score deep documentation
├── README.md                  # ← You are here
└── LICENSE                    # MIT
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [FRONTEND-CONTEXT.md](./docs/FRONTEND-CONTEXT.md) | How the frontend integrates with these services |
| [LATEX-MICROSERVICE.md](./docs/LATEX-MICROSERVICE.md) | Full API reference, source walkthrough, and deployment guide for latex-backend |
| [ATS-SCORE-MICROSERVICE.md](./docs/ATS-SCORE-MICROSERVICE.md) | Full API reference, scoring logic, and deployment guide for ATS_Score |

---

## Shared Patterns

Both services follow identical conventions:

- **Express + TypeScript** (ES2022, NodeNext, strict mode)
- **Shared `.env`** loaded via `dotenv` from the repo root
- **`x-request-id`** middleware (propagates or generates UUID)
- **Structured JSON logging** (`{ level, message, requestId, ... }`)
- **Typed `EnvConfig`** with `parsePositiveInt()` and safe defaults
- **Custom error classes** with `statusCode` + `code` fields
- **Consistent error shape** `{ error, message }`
- **Multi-stage Dockerfile** (build → runtime, non-root `node` user)

---

## License

MIT — Copyright © 2026 Atsresumie
