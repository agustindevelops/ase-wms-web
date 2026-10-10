import "server-only";

import type { File } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  ALLOWED_CONTENT_TYPES,
  buildInventoryS3Key,
  isAllowedContentType,
  maxFileSizeBytes,
  UPLOAD_URL_EXPIRES_IN,
} from "@/lib/storage/config";
import {
  deleteObject,
  getObjectHeadBytes,
  getReadUrl,
  getUploadUrl,
  headObject,
} from "@/lib/storage/s3";

/** Presigned reads die. `"eternal"` is a stable app URL that signs a fresh read on each request. */
export const ETERNAL_READ_URL = "eternal" as const;

export type ReadUrlExpiresIn = number | typeof ETERNAL_READ_URL;

/** Path a browser can keep forever. The public file route redirects to a new signature. */
export function eternalPublicFilePath(
  organizationId: string,
  fileId: string,
): string {
  return `/api/public/${encodeURIComponent(organizationId)}/files/${encodeURIComponent(fileId)}`;
}

/**
 * Read link for an uploaded object.
 * Pass `expiresIn: "eternal"` when the URL may be cached by getStatic / ISR.
 * A number is a presigned URL that stops working after that many seconds (max 7 days).
 */
export async function createFileReadUrl(input: {
  s3Key: string;
  organizationId: string;
  fileId: string;
  expiresIn?: ReadUrlExpiresIn;
}): Promise<string> {
  if (input.expiresIn === ETERNAL_READ_URL) {
    return eternalPublicFilePath(input.organizationId, input.fileId);
  }
  return getReadUrl(input.s3Key, input.expiresIn ?? UPLOAD_URL_EXPIRES_IN);
}

export class FileServiceError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "FileServiceError";
    this.code = code;
    this.status = status;
  }
}

export type SignFileResult = {
  file: File;
  uploadUrl: string;
  expiresIn: number;
  bucket: string;
};

export type VerifyFileResult = {
  file: File;
  verifiedContentType: string;
  verifiedSizeBytes: number;
};

export async function signFileUpload(input: {
  userId: string;
  organizationId: string;
  contentType: string;
  byteSize?: number | null;
}): Promise<SignFileResult> {
  if (!isAllowedContentType(input.contentType)) {
    throw new FileServiceError(
      "INVALID_CONTENT_TYPE",
      `content_type must be one of: ${ALLOWED_CONTENT_TYPES.join(", ")}`,
    );
  }

  const maxBytes = maxFileSizeBytes(input.contentType);
  if (
    input.byteSize != null &&
    (!Number.isFinite(input.byteSize) ||
      input.byteSize <= 0 ||
      input.byteSize > maxBytes)
  ) {
    throw new FileServiceError(
      "INVALID_BYTE_SIZE",
      `byte_size must be between 1 and ${maxBytes}`,
    );
  }

  const signatureExpiration = new Date(Date.now() + UPLOAD_URL_EXPIRES_IN * 1000);

  const file = await prisma.$transaction(async (tx) => {
    const created = await tx.file.create({
      data: {
        organizationId: input.organizationId,
        uploadedByUserId: input.userId,
        s3Key: "pending",
        contentType: input.contentType,
        byteSize: input.byteSize ?? null,
        status: "created",
        signatureExpiration,
      },
    });

    const s3Key = buildInventoryS3Key(input.userId, created.id);
    return tx.file.update({
      where: { id: created.id },
      data: { s3Key },
    });
  });

  try {
    const upload = await getUploadUrl({
      s3Key: file.s3Key,
      contentType: input.contentType,
    });

    return {
      file,
      uploadUrl: upload.uploadUrl,
      expiresIn: upload.expiresIn,
      bucket: upload.bucket,
    };
  } catch (error) {
    await prisma.file.delete({ where: { id: file.id } }).catch(() => undefined);
    throw error;
  }
}

export async function verifyFileUpload(input: {
  userId: string;
  organizationId: string;
  fileId: string;
}): Promise<VerifyFileResult> {
  const file = await prisma.file.findFirst({
    where: {
      id: input.fileId,
      uploadedByUserId: input.userId,
      organizationId: input.organizationId,
    },
  });

  if (!file) {
    throw new FileServiceError("FILE_NOT_FOUND", "File not found", 404);
  }

  if (file.status === "uploaded") {
    return {
      file,
      verifiedContentType: file.contentType,
      verifiedSizeBytes: file.byteSize ?? 0,
    };
  }

  let metadata: Awaited<ReturnType<typeof headObject>>;
  try {
    metadata = await headObject(file.s3Key);
  } catch (error) {
    await destroyFailedUpload(file);
    throw new FileServiceError(
      "FILE_VERIFICATION_ERROR",
      `Failed to verify file: ${error instanceof Error ? error.message : String(error)}`,
      500,
    );
  }

  if (!metadata) {
    await destroyFailedUpload(file);
    throw new FileServiceError(
      "FILE_NOT_FOUND",
      "File not found in storage. Upload may have failed or expired.",
      404,
    );
  }

  const actualContentType = metadata.contentType ?? "";
  const claimedContentType = file.contentType;

  if (!isAllowedContentType(actualContentType)) {
    await destroyFailedUpload(file);
    throw new FileServiceError(
      "FILE_VERIFICATION_ERROR",
      `Invalid Content-Type: '${actualContentType}'. Allowed: ${ALLOWED_CONTENT_TYPES.join(", ")}.`,
    );
  }

  if (actualContentType !== claimedContentType) {
    await destroyFailedUpload(file);
    throw new FileServiceError(
      "FILE_VERIFICATION_ERROR",
      `Content-Type mismatch. Expected '${claimedContentType}', got '${actualContentType}'.`,
    );
  }

  const actualSize = metadata.contentLength ?? 0;
  const maxBytes = maxFileSizeBytes(actualContentType);
  if (actualSize > maxBytes) {
    await destroyFailedUpload(file);
    throw new FileServiceError(
      "FILE_VERIFICATION_ERROR",
      `File size ${actualSize} bytes exceeds maximum allowed size of ${maxBytes} bytes`,
    );
  }

  if (file.byteSize && actualSize > file.byteSize * 1.1) {
    await destroyFailedUpload(file);
    throw new FileServiceError(
      "FILE_VERIFICATION_ERROR",
      `File size ${actualSize} significantly exceeds claimed size ${file.byteSize}`,
    );
  }

  const header = await getObjectHeadBytes(file.s3Key);
  if (header && !matchesMagic(header, actualContentType)) {
    await destroyFailedUpload(file);
    throw new FileServiceError(
      "FILE_VERIFICATION_ERROR",
      `File signature does not match Content-Type '${actualContentType}'`,
    );
  }

  const updated = await prisma.file.update({
    where: { id: file.id },
    data: {
      status: "uploaded",
      contentType: actualContentType,
      byteSize: actualSize,
      // Reads use short-lived signed URLs from /api/test/img (no public CDN base).
      publicUrl: null,
    },
  });

  return {
    file: updated,
    verifiedContentType: actualContentType,
    verifiedSizeBytes: actualSize,
  };
}

export async function getOwnedFile(input: {
  userId: string;
  organizationId: string;
  fileId: string;
}): Promise<File> {
  const file = await prisma.file.findFirst({
    where: {
      id: input.fileId,
      uploadedByUserId: input.userId,
      organizationId: input.organizationId,
    },
  });

  if (!file) {
    throw new FileServiceError("FILE_NOT_FOUND", "File not found", 404);
  }

  return file;
}

export async function deleteOwnedFile(input: {
  userId: string;
  organizationId: string;
  fileId: string;
}): Promise<File> {
  const file = await getOwnedFile(input);
  await deleteObject(file.s3Key);
  await prisma.file.delete({ where: { id: file.id } });
  return file;
}

async function destroyFailedUpload(file: File): Promise<void> {
  await deleteObject(file.s3Key);
  await prisma.file.delete({ where: { id: file.id } }).catch(() => undefined);
}

export function matchesMagic(header: Uint8Array, contentType: string): boolean {
  if (contentType === "image/jpeg") {
    return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  }
  if (contentType === "image/png") {
    return (
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47 &&
      header[4] === 0x0d &&
      header[5] === 0x0a &&
      header[6] === 0x1a &&
      header[7] === 0x0a
    );
  }
  if (contentType === "image/webp") {
    const asText = String.fromCharCode(...header.slice(0, 12));
    return asText.startsWith("RIFF") && asText.includes("WEBP");
  }
  if (contentType === "video/webm") {
    return (
      header[0] === 0x1a &&
      header[1] === 0x45 &&
      header[2] === 0xdf &&
      header[3] === 0xa3
    );
  }
  if (contentType === "video/mp4" || contentType === "video/quicktime") {
    // ISO base media: first box type at bytes 4–7. Older QuickTime files may
    // open with a moov/mdat/wide/free/skip atom instead of ftyp.
    const boxType = String.fromCharCode(...header.slice(4, 8));
    const quickTimeAtoms = ["moov", "mdat", "wide", "free", "skip"];
    return (
      boxType === "ftyp" ||
      (contentType === "video/quicktime" && quickTimeAtoms.includes(boxType))
    );
  }
  return false;
}
