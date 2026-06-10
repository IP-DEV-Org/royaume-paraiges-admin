"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { segmentLabels } from "@/lib/navigation";

function labelForSegment(segment: string): string {
  if (segmentLabels[segment]) return segmentLabels[segment];
  // Identifiants de période lisibles (2026-W23, 2026-06, 2026)
  if (/^\d{4}(-W?\d{2})?$/.test(segment)) return segment;
  // Segment dynamique (UUID, id numérique…) → libellé générique
  return "Détail";
}

// Fil d'Ariane auto-généré depuis l'URL : Dashboard > Utilisateurs > Détail.
// Affiché dans le header desktop ; masqué sur la racine.
export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return <span className="text-sm font-medium">Dashboard</span>;
  }

  const crumbs = segments.map((segment, index) => ({
    label: labelForSegment(segment),
    href: "/" + segments.slice(0, index + 1).join("/"),
    isLast: index === segments.length - 1,
  }));

  return (
    <nav aria-label="Fil d'Ariane" className="flex min-w-0 items-center gap-1.5 text-sm">
      <Link
        href="/"
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
      >
        Dashboard
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex min-w-0 items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
          {crumb.isLast ? (
            <span className="truncate font-medium" aria-current="page">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="truncate text-muted-foreground transition-colors hover:text-foreground"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
