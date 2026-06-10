import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

// État vide standard : icône + titre + description + CTA optionnel.
// À utiliser dans les tables (dans une cellule pleine largeur) comme dans les cards.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-10 text-center",
        className
      )}
    >
      {Icon && <Icon className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />}
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {description && (
        <p className="max-w-sm text-xs text-muted-foreground/80">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
