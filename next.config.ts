import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Old addresses from before the 3-tab layout still work
  async redirects() {
    return [
      { source: "/home", destination: "/man", permanent: false },
      { source: "/progress", destination: "/man", permanent: false },
      { source: "/profile", destination: "/me", permanent: false },
    ];
  },
};

export default nextConfig;
