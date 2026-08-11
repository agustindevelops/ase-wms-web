import { getFirebaseAuth } from "../config";
import { createUserWithEmailAndPassword } from "firebase/auth";

export default async function signUp(email: string, password: string) {
  let result = null;
  let error = null;

  try {
    result = await createUserWithEmailAndPassword(
      getFirebaseAuth(),
      email,
      password,
    );
  } catch (e) {
    error = e;
  }

  return { result, error };
}
