import { Recipe } from "@/lib/recipes";

export function RecipeCard({
  recipe,
  onClick,
  onDelete,
}: {
  recipe: Recipe;
  onClick: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-start gap-1 rounded-2xl border border-border bg-surface p-3.5">
      <button onClick={onClick} className="flex min-w-0 flex-1 items-start gap-3 text-right">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-surface-2 text-xl">
          {recipe.emoji}
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="font-bold">{recipe.title}</span>
          <span className="text-xs font-bold text-muted">{recipe.blurb}</span>
          <span className="flex flex-wrap gap-1.5 pt-0.5">
            <Tag>{recipe.steps.length} שלבים</Tag>
            <Tag>{recipe.source}</Tag>
            {recipe.pending && <Tag accent>טרם אושר</Tag>}
            {recipe.note && <Tag accent>הערה: {recipe.note}</Tag>}
          </span>
        </span>
      </button>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`למחוק את "${recipe.title}" מהספר שלך?`)) onDelete();
          }}
          aria-label="מחיקת מתכון"
          className="flex-none rounded-full p-2 text-muted"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

function Tag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold"
      style={{
        background: accent ? "var(--accent-soft)" : "var(--surface-2)",
        color: accent ? "var(--accent-deep)" : "var(--muted)",
      }}
    >
      {children}
    </span>
  );
}
