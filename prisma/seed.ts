import { config } from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  ADMIN_ROLE_CODE,
  ADMIN_ROLE_DESCRIPTION,
  ADMIN_ROLE_NAME,
  ANIAH_ADMIN_EMAIL,
  ANIAH_ORGANIZATION,
  ANIAH_WAREHOUSE_NAME,
  ITEM_CATEGORIES,
  LOCATION_UNIT_TYPES,
  ORDER_STATUSES,
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

function getSeedFirebaseAuth() {
  if (!getApps().length) {
    const credentialsJson = process.env.FIREBASE_ADMIN_CREDENTIALS_JSON;
    if (!credentialsJson) {
      throw new Error("FIREBASE_ADMIN_CREDENTIALS_JSON is not configured");
    }
    initializeApp({
      credential: cert(JSON.parse(credentialsJson)),
    });
  }
  return getAuth();
}

async function main() {
  const firebaseAuth = getSeedFirebaseAuth();

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

  for (const category of ITEM_CATEGORIES) {
    await prisma.itemCategory.upsert({
      where: { code: category.code },
      create: category,
      update: { name: category.name },
    });
  }

  for (const status of ORDER_STATUSES) {
    await prisma.orderStatus.upsert({
      where: { code: status.code },
      create: status,
      update: { name: status.name },
    });
  }

  const firebaseUser = await firebaseAuth.getUserByEmail(ANIAH_ADMIN_EMAIL);

  const result = await prisma.$transaction(async (tx) => {
    const adminRole = await tx.role.findUniqueOrThrow({
      where: { code: ADMIN_ROLE_CODE },
    });

    const organization = await tx.organization.upsert({
      where: { slug: ANIAH_ORGANIZATION.slug },
      update: {
        name: ANIAH_ORGANIZATION.name,
        contactEmail: ANIAH_ORGANIZATION.contactEmail,
        websiteUrl: ANIAH_ORGANIZATION.websiteUrl,
      },
      create: ANIAH_ORGANIZATION,
    });

    const user = await tx.user.upsert({
      where: { email: ANIAH_ADMIN_EMAIL },
      update: { firebaseUid: firebaseUser.uid },
      create: {
        email: ANIAH_ADMIN_EMAIL,
        firebaseUid: firebaseUser.uid,
      },
    });

    await tx.organizationMembership.upsert({
      where: { userId: user.id },
      update: {
        organizationId: organization.id,
        roleId: adminRole.id,
      },
      create: {
        organizationId: organization.id,
        userId: user.id,
        roleId: adminRole.id,
      },
    });

    let warehouse = await tx.warehouse.findFirst({
      where: {
        organizationId: organization.id,
        name: ANIAH_WAREHOUSE_NAME,
      },
    });
    if (!warehouse) {
      const address = await tx.address.create({
        data: { organizationId: organization.id },
      });
      warehouse = await tx.warehouse.create({
        data: {
          organizationId: organization.id,
          name: ANIAH_WAREHOUSE_NAME,
          addressId: address.id,
        },
      });
    }

    return {
      organizationId: organization.id,
      userId: user.id,
      warehouseId: warehouse.id,
    };
  });

  const latestFirebaseUser = await firebaseAuth.getUser(firebaseUser.uid);
  const existing = { ...(latestFirebaseUser.customClaims ?? {}) };
  delete existing.wms;
  existing.organizationId = result.organizationId;
  await firebaseAuth.setCustomUserClaims(firebaseUser.uid, existing);

  console.log("Aniah Social Events initialized");
  console.log({
    organizationId: result.organizationId,
    userId: result.userId,
    warehouseId: result.warehouseId,
    firebaseUid: firebaseUser.uid,
  });
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
