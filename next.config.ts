import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  // Prevent clickjacking — the app must not be embeddable in iframes.
  { key: "X-Frame-Options", value: "DENY" },
  // Block MIME-type sniffing on scripts and stylesheets.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send only the origin (not the full URL) when following external links.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Deny access to sensitive browser APIs the app doesn't need.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // output: 'standalone' creates .next/standalone — the minimal bundle used by the Dockerfile.
  // `npm run dev` and `npm run start` are unaffected.
  output: "standalone",
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
