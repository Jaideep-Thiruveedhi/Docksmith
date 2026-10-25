import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-neon"],
  webpack(config) {
    // Keep Node and Webpack on the same module paths when dependencies use junctions.
    config.resolve.symlinks = false;
    config.resolveLoader.symlinks = false;
    return config;
  },
};

export default nextConfig;
