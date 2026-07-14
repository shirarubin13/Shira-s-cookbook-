import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { generateWithFallback } from "@/lib/gemini";
import type { Ingredient, RecipeStep } from "@/lib/recipes";

// Vercel's default function timeout (10s) can be shorter than a structured Gemini
// generation takes, especially on a cold start — extend it to the Hobby-tier max.
export const maxDuration = 60;

const ingredientItems = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Ingredient name in Hebrew — keep identical to the original" },
    quantity: {
      type: Type.STRING,
      nullable: true,
      description: "The adjusted quantity in Hebrew; omit only if the original had none (e.g. salt to taste)",
    },
  },
  required: ["name"],
};

const rescaleSchema = {
  type: Type.OBJECT,
  properties: {
    haveItems: { type: Type.ARRAY, items: ingredientItems },
    buyItems: { type: Type.ARRAY, items: ingredientItems },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "The step instruction in Hebrew, amounts adjusted where mentioned" },
          timerSeconds: {
            type: Type.INTEGER,
            nullable: true,
            description: "Keep the original timer unless the new amount clearly changes the time needed",
          },
          parallelTip: { type: Type.STRING, nullable: true, description: "Keep the original tip" },
        },
        required: ["text"],
      },
    },
  },
  required: ["haveItems", "buyItems", "steps"],
};

function ingredientsText(items: Ingredient[]): string {
  return items.map((i) => (i.quantity ? `${i.name} — ${i.quantity}` : i.name)).join("\n");
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI is not configured on the server." }, { status: 500 });
  }

  const { title, haveItems, buyItems, steps, request: userRequest } = await request.json();
  if (!title || !userRequest || typeof userRequest !== "string" || !Array.isArray(steps)) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });

  const stepsText = (steps as RecipeStep[]).map((s, i) => `${i + 1}. ${s.text}`).join("\n");

  const prompt = `A home cook wants to adjust the amounts of a recipe in a Hebrew cooking app. Their request: "${userRequest}"

The recipe, "${title}", as currently written:

Ingredients they likely have at home:
${ingredientsText((haveItems ?? []) as Ingredient[])}

Ingredients to buy:
${ingredientsText((buyItems ?? []) as Ingredient[])}

Steps:
${stepsText}

Rewrite the ingredient quantities (and any amounts mentioned inside step texts) to fit the request — e.g. fewer people, a specific amount of a main ingredient, doubling the batch.

Rules:
- Keep every ingredient's name and the list order exactly as given; only quantities change. Never add or remove ingredients.
- Scale sensibly, not blindly linearly — seasonings and oil scale less than main ingredients; round to amounts a home cook can actually measure.
- Keep step texts identical except where an amount or count is mentioned; keep timers unless the new amount clearly changes cooking time.
- Everything in Hebrew.`;

  try {
    const text = await generateWithFallback(ai, prompt, {
      responseMimeType: "application/json",
      responseSchema: rescaleSchema,
    });
    const parsed = JSON.parse(text);
    return NextResponse.json({
      haveItems: parsed.haveItems ?? [],
      buyItems: parsed.buyItems ?? [],
      steps: parsed.steps ?? [],
    });
  } catch (err) {
    console.error("Gemini rescale error:", err);
    return NextResponse.json({ error: "AI request failed." }, { status: 502 });
  }
}
