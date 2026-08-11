import { publicAseWmsApiUrl } from "@/constant/env";

type FetchOptions = RequestInit & {
  /** Firebase ID token from the signed-in user (preferred over static API keys). */
  idToken?: string | null;
};

/**
 * Call the shared WMS API. Pass a Firebase ID token so ase-wms-app and this
 * admin can authorize with the same Auth users — no separate cross-app token.
 */
export async function aseApiFetch(
  path: string,
  { idToken, headers, ...init }: FetchOptions = {},
) {
  if (!publicAseWmsApiUrl) {
    throw new Error(
      "NEXT_PUBLIC_ASE_WMS_API_URL is not set. Add it to .env.local.",
    );
  }

  const url = `${publicAseWmsApiUrl.replace(/\/$/, "")}/${path.replace(
    /^\//,
    "",
  )}`;

  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      ...headers,
    },
  });
}
