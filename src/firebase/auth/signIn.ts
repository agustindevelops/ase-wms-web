import { getFirebaseAuth } from "../config";
import { signInWithCustomToken } from "firebase/auth";

export default async function signIn(email: string, password: string) {
  let result = null;
  let error: unknown = null;

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const payload = (await response.json()) as {
      customToken?: string;
      message?: string;
    };

    if (!response.ok || !payload.customToken) {
      throw new Error(payload.message ?? "Could not sign in.");
    }

    result = await signInWithCustomToken(
      getFirebaseAuth(),
      payload.customToken,
    );
  } catch (e) {
    error = e;
  }

  return { result, error };
}
