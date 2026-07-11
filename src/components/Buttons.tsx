import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement>;

export function PrimaryButton({ className = "", ...props }: Props) {
  return (
    <button
      {...props}
      className={`w-full rounded-2xl py-3.5 text-center font-bold transition active:scale-[0.98] disabled:opacity-40 ${className}`}
      style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
    />
  );
}

export function GhostButton({ className = "", ...props }: Props) {
  return (
    <button
      {...props}
      className={`w-full rounded-2xl bg-surface-2 py-3.5 text-center font-bold text-ink transition active:scale-[0.98] ${className}`}
    />
  );
}
