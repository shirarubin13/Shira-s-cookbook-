import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ResumeTracker } from "@/components/ResumeTracker";

export const metadata: Metadata = {
  title: "My cookbook",
  description: "Your own AI cookbook.",
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
        </StoreProvider>
      </body>
    </html>
  );
}
