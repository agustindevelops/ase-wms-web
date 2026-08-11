import "server-only";

import {
  App,
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { Auth, getAuth } from "firebase-admin/auth";

let app: App | undefined;

function requireAdminEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.template to .env.local and add Firebase Admin credentials.`,
    );
  }
  return value;
}

/**
 * Firebase Admin app for verifying ID tokens from ase-wms-web and ase-wms-app.
 * Server-only — never expose FIREBASE_ADMIN_* to the client.
 *
 * Prefer either:
 * - GOOGLE_APPLICATION_CREDENTIALS=./secrets/firebase-admin.json
 * - or FIREBASE_ADMIN_PROJECT_ID + CLIENT_EMAIL + PRIVATE_KEY
 */
export function getFirebaseAdminApp(): App {
  if (app) {
    return app;
  }

  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    app = initializeApp({
      credential: applicationDefault(),
      projectId:
        process.env.FIREBASE_ADMIN_PROJECT_ID ??
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
    return app;
  }

  const privateKey = requireAdminEnv("FIREBASE_ADMIN_PRIVATE_KEY").replace(
    /\\n/g,
    "\n",
  );

  app = initializeApp({
    credential: cert({
      projectId: requireAdminEnv("FIREBASE_ADMIN_PROJECT_ID"),
      clientEmail: requireAdminEnv("FIREBASE_ADMIN_CLIENT_EMAIL"),
      privateKey,
    }),
  });

  return app;
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}
