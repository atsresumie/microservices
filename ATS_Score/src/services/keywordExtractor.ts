import { normalizeText } from "../utils/textNormalize.js";

/**
 * Known technical keywords that ATS systems commonly look for.
 * This helps boost detection of terms that might otherwise be filtered.
 */
const TECH_KEYWORDS = new Set([
  // Languages
  "javascript", "typescript", "python", "java", "c++", "c#", "ruby", "go",
  "golang", "rust", "swift", "kotlin", "php", "scala", "perl", "r",
  "html", "css", "sass", "less", "sql", "nosql", "graphql", "bash",
  // Frontend
  "react", "react.js", "reactjs", "angular", "vue", "vue.js", "vuejs",
  "next.js", "nextjs", "nuxt", "svelte", "gatsby", "remix",
  "tailwind", "tailwindcss", "bootstrap", "material-ui", "chakra",
  "redux", "zustand", "mobx", "webpack", "vite", "rollup", "babel",
  // Backend
  "node", "node.js", "nodejs", "express", "fastify", "nestjs", "koa",
  "django", "flask", "fastapi", "spring", "rails", "laravel", "asp.net",
  // Databases
  "postgresql", "postgres", "mysql", "mongodb", "redis", "elasticsearch",
  "dynamodb", "cassandra", "sqlite", "supabase", "firebase", "prisma",
  // Cloud / DevOps
  "aws", "azure", "gcp", "docker", "kubernetes", "k8s", "terraform",
  "ansible", "jenkins", "circleci", "github-actions", "gitlab-ci",
  "vercel", "netlify", "heroku", "digitalocean", "cloudflare",
  // Tools & Practices
  "git", "github", "gitlab", "bitbucket", "jira", "confluence",
  "agile", "scrum", "kanban", "ci/cd", "cicd", "devops", "mlops",
  "rest", "restful", "api", "microservices", "serverless", "oauth",
  "jwt", "websocket", "grpc", "rabbitmq", "kafka", "sqs",
  // Data / ML
  "machine-learning", "deep-learning", "tensorflow", "pytorch",
  "pandas", "numpy", "scikit-learn", "nlp", "computer-vision",
  "data-science", "analytics", "tableau", "power-bi",
  // Testing
  "jest", "mocha", "cypress", "playwright", "selenium", "pytest",
  "junit", "testing", "tdd", "bdd", "unit-testing", "e2e",
  // Soft skills / roles (commonly ATS-scanned)
  "leadership", "management", "communication", "collaboration",
  "problem-solving", "mentoring", "cross-functional", "stakeholder",
]);

/**
 * Generic filler words that should not count as meaningful keywords
 * even after stopword removal.
 */
const GENERIC_WORDS = new Set([
  "experience", "years", "team", "company", "role", "position",
  "responsibilities", "requirements", "qualifications", "candidate",
  "looking", "ideal", "join", "opportunity", "environment",
  "strong", "excellent", "preferred", "required", "minimum",
  "plus", "bonus", "benefit", "salary", "apply", "application",
  "description", "title", "location", "remote", "hybrid", "onsite",
  "full-time", "part-time", "contract",
]);

export type KeywordResult = {
  /** All important keywords extracted from the job description. */
  important: string[];
  /** Deduplicated set for fast lookups. */
  importantSet: Set<string>;
};

/**
 * Extract important keywords from a job description.
 *
 * Strategy:
 * 1. Normalize and tokenize the text
 * 2. Remove generic filler words
 * 3. Boost known tech keywords
 * 4. Return unique keywords sorted by relevance (tech terms first)
 */
export function extractKeywords(jobDescription: string): KeywordResult {
  const tokens = normalizeText(jobDescription);
  const seen = new Set<string>();
  const techMatches: string[] = [];
  const otherMatches: string[] = [];

  for (const token of tokens) {
    if (seen.has(token) || GENERIC_WORDS.has(token)) {
      continue;
    }
    seen.add(token);

    if (TECH_KEYWORDS.has(token)) {
      techMatches.push(token);
    } else {
      otherMatches.push(token);
    }
  }

  // Tech keywords first, then other meaningful terms
  const important = [...techMatches, ...otherMatches];

  return {
    important,
    importantSet: new Set(important),
  };
}

/**
 * Extract keyword tokens from resume text (for matching against JD keywords).
 */
export function extractResumeKeywords(resumeText: string): Set<string> {
  const tokens = normalizeText(resumeText);
  return new Set(tokens);
}
