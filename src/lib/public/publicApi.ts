import "server-only";

import { NextResponse } from "next/server";
import { ANIAH_ORGANIZATION } from "@/lib/db/defaults";
import { prisma } from "@/lib/db/prisma";

/** Single-tenant public API: which organization the customer site reads and writes. */
export async function getPublicOrganizationId(): Promise<string | null> {
  const slug =
    process.env.PUBLIC_ORGANIZATION_SLUG?.trim() || ANIAH_ORGANIZATION.slug;
  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true },
  });
  return organization?.id ?? null;
}

function allowedOrigins(): string[] {
  const raw =
    process.env.PUBLIC_API_ALLOWED_ORIGINS ??
    process.env.NEXT_PUBLIC_MARKETING_SITE_URL ??
    "";
  return raw
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function corsHeaders(request: Request, methods: string): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins().includes(origin)) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": `${methods}, OPTIONS`,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export function withCors(
  request: Request,
  response: NextResponse,
  methods: string,
): NextResponse {
  for (const [key, value] of Object.entries(corsHeaders(request, methods))) {
    response.headers.set(key, value);
  }
  return response;
}

export function corsPreflight(request: Request, methods: string): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request, methods),
  });
}

export function publicOrganizationMissing(): NextResponse {
  return NextResponse.json(
    {
      error: "ORGANIZATION_NOT_CONFIGURED",
      message: "Public organization is not configured",
    },
    { status: 503 },
  );
}
