# ATS_Score Microservice Context

> This document provides AI assistants with concise context regarding the `ATS_Score` microservice of the ATSResumie platform.

---

## Overview

The `ATS_Score` service is a deterministic, rule-based Applicant Tracking System (ATS) scoring engine. It evaluates resumes without using any AI/LLMs, relying purely on deterministic algorithms, text parsing, string matching, and NLP logic (tokenization, similarity algorithms, frequency maps).

It exposes two main scoring endpoints:

1. `POST /analyze`: **Job-targeted scoring**. Scores a provided resume text against a specific job description text.
2. `POST /analyze/general`: **General ATS-friendliness scoring**. Evaluates a resume PDF (uploaded via multipart form or fetched via a secure URL) based on standard ATS heuristics (section completeness, formatting, action verbs, etc.).

---

## Tech Stack

- **Runtime:** Node.js (≥ 20) with Express
- **Language:** TypeScript
- **PDF Extraction:** `pdfjs-dist` (Mozilla PDF.js) for parsing text out of PDF buffers or remote URLs.
- **Algorithms:** Jaccard similarity, text normalization (stopword filtering, stemming), set intersection.
- **Deployment:** Dockerized using a multi-stage `node:20-bookworm-slim` output image.

---

## Project Structure

The `ATS_Score/` directory is structured as follows:

- `src/server.ts` - Express app bootstrap, request tracing, and middleware setup.
- `src/routes/`
  - `analyze.ts` - Handles job-targeted text-to-text scoring.
  - `analyzeGeneral.ts` - Handles PDF parsing context and general scoring evaluation.
- `src/services/` - Business logic including:
  - `scorer.ts` (Targeted 5-dimension scoring engine)
  - `generalScorer.ts` (General 6-dimension scoring engine)
  - `keywordExtractor.ts` (JD keyword matching against a tech dictionary)
  - `pdfExtractor.ts` (PDF text extraction orchestration via `pdfjs`)
  - `analyzer.ts` (Organizing the scoring output maps and insights generation)
- `src/utils/` - `textNormalize.ts` and `similarity.ts` for text ops.
- `src/config/env.ts` - Safe environment validation and default constants.

---

## Key Technical Principles

- **Zero LLM Dependency:** Evaluates purely on programmatic rules and static dictionaries, guaranteeing deterministic output and ultra-fast (~2-3ms) processing times relative to AI-driven checks.
- **API Patterns:** Utilizes an `x-request-id` header for request tracing throughout the stack, and outputs a consistent JSON error schema (`{ error, message }`).
- **Structured JSON Logging:** Logs metrics universally (stdout/stderr) containing `{ level, message, requestId, durationMs }` to simplify observability tools integration.

### Scoring Dimensions

**Targeted (`/analyze`):**
- Keyword Match (45%)
- Experience Relevance (20%)
- Section Completeness (15%)
- Formatting (10%)
- Keyword Distribution (10%)

**General (`/analyze/general`):**
- Section Completeness (25%)
- Formatting (20%)
- Keyword Strength (20%)
- Action Verbs (15%)
- Measurable Results (10%)
- Contact Info (10%)

---

## Security & Guardrails

- Input validation rigorously restricts file sizes and string parameter lengths via environment-defined constraints (`REQUEST_BODY_LIMIT_BYTES`, `MAX_INPUT_LENGTH`).
- All unexpected errors fall into centralized `500 internal_error` mapping.
- Structured isolation via custom error class (`PdfFetchError`, `error_code` enums, etc.) ensures zero system leaks to API consumers.
