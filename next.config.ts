import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfmake", "pdfkit"],
};

export default nextConfig;
