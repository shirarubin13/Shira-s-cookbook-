import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

const ideasSchema = {
  type: Type.OBJECT,
  properties: {
    ideas: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "2-3 short Hebrew phrases, each a concrete addition or change to the recipe (an ingredient, sauce, or technique) — not a full sentence, just the upgrade itself, e.g. \"רוטב שמנת ופטריות\".",
    },
  },
  required: ["ideas"],
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI is not configured on the server." }, { status: 500 });
  }

  const { title, blurb, request: userRequest } = await request.json();
  if (!title || !userRequest || typeof userRequest !== "string") {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `A home cook is looking at a recipe called "${title}" (${blurb ?? ""}) inside a Hebrew cooking app, and asked how to upgrade or change it: "${userRequest}"

Suggest 2-3 short, concrete upgrade ideas in Hebrew that directly answer what they asked for — each one a specific ingredient, sauce, or technique to add to the recipe, not a full sentence or explanation.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: ideasSchema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from model");
    const parsed = JSON.parse(text);
    return NextResponse.json({ ideas: parsed.ideas ?? [] });
  } catch (err) {
    console.error("Gemini upgrade error:", err);
    return NextResponse.json({ error: "AI request failed." }, { status: 502 });
  }
}
