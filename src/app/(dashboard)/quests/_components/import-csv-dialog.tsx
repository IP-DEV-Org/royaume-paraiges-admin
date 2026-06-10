"use client";

import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { QuestCsvRow } from "@/lib/services/questService";
import type { PeriodType, QuestType } from "@/types/database";
import { periodTypeLabels, questTypeLabels } from "./quest-display";

interface ImportCsvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: QuestCsvRow[];
  errors: string[];
  importing: boolean;
  onConfirm: () => void;
}

export function ImportCsvDialog({
  open,
  onOpenChange,
  preview,
  errors,
  importing,
  onConfirm,
}: ImportCsvDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer des quêtes</DialogTitle>
          <DialogDescription>
            Vérifiez les quêtes avant de confirmer l&apos;import.
          </DialogDescription>
        </DialogHeader>

        {errors.length > 0 && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertCircle className="h-4 w-4" />
              {errors.length} erreur(s) de validation
            </div>
            <ul className="text-sm text-destructive space-y-0.5">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {preview.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              {preview.length} quête(s) prêtes à être importées
            </div>

            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Objectif</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Bonus XP</TableHead>
                    <TableHead>Bonus CB</TableHead>
                    <TableHead>Périodes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {questTypeLabels[row.quest_type as QuestType] ||
                            row.quest_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.quest_type === "amount_spent"
                          ? `${row.target_value} €`
                          : row.quest_type === "cashback_earned"
                          ? `${row.target_value} PdB`
                          : row.target_value}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {periodTypeLabels[row.period_type as PeriodType] ||
                            row.period_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.bonus_xp !== "0" ? `+${row.bonus_xp}` : "-"}
                      </TableCell>
                      <TableCell>
                        {row.bonus_cashback !== "0"
                          ? `+${row.bonus_cashback} €`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {row.periods ? (
                          <div className="flex flex-wrap gap-1">
                            {row.periods.split(";").slice(0, 2).map((p) => (
                              <Badge
                                key={p}
                                variant="outline"
                                className="text-xs"
                              >
                                {p.trim()}
                              </Badge>
                            ))}
                            {row.periods.split(";").length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{row.periods.split(";").length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            Toutes
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {preview.length === 0 && errors.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune donnée valide trouvée dans le fichier CSV.
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importing}
          >
            Annuler
          </Button>
          <Button
            onClick={onConfirm}
            disabled={importing || preview.length === 0}
          >
            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Importer {preview.length} quête(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
