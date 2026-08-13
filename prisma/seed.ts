import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  ADMIN_ROLE_CODE,
  ADMIN_ROLE_DESCRIPTION,
  ADMIN_ROLE_NAME,
  LOCATION_UNIT_TYPES,
  QR_CODE_TYPES,
} from "../src/lib/db/defaults";

config({ path: ".env.local" });
config({ path: ".env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  await prisma.role.upsert({
    where: { code: ADMIN_ROLE_CODE },
    create: {
      code: ADMIN_ROLE_CODE,
      name: ADMIN_ROLE_NAME,
      description: ADMIN_ROLE_DESCRIPTION,
    },
    update: {
      name: ADMIN_ROLE_NAME,
      description: ADMIN_ROLE_DESCRIPTION,
    },
  });

  for (const type of LOCATION_UNIT_TYPES) {
    await prisma.locationUnitType.upsert({
      where: { code: type.code },
      create: type,
      update: { name: type.name },
    });
  }

  for (const type of QR_CODE_TYPES) {
    await prisma.qrCodeType.upsert({
      where: { code: type.code },
      create: type,
      update: { name: type.name },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
