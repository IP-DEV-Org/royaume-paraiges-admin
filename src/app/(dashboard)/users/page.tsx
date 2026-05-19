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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Users, UserPlus, Shield, Briefcase, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { getUsers, getUserStats, type UserFilters } from "@/lib/services/userService";
import { cn, formatDate } from "@/lib/utils";
import { userKeys } from "@/lib/queries/keys";
import type { UserRole } from "@/types/database";

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
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="text-xl font-bold">{tile.value}</div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Utilisateurs</h1>
        <p className="text-muted-foreground">
          Gestion des utilisateurs de l’application
        </p>
      </div>

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
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Aucun utilisateur trouve
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 md:overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Utilisateur</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Inscrit le</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow
                          key={user.id}
                          className="cursor-pointer"
                          onClick={() => router.push(`/users/${user.id}`)}
                        >
                          <TableCell>
                            <div className="font-medium">
                              {user.first_name || user.last_name
                                ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                                : "Sans nom"}
                            </div>
                            {user.username && (
                              <div className="text-xs text-muted-foreground">
                                @{user.username}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{user.email || "-"}</TableCell>
                          <TableCell>
                            {user.role === "admin" ? (
                              <Badge variant="default">Admin</Badge>
                            ) : user.role === "employee" ? (
                              <Badge variant="outline">Employé</Badge>
                            ) : user.role === "establishment" ? (
                              <Badge variant="secondary">Établissement</Badge>
                            ) : (
                              <Badge variant="secondary">Client</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(user.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="mt-4 flex shrink-0 items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Page {page + 1} sur {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 0}
                        onClick={() => setPage(page - 1)}
                      >
                        Précédent
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage(page + 1)}
                      >
                        Suivant
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
