const { existsSync } = require("node:fs");
const { config } = require("dotenv");

// Next.js only auto-loads .env / .env.local / .env.production.
// Production builds on this machine should use .env.prod (gitignored).
if (process.env.NODE_ENV === "production" && existsSync(".env.prod")) {
  config({ path: ".env.prod", override: true });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "aniahsocialevents.com",
      },
    ],
  },
};

module.exports = nextConfig;
