import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pace — Study plans that adapt when life doesn't",
  description:
    "Pace builds a realistic study schedule for your exams and automatically adjusts if you miss a session.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${hanken.variable} h-full antialiased`}>
      <head>
        {/*
          Material Symbols Outlined is loaded here rather than via next/font/google because
          it's an icon font with variation axes (FILL / wght / GRAD / opsz) that next/font
          does not model. See DESIGN-SPEC.md §1.7.
        */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-on-surface">
        {children}
      </body>
    </html>
  );
}
