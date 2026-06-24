import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow accessing the dev server from other devices on the LAN (e.g. phone,
  // another PC). Without this, Next.js blocks the cross-origin requests it uses
  // for hydration/HMR, so the page loads but nothing is clickable.
  allowedDevOrigins: ['192.168.1.11'],
  experimental: {
    serverActions: {
      bodySizeLimit: '16mb',
    },
  },
};

export default nextConfig;
