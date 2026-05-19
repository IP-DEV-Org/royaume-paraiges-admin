"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { couponKeys } from "@/lib/queries/keys";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createManualCoupon } from "@/lib/services/couponService";
import { CustomerSearchCard } from "@/components/customer-search-card";
import type { Profile } from "@/types/database";

const formSchema = z.object({
  customerId: z.string().uuid("Sélectionnez un utilisateur"),
  customerName: z.string(),
  amount: z.string().refine(
    (v) => {
      const n = parseFloat(v);
      return !isNaN(n) && n > 0;
    },
    { message: "Renseignez un montant > 0." },
  ),
  notes: z.string().max(500).optional(),
});

type FormInput = z.infer<typeof formSchema>;

export default function CreateBonusCashbackPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const form = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: "",
      customerName: "",
      amount: "",
      notes: "",
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  const customerId = watch("customerId");
  const customerName = watch("customerName");

  const selectCustomer = (customer: Profile) => {
    const name =
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
      customer.email ||
      "Inconnu";
    setValue("customerId", customer.id, { shouldValidate: true });
    setValue("customerName", name);
  };

  const clearCustomer = () => {
    setValue("customerId", "", { shouldValidate: true });
    setValue("customerName", "");
  };

  const submit = handleSubmit(async (values) => {
    try {
      await createManualCoupon({
        customerId: values.customerId,
        amount: Math.round(parseFloat(values.amount) * 100),
        notes: values.notes || undefined,
      });

      queryClient.invalidateQueries({ queryKey: couponKeys.all });
      toast.success(`Bonus cashback de ${values.amount} € crédité`);
      router.push("/rewards/cashback-gains");
    } catch (err) {
      console.error(err);
      toast.error("Erreur", {
        description:
          err instanceof Error ? err.message : "Impossible de créer le bonus",
      });
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/rewards/cashback-gains">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Nouveau bonus cashback</h1>
          <p className="text-muted-foreground">
            Créditez des Paraiges de Bronze (PdB) directement au solde d&apos;un
            utilisateur.
          </p>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="grid gap-6 md:grid-cols-2">
          <CustomerSearchCard
            customerId={customerId}
            customerName={customerName}
            onSelect={selectCustomer}
            onClear={clearCustomer}
            error={errors.customerId?.message}
          />

          <Card>
            <CardHeader>
              <CardTitle>Montant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Montant en euros</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Ex: 5"
                  min={0.01}
                  step="0.01"
                  {...register("amount")}
                />
                {errors.amount && (
                  <p className="text-xs text-destructive">
                    {errors.amount.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Crédité immédiatement au solde cashback (1 € = 100 PdB).
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optionnel)</Label>
                <Textarea
                  id="notes"
                  placeholder="Raison de l'attribution, contexte..."
                  rows={3}
                  {...register("notes")}
                />
                {errors.notes && (
                  <p className="text-xs text-destructive">
                    {errors.notes.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-4">
                <Link href="/rewards/cashback-gains">
                  <Button type="button" variant="outline">
                    Annuler
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Créditer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
