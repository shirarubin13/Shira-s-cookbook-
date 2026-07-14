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
};

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
  saveRecipe: (recipe: Recipe, pending?: boolean) => Promise<Recipe | null>;
  deleteRecipe: (id: string) => Promise<void>;
  applyUpgrade: (id: string, idea: string) => Promise<Recipe | undefined>;
  nextUpgradeIdeas: () => string[];
  pendingUpgrade: PendingUpgrade | null;
  confirmPendingUpgrade: (keep: boolean) => Promise<Recipe | undefined>;
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
  const upgradeOffset = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const getRecipeById = useCallback(
    (id: string): Recipe | undefined => {
      return (
        recipes.find((r) => r.id === id) ??
        aiSuggestions.find((r) => r.id === id) ??
        chatSuggestionPool.find((r) => r.id === id)
      );
    },
    [recipes, aiSuggestions]
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

  // Applying an upgrade only changes the local, in-session copy of the recipe — it's
  // not written to the database yet. It's confirmed (or dropped) via confirmPendingUpgrade,
  // normally triggered by the "keep this upgrade?" toggle on the Feedback screen at the
  // end of cooking, so an upgrade never silently becomes permanent.
  const applyUpgrade = useCallback(
    async (id: string, idea: string): Promise<Recipe | undefined> => {
      const current = getRecipeById(id);
      if (!current) return undefined;

      const newSteps = [...current.steps];
      const insertAt = Math.max(newSteps.length - 1, 0);
      newSteps.splice(insertAt, 0, { text: `שדרוג שבחרת: להוסיף ${idea}.` });
      const buyItems = [...current.buyItems, { name: idea }];
      const updated: Recipe = { ...current, buyItems, steps: newSteps };

      setPendingUpgrade({
        recipeId: id,
        idea,
        previousSteps: current.steps,
        previousBuyItems: current.buyItems,
      });

      if (recipes.some((r) => r.id === id)) {
        setRecipes((list) => list.map((r) => (r.id === id ? updated : r)));
      } else {
        setAiSuggestions((list) => list.map((r) => (r.id === id ? updated : r)));
      }
      showToast("נוסף למתכון — בסוף הבישול נשאל אם לשמור את זה.");
      return updated;
    },
    [recipes, showToast, getRecipeById]
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
        };
        if (recipes.some((r) => r.id === pending.recipeId)) {
          setRecipes((list) => list.map((r) => (r.id === pending.recipeId ? reverted : r)));
        } else {
          setAiSuggestions((list) => list.map((r) => (r.id === pending.recipeId ? reverted : r)));
        }
        return reverted;
      }

      // If the recipe is already saved, the upgrade needs an explicit write — otherwise
      // it's just part of whatever gets saved next (first save, or not saved at all).
      if (recipes.some((r) => r.id === pending.recipeId)) {
        const updated = await updateRecipe(supabase, pending.recipeId, {
          buyItems: current.buyItems,
          steps: current.steps,
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
    [pendingUpgrade, recipes, supabase, showToast, getRecipeById]
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
        const copy: Recipe = { ...recipe, note: trimmed ? shortNote : undefined, ingredientNotes, pending: false };
        const saved = await insertRecipe(supabase, session.user.id, copy);
        if (saved) setRecipes((list) => [...list, saved]);
        showToast("נוסף לספר המתכונים שלך.");
      } else {
        showToast("לא נשמר הפעם.");
      }
    },
    [session, supabase, recipes, showToast, deriveIngredientNotes]
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
      saveRecipe,
      deleteRecipe,
      applyUpgrade,
      nextUpgradeIdeas,
      pendingUpgrade,
      confirmPendingUpgrade,
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
      saveRecipe,
      deleteRecipe,
      applyUpgrade,
      nextUpgradeIdeas,
      pendingUpgrade,
      confirmPendingUpgrade,
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
