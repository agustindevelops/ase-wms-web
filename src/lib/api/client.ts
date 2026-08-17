type FetchOptions = RequestInit & {
  /** Firebase ID token from the signed-in user (preferred over static API keys). */
  idToken?: string | null;
};

/**
 * Call this app's same-origin `/api/*` routes. Pass a Firebase ID token so
 * ase-wms-app and this admin can authorize with the same Auth users.
 */
export async function aseApiFetch(
  path: string,
  { idToken, headers, ...init }: FetchOptions = {},
) {
  const url = path.startsWith("/") ? path : `/${path}`;

  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      ...headers,
    },
  });
}
