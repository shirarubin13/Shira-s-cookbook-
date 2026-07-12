"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { PaletteSwatches } from "./PaletteSwatches";
import { PrimaryButton } from "./Buttons";
import { Screen } from "./Screen";

export function WelcomeScreen() {
  const { authStatus } = useStore();
  if (authStatus === "needsProfile") return <ProfileSetupScreen />;
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}

function friendlyAuthError(raw: string): string {
  if (/rate limit/i.test(raw)) {
    return "נשלחו יותר מדי קישורים בזמן קצר — אפשר לנסות שוב בעוד כמה דקות.";
  }
  return "לא הצלחנו לשלוח את הקישור — אפשר לנסות שוב בעוד רגע.";
}

function LoginScreen() {
  const { signInWithEmail } = useStore();
  const searchParams = useSearchParams();
  const linkExpired = searchParams.get("authError") === "1";

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function send() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    const { error } = await signInWithEmail(trimmed);
    setLoading(false);
    if (error) setError(friendlyAuthError(error));
    else setSent(true);
  }

  if (sent) {
    return (
      <Screen>
        <div className="flex min-h-[85vh] flex-col items-center justify-center gap-3 text-center">
          <div className="text-4xl">📬</div>
          <h1 className="text-xl font-bold">שלחנו לך קישור להתחברות</h1>
          <p className="font-bold text-muted">
            פתחי את המייל בכתובת <span dir="ltr" className="inline-block">{email}</span> ולחצי על הקישור כדי להיכנס.
          </p>
          <p className="text-sm font-bold" style={{ color: "var(--accent-deep)" }}>
            לא רואה את המייל? כדאי לבדוק בתיקיית הספאם — לפעמים הוא מגיע לשם.
          </p>
          <p className="text-sm font-bold text-muted">
            טיפ: אם עבר קצת זמן מאז שנשלח, יכול להיות שהוא פג — עדיף ללחוץ עליו תוך כמה דקות מהשליחה.
          </p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="flex min-h-[85vh] flex-col justify-center gap-5">
        <div className="text-xs font-bold" style={{ color: "var(--accent-deep)" }}>
          ברוכים הבאים
        </div>
        <h1 className="text-2xl font-bold">ספר המתכונים שלך</h1>
        <p className="font-bold text-muted">מזינים אימייל, ושולחים לך קישור להתחברות — בלי סיסמה.</p>

        {linkExpired && (
          <div className="rounded-2xl p-3.5" style={{ background: "var(--accent-soft)" }}>
            <p className="text-sm font-bold" style={{ color: "var(--accent-deep)" }}>
              הקישור שלחצת עליו כבר לא בתוקף (בדרך כלל כי עבר עליו זמן, או שכבר נעשה בו שימוש) — פשוט שלחי לעצמך קישור חדש למטה.
            </p>
          </div>
        )}

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="you@example.com"
          type="email"
          dir="ltr"
          className="rounded-2xl bg-surface-2 px-4 py-3.5 text-left"
        />

        {error && <p className="text-sm font-bold text-red-600">{error}</p>}

        <PrimaryButton disabled={!email.trim() || loading} onClick={send}>
          {loading ? "שולח…" : "שליחת קישור התחברות"}
        </PrimaryButton>
      </div>
    </Screen>
  );
}

function ProfileSetupScreen() {
  const { palette, setPalette, completeOnboarding } = useStore();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const trimmed = name.trim();

  return (
    <Screen>
      <div className="flex min-h-[85vh] flex-col justify-center gap-5">
        <div className="text-xs font-bold" style={{ color: "var(--accent-deep)" }}>
          כמעט מוכנות
        </div>
        <h1 className="text-2xl font-bold">של מי ספר המתכונים הזה?</h1>
        <p className="font-bold text-muted">השם שלך יוצר מרחב מתכונים משלך.</p>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="לדוגמה: שירה"
          className="rounded-2xl bg-surface-2 px-4 py-3.5 text-right"
        />

        <p className="text-center text-xs font-bold text-muted">ובאיזה צבע יהיה הספר שלך?</p>
        <PaletteSwatches value={palette} onChange={setPalette} />

        <PrimaryButton
          disabled={!trimmed || saving}
          onClick={async () => {
            setSaving(true);
            await completeOnboarding(trimmed, palette);
            setSaving(false);
          }}
        >
          {saving ? "שומר…" : "פתיחת ספר המתכונים שלי"}
        </PrimaryButton>
      </div>
    </Screen>
  );
}
