import "server-only";

import { randomUUID } from "node:crypto";
import {
  buildOrderUploadS3Key,
  MAX_ORDER_UPLOAD_SIZE_BYTES,
  ORDER_UPLOAD_EXTENSIONS,
  ORDER_UPLOAD_NAME_PATTERN,
} from "@/lib/storage/config";
import { matchesMagic } from "@/lib/storage/fileService";
import { getReadUrl, putObject } from "@/lib/storage/s3";

import { badRequest } from "./parseHelpers";

const READ_URL_EXPIRES_IN_SECONDS = 5 * 60;
const ORGANIZATION_ID_PATTERN = /^[a-z0-9]+$/;

type BookingPhoto = {
  body: Uint8Array;
  contentType: string;
  extension: string;
};

/** Multipart field "file": JPEG, PNG, or WebP under the size cap, checked by magic bytes. */
export async function readBookingPhoto(request: Request): Promise<BookingPhoto> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    badRequest("Multipart form body required");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    badRequest("file is required");
  }
  const extension = ORDER_UPLOAD_EXTENSIONS[file.type];
  if (!extension) {
    badRequest("Photos must be JPEG, PNG, or WebP");
  }
  if (file.size === 0 || file.size > MAX_ORDER_UPLOAD_SIZE_BYTES) {
    const maxMb = Math.floor(MAX_ORDER_UPLOAD_SIZE_BYTES / 1_000_000);
    badRequest(`Photos must be smaller than ${maxMb} MB`);
  }

  const body = new Uint8Array(await file.arrayBuffer());
  if (!matchesMagic(body.slice(0, 16), file.type)) {
    badRequest("File contents do not match the photo type");
  }
  return { body, contentType: file.type, extension };
}

/** Stores under an unguessable name and returns that name. */
export async function storeBookingPhoto(
  organizationId: string,
  photo: BookingPhoto,
): Promise<string> {
  const uploadName = `${randomUUID()}.${photo.extension}`;
  await putObject({
    s3Key: buildOrderUploadS3Key(organizationId, uploadName),
    contentType: photo.contentType,
    body: photo.body,
  });
  return uploadName;
}

/** App URL saved on OrderUpload.fileUrl; it redirects to a fresh signed read. */
export function bookingPhotoUrl(
  requestUrl: string,
  organizationId: string,
  uploadName: string,
): string {
  return new URL(
    `/api/public/${organizationId}/uploads/${uploadName}`,
    requestUrl,
  ).toString();
}

/** Signed read URL, or null when the path could not name a stored photo. */
export async function bookingPhotoReadUrl(
  organizationId: string,
  uploadName: string,
): Promise<string | null> {
  if (
    !ORGANIZATION_ID_PATTERN.test(organizationId) ||
    !ORDER_UPLOAD_NAME_PATTERN.test(uploadName)
  ) {
    return null;
  }
  return getReadUrl(
    buildOrderUploadS3Key(organizationId, uploadName),
    READ_URL_EXPIRES_IN_SECONDS,
  );
}
