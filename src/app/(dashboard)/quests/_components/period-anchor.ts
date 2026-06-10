import type { PeriodType } from "@/types/database";

const MONTHS_SHORT = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc",
];

/** Libellé court d'une période pour la frise (ex. "S22", "Mai", "2026"). */
export function shortPeriodLabel(type: PeriodType, id: string): string {
  if (type === "weekly") {
    const m = id.match(/W(\d{2})$/);
    return m && m[1] ? `S${parseInt(m[1])}` : id;
  }
  if (type === "monthly") {
    const m = id.match(/-(\d{2})$/);
    return m && m[1] ? MONTHS_SHORT[parseInt(m[1]) - 1] ?? id : id;
  }
  return id;
}

/** Jeudi (milieu ISO) de la semaine "YYYY-Www" — détermine sans ambiguïté son mois/année. */
function isoWeekThursday(id: string): Date | null {
  const m = id.match(/^(\d{4})-W(\d{2})$/);
  if (!m || !m[1] || !m[2]) return null;
  const isoYear = parseInt(m[1]);
  const week = parseInt(m[2]);
  const jan4 = new Date(isoYear, 0, 4); // le 4 janvier ∈ semaine ISO 1
  const jan4Day = (jan4.getDay() + 6) % 7; // lundi=0 … dimanche=6
  const week1Monday = new Date(isoYear, 0, 4 - jan4Day);
  const thursday = new Date(week1Monday);
  thursday.setDate(week1Monday.getDate() + (week - 1) * 7 + 3);
  return thursday;
}

/**
 * Convertit la période cliquée en date pivot (anchor). Les 3 frises (semaine /
 * mois / année) dérivent toutes de cet anchor → elles restent toujours alignées.
 * On préserve la sélection plus fine quand elle reste cohérente (changer d'année
 * garde le mois, changer de mois garde la semaine si elle y tombe déjà).
 */
export function periodToAnchor(type: PeriodType, id: string, prev: Date): Date {
  if (type === "weekly") {
    return isoWeekThursday(id) ?? prev;
  }
  if (type === "monthly") {
    const m = id.match(/^(\d{4})-(\d{2})$/);
    if (!m || !m[1] || !m[2]) return prev;
    const year = parseInt(m[1]);
    const month = parseInt(m[2]) - 1;
    if (prev.getFullYear() === year && prev.getMonth() === month) return prev;
    return new Date(year, month, 15); // mi-mois : semaine non ambiguë
  }
  // yearly
  const year = parseInt(id);
  if (isNaN(year)) return prev;
  if (prev.getFullYear() === year) return prev;
  return new Date(year, prev.getMonth(), Math.min(prev.getDate(), 28));
}
