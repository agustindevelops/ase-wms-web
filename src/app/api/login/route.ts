import { NextResponse } from "next/server";
import {
  FirebasePasswordError,
  signInWithEmailPassword,
} from "@/lib/auth/firebasePassword";
import {
  getProvisionedSession,
  SessionLookupError,
  toSessionJson,
} from "@/lib/auth/sessionService";
import { issueWmsCustomToken } from "@/lib/auth/wmsClaims";

export const runtime = "nodejs";

/**
 * POST /api/login
 * Verify email/password, stamp warehouse memberships on the Firebase user,
 * and return a custom token whose ID token already includes `wms` claims.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const email =
    body &&
    typeof body === "object" &&
    "email" in body &&
    typeof body.email === "string"
      ? body.email.trim()
      : "";
  const password =
    body &&
    typeof body === "object" &&
    "password" in body &&
    typeof body.password === "string"
      ? body.password
      : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Bad Request", message: "email and password are required" },
      { status: 400 },
    );
  }

  try {
    const firebaseUser = await signInWithEmailPassword(email, password);
    const session = await getProvisionedSession(firebaseUser.localId);
    const customToken = await issueWmsCustomToken(
      firebaseUser.localId,
      session.claims,
    );

    return NextResponse.json({
      customToken,
      ...toSessionJson(session),
    });
  } catch (error) {
    if (
      error instanceof FirebasePasswordError ||
      error instanceof SessionLookupError
    ) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }

    const message =
      error instanceof Error ? error.message : "Login failed";
    const isConfig = message.includes("FIREBASE") || message.includes("not set");
    return NextResponse.json(
      {
        error: isConfig ? "LOGIN_CONFIGURATION_ERROR" : "LOGIN_ERROR",
        message,
      },
      { status: isConfig ? 503 : 500 },
    );
  }
}
