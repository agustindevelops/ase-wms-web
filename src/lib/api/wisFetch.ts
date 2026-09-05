import { getFirebaseAuth } from "@/firebase/config";

/**
 * Same-origin `/api/*` calls. The Firebase SDK attaches a Bearer token;
 * `getIdToken()` returns the cached JWT and refreshes it when it expires.
 */
export async function wisFetch(path: string, init: RequestInit = {}) {
  const url = path.startsWith("/") ? path : `/${path}`;
  const { headers, ...rest } = init;

  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new Error("Not signed in.");
  }

  const send = async (forceRefresh = false) => {
    const idToken = await user.getIdToken(forceRefresh);
    return fetch(url, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
        ...headers,
      },
    });
  };

  const response = await send();
  if (response.status !== 401) {
    return response;
  }

  return send(true);
}

export async function wisJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await wisFetch(path, init);
  const json = (await response.json()) as T & { message?: string };
  if (!response.ok) {
    throw new Error(json.message ?? `Request failed (${response.status})`);
  }
  return json;
}
