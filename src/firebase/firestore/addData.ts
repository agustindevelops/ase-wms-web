import { getFirebaseFirestore } from "../config";
import { doc, setDoc } from "firebase/firestore";

export default async function addData(
  collection: string,
  id: string,
  data: Record<string, unknown>,
) {
  let result = null;
  let error = null;

  try {
    result = await setDoc(doc(getFirebaseFirestore(), collection, id), data, {
      merge: true,
    });
  } catch (e) {
    error = e;
  }

  return { result, error };
}
