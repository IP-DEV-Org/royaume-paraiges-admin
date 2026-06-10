import Link from "next/link";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Trophy className="h-6 w-6" />
        <span className="font-semibold">Royaume Admin</span>
      </div>
      <div className="space-y-2">
        <p className="text-7xl font-bold tracking-tight">404</p>
        <h1 className="text-xl font-semibold">Page introuvable</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Cette page n&apos;existe pas ou a été déplacée. Vérifiez l&apos;adresse
          ou retournez au dashboard.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Retour au dashboard</Link>
      </Button>
    </div>
  );
}
