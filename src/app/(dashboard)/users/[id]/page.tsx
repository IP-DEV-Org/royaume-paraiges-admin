"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ArrowLeft,
  Loader2,
  Receipt,
  Ticket,
  Coins,
  Star,
  Trophy,
  User,
  Edit,
  CreditCard,
  Banknote,
  TrendingUp,
  Mail,
  Phone,
  Calendar,
  Award,
  Target,
  Shield,
  IdCard,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import {
  getUserWithStats,
  updateUser,
  getUserCoupons,
  getUserReceipts,
  getUserFullStats,
  getUserActivityStats,
  getUserDailyCashback,
  getUserGains,
  getUserQuestProgress,
  type UserCoupon,
  type UserReceipt,
  type UserActivityStats,
  type UserDailyCashback,
  type UserGain,
  type UserQuestProgress,
} from "@/lib/services/userService";
import { PeriodSelector, getPresetDates, type PeriodDates } from "@/components/period-selector";
import { ShoppingCart, Wallet, Zap, PiggyBank, ArrowDownCircle, BarChart3, Gift } from "lucide-react";
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { getEstablishments, type Establishment } from "@/lib/services/contentService";
import { anonymizeUser } from "@/lib/services/gdprService";
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
import { useToast } from "@/components/ui/use-toast";
import { cn, formatCurrency, formatPercentage, formatDate, formatDateTime } from "@/lib/utils";
import { getPaymentMethodConfig } from "@/lib/payment-methods";
import type { UserRole } from "@/types/database";

const consumptionTypeLabels: Record<string, string> = {
  cocktail: "Cocktail",
  biere: "Bière",
  alcool: "Alcool",
  soft: "Soft",
  boisson_chaude: "Boisson chaude",
  restauration: "Restauration",
};

const sourceTypeLabels: Record<string, string> = {
  receipt: "Ticket",
  bonus_cashback_manual: "Bonus manuel",
  bonus_cashback_leaderboard: "Classement",
  bonus_cashback_quest: "Quête",
  bonus_cashback_trigger: "Trigger",
  bonus_cashback_migration: "Migration",
};

const questStatusLabels: Record<string, string> = {
  in_progress: "En cours",
  completed: "Complétée",
  rewarded: "Récompensée",
  expired: "Expirée",
};

const questStatusVariants: Record<string, string> = {
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-amber-100 text-amber-800",
  rewarded: "bg-emerald-100 text-emerald-800",
  expired: "bg-red-100 text-red-800",
};

const questProgressBarColors: Record<string, string> = {
  in_progress: "bg-primary",
  completed: "bg-amber-500",
  rewarded: "bg-emerald-500",
  expired: "bg-red-500",
};

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [anonymizing, setAnonymizing] = useState(false);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [activeTab, setActiveTab] = useState("activity");

  // User data
  const [user, setUser] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    birthdate: string | null;
    username: string | null;
    avatarUrl: string | null;
    identityPhotoUrl: string | null;
    role: UserRole;
    xpCoefficient: number;
    cashbackCoefficient: number;
    attachedEstablishmentId: number | null;
    createdAt: string;
    deletedAt: string | null;
  } | null>(null);

  // Stats
  const [stats, setStats] = useState({
    totalReceipts: 0,
    totalSpent: 0,
    totalCoupons: 0,
    activeCoupons: 0,
  });

  const [fullStats, setFullStats] = useState<{
    totalXp: number;
    cashbackBalance: number;
    cashbackEarned: number;
    cashbackSpent: number;
    weeklyRank: number | null;
    monthlyRank: number | null;
    yearlyRank: number | null;
  } | null>(null);

  // Coupons
  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [couponsTotal, setCouponsTotal] = useState(0);
  const [couponsPage, setCouponsPage] = useState(0);
  const [loadingCoupons, setLoadingCoupons] = useState(false);

  // Receipts
  const [receipts, setReceipts] = useState<UserReceipt[]>([]);
  const [receiptsTotal, setReceiptsTotal] = useState(0);
  const [receiptsPage, setReceiptsPage] = useState(0);
  const [loadingReceipts, setLoadingReceipts] = useState(false);

  // Gains
  const [gains, setGains] = useState<UserGain[]>([]);
  const [gainsTotal, setGainsTotal] = useState(0);
  const [gainsPage, setGainsPage] = useState(0);
  const [loadingGains, setLoadingGains] = useState(false);
  const [gainsSourceFilter, setGainsSourceFilter] = useState("all");

  // Quest progress
  const [questProgress, setQuestProgress] = useState<UserQuestProgress[]>([]);
  const [questProgressTotal, setQuestProgressTotal] = useState(0);
  const [questProgressPage, setQuestProgressPage] = useState(0);
  const [loadingQuestProgress, setLoadingQuestProgress] = useState(false);
  const [questPeriodTypeFilter, setQuestPeriodTypeFilter] = useState("all");
  const [questStatusFilter, setQuestStatusFilter] = useState("all");

  // Activity stats
  const [activityStats, setActivityStats] = useState<UserActivityStats | null>(null);
  const [dailyCashback, setDailyCashback] = useState<UserDailyCashback[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityPeriod, setActivityPeriod] = useState<PeriodDates>(() => {
    const { start, end } = getPresetDates("all_time");
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  });

  // Edit form
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    role: "client" as UserRole,
    attachedEstablishmentId: "",
  });

  const limit = 10;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userData, establishmentsData, fullStatsData] = await Promise.all([
          getUserWithStats(userId),
          getEstablishments(),
          getUserFullStats(userId),
        ]);

        setEstablishments(establishmentsData);
        setFullStats(fullStatsData);

        if (userData) {
          setUser({
            id: userData.id,
            firstName: userData.first_name || "",
            lastName: userData.last_name || "",
            email: userData.email || "",
            phone: userData.phone,
            birthdate: userData.birthdate,
            username: userData.username,
            avatarUrl: userData.avatar_url,
            identityPhotoUrl: userData.identity_photo_url,
            role: userData.role,
            xpCoefficient: userData.xp_coefficient || 1,
            cashbackCoefficient: userData.cashback_coefficient || 1,
            attachedEstablishmentId: userData.attached_establishment_id,
            createdAt: userData.created_at,
            deletedAt: userData.deleted_at || null,
          });
          setStats({
            totalReceipts: userData.totalReceipts || 0,
            totalSpent: userData.totalSpent || 0,
            totalCoupons: userData.totalCoupons || 0,
            activeCoupons: userData.activeCoupons || 0,
          });
          setForm({
            firstName: userData.first_name || "",
            lastName: userData.last_name || "",
            role: userData.role,
            attachedEstablishmentId: userData.attached_establishment_id?.toString() || "",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Erreur",
            description: "Utilisateur introuvable",
          });
          router.push("/users");
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de charger l'utilisateur",
        });
        router.push("/users");
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [userId, router, toast]);

  const fetchActivityStats = useCallback(async () => {
    setLoadingActivity(true);
    try {
      const [data, daily] = await Promise.all([
        getUserActivityStats(userId, activityPeriod.startDate, activityPeriod.endDate),
        getUserDailyCashback(userId, activityPeriod.startDate, activityPeriod.endDate),
      ]);
      setActivityStats(data);
      setDailyCashback(daily);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les statistiques d'activité",
      });
    } finally {
      setLoadingActivity(false);
    }
  }, [userId, activityPeriod, toast]);

  const fetchGains = useCallback(async () => {
    setLoadingGains(true);
    try {
      const result = await getUserGains(
        userId,
        limit,
        gainsPage * limit,
        gainsSourceFilter !== "all" ? gainsSourceFilter : undefined
      );
      setGains(result.data);
      setGainsTotal(result.count);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les gains",
      });
    } finally {
      setLoadingGains(false);
    }
  }, [userId, gainsPage, gainsSourceFilter, toast]);

  const fetchQuestProgress = useCallback(async () => {
    setLoadingQuestProgress(true);
    try {
      const result = await getUserQuestProgress(
        userId,
        limit,
        questProgressPage * limit,
        questPeriodTypeFilter !== "all" ? questPeriodTypeFilter : undefined,
        questStatusFilter !== "all" ? questStatusFilter : undefined
      );
      setQuestProgress(result.data);
      setQuestProgressTotal(result.count);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger la progression des quêtes",
      });
    } finally {
      setLoadingQuestProgress(false);
    }
  }, [userId, questProgressPage, questPeriodTypeFilter, questStatusFilter, toast]);

  const fetchCoupons = useCallback(async () => {
    setLoadingCoupons(true);
    try {
      const result = await getUserCoupons(userId, limit, couponsPage * limit);
      setCoupons(result.data);
      setCouponsTotal(result.count);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les coupons",
      });
    } finally {
      setLoadingCoupons(false);
    }
  }, [userId, couponsPage, toast]);

  const fetchReceipts = useCallback(async () => {
    setLoadingReceipts(true);
    try {
      const result = await getUserReceipts(userId, limit, receiptsPage * limit);
      setReceipts(result.data);
      setReceiptsTotal(result.count);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les tickets",
      });
    } finally {
      setLoadingReceipts(false);
    }
  }, [userId, receiptsPage, toast]);

  // Load coupons when tab is selected
  useEffect(() => {
    if (activeTab === "coupons") {
      fetchCoupons();
    }
  }, [activeTab, fetchCoupons]);

  // Load receipts when tab is selected
  useEffect(() => {
    if (activeTab === "receipts") {
      fetchReceipts();
    }
  }, [activeTab, fetchReceipts]);

  // Load gains when tab is selected or page/filter changes
  useEffect(() => {
    if (activeTab === "gains") {
      fetchGains();
    }
  }, [activeTab, fetchGains]);

  // Load quest progress when activity tab is selected or page/filters change
  useEffect(() => {
    if (activeTab === "activity") {
      fetchQuestProgress();
    }
  }, [activeTab, fetchQuestProgress]);

  // Load activity stats when tab is selected or period changes
  useEffect(() => {
    if (activeTab === "activity") {
      fetchActivityStats();
    }
  }, [activeTab, fetchActivityStats]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateUser(userId, {
        first_name: form.firstName || null,
        last_name: form.lastName || null,
        role: form.role,
        attached_establishment_id: form.attachedEstablishmentId
          ? parseInt(form.attachedEstablishmentId)
          : null,
      });

      toast({ title: "Utilisateur mis a jour" });
      // Update local state
      if (user) {
        setUser({
          ...user,
          firstName: form.firstName,
          lastName: form.lastName,
          role: form.role,
          attachedEstablishmentId: form.attachedEstablishmentId
            ? parseInt(form.attachedEstablishmentId)
            : null,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre a jour l'utilisateur",
      });
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case "admin":
        return <Badge variant="default">Admin</Badge>;
      case "employee":
        return <Badge variant="outline">Employé</Badge>;
      case "establishment":
        return <Badge variant="secondary">Établissement</Badge>;
      default:
        return <Badge variant="secondary">Client</Badge>;
    }
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const getEstablishmentName = (id: number | null) => {
    if (!id) return "-";
    const establishment = establishments.find((e) => e.id === id);
    return establishment?.title || `Établissement #${id}`;
  };

  if (loadingData) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const couponsPages = Math.ceil(couponsTotal / limit);
  const receiptsPages = Math.ceil(receiptsTotal / limit);
  const gainsPages = Math.ceil(gainsTotal / limit);
  const questProgressPages = Math.ceil(questProgressTotal / limit);

  const displayName =
    user.firstName || user.lastName
      ? `${user.firstName} ${user.lastName}`.trim()
      : user.email || user.id.slice(0, 8) + "...";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/users">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{displayName}</h1>
            {getRoleBadge(user.role)}
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

      {/* Stats Cards */}
      <div className="flex flex-wrap gap-4 [&>*]:min-w-[140px] [&>*]:flex-1">
        <StatCard
          title="XP Total"
          icon={<Star className="h-4 w-4 text-muted-foreground" />}
          value={fullStats?.totalXp.toLocaleString() || 0}
        />
        <StatCard
          title="Cashback"
          icon={<Coins className="h-4 w-4 text-muted-foreground" />}
          value={formatCurrency(fullStats?.cashbackBalance || 0)}
        />
        <StatCard
          title="Tickets"
          icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
          value={stats.totalReceipts}
        />
        <StatCard
          title="Dépensé"
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          value={formatCurrency(stats.totalSpent)}
        />
        <StatCard
          title="Coupons"
          icon={<Ticket className="h-4 w-4 text-muted-foreground" />}
          value={stats.totalCoupons}
          subtitle={`${stats.activeCoupons} actif(s)`}
        />
        <StatCard
          title="Rang Hebdo"
          icon={<Trophy className="h-4 w-4 text-muted-foreground" />}
          value={fullStats?.weeklyRank ? `#${fullStats.weeklyRank}` : "-"}
        />
        <StatCard
          title="Rang Mensuel"
          icon={<Trophy className="h-4 w-4 text-muted-foreground" />}
          value={fullStats?.monthlyRank ? `#${fullStats.monthlyRank}` : "-"}
        />
        <StatCard
          title="Rang Annuel"
          icon={<Trophy className="h-4 w-4 text-muted-foreground" />}
          value={fullStats?.yearlyRank ? `#${fullStats.yearlyRank}` : "-"}
        />
      </div>

      {/* Tabs */}
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

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Informations personnelles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Nom complet</p>
                    <p className="font-medium">{displayName}</p>
                  </div>
                </div>
                {user.username && (
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Pseudo</p>
                      <p className="font-medium">@{user.username}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{user.email || "-"}</p>
                  </div>
                </div>
                {user.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Téléphone</p>
                      <p className="font-medium">{user.phone}</p>
                    </div>
                  </div>
                )}
                {user.birthdate && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Date de naissance</p>
                      <p className="font-medium">{formatDate(user.birthdate)}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Membre depuis</p>
                    <p className="font-medium">{formatDate(user.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <IdCard className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Photo d&apos;identification</p>
                    {user.identityPhotoUrl ? (
                      <img
                        src={user.identityPhotoUrl}
                        alt="Photo d'identification"
                        className="mt-2 h-32 w-32 rounded-lg object-cover border"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Non fournie</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Statut et cashback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Award className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Role</p>
                    <div className="mt-1">{getRoleBadge(user.role)}</div>
                  </div>
                </div>
                {user.attachedEstablishmentId && (
                  <div className="flex items-center gap-3">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Établissement de reference</p>
                      <p className="font-medium">{getEstablishmentName(user.attachedEstablishmentId)}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Cashback gagne</p>
                    <p className="font-medium">{formatCurrency(fullStats?.cashbackEarned || 0)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Coins className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Cashback depense</p>
                    <p className="font-medium">{formatCurrency(fullStats?.cashbackSpent || 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="hidden text-lg font-semibold sm:block">Activité</h2>
            <PeriodSelector
              defaultPreset="all_time"
              onPeriodChange={setActivityPeriod}
            />
          </div>

          {loadingActivity ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activityStats ? (
            <>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
                <StatCard
                  title="Commandes"
                  icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />}
                  value={activityStats.ordersCount}
                />
                <StatCard
                  title="Dépensé (EUR)"
                  icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
                  value={formatCurrency(activityStats.totalSpentEuros)}
                />
                <StatCard
                  title="XP Gagné"
                  icon={<Zap className="h-4 w-4 text-muted-foreground" />}
                  value={activityStats.xpEarned.toLocaleString()}
                />
                <StatCard
                  title="Cashback Gagné"
                  icon={<PiggyBank className="h-4 w-4 text-muted-foreground" />}
                  value={formatCurrency(activityStats.cashbackEarned)}
                  subtitle={`${formatCurrency(activityStats.cashbackEarnedOrganic)} organique · ${formatCurrency(activityStats.cashbackEarnedRewards)} récompenses`}
                />
                <StatCard
                  title="Cashback Dépensé"
                  icon={<ArrowDownCircle className="h-4 w-4 text-muted-foreground" />}
                  value={formatCurrency(activityStats.cashbackSpent)}
                />
              </div>

              {dailyCashback.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Cashback gagné vs dépensé</CardTitle>
                    <CardDescription>Évolution sur la période sélectionnée</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={dailyCashback}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v: string) => {
                            const d = new Date(v);
                            return `${d.getDate()}/${d.getMonth() + 1}`;
                          }}
                          className="text-xs"
                        />
                        <YAxis
                          tickFormatter={(v: number) => `${(v / 100).toFixed(0)}€`}
                          className="text-xs"
                        />
                        <Tooltip
                          formatter={(value: number, name: string) => {
                            const labels: Record<string, string> = {
                              earnedOrganic: "Gagné (organique)",
                              earnedRewards: "Gagné (récompenses)",
                              spent: "Dépensé",
                            };
                            return [formatCurrency(value), labels[name] || name];
                          }}
                          labelFormatter={(label: string) => {
                            const d = new Date(label);
                            return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
                          }}
                        />
                        <Legend
                          formatter={(value: string) => {
                            const labels: Record<string, string> = {
                              earnedOrganic: "Organique",
                              earnedRewards: "Récompenses",
                              spent: "Dépensé",
                            };
                            return labels[value] || value;
                          }}
                        />
                        <Bar dataKey="earnedOrganic" stackId="earned" fill="#16a34a" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="earnedRewards" stackId="earned" fill="#4ade80" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="spent" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}

          {/* Quest Progress */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Quêtes
                  </CardTitle>
                  <CardDescription>
                    {questProgressTotal} quête{questProgressTotal > 1 ? "s" : ""} au total
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={questPeriodTypeFilter}
                    onValueChange={(value) => {
                      setQuestPeriodTypeFilter(value);
                      setQuestProgressPage(0);
                    }}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Période" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes</SelectItem>
                      <SelectItem value="weekly">Hebdomadaire</SelectItem>
                      <SelectItem value="monthly">Mensuelle</SelectItem>
                      <SelectItem value="yearly">Annuelle</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={questStatusFilter}
                    onValueChange={(value) => {
                      setQuestStatusFilter(value);
                      setQuestProgressPage(0);
                    }}
                  >
                    <SelectTrigger className="w-[170px]">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="in_progress">En cours</SelectItem>
                      <SelectItem value="completed">Complétée</SelectItem>
                      <SelectItem value="rewarded">Récompensée</SelectItem>
                      <SelectItem value="expired">Expirée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingQuestProgress ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : questProgress.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  Aucune quête pour cet utilisateur
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quête</TableHead>
                        <TableHead>Période</TableHead>
                        <TableHead>Progression</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Complétée le</TableHead>
                        <TableHead>Mise à jour</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {questProgress.map((qp) => {
                        const pct = qp.target_value > 0
                          ? Math.min(Math.round((qp.current_value / qp.target_value) * 100), 100)
                          : 0;
                        const questType = qp.quest?.quest_type;
                        const isAmountSpent = questType === "amount_spent";
                        const currentDisplay = isAmountSpent
                          ? formatCurrency(qp.current_value)
                          : qp.current_value.toLocaleString();
                        const targetDisplay = isAmountSpent
                          ? formatCurrency(qp.target_value)
                          : qp.target_value.toLocaleString();
                        const unitLabel = !isAmountSpent
                          ? questType === "xp_earned" ? " XP"
                            : questType === "cashback_earned" ? " PdB"
                            : questType === "establishments_visited" ? " établ."
                            : questType === "orders_count" ? " cmd" : ""
                          : "";

                        return (
                          <TableRow key={qp.id}>
                            <TableCell>
                              {qp.quest ? (
                                <Link
                                  href={`/quests/${qp.quest.id}`}
                                  className="font-medium hover:underline"
                                >
                                  {qp.quest.name}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground">Quête #{qp.quest_id}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{qp.period_identifier}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-24 shrink-0">
                                  <div className="h-2 w-full rounded-full bg-muted">
                                    <div
                                      className={`h-2 rounded-full transition-all ${questProgressBarColors[qp.status] || "bg-primary"}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                                <span className="text-sm whitespace-nowrap">
                                  {currentDisplay}/{targetDisplay}{unitLabel} ({pct}%)
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={questStatusVariants[qp.status] || ""}
                              >
                                {questStatusLabels[qp.status] || qp.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {qp.completed_at ? formatDateTime(qp.completed_at) : (
                                <span>&mdash;</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDateTime(qp.updated_at)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {questProgressPages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Page {questProgressPage + 1} sur {questProgressPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={questProgressPage === 0}
                          onClick={() => setQuestProgressPage(questProgressPage - 1)}
                        >
                          Précédent
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={questProgressPage >= questProgressPages - 1}
                          onClick={() => setQuestProgressPage(questProgressPage + 1)}
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
        </TabsContent>

        {/* Gains Tab */}
        <TabsContent value="gains">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Gains de l’utilisateur</CardTitle>
                  <CardDescription>
                    {gainsTotal} gain{gainsTotal > 1 ? "s" : ""} au total
                  </CardDescription>
                </div>
                <Select
                  value={gainsSourceFilter}
                  onValueChange={(value) => {
                    setGainsSourceFilter(value);
                    setGainsPage(0);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrer par source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les sources</SelectItem>
                    <SelectItem value="receipt">Ticket</SelectItem>
                    <SelectItem value="bonus_cashback_manual">Bonus manuel</SelectItem>
                    <SelectItem value="bonus_cashback_leaderboard">Classement</SelectItem>
                    <SelectItem value="bonus_cashback_quest">Quête</SelectItem>
                    <SelectItem value="bonus_cashback_trigger">Trigger</SelectItem>
                    <SelectItem value="bonus_cashback_migration">Migration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loadingGains ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : gains.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  Aucun gain pour cet utilisateur
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>XP</TableHead>
                        <TableHead>Cashback</TableHead>
                        <TableHead>Établissement</TableHead>
                        <TableHead>Période</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gains.map((gain) => (
                        <TableRow key={gain.id}>
                          <TableCell className="font-mono text-sm">#G{gain.id}</TableCell>
                          <TableCell>
                            {gain.source_type ? (
                              <Badge
                                variant={gain.source_type === "receipt" ? "default" : "secondary"}
                                className={
                                  gain.source_type !== "receipt"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : undefined
                                }
                              >
                                {sourceTypeLabels[gain.source_type] || gain.source_type}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">&mdash;</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {gain.xp != null && gain.xp > 0 ? (
                              <span className="font-medium">{gain.xp.toLocaleString()} XP</span>
                            ) : (
                              <span className="text-muted-foreground">&mdash;</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {gain.cashback_money != null && gain.cashback_money > 0 ? (
                              <span className="font-medium">{formatCurrency(gain.cashback_money)}</span>
                            ) : (
                              <span className="text-muted-foreground">&mdash;</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {gain.establishment?.title || (
                              <span className="text-muted-foreground">&mdash;</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {gain.period_identifier || (
                              <span className="text-muted-foreground">&mdash;</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateTime(gain.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {gainsPages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Page {gainsPage + 1} sur {gainsPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={gainsPage === 0}
                          onClick={() => setGainsPage(gainsPage - 1)}
                        >
                          Précédent
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={gainsPage >= gainsPages - 1}
                          onClick={() => setGainsPage(gainsPage + 1)}
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
        </TabsContent>

        {/* Coupons Tab */}
        <TabsContent value="coupons">
          <Card>
            <CardHeader>
              <CardTitle>Coupons de l’utilisateur</CardTitle>
              <CardDescription>
                {couponsTotal} coupon{couponsTotal > 1 ? "s" : ""} au total
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCoupons ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : coupons.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  Aucun coupon pour cet utilisateur
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Valeur</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Expiration</TableHead>
                        <TableHead>Créé le</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coupons.map((coupon) => (
                        <TableRow key={coupon.id}>
                          <TableCell className="font-mono text-sm">#{coupon.id}</TableCell>
                          <TableCell>
                            {coupon.amount ? (
                              <Badge variant="default">{formatCurrency(coupon.amount)}</Badge>
                            ) : coupon.percentage ? (
                              <Badge variant="secondary">{formatPercentage(coupon.percentage)}</Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {coupon.coupon_templates?.name || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {coupon.distribution_type === "manual" && "Manuel"}
                            {coupon.distribution_type?.startsWith("leaderboard") && "Leaderboard"}
                            {coupon.distribution_type === "trigger_legacy" && "Legacy"}
                            {!coupon.distribution_type && "-"}
                          </TableCell>
                          <TableCell>
                            {coupon.used ? (
                              <Badge variant="secondary">Utilisé</Badge>
                            ) : isExpired(coupon.expires_at) ? (
                              <Badge variant="destructive">Expire</Badge>
                            ) : (
                              <Badge variant="success">Actif</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {coupon.expires_at ? formatDate(coupon.expires_at) : "Sans expiration"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(coupon.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {couponsPages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Page {couponsPage + 1} sur {couponsPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={couponsPage === 0}
                          onClick={() => setCouponsPage(couponsPage - 1)}
                        >
                          Précédent
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={couponsPage >= couponsPages - 1}
                          onClick={() => setCouponsPage(couponsPage + 1)}
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
        </TabsContent>

        {/* Receipts Tab */}
        <TabsContent value="receipts">
          <Card>
            <CardHeader>
              <CardTitle>Tickets de l’utilisateur</CardTitle>
              <CardDescription>
                {receiptsTotal} ticket{receiptsTotal > 1 ? "s" : ""} au total
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingReceipts ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : receipts.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  Aucun ticket pour cet utilisateur
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Établissement</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Paiement</TableHead>
                        <TableHead>Consommations</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receipts.map((receipt) => {
                        const dominantMethod =
                          receipt.receipt_lines && receipt.receipt_lines.length > 0
                            ? receipt.receipt_lines.reduce((max, line) =>
                                line.amount > max.amount ? line : max
                              ).payment_method
                            : null;
                        const amountConfig = dominantMethod
                          ? getPaymentMethodConfig(dominantMethod)
                          : null;
                        return (
                        <TableRow key={receipt.id}>
                          <TableCell className="font-mono text-sm">#{receipt.id}</TableCell>
                          <TableCell>
                            {receipt.establishment?.title || `Établissement #${receipt.establishment_id}`}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn("font-semibold", amountConfig?.badgeClass)}
                            >
                              {formatCurrency(receipt.amount)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {receipt.receipt_lines && receipt.receipt_lines.length > 0 ? (
                                [...new Set(receipt.receipt_lines.map((line) => line.payment_method))].map(
                                  (method) => {
                                    const config = getPaymentMethodConfig(method);
                                    return (
                                      <Badge
                                        key={method}
                                        variant="outline"
                                        className={cn("flex items-center gap-1", config.badgeClass)}
                                      >
                                        {config.icon}
                                        {config.label}
                                      </Badge>
                                    );
                                  }
                                )
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {receipt.receipt_consumption_items && receipt.receipt_consumption_items.length > 0 ? (
                                receipt.receipt_consumption_items.map((item) => (
                                  <Badge key={item.id} variant="outline">
                                    {item.quantity}x {consumptionTypeLabels[item.consumption_type] || item.consumption_type}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateTime(receipt.created_at)}
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {receiptsPages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Page {receiptsPage + 1} sur {receiptsPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={receiptsPage === 0}
                          onClick={() => setReceiptsPage(receiptsPage - 1)}
                        >
                          Précédent
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={receiptsPage >= receiptsPages - 1}
                          onClick={() => setReceiptsPage(receiptsPage + 1)}
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
        </TabsContent>

        {/* Edit Tab */}
        <TabsContent value="edit">
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
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="employee">Employé</SelectItem>
                      <SelectItem value="establishment">Établissement</SelectItem>
                      <SelectItem value="admin">Administrateur</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    Role actuel : {getRoleBadge(form.role)}
                  </div>
                </div>

                {(form.role === "employee" || form.role === "establishment") && (
                  <div className="space-y-2">
                    <Label htmlFor="attachedEstablishment">Établissement de reference</Label>
                    <Select
                      value={form.attachedEstablishmentId}
                      onValueChange={(value) =>
                        setForm({
                          ...form,
                          attachedEstablishmentId: value === "none" ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un établissement" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun établissement</SelectItem>
                        {establishments.map((establishment) => (
                          <SelectItem key={establishment.id} value={establishment.id.toString()}>
                            {establishment.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Établissement de reference de cet employe/gérant
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-4 pt-4">
                  <Button type="submit" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                  <Button variant="destructive" disabled={anonymizing || !!user.deletedAt}>
                    {anonymizing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                      onClick={async () => {
                        try {
                          setAnonymizing(true);
                          await anonymizeUser(userId);
                          toast({
                            title: "Compte supprime",
                            description: "Le profil a ete anonymise avec succes",
                          });
                          // Reload user data
                          const refreshed = await getUserWithStats(userId);
                          if (refreshed) {
                            setUser({
                              id: refreshed.id,
                              firstName: refreshed.first_name || "",
                              lastName: refreshed.last_name || "",
                              email: refreshed.email || "",
                              phone: refreshed.phone,
                              birthdate: refreshed.birthdate,
                              username: refreshed.username,
                              avatarUrl: refreshed.avatar_url,
                              identityPhotoUrl: refreshed.identity_photo_url,
                              role: refreshed.role,
                              xpCoefficient: refreshed.xp_coefficient || 1,
                              cashbackCoefficient: refreshed.cashback_coefficient || 1,
                              attachedEstablishmentId: refreshed.attached_establishment_id,
                              createdAt: refreshed.created_at,
                              deletedAt: refreshed.deleted_at || null,
                            });
                          }
                        } catch {
                          toast({
                            title: "Erreur",
                            description: "Impossible de supprimer le compte",
                            variant: "destructive",
                          });
                        } finally {
                          setAnonymizing(false);
                        }
                      }}
                    >
                      Confirmer la suppression
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
