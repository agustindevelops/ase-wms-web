import { getFirebaseFirestore } from "../config";
import { doc, getDoc } from "firebase/firestore";

export default async function getDocument(collection: string, id: string) {
  let result = null;
  let error = null;

  try {
    result = await getDoc(doc(getFirebaseFirestore(), collection, id));
  } catch (e) {
    error = e;
  }

  return { result, error };
}
