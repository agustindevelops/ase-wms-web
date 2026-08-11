import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Next.js uses .env.local; Prisma CLI also reads .env
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
