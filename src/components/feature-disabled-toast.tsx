"use client";

// Affiche le toast « accès désactivé » après une redirection du middleware
// (?error=feature_disabled, même pattern que /login?error=unauthorized),
// puis nettoie l'URL. Monté une fois dans DashboardShell.

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function FeatureDisabledToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const fired = useRef(false);

  const hasError = searchParams.get("error") === "feature_disabled";

  useEffect(() => {
    if (!hasError || fired.current) return;
    fired.current = true;
    toast.error("L'accès à cette page a été désactivé par l'administrateur.");
    router.replace(pathname);
  }, [hasError, pathname, router]);

  return null;
}
