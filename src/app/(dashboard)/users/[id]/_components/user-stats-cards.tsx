import { Coins, Receipt, Star, Ticket, TrendingUp, Trophy } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { formatCurrency } from "@/lib/utils";
import type { UserFullStats, UserHeaderStats } from "./types";

interface UserStatsCardsProps {
  stats: UserHeaderStats;
  fullStats: UserFullStats | null;
}

export function UserStatsCards({ stats, fullStats }: UserStatsCardsProps) {
  return (
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
  );
}
