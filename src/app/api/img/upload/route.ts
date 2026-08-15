import { NextResponse } from "next/server";
import {
  isAuthFailure,
  requirePrismaUser,
} from "@/lib/auth/requireAuth";
import {
  FileServiceError,
  signFileUpload,
} from "@/lib/storage/fileService";

export const runtime = "nodejs";

/**
 * Create a File row (status=created) and return a presigned PUT URL.
 * Client uploads bytes directly to storage, then calls /api/img/verify.
 */
export async function POST(request: Request) {
  const auth = await requirePrismaUser(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const contentType =
    body &&
    typeof body === "object" &&
    "content_type" in body &&
    typeof body.content_type === "string"
      ? body.content_type
      : null;

  const byteSizeRaw =
    body && typeof body === "object" && "byte_size" in body
      ? body.byte_size
      : undefined;

  const byteSize =
    byteSizeRaw === undefined || byteSizeRaw === null
      ? null
      : typeof byteSizeRaw === "number"
        ? byteSizeRaw
        : Number.NaN;

  if (!contentType) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message: "content_type is required (image/jpeg|image/png|image/webp)",
      },
      { status: 400 },
    );
  }

  try {
    const result = await signFileUpload({
      userId: auth.user.id,
      organizationId: auth.organizationId,
      contentType,
      byteSize,
    });

    return NextResponse.json({
      file_id: result.file.id,
      upload_url: result.uploadUrl,
      s3_key: result.file.s3Key,
      expires_in: result.expiresIn,
      bucket: result.bucket,
      content_type: result.file.contentType,
      status: result.file.status,
      signature_expiration: result.file.signatureExpiration,
    });
  } catch (error) {
    if (error instanceof FileServiceError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to create upload URL";
    const isConfig = message.includes("Storage is not configured");
    return NextResponse.json(
      {
        error: isConfig ? "FILE_CONFIGURATION_ERROR" : "FILE_SIGN_ERROR",
        message,
      },
      { status: isConfig ? 503 : 500 },
    );
  }
}
