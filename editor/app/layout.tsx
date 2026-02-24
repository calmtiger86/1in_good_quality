import type { Metadata } from "next";
import "@/styles/variables.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "1iN 일인양품 — 카드뉴스 에디터",
  description: "쿠팡 파트너스 미니멀 카드뉴스 자동화 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://cdn.rawgit.com/moonspam/NanumSquare/master/nanumsquare.css"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
