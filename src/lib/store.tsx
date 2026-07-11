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
import { Recipe, chatSuggestionPool, seedRecipes } from "./recipes";
import { sharedCookbooks, importedTofuBowl } from "./sharedCookbooks";
import { PaletteKey } from "./palette";
import { Toast } from "@/components/Toast";

const RECIPES_STORAGE_KEY = "shiras-cookbook-recipes-v1";

export type AuthStatus = "loading" | "signedOut" | "needsProfile" | "ready";

const substitutions: Record<string, string> = {
  עגבניות:
    "אפשר להחליף ברסק עגבניות מדולל במים, או קופסת עגבניות מרוסקות — הטעם ישתנה מעט אך זה יעבוד מצוין.",
  "רוטב עגבניות":
    "אפשר להחליף ברסק עגבניות מדולל במים, או אפילו קטשופ מהול — פחות עגבניתי אבל מציל את המנה.",
  חלב: "אפשר להחליף בחלב שקדים, סויה או שיבולת שועל ללא סוכר, באותה כמות.",
  ביצה: "לאפייה, כף זרעי פשתן טחונים עם 3 כפות מים (מוקפא 5 דקות) יכולה להחליף ביצה אחת.",
  שום: "רבע כפית אבקת שום שווה בערך לשן שום אחת טרייה.",
  בצל: "בצל ירוק, שאלוט, או אבקת בצל יכולים לתת טעם דומה בקצה.",
  גבינה: "כל גבינה צהובה נמסה טוב תעבוד במקומה — מוצרלה, צ׳דר או גאודה.",
  פטריות: "אפשר לדלג עליהן או להחליף בקישואים פרוסים דק.",
  שמנת: "ניתן להחליף בחלב מלא עם קצת חמאה מומסת, או יוגורט טבעי סמיך.",
};

const upgradeIdeas = [
  "רוטב שמנת ופטריות",
  "קראנץ׳ פירורי לחם קלויים",
  "תוספת ירקות שורש צלויים",
  "נגיעה של צ׳ילי חריף",
  "גבינה מגורדת בסיום",
  "עשבי תיבול טריים לפני ההגשה",
];

type StoreContextValue = {
  authStatus: AuthStatus;
  userEmail: string | null;
  userName: string;
  palette: PaletteKey;
  recipes: Recipe[];
  toast: string | null;
  sharedOwnerContext: string | null;
  setSharedOwnerContext: (owner: string | null) => void;
  setPalette: (p: PaletteKey) => void;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  completeOnboarding: (name: string, palette: PaletteKey) => Promise<void>;
  isSaved: (id: string) => boolean;
  getRecipeById: (id: string) => Recipe | undefined;
  saveRecipe: (recipe: Recipe, pending?: boolean) => void;
  deleteRecipe: (id: string) => void;
  applyUpgrade: (id: string, idea: string) => Recipe | undefined;
  nextUpgradeIdeas: () => string[];
  findSubstitution: (text: string) => string;
  importFromVideo: () => Recipe;
  submitFeedback: (recipe: Recipe, note: string, save: boolean) => void;
  showToast: (message: string) => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);

  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [userName, setUserName] = useState("");
  const [palette, setPaletteState] = useState<PaletteKey>("blue");
  const [recipes, setRecipes] = useState<Recipe[]>(seedRecipes);

  const [toast, setToast] = useState<string | null>(null);
  const [sharedOwnerContext, setSharedOwnerContext] = useState<string | null>(null);
  const recipesHydrated = useRef(false);
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
        .select("name, palette")
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
      setAuthStatus("ready");
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
      else setAuthStatus("signedOut");
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

  // --- Recipes (still local to this browser — moving to the database is next) ---

  useEffect(() => {
    if (authStatus !== "ready") return;
    try {
      const raw = window.localStorage.getItem(RECIPES_STORAGE_KEY);
      if (raw) setRecipes(JSON.parse(raw));
    } catch {
      // corrupt/blocked storage — fall back to the starter recipes silently
    }
    recipesHydrated.current = true;
  }, [authStatus]);

  useEffect(() => {
    if (!recipesHydrated.current) return;
    try {
      window.localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(recipes));
    } catch {
      // storage full/blocked — nothing we can do here
    }
  }, [recipes]);

  const isSaved = useCallback((id: string) => recipes.some((r) => r.id === id && !r.pending), [recipes]);

  const getRecipeById = useCallback(
    (id: string): Recipe | undefined => {
      return (
        recipes.find((r) => r.id === id) ??
        chatSuggestionPool.find((r) => r.id === id) ??
        sharedCookbooks.flatMap((cb) => cb.recipes).find((r) => r.id === id)
      );
    },
    [recipes]
  );

  const saveRecipe = useCallback((recipe: Recipe, pending = false) => {
    setRecipes((list) => {
      if (list.some((r) => r.id === recipe.id)) return list;
      return [...list, { ...recipe, pending }];
    });
  }, []);

  const deleteRecipe = useCallback(
    (id: string) => {
      setRecipes((list) => list.filter((r) => r.id !== id));
      showToast("המתכון הוסר מהספר שלך.");
    },
    [showToast]
  );

  const applyUpgrade = useCallback(
    (id: string, idea: string): Recipe | undefined => {
      let updated: Recipe | undefined;
      setRecipes((list) =>
        list.map((r) => {
          if (r.id !== id) return r;
          const newSteps = [...r.steps];
          const insertAt = Math.max(newSteps.length - 1, 0);
          newSteps.splice(insertAt, 0, { text: `להוסיף ${idea} למנה.` });
          updated = { ...r, buyItems: [...r.buyItems, idea], steps: newSteps };
          return updated;
        })
      );
      showToast("נוסף למתכון!");
      return updated;
    },
    [showToast]
  );

  const nextUpgradeIdeas = useCallback(() => {
    const i = upgradeOffset.current;
    const pair = [upgradeIdeas[i % upgradeIdeas.length], upgradeIdeas[(i + 1) % upgradeIdeas.length]];
    upgradeOffset.current = (i + 2) % upgradeIdeas.length;
    return pair;
  }, []);

  const findSubstitution = useCallback((text: string) => {
    for (const key of Object.keys(substitutions)) {
      if (text.includes(key)) return substitutions[key];
    }
    return "אין לי תחליף מדויק לזה כרגע — אבל בדרך כלל אפשר להסתדר עם משהו דומה שכבר יש במטבח. ספרי לי מה כן יש לך ונמצא פתרון.";
  }, []);

  const importFromVideo = useCallback((): Recipe => {
    const recipe = importedTofuBowl();
    setRecipes((list) => [...list, recipe]);
    showToast("יובא — נוסף לספר המתכונים שלך.");
    return recipe;
  }, [showToast]);

  const submitFeedback = useCallback(
    (recipe: Recipe, note: string, save: boolean) => {
      const trimmed = note.trim();
      const shortNote = trimmed.length > 24 ? trimmed.slice(0, 24) + "…" : trimmed;
      const existing = recipes.find((r) => r.id === recipe.id);

      setRecipes((list) => {
        if (existing && !existing.pending) {
          if (!trimmed) return list;
          return list.map((r) => (r.id === recipe.id ? { ...r, note: shortNote } : r));
        }
        if (existing && existing.pending) {
          if (!save) return list.filter((r) => r.id !== recipe.id);
          return list.map((r) =>
            r.id === recipe.id ? { ...r, pending: false, note: trimmed ? shortNote : r.note } : r
          );
        }
        if (!save) return list;
        const copy: Recipe = {
          ...recipe,
          source: sharedOwnerContext ? `משותף · ${sharedOwnerContext}` : recipe.source,
          note: trimmed ? shortNote : undefined,
          pending: false,
        };
        return [...list, copy];
      });

      if (existing && !existing.pending) showToast("נשמר.");
      else if (existing && existing.pending) showToast(save ? "נשמר בקביעות בספר שלך." : "לא נשמר — הוסר מהספר.");
      else showToast(save ? "נוסף לספר המתכונים שלך." : "לא נשמר הפעם.");
      setSharedOwnerContext(null);
    },
    [showToast, sharedOwnerContext, recipes]
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      authStatus,
      userEmail: session?.user.email ?? null,
      userName,
      palette,
      recipes,
      toast,
      sharedOwnerContext,
      setSharedOwnerContext,
      setPalette,
      signInWithEmail,
      signOut,
      completeOnboarding,
      isSaved,
      getRecipeById,
      saveRecipe,
      deleteRecipe,
      applyUpgrade,
      nextUpgradeIdeas,
      findSubstitution,
      importFromVideo,
      submitFeedback,
      showToast,
    }),
    [
      authStatus,
      session,
      userName,
      palette,
      recipes,
      toast,
      sharedOwnerContext,
      setPalette,
      signInWithEmail,
      signOut,
      completeOnboarding,
      isSaved,
      getRecipeById,
      saveRecipe,
      deleteRecipe,
      applyUpgrade,
      nextUpgradeIdeas,
      findSubstitution,
      importFromVideo,
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
