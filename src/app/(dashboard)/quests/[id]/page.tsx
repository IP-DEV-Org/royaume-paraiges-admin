"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { questKeys } from "@/lib/queries/keys";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { QuestConflictDialog } from "@/components/quest-conflict-dialog";
import {
  getQuest,
  updateQuest,
  deleteQuest,
  setQuestPeriods,
  getQuestEstablishments,
  setQuestEstablishments,
} from "@/lib/services/questService";
import {
  parseQuestRedundancyError,
  type QuestRedundancyDetails,
} from "@/lib/supabase/errorParser";
import type {
  QuestUpdate,
  PeriodType,
  ConsumptionType,
} from "@/types/database";
import {
  QuestForm,
  type QuestFormInput,
  type QuestFormPayload,
} from "../_form/QuestForm";

export default function EditQuestPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const id = Number(params.id);

  const [initial, setInitial] = useState<QuestFormInput | null>(null);
  const [questName, setQuestName] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [conflictDetails, setConflictDetails] =
    useState<QuestRedundancyDetails | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [quest, establishments] = await Promise.all([
          getQuest(id),
          getQuestEstablishments(id),
        ]);

        if (!quest) {
          toast.error("Erreur", {
            description: "Impossible de charger la quête",
          });
          router.push("/quests");
          return;
        }

        // amount_spent (déprécié) : convertir centimes → euros pour l'affichage
        // Sinon afficher la valeur brute (PdB / unités).
        const targetValueDisplay =
          quest.quest_type === "amount_spent"
            ? (quest.target_value / 100).toString()
            : quest.target_value.toString();

        const periods =
          quest.quest_periods?.map((p) => p.period_identifier) || [];

        setQuestName(quest.name);
        setInitial({
          name: quest.name,
          description: quest.description || "",
          lore: quest.lore || "",
          slug: quest.slug,
          questType: quest.quest_type,
          consumptionType:
            (quest.consumption_type as ConsumptionType | null) || "",
          targetValue: targetValueDisplay,
          periodType: quest.period_type as PeriodType,
          couponTemplateId: quest.coupon_template_id?.toString() || "none",
          bonusXp: quest.bonus_xp.toString(),
          bonusCashback: (quest.bonus_cashback / 100).toString(),
          displayOrder: quest.display_order.toString(),
          isActive: quest.is_active,
          periods,
          establishments,
        });
      } catch (err) {
        console.error(err);
        toast.error("Erreur", {
          description: "Impossible de charger la quête",
        });
        router.push("/quests");
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [id, router]);

  const handleSubmit = async (payload: QuestFormPayload) => {
    const quest: QuestUpdate = {
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
    };

    try {
      await updateQuest(id, quest);
      await setQuestPeriods(id, payload.periods);
      await setQuestEstablishments(id, payload.establishments);

      queryClient.invalidateQueries({ queryKey: questKeys.all });
      toast.success("Quête modifiée avec succès");
      router.push("/quests");
    } catch (err) {
      const conflict = parseQuestRedundancyError(err);
      if (conflict) {
        setConflictDetails(conflict);
      } else {
        console.error(err);
        toast.error("Erreur", {
          description:
            err instanceof Error ? err.message : "Impossible de modifier la quête",
        });
      }
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteQuest(id);
      queryClient.invalidateQueries({ queryKey: questKeys.all });
      toast.success("Quête supprimée");
      router.push("/quests");
    } catch (err) {
      console.error(err);
      toast.error("Erreur", {
        description: "Impossible de supprimer la quête",
      });
      setDeleting(false);
    }
  };

  if (loadingData || !initial) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/quests">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Modifier la quête</h1>
            <p className="text-muted-foreground">{questName}</p>
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={deleting}>
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Supprimer
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cette quête ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Toutes les progressions et
                complétions associées seront également supprimées.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <QuestForm
        mode="edit"
        initial={initial}
        submitLabel="Enregistrer"
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
