import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  getStorageConfig,
  UPLOAD_URL_EXPIRES_IN,
  type StorageConfig,
} from "@/lib/storage/config";

let client: S3Client | undefined;
let cachedConfig: StorageConfig | undefined;

function getClient(): { client: S3Client; config: StorageConfig } {
  const config = getStorageConfig();
  if (
    !client ||
    !cachedConfig ||
    cachedConfig.accessKeyId !== config.accessKeyId ||
    cachedConfig.bucket !== config.bucket ||
    cachedConfig.endpoint !== config.endpoint
  ) {
    client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
    cachedConfig = config;
  }
  return { client, config };
}

export async function getUploadUrl(input: {
  s3Key: string;
  contentType: string;
  expiresIn?: number;
}): Promise<{
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
  bucket: string;
  contentType: string;
}> {
  const { client: s3, config } = getClient();
  const expiresIn = input.expiresIn ?? UPLOAD_URL_EXPIRES_IN;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.s3Key,
      ContentType: input.contentType,
    }),
    { expiresIn },
  );

  return {
    uploadUrl,
    s3Key: input.s3Key,
    expiresIn,
    bucket: config.bucket,
    contentType: input.contentType,
  };
}

export async function getReadUrl(
  s3Key: string,
  expiresIn = UPLOAD_URL_EXPIRES_IN,
): Promise<string> {
  const { client: s3, config } = getClient();
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: s3Key,
    }),
    { expiresIn },
  );
}

export async function headObject(s3Key: string): Promise<{
  contentType: string | undefined;
  contentLength: number | undefined;
} | null> {
  const { client: s3, config } = getClient();
  try {
    const response = await s3.send(
      new HeadObjectCommand({
        Bucket: config.bucket,
        Key: s3Key,
      }),
    );
    return {
      contentType: response.ContentType,
      contentLength: response.ContentLength,
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function getObjectHeadBytes(
  s3Key: string,
  maxBytes = 1024,
): Promise<Uint8Array | null> {
  const { client: s3, config } = getClient();
  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: s3Key,
        Range: `bytes=0-${maxBytes - 1}`,
      }),
    );
    if (!response.Body) {
      return null;
    }
    return new Uint8Array(await response.Body.transformToByteArray());
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function deleteObject(s3Key: string): Promise<boolean> {
  const { client: s3, config } = getClient();
  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: s3Key,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function getConfiguredStorage() {
  return getClient().config;
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = "name" in error ? String(error.name) : "";
  const metadata =
    "$metadata" in error && error.$metadata && typeof error.$metadata === "object"
      ? (error.$metadata as { httpStatusCode?: number })
      : undefined;
  return name === "NotFound" || name === "NoSuchKey" || metadata?.httpStatusCode === 404;
}
