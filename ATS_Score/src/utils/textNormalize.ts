const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "could", "should", "may", "might", "shall", "can", "need",
  "must", "it", "its", "this", "that", "these", "those", "i", "me",
  "my", "we", "us", "our", "you", "your", "he", "him", "his", "she",
  "her", "they", "them", "their", "what", "which", "who", "whom",
  "when", "where", "why", "how", "all", "each", "every", "both",
  "few", "more", "most", "other", "some", "such", "no", "not", "only",
  "own", "same", "so", "than", "too", "very", "just", "about", "above",
  "after", "again", "also", "any", "because", "before", "below",
  "between", "during", "into", "through", "under", "until", "up",
  "out", "over", "then", "once", "here", "there", "if", "else",
  "while", "per", "etc", "able", "well", "new", "get", "use", "used",
  "using", "make", "like", "including", "work", "working", "help",
  "within", "across", "along", "among",
]);

const PUNCTUATION_RE = /[^\w\s+#.-]/g;
const WHITESPACE_RE = /\s+/;

/**
 * Normalize text: lowercase, strip punctuation (preserving tech chars like +, #, .),
 * split into tokens, and remove stopwords.
 */
export function normalizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(PUNCTUATION_RE, " ")
    .split(WHITESPACE_RE)
    .map((token) => token.replace(/^[.\-]+|[.\-]+$/g, "").trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

/**
 * Check if a word is a stopword.
 */
export function isStopword(word: string): boolean {
  return STOPWORDS.has(word.toLowerCase());
}

/**
 * Build a frequency map from a list of tokens.
 */
export function buildFrequencyMap(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }
  return freq;
}
