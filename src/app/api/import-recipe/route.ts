import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

// Vercel's default function timeout (10s) can be shorter than a structured Gemini
// generation takes, especially on a cold start — extend it to the Hobby-tier max.
export const maxDuration = 60;

const recipeSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Recipe name, in Hebrew" },
    emoji: { type: Type.STRING, description: "A single emoji representing the dish" },
    blurb: {
      type: Type.STRING,
      description:
        "One short restaurant-menu-style line in Hebrew naming what's actually distinctive about this dish — never just repeat the title.",
    },
    keywords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-6 short Hebrew search keywords (mood, time, cuisine, occasion)",
    },
    haveItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Ingredient name, in Hebrew" },
          quantity: { type: Type.STRING, nullable: true, description: "Quantity, in Hebrew" },
        },
        required: ["name"],
      },
      description: "Basic staples the cook likely already has, in Hebrew",
    },
    buyItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Ingredient name, in Hebrew" },
          quantity: { type: Type.STRING, description: "Quantity, in Hebrew" },
        },
        required: ["name", "quantity"],
      },
      description: "The specific ingredients to buy, in Hebrew, each with a quantity",
    },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "One clear instruction, in Hebrew" },
          timerSeconds: {
            type: Type.INTEGER,
            nullable: true,
            description: "Only set for steps with real unattended wait time (simmering, baking, resting)",
          },
          parallelTip: {
            type: Type.STRING,
            nullable: true,
            description: "Only set alongside timerSeconds — what to do during that wait, in Hebrew",
          },
        },
        required: ["text"],
      },
    },
  },
  required: ["title", "emoji", "blurb", "keywords", "haveItems", "buyItems", "steps"],
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI is not configured on the server." }, { status: 500 });
  }

  const { text } = await request.json();
  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Missing text." }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `A user pasted the following text — a caption, description, or transcript copied from a cooking video — into a Hebrew cooking app's "import a recipe" feature:

"""
${text}
"""

Turn it into one complete, structured recipe in Hebrew (every text field must be Hebrew, regardless of the language of the pasted text). Fill in any missing standard technique or quantity a reasonable home cook would need, but keep the dish itself faithful to what was actually described — don't invent a different dish.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: recipeSchema,
      },
    });

    const text2 = response.text;
    if (!text2) throw new Error("Empty response from model");
    const parsed = JSON.parse(text2);
    return NextResponse.json({ recipe: parsed });
  } catch (err) {
    console.error("Gemini import-recipe error:", err);
    return NextResponse.json({ error: "AI request failed." }, { status: 502 });
  }
}
