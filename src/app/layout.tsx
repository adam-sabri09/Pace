import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-hanken",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pace-io.vercel.app";

const MATERIAL_SYMBOLS_HREF =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap";

export const metadata: Metadata = {
  title: "Pace — Study plans that adapt when life doesn't",
  description:
    "Pace builds a realistic study schedule for your exams and automatically adjusts if you miss a session.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    siteName: "Pace",
    title: "Pace — Study plans that adapt when life doesn't",
    description:
      "Pace builds a realistic study schedule for your exams and automatically adjusts if you miss a session.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary",
    title: "Pace — Study plans that adapt when life doesn't",
    description:
      "Pace builds a realistic study schedule for your exams and automatically adjusts if you miss a session.",
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📚</text></svg>",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
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
          Material Symbols Outlined: loaded asynchronously to avoid blocking rendering.
          - preconnect: DNS + TLS handshake early for both Google Fonts origins.
          - preload as="style": browser fetches at high priority without blocking.
          - stylesheet media="print": browser loads but does not apply to screen,
            so it is non-render-blocking. The inline script switches media to "all"
            once loading completes, applying the styles.
          - noscript fallback: loads normally for JS-disabled browsers.
          Loaded manually (not via next/font) because the variation-axis syntax
          (FILL/wght/GRAD/opsz) is not supported by next/font/google. See DESIGN-SPEC.md §1.7.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="preload" as="style" href={MATERIAL_SYMBOLS_HREF} />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={MATERIAL_SYMBOLS_HREF} media="print" />
        {/* biome-ignore lint: noscript content is intentionally raw HTML */}
        <noscript dangerouslySetInnerHTML={{ __html: `<link rel="stylesheet" href="${MATERIAL_SYMBOLS_HREF}">` }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var l=document.querySelector('link[href*="Material+Symbols"][media="print"]');if(l){if(l.sheet){l.media='all'}else{l.addEventListener('load',function(){l.media='all'})}}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-on-surface">
        {children}
      </body>
    </html>
  );
}
