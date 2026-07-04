"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { MousePointerClick } from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getRedirectClicks,
  countRedirectClicks,
} from "@/lib/services/redirectLinkService";
import { redirectLinkKeys } from "@/lib/queries/keys";
import type { RedirectDeviceType } from "@/types/database";

const DAYS = 30;

const DEVICE_META: Record<RedirectDeviceType, { label: string; color: string }> = {
  ios: { label: "iOS", color: "#6366f1" },
  android: { label: "Android", color: "#16a34a" },
  desktop: { label: "Ordinateur", color: "#f59e0b" },
  other: { label: "Autre", color: "#94a3b8" },
};
const DEVICE_ORDER: RedirectDeviceType[] = ["ios", "android", "desktop", "other"];

type DayBucket = { date: string; label: string } & Record<RedirectDeviceType, number>;

function StatCell({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      {value === undefined ? (
        <div className="mt-1 h-8 w-16 animate-pulse rounded bg-muted" />
      ) : (
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      )}
    </div>
  );
}

/** Compteurs + graphique des clics des 30 derniers jours, empilés par appareil. */
export function LinkStats({ linkId }: { linkId: string }) {
  const since = useMemo(
    () => subDays(new Date(new Date().setHours(0, 0, 0, 0)), DAYS - 1),
    [],
  );

  const clicksQuery = useQuery({
    queryKey: redirectLinkKeys.clicks(linkId, DAYS),
    queryFn: () => getRedirectClicks(linkId, since.toISOString()),
  });

  const totalQuery = useQuery({
    queryKey: [...redirectLinkKeys.detail(linkId), "totalClicks"],
    queryFn: () => countRedirectClicks(linkId),
  });

  const clicksData = clicksQuery.data;

  const { days, count7d, count30d, deviceTotals } = useMemo(() => {
    const clicks = clicksData ?? [];
    const buckets = new Map<string, DayBucket>();
    for (let i = 0; i < DAYS; i++) {
      const d = subDays(new Date(), DAYS - 1 - i);
      const key = format(d, "yyyy-MM-dd");
      buckets.set(key, {
        date: key,
        label: format(d, "d MMM", { locale: fr }),
        ios: 0,
        android: 0,
        desktop: 0,
        other: 0,
      });
    }
    const totals: Record<RedirectDeviceType, number> = {
      ios: 0,
      android: 0,
      desktop: 0,
      other: 0,
    };
    const sevenDaysAgo = subDays(new Date(), 7);
    let last7 = 0;
    for (const click of clicks) {
      const clickedAt = new Date(click.clicked_at);
      const device = (click.device_type as RedirectDeviceType) ?? "other";
      const bucket = buckets.get(format(clickedAt, "yyyy-MM-dd"));
      if (bucket) bucket[device] += 1;
      totals[device] += 1;
      if (clickedAt >= sevenDaysAgo) last7 += 1;
    }
    return {
      days: Array.from(buckets.values()),
      count7d: last7,
      count30d: clicks.length,
      deviceTotals: totals,
    };
  }, [clicksData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Statistiques</CardTitle>
        <CardDescription>
          Visites enregistrées au moment de la redirection.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <StatCell label="Total" value={totalQuery.data} />
          <StatCell
            label="7 derniers jours"
            value={clicksQuery.isLoading ? undefined : count7d}
          />
          <StatCell
            label="30 derniers jours"
            value={clicksQuery.isLoading ? undefined : count30d}
          />
        </div>

        {clicksQuery.isLoading ? (
          <div className="h-[260px] animate-pulse rounded-lg bg-muted" />
        ) : count30d === 0 ? (
          <EmptyState
            icon={MousePointerClick}
            title="Aucun clic sur les 30 derniers jours"
            description="Les visites apparaîtront ici dès que le lien sera utilisé."
          />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={days}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    value,
                    DEVICE_META[name as RedirectDeviceType]?.label ?? name,
                  ]}
                />
                {DEVICE_ORDER.map((device, i) => (
                  <Bar
                    key={device}
                    dataKey={device}
                    stackId="clicks"
                    fill={DEVICE_META[device].color}
                    radius={i === DEVICE_ORDER.length - 1 ? [3, 3, 0, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {DEVICE_ORDER.map((device) => (
                <div key={device} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: DEVICE_META[device].color }}
                    aria-hidden="true"
                  />
                  <span className="text-muted-foreground">
                    {DEVICE_META[device].label}
                  </span>
                  <span className="font-medium tabular-nums">
                    {deviceTotals[device]}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
