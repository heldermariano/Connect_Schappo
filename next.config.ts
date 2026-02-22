import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  allowedDevOrigins: ["connect.clinicaschappo.com", "10.150.77.78"],
};

export default nextConfig;
