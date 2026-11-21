import type { Metadata } from "next";
import { Anuphan } from "next/font/google";
import "./globals.css";

const anuphan = Anuphan({
  subsets: ["thai", "latin"],
  variable: "--font-anuphan",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ACX Farm — Player Logs",
  description: "ค้นหาและติดตามบันทึกการฟาร์มจาก Anime Crusaders X แบบเรียลไทม์",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${anuphan.variable} h-full antialiased`}>
      <body className="min-h-full font-[family-name:var(--font-anuphan)] selection:bg-indigo-200 selection:text-indigo-950">
        {children}
      </body>
    </html>
  );
}
