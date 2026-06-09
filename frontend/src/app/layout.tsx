import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "INSIGHT 사내교육시스템",
  description: "사내 온라인 교육 통합 관리 시스템",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
