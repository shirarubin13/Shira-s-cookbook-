import { GoogleGenAI, type GenerateContentConfig } from "@google/genai";

/**
 * Models are tried in order. Two things decide this list, both learned the hard way:
 *
 * 1. Gemini models "think" before answering unless told not to. For a recipe — a big
 *    structured JSON answer — that reasoning cost more than a minute, past the 60s
 *    Vercel allows a function to run, so requests died rather than came back slow.
 *    Only the gemini-3 family accepts being told to skip it (see THINKING_OFF).
 * 2. Pinned model versions get retired. The original chain (2.0-flash, 2.5-flash-lite)
 *    was returning "no longer available" and taking the whole request down with it.
 *
 * So: the two models that can be told not to think come first, and the last entry is a
 * floating "latest" alias, which keeps working when a specific version is withdrawn.
 * Each model also has its own free-tier daily quota, so falling through still buys
 * real answers after the preferred model's allowance runs out for the day.
 */
const MODEL_CHAIN = [
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-flash-lite-latest",
];

/** Skips the model's internal reasoning. Recipes don't need it, and it's the single
 * biggest thing standing between a request and a timeout. */
const THINKING_OFF = { thinkingBudget: 0 };

/** How long any one model gets before we give up on it and try the next. Without a
 * cap, a single overloaded model can sit there for 90 seconds and the request dies
 * having never reached a model that would have answered in five. */
const ATTEMPT_TIMEOUT_MS = 20_000;

/** The whole call has to return before the hosting platform kills it at 60s, so the
 * attempts share one budget rather than each getting a fresh 20s. */
const TOTAL_BUDGET_MS = 50_000;

/** A ceiling on how much the model may write. Recipes come back around 1,200 tokens;
 * this is many times that, and exists only to stop a model that has started rambling
 * from producing a 65KB answer that gets cut off halfway through and parses as
 * nothing. Callers that set their own limit keep it. */
const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

// Errors where trying the next model in the chain can help: this model's free daily
// quota is exhausted, Google reports it momentarily overloaded, or the model has been
// retired (a pinned version eventually stops existing — that must not end the request).
function isFallbackWorthyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";
  if (/abort|timeout|timed out/i.test(msg) || name === "AbortError" || name === "TimeoutError") return true;
  if (/Truncated or invalid JSON|Empty response from/i.test(msg)) return true;
  return /RESOURCE_EXHAUSTED|quota|429|UNAVAILABLE|overloaded|high demand|503|404|NOT_FOUND|no longer available/i.test(msg);
}

// Not every model accepts being told how much to think — the older aliases reject the
// whole request with INVALID_ARGUMENT. That's about the request's shape, not the
// model's health, so it's worth one immediate retry without the setting.
function rejectsThinkingConfig(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /INVALID_ARGUMENT|400/i.test(msg);
}

export async function generateWithFallback(
  ai: GoogleGenAI,
  contents: string,
  config?: GenerateContentConfig
): Promise<string> {
  let lastError: unknown = null;
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  for (const model of MODEL_CHAIN) {
    for (const withThinkingOff of [true, false]) {
      const remaining = deadline - Date.now();
      // Not enough left to be worth starting — better to report than to be killed
      // mid-request, which gives the caller nothing to show.
      if (remaining < 2_000) break;

      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
            ...(config ?? {}),
            ...(withThinkingOff ? { thinkingConfig: THINKING_OFF } : {}),
            abortSignal: AbortSignal.timeout(Math.min(ATTEMPT_TIMEOUT_MS, remaining)),
          },
        });
        const text = response.text;
        if (!text) throw new Error(`Empty response from ${model}`);

        // A JSON answer that was cut off mid-structure is worse than no answer: it
        // reaches the caller as a parse error. Check it here, while there is still
        // another model to ask, rather than letting it fail downstream.
        if (config?.responseMimeType === "application/json") {
          try {
            JSON.parse(text);
          } catch {
            throw new Error(`Truncated or invalid JSON from ${model} (${text.length} chars) — treating as unavailable`);
          }
        }
        return text;
      } catch (err) {
        lastError = err;
        if (withThinkingOff && rejectsThinkingConfig(err)) {
          console.warn(`${model} rejects thinkingConfig, retrying without it`);
          continue; // same model, second pass
        }
        if (!isFallbackWorthyError(err)) throw err;
        console.warn(`${model} unavailable (quota/overload/retired), trying next fallback model`);
        break; // move to the next model
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
