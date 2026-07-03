import type { NextConfig } from "next";

// Only our own Supabase Storage host is allowlisted for the image optimizer.
// A wildcard here would let anyone use this deployment as a free image proxy.
// Externally pasted image URLs render with `unoptimized` (see lib/images.ts).
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost }]
      : [],
  },
};

export default nextConfig;
