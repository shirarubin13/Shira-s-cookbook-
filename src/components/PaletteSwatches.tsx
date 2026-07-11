import { PaletteKey, palettes } from "@/lib/palette";

export function PaletteSwatches({
  value,
  onChange,
}: {
  value: PaletteKey;
  onChange: (p: PaletteKey) => void;
}) {
  return (
    <div className="flex justify-center gap-4">
      {palettes.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className="flex flex-col items-center gap-1.5"
        >
          <span
            className="block h-9 w-9 rounded-full"
            style={{
              background: p.swatch,
              border: value === p.key ? "3px solid var(--ink)" : "1.5px solid var(--border)",
            }}
          />
          <span className="text-[11px] font-bold text-muted">{p.label}</span>
        </button>
      ))}
    </div>
  );
}
