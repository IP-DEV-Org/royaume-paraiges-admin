"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Impossible de charger cette page</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Une erreur est survenue pendant le chargement. Réessayez, ou retournez
          au dashboard.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground">Référence : {error.digest}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>Réessayer</Button>
        <Button variant="outline" asChild>
          <Link href="/">Retour au dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
