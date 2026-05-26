"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip as ChartTooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { Info } from "lucide-react";
import type { DebtsData } from "@/lib/services/analyticsService";

const COLORS = {
  organic: "#b8864b",
  rewards: "#d9a964",
  bonusCoupons: "#5a0f1a",
};

interface DebtsDonutCardProps {
  debts: DebtsData;
}

export function DebtsDonutCard({ debts }: DebtsDonutCardProps) {
  const pieData = [
    { name: "Organiques", value: debts.pdbOrganic },
    { name: "Récompenses", value: debts.pdbRewards },
    { name: "Bonus Coupons", value: debts.pdbBonusCoupons },
  ].filter((d) => d.value > 0);
  const pieTotal = pieData.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-base">Répartition des dettes PdB</CardTitle>
          <ChartTooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 hover:text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px] text-xs">
              Organiques = cashback sur dépenses €. Récompenses = PdB quêtes + leaderboard. Bonus Coupons = PdB crédités via coupons montant fixe.
            </TooltipContent>
          </ChartTooltip>
        </div>
      </CardHeader>
      <CardContent>
        {pieTotal === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            Aucune donnée sur cette période
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                label={({
                  cx,
                  cy,
                  midAngle,
                  outerRadius: or,
                  value,
                  fill,
                }: {
                  cx: number;
                  cy: number;
                  midAngle: number;
                  outerRadius: number;
                  value: number;
                  fill: string;
                }) => {
                  const RADIAN = Math.PI / 180;
                  const radius = or + 20;
                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                  const y = cy + radius * Math.sin(-midAngle * RADIAN);
                  const pct = ((value / pieTotal) * 100).toFixed(1);
                  return (
                    <text
                      x={x}
                      y={y}
                      textAnchor={x > cx ? "start" : "end"}
                      dominantBaseline="central"
                      fill={fill}
                      fontWeight="bold"
                      fontSize={13}
                    >
                      {pct}%
                    </text>
                  );
                }}
                labelLine={false}
              >
                <Cell fill={COLORS.organic} />
                <Cell fill={COLORS.rewards} />
                <Cell fill={COLORS.bonusCoupons} />
              </Pie>
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend
                formatter={(value: string) => (
                  <span className="text-sm">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
