"use client";

// Contexte de l'admin connecté : profil, statut super admin et fonctionnalités
// désactivées (migration 057). Consommé par la Sidebar, la palette Cmd+K, le
// Header et la page /settings/access. Pendant le chargement, aucune feature
// n'est considérée désactivée (pas de flash de masquage) — le blocage dur
// reste porté par le middleware.

import { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCurrentAdminAccess } from "@/lib/services/adminAccessService";
import { adminAccessKeys } from "@/lib/queries/keys";
import type { FeatureKey } from "@/lib/features";
import type { Profile } from "@/types/database";

interface CurrentAdminContextValue {
  profile: Profile | null;
  isSuperAdmin: boolean;
  disabledFeatures: Set<FeatureKey>;
  isFeatureEnabled: (key: FeatureKey) => boolean;
  isLoading: boolean;
}

const CurrentAdminContext = createContext<CurrentAdminContextValue | null>(null);

export function CurrentAdminProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: adminAccessKeys.current(),
    queryFn: getCurrentAdminAccess,
    staleTime: 60_000,
  });

  const value = useMemo<CurrentAdminContextValue>(() => {
    const disabledFeatures = new Set<FeatureKey>(data?.disabledFeatures ?? []);
    return {
      profile: data?.profile ?? null,
      isSuperAdmin: data?.isSuperAdmin ?? false,
      disabledFeatures,
      isFeatureEnabled: (key) => !disabledFeatures.has(key),
      isLoading,
    };
  }, [data, isLoading]);

  return (
    <CurrentAdminContext.Provider value={value}>
      {children}
    </CurrentAdminContext.Provider>
  );
}

export function useCurrentAdmin(): CurrentAdminContextValue {
  const context = useContext(CurrentAdminContext);
  if (!context) {
    throw new Error("useCurrentAdmin doit être utilisé sous CurrentAdminProvider");
  }
  return context;
}
