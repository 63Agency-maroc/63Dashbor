import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Empêche Turbopack de remonter au package-lock du profil utilisateur
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
