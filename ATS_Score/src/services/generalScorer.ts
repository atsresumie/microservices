import { normalizeText, buildFrequencyMap } from "../utils/textNormalize.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type GeneralScoreResult = {
  score: number;
  breakdown: {
    sectionCompleteness: number;
    formatting: number;
    keywordStrength: number;
    actionVerbs: number;
    measurableResults: number;
    contactInfo: number;
  };
  sections: {
    summary: boolean;
    experience: boolean;
    skills: boolean;
    education: boolean;
    certifications: boolean;
    projects: boolean;
  };
  insights: {
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  };
  metadata: {
    wordCount: number;
    pageCount: number;
    detectedKeywords: string[];
  };
};

// ─── Weights ─────────────────────────────────────────────────────────────────

const WEIGHTS = {
  sectionCompleteness: 0.25,
  formatting: 0.20,
  keywordStrength: 0.20,
  actionVerbs: 0.15,
  measurableResults: 0.10,
  contactInfo: 0.10,
} as const;

// ─── Section Detection ──────────────────────────────────────────────────────

type SectionKeys = keyof GeneralScoreResult["sections"];

const SECTION_PATTERNS: Record<SectionKeys, RegExp> = {
  summary: /\b(summary|profile|objective|about\s*me|professional\s*summary)\b/i,
  experience: /\b(experience|work\s*history|employment|professional\s*experience)\b/i,
  skills: /\b(skills|technologies|technical\s*skills|core\s*competencies|proficiencies)\b/i,
  education: /\b(education|degree|university|college|academic)\b/i,
  certifications: /\b(certification|certifications|certified|licenses?|accreditation)\b/i,
  projects: /\b(projects|portfolio|personal\s*projects|side\s*projects)\b/i,
};

// ─── Action Verbs ────────────────────────────────────────────────────────────

const ACTION_VERBS = new Set([
  "achieved", "accelerated", "accomplished", "administered", "analyzed",
  "architected", "automated", "built", "championed", "collaborated",
  "conducted", "consolidated", "created", "debugged", "delivered",
  "deployed", "designed", "developed", "directed", "drove",
  "eliminated", "enabled", "engineered", "enhanced", "established",
  "evaluated", "executed", "expanded", "facilitated", "formulated",
  "generated", "grew", "guided", "headed", "identified",
  "implemented", "improved", "increased", "initiated", "innovated",
  "integrated", "introduced", "launched", "led", "leveraged",
  "managed", "mentored", "migrated", "modernized", "negotiated",
  "optimized", "orchestrated", "organized", "overhauled", "oversaw",
  "partnered", "performed", "pioneered", "planned", "presented",
  "produced", "programmed", "proposed", "published", "raised",
  "rebuilt", "reduced", "redesigned", "refactored", "reformed",
  "resolved", "restructured", "revamped", "scaled", "secured",
  "simplified", "spearheaded", "streamlined", "strengthened",
  "supervised", "supported", "trained", "transformed", "unified",
  "upgraded", "utilized", "validated", "wrote",
]);

// ─── Known Tech Keywords ────────────────────────────────────────────────────

const INDUSTRY_KEYWORDS = new Set([
  "javascript", "typescript", "python", "java", "c++", "c#", "ruby", "go",
  "react", "angular", "vue", "next.js", "node.js", "express", "django",
  "flask", "spring", "rails", "laravel", "sql", "nosql", "graphql",
  "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "dynamodb",
  "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "jenkins",
  "git", "github", "gitlab", "ci/cd", "agile", "scrum", "rest", "api",
  "microservices", "serverless", "machine-learning", "deep-learning",
  "tensorflow", "pytorch", "data-science", "analytics", "devops",
  "html", "css", "sass", "webpack", "vite", "tailwind", "bootstrap",
  "jest", "cypress", "playwright", "selenium", "testing", "tdd",
  "leadership", "management", "communication", "collaboration",
  "problem-solving", "mentoring", "cross-functional", "stakeholder",
  "supabase", "firebase", "prisma", "vercel", "netlify",
  "oauth", "jwt", "websocket", "grpc", "kafka", "rabbitmq",
]);

// ─── Contact Info Patterns ───────────────────────────────────────────────────

const CONTACT_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
  linkedin: /linkedin\.com\/in\/[a-zA-Z0-9_-]+/i,
  github: /github\.com\/[a-zA-Z0-9_-]+/i,
  website: /https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
};

// ─── Measurable Results ──────────────────────────────────────────────────────

const METRICS_PATTERN = /\b(\d{1,3}[,%]|\$\d+[kKmMbB]?|\d+\s*(?:percent|%|x|times|users|clients|customers|projects|applications|team\s*members))\b/gi;

// ─── Scoring Functions ──────────────────────────────────────────────────────

function scoreSections(resumeText: string): { sections: GeneralScoreResult["sections"]; score: number } {
  const sections: GeneralScoreResult["sections"] = {
    summary: SECTION_PATTERNS.summary.test(resumeText),
    experience: SECTION_PATTERNS.experience.test(resumeText),
    skills: SECTION_PATTERNS.skills.test(resumeText),
    education: SECTION_PATTERNS.education.test(resumeText),
    certifications: SECTION_PATTERNS.certifications.test(resumeText),
    projects: SECTION_PATTERNS.projects.test(resumeText),
  };

  const keys = Object.keys(sections) as SectionKeys[];
  // Core sections (summary, experience, skills, education) weighted more heavily
  const coreKeys: SectionKeys[] = ["summary", "experience", "skills", "education"];
  const bonusKeys: SectionKeys[] = ["certifications", "projects"];

  const corePresent = coreKeys.filter((k) => sections[k]).length;
  const bonusPresent = bonusKeys.filter((k) => sections[k]).length;

  // Core sections: 80% of score, bonus sections: 20%
  const coreScore = (corePresent / coreKeys.length) * 80;
  const bonusScore = (bonusPresent / bonusKeys.length) * 20;

  return { sections, score: Math.min(100, Math.round(coreScore + bonusScore)) };
}

function scoreFormatting(resumeText: string): number {
  let score = 0;

  const bulletCount = (resumeText.match(/^[\s]*[-*•▪►]\s/gm) ?? []).length;
  if (bulletCount >= 8) score += 30;
  else if (bulletCount >= 4) score += 20;
  else if (bulletCount >= 1) score += 10;

  const lines = resumeText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const headerLines = lines.filter(
    (line) => line.length < 50 && /^[A-Z]/.test(line) && !/[.!?]$/.test(line)
  );
  if (headerLines.length >= 4) score += 25;
  else if (headerLines.length >= 2) score += 15;

  const wordCount = resumeText.split(/\s+/).length;
  if (wordCount >= 300 && wordCount <= 800) score += 25;
  else if (wordCount >= 200 && wordCount <= 1200) score += 20;
  else if (wordCount >= 100) score += 10;

  const paragraphs = resumeText.split(/\n\s*\n/).length;
  if (paragraphs >= 4) score += 20;
  else if (paragraphs >= 2) score += 10;

  return Math.min(100, score);
}

function scoreKeywordStrength(resumeText: string): { score: number; detected: string[] } {
  const tokens = normalizeText(resumeText);
  const tokenSet = new Set(tokens);

  const detected: string[] = [];
  for (const keyword of INDUSTRY_KEYWORDS) {
    if (tokenSet.has(keyword)) {
      detected.push(keyword);
    }
  }

  // Score based on number of industry keywords found
  let score: number;
  if (detected.length >= 15) score = 100;
  else if (detected.length >= 10) score = 85;
  else if (detected.length >= 6) score = 65;
  else if (detected.length >= 3) score = 45;
  else if (detected.length >= 1) score = 25;
  else score = 5;

  return { score, detected };
}

function scoreActionVerbs(resumeText: string): number {
  const tokens = normalizeText(resumeText);
  const freq = buildFrequencyMap(tokens);

  let verbCount = 0;
  const uniqueVerbs = new Set<string>();
  for (const [token, count] of freq) {
    if (ACTION_VERBS.has(token)) {
      verbCount += count;
      uniqueVerbs.add(token);
    }
  }

  // Score based on unique action verbs
  let score: number;
  if (uniqueVerbs.size >= 12) score = 100;
  else if (uniqueVerbs.size >= 8) score = 80;
  else if (uniqueVerbs.size >= 5) score = 60;
  else if (uniqueVerbs.size >= 2) score = 35;
  else if (uniqueVerbs.size >= 1) score = 15;
  else score = 0;

  return Math.min(100, score);
}

function scoreMeasurableResults(resumeText: string): number {
  const matches = resumeText.match(METRICS_PATTERN) ?? [];
  const uniqueMetrics = new Set(matches.map((m) => m.toLowerCase().trim()));

  let score: number;
  if (uniqueMetrics.size >= 6) score = 100;
  else if (uniqueMetrics.size >= 4) score = 80;
  else if (uniqueMetrics.size >= 2) score = 55;
  else if (uniqueMetrics.size >= 1) score = 30;
  else score = 0;

  return score;
}

function scoreContactInfo(resumeText: string): number {
  let score = 0;
  const max = 100;

  if (CONTACT_PATTERNS.email.test(resumeText)) score += 30;
  if (CONTACT_PATTERNS.phone.test(resumeText)) score += 25;
  if (CONTACT_PATTERNS.linkedin.test(resumeText)) score += 25;
  if (CONTACT_PATTERNS.github.test(resumeText)) score += 10;
  if (CONTACT_PATTERNS.website.test(resumeText)) score += 10;

  return Math.min(max, score);
}

// ─── Insight Generation ─────────────────────────────────────────────────────

function generateInsights(
  breakdown: GeneralScoreResult["breakdown"],
  sections: GeneralScoreResult["sections"],
  detectedKeywords: string[]
): GeneralScoreResult["insights"] {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const suggestions: string[] = [];

  // Sections
  const sectionKeys = Object.keys(sections) as SectionKeys[];
  const coreKeys: SectionKeys[] = ["summary", "experience", "skills", "education"];
  const missingCore = coreKeys.filter((k) => !sections[k]);

  if (missingCore.length === 0) {
    strengths.push("All core resume sections are present");
  } else {
    const names: Record<string, string> = {
      summary: "Summary/Profile", experience: "Work Experience",
      skills: "Skills", education: "Education",
    };
    for (const s of missingCore) {
      weaknesses.push(`Missing ${names[s]} section`);
      suggestions.push(`Add a ${names[s]} section`);
    }
  }
  if (sections.certifications) strengths.push("Includes certifications");
  if (sections.projects) strengths.push("Includes projects section");

  // Formatting
  if (breakdown.formatting >= 70) strengths.push("Well-structured resume with good formatting");
  else if (breakdown.formatting < 40) {
    weaknesses.push("Resume formatting needs improvement");
    suggestions.push("Use bullet points to highlight achievements and responsibilities");
  }

  // Keywords
  if (breakdown.keywordStrength >= 70) strengths.push(`Strong keyword presence (${detectedKeywords.length} industry terms detected)`);
  else if (breakdown.keywordStrength < 40) {
    weaknesses.push("Low industry keyword presence");
    suggestions.push("Include more relevant technical skills and industry terms");
  }

  // Action verbs
  if (breakdown.actionVerbs >= 70) strengths.push("Good use of action verbs throughout the resume");
  else if (breakdown.actionVerbs < 40) {
    weaknesses.push("Limited use of strong action verbs");
    suggestions.push("Start bullet points with action verbs like \"Built\", \"Led\", \"Designed\", \"Optimized\"");
  }

  // Measurable results
  if (breakdown.measurableResults >= 60) strengths.push("Includes quantifiable achievements and metrics");
  else {
    weaknesses.push("Few or no quantifiable achievements");
    suggestions.push("Add measurable results (e.g., \"Increased performance by 40%\", \"Managed team of 8\")");
  }

  // Contact info
  if (breakdown.contactInfo >= 70) strengths.push("Contact information is complete");
  else if (breakdown.contactInfo < 40) {
    weaknesses.push("Incomplete contact information");
    suggestions.push("Include email, phone number, and LinkedIn profile URL");
  }

  return { strengths, weaknesses, suggestions };
}

// ─── Main Function ──────────────────────────────────────────────────────────

export function scoreResumeGeneral(resumeText: string, pageCount: number): GeneralScoreResult {
  const { sections, score: sectionScore } = scoreSections(resumeText);
  const formatting = scoreFormatting(resumeText);
  const { score: keywordScore, detected } = scoreKeywordStrength(resumeText);
  const actionVerbs = scoreActionVerbs(resumeText);
  const measurableResults = scoreMeasurableResults(resumeText);
  const contactInfo = scoreContactInfo(resumeText);

  const breakdown = {
    sectionCompleteness: sectionScore,
    formatting,
    keywordStrength: keywordScore,
    actionVerbs,
    measurableResults,
    contactInfo,
  };

  const weighted =
    breakdown.sectionCompleteness * WEIGHTS.sectionCompleteness +
    breakdown.formatting * WEIGHTS.formatting +
    breakdown.keywordStrength * WEIGHTS.keywordStrength +
    breakdown.actionVerbs * WEIGHTS.actionVerbs +
    breakdown.measurableResults * WEIGHTS.measurableResults +
    breakdown.contactInfo * WEIGHTS.contactInfo;

  const score = Math.min(100, Math.max(0, Math.round(weighted)));
  const insights = generateInsights(breakdown, sections, detected);
  const wordCount = resumeText.split(/\s+/).filter((w) => w.length > 0).length;

  return {
    score,
    breakdown,
    sections,
    insights,
    metadata: {
      wordCount,
      pageCount,
      detectedKeywords: detected,
    },
  };
}
