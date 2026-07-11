export function ProgressGauge({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[11px] text-muted">
        שלב {current} מתוך {total}
      </div>
      <div className="flex gap-0.5" dir="ltr">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: i < current ? "var(--accent-deep)" : "var(--surface-3)" }}
          />
        ))}
      </div>
    </div>
  );
}
