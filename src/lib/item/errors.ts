import { NextResponse } from "next/server";

export class CatalogServiceError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "CatalogServiceError";
    this.code = code;
    this.status = status;
  }
}

export function toCatalogErrorResponse(error: unknown): NextResponse {
  if (error instanceof CatalogServiceError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  console.error("[catalog]", error);
  return NextResponse.json(
    {
      error: "CATALOG_ERROR",
      message:
        error instanceof Error ? error.message : "Catalog request failed",
    },
    { status: 500 },
  );
}

export async function readJsonObject(
  request: Request,
): Promise<
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; response: NextResponse }
> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Bad Request", message: "Invalid JSON body" },
        { status: 400 },
      ),
    };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Bad Request", message: "JSON object body required" },
        { status: 400 },
      ),
    };
  }

  return { ok: true, value: body as Record<string, unknown> };
}
