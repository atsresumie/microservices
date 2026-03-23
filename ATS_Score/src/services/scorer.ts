import { buildFrequencyMap, normalizeText } from "../utils/textNormalize.js";
import { jaccardSimilarity, setIntersection, setDifference } from "../utils/similarity.js";
import type { KeywordResult } from "./keywordExtractor.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SectionPresence = {
  summary: boolean;
  experience: boolean;
  skills: boolean;
  education: boolean;
};

export type ScoreBreakdown = {
  keywordMatch: number;
  experienceRelevance: number;
  sectionCompleteness: number;
  formatting: number;
  keywordDistribution: number;
};

export type KeywordAnalysis = {
  matched: string[];
  missing: string[];
  important: string[];
};

export type ScoreResult = {
  score: number;
  breakdown: ScoreBreakdown;
  keywords: KeywordAnalysis;
  sections: SectionPresence;
};

// ─── Weights ─────────────────────────────────────────────────────────────────

const WEIGHTS = {
  keywordMatch: 0.45,
  experienceRelevance: 0.20,
  sectionCompleteness: 0.15,
  formatting: 0.10,
  keywordDistribution: 0.10,
} as const;

// ─── Section Detection ──────────────────────────────────────────────────────

const SECTION_PATTERNS: Record<keyof SectionPresence, RegExp> = {
  summary: /\b(summary|profile|objective|about\s*me|professional\s*summary)\b/i,
  experience: /\b(experience|work\s*history|employment|professional\s*experience)\b/i,
  skills: /\b(skills|technologies|technical\s*skills|core\s*competencies|proficiencies)\b/i,
  education: /\b(education|degree|university|college|academic|certification|certifications)\b/i,
};

export function detectSections(resumeText: string): SectionPresence {
  return {
    summary: SECTION_PATTERNS.summary.test(resumeText),
    experience: SECTION_PATTERNS.experience.test(resumeText),
    skills: SECTION_PATTERNS.skills.test(resumeText),
    education: SECTION_PATTERNS.education.test(resumeText),
  };
}

// ─── Keyword Match Score ────────────────────────────────────────────────────

export function computeKeywordMatch(
  resumeKeywords: Set<string>,
  jdKeywords: KeywordResult
): { score: number; matched: string[]; missing: string[] } {
  const matched = setIntersection(resumeKeywords, jdKeywords.importantSet);
  const missing = setDifference(jdKeywords.importantSet, resumeKeywords);

  const score =
    jdKeywords.importantSet.size === 0
      ? 0
      : (matched.size / jdKeywords.importantSet.size) * 100;

  return {
    score: Math.min(100, Math.round(score)),
    matched: [...matched],
    missing: [...missing],
  };
}

// ─── Experience Relevance (Jaccard) ─────────────────────────────────────────

export function computeExperienceRelevance(
  resumeTokens: string[],
  jdTokens: string[]
): number {
  const resumeSet = new Set(resumeTokens);
  const jdSet = new Set(jdTokens);
  const similarity = jaccardSimilarity(resumeSet, jdSet);
  return Math.min(100, Math.round(similarity * 100));
}

// ─── Section Completeness Score ─────────────────────────────────────────────

export function computeSectionCompleteness(sections: SectionPresence): number {
  const keys = Object.keys(sections) as (keyof SectionPresence)[];
  const present = keys.filter((k) => sections[k]).length;
  return Math.round((present / keys.length) * 100);
}

// ─── Formatting Score ───────────────────────────────────────────────────────

export function computeFormattingScore(resumeText: string): number {
  let score = 0;

  // Check for bullet points (-, *, •, ▪, ►)
  const bulletPattern = /^[\s]*[-*•▪►]\s/m;
  const bulletCount = (resumeText.match(/^[\s]*[-*•▪►]\s/gm) ?? []).length;
  if (bulletPattern.test(resumeText)) {
    score += bulletCount >= 5 ? 35 : bulletCount >= 2 ? 25 : 15;
  }

  // Check for section headers (heuristic: lines that are short and possibly uppercase/title-case)
  const lines = resumeText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const headerLikeLines = lines.filter(
    (line) => line.length < 40 && /^[A-Z]/.test(line) && !/[.!?]$/.test(line)
  );
  if (headerLikeLines.length >= 3) {
    score += 25;
  } else if (headerLikeLines.length >= 1) {
    score += 15;
  }

  // Reasonable length (300–5000 words is healthy)
  const wordCount = resumeText.split(/\s+/).length;
  if (wordCount >= 300 && wordCount <= 5000) {
    score += 25;
  } else if (wordCount >= 100 && wordCount <= 8000) {
    score += 15;
  } else {
    score += 5;
  }

  // Consistent structure: presence of newlines and paragraphs
  const paragraphs = resumeText.split(/\n\s*\n/).length;
  if (paragraphs >= 3) {
    score += 15;
  } else if (paragraphs >= 2) {
    score += 10;
  }

  return Math.min(100, score);
}

// ─── Keyword Distribution Score ─────────────────────────────────────────────

export function computeKeywordDistribution(
  resumeText: string,
  matchedKeywords: string[]
): number {
  if (matchedKeywords.length === 0) {
    return 0;
  }

  const resumeLower = resumeText.toLowerCase();
  // Split resume into rough thirds
  const thirdLen = Math.max(1, Math.floor(resumeLower.length / 3));
  const sections = [
    resumeLower.slice(0, thirdLen),
    resumeLower.slice(thirdLen, thirdLen * 2),
    resumeLower.slice(thirdLen * 2),
  ];

  let multiOccurrenceCount = 0;
  let distributedCount = 0;

  for (const keyword of matchedKeywords) {
    // Check multiple occurrences
    const fullFreq = buildFrequencyMap(normalizeText(resumeLower));
    if ((fullFreq.get(keyword) ?? 0) > 1) {
      multiOccurrenceCount++;
    }

    // Check distribution across sections
    const inSections = sections.filter((s) => s.includes(keyword)).length;
    if (inSections >= 2) {
      distributedCount++;
    }
  }

  const multiRatio = multiOccurrenceCount / matchedKeywords.length;
  const distRatio = distributedCount / matchedKeywords.length;

  // 50% weight on multi-occurrence, 50% on section distribution
  const score = (multiRatio * 50 + distRatio * 50);
  return Math.min(100, Math.round(score));
}

// ─── Final Score ────────────────────────────────────────────────────────────

export function computeFinalScore(breakdown: ScoreBreakdown): number {
  const weighted =
    breakdown.keywordMatch * WEIGHTS.keywordMatch +
    breakdown.experienceRelevance * WEIGHTS.experienceRelevance +
    breakdown.sectionCompleteness * WEIGHTS.sectionCompleteness +
    breakdown.formatting * WEIGHTS.formatting +
    breakdown.keywordDistribution * WEIGHTS.keywordDistribution;

  return Math.min(100, Math.max(0, Math.round(weighted)));
}
