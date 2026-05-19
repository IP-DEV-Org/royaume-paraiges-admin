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
  percentage: z
    .string()
    .refine(
      (v) => {
        const n = parseInt(v, 10);
        return !isNaN(n) && n >= 1 && n <= 100;
      },
      { message: "Le pourcentage doit être entre 1 et 100." },
    ),
  expiresAt: z.string().optional(),
  notes: z.string().max(500).optional(),
});

type FormInput = z.infer<typeof formSchema>;

export default function CreateCouponPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const form = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: "",
      customerName: "",
      percentage: "",
      expiresAt: "",
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
        percentage: parseInt(values.percentage, 10),
        expiresAt: values.expiresAt || undefined,
        notes: values.notes || undefined,
      });

      queryClient.invalidateQueries({ queryKey: couponKeys.all });
      toast.success(`Coupon de ${values.percentage}% attribué`);
      router.push("/coupons");
    } catch (err) {
      console.error(err);
      toast.error("Erreur", {
        description:
          err instanceof Error ? err.message : "Impossible de créer le coupon",
      });
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/coupons">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Nouveau coupon</h1>
          <p className="text-muted-foreground">
            Attribuez un coupon de réduction (%) à un utilisateur.
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
              <CardTitle>Pourcentage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="percentage">Pourcentage (1 à 100)</Label>
                <Input
                  id="percentage"
                  type="number"
                  placeholder="Ex: 10"
                  min={1}
                  max={100}
                  {...register("percentage")}
                />
                {errors.percentage && (
                  <p className="text-xs text-destructive">
                    {errors.percentage.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Cashback supplémentaire appliqué sur la prochaine commande.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="expiresAt">
                    Date d&apos;expiration (optionnel)
                  </Label>
                  <Input
                    id="expiresAt"
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    {...register("expiresAt")}
                  />
                </div>
              </div>

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
                <Link href="/coupons">
                  <Button type="button" variant="outline">
                    Annuler
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Attribuer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
