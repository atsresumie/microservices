import { normalizeText } from "../utils/textNormalize.js";
import { extractKeywords, extractResumeKeywords } from "./keywordExtractor.js";
import {
  computeKeywordMatch,
  computeExperienceRelevance,
  computeSectionCompleteness,
  computeFormattingScore,
  computeKeywordDistribution,
  computeFinalScore,
  detectSections,
  type ScoreBreakdown,
  type SectionPresence,
  type KeywordAnalysis,
} from "./scorer.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AnalysisResult = {
  score: number;
  breakdown: ScoreBreakdown;
  keywords: KeywordAnalysis;
  sections: SectionPresence;
  insights: {
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  };
};

// ─── Main Analysis Function ─────────────────────────────────────────────────

export function analyzeResume(resumeText: string, jobDescription: string): AnalysisResult {
  // 1. Extract keywords from JD and resume
  const jdKeywords = extractKeywords(jobDescription);
  const resumeKeywords = extractResumeKeywords(resumeText);

  // 2. Keyword matching
  const keywordResult = computeKeywordMatch(resumeKeywords, jdKeywords);

  // 3. Experience relevance (Jaccard similarity on full token sets)
  const jdTokens = normalizeText(jobDescription);
  const resumeTokens = normalizeText(resumeText);
  const experienceRelevance = computeExperienceRelevance(resumeTokens, jdTokens);

  // 4. Section detection & completeness
  const sections = detectSections(resumeText);
  const sectionCompleteness = computeSectionCompleteness(sections);

  // 5. Formatting
  const formatting = computeFormattingScore(resumeText);

  // 6. Keyword distribution
  const keywordDistribution = computeKeywordDistribution(resumeText, keywordResult.matched);

  // 7. Build breakdown and final score
  const breakdown: ScoreBreakdown = {
    keywordMatch: keywordResult.score,
    experienceRelevance,
    sectionCompleteness,
    formatting,
    keywordDistribution,
  };

  const score = computeFinalScore(breakdown);

  // 8. Generate insights
  const insights = generateInsights(breakdown, keywordResult, sections, jdKeywords.important);

  return {
    score,
    breakdown,
    keywords: {
      matched: keywordResult.matched,
      missing: keywordResult.missing,
      important: jdKeywords.important,
    },
    sections,
    insights,
  };
}

// ─── Insight Generation ─────────────────────────────────────────────────────

function generateInsights(
  breakdown: ScoreBreakdown,
  keywordResult: { score: number; matched: string[]; missing: string[] },
  sections: SectionPresence,
  importantKeywords: string[]
): AnalysisResult["insights"] {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const suggestions: string[] = [];

  // ── Keyword Match Insights ─────────────────────────────────────────────

  if (breakdown.keywordMatch >= 75) {
    strengths.push("Strong keyword alignment with the job description");
  } else if (breakdown.keywordMatch >= 50) {
    strengths.push("Moderate keyword match with the job description");
  } else {
    weaknesses.push("Low keyword match with the job description");
  }

  if (keywordResult.missing.length > 0 && keywordResult.missing.length <= 10) {
    suggestions.push(`Add missing keywords: ${keywordResult.missing.join(", ")}`);
  } else if (keywordResult.missing.length > 10) {
    const topMissing = keywordResult.missing.slice(0, 8);
    suggestions.push(
      `Add missing keywords (top ${topMissing.length} of ${keywordResult.missing.length}): ${topMissing.join(", ")}`
    );
  }

  // ── Section Insights ───────────────────────────────────────────────────

  const sectionKeys = Object.keys(sections) as (keyof SectionPresence)[];
  const presentSections = sectionKeys.filter((k) => sections[k]);
  const missingSections = sectionKeys.filter((k) => !sections[k]);

  if (presentSections.length === sectionKeys.length) {
    strengths.push("All essential resume sections are present");
  } else if (presentSections.length >= 3) {
    strengths.push("Good section coverage in the resume");
  }

  if (missingSections.length > 0) {
    const sectionNames: Record<keyof SectionPresence, string> = {
      summary: "Summary/Profile",
      experience: "Work Experience",
      skills: "Skills/Technologies",
      education: "Education",
    };
    for (const section of missingSections) {
      weaknesses.push(`Missing ${sectionNames[section]} section`);
      suggestions.push(`Include a ${sectionNames[section]} section`);
    }
  }

  // ── Experience Relevance Insights ──────────────────────────────────────

  if (breakdown.experienceRelevance >= 60) {
    strengths.push("Experience closely aligns with job requirements");
  } else if (breakdown.experienceRelevance < 30) {
    weaknesses.push("Limited overlap between your experience and the job requirements");
    suggestions.push("Tailor your experience descriptions to mirror the language in the job posting");
  }

  // ── Formatting Insights ────────────────────────────────────────────────

  if (breakdown.formatting >= 70) {
    strengths.push("Well-formatted resume with good structure");
  } else if (breakdown.formatting < 40) {
    weaknesses.push("Resume formatting could be improved");
    suggestions.push("Use more bullet points to highlight achievements and responsibilities");
  }

  // ── Keyword Distribution Insights ──────────────────────────────────────

  if (breakdown.keywordDistribution >= 60) {
    strengths.push("Keywords are well distributed throughout the resume");
  } else if (breakdown.keywordDistribution < 30 && keywordResult.matched.length > 0) {
    weaknesses.push("Keywords are concentrated in one area of the resume");
    suggestions.push("Distribute relevant keywords across multiple sections for better ATS coverage");
  }

  return { strengths, weaknesses, suggestions };
}
