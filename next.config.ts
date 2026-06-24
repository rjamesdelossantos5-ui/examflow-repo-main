import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy — the main defense against XSS and data exfiltration.
// 'unsafe-inline' is required for Next.js bootstrap + the inline theme script and
// the app's inline styles; 'unsafe-eval' is only needed by the dev/HMR runtime.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https://*.supabase.co",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Clickjacking protection (in addition to CSP frame-ancestors, for old browsers)
  { key: "X-Frame-Options", value: "DENY" },
  // Stop MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs to other origins
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lock down powerful browser features the app doesn't use
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // Force HTTPS for a year (only honored over HTTPS, e.g. Vercel)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Isolate cross-origin window references
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Allow accessing the dev server from other devices on the LAN (e.g. phone,
  // another PC). Without this, Next.js blocks the cross-origin requests it uses
  // for hydration/HMR, so the page loads but nothing is clickable.
  allowedDevOrigins: ['192.168.1.11'],
  // Hide the framework banner header
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '16mb',
    },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
