import { getAnthropicClient, getAnthropicModel } from "./aiClient.js";

// ─── Types ───────────────────────────────────────────────────────────────────

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

export type SectionPresence = {
  summary: boolean;
  experience: boolean;
  skills: boolean;
  education: boolean;
};

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

// ─── Tool Schema ─────────────────────────────────────────────────────────────

const SUBMIT_SCORE_TOOL = {
  name: "submit_score",
  description:
    "Submit the final ATS analysis result for a resume against a job description. All scores are 0-100 integers.",
  input_schema: {
    type: "object",
    properties: {
      score: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "Final weighted ATS score (0-100).",
      },
      breakdown: {
        type: "object",
        properties: {
          keywordMatch: { type: "integer", minimum: 0, maximum: 100 },
          experienceRelevance: { type: "integer", minimum: 0, maximum: 100 },
          sectionCompleteness: { type: "integer", minimum: 0, maximum: 100 },
          formatting: { type: "integer", minimum: 0, maximum: 100 },
          keywordDistribution: { type: "integer", minimum: 0, maximum: 100 },
        },
        required: [
          "keywordMatch",
          "experienceRelevance",
          "sectionCompleteness",
          "formatting",
          "keywordDistribution",
        ],
        additionalProperties: false,
      },
      keywords: {
        type: "object",
        properties: {
          matched: {
            type: "array",
            items: { type: "string" },
            description: "Important JD keywords/skills present in the resume.",
          },
          missing: {
            type: "array",
            items: { type: "string" },
            description: "Important JD keywords/skills missing from the resume.",
          },
          important: {
            type: "array",
            items: { type: "string" },
            description: "All important keywords/skills extracted from the JD.",
          },
        },
        required: ["matched", "missing", "important"],
        additionalProperties: false,
      },
      sections: {
        type: "object",
        properties: {
          summary: { type: "boolean" },
          experience: { type: "boolean" },
          skills: { type: "boolean" },
          education: { type: "boolean" },
        },
        required: ["summary", "experience", "skills", "education"],
        additionalProperties: false,
      },
      insights: {
        type: "object",
        properties: {
          strengths: { type: "array", items: { type: "string" } },
          weaknesses: { type: "array", items: { type: "string" } },
          suggestions: { type: "array", items: { type: "string" } },
        },
        required: ["strengths", "weaknesses", "suggestions"],
        additionalProperties: false,
      },
    },
    required: ["score", "breakdown", "keywords", "sections", "insights"],
    additionalProperties: false,
  },
} as const;

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a deterministic Applicant Tracking System (ATS) scoring engine. You evaluate a resume against a specific job description across five dimensions and return a structured score.

Scoring dimensions and weights (final score is the weighted sum, rounded to integer 0-100):
- keywordMatch (45%): Percentage of important JD keywords/skills/technologies present in the resume.
- experienceRelevance (20%): How closely the candidate's experience descriptions overlap with the JD's responsibilities and required experience.
- sectionCompleteness (15%): Presence of summary/profile, work experience, skills, and education sections.
- formatting (10%): Use of bullet points, clear section headers, reasonable length, and consistent structure.
- keywordDistribution (10%): Whether matched keywords appear across multiple sections of the resume rather than concentrated in one place.

Rules:
- All scores must be integers between 0 and 100.
- "important" keywords should include the most relevant skills, technologies, and qualifications extracted from the job description (typically 10-30 items).
- "matched" must be a subset of "important" that also appears in the resume.
- "missing" must be the items in "important" that are absent from the resume.
- Sections booleans must reflect actual presence in the resume text.
- Provide concise, actionable insights: 2-5 strengths, 2-5 weaknesses, 2-5 suggestions. Suggestions should be concrete improvements the candidate can make.
- Always call the submit_score tool. Do not produce free-form text.`;

// ─── Main Analysis Function ─────────────────────────────────────────────────

export async function analyzeResume(
  resumeText: string,
  jobDescription: string
): Promise<AnalysisResult> {
  const client = getAnthropicClient();
  const model = getAnthropicModel();

  const userMessage = `JOB DESCRIPTION:
"""
${jobDescription}
"""

RESUME:
"""
${resumeText}
"""

Score this resume against the job description and submit the result via the submit_score tool.`;

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    temperature: 0,
    system: SYSTEM_PROMPT,
    tools: [SUBMIT_SCORE_TOOL],
    tool_choice: { type: "tool", name: "submit_score" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use" || toolUse.name !== "submit_score") {
    throw new Error("Anthropic response did not include the submit_score tool call");
  }

  return toolUse.input as AnalysisResult;
}
