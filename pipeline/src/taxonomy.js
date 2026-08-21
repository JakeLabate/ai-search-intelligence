/* The controlled vocabularies. The visualisation's filters are built from these,
   so the extractor is forced to choose from them — free-text tags would make the
   chips meaningless within a week. Edit here, edit the viz, never one alone. */

export const SOURCE_TYPES = [
  { id: "community", name: "Community & forum" },
  { id: "editorial", name: "Editorial & news" },
  { id: "review",    name: "Review & compare" },
  { id: "owned",     name: "Owned / brand" },
  { id: "reference", name: "Reference & docs" },
  { id: "video",     name: "Video & social" },
];

export const INTENTS = [
  { id: "compare",   name: "Comparison" },
  { id: "recommend", name: "Recommendation" },
  { id: "howto",     name: "How-to / setup" },
  { id: "info",      name: "Informational" },
  { id: "problem",   name: "Problem / complaint" },
];

export const TONES = [
  "Endorsing", "Enthusiastic", "Recommending", "Reassuring",
  "Neutral-factual", "Descriptive", "Hedged", "Comparative",
  "Cautionary", "Skeptical", "Dismissive", "Warning",
];

/* Nuance is the whole point of the tool: WHY a citation helps or hurts,
   beyond the sentiment number. Keep this list short enough to filter on. */
export const NUANCE = [
  "first citation", "buried citation", "anecdote as evidence", "own-domain echo",
  "negative from authority", "stale data", "brand confusion", "competitor favoured",
  "pricing error", "feature omitted", "outdated pricing", "unsourced claim",
  "recommendation list", "comparison table", "direct quote", "paraphrased",
];

export const CHANNELS = [
  { id: "chatgpt",    name: "ChatGPT",             env: "OPENAI_API_KEY",     module: "openai" },
  { id: "claude",     name: "Claude",              env: "ANTHROPIC_API_KEY",  module: "anthropic" },
  { id: "perplexity", name: "Perplexity",          env: "PERPLEXITY_API_KEY", module: "perplexity" },
  { id: "gemini",     name: "Gemini",              env: "GEMINI_API_KEY",     module: "gemini" },
  { id: "aio",        name: "Google AI Overviews", env: "SERPAPI_KEY",        module: "aioverview" },
];
