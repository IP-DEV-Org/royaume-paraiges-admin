"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Quelque chose s&apos;est mal passé. Réessayez, et si le problème
          persiste, contactez le support.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground">Référence : {error.digest}</p>
        )}
      </div>
      <Button onClick={reset}>Réessayer</Button>
    </div>
  );
}
