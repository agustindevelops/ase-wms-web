/**
 * Call this app's Next.js API routes with a Firebase ID token.
 * Prefer this over aseApiFetch for same-origin WMS routes under /api/*.
 */
export async function wmsFetch(
  path: string,
  {
    idToken,
    headers,
    ...init
  }: RequestInit & { idToken?: string | null } = {},
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
