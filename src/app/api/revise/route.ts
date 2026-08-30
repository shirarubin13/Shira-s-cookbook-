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
    name: { type: Type.STRING, description: "Ingredient name in Hebrew" },
    quantity: {
      type: Type.STRING,
      nullable: true,
      description: "Quantity in Hebrew; omit only for a to-taste staple like salt",
    },
  },
  required: ["name"],
};

const reviseSchema = {
  type: Type.OBJECT,
  properties: {
    haveItems: { type: Type.ARRAY, items: ingredientItems },
    buyItems: { type: Type.ARRAY, items: ingredientItems },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: {
            type: Type.STRING,
            description:
              "One clear instruction, in Hebrew, restating the amount of every ingredient it uses (e.g. \"להוסיף 1.5 כוסות קמח\", not \"להוסיף את הקמח\")",
          },
          timerSeconds: {
            type: Type.INTEGER,
            nullable: true,
            description: "Only for steps with real unattended wait time; keep original timers unless the change affects them",
          },
          parallelTip: {
            type: Type.STRING,
            nullable: true,
            description: "Only alongside timerSeconds — what to do during the wait, in Hebrew",
          },
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

  const { title, haveItems, buyItems, steps, instruction } = await request.json();
  if (!title || !instruction || typeof instruction !== "string" || !Array.isArray(steps)) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });

  const stepsText = (steps as RecipeStep[])
    .map((s, i) => `${i + 1}. ${s.text}${s.timerSeconds ? ` (טיימר: ${s.timerSeconds} שניות)` : ""}`)
    .join("\n");

  const prompt = `A home cook wants to change a recipe in a Hebrew cooking app. Their change request: "${instruction}"

The recipe, "${title}", as currently written:

Ingredients they likely have at home:
${ingredientsText((haveItems ?? []) as Ingredient[])}

Ingredients to buy:
${ingredientsText((buyItems ?? []) as Ingredient[])}

Steps:
${stepsText}

Rewrite the recipe with the change genuinely integrated — not appended as an afterthought:
- The request may contain SEVERAL separate changes (e.g. "less salt, more garlic, and add mushrooms") — apply every single one of them, not just the first. Before answering, mentally list each distinct change in the request and make sure each is reflected in the result.
- Work each change into the exact steps where it belongs (e.g. a sauce gets prepared and added at the right moments, a swapped ingredient changes the relevant steps).
- Add, remove, or adjust ingredients as the change requires; keep everything else as close to the original as possible.
- Keep the dish recognizable — this is an adjustment of this recipe, not a new recipe.
- Steps stay short, clear, one action each; keep original timers unless the change affects them.
- Every step must restate the amount of each ingredient it uses, matching the ingredient list — "לערבב 1.5 כוסות קמח", never "לערבב את הקמח". Add the amount to steps that are missing it, and update it wherever the change alters it. The app shows one step at a time while cooking, so an amount only in the ingredient list is one the cook can no longer see.
- Everything in Hebrew.`;

  try {
    const text = await generateWithFallback(ai, prompt, {
      responseMimeType: "application/json",
      responseSchema: reviseSchema,
    });
    const parsed = JSON.parse(text);
    return NextResponse.json({
      haveItems: parsed.haveItems ?? [],
      buyItems: parsed.buyItems ?? [],
      steps: parsed.steps ?? [],
    });
  } catch (err) {
    console.error("Gemini revise error:", err);
    return NextResponse.json({ error: "AI request failed." }, { status: 502 });
  }
}
