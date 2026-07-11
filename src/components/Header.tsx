"use client";

import { useRouter } from "next/navigation";

export function Header({
  title,
  onBack,
  trailing,
}: {
  title: string;
  onBack?: () => void;
  trailing?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between py-2" dir="ltr">
      <div className="flex items-center gap-2.5">
        <button
          aria-label="חזרה"
          onClick={() => (onBack ? onBack() : router.back())}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-ink"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M15,5 L8,12 L15,19"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span dir="rtl" className="text-xs font-bold text-muted">
          {title}
        </span>
      </div>
      {trailing}
    </div>
  );
}
