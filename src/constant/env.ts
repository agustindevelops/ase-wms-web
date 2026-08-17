export const isProd = process.env.NODE_ENV === "production";
export const isLocal = process.env.NODE_ENV === "development";

export const showLogger =
  isLocal || process.env.NEXT_PUBLIC_SHOW_LOGGER === "true";

/** Shared Firebase project id (web + ase-wms-app). */
export const firebaseProjectId =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";

export const marketingSiteUrl =
  process.env.NEXT_PUBLIC_MARKETING_SITE_URL ??
  "https://aniahsocialevents.com";

/**
 * Public self-serve signup is off for MVP (pre-provisioned Admin accounts only).
 * Flip to true when employees need Create Account (Staff flow).
 */
export const allowPublicSignup = false;
