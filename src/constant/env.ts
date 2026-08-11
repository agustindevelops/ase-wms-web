export const isProd = process.env.NODE_ENV === "production";
export const isLocal = process.env.NODE_ENV === "development";

export const showLogger =
  isLocal || process.env.NEXT_PUBLIC_SHOW_LOGGER === "true";

/** Shared Firebase project id (web + ase-wms-app). */
export const firebaseProjectId =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";

/** Server-side WMS API base URL. */
export const aseWmsApiUrl = process.env.ASE_WMS_API_URL ?? "";

/** Browser-side WMS API base URL. */
export const publicAseWmsApiUrl =
  process.env.NEXT_PUBLIC_ASE_WMS_API_URL ?? "";

export const marketingSiteUrl =
  process.env.NEXT_PUBLIC_MARKETING_SITE_URL ??
  "https://aniahsocialevents.com";
