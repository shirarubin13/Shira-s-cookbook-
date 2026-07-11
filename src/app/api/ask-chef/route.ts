import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import type { Ingredient, RecipeStep } from "@/lib/recipes";

// Vercel's default function timeout (10s) can be shorter than a Gemini generation
// takes, especially on a cold start — extend it to the Hobby-tier max.
export const maxDuration = 60;

function ingredientsText(items: Ingredient[] | undefined): string {
  if (!Array.isArray(items) || !items.length) return "";
  return items.map((i) => (i.quantity ? `${i.name} (${i.quantity})` : i.name)).join(", ");
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI is not configured on the server." }, { status: 500 });
  }

  const { title, steps, buyItems, haveItems, question } = await request.json();
  if (!title || !question || typeof question !== "string") {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });

  const stepsText = Array.isArray(steps)
    ? (steps as RecipeStep[]).map((s, i) => `${i + 1}. ${s.text}`).join("\n")
    : "";

  const prompt = `You are a helpful home cooking assistant inside a Hebrew cooking app, answering a question about a specific recipe the user is currently looking at.

Recipe: "${title}"
Ingredients they'll buy: ${ingredientsText(buyItems)}
Ingredients they likely already have: ${ingredientsText(haveItems)}
Steps:
${stepsText}

Their question: "${question}"

Answer briefly and practically in Hebrew (2-4 sentences max), specific to this exact recipe — e.g. if they're asking about a substitution, a missing ingredient, or a step, give a concrete, usable answer rather than a generic one.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from model");
    return NextResponse.json({ answer: text.trim() });
  } catch (err) {
    console.error("Gemini ask-chef error:", err);
    return NextResponse.json({ error: "AI request failed." }, { status: 502 });
  }
}
