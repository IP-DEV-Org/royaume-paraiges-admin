"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
import type { XpWeeklyTotal } from "@/lib/services/analyticsService";

// Cumul d'XP gagné sur l'année en cours (une valeur par semaine ISO) + projection
// linéaire jusqu'à fin d'année (rythme moyen hebdo observé depuis le 1er janvier).
// Une couleur par série (utilisateur) : plein = réel, pointillé = projeté.
// Palette catégorielle validée light + dark (CVD ≥ 12, contraste ≥ 3:1) ; la
// couleur suit l'utilisateur (slot attribué au cochage, conservé au décochage
// des autres), jamais réattribuée en fonction du rang.
export const SERIES_PALETTE = [
  "#6366f1",
  "#d97706",
  "#0d9488",
  "#db2777",
  "#16a34a",
  "#7c3aed",
] as const;

/** Nombre max d'utilisateurs affichables simultanément sur le graphique. */
export const MAX_CHART_SERIES = SERIES_PALETTE.length;

export interface XpProjectionSeries {
  /** customer_id, ou "all" pour la courbe globale. */
  key: string;
  /** Pseudo affiché en légende / infobulle. */
  label: string;
  color: string;
  weekly: XpWeeklyTotal[];
}

/** Lundi (YYYY-MM-DD) de la semaine ISO contenant la date donnée. */
function mondayOf(dayISO: string): string {
  const d = new Date(`${dayISO}T00:00:00Z`);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
}

/** Numéro de semaine ISO ("S27") de la date donnée. */
function isoWeekLabel(dayISO: string): string {
  const d = new Date(`${dayISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
  );
  return `S${weekNum}`;
}

const formatXp = (xp: number) => `${Math.round(xp).toLocaleString("fr-FR")} XP`;

function formatYTick(v: number): string {
  if (v >= 1000) {
    const k = v / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)} k`;
  }
  return String(v);
}

const actualKey = (key: string) => `a_${key}`;
const projectedKey = (key: string) => `p_${key}`;

interface XpProjectionChartProps {
  series: XpProjectionSeries[];
  year: number;
  loading: boolean;
}

export function XpProjectionChart({ series, year, loading }: XpProjectionChartProps) {
  const { data, monthTicks, singleProjectedTotal } = useMemo(() => {
    // Toutes les semaines ISO couvrant l'année : du lundi de la semaine du
    // 1er janvier au lundi de la semaine du 31 décembre.
    const weeks: string[] = [];
    const cursor = new Date(`${mondayOf(`${year}-01-01`)}T00:00:00Z`);
    const lastMonday = mondayOf(`${year}-12-31`);
    while (true) {
      const iso = cursor.toISOString().slice(0, 10);
      weeks.push(iso);
      if (iso >= lastMonday) break;
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }

    const currentMonday = mondayOf(new Date().toISOString().slice(0, 10));
    const points: Record<string, string | number | null>[] = weeks.map(
      (week_start) => ({ week_start })
    );

    let lastTotal = 0;
    for (const s of series) {
      const totals = new Map(s.weekly.map((w) => [w.week_start, w.xp]));
      const aKey = actualKey(s.key);
      const pKey = projectedKey(s.key);

      // Cumul réel jusqu'à la semaine courante incluse.
      let cumul = 0;
      let currentIdx = -1;
      for (let i = 0; i < weeks.length; i++) {
        const week = weeks[i]!;
        if (week <= currentMonday) {
          cumul += totals.get(week) || 0;
          currentIdx = i;
          points[i]![aKey] = cumul;
        } else {
          points[i]![aKey] = null;
        }
        points[i]![pKey] = null;
      }

      // Projection linéaire : rythme moyen hebdo observé × semaines restantes.
      // Le point de jonction (semaine courante) porte les deux séries.
      lastTotal = cumul;
      if (currentIdx >= 0) {
        const rate = cumul / (currentIdx + 1);
        points[currentIdx]![pKey] = cumul;
        for (let i = currentIdx + 1; i < weeks.length; i++) {
          points[i]![pKey] = Math.round(cumul + rate * (i - currentIdx));
        }
        lastTotal =
          (points[points.length - 1]![pKey] as number | null) ?? cumul;
      }
    }

    // Ticks de l'axe X : première semaine de chaque mois (l'infobulle porte le
    // détail semaine).
    const ticks: string[] = [];
    let prevMonth = "";
    for (const week of weeks) {
      const month = week.slice(0, 7);
      if (month !== prevMonth && week.slice(0, 4) === String(year)) {
        ticks.push(week);
        prevMonth = month;
      }
    }

    return {
      data: points,
      monthTicks: ticks,
      singleProjectedTotal: series.length === 1 ? lastTotal : 0,
    };
  }, [series, year]);

  const labelByDataKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of series) {
      map.set(actualKey(s.key), s.label);
      map.set(projectedKey(s.key), `${s.label} (projection)`);
    }
    return map;
  }, [series]);

  const isGlobal = series.length === 1 && series[0]?.key === "all";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Projection XP {year}</CardTitle>
        <CardDescription>
          {isGlobal ? (
            <>
              Cumul des XP gagnés par semaine (tous utilisateurs), prolongé en
              pointillés jusqu&apos;à fin décembre au rythme moyen observé
              {!loading && singleProjectedTotal > 0 && (
                <> — fin d&apos;année projetée : ~{formatXp(singleProjectedTotal)}</>
              )}
              . Coche des utilisateurs dans le tableau pour comparer leurs
              courbes.
            </>
          ) : (
            <>
              Cumul des XP gagnés par semaine pour les utilisateurs cochés dans
              le tableau, prolongé en pointillés jusqu&apos;à fin décembre au
              rythme moyen de chacun.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[300px] animate-pulse rounded bg-muted/50" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="week_start"
                ticks={monthTicks}
                tickFormatter={(v: string) =>
                  new Date(`${v}T00:00:00Z`).toLocaleDateString("fr-FR", {
                    month: "short",
                  })
                }
                className="text-xs"
              />
              <YAxis
                tickFormatter={formatYTick}
                className="text-xs"
                width={48}
                domain={[0, "auto"]}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatXp(value),
                  labelByDataKey.get(name) ?? name,
                ]}
                labelFormatter={(label: string) =>
                  `${isoWeekLabel(label)} · semaine du ${new Date(
                    `${label}T00:00:00Z`
                  ).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`
                }
              />
              {!isGlobal && (
                <Legend
                  formatter={(value: string) => labelByDataKey.get(value) ?? value}
                />
              )}
              {series.map((s) => (
                <Line
                  key={actualKey(s.key)}
                  dataKey={actualKey(s.key)}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
              {series.map((s) => (
                <Line
                  key={projectedKey(s.key)}
                  dataKey={projectedKey(s.key)}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={{ r: 4 }}
                  legendType="none"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
