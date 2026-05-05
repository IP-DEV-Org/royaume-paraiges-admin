"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { QuestRedundancyDetails } from "@/lib/supabase/errorParser";

interface QuestConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: QuestRedundancyDetails | null;
}

const KIND_LABEL: Record<QuestRedundancyDetails["conflict_kind"], string> = {
  both_global: "les deux quêtes sont globales (applicables à tous les établissements)",
  global_vs_local: "l'une est globale, l'autre locale — la globale couvre déjà l'établissement de la locale",
  locals_overlap: "les deux quêtes sont locales et partagent au moins un établissement",
};

export function QuestConflictDialog({ open, onOpenChange, details }: QuestConflictDialogProps) {
  if (!details) return null;

  const signature = details.signature
    ? [
        details.signature.quest_type,
        details.signature.period_type,
        details.signature.consumption_type ?? "—",
      ].join(" / ")
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DialogTitle>Conflit de signature détecté</DialogTitle>
              <DialogDescription className="mt-1">
                Cette opération créerait une redondance entre deux quêtes actives.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">Quête en conflit</p>
            <p className="mt-1 text-muted-foreground">
              <span className="font-mono">#{details.conflict_quest_id}</span>{" "}
              <span className="font-semibold">{details.conflict_quest_name}</span>
            </p>
          </div>

          {signature && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Signature partagée&nbsp;:</span>
              <Badge variant="outline" className="font-mono">
                {signature}
              </Badge>
            </div>
          )}

          <div className="text-sm">
            <p className="font-medium">Raison du conflit</p>
            <p className="mt-1 text-muted-foreground">{KIND_LABEL[details.conflict_kind]}.</p>
          </div>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900/40 dark:bg-blue-950/30">
            <p className="font-medium">Comment résoudre</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Désactivez la quête en conflit, puis réessayez.</li>
              <li>
                Ou modifiez la signature (type, période, consommation) de la quête que vous
                éditez pour qu’elle diffère.
              </li>
              <li>
                Ou scopez les deux quêtes sur des établissements <em>disjoints</em> (pas de
                chevauchement).
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button asChild>
            <Link href={`/quests/${details.conflict_quest_id}`} onClick={() => onOpenChange(false)}>
              Éditer la quête en conflit
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
