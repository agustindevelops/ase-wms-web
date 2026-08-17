import "server-only";

import {
  App,
  cert,
  getApps,
  initializeApp,
  type ServiceAccount,
} from "firebase-admin/app";
import { Auth, getAuth } from "firebase-admin/auth";

let app: App | undefined;

/**
 * Server-only Firebase Admin app. Reads the service-account JSON from env and
 * passes it to cert(). Never prefix FIREBASE_ADMIN_* with NEXT_PUBLIC_.
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

  const credentialsJson = process.env.FIREBASE_ADMIN_CREDENTIALS_JSON;
  if (!credentialsJson) {
    throw new Error("FIREBASE_ADMIN_CREDENTIALS_JSON is not configured");
  }

  const serviceAccount = JSON.parse(credentialsJson) as ServiceAccount;
  app = initializeApp({
    credential: cert(serviceAccount),
  });
  return app;
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}
