import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["adm-zip", "mammoth"],
  experimental: {
    proxyClientMaxBodySize: 500 * 1024 * 1024, // 500MB for ZIP uploads
  },
};

export default nextConfig;
