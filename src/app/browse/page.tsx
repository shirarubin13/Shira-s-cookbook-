"use client";

import { Screen } from "@/components/Screen";
import { Header } from "@/components/Header";

export default function BrowsePage() {
  return (
    <Screen>
      <Header title="ספרים משותפים" />
      <div className="flex flex-col items-center gap-3 pt-16 text-center">
        <span className="text-4xl">📖</span>
        <p className="text-sm font-bold text-muted">אין כאן רשימה — שיתוף עובד לפי קישור אישי.</p>
        <p className="text-xs font-bold text-muted">
          כשחברה תשלח לך את הקישור לספר שלה, פשוט פתחי אותו ותוכלי לצפות במתכונים שלה.
        </p>
      </div>
    </Screen>
  );
}
