"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { updateUser, getIsCurrentUserSuperAdmin } from "@/lib/services/userService";
import { anonymizeUser } from "@/lib/services/gdprService";
import { userKeys } from "@/lib/queries/keys";
import { toast } from "sonner";
import type { Establishment } from "@/lib/services/contentService";
import type { UserRole } from "@/types/database";
import { UserRoleBadge } from "./user-role-badge";
import type { UserDetail } from "./types";

interface EditTabProps {
  user: UserDetail;
  establishments: Establishment[];
}

const ROLE_LABELS: Record<UserRole, string> = {
  client: "Client",
  employee: "Employé",
  establishment: "Établissement",
  admin: "Administrateur",
};

export function EditTab({ user, establishments }: EditTabProps) {
  const queryClient = useQueryClient();

  // Garde-fou BDD : trg_protect_role (migration 064). Un admin peut basculer un
  // compte entre client et employé ; les rôles admin/establishment restent
  // réservés au super-admin. On reflète la règle ici pour éviter une erreur
  // serveur au submit.
  const { data: isSuperAdmin = false } = useQuery({
    queryKey: userKeys.isSuperAdmin(),
    queryFn: getIsCurrentUserSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });

  // State initialisé depuis les props : le composant monte à l'ouverture de
  // l'onglet, donc les valeurs sont fraîches (pattern handoff, cf. /settings).
  const [form, setForm] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    attachedEstablishmentId: user.attachedEstablishmentId?.toString() || "",
  });

  const canEditRole =
    isSuperAdmin || user.role === "client" || user.role === "employee";

  // Miroir de trg_protect_role. Sur un profil admin/establishment édité par un
  // admin non super, on n'expose que le rôle courant pour que le Select reste
  // lisible malgré le disabled.
  const roleOptions: UserRole[] = isSuperAdmin
    ? ["client", "employee", "establishment", "admin"]
    : canEditRole
      ? ["client", "employee"]
      : [user.role];

  // Contrainte BDD profiles_staff_requires_establishment (migrations 064/065) :
  // tout compte du personnel doit être rattaché à un établissement.
  const requiresEstablishment =
    form.role === "employee" || form.role === "establishment";
  const establishmentMissing =
    requiresEstablishment && !form.attachedEstablishmentId;

  const updateMutation = useMutation({
    mutationFn: () =>
      updateUser(user.id, {
        first_name: form.firstName || null,
        last_name: form.lastName || null,
        role: form.role,
        attached_establishment_id: form.attachedEstablishmentId
          ? parseInt(form.attachedEstablishmentId)
          : null,
      }),
    onSuccess: () => {
      toast.success("Utilisateur mis a jour");
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (error: unknown) => {
      const code = (error as { code?: string })?.code;
      toast.error("Erreur", {
        description:
          code === "42501"
            ? "Seul un super-administrateur peut attribuer ce rôle."
            : code === "23514"
              ? "Un compte employé ou établissement doit être rattaché à un établissement."
              : "Impossible de mettre a jour l'utilisateur",
      });
    },
  });

  const anonymizeMutation = useMutation({
    mutationFn: () => anonymizeUser(user.id),
    onSuccess: () => {
      toast.success("Compte supprime", {
        description: "Le profil a ete anonymise avec succes",
      });
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: () => {
      toast.error("Erreur", {
        description: "Impossible de supprimer le compte",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Informations personnelles</CardTitle>
            <CardDescription>
              Modifier les informations de l’utilisateur
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input
                  id="firstName"
                  placeholder="Prénom"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input
                  id="lastName"
                  placeholder="Nom"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                L’email ne peut pas être modifié depuis cette interface
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={form.role}
                onValueChange={(value: UserRole) => setForm({ ...form, role: value })}
                disabled={!canEditRole}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                Role actuel : <UserRoleBadge role={form.role} />
              </div>
              {!isSuperAdmin && (
                <p className="text-xs text-muted-foreground">
                  {canEditRole
                    ? "Vous pouvez basculer ce compte entre client et employé. Les rôles administrateur et établissement sont réservés à un super-administrateur."
                    : "Seul un super-administrateur peut modifier le rôle d’un compte administrateur ou établissement."}
                </p>
              )}
            </div>

            {requiresEstablishment && (
              <div className="space-y-2">
                <Label htmlFor="attachedEstablishment">
                  Établissement de reference *
                </Label>
                <Select
                  value={form.attachedEstablishmentId}
                  onValueChange={(value) =>
                    setForm({ ...form, attachedEstablishmentId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un établissement" />
                  </SelectTrigger>
                  <SelectContent>
                    {establishments.map((establishment) => (
                      <SelectItem key={establishment.id} value={establishment.id.toString()}>
                        {establishment.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {establishmentMissing ? (
                  <p className="text-xs text-destructive">
                    Un compte employé ou établissement doit être rattaché à un
                    établissement.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Établissement de reference de cet employe/gérant
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="submit"
                disabled={updateMutation.isPending || establishmentMissing}
              >
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Card className="mt-6 border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Zone dangereuse</CardTitle>
          <CardDescription>
            Actions irreversibles sur ce compte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={anonymizeMutation.isPending || !!user.deletedAt}
              >
                {anonymizeMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {user.deletedAt ? "Compte deja supprime" : "Supprimer le compte (RGPD)"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmer la suppression RGPD</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irreversible. Le profil sera anonymise : toutes les donnees
                  personnelles (nom, email, telephone, avatar) seront supprimees. Les donnees
                  transactionnelles (tickets, gains) seront conservees a des fins comptables.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => anonymizeMutation.mutate()}
                >
                  Confirmer la suppression
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </>
  );
}
