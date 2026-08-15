import { NextResponse } from "next/server";
import {
  isAuthFailure,
  requirePrismaUser,
} from "@/lib/auth/requireAuth";
import {
  deleteOwnedFile,
  FileServiceError,
} from "@/lib/storage/fileService";

export const runtime = "nodejs";

/** Owner-scoped delete: remove object from storage, then File row. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePrismaUser(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json(
      { error: "Bad Request", message: "file id is required" },
      { status: 400 },
    );
  }

  try {
    const deleted = await deleteOwnedFile({
      userId: auth.user.id,
      organizationId: auth.organizationId,
      fileId: id,
    });

    return NextResponse.json({
      file_id: deleted.id,
      deleted: true,
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
        error: "FILE_DELETE_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to delete file",
      },
      { status: 500 },
    );
  }
}
