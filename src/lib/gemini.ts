import { GoogleGenAI, type GenerateContentConfig } from "@google/genai";

/**
 * Preferred model first, then fallbacks with separate (and larger) free-tier
 * daily quotas. Each model's quota is counted independently by Google, so when
 * the main model's free allowance runs out for the day, the app keeps giving
 * real AI answers on a lighter model instead of failing.
 */
const MODEL_CHAIN = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
];

// Errors where trying the next model in the chain can help: this model's free
// daily quota is exhausted, or Google reports it momentarily overloaded.
function isFallbackWorthyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /RESOURCE_EXHAUSTED|quota|429|UNAVAILABLE|overloaded|high demand|503/i.test(msg);
}

export async function generateWithFallback(
  ai: GoogleGenAI,
  contents: string,
  config?: GenerateContentConfig
): Promise<string> {
  let lastError: unknown = null;
  for (const model of MODEL_CHAIN) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        ...(config ? { config } : {}),
      });
      const text = response.text;
      if (!text) throw new Error(`Empty response from ${model}`);
      return text;
    } catch (err) {
      lastError = err;
      if (!isFallbackWorthyError(err)) throw err;
      console.warn(`${model} unavailable (quota/overload), trying next fallback model`);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
