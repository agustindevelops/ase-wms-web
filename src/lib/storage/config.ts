import "server-only";

/** Item photos accept images only (ASE-11). */
export const IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** Package media also accepts video files. */
export const VIDEO_CONTENT_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const ALLOWED_CONTENT_TYPES = [
  ...IMAGE_CONTENT_TYPES,
  ...VIDEO_CONTENT_TYPES,
] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export const MAX_IMAGE_SIZE_BYTES = 15_000_000;
export const MAX_VIDEO_SIZE_BYTES = 250_000_000;
export const UPLOAD_URL_EXPIRES_IN = 600;

export function isImageContentType(value: string): boolean {
  return (IMAGE_CONTENT_TYPES as readonly string[]).includes(value);
}

export function isVideoContentType(value: string): boolean {
  return (VIDEO_CONTENT_TYPES as readonly string[]).includes(value);
}

export function maxFileSizeBytes(contentType: string): number {
  return isVideoContentType(contentType)
    ? MAX_VIDEO_SIZE_BYTES
    : MAX_IMAGE_SIZE_BYTES;
}

export type StorageConfig = {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  region: string;
};

export function isAllowedContentType(
  value: string,
): value is AllowedContentType {
  return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(value);
}

/**
 * Parse S3_API_URL like:
 * https://<accountId>.r2.cloudflarestorage.com/<bucket>
 */
function parseS3ApiUrl(raw: string): { endpoint: string; bucket: string } | null {
  try {
    const url = new URL(raw.trim());
    const bucket = url.pathname.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "";
    if (!url.origin || !bucket) {
      return null;
    }
    return {
      endpoint: url.origin,
      bucket,
    };
  } catch {
    return null;
  }
}

/**
 * Cloudflare R2 config from the three required env vars:
 *   S3_API_URL
 *   CLOUDFLARE_ACCESS_KEY_ID
 *   CLOUDFLARE_ACCESS_KEY
 */
export function getStorageConfig(): StorageConfig {
  const parsed = parseS3ApiUrl(process.env.S3_API_URL ?? "");
  const accessKeyId = process.env.CLOUDFLARE_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = process.env.CLOUDFLARE_ACCESS_KEY?.trim() ?? "";

  if (!parsed || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Storage is not configured. Set S3_API_URL, CLOUDFLARE_ACCESS_KEY_ID, and CLOUDFLARE_ACCESS_KEY.",
    );
  }

  return {
    accessKeyId,
    secretAccessKey,
    bucket: parsed.bucket,
    endpoint: parsed.endpoint,
    region: "auto",
  };
}

export function buildInventoryS3Key(userId: string, fileId: string): string {
  return `${userId}/inventory/${fileId}`;
}
