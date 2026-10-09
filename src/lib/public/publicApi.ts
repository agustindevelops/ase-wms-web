import "server-only";

import { NextResponse } from "next/server";
import { ANIAH_ORGANIZATION } from "@/lib/db/defaults";
import { prisma } from "@/lib/db/prisma";

/** Stripe webhook only: organization that receives payment updates. */
export async function getPublicOrganizationId(): Promise<string | null> {
  const slug =
    process.env.PUBLIC_ORGANIZATION_SLUG?.trim() || ANIAH_ORGANIZATION.slug;
  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true },
  });
  return organization?.id ?? null;
}

/** Public customer routes: caller must pass an existing organization id. */
export async function findPublicOrganizationId(
  organizationId: string,
): Promise<string | null> {
  const id = organizationId.trim();
  if (!id) return null;
  const organization = await prisma.organization.findUnique({
    where: { id },
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

/** Customer site to return to after Checkout: the calling origin when allowed. */
export function marketingSiteOrigin(request: Request): string | null {
  const origin = request.headers.get("origin")?.replace(/\/+$/, "");
  const allowed = allowedOrigins();
  if (origin && allowed.includes(origin)) {
    return origin;
  }
  return allowed[0] ?? null;
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

export function publicOrganizationNotFound(): NextResponse {
  return NextResponse.json(
    { error: "Not Found", message: "Organization not found" },
    { status: 404 },
  );
}

export function marketingSiteNotConfigured(): NextResponse {
  return NextResponse.json(
    {
      error: "SITE_NOT_CONFIGURED",
      message: "Customer site URL is not configured",
    },
    { status: 503 },
  );
}
