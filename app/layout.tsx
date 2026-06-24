import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "영어챔피언 🏆",
  description: "AI 영어 퀴즈 플랫폼",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen" style={{ background: "var(--bg)" }}>
        {children}
      </body>
    </html>
  );
}
