import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ResumeTracker } from "@/components/ResumeTracker";
import { TimerAlarm } from "@/components/TimerAlarm";

export const metadata: Metadata = {
  title: "My cookbook",
  description: "Your own AI cookbook.",
  manifest: "/manifest.json",
  // Installed to the home screen, the app can show timer notifications — a phone
  // won't hand those to a page running in a browser tab.
  appleWebApp: { capable: true, title: "My cookbook", statusBarStyle: "default" },
  other: {
    // Next emits the modern `mobile-web-app-capable`; older iOS only honours this
    // legacy spelling, and running standalone is the precondition for an iPhone
    // showing timer notifications at all.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className="h-full antialiased">
      <body className="min-h-full">
        <StoreProvider>
          <ResumeTracker />
          {children}
          <TimerAlarm />
        </StoreProvider>
      </body>
    </html>
  );
}
