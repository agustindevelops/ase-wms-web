import "server-only";

type FirebasePasswordSignIn = {
  localId: string;
  email: string;
};

function firebaseApiKey(): string {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key) {
    throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY is not set.");
  }
  return key;
}

export class FirebasePasswordError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "FirebasePasswordError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Verify email/password with Firebase Identity Toolkit (same project as the
 * client apps). Does not create a browser session — callers mint a custom token.
 */
export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<FirebasePasswordSignIn> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    },
  );

  const payload = (await response.json()) as {
    localId?: string;
    email?: string;
    error?: { message?: string };
  };

  if (!response.ok || !payload.localId || !payload.email) {
    const googleCode = payload.error?.message ?? "INVALID_LOGIN_CREDENTIALS";
    if (googleCode === "USER_DISABLED") {
      throw new FirebasePasswordError(
        "USER_DISABLED",
        "This account is disabled",
        403,
      );
    }
    if (googleCode === "TOO_MANY_ATTEMPTS_TRY_LATER") {
      throw new FirebasePasswordError(
        "TOO_MANY_ATTEMPTS",
        "Too many attempts. Try again later.",
        429,
      );
    }
    throw new FirebasePasswordError(
      "INVALID_CREDENTIALS",
      "Invalid email or password",
      401,
    );
  }

  return { localId: payload.localId, email: payload.email };
}
