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
  /** First warehouse on the ID token `wms` claim. Stamped at login. */
  warehouseId: string | null;
};

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  warehouseId: null,
});

export const useAuthContext = () => useContext(AuthContext);

interface AuthContextProviderProps {
  children: ReactNode;
}

function warehouseIdFromClaims(claims: Record<string, unknown>): string | null {
  const raw = claims.wms;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const id = Object.keys(raw as Record<string, string>)[0];
  return id || null;
}

export function AuthContextProvider({ children }: AuthContextProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
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
          setWarehouseId(null);
          setLoading(false);
          return;
        }

        try {
          const { claims } = await nextUser.getIdTokenResult();
          setWarehouseId(
            warehouseIdFromClaims(claims as Record<string, unknown>),
          );
        } catch {
          setWarehouseId(null);
        } finally {
          setUser((prev) => (prev?.uid === nextUser.uid ? prev : nextUser));
          setLoading(false);
        }
      })();
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo(
    () => ({ user, warehouseId }),
    [user, warehouseId],
  );

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
