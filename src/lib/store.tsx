"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "./supabaseClient";
import {
  Ingredient,
  IngredientNote,
  Recipe,
  RecipeStep,
  chatSuggestionPool,
} from "./recipes";
import { PaletteKey } from "./palette";
import { findStoredChatRecipe } from "./chatStorage";
import { Toast } from "@/components/Toast";
import {
  fetchRecipes,
  fetchRecipeById,
  insertRecipe,
  updateRecipe,
  deleteRecipeRow,
} from "./supabaseRecipes";

export type AuthStatus = "loading" | "signedOut" | "needsProfile" | "ready";

const upgradeIdeas = [
  "רוטב שמנת ופטריות",
  "קראנץ׳ פירורי לחם קלויים",
  "תוספת ירקות שורש צלויים",
  "נגיעה של צ׳ילי חריף",
  "גבינה מגורדת בסיום",
  "עשבי תיבול טריים לפני ההגשה",
];

export type PendingUpgrade = {
  recipeId: string;
  idea: string;
  previousSteps: RecipeStep[];
  previousBuyItems: Ingredient[];
  previousHaveItems: Ingredient[];
};

/** Calls the AI to genuinely rewrite a recipe per a change request (an upgrade idea
 * or a saved note) — integrated into the right steps, not appended at the end. */
async function fetchRevision(
  recipe: Recipe,
  instruction: string
): Promise<{ haveItems: Ingredient[]; buyItems: Ingredient[]; steps: RecipeStep[] } | null> {
  try {
    const res = await fetch("/api/revise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: recipe.title,
        haveItems: recipe.haveItems,
        buyItems: recipe.buyItems,
        steps: recipe.steps,
        instruction,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data.buyItems) || !Array.isArray(data.steps) || !data.steps.length) return null;
    return { haveItems: data.haveItems ?? [], buyItems: data.buyItems, steps: data.steps };
  } catch {
    return null;
  }
}

/** A per-cook, amounts-adjusted version of a recipe ("for 2 people", "just one cup
 * of rice"). Shown and cooked instead of the original while active, but never
 * written to the cookbook — the saved recipe always keeps its original amounts. */
type ScaledEntry = { recipe: Recipe; request: string; at: number };

const SCALED_KEY = "cookbook-scaled-v1";
const SCALED_TTL_MS = 12 * 60 * 60 * 1000;

function loadScaled(): Record<string, ScaledEntry> {
  try {
    const raw = localStorage.getItem(SCALED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ScaledEntry>;
    const now = Date.now();
    const fresh: Record<string, ScaledEntry> = {};
    for (const [id, entry] of Object.entries(parsed)) {
      if (entry && entry.recipe && now - entry.at < SCALED_TTL_MS) fresh[id] = entry;
    }
    return fresh;
  } catch {
    return {};
  }
}

function saveScaled(scaled: Record<string, ScaledEntry>) {
  try {
    localStorage.setItem(SCALED_KEY, JSON.stringify(scaled));
  } catch {
    // storage blocked — scaling still works for this visit, just won't survive leaving
  }
}

type StoreContextValue = {
  authStatus: AuthStatus;
  userId: string | null;
  userEmail: string | null;
  userName: string;
  palette: PaletteKey;
  isShared: boolean;
  setSharing: (on: boolean) => Promise<void>;
  recipes: Recipe[];
  recipesLoading: boolean;
  toast: string | null;
  aiSuggestions: Recipe[];
  cacheAiSuggestions: (recipes: Recipe[]) => void;
  setPalette: (p: PaletteKey) => void;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  completeOnboarding: (name: string, palette: PaletteKey) => Promise<void>;
  isSaved: (id: string) => boolean;
  getRecipeById: (id: string) => Recipe | undefined;
  ensureRecipeCached: (id: string) => Promise<Recipe | undefined>;
  scaledRequestFor: (id: string) => string | null;
  applyScale: (id: string, request: string) => Promise<boolean>;
  resetScale: (id: string) => void;
  saveRecipe: (recipe: Recipe, pending?: boolean) => Promise<Recipe | null>;
  deleteRecipe: (id: string) => Promise<void>;
  applyUpgrade: (id: string, idea: string) => Promise<Recipe | undefined>;
  nextUpgradeIdeas: () => string[];
  pendingUpgrade: PendingUpgrade | null;
  confirmPendingUpgrade: (keep: boolean) => Promise<Recipe | undefined>;
  applyNoteRevision: (id: string) => Promise<boolean>;
  setRecipeShared: (id: string, on: boolean) => Promise<boolean>;
  addToMyBook: (recipe: Recipe, sourceName?: string) => Promise<Recipe | null>;
  importFromText: (text: string) => Promise<Recipe | null>;
  submitFeedback: (recipe: Recipe, note: string, save: boolean) => Promise<void>;
  showToast: (message: string) => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);

  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [userName, setUserName] = useState("");
  const [palette, setPaletteState] = useState<PaletteKey>("blue");
  const [isShared, setIsShared] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(true);

  const [toast, setToast] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Recipe[]>([]);
  const [pendingUpgrade, setPendingUpgrade] = useState<PendingUpgrade | null>(null);
  const [scaled, setScaled] = useState<Record<string, ScaledEntry>>({});
  const upgradeOffset = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scaled versions survive reloads (they matter most mid-cook, which is exactly
  // when phones reload tabs) — loaded once, saved on every change after that.
  // The save effect is defined before the load effect on purpose: on mount it runs
  // first (ref still false) and skips, so the stored data is never clobbered by the
  // initial empty state.
  const scaledLoadedRef = useRef(false);
  useEffect(() => {
    if (scaledLoadedRef.current) saveScaled(scaled);
  }, [scaled]);
  useEffect(() => {
    setScaled(loadScaled());
    scaledLoadedRef.current = true;
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1700);
  }, []);

  // --- Auth + profile lifecycle -------------------------------------------------

  const loadProfile = useCallback(
    async (currentSession: Session) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, palette, is_shared")
        .eq("id", currentSession.user.id)
        .maybeSingle();

      if (error) {
        showToast("שגיאה בטעינת הפרופיל.");
        setAuthStatus("needsProfile");
        return;
      }
      if (!data) {
        setAuthStatus("needsProfile");
        return;
      }
      setUserName(data.name);
      setPaletteState(data.palette as PaletteKey);
      setIsShared(Boolean(data.is_shared));
      setAuthStatus("ready");

      setRecipesLoading(true);
      const loaded = await fetchRecipes(supabase, currentSession.user.id);
      setRecipes(loaded);
      setRecipesLoading(false);
    },
    [supabase, showToast]
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadProfile(data.session);
      else setAuthStatus("signedOut");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) loadProfile(newSession);
      else {
        setAuthStatus("signedOut");
        setRecipes([]);
      }
    });

    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithEmail = useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      return { error: error ? error.message : null };
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAuthStatus("signedOut");
    setRecipes([]);
    setIsShared(false);
  }, [supabase]);

  const completeOnboarding = useCallback(
    async (name: string, chosenPalette: PaletteKey) => {
      if (!session) return;
      const { error } = await supabase
        .from("profiles")
        .insert({ id: session.user.id, name, palette: chosenPalette });
      if (error) {
        showToast("לא הצלחנו לשמור את הפרופיל.");
        return;
      }
      setUserName(name);
      setPaletteState(chosenPalette);

      // A brand-new cookbook starts genuinely empty — recipes only appear once the
      // person saves one themselves (chat, import, or cooking a friend's recipe).
      setRecipes([]);
      setRecipesLoading(false);
      setAuthStatus("ready");
    },
    [session, supabase, showToast]
  );

  const setPalette = useCallback(
    (p: PaletteKey) => {
      setPaletteState(p);
      if (session) {
        supabase.from("profiles").update({ palette: p }).eq("id", session.user.id).then();
      }
    },
    [session, supabase]
  );

  const setSharing = useCallback(
    async (on: boolean) => {
      if (!session) return;
      const { error } = await supabase.from("profiles").update({ is_shared: on }).eq("id", session.user.id);
      if (error) {
        showToast("לא הצלחנו לעדכן את השיתוף.");
        return;
      }
      setIsShared(on);
    },
    [session, supabase, showToast]
  );

  // --- Recipes (real database now — every write below goes to Supabase) ---------

  const isSaved = useCallback((id: string) => recipes.some((r) => r.id === id && !r.pending), [recipes]);

  // Recipes the chat just generated this session but haven't been saved anywhere yet —
  // checked so "start cooking now" can open them before any save decision is made.
  const cacheAiSuggestions = useCallback((newOnes: Recipe[]) => {
    setAiSuggestions((list) => [...list, ...newOnes]);
  }, []);

  // The recipe as stored — without any per-cook amount scaling applied.
  const getBaseRecipeById = useCallback(
    (id: string): Recipe | undefined => {
      return (
        recipes.find((r) => r.id === id) ??
        aiSuggestions.find((r) => r.id === id) ??
        chatSuggestionPool.find((r) => r.id === id)
      );
    },
    [recipes, aiSuggestions]
  );

  const getRecipeById = useCallback(
    (id: string): Recipe | undefined => {
      return scaled[id]?.recipe ?? getBaseRecipeById(id);
    },
    [scaled, getBaseRecipeById]
  );

  // Recipes opened from a friend's shared book or the chat only live in the
  // in-memory aiSuggestions cache, which doesn't survive a page reload. This
  // recovers one by id — from the database (row-level security only allows it if
  // it's the caller's own recipe, or its owner still has sharing on), or from the
  // locally-persisted chat conversation — and re-caches it so getRecipeById finds
  // it afterwards.
  const ensureRecipeCached = useCallback(
    async (id: string): Promise<Recipe | undefined> => {
      const existing = getRecipeById(id);
      if (existing) return existing;
      const fetched = (await fetchRecipeById(supabase, id)) ?? findStoredChatRecipe(id);
      if (!fetched) return undefined;
      setAiSuggestions((list) => [...list, fetched]);
      return fetched;
    },
    [getRecipeById, supabase]
  );

  const scaledRequestFor = useCallback((id: string) => scaled[id]?.request ?? null, [scaled]);

  // Asks the AI to adjust the recipe's amounts to the request ("2 אנשים", "רק כוס
  // אורז"). The result replaces the recipe for this cooking session only — always
  // computed from the original, so re-scaling never compounds.
  const applyScale = useCallback(
    async (id: string, request: string): Promise<boolean> => {
      const base = getBaseRecipeById(id);
      if (!base) return false;
      try {
        const res = await fetch("/api/rescale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: base.title,
            haveItems: base.haveItems,
            buyItems: base.buyItems,
            steps: base.steps,
            request,
          }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (!Array.isArray(data.buyItems) || !Array.isArray(data.steps)) return false;
        const adjusted: Recipe = {
          ...base,
          haveItems: data.haveItems,
          buyItems: data.buyItems,
          steps: data.steps,
        };
        setScaled((map) => ({ ...map, [id]: { recipe: adjusted, request, at: Date.now() } }));
        return true;
      } catch {
        return false;
      }
    },
    [getBaseRecipeById]
  );

  const resetScale = useCallback((id: string) => {
    setScaled((map) => {
      const next = { ...map };
      delete next[id];
      return next;
    });
  }, []);

  const saveRecipe = useCallback(
    async (recipe: Recipe, pending = false): Promise<Recipe | null> => {
      if (!session) return null;
      if (recipes.some((r) => r.id === recipe.id)) return recipes.find((r) => r.id === recipe.id) ?? null;
      const saved = await insertRecipe(supabase, session.user.id, { ...recipe, pending });
      if (!saved) {
        showToast("לא הצלחנו לשמור את המתכון.");
        return null;
      }
      setRecipes((list) => [...list, saved]);
      return saved;
    },
    [session, supabase, recipes, showToast]
  );

  const deleteRecipe = useCallback(
    async (id: string) => {
      const ok = await deleteRecipeRow(supabase, id);
      if (!ok) {
        showToast("לא הצלחנו למחוק את המתכון.");
        return;
      }
      setRecipes((list) => list.filter((r) => r.id !== id));
      showToast("המתכון הוסר מהספר שלך.");
    },
    [supabase, showToast]
  );

  // Applying an upgrade rewrites the recipe with the AI so the addition is woven
  // into the right steps and ingredients — not appended as a note at the end. It
  // only changes the local, in-session copy; it's confirmed (or dropped) via
  // confirmPendingUpgrade on the Feedback screen, so an upgrade never silently
  // becomes permanent.
  const applyUpgrade = useCallback(
    async (id: string, idea: string): Promise<Recipe | undefined> => {
      const current = getRecipeById(id);
      if (!current) return undefined;

      const revision = await fetchRevision(current, `לשלב במתכון: ${idea}`);
      if (!revision) {
        showToast("השף החכם לא זמין כרגע — נסי שוב עוד כמה דקות.");
        return undefined;
      }
      const updated: Recipe = { ...current, ...revision };

      setPendingUpgrade({
        recipeId: id,
        idea,
        previousSteps: current.steps,
        previousBuyItems: current.buyItems,
        previousHaveItems: current.haveItems,
      });

      // When a per-cook scale is active, the recipe being shown is the overlay — the
      // upgrade edits that, never the underlying original lists.
      if (scaled[id]) {
        setScaled((map) => {
          const entry = map[id];
          return entry ? { ...map, [id]: { ...entry, recipe: updated } } : map;
        });
      } else if (recipes.some((r) => r.id === id)) {
        setRecipes((list) => list.map((r) => (r.id === id ? updated : r)));
      } else {
        // Built-in pool recipes aren't in the cache until touched — insert, don't just map.
        setAiSuggestions((list) =>
          list.some((r) => r.id === id) ? list.map((r) => (r.id === id ? updated : r)) : [...list, updated]
        );
      }
      showToast("שולב במתכון — בסוף הבישול נשאל אם לשמור את זה.");
      return updated;
    },
    [recipes, scaled, showToast, getRecipeById]
  );

  const confirmPendingUpgrade = useCallback(
    async (keep: boolean): Promise<Recipe | undefined> => {
      const pending = pendingUpgrade;
      if (!pending) return undefined;
      setPendingUpgrade(null);

      const current = getRecipeById(pending.recipeId);
      if (!current) return undefined;

      if (!keep) {
        const reverted: Recipe = {
          ...current,
          steps: pending.previousSteps,
          buyItems: pending.previousBuyItems,
          haveItems: pending.previousHaveItems,
        };
        if (scaled[pending.recipeId]) {
          setScaled((map) => {
            const entry = map[pending.recipeId];
            return entry ? { ...map, [pending.recipeId]: { ...entry, recipe: reverted } } : map;
          });
        } else if (recipes.some((r) => r.id === pending.recipeId)) {
          setRecipes((list) => list.map((r) => (r.id === pending.recipeId ? reverted : r)));
        } else {
          setAiSuggestions((list) =>
            list.some((r) => r.id === pending.recipeId)
              ? list.map((r) => (r.id === pending.recipeId ? reverted : r))
              : [...list, reverted]
          );
        }
        return reverted;
      }

      // If the recipe is already saved, the upgrade needs an explicit write — otherwise
      // it's just part of whatever gets saved next (first save, or not saved at all).
      if (recipes.some((r) => r.id === pending.recipeId)) {
        // The cookbook always keeps original amounts — if a per-cook scale is active,
        // the upgrade is re-integrated into the original for the write, not the
        // scaled copy (with a plain appended step as last resort if the AI is down).
        let writeBuyItems = current.buyItems;
        let writeHaveItems = current.haveItems;
        let writeSteps = current.steps;
        if (scaled[pending.recipeId]) {
          const base = getBaseRecipeById(pending.recipeId);
          if (base) {
            const baseRevision = await fetchRevision(base, `לשלב במתכון: ${pending.idea}`);
            if (baseRevision) {
              writeSteps = baseRevision.steps;
              writeBuyItems = baseRevision.buyItems;
              writeHaveItems = baseRevision.haveItems;
            } else {
              const baseSteps = [...base.steps];
              baseSteps.splice(Math.max(baseSteps.length - 1, 0), 0, {
                text: `שדרוג שבחרת: להוסיף ${pending.idea}.`,
              });
              writeSteps = baseSteps;
              writeBuyItems = [...base.buyItems, { name: pending.idea }];
              writeHaveItems = base.haveItems;
            }
          }
        }
        const updated = await updateRecipe(supabase, pending.recipeId, {
          buyItems: writeBuyItems,
          haveItems: writeHaveItems,
          steps: writeSteps,
        });
        if (!updated) {
          showToast("לא הצלחנו לשמור את השדרוג.");
          return current;
        }
        setRecipes((list) => list.map((r) => (r.id === pending.recipeId ? updated : r)));
        return updated;
      }

      return current;
    },
    [pendingUpgrade, recipes, scaled, supabase, showToast, getRecipeById, getBaseRecipeById]
  );

  // "Update the recipe according to my note" — an explicit request to permanently
  // apply a saved feedback note ("too salty", "add more garlic") to the recipe
  // itself. Rewrites via the AI and saves; the note is cleared once applied.
  const applyNoteRevision = useCallback(
    async (id: string): Promise<boolean> => {
      const base = getBaseRecipeById(id);
      if (!base || !base.note) return false;

      const revision = await fetchRevision(base, `לעדכן את המתכון לפי ההערה שלי מהפעם הקודמת: "${base.note}"`);
      if (!revision) {
        showToast("השף החכם לא זמין כרגע — נסי שוב עוד כמה דקות.");
        return false;
      }

      if (recipes.some((r) => r.id === id)) {
        const updated = await updateRecipe(supabase, id, {
          ...revision,
          note: null,
          ingredientNotes: null,
        });
        if (!updated) {
          showToast("לא הצלחנו לעדכן את המתכון.");
          return false;
        }
        setRecipes((list) => list.map((r) => (r.id === id ? updated : r)));
      } else {
        const updated: Recipe = { ...base, ...revision, note: undefined, ingredientNotes: undefined };
        setAiSuggestions((list) =>
          list.some((r) => r.id === id) ? list.map((r) => (r.id === id ? updated : r)) : [...list, updated]
        );
      }
      // A stale scaled copy would still show the old version — drop it.
      resetScale(id);
      showToast("המתכון עודכן לפי ההערה.");
      return true;
    },
    [recipes, supabase, showToast, getBaseRecipeById, resetScale]
  );

  // Sharing one recipe by link, without exposing the rest of the book.
  const setRecipeShared = useCallback(
    async (id: string, on: boolean): Promise<boolean> => {
      const updated = await updateRecipe(supabase, id, { shared: on });
      if (!updated) {
        showToast("לא הצלחנו לעדכן את השיתוף.");
        return false;
      }
      setRecipes((list) => list.map((r) => (r.id === id ? updated : r)));
      return true;
    },
    [supabase, showToast]
  );

  // Copies someone else's recipe (a friend's book, a shared link) straight into
  // your own book — an explicit "add", saved permanently, with the source naming
  // where it came from.
  const addToMyBook = useCallback(
    async (recipe: Recipe, sourceName?: string): Promise<Recipe | null> => {
      if (!session) {
        showToast("צריך להתחבר כדי לשמור לספר שלך.");
        return null;
      }
      const copy: Recipe = {
        ...recipe,
        source: sourceName ? `מהספר של ${sourceName}` : recipe.source,
        note: undefined,
        ingredientNotes: undefined,
        pending: false,
        shared: false,
      };
      const saved = await insertRecipe(supabase, session.user.id, copy);
      if (!saved) {
        showToast("לא הצלחנו לשמור את המתכון.");
        return null;
      }
      setRecipes((list) => [...list, saved]);
      showToast("נוסף לספר המתכונים שלך.");
      return saved;
    },
    [session, supabase, showToast]
  );

  const nextUpgradeIdeas = useCallback(() => {
    const i = upgradeOffset.current;
    const pair = [upgradeIdeas[i % upgradeIdeas.length], upgradeIdeas[(i + 1) % upgradeIdeas.length]];
    upgradeOffset.current = (i + 2) % upgradeIdeas.length;
    return pair;
  }, []);

  const importFromText = useCallback(
    async (text: string): Promise<Recipe | null> => {
      if (!session) return null;
      let parsed: Omit<Recipe, "id" | "source"> | null = null;
      try {
        const res = await fetch("/api/import-recipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (res.ok) {
          const data = await res.json();
          parsed = data.recipe ?? null;
        }
      } catch {
        parsed = null;
      }
      if (!parsed) {
        showToast("הייבוא נכשל — נסי טקסט אחר.");
        return null;
      }

      const recipe: Recipe = { ...parsed, id: crypto.randomUUID(), source: "מיובא" };
      const saved = await insertRecipe(supabase, session.user.id, recipe);
      if (!saved) {
        showToast("הייבוא נכשל.");
        return null;
      }
      setRecipes((list) => [...list, saved]);
      showToast("יובא — נוסף לספר המתכונים שלך.");
      return saved;
    },
    [session, supabase, showToast]
  );

  // Derives a tentative, per-ingredient quantity suggestion from a free-text cooking note
  // (e.g. "too oniony" → "maybe 4 onions instead of 5 next time"). Shown next to the
  // ingredient's quantity on the groceries screen — never applied to the quantity itself.
  const deriveIngredientNotes = useCallback(
    async (recipe: Recipe, note: string): Promise<IngredientNote[] | undefined> => {
      try {
        const res = await fetch("/api/ingredient-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buyItems: recipe.buyItems, haveItems: recipe.haveItems, note }),
        });
        if (!res.ok) return undefined;
        const data = await res.json();
        const notes = data.notes as IngredientNote[] | undefined;
        return notes && notes.length ? notes : undefined;
      } catch {
        return undefined;
      }
    },
    []
  );

  const submitFeedback = useCallback(
    async (recipe: Recipe, note: string, save: boolean) => {
      if (!session) return;
      const trimmed = note.trim();
      const shortNote = trimmed.length > 24 ? trimmed.slice(0, 24) + "…" : trimmed;
      const existing = recipes.find((r) => r.id === recipe.id);
      const ingredientNotes = trimmed ? await deriveIngredientNotes(recipe, trimmed) : undefined;

      if (existing && !existing.pending) {
        if (trimmed) {
          const updated = await updateRecipe(supabase, recipe.id, { note: shortNote, ingredientNotes });
          if (updated) setRecipes((list) => list.map((r) => (r.id === recipe.id ? updated : r)));
        }
        showToast("נשמר.");
      } else if (existing && existing.pending) {
        if (!save) {
          await deleteRecipeRow(supabase, recipe.id);
          setRecipes((list) => list.filter((r) => r.id !== recipe.id));
          showToast("לא נשמר — הוסר מהספר.");
        } else {
          const updated = await updateRecipe(supabase, recipe.id, {
            pending: false,
            note: trimmed ? shortNote : existing.note,
            ingredientNotes: trimmed ? ingredientNotes : existing.ingredientNotes,
          });
          if (updated) setRecipes((list) => list.map((r) => (r.id === recipe.id ? updated : r)));
          showToast("נשמר בקביעות בספר שלך.");
        }
      } else if (save) {
        // The cookbook keeps original amounts — if this cook used a scaled version,
        // the saved copy is still the recipe as originally written.
        const original = getBaseRecipeById(recipe.id) ?? recipe;
        const copy: Recipe = { ...original, note: trimmed ? shortNote : undefined, ingredientNotes, pending: false };
        const saved = await insertRecipe(supabase, session.user.id, copy);
        if (saved) setRecipes((list) => [...list, saved]);
        showToast("נוסף לספר המתכונים שלך.");
      } else {
        showToast("לא נשמר הפעם.");
      }
    },
    [session, supabase, recipes, showToast, deriveIngredientNotes, getBaseRecipeById]
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      authStatus,
      userId: session?.user.id ?? null,
      userEmail: session?.user.email ?? null,
      userName,
      palette,
      isShared,
      setSharing,
      recipes,
      recipesLoading,
      toast,
      aiSuggestions,
      cacheAiSuggestions,
      setPalette,
      signInWithEmail,
      signOut,
      completeOnboarding,
      isSaved,
      getRecipeById,
      ensureRecipeCached,
      scaledRequestFor,
      applyScale,
      resetScale,
      saveRecipe,
      deleteRecipe,
      applyUpgrade,
      nextUpgradeIdeas,
      pendingUpgrade,
      confirmPendingUpgrade,
      applyNoteRevision,
      setRecipeShared,
      addToMyBook,
      importFromText,
      submitFeedback,
      showToast,
    }),
    [
      authStatus,
      session,
      userName,
      palette,
      isShared,
      setSharing,
      recipes,
      recipesLoading,
      toast,
      aiSuggestions,
      cacheAiSuggestions,
      setPalette,
      signInWithEmail,
      signOut,
      completeOnboarding,
      isSaved,
      getRecipeById,
      ensureRecipeCached,
      scaledRequestFor,
      applyScale,
      resetScale,
      saveRecipe,
      deleteRecipe,
      applyUpgrade,
      nextUpgradeIdeas,
      pendingUpgrade,
      confirmPendingUpgrade,
      applyNoteRevision,
      setRecipeShared,
      addToMyBook,
      importFromText,
      submitFeedback,
      showToast,
    ]
  );

  return (
    <StoreContext.Provider value={value}>
      <div data-palette={palette} className="min-h-screen">
        {children}
        <Toast />
      </div>
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
