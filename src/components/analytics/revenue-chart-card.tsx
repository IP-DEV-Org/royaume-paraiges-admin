"use client";

import { useState } from "react";
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
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn, formatCurrency } from "@/lib/utils";
import { Info } from "lucide-react";
import type { DailyRevenue } from "@/lib/services/analyticsService";

const SERIES = [
  { key: "cashpad", label: "Cashpad", color: "#b8864b" },
  { key: "pdbSpent", label: "PdB dépensés", color: "#5a0f1a" },
] as const;

interface RevenueChartCardProps {
  data: DailyRevenue[];
}

export function RevenueChartCard({ data }: RevenueChartCardProps) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const chartData = data.map((d) => ({
    date: d.date,
    cashpad: d.card + d.cash,
    pdbSpent: d.pdbSpent,
  }));

  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-base">Détail quotidien</CardTitle>
          <ChartTooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 hover:text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px] text-xs">
              Cashpad = paiements carte + espèces par jour. PdB dépensés = cashback utilisé en paiement par jour. Source : receipts + receipt_lines.
            </TooltipContent>
          </ChartTooltip>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            Aucune donnée sur cette période
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {SERIES.map((series) => {
                const isHidden = hiddenSeries.has(series.key);
                return (
                  <button
                    key={series.key}
                    onClick={() => toggleSeries(series.key)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm transition-colors",
                      isHidden
                        ? "text-muted-foreground opacity-50"
                        : "font-medium"
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: isHidden ? "#a1a1aa" : series.color,
                      }}
                    />
                    {series.label}
                  </button>
                );
              })}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => {
                    const [, m, day] = d.split("-");
                    return `${day}/${m}`;
                  }}
                  fontSize={12}
                />
                <YAxis
                  tickFormatter={(v: number) => formatCurrency(v)}
                  fontSize={12}
                  width={80}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label: string) => {
                    const [y, m, d] = label.split("-");
                    return `${d}/${m}/${y}`;
                  }}
                />
                {!hiddenSeries.has("cashpad") && (
                  <Area
                    type="monotone"
                    dataKey="cashpad"
                    name="Cashpad"
                    stroke="#b8864b"
                    fill="#b8864b"
                    fillOpacity={0.2}
                  />
                )}
                {!hiddenSeries.has("pdbSpent") && (
                  <Area
                    type="monotone"
                    dataKey="pdbSpent"
                    name="PdB dépensés"
                    stroke="#5a0f1a"
                    fill="#5a0f1a"
                    fillOpacity={0.2}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}
