import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

const recipeSchema = {
  type: Type.OBJECT,
  properties: {
    suggestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Recipe name, in Hebrew" },
          emoji: { type: Type.STRING, description: "A single emoji representing the dish" },
          blurb: {
            type: Type.STRING,
            description:
              "One short restaurant-menu-style line in Hebrew that names the 2-3 ingredients or techniques that actually distinguish this specific version of the dish (e.g. which sauce, which method, which standout flavor) — specific enough that someone could tell it apart from a plain/generic version of the same dish, never just a mood word like 'special' or 'delicious'",
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
                quantity: {
                  type: Type.STRING,
                  nullable: true,
                  description: "Quantity for this exact recipe, in Hebrew (e.g. \"2 כפות\", \"1 יחידה\") — omit only for a to-taste staple like salt",
                },
              },
              required: ["name"],
            },
            description: "Basic staples the cook likely already has (salt, oil, etc), in Hebrew, each with a quantity",
          },
          buyItems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Ingredient name, in Hebrew" },
                quantity: {
                  type: Type.STRING,
                  description: "Quantity for this exact recipe, in Hebrew (e.g. \"500 גרם\", \"2 יחידות\")",
                },
              },
              required: ["name", "quantity"],
            },
            description: "The specific ingredients they'll likely need to buy, in Hebrew, each with a realistic quantity for this recipe",
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
                  description:
                    "Only set alongside timerSeconds — what to productively do during that wait, in Hebrew",
                },
              },
              required: ["text"],
            },
          },
        },
        required: ["title", "emoji", "blurb", "keywords", "haveItems", "buyItems", "steps"],
      },
    },
  },
  required: ["suggestions"],
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI is not configured on the server." }, { status: 500 });
  }

  const { message } = await request.json();
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Missing message." }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are a warm, practical home cooking assistant inside a Hebrew-language cooking app. A user just asked, in the app's chat: "${message}"

Reply with recipe suggestions in Hebrew (every text field — titles, steps, ingredients, everything — must be Hebrew).

Rules:
- If the request names a specific, clear dish, return exactly 1 suggestion for it, and make sure every detail they mentioned (a specific sauce, ingredient, or style) is actually reflected in that recipe's ingredients and steps, not silently dropped.
- If the request is a mood, a time limit, an occasion, or otherwise open-ended, return 2-3 varied, genuinely different suggestions that fit it.
- Steps should be real, correctly ordered cooking instructions a home cook can follow, written step by step (not paragraphs).
- Only add timerSeconds to a step when there's real unattended waiting time (simmering, baking, resting, boiling) — most steps should have no timer at all.
- When a step does have a timer, its parallelTip should suggest something useful to do with that idle time, in the spirit of "meanwhile" — never suggest something that also needs the stove/oven that's already in use.
- blurb should read like a short restaurant menu description that names what's actually distinctive about this version of the dish — never just repeat the title or use vague praise.
- Keep ingredient lists realistic and the recipe achievable at home, with a real quantity for each ingredient sized to this specific recipe (not vague amounts).`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: recipeSchema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from model");
    const parsed = JSON.parse(text);
    return NextResponse.json({ suggestions: parsed.suggestions ?? [] });
  } catch (err) {
    console.error("Gemini chat error:", err);
    return NextResponse.json({ error: "AI request failed." }, { status: 502 });
  }
}
