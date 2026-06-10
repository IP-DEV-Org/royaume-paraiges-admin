"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  Edit,
  Gift,
  Loader2,
  Receipt,
  Shield,
  Ticket,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { getUserWithStats, getUserFullStats } from "@/lib/services/userService";
import { getEstablishments } from "@/lib/services/contentService";
import { userKeys, establishmentKeys } from "@/lib/queries/keys";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { ActivityTab } from "./_components/activity-tab";
import { CouponsTab } from "./_components/coupons-tab";
import { EditTab } from "./_components/edit-tab";
import { GainsTab } from "./_components/gains-tab";
import { OverviewTab } from "./_components/overview-tab";
import { ReceiptsTab } from "./_components/receipts-tab";
import { UserRoleBadge } from "./_components/user-role-badge";
import { UserStatsCards } from "./_components/user-stats-cards";
import { getUserDisplayName, mapUserDetail } from "./_components/types";

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [activeTab, setActiveTab] = useState("activity");

  const userQuery = useQuery({
    queryKey: userKeys.detail(userId),
    queryFn: () => getUserWithStats(userId),
  });

  const fullStatsQuery = useQuery({
    queryKey: [...userKeys.detail(userId), "fullStats"],
    queryFn: () => getUserFullStats(userId),
  });

  const establishmentsQuery = useQuery({
    queryKey: establishmentKeys.lists(),
    queryFn: getEstablishments,
  });

  // Utilisateur introuvable ou échec de chargement → retour au listing.
  const notFound = userQuery.isSuccess && !userQuery.data;
  const loadError =
    userQuery.error || fullStatsQuery.error || establishmentsQuery.error;

  useEffect(() => {
    if (loadError || notFound) {
      if (loadError) console.error(loadError);
      toast.error("Erreur", {
        description: notFound
          ? "Utilisateur introuvable"
          : "Impossible de charger l'utilisateur",
      });
      router.push("/users");
    }
  }, [loadError, notFound, router]);

  if (
    userQuery.isPending ||
    fullStatsQuery.isPending ||
    establishmentsQuery.isPending
  ) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const userData = userQuery.data;
  if (!userData) {
    return null;
  }

  const user = mapUserDetail(userData);
  const stats = {
    totalReceipts: userData.totalReceipts || 0,
    totalSpent: userData.totalSpent || 0,
    totalCoupons: userData.totalCoupons || 0,
    activeCoupons: userData.activeCoupons || 0,
  };
  const fullStats = fullStatsQuery.data ?? null;
  const establishments = establishmentsQuery.data ?? [];
  const displayName = getUserDisplayName(user);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/users">
          <Button variant="ghost" size="icon" aria-label="Retour à la liste des utilisateurs">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{displayName}</h1>
            <UserRoleBadge role={user.role} />
            {user.deletedAt && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Compte supprime le {formatDate(user.deletedAt)}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <UserStatsCards stats={stats} fullStats={fullStats} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Activité
          </TabsTrigger>
          <TabsTrigger value="gains" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Gains
          </TabsTrigger>
          <TabsTrigger value="coupons" className="flex items-center gap-2">
            <Ticket className="h-4 w-4" />
            Coupons ({stats.totalCoupons})
          </TabsTrigger>
          <TabsTrigger value="receipts" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Tickets ({stats.totalReceipts})
          </TabsTrigger>
          <TabsTrigger value="edit" className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Modifier
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab
            user={user}
            fullStats={fullStats}
            establishments={establishments}
          />
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <ActivityTab userId={userId} />
        </TabsContent>

        <TabsContent value="gains">
          <GainsTab userId={userId} />
        </TabsContent>

        <TabsContent value="coupons">
          <CouponsTab userId={userId} />
        </TabsContent>

        <TabsContent value="receipts">
          <ReceiptsTab userId={userId} />
        </TabsContent>

        <TabsContent value="edit">
          <EditTab user={user} establishments={establishments} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
