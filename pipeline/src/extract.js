import { structured } from "./llm.js";
import { TONES, NUANCE } from "./taxonomy.js";

/* The step that separates this from a rank tracker.
   A citation on its own tells you a link appeared. This pass reads the sentence
   the link was supporting and records WHICH brand it served, how warmly, in what
   register, and what is wrong with it — the nuance tags are where "cited but
   damaged" and "cited but for a competitor" become filterable. */

export async function extractAnswer({ profile, channelName, query, answer, citations }) {
  const brandIds = ["client", ...profile.competitors.map((_, i) => `comp${i}`), "none"];
  const roster = [
    `client = ${profile.brand} (${profile.product})${profile.aliases?.length ? ` — also called ${profile.aliases.join(", ")}` : ""}`,
    ...profile.competitors.map((c, i) => `comp${i} = ${c.name}`),
    `none = the citation supports no tracked brand`,
  ].join("\n");

  const numbered = citations.map((c, i) => `[${i + 1}] ${c.host || c.url} — ${c.title || "(untitled)"}${c.snippet ? `\n    quoted: "${String(c.snippet).slice(0, 240)}"` : ""}`).join("\n");

  const schema = {
    type: "object",
    properties: {
      answerSummary: { type: "string", description: "One sentence: what the answer told the reader to do." },
      brandsMentioned: {
        type: "array",
        items: { type: "object", properties: {
          brand: { type: "string", enum: brandIds.filter((b) => b !== "none") },
          order: { type: "integer", description: "1 = named first in the answer" },
          recommended: { type: "boolean" },
        }, required: ["brand", "order", "recommended"] },
      },
      citations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index:     { type: "integer", description: "1-based, matches the numbered list" },
            brand:     { type: "string", enum: brandIds },
            sentiment: { type: "number", description: "-1 hostile … 0 neutral … +1 glowing, about the brand named in `brand`" },
            tone:      { type: "string", enum: TONES },
            claim:     { type: "string", description: "The specific assertion this source was used to support, in <=20 words." },
            evidence:  { type: "string", description: "The sentence from the answer that carries this citation, verbatim, <=45 words." },
            nuance:    { type: "array", items: { type: "string", enum: NUANCE }, description: "0-3 tags" },
          },
          required: ["index", "brand", "sentiment", "tone", "claim", "evidence", "nuance"],
        },
      },
    },
    required: ["answerSummary", "brandsMentioned", "citations"],
  };

  return structured({
    name: "extraction",
    schema,
    maxTokens: 8000,
    system:
      "You are auditing one AI assistant answer for a brand-visibility study. Work only from the text given. " +
      "Score sentiment about the brand the citation was used to support — not the overall vibe of the answer, " +
      "and not your own opinion of the brand. A citation that supports a rival's advantage is negative for that " +
      "rival's competitor only if the answer says so; otherwise attribute it to the brand it actually serves. " +
      "If a citation supports a general/definitional point, brand = none and sentiment = 0. " +
      "Never invent citations: return exactly one entry per numbered citation, in order.",
    user:
      `Assistant: ${channelName}\nQuery: "${query}"\n\nBrand roster:\n${roster}\n\n` +
      `Cited sources:\n${numbered}\n\n---\nANSWER TEXT:\n${answer}`,
  });
}
