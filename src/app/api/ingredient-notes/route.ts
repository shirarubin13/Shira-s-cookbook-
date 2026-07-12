import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { generateWithFallback } from "@/lib/gemini";
import type { Ingredient } from "@/lib/recipes";

// Vercel's default function timeout (10s) can be shorter than a structured Gemini
// generation takes, especially on a cold start — extend it to the Hobby-tier max.
export const maxDuration = 60;

const notesSchema = {
  type: Type.OBJECT,
  properties: {
    notes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "Must exactly match one of the given ingredient names.",
          },
          suggestion: {
            type: Type.STRING,
            description:
              "A short Hebrew suggestion for next time, e.g. \"אולי 4 יחידות במקום 5, פחות דומיננטי\" — a proposal, not a command.",
          },
        },
        required: ["name", "suggestion"],
      },
      description:
        "Only include an entry for an ingredient the note actually concerns. If the note doesn't relate to any specific ingredient's quantity, return an empty array.",
    },
  },
  required: ["notes"],
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI is not configured on the server." }, { status: 500 });
  }

  const { buyItems, haveItems, note } = await request.json();
  if (!note || typeof note !== "string") {
    return NextResponse.json({ error: "Missing note." }, { status: 400 });
  }

  const allItems = [...(buyItems ?? []), ...(haveItems ?? [])] as Ingredient[];
  if (!allItems.length) {
    return NextResponse.json({ notes: [] });
  }

  const ai = new GoogleGenAI({ apiKey });

  const ingredientList = allItems
    .map((i) => (i.quantity ? `${i.name} (${i.quantity})` : i.name))
    .join(", ");

  const prompt = `A home cook just finished cooking a recipe and left this note for next time, in Hebrew: "${note}"

The recipe's ingredients and their current quantities: ${ingredientList}

If the note implies a specific ingredient's quantity should change next time (e.g. "too oniony", "not enough sauce"), identify which ingredient it is and phrase a short, tentative quantity suggestion in Hebrew. Never invent a change the note doesn't support — if the note is about something else (technique, timing, taste in general) rather than a specific ingredient's amount, return an empty list.`;

  try {
    const text = await generateWithFallback(ai, prompt, {
      responseMimeType: "application/json",
      responseSchema: notesSchema,
    });
    const parsed = JSON.parse(text);
    return NextResponse.json({ notes: parsed.notes ?? [] });
  } catch (err) {
    console.error("Gemini ingredient-notes error:", err);
    return NextResponse.json({ error: "AI request failed." }, { status: 502 });
  }
}
