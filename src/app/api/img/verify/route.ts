import { NextResponse } from "next/server";
import {
  isAuthFailure,
  requirePrismaUser,
} from "@/lib/auth/requireAuth";
import {
  FileServiceError,
  verifyFileUpload,
} from "@/lib/storage/fileService";

export const runtime = "nodejs";

/**
 * HEAD + content-type/size/magic checks. Success → status=uploaded + File row.
 * Failure → delete object + row.
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

  const fileId =
    body &&
    typeof body === "object" &&
    "file_id" in body &&
    typeof body.file_id === "string"
      ? body.file_id
      : null;

  if (!fileId) {
    return NextResponse.json(
      { error: "Bad Request", message: "file_id is required" },
      { status: 400 },
    );
  }

  try {
    const result = await verifyFileUpload({
      userId: auth.user.id,
      fileId,
    });

    return NextResponse.json({
      file: {
        id: result.file.id,
        itemId: result.file.itemId,
        uploadedByUserId: result.file.uploadedByUserId,
        s3Key: result.file.s3Key,
        contentType: result.file.contentType,
        byteSize: result.file.byteSize,
        status: result.file.status,
        signatureExpiration: result.file.signatureExpiration,
        publicUrl: result.file.publicUrl,
        sortOrder: result.file.sortOrder,
        createdAt: result.file.createdAt,
        updatedAt: result.file.updatedAt,
      },
      verified_content_type: result.verifiedContentType,
      verified_size_bytes: result.verifiedSizeBytes,
    });
  } catch (error) {
    if (error instanceof FileServiceError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error: "FILE_VERIFICATION_ERROR",
        message:
          error instanceof Error ? error.message : "File verification failed",
      },
      { status: 500 },
    );
  }
}
