"use client";

// Promotion d'un utilisateur au rôle admin depuis l'onglet Administrateurs de
// /settings (super admin uniquement). Recherche parmi tous les utilisateurs
// puis update profiles.role = 'admin' — la barrière réelle est côté BDD :
// policy « Admins can update all profiles » + trigger trg_protect_role
// (migration 060, seul un super admin peut changer un rôle).

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Search, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { getUsers, updateUser } from "@/lib/services/userService";
import { adminAccessKeys, userKeys } from "@/lib/queries/keys";
import type { Profile } from "@/types/database";

const ROLE_LABELS: Record<string, string> = {
  client: "Client",
  employee: "Employé",
  establishment: "Gérant",
  admin: "Admin",
};

function displayName(user: Profile): string {
  return (
    [user.first_name, user.last_name].filter(Boolean).join(" ") ||
    user.username ||
    user.email ||
    "Utilisateur"
  );
}

export function AddAdminDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [candidate, setCandidate] = useState<Profile | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: results, isFetching } = useQuery({
    queryKey: [...adminAccessKeys.all, "candidateSearch", debouncedSearch],
    queryFn: () => getUsers({ search: debouncedSearch }, 8, 0),
    enabled: open && debouncedSearch.length >= 2,
  });

  // Les admins existants ne sont pas des candidats à la promotion.
  const candidates = (results?.data ?? []).filter(
    (user) => user.role !== "admin"
  );

  const promoteMutation = useMutation({
    mutationFn: (user: Profile) => updateUser(user.id, { role: "admin" }),
    onSuccess: (_data, user) => {
      queryClient.invalidateQueries({ queryKey: adminAccessKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      toast.success(`${displayName(user)} est maintenant administrateur`);
      onOpenChange(false);
      setSearch("");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Impossible de promouvoir cet utilisateur");
    },
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Ajouter un administrateur
            </DialogTitle>
            <DialogDescription>
              Recherchez un utilisateur pour le promouvoir au rôle admin. Il
              aura accès à l&apos;interface d&apos;administration (accès
              ajustables ensuite dans la matrice ci-dessous).
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Nom, prénom ou email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
            {isFetching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          <div className="max-h-72 space-y-1 overflow-y-auto">
            {debouncedSearch.length < 2 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Tapez au moins 2 caractères pour rechercher.
              </p>
            ) : candidates.length === 0 && !isFetching ? (
              <EmptyState
                title="Aucun utilisateur trouvé"
                description="Aucun utilisateur non-admin ne correspond à cette recherche."
                className="py-6"
              />
            ) : (
              candidates.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {displayName(user)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {ROLE_LABELS[user.role] ?? user.role}
                    </Badge>
                    <Button
                      size="sm"
                      onClick={() => setCandidate(user)}
                      disabled={promoteMutation.isPending}
                    >
                      Promouvoir
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={candidate !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setCandidate(null);
        }}
        title="Promouvoir en administrateur ?"
        description={
          candidate
            ? `${displayName(candidate)} (${candidate.email ?? "sans email"}) obtiendra le rôle admin et l'accès complet à l'interface d'administration. Vous pourrez ensuite restreindre ses accès fonctionnalité par fonctionnalité.`
            : ""
        }
        confirmLabel="Promouvoir"
        onConfirm={async () => {
          if (candidate) {
            await promoteMutation.mutateAsync(candidate);
            setCandidate(null);
          }
        }}
      />
    </>
  );
}
