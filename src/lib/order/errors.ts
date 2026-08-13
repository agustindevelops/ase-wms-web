import { NextResponse } from "next/server";

export class OrderServiceError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "OrderServiceError";
    this.code = code;
    this.status = status;
  }
}

export function toOrderErrorResponse(error: unknown): NextResponse {
  if (error instanceof OrderServiceError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  console.error("[order]", error);
  return NextResponse.json(
    {
      error: "ORDER_ERROR",
      message: error instanceof Error ? error.message : "Order request failed",
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
