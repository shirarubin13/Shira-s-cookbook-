export type RecipeStep = {
  text: string;
  timerSeconds?: number;
  parallelTip?: string;
};

export type Ingredient = {
  name: string;
  /** e.g. "2 יחידות", "500 גרם" — free-text so it reads naturally in Hebrew. */
  quantity?: string;
};

/** A suggested quantity tweak for one ingredient, derived from a past cooking note —
 * shown next to the ingredient rather than silently changing its quantity. */
export type IngredientNote = {
  name: string;
  suggestion: string;
};

export type Recipe = {
  id: string;
  title: string;
  emoji: string;
  /** Short, restaurant-menu-style description — "lemon, garlic, Italian flavors" rather than just a name. */
  blurb: string;
  source: string;
  keywords: string[];
  haveItems: Ingredient[];
  buyItems: Ingredient[];
  steps: RecipeStep[];
  note?: string;
  ingredientNotes?: IngredientNote[];
  /** True for a "save for later" bookmark that hasn't been cooked-and-confirmed yet.
   * Shows up in the cookbook so it can be found and opened, but if the first time it's
   * actually cooked ends without confirming at Feedback, it's removed rather than kept. */
  pending?: boolean;
};

export function matchesQuery(recipe: Recipe, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  const words = trimmed
    .toLowerCase()
    .replace(/[^\wא-ת\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  if (!words.length) return true;
  const haystack = [recipe.title, recipe.source, ...recipe.keywords].join(" ").toLowerCase();
  return words.some((w) => haystack.includes(w));
}

export const seedRecipes: Recipe[] = [
  {
    id: "burger",
    title: "המבורגר עם בצל מקורמל",
    emoji: "🍔",
    blurb: "בצל מקורמל מתוק, בשר עסיסי — קלאסיקה אמריקאית לערב עצלן.",
    source: "מהצ׳אט",
    keywords: ["ערב", "מהיר", "נוחות", "בשר", "המבורגר", "גריל", "ארוחת"],
    haveItems: [
      { name: "מלח ופלפל" },
      { name: "חמאה", quantity: "2 כפות" },
      { name: "שמן בישול", quantity: "לטיגון" },
    ],
    buyItems: [
      { name: "בשר טחון", quantity: "500 גרם" },
      { name: "בצל", quantity: "2 יחידות" },
      { name: "לחמניות המבורגר", quantity: "4 יחידות" },
      { name: "גבינה צהובה", quantity: "4 פרוסות" },
    ],
    steps: [
      { text: "לפרוס שני בצלים לחצאי ירח דקים." },
      {
        text: "להמיס חמאה במחבת על אש נמוכה ולהוסיף את הבצל.",
        timerSeconds: 1200,
        parallelTip: "לבצל לוקח 20 דקות על אש נמוכה, עם ערבוב מדי פעם — זה השלב הכי ארוך, אז כל השאר קורה סביבו.",
      },
      { text: "לעצב את הבשר לארבעה קציצים, לתבל במלח ופלפל משני הצדדים." },
      { text: "לחמם מחבת או גריל לחום בינוני-גבוה." },
      {
        text: "לצלות את הקציצים כ-4 דקות מכל צד.",
        timerSeconds: 240,
        parallelTip: "בזמן שהן נצלות, לקלות את הלחמניות עם הפנים כלפי מטה במחבת יבשה.",
      },
      { text: "להרכיב: לחמנייה, קציץ, בצל מקורמל, גבינה, לחמנייה עליונה." },
    ],
  },
  {
    id: "meatballs",
    title: "קציצות לארוחת ערב",
    emoji: "🍝",
    blurb: "עגבניות, בזיליקום ושום — נוחות איטלקית בקערה אחת.",
    source: "מהצ׳אט",
    keywords: ["ערב", "מהיר", "איטלקי", "נוחות", "פסטה", "קציצות"],
    haveItems: [{ name: "מלח ופלפל" }, { name: "שמן זית", quantity: "2 כפות" }, { name: "שום", quantity: "2 שיניים" }],
    buyItems: [
      { name: "בשר טחון", quantity: "500 גרם" },
      { name: "פירורי לחם", quantity: "חצי כוס" },
      { name: "ביצה", quantity: "1 יחידה" },
      { name: "רוטב מרינרה", quantity: "500 מ״ל" },
    ],
    steps: [
      { text: "לערבב בשר, פירורי לחם, ביצה ותיבול. לגלגל לכדורים." },
      {
        text: "לשחם את הקציצות במחבת חמה, תוך הפיכה מדי פעם.",
        timerSeconds: 480,
        parallelTip: "בזמן שהן משחימות, לחמם את רוטב המרינרה בסיר נוסף.",
      },
      {
        text: "להוסיף את הקציצים לרוטב ולבשל על אש נמוכה.",
        timerSeconds: 600,
        parallelTip: "להרתיח מים ולבשל פסטה בזמן שהרוטב מתבשל.",
      },
    ],
  },
  {
    id: "mugcake",
    title: "עוגת שוקולד בספל",
    emoji: "🍫",
    blurb: "שוקולד חם ונמס, מוכן לפני שהתחשק לך להתחרט.",
    source: "מהצ׳אט",
    keywords: ["מתוק", "קינוח", "נוחות", "פרידה", "מהיר", "שוקולד", "עצוב"],
    haveItems: [
      { name: "סוכר", quantity: "4 כפות" },
      { name: "חמאה", quantity: "2 כפות" },
      { name: "אבקת קקאו", quantity: "2 כפות" },
      { name: "קמח", quantity: "4 כפות" },
    ],
    buyItems: [{ name: "שבבי שוקולד", quantity: "חופן" }],
    steps: [
      { text: "לערבב קמח, סוכר, קקאו, חמאה מומסת וקצת חלב בספל." },
      { text: "להוסיף חופן שבבי שוקולד ולערבב פעם אחת." },
      {
        text: "לחמם במיקרוגל 90 שניות.",
        timerSeconds: 90,
        parallelTip: "בזמן שזה מתבשל, למצוא כפית טובה — זה הולך מהר.",
      },
    ],
  },
  {
    id: "feta-pasta",
    title: "פסטה עם פטה אפויה",
    emoji: "🧀",
    blurb: "פטה נמסה, עגבניות שרי מתוקות — הטרנד שכבש את כולם.",
    source: "יובא מטיקטוק",
    keywords: ["ארוחה", "חגיגה", "מרשים", "פסטה", "צמחוני", "מיובא", "וידאו", "אפוי"],
    haveItems: [{ name: "שמן זית", quantity: "3 כפות" }, { name: "מלח ופלפל" }],
    buyItems: [
      { name: "גוש פטה", quantity: "200 גרם" },
      { name: "עגבניות שרי", quantity: "250 גרם" },
      { name: "פסטה", quantity: "300 גרם" },
      { name: "שום", quantity: "3 שיניים" },
    ],
    steps: [
      { text: "להניח את הפטה בתבנית אפייה, להקיף בעגבניות שרי, לזלף שמן זית." },
      {
        text: "לאפות ב-200 מעלות עד שהעגבניות מתפוצצות והפטה מתרככת.",
        timerSeconds: 1500,
        parallelTip: "להרתיח מים ולבשל את הפסטה בזמן האפייה — לבדוק את התנור לפי הטיימר של הפסטה, לא להפך.",
      },
      { text: "למעוך את הפטה עם העגבניות ולערבב עם הפסטה המבושלת." },
    ],
  },
];

/**
 * A small pool of recipes the chat can suggest for a fresh request — kept separate from
 * `seedRecipes` so opening one genuinely counts as "not yet in the cookbook" until the person
 * saves it (either "save for later" or by cooking it through to Feedback).
 */
export const chatSuggestionPool: Recipe[] = [
  {
    id: "shrimp-pasta",
    title: "פסטה שרימפס בחמאת שום",
    emoji: "🍤",
    blurb: "חמאה, שום קלוי, נגיעה ימית — מרגיש כמו מסעדה, לוקח 20 דקות.",
    source: "מהצ׳אט",
    keywords: ["ערב", "מהיר", "ים", "פסטה", "מרשים"],
    haveItems: [{ name: "שמן זית", quantity: "1 כף" }, { name: "מלח ופלפל" }, { name: "חמאה", quantity: "3 כפות" }],
    buyItems: [
      { name: "שרימפס", quantity: "300 גרם" },
      { name: "פסטה", quantity: "250 גרם" },
      { name: "שום", quantity: "3 שיניים" },
      { name: "פטרוזיליה", quantity: "חופן" },
    ],
    steps: [
      {
        text: "להרתיח מים ולבשל את הפסטה.",
        timerSeconds: 600,
        parallelTip: "בזמן שהפסטה מתבשלת, לקלף ולנקות את השרימפס.",
      },
      {
        text: "להמיס חמאה עם שום כתוש במחבת ולהוסיף את השרימפס.",
        timerSeconds: 240,
        parallelTip: "לקצוץ פטרוזיליה טרייה בינתיים.",
      },
      { text: "לערבב את הפסטה עם השרימפס, לפזר פטרוזיליה ולהגיש." },
    ],
  },
  {
    id: "lentil-soup",
    title: "מרק עדשים חם",
    emoji: "🍲",
    blurb: "כמון, גזר ועדשים מתובלות — נחמה חמה ליום קר.",
    source: "מהצ׳אט",
    keywords: ["חורף", "נוחות", "מהיר", "צמחוני", "מרק", "בריא"],
    haveItems: [{ name: "שמן זית", quantity: "2 כפות" }, { name: "מלח ופלפל" }, { name: "כמון", quantity: "1 כפית" }],
    buyItems: [
      { name: "עדשים כתומות", quantity: "כוס" },
      { name: "גזר", quantity: "2 יחידות" },
      { name: "בצל", quantity: "1 יחידה" },
      { name: "ציר ירקות", quantity: "1 ליטר" },
    ],
    steps: [
      { text: "לטגן בצל וגזר קצוץ בשמן זית עד שמתרככים." },
      {
        text: "להוסיף עדשים, כמון וציר, ולבשל עד שהעדשים רכות.",
        timerSeconds: 1200,
        parallelTip: "לפרוס לחם או להכין קרוטונים בינתיים.",
      },
      { text: "לטחון חלק מהמרק למרקם סמיך יותר, לתבל ולהגיש." },
    ],
  },
  {
    id: "tuna-salad",
    title: "סלט טונה ים תיכוני",
    emoji: "🥙",
    blurb: "טונה, זיתים, עגבניות — קליל, רענן, בלי לבשל כמעט כלום.",
    source: "מהצ׳אט",
    keywords: ["קליל", "צהריים", "מהיר", "בריא", "קיץ"],
    haveItems: [{ name: "שמן זית", quantity: "1 כף" }, { name: "מלח" }, { name: "לימון", quantity: "חצי יחידה" }],
    buyItems: [
      { name: "קופסת טונה", quantity: "1 קופסה" },
      { name: "עגבניות שרי", quantity: "150 גרם" },
      { name: "זיתים", quantity: "חופן" },
      { name: "בצל סגול", quantity: "חצי יחידה" },
    ],
    steps: [
      { text: "לחתוך עגבניות שרי לחצאים ולפרוס בצל סגול דק." },
      { text: "לערבב עם הטונה, הזיתים, שמן זית ומיץ לימון." },
    ],
  },
];

export function findRecipeInList(recipes: Recipe[], id: string): Recipe | undefined {
  return recipes.find((r) => r.id === id);
}

