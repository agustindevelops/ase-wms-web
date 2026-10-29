"use client";

import LoadingOverlay from "@/components/LoadingOverlay";
import { getFirebaseAuth, isFirebaseConfigured } from "@/firebase/config";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";

export type AuthContextValue = {
  user: User | null;
  /** Organization id from the verified ID token custom claim. */
  organizationId: string | null;
  /** Role codes from the verified ID token custom claims. */
  roles: string[];
  hasRole: (role: string) => boolean;
};

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  organizationId: null,
  roles: [],
  hasRole: () => false,
});

export const useAuthContext = () => useContext(AuthContext);

interface AuthContextProviderProps {
  children: ReactNode;
}

function organizationIdFromClaims(
  claims: Record<string, unknown>,
): string | null {
  const raw = claims.organizationId;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function rolesFromClaims(claims: Record<string, unknown>): string[] {
  const raw = claims.roles;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (role): role is string => typeof role === "string" && Boolean(role.trim()),
  );
}

export function AuthContextProvider({ children }: AuthContextProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (nextUser) => {
      void (async () => {
        if (!nextUser) {
          setUser(null);
          setOrganizationId(null);
          setRoles([]);
          setLoading(false);
          return;
        }

        try {
          let tokenResult = await nextUser.getIdTokenResult();
          let nextRoles = rolesFromClaims(
            tokenResult.claims as Record<string, unknown>,
          );

          // Existing sessions predate the roles claim. Bootstrap it once; new
          // logins already receive roles in their custom token.
          if (nextRoles.length === 0) {
            const response = await fetch("/api/me", {
              headers: {
                Authorization: `Bearer ${await nextUser.getIdToken()}`,
              },
            });
            if (response.ok) {
              const session = (await response.json()) as {
                role?: { code?: string };
                tokenRefreshRequired?: boolean;
              };
              if (session.tokenRefreshRequired) {
                tokenResult = await nextUser.getIdTokenResult(true);
              }
              nextRoles = rolesFromClaims(
                tokenResult.claims as Record<string, unknown>,
              );
              if (nextRoles.length === 0 && session.role?.code) {
                nextRoles = [session.role.code];
              }
            }
          }

          setOrganizationId(
            organizationIdFromClaims(
              tokenResult.claims as Record<string, unknown>,
            ),
          );
          setRoles(nextRoles);
        } catch {
          setOrganizationId(null);
          setRoles([]);
        } finally {
          setUser((prev) => (prev?.uid === nextUser.uid ? prev : nextUser));
          setLoading(false);
        }
      })();
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo(
    () => ({
      user,
      organizationId,
      roles,
      hasRole: (role: string) => roles.includes(role),
    }),
    [user, organizationId, roles],
  );

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
