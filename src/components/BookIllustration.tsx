export function BookIllustration({ title }: { title: string }) {
  return (
    <div className="relative mx-auto w-full max-w-[260px]" style={{ aspectRatio: "300 / 340" }}>
      <svg viewBox="0 0 300 340" className="absolute inset-0 h-full w-full">
        <rect
          x="55"
          y="42"
          width="210"
          height="258"
          rx="22"
          fill="var(--surface)"
          stroke="var(--ink)"
          strokeWidth="5"
        />
        <rect
          x="35"
          y="26"
          width="210"
          height="258"
          rx="22"
          fill="var(--accent)"
          stroke="var(--ink)"
          strokeWidth="5"
        />
        <line
          x1="72"
          y1="48"
          x2="72"
          y2="262"
          stroke="var(--ink)"
          strokeWidth="3"
          opacity="0.25"
          strokeLinecap="round"
        />
        <path
          d="M124,8 L156,8 L156,92 L140,74 L124,92 Z"
          fill="var(--ink)"
          stroke="var(--ink)"
          strokeWidth="4"
          strokeLinejoin="round"
        />
      </svg>
      <div
        className="absolute text-center text-xl leading-snug"
        style={{
          left: "47%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "62%",
          color: "var(--accent-ink)",
          fontFamily: "var(--font-title)",
        }}
      >
        {title}
      </div>
    </div>
  );
}
