"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Users, UserPlus, Shield, Briefcase, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getUsers, getUserStats, type UserFilters } from "@/lib/services/userService";
import { cn, formatDate } from "@/lib/utils";
import { userKeys } from "@/lib/queries/keys";
import type { Profile, UserRole } from "@/types/database";

export default function UsersPage() {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<UserFilters>({});
  const [searchInput, setSearchInput] = useState("");
  const router = useRouter();

  const limit = 20;

  const usersQuery = useQuery({
    queryKey: userKeys.list({ ...filters, page }),
    queryFn: () => getUsers(filters, limit, page * limit),
  });

  const statsQuery = useQuery({
    queryKey: [...userKeys.all, "stats"] as const,
    queryFn: getUserStats,
  });

  const error = usersQuery.error || statsQuery.error;
  useEffect(() => {
    if (error) {
      console.error(error);
      toast.error("Erreur", {
        description: "Impossible de charger les utilisateurs",
      });
    }
  }, [error]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput.length >= 3) {
        setPage(0);
        setFilters((prev) => ({ ...prev, search: searchInput }));
      } else if (searchInput.length === 0) {
        setPage(0);
        setFilters((prev) => ({ ...prev, search: undefined }));
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const users = usersQuery.data?.data ?? [];
  const total = usersQuery.data?.count ?? 0;
  const stats = statsQuery.data ?? null;
  const loading = usersQuery.isLoading;
  const totalPages = Math.ceil(total / limit);

  const activeRole = filters.role;
  const toggleRole = (role: UserRole) => {
    setPage(0);
    setFilters((prev) => ({
      ...prev,
      role: prev.role === role ? undefined : role,
    }));
  };

  const clientTiles: Array<{
    label: string;
    value: number;
    icon: typeof Users;
    role?: UserRole;
  }> = stats
    ? [
        { label: "Clients", value: stats.totalClients, icon: Users, role: "client" },
        { label: "Nouveaux ce mois", value: stats.newUsersThisMonth, icon: UserPlus },
      ]
    : [];

  const internalTiles: Array<{
    label: string;
    value: number;
    icon: typeof Users;
    role: UserRole;
  }> = stats
    ? [
        { label: "Admins", value: stats.totalAdmins, icon: Shield, role: "admin" },
        { label: "Employés", value: stats.totalEmployees, icon: Briefcase, role: "employee" },
        { label: "Établissements", value: stats.totalEstablishments, icon: Building2, role: "establishment" },
      ]
    : [];

  const columns: DataTableColumn<Profile>[] = [
    {
      key: "user",
      header: "Utilisateur",
      sortable: true,
      sortValue: (user) =>
        `${user.first_name || ""} ${user.last_name || ""}`.trim() || null,
      cell: (user) => (
        <>
          <div className="font-medium">
            {user.first_name || user.last_name
              ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
              : "Sans nom"}
          </div>
          {user.username && (
            <div className="text-xs text-muted-foreground">@{user.username}</div>
          )}
        </>
      ),
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
      sortValue: (user) => user.email,
      cell: (user) => user.email || "-",
    },
    {
      key: "role",
      header: "Rôle",
      sortable: true,
      sortValue: (user) => user.role,
      cell: (user) =>
        user.role === "admin" ? (
          <Badge variant="default">Admin</Badge>
        ) : user.role === "employee" ? (
          <Badge variant="outline">Employé</Badge>
        ) : user.role === "establishment" ? (
          <Badge variant="secondary">Établissement</Badge>
        ) : (
          <Badge variant="secondary">Client</Badge>
        ),
    },
    {
      key: "created_at",
      header: "Inscrit le",
      sortable: true,
      sortValue: (user) => user.created_at,
      cellClassName: "text-sm text-muted-foreground",
      cell: (user) => formatDate(user.created_at),
    },
  ];

  const renderTile = (tile: {
    label: string;
    value: number;
    icon: typeof Users;
    role?: UserRole;
  }) => {
    const isClickable = !!tile.role;
    const isActive = isClickable && tile.role === activeRole;
    const Icon = tile.icon;
    return (
      <Card
        key={tile.label}
        onClick={isClickable ? () => toggleRole(tile.role!) : undefined}
        className={cn(
          isClickable && "cursor-pointer transition-colors hover:bg-accent",
          isActive && "border-primary bg-primary/5 hover:bg-primary/10"
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            {tile.label}
          </CardTitle>
          <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="text-xl font-bold">{tile.value}</div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <PageHeader
        title="Utilisateurs"
        description="Gestion des utilisateurs de l’application"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-6 md:flex-row">
        <aside className="space-y-6 md:h-full md:w-80 md:shrink-0 md:overflow-y-auto md:pr-1">
          {stats && (
            <section className="space-y-2">
              <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-foreground">
                Clients
              </h2>
              <div className="space-y-2">{clientTiles.map(renderTile)}</div>
            </section>
          )}

          {stats && (
            <section className="space-y-2">
              <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-foreground">
                Comptes internes
              </h2>
              <div className="space-y-2">{internalTiles.map(renderTile)}</div>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-foreground">
              Recherche
            </h2>
            <Input
              placeholder="Nom, email…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full"
            />
          </section>
        </aside>

        <Card className="flex min-h-0 flex-1 flex-col md:h-full md:overflow-hidden">
          <CardHeader>
            <CardTitle>Liste des utilisateurs</CardTitle>
            <CardDescription>
              {total} utilisateur{total > 1 ? "s" : ""} au total
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col md:overflow-hidden">
            <DataTable
              columns={columns}
              data={users}
              rowKey={(user) => user.id}
              loading={loading}
              onRowClick={(user) => router.push(`/users/${user.id}`)}
              className="min-h-0 flex-1 md:overflow-hidden"
              containerClassName="min-h-0 flex-1 md:overflow-y-auto"
              emptyState={
                <EmptyState
                  icon={Users}
                  title={
                    filters.search
                      ? "Aucun résultat pour cette recherche"
                      : "Aucun utilisateur trouvé"
                  }
                  description={
                    filters.search
                      ? "Essayez avec un autre nom ou email."
                      : undefined
                  }
                />
              }
              pagination={{ page, totalPages, onPageChange: setPage }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
