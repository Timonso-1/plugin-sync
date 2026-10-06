import type { NextConfig } from "next";

const config: NextConfig = {
  // Nur im Docker-Build, lokal funktioniert so weiterhin "next start"
  output: process.env.STANDALONE === "1" ? "standalone" : undefined,
  // Verhindert, dass Next eine package-lock.json aus einem übergeordneten Ordner als Root nimmt
  outputFileTracingRoot: process.cwd(),
  experimental: {
    // Plugin-JARs werden per Server Action hochgeladen
    serverActions: { bodySizeLimit: "200mb" },
  },
};

export default config;
