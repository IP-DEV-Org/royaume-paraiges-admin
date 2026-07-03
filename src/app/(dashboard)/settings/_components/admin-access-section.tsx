"use client";

// Gestion des accès par fonctionnalité (super admin uniquement, migration 057).
// Onglet « Administrateurs » de /settings. Chaque admin non-super dispose d'un
// interrupteur par entrée de la sidebar ; désactiver = insérer une ligne dans
// admin_disabled_features (blocage dur par le middleware + masquage
// sidebar/palette côté client).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldOff, UserCog } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { useCurrentAdmin } from "@/components/providers/CurrentAdminProvider";
import {
  disableFeature,
  enableFeature,
  getAllDisabledFeatures,
  getManagedAdmins,
} from "@/lib/services/adminAccessService";
import { adminAccessKeys } from "@/lib/queries/keys";
import { navigationGroups } from "@/lib/navigation";
import type { FeatureKey } from "@/lib/features";
import type { Profile } from "@/types/database";

export function AdminAccessSection() {
  const { isSuperAdmin, isLoading: adminLoading } = useCurrentAdmin();

  const { data: admins, isLoading: adminsLoading } = useQuery({
    queryKey: adminAccessKeys.admins(),
    queryFn: getManagedAdmins,
    enabled: isSuperAdmin,
  });

  const { data: disabledRows, isLoading: disabledLoading } = useQuery({
    queryKey: adminAccessKeys.disabledFeatures(),
    queryFn: getAllDisabledFeatures,
    enabled: isSuperAdmin,
  });

  if (adminLoading || (isSuperAdmin && (adminsLoading || disabledLoading))) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // L'onglet n'est affiché qu'au super admin ; garde par défense en profondeur
  // (deep-link ?tab=admins par un admin normal).
  if (!isSuperAdmin) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="Section réservée au super admin"
        description="Seul un compte super admin peut gérer les accès des administrateurs."
      />
    );
  }

  // profile_id → set des features désactivées
  const disabledByProfile = new Map<string, Set<string>>();
  for (const row of disabledRows ?? []) {
    const set = disabledByProfile.get(row.profile_id) ?? new Set<string>();
    set.add(row.feature_key);
    disabledByProfile.set(row.profile_id, set);
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Activez ou désactivez l&apos;accès aux fonctionnalités de
        l&apos;interface admin pour chaque administrateur. Une fonctionnalité
        désactivée disparaît de la navigation et son URL est bloquée.
      </p>

      {(admins ?? []).length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="Aucun administrateur à gérer"
          description="Les autres comptes admin (hors super admins et compte système) apparaîtront ici."
        />
      ) : (
        (admins ?? []).map((admin) => (
          <AdminAccessCard
            key={admin.id}
            admin={admin}
            disabledFeatures={disabledByProfile.get(admin.id) ?? new Set()}
          />
        ))
      )}
    </div>
  );
}

function AdminAccessCard({
  admin,
  disabledFeatures,
}: {
  admin: Profile;
  disabledFeatures: Set<string>;
}) {
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: async (input: { featureKey: FeatureKey; enable: boolean }) => {
      const payload = { profileId: admin.id, featureKey: input.featureKey };
      if (input.enable) {
        await enableFeature(payload);
      } else {
        await disableFeature(payload);
      }
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: adminAccessKeys.all });
      toast.success(input.enable ? "Accès réactivé" : "Accès désactivé");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Impossible de modifier cet accès");
    },
  });

  const displayName =
    [admin.first_name, admin.last_name].filter(Boolean).join(" ") ||
    admin.username ||
    admin.email ||
    "Administrateur";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="h-5 w-5" />
          {displayName}
        </CardTitle>
        {admin.email && <CardDescription>{admin.email}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">
        {navigationGroups.map((group) => {
          const items = group.items.filter((item) => item.featureKey);
          if (items.length === 0) return null;
          return (
            <div key={group.title}>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h3>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => {
                  const featureKey = item.featureKey as FeatureKey;
                  const enabled = !disabledFeatures.has(featureKey);
                  const switchId = `${admin.id}-${featureKey}`;
                  return (
                    <div
                      key={featureKey}
                      className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                    >
                      <Label
                        htmlFor={switchId}
                        className="flex items-center gap-2 text-sm font-normal"
                      >
                        <item.icon
                          className="h-4 w-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        {item.name}
                      </Label>
                      <Switch
                        id={switchId}
                        checked={enabled}
                        disabled={toggleMutation.isPending}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ featureKey, enable: checked })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
