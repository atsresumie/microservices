# ATS_Score Microservice

> Deterministic ATS resume scoring engine for ATSResumie — no AI/LLM usage, pure string/NLP logic.

---

## Purpose

Provides two scoring modes:

- **Job-targeted** (`POST /analyze`) — scores a resume against a specific job description
- **General** (`POST /analyze/general`) — evaluates overall ATS-friendliness from a PDF (upload or URL)

---

## API Reference

### `GET /health`

```json
{ "status": "ok", "service": "ats-score", "uptimeSeconds": 42 }
```

---

### `POST /analyze`

Score a resume against a specific job description.

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
    "matched": ["react", "node.js", "aws", "typescript"],
    "missing": ["microservices", "problem-solving"],
    "important": ["react", "node.js", "aws", "docker"]
  },
  "sections": {
    "summary": true,
    "experience": true,
    "skills": true,
    "education": true
  },
  "insights": {
    "strengths": ["Strong keyword alignment with the job description"],
    "weaknesses": ["Limited overlap between experience and requirements"],
    "suggestions": ["Add missing keywords: microservices, problem-solving"]
  }
}
```

---

### `POST /analyze/general`

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
  "score": 62,
  "breakdown": {
    "sectionCompleteness": 80,
    "formatting": 65,
    "keywordStrength": 70,
    "actionVerbs": 45,
    "measurableResults": 30,
    "contactInfo": 55
  },
  "sections": {
    "summary": true,
    "experience": true,
    "skills": true,
    "education": true,
    "certifications": false,
    "projects": false
  },
  "insights": {
    "strengths": ["All core resume sections are present"],
    "weaknesses": ["Limited use of strong action verbs"],
    "suggestions": ["Start bullet points with action verbs like \"Built\", \"Led\", \"Designed\""]
  },
  "metadata": {
    "wordCount": 320,
    "pageCount": 1,
    "detectedKeywords": ["react", "node.js", "aws", "docker"]
  }
}
```

---

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

---

## Scoring Logic

### `/analyze` — Job-Targeted (5 dimensions)

| Dimension | Weight | Method |
|-----------|--------|--------|
| Keyword Match | 45% | Intersection of JD keywords with resume tokens |
| Experience Relevance | 20% | Jaccard similarity of full token sets |
| Section Completeness | 15% | Heuristic detection of Summary, Experience, Skills, Education |
| Formatting | 10% | Bullet points, headers, structure, word count |
| Keyword Distribution | 10% | Keyword spread across resume sections |

**Formula:** `score = keywordMatch×0.45 + experienceRelevance×0.20 + sectionCompleteness×0.15 + formatting×0.10 + keywordDistribution×0.10`

### `/analyze/general` — JD-Free (6 dimensions)

| Dimension | Weight | Method |
|-----------|--------|--------|
| Section Completeness | 25% | Core sections (80%) + bonus sections like Certs, Projects (20%) |
| Formatting | 20% | Bullet points, headers, paragraphs, word count |
| Keyword Strength | 20% | Count of recognized industry/tech keywords (100+ keyword dictionary) |
| Action Verbs | 15% | Unique strong verbs like "Built", "Led", "Designed" (90+ verbs) |
| Measurable Results | 10% | Quantifiable achievements (percentages, dollar amounts, team sizes) |
| Contact Info | 10% | Email, phone, LinkedIn, GitHub, website detection |

---

## Source Code

### `src/config/env.ts`

Loads from root `.env` via `dotenv`. Port: `ATS_PORT` (falls back to `PORT`).

| Config | Env Var | Default |
|--------|---------|---------|
| host | `HOST` | `0.0.0.0` |
| port | `ATS_PORT` | `8081` |
| requestBodyLimitBytes | `REQUEST_BODY_LIMIT_BYTES` | `1048576` |
| maxInputLength | `MAX_INPUT_LENGTH` | `500000` |

### `src/utils/textNormalize.ts`

Text normalization pipeline: lowercase → strip punctuation (preserving `+`, `#`, `.` for tech terms) → tokenize → remove stopwords. Also provides `buildFrequencyMap()`.

### `src/utils/similarity.ts`

Set operations: Jaccard similarity, intersection, difference.

### `src/services/keywordExtractor.ts`

Extracts important keywords from job descriptions. Maintains a curated **100+ tech keyword dictionary** (languages, frameworks, cloud, tools, soft skills). Filters generic filler words. Returns tech keywords first, then general terms.

### `src/services/scorer.ts`

The 5-dimension scoring engine for `/analyze`. Each sub-scorer produces a 0–100 value, weighted and summed to the final score.

### `src/services/generalScorer.ts`

The 6-dimension scoring engine for `/analyze/general`. Includes action verb dictionary (90+ verbs), contact info pattern matching, and measurable results detection via regex.

### `src/services/analyzer.ts`

Orchestrates the full `/analyze` pipeline: keyword extraction → scoring → insight generation.

### `src/services/pdfExtractor.ts`

PDF text extraction using `pdfjs-dist` (Mozilla PDF.js). Two modes:

- **`extractTextFromBuffer(buffer)`** — parse an uploaded PDF binary
- **`extractTextFromUrl(url)`** — fetch from a URL (e.g. Supabase storage), validate content-type, parse

### `src/routes/analyze.ts`

`POST /analyze` route handler. Validates `jobDescription` and `resumeText`, enforces length limits, delegates to analyzer, logs structured JSON.

### `src/routes/analyzeGeneral.ts`

`POST /analyze/general` route handler. Uses `multer` for multipart upload and supports JSON `resumeUrl`. Auto-detects input mode from `Content-Type` header.

### `src/server.ts`

Express bootstrap: JSON body parser, `x-request-id` middleware, health endpoint, route mounting.

---

## Dockerfile

Multi-stage build on `node:20-bookworm-slim`. No TeX dependencies needed — pure Node.js service.

```bash
docker build -t ats-score ./ATS_Score
docker run --rm -p 8081:8081 ats-score
```

---

## Performance

- **~2–3ms** per request (both endpoints)
- Zero external AI/LLM calls
- PDF parsing via `pdfjs-dist`
- Fully deterministic — same input always produces same output

---

## Frontend Integration

This service powers:

- **`/api/analyze`** — job-targeted ATS scoring
- **ATS Checker page** — general resume evaluation
- **Onboarding preview** — quick score before the user picks a job

---

_Last updated: 2026-03-24_
