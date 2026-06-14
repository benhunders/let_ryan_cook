import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Dishes can use images uploaded to Supabase Storage or pasted from any URL,
    // so we allow optimization for any https host.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
