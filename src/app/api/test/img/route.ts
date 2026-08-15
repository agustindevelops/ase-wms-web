import { NextResponse } from "next/server";
import {
  isAuthFailure,
  requirePrismaUser,
} from "@/lib/auth/requireAuth";
import {
  FileServiceError,
  getOwnedFile,
} from "@/lib/storage/fileService";
import { getReadUrl } from "@/lib/storage/s3";

export const runtime = "nodejs";

/**
 * Temp/dev read helper: owner-scoped File lookup + short-lived signed GET URL.
 * Query: ?file_id=<id>
 */
export async function GET(request: Request) {
  const auth = await requirePrismaUser(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  const fileId = new URL(request.url).searchParams.get("file_id");
  if (!fileId) {
    return NextResponse.json(
      { error: "Bad Request", message: "file_id query param is required" },
      { status: 400 },
    );
  }

  try {
    const file = await getOwnedFile({
      userId: auth.user.id,
      organizationId: auth.organizationId,
      fileId,
    });

    if (file.status !== "uploaded") {
      return NextResponse.json(
        {
          error: "FILE_NOT_READY",
          message: `File status is '${file.status}'. Verify upload first.`,
        },
        { status: 409 },
      );
    }

    const readUrl = file.publicUrl ?? (await getReadUrl(file.s3Key));

    return NextResponse.json({
      file: {
        id: file.id,
        itemId: file.itemId,
        uploadedByUserId: file.uploadedByUserId,
        s3Key: file.s3Key,
        contentType: file.contentType,
        byteSize: file.byteSize,
        status: file.status,
        signatureExpiration: file.signatureExpiration,
        publicUrl: file.publicUrl,
        sortOrder: file.sortOrder,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      },
      read_url: readUrl,
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
        error: "FILE_READ_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to resolve image",
      },
      { status: 500 },
    );
  }
}
