# ATSResumie Microservices

Backend microservices that power the [ATSResumie](https://atsresume.com) platform.

---

## Services

| Service | Port | Status | Description |
|---------|------|--------|-------------|
| [`latex-backend`](./latex-backend) | 8080 | ✅ Active | Self-hosted LaTeX → PDF compilation |
| [`ATS_Score`](./ATS_Score) | 8081 | ✅ Active | Deterministic ATS resume scoring engine |

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
             │  (Express+TeX)   │  │  POST /analyze/general (PDF) │
             │  :8080           │  │  (Express+NLP+pdfjs)         │
             └──────────────────┘  │  :8081                       │
                                   └──────────────────────────────┘
```

---

## ATS_Score Service

A production-ready, deterministic ATS scoring engine — **no AI/LLM usage**, pure string/NLP logic. Supports two modes:

- **Job-targeted scoring** (`POST /analyze`) — scores a resume against a specific job description
- **General scoring** (`POST /analyze/general`) — evaluates overall ATS-friendliness from a PDF (upload or Supabase URL)

### Quick Start

```bash
cd ATS_Score
npm install
npm run dev   # → http://localhost:8081
```

### API

#### `GET /health`

```json
{ "status": "ok", "service": "ats-score", "uptimeSeconds": 42 }
```

#### `POST /analyze`

**Request:**

```json
{
  "jobDescription": "We need a React/Node.js developer with AWS experience...",
  "resumeText": "SUMMARY\nFull Stack Developer with 6 years..."
}
```

**Response:**

```json
{
  "score": 69,
  "breakdown": {
    "keywordMatch": 79,
    "experienceRelevance": 27,
    "sectionCompleteness": 100,
    "formatting": 90,
    "keywordDistribution": 41
  },
  "keywords": {
    "matched": ["react", "node.js", "aws", "typescript", "..."],
    "missing": ["microservices", "problem-solving", "..."],
    "important": ["react", "node.js", "aws", "docker", "..."]
  },
  "sections": {
    "summary": true,
    "experience": true,
    "skills": true,
    "education": true
  },
  "insights": {
    "strengths": ["Strong keyword alignment with the job description", "..."],
    "weaknesses": ["Limited overlap between experience and requirements"],
    "suggestions": ["Add missing keywords: microservices, problem-solving"]
  }
}
```

#### `POST /analyze/general`

General ATS score without a job description. Accepts a PDF via **file upload** or **URL**.

**Option 1 — PDF binary upload (multipart):**

```bash
curl -X POST http://localhost:8081/analyze/general \
  -F "resume=@resume.pdf;type=application/pdf"
```

**Option 2 — Supabase storage URL (JSON):**

```bash
curl -X POST http://localhost:8081/analyze/general \
  -H "Content-Type: application/json" \
  -d '{"resumeUrl":"https://your-project.supabase.co/storage/v1/object/public/resumes/file.pdf"}'
```

**Response:**

```json
{
  "score": 39,
  "breakdown": {
    "sectionCompleteness": 80,
    "formatting": 0,
    "keywordStrength": 65,
    "actionVerbs": 0,
    "measurableResults": 0,
    "contactInfo": 55
  },
  "sections": {
    "summary": true, "experience": true, "skills": true,
    "education": true, "certifications": false, "projects": false
  },
  "insights": {
    "strengths": ["All core resume sections are present"],
    "weaknesses": ["Resume formatting needs improvement", "..."],
    "suggestions": ["Use more bullet points", "..."]
  },
  "metadata": {
    "wordCount": 24,
    "pageCount": 1,
    "detectedKeywords": ["react", "node.js", "aws", "..."]
  }
}
```

### Scoring Formulas

**`/analyze` (with JD):**

| Dimension | Weight | Method |
|-----------|--------|--------|
| Keyword Match | 45% | JD keyword intersection with resume |
| Experience Relevance | 20% | Jaccard similarity of token sets |
| Section Completeness | 15% | Heuristic detection of core sections |
| Formatting | 10% | Bullet points, headers, structure, length |
| Keyword Distribution | 10% | Spread of keywords across resume sections |

**`/analyze/general` (no JD):**

| Dimension | Weight | Method |
|-----------|--------|--------|
| Section Completeness | 25% | Core (Summary, Experience, Skills, Education) + bonus (Certs, Projects) |
| Formatting | 20% | Bullet points, headers, structure, length |
| Keyword Strength | 20% | Count of recognized industry/tech keywords |
| Action Verbs | 15% | Unique strong verbs ("Built", "Led", "Designed", etc.) |
| Measurable Results | 10% | Quantifiable achievements (percentages, dollar amounts, team sizes) |
| Contact Info | 10% | Email, phone, LinkedIn, GitHub, website |

### Error Responses

```json
{ "error": "validation_error", "message": "jobDescription is required and must be a non-empty string" }
```

| Code | HTTP | Trigger |
|------|------|---------|
| `validation_error` | 400 | Empty or missing fields |
| `payload_too_large` | 413 | Input exceeds `MAX_INPUT_LENGTH` |
| `pdf_error` | 4xx | PDF fetch failed or content-type mismatch |
| `extraction_failed` | 422 | Could not extract text from PDF |
| `internal_error` | 500 | Unexpected server error |

### Project Structure

```
ATS_Score/
├── src/
│   ├── config/env.ts              # Typed env config with defaults
│   ├── utils/
│   │   ├── textNormalize.ts       # Tokenization, stopwords, frequency maps
│   │   └── similarity.ts          # Jaccard similarity, set operations
│   ├── services/
│   │   ├── keywordExtractor.ts    # JD keyword extraction + tech dictionary
│   │   ├── scorer.ts              # 5-dimension scoring engine (with JD)
│   │   ├── generalScorer.ts       # 6-dimension scoring engine (no JD)
│   │   ├── analyzer.ts            # Orchestrator + insights (with JD)
│   │   └── pdfExtractor.ts        # PDF text extraction (buffer + URL)
│   ├── routes/
│   │   ├── analyze.ts             # POST /analyze (with JD)
│   │   └── analyzeGeneral.ts      # POST /analyze/general (PDF input)
│   └── server.ts                  # Express bootstrap + middleware
├── Dockerfile                     # Multi-stage (node:20-bookworm-slim)
├── .env.example
├── package.json
└── tsconfig.json
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `8081` | Listen port |
| `REQUEST_BODY_LIMIT_BYTES` | `1048576` | Express body parser limit (1 MB) |
| `MAX_INPUT_LENGTH` | `500000` | Max chars per input field |

### Docker

```bash
docker build -t ats-score ./ATS_Score
docker run --rm -p 8081:8081 ats-score
```

### Performance

- **~2–3ms** processing time per request
- Zero external AI/LLM calls — fully self-contained
- PDF parsing via `pdfjs-dist` (Mozilla PDF.js)

---

## latex-backend Service

Self-hosted LaTeX → PDF compilation API, replacing `latex-online.cc`.

### Quick Start

```bash
cd latex-backend
npm install
npm run dev   # → http://localhost:8080 (requires latexmk on PATH)
```

### API

#### `GET /health`

```json
{ "status": "ok", "uptimeSeconds": 124 }
```

#### `POST /compile/pdf`

- **Content-Type:** `text/plain` or `application/text`
- **Body:** Raw LaTeX source
- **Query:** `?filename=resume.pdf` (optional)
- **Response:** Binary PDF (`application/pdf`)

```bash
curl -X POST "http://localhost:8080/compile/pdf?filename=resume.pdf" \
  -H "Content-Type: text/plain" \
  --data-binary @resume.tex \
  --output resume.pdf
```

### Docker

```bash
docker build -t latex-backend ./latex-backend
docker run --rm -p 8080:8080 latex-backend
```

See [`latex-backend/README.md`](./latex-backend/README.md) for full documentation.

---

## Shared Patterns

Both services follow identical conventions:

- **Express + TypeScript** (ES2022, NodeNext, strict mode)
- **`x-request-id`** middleware (propagates or generates UUID)
- **Structured JSON logging** (`{ level, message, requestId, ... }`)
- **Typed `EnvConfig`** with `parsePositiveInt()` and safe defaults
- **Custom error classes** with `statusCode` + `code` fields
- **Consistent error shape** `{ error, message }`
- **Multi-stage Dockerfile** (build → runtime, non-root `node` user)
- **Node.js ≥ 20**

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

## License

MIT — Copyright © 2026 Atsresumie
