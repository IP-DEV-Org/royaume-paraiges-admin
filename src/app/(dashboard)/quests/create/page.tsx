"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { QuestConflictDialog } from "@/components/quest-conflict-dialog";
import {
  createQuest,
  setQuestPeriods,
  setQuestEstablishments,
  setQuestIterations,
  deleteQuest,
} from "@/lib/services/questService";
import {
  parseQuestRedundancyError,
  type QuestRedundancyDetails,
} from "@/lib/supabase/errorParser";
import { questKeys } from "@/lib/queries/keys";
import type { QuestInsert } from "@/types/database";
import { QuestForm, type QuestFormPayload } from "../_form/QuestForm";

export default function CreateQuestPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [conflictDetails, setConflictDetails] =
    useState<QuestRedundancyDetails | null>(null);

  const handleSubmit = async (payload: QuestFormPayload) => {
    const quest: QuestInsert = {
      name: payload.name,
      description: payload.description,
      lore: payload.lore,
      slug: payload.slug,
      quest_type: payload.quest_type,
      consumption_type: payload.consumption_type,
      target_value: payload.target_value,
      period_type: payload.period_type,
      coupon_template_id: payload.coupon_template_id,
      bonus_xp: payload.bonus_xp,
      bonus_cashback: payload.bonus_cashback,
      display_order: payload.display_order,
      is_active: payload.is_active,
      is_repeatable: payload.is_repeatable,
    };

    let createdQuestId: number | null = null;
    try {
      const createdQuest = await createQuest(quest);
      createdQuestId = createdQuest.id;

      if (payload.periods.length > 0) {
        await setQuestPeriods(createdQuest.id, payload.periods);
      }
      if (payload.establishments.length > 0) {
        await setQuestEstablishments(
          createdQuest.id,
          payload.establishments,
        );
      }
      if (payload.iterations.length > 0) {
        await setQuestIterations(createdQuest.id, payload.iterations);
      }

      queryClient.invalidateQueries({ queryKey: questKeys.all });
      toast.success("Quête créée avec succès");
      router.push("/quests");
    } catch (err) {
      // Cleanup quête orpheline si l'attache de scope a échoué
      if (createdQuestId !== null) {
        try {
          await deleteQuest(createdQuestId);
        } catch {
          // Non bloquant — l'admin pourra nettoyer manuellement.
        }
      }

      const conflict = parseQuestRedundancyError(err);
      if (conflict) {
        setConflictDetails(conflict);
      } else {
        console.error(err);
        toast.error("Erreur", {
          description:
            err instanceof Error ? err.message : "Impossible de créer la quête",
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/quests">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Nouvelle quête</h1>
          <p className="text-muted-foreground">
            Créez un nouveau défi périodique
          </p>
        </div>
      </div>

      <QuestForm
        mode="create"
        submitLabel="Créer la quête"
        cancelHref="/quests"
        onSubmit={handleSubmit}
      />

      <QuestConflictDialog
        open={conflictDetails !== null}
        onOpenChange={(open) => {
          if (!open) setConflictDetails(null);
        }}
        details={conflictDetails}
      />
    </div>
  );
}
