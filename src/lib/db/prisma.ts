import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Server-only Prisma singleton.
 * Never import this from Client Components. DATABASE_URL must stay off NEXT_PUBLIC_*.
 */
const globalForPrisma = globalThis as unknown as {
  prismaClient: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.template to .env.local and add your Postgres URL.",
    );
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/**
 * Lazy so importing route modules does not require DATABASE_URL at build time.
 * Recreates the singleton when the generated client gained new models (e.g. after
 * migrate + generate while `next dev` kept an old PrismaClient in globalThis).
 */
export function getPrisma(): PrismaClient {
  const existing = globalForPrisma.prismaClient;
  if (existing && typeof (existing as { itemCategory?: unknown }).itemCategory === "undefined") {
    void existing.$disconnect().catch(() => undefined);
    globalForPrisma.prismaClient = undefined;
  }

  if (!globalForPrisma.prismaClient) {
    globalForPrisma.prismaClient = createPrismaClient();
  }
  return globalForPrisma.prismaClient;
}

/**
 * Lazy Prisma accessor. Model getters (user, locationUnit, …) must run with
 * the real client as `this`. Using the Proxy as Reflect receiver returns
 * undefined delegates and 500s like "Cannot read properties of undefined".
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
