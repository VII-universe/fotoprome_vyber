import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "v1.fotoprome.cz",
        pathname: "/shared/**",
      },
    ],
  },
  async rewrites() {
    return [
      // Proxy ASP images through Next.js to avoid CORS on <img> fallback
      {
        source: "/shared/:path*",
        destination: "https://v1.fotoprome.cz/shared/:path*",
      },
    ];
  },
};

export default nextConfig;
