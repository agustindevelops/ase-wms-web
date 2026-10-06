import { existsSync } from "node:fs";
import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// `npm run build` sets NODE_ENV=production so Prisma reads .env.prod.
// Dev CLI (`migrate`, `studio`, `seed`) keeps using .env.local.
if (process.env.NODE_ENV === "production" && existsSync(".env.prod")) {
  config({ path: ".env.prod", override: true });
} else {
  config({ path: ".env.local" });
  config({ path: ".env" });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
