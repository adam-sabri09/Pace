import type { NextConfig } from "next";

const CSP_DIRECTIVES = [
  "default-src 'self'",
  // Next.js App Router injects inline scripts for hydration.
  // hCaptcha JS is loaded from js.hcaptcha.com with render=explicit.
  "script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com https://js.hcaptcha.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  // Supabase API + realtime, Google APIs (Calendar, Drive, Gemini, userinfo).
  // hCaptcha challenge verification calls.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.googleapis.com https://accounts.google.com https://hcaptcha.com https://*.hcaptcha.com",
  // Google Picker and OAuth consent screens, hCaptcha challenge iframe.
  "frame-src https://docs.google.com https://accounts.google.com https://hcaptcha.com https://*.hcaptcha.com",
  // Prevent this page from being embedded anywhere.
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP_DIRECTIVES },
  // HSTS: enforce HTTPS for one year including subdomains.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Prevent clickjacking (legacy; frame-ancestors 'none' in CSP is the modern equivalent).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // output: 'standalone' creates .next/standalone — the minimal bundle used by the Dockerfile.
  // `npm run dev` and `npm run start` are unaffected.
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
