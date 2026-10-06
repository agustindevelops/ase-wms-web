import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { PackageServiceError } from "@/lib/package/errors";
import { isVideoContentType } from "@/lib/storage/config";
import { getReadUrl } from "@/lib/storage/s3";

/** Long enough for a customer to browse and play package videos. */
const MEDIA_READ_URL_EXPIRES_IN = 6 * 60 * 60;

const packageInclude = {
  items: {
    include: { item: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  files: {
    include: {
      file: {
        select: {
          id: true,
          s3Key: true,
          status: true,
          publicUrl: true,
          contentType: true,
        },
      },
    },
    orderBy: { sortOrder: "asc" as const },
  },
} satisfies Prisma.PackageInclude;

type PackageRaw = Prisma.PackageGetPayload<{ include: typeof packageInclude }>;

export type PackageMedia = {
  id: string;
  fileId: string;
  type: "image" | "video";
  contentType: string;
  url: string | null;
};

export type PackageRecord = {
  id: string;
  name: string;
  description: string | null;
  basePriceCents: number;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{ id: string; itemId: string; name: string; quantity: number }>;
  media: PackageMedia[];
};

export type PackageInput = {
  name: string;
  description: string | null;
  basePriceCents: number;
  items: Array<{ itemId: string; quantity: number }>;
  /** Uploaded image/video file ids in display order. */
  media: Array<{ fileId: string }>;
};

function badRequest(message: string): never {
  throw new PackageServiceError("Bad Request", message);
}

function asNonNegativeInt(value: unknown, field: string): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  if (!Number.isInteger(parsed) || parsed < 0) {
    badRequest(`${field} must be an integer of 0 or more`);
  }
  return parsed;
}

export function parsePackageInput(body: Record<string, unknown>): PackageInput {
  if (typeof body.name !== "string" || !body.name.trim()) {
    badRequest("name is required");
  }
  if (
    body.description !== undefined &&
    body.description !== null &&
    typeof body.description !== "string"
  ) {
    badRequest("description must be a markdown string");
  }

  if (body.items !== undefined && !Array.isArray(body.items)) {
    badRequest("items must be an array");
  }
  const items = ((body.items as unknown[] | undefined) ?? []).map(
    (entry, index) => {
      if (!entry || typeof entry !== "object") {
        badRequest(`items[${index}] must be an object`);
      }
      const row = entry as Record<string, unknown>;
      if (typeof row.itemId !== "string" || !row.itemId.trim()) {
        badRequest(`items[${index}].itemId is required`);
      }
      const quantity = asNonNegativeInt(row.quantity, `items[${index}].quantity`);
      if (quantity === 0) {
        badRequest(`items[${index}].quantity must be greater than 0`);
      }
      return { itemId: row.itemId.trim(), quantity };
    },
  );
  const itemIds = items.map((row) => row.itemId);
  if (new Set(itemIds).size !== itemIds.length) {
    badRequest("Each item can only appear once in a package");
  }

  if (body.media !== undefined && !Array.isArray(body.media)) {
    badRequest("media must be an array");
  }
  const media = ((body.media as unknown[] | undefined) ?? []).map(
    (entry, index) => {
      if (!entry || typeof entry !== "object") {
        badRequest(`media[${index}] must be an object`);
      }
      const row = entry as Record<string, unknown>;
      if (typeof row.fileId !== "string" || !row.fileId.trim()) {
        badRequest(`media[${index}].fileId is required`);
      }
      return { fileId: row.fileId.trim() };
    },
  );

  return {
    name: body.name.trim(),
    description:
      typeof body.description === "string" && body.description.trim()
        ? body.description
        : null,
    basePriceCents: asNonNegativeInt(body.basePriceCents ?? 0, "basePriceCents"),
    items,
    media,
  };
}

async function fileReadUrl(file: {
  s3Key: string;
  status: string;
  publicUrl: string | null;
}): Promise<string | null> {
  if (file.publicUrl) {
    return file.publicUrl;
  }
  if (file.status !== "uploaded") {
    return null;
  }
  try {
    return await getReadUrl(file.s3Key, MEDIA_READ_URL_EXPIRES_IN);
  } catch {
    return null;
  }
}

async function mapPackage(pkg: PackageRaw): Promise<PackageRecord> {
  const media = await Promise.all(
    pkg.files.map(
      async (row): Promise<PackageMedia> => ({
        id: row.id,
        fileId: row.file.id,
        type: isVideoContentType(row.file.contentType) ? "video" : "image",
        contentType: row.file.contentType,
        url: await fileReadUrl(row.file),
      }),
    ),
  );
  return {
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    basePriceCents: pkg.basePriceCents,
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt,
    items: pkg.items.map((row) => ({
      id: row.id,
      itemId: row.itemId,
      name: row.item.name,
      quantity: row.quantity,
    })),
    media,
  };
}

export async function listPackages(organizationId: string) {
  const packages = await prisma.package.findMany({
    where: { organizationId },
    include: packageInclude,
    orderBy: { name: "asc" },
  });
  return Promise.all(packages.map(mapPackage));
}

export async function getPackage(
  organizationId: string,
  packageId: string,
): Promise<PackageRecord> {
  const pkg = await prisma.package.findFirst({
    where: { id: packageId, organizationId },
    include: packageInclude,
  });
  if (!pkg) {
    throw new PackageServiceError("Not Found", "Package not found", 404);
  }
  return mapPackage(pkg);
}

async function assertPackageRefs(
  tx: Prisma.TransactionClient,
  organizationId: string,
  input: PackageInput,
  packageId?: string,
) {
  const itemIds = input.items.map((row) => row.itemId);
  if (itemIds.length > 0) {
    const found = await tx.item.count({
      where: { id: { in: itemIds }, organizationId },
    });
    if (found !== itemIds.length) {
      throw new PackageServiceError(
        "ITEM_NOT_FOUND",
        "One or more items were not found",
        404,
      );
    }
  }

  const fileIds = input.media.map((row) => row.fileId);
  if (new Set(fileIds).size !== fileIds.length) {
    badRequest("Each file can only appear once in a package");
  }
  if (fileIds.length === 0) {
    return;
  }
  const files = await tx.file.findMany({
    where: { id: { in: fileIds }, organizationId },
    include: { packageFile: { select: { packageId: true } } },
  });
  if (files.length !== fileIds.length) {
    throw new PackageServiceError(
      "FILE_NOT_FOUND",
      "One or more media files were not found",
      404,
    );
  }
  for (const file of files) {
    if (file.status !== "uploaded") {
      throw new PackageServiceError(
        "FILE_NOT_VERIFIED",
        "Media only attaches after verified file upload",
      );
    }
    if (
      file.itemId ||
      (file.packageFile && file.packageFile.packageId !== packageId)
    ) {
      throw new PackageServiceError(
        "FILE_ALREADY_ATTACHED",
        "File is already attached to an item or another package",
        409,
      );
    }
  }
}

async function writePackageChildren(
  tx: Prisma.TransactionClient,
  organizationId: string,
  packageId: string,
  input: PackageInput,
) {
  await tx.packageItem.deleteMany({ where: { packageId, organizationId } });
  await tx.packageFile.deleteMany({ where: { packageId, organizationId } });

  if (input.items.length > 0) {
    await tx.packageItem.createMany({
      data: input.items.map((row) => ({
        organizationId,
        packageId,
        itemId: row.itemId,
        quantity: row.quantity,
      })),
    });
  }
  if (input.media.length > 0) {
    await tx.packageFile.createMany({
      data: input.media.map((row, index) => ({
        organizationId,
        packageId,
        sortOrder: index,
        fileId: row.fileId,
      })),
    });
  }
}

export async function createPackage(
  organizationId: string,
  input: PackageInput,
): Promise<PackageRecord> {
  const id = await prisma.$transaction(async (tx) => {
    await assertPackageRefs(tx, organizationId, input);
    const pkg = await tx.package.create({
      data: {
        organizationId,
        name: input.name,
        description: input.description,
        basePriceCents: input.basePriceCents,
      },
    });
    await writePackageChildren(tx, organizationId, pkg.id, input);
    return pkg.id;
  });
  return getPackage(organizationId, id);
}

export async function updatePackage(
  organizationId: string,
  packageId: string,
  input: PackageInput,
): Promise<PackageRecord> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.package.findFirst({
      where: { id: packageId, organizationId },
      select: { id: true },
    });
    if (!existing) {
      throw new PackageServiceError("Not Found", "Package not found", 404);
    }
    await assertPackageRefs(tx, organizationId, input, packageId);
    await tx.package.update({
      where: { id: packageId },
      data: {
        name: input.name,
        description: input.description,
        basePriceCents: input.basePriceCents,
      },
    });
    await writePackageChildren(tx, organizationId, packageId, input);
  });
  return getPackage(organizationId, packageId);
}

/** Orders that referenced the package keep their items; packageId becomes null. */
export async function deletePackage(
  organizationId: string,
  packageId: string,
): Promise<{ id: string; name: string }> {
  const existing = await prisma.package.findFirst({
    where: { id: packageId, organizationId },
    select: { id: true, name: true },
  });
  if (!existing) {
    throw new PackageServiceError("Not Found", "Package not found", 404);
  }
  await prisma.package.delete({ where: { id: packageId } });
  return existing;
}

/** Shape served to the customer site. */
export function toPublicPackage(pkg: PackageRecord) {
  return {
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    basePriceCents: pkg.basePriceCents,
    media: pkg.media.flatMap((row) =>
      row.url
        ? [{ type: row.type, contentType: row.contentType, url: row.url }]
        : [],
    ),
    items: pkg.items.map((row) => ({
      itemId: row.itemId,
      name: row.name,
      quantity: row.quantity,
    })),
  };
}
