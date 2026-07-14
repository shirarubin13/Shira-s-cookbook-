import { Recipe } from "./recipes";

/**
 * Local persistence for the recipe chat: the conversation survives leaving the
 * page (e.g. to look at a suggested recipe, or the phone closing the tab) for a
 * few hours, so people don't lose the options they were just offered.
 */

export type ChatEntry =
  | { kind: "user"; text: string }
  | { kind: "bot"; text: string }
  | { kind: "suggestions"; recipes: Recipe[] };

const STORAGE_KEY = "cookbook-chat-v1";
const CHAT_TTL_MS = 3 * 60 * 60 * 1000;

export function loadStoredChat(): { entries: ChatEntry[]; saved: string[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.entries) || Date.now() - parsed.at > CHAT_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { entries: parsed.entries, saved: Array.isArray(parsed.saved) ? parsed.saved : [] };
  } catch {
    return null;
  }
}

export function saveStoredChat(entries: ChatEntry[], saved: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), entries, saved }));
  } catch {
    // storage full or blocked — the chat just won't be remembered, nothing to do
  }
}

/** Finds a chat-suggested recipe by id in the stored conversation — used to reopen
 * a suggestion after a full page reload, when the in-memory cache is gone. */
export function findStoredChatRecipe(id: string): Recipe | null {
  const stored = loadStoredChat();
  if (!stored) return null;
  for (const entry of stored.entries) {
    if (entry.kind !== "suggestions") continue;
    const match = entry.recipes.find((r) => r.id === id);
    if (match) return match;
  }
  return null;
}
