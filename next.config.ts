import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  allowedDevOrigins: ["192.168.10.111","172.29.96.1","172.17.192.1","192.168.113.20"],
  serverExternalPackages: ['nodejs-polars'],
};

export default nextConfig;
