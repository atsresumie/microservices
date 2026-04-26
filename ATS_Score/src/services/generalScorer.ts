import { getAnthropicClient, getAnthropicModel } from "./aiClient.js";

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

// ─── Tool Schema ─────────────────────────────────────────────────────────────

const SUBMIT_SCORE_GENERAL_TOOL = {
  name: "submit_score_general",
  description:
    "Submit the general ATS-friendliness score for a resume (no job description). All scores are 0-100 integers.",
  input_schema: {
    type: "object",
    properties: {
      score: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "Final weighted ATS-friendliness score (0-100).",
      },
      breakdown: {
        type: "object",
        properties: {
          sectionCompleteness: { type: "integer", minimum: 0, maximum: 100 },
          formatting: { type: "integer", minimum: 0, maximum: 100 },
          keywordStrength: { type: "integer", minimum: 0, maximum: 100 },
          actionVerbs: { type: "integer", minimum: 0, maximum: 100 },
          measurableResults: { type: "integer", minimum: 0, maximum: 100 },
          contactInfo: { type: "integer", minimum: 0, maximum: 100 },
        },
        required: [
          "sectionCompleteness",
          "formatting",
          "keywordStrength",
          "actionVerbs",
          "measurableResults",
          "contactInfo",
        ],
        additionalProperties: false,
      },
      sections: {
        type: "object",
        properties: {
          summary: { type: "boolean" },
          experience: { type: "boolean" },
          skills: { type: "boolean" },
          education: { type: "boolean" },
          certifications: { type: "boolean" },
          projects: { type: "boolean" },
        },
        required: [
          "summary",
          "experience",
          "skills",
          "education",
          "certifications",
          "projects",
        ],
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
      detectedKeywords: {
        type: "array",
        items: { type: "string" },
        description: "Industry/technical keywords detected in the resume.",
      },
    },
    required: ["score", "breakdown", "sections", "insights", "detectedKeywords"],
    additionalProperties: false,
  },
} as const;

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a deterministic Applicant Tracking System (ATS) friendliness scoring engine. You evaluate a resume on its own (no specific job description) across six dimensions and return a structured score.

Scoring dimensions and weights (final score is the weighted sum, rounded to integer 0-100):
- sectionCompleteness (25%): Presence of summary/profile, work experience, skills, and education (core), plus certifications and projects (bonus). Core sections weigh more than bonus sections.
- formatting (20%): Use of bullet points, clear section headers, reasonable length (300-800 words is ideal), and consistent paragraph structure.
- keywordStrength (20%): Density of recognizable industry/technical keywords (programming languages, frameworks, tools, methodologies, soft skills).
- actionVerbs (15%): Use of strong action verbs to start bullet points (e.g., "Built", "Led", "Designed", "Optimized", "Implemented"). Reward variety of unique verbs.
- measurableResults (10%): Presence of quantified achievements (percentages, dollar amounts, counts, multipliers).
- contactInfo (10%): Completeness of contact information (email, phone, LinkedIn, GitHub, personal website).

Rules:
- All scores must be integers between 0 and 100.
- Sections booleans must reflect actual presence in the resume text.
- "detectedKeywords" should list the industry/technical keywords you actually identified in the resume.
- Provide concise, actionable insights: 2-5 strengths, 2-5 weaknesses, 2-5 suggestions. Suggestions should be concrete improvements.
- Always call the submit_score_general tool. Do not produce free-form text.`;

// ─── Main Function ──────────────────────────────────────────────────────────

export async function scoreResumeGeneral(
  resumeText: string,
  pageCount: number
): Promise<GeneralScoreResult> {
  const client = getAnthropicClient();
  const model = getAnthropicModel();

  const userMessage = `RESUME:
"""
${resumeText}
"""

Score this resume for general ATS-friendliness and submit the result via the submit_score_general tool.`;

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    temperature: 0,
    system: SYSTEM_PROMPT,
    tools: [SUBMIT_SCORE_GENERAL_TOOL],
    tool_choice: { type: "tool", name: "submit_score_general" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use" || toolUse.name !== "submit_score_general") {
    throw new Error("Anthropic response did not include the submit_score_general tool call");
  }

  const aiResult = toolUse.input as Omit<GeneralScoreResult, "metadata"> & {
    detectedKeywords: string[];
  };

  const wordCount = resumeText.split(/\s+/).filter((w) => w.length > 0).length;

  return {
    score: aiResult.score,
    breakdown: aiResult.breakdown,
    sections: aiResult.sections,
    insights: aiResult.insights,
    metadata: {
      wordCount,
      pageCount,
      detectedKeywords: aiResult.detectedKeywords,
    },
  };
}
