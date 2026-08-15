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
};

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  organizationId: null,
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

export function AuthContextProvider({ children }: AuthContextProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
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
          setLoading(false);
          return;
        }

        try {
          const { claims } = await nextUser.getIdTokenResult();
          setOrganizationId(
            organizationIdFromClaims(claims as Record<string, unknown>),
          );
        } catch {
          setOrganizationId(null);
        } finally {
          setUser((prev) => (prev?.uid === nextUser.uid ? prev : nextUser));
          setLoading(false);
        }
      })();
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo(
    () => ({ user, organizationId }),
    [user, organizationId],
  );

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
