import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { getFirebaseAuth } from "@/firebase/config";

function passwordErrorMessage(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";

  if (
    code === "auth/invalid-credential" ||
    code === "auth/wrong-password" ||
    code === "auth/invalid-login-credentials"
  ) {
    return "Current password is incorrect.";
  }
  if (code === "auth/weak-password") {
    return "Choose a stronger password.";
  }
  if (code === "auth/too-many-requests") {
    return "Too many attempts. Try again later.";
  }
  if (code === "auth/requires-recent-login") {
    return "Sign in again, then update your password.";
  }

  return error instanceof Error ? error.message : "Could not update password.";
}

/**
 * Firebase confirms the current password for the signed-in user, then replaces it.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  const email = user?.email;
  if (!user || !email) {
    throw new Error("Not signed in.");
  }

  try {
    const credential = EmailAuthProvider.credential(email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  } catch (error) {
    throw new Error(passwordErrorMessage(error));
  }
}
