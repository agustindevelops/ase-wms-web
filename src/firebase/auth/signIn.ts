import { getFirebaseAuth } from "../config";
import { signInWithEmailAndPassword } from "firebase/auth";

export default async function signIn(email: string, password: string) {
  let result = null;
  let error = null;

  try {
    result = await signInWithEmailAndPassword(
      getFirebaseAuth(),
      email,
      password,
    );
  } catch (e) {
    error = e;
  }

  return { result, error };
}
