import { NextResponse } from "next/server";

export class PackageServiceError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "PackageServiceError";
    this.code = code;
    this.status = status;
  }
}

export function toPackageErrorResponse(error: unknown): NextResponse {
  if (error instanceof PackageServiceError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  console.error("[package]", error);
  return NextResponse.json(
    {
      error: "PACKAGE_ERROR",
      message: error instanceof Error ? error.message : "Package request failed",
    },
    { status: 500 },
  );
}
