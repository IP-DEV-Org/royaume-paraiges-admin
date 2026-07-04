import { createClient } from "@/lib/supabase/client";
import {
  redirectLinkSchema,
  redirectLinkUpdateSchema,
  type RedirectLinkInput,
  type RedirectLinkUpdateInput,
} from "@/lib/schemas/redirectLink.schema";
import type {
  RedirectClick,
  RedirectLink,
  RedirectLinkWithStats,
} from "@/types/database";

/** Base publique des liens courts (projet url-rooting-app sur Vercel). */
export const REDIRECT_BASE_URL = "https://redirect.auxparaiges.fr";

export function buildShortUrl(slug: string): string {
  return `${REDIRECT_BASE_URL}/${slug}`;
}

export async function getRedirectLinks(): Promise<RedirectLinkWithStats[]> {
  const supabase = createClient();
  const linksRes = await supabase
    .from("redirect_links")
    .select("*")
    .order("created_at", { ascending: false });
  if (linksRes.error) throw linksRes.error;
  const statsRes = await supabase.from("redirect_link_stats").select("*");
  if (statsRes.error) throw statsRes.error;

  const statsRows = (statsRes.data ?? []) as unknown as {
    link_id: string;
    total_clicks: number | null;
    last_click_at: string | null;
  }[];
  const stats = new Map(statsRows.map((s) => [s.link_id, s]));
  const links = (linksRes.data ?? []) as unknown as RedirectLink[];
  return links.map((link) => {
    const s = stats.get(link.id);
    return {
      ...link,
      total_clicks: Number(s?.total_clicks ?? 0),
      last_click_at: s?.last_click_at ?? null,
    };
  });
}

export async function getRedirectLink(id: string): Promise<RedirectLink> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("redirect_links")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as RedirectLink;
}

/**
 * Clics d'un lien depuis `sinceIso` (bornes UTC). Fetch paginé par batches de
 * 1000 (limite PostgREST) — l'agrégation par jour/appareil se fait côté UI.
 */
export async function getRedirectClicks(
  linkId: string,
  sinceIso: string,
): Promise<Pick<RedirectClick, "clicked_at" | "device_type">[]> {
  const supabase = createClient();
  const BATCH = 1000;
  const clicks: Pick<RedirectClick, "clicked_at" | "device_type">[] = [];
  for (let from = 0; ; from += BATCH) {
    const { data, error } = await supabase
      .from("redirect_clicks")
      .select("clicked_at, device_type")
      .eq("link_id", linkId)
      .gte("clicked_at", sinceIso)
      .order("clicked_at", { ascending: true })
      .range(from, from + BATCH - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as Pick<
      RedirectClick,
      "clicked_at" | "device_type"
    >[];
    clicks.push(...rows);
    if (!data || data.length < BATCH) break;
  }
  return clicks;
}

/** Total de clics all-time d'un lien (count serveur, aucune ligne rapatriée). */
export async function countRedirectClicks(linkId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("redirect_clicks")
    .select("*", { count: "exact", head: true })
    .eq("link_id", linkId);
  if (error) throw error;
  return count ?? 0;
}

export async function createRedirectLink(
  input: RedirectLinkInput,
): Promise<RedirectLink> {
  const payload = redirectLinkSchema.parse(input);
  const supabase = createClient();
  const { data, error } = await (supabase.from("redirect_links") as any)
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as RedirectLink;
}

export async function updateRedirectLink(
  id: string,
  input: RedirectLinkUpdateInput,
): Promise<RedirectLink> {
  const payload = redirectLinkUpdateSchema.parse(input);
  const supabase = createClient();
  const { data, error } = await (supabase.from("redirect_links") as any)
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as RedirectLink;
}

/** Supprime le lien ET son historique de clics (FK ON DELETE CASCADE). */
export async function deleteRedirectLink(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await (supabase.from("redirect_links") as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}
