/**
 * Service de contenu - Donnees Supabase
 *
 * Ce service fournit les donnees de contenu (bieres, etablissements, brasseries, styles)
 * stockees dans Supabase.
 *
 * Les images sont servies depuis Supabase Storage (bucket: content-assets).
 */

import { createClient } from "@/lib/supabase/client";
import type {
  BeerUpdate as BeerUpdateType,
  EstablishmentUpdate as EstablishmentUpdateType,
} from "@/types/database";

// Types pour le contenu
export interface Establishment {
  id: number;
  title: string;
  line_address_1: string | null;
  line_address_2: string | null;
  zipcode: string | null;
  city: string | null;
  country: string | null;
  short_description: string | null;
  description: string | null;
  featured_image: string | null;
  anniversary: string | null;
  logo: string | null;
  created_at: string;
}

export interface Brewery {
  id: number;
  title: string;
  country: string | null;
  created_at: string;
}

export interface BeerStyle {
  id: number;
  title: string;
  description: string | null;
  created_at: string;
}

export interface Beer {
  id: number;
  title: string;
  description: string | null;
  featured_image: string | null;
  ibu: number | null;
  abv: number | null;
  brewery_id: number | null;
  created_at: string;
  // Relation chargee
  breweries?: Brewery | null;
}

export interface BeersEstablishments {
  id: number;
  beer_id: number;
  establishment_id: number;
  added_time: string | null;
  created_at: string;
}

// URL Supabase Storage pour les images
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://kioysoveqemzjolfwpnu.supabase.co";
const STORAGE_BUCKET = "content-assets";

/**
 * Construit l'URL d'une image depuis Supabase Storage
 * Utilise le endpoint /render/image pour les transformations (redimensionnement)
 */
export function getImageUrl(
  imagePath: string | undefined | null,
  options?: {
    width?: number;
    height?: number;
    quality?: number;
  }
): string | null {
  if (!imagePath) return null;

  // Si des transformations sont demandees, utiliser le endpoint render
  if (options?.width || options?.height) {
    const params = new URLSearchParams();
    if (options.width) params.append("width", String(options.width));
    if (options.height) params.append("height", String(options.height));
    if (options.quality) params.append("quality", String(options.quality));
    return `${SUPABASE_URL}/storage/v1/render/image/public/${STORAGE_BUCKET}/${imagePath}?${params}`;
  }

  // Sinon, retourner l'URL directe
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${imagePath}`;
}

/**
 * Recupere tous les etablissements
 */
export async function getEstablishments(): Promise<Establishment[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("establishments")
    .select("*")
    .order("title");

  if (error) {
    console.error("Error fetching establishments:", error);
    return [];
  }

  return (data as Establishment[]) || [];
}

/**
 * Recupere un etablissement par ID
 */
export async function getEstablishment(
  id: number
): Promise<Establishment | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("establishments")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching establishment:", error);
    return null;
  }

  return data as Establishment;
}

/**
 * Recupere toutes les bieres avec leurs brasseries
 */
export async function getBeers(): Promise<Beer[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("beers")
    .select("*, breweries(*)")
    .order("title");

  if (error) {
    console.error("Error fetching beers:", error);
    return [];
  }

  return (data as Beer[]) || [];
}

/**
 * Recupere une biere par ID avec sa brasserie
 */
export async function getBeer(id: number): Promise<Beer | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("beers")
    .select("*, breweries(*)")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching beer:", error);
    return null;
  }

  return data as Beer;
}

/**
 * Recupere toutes les brasseries
 */
export async function getBreweries(): Promise<Brewery[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("breweries")
    .select("*")
    .order("title");

  if (error) {
    console.error("Error fetching breweries:", error);
    return [];
  }

  return (data as Brewery[]) || [];
}

/**
 * Recupere tous les styles de bieres
 */
export async function getStyles(): Promise<BeerStyle[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("beer_styles")
    .select("*")
    .order("title");

  if (error) {
    console.error("Error fetching beer styles:", error);
    return [];
  }

  return (data as BeerStyle[]) || [];
}

/**
 * Recupere toutes les liaisons bieres-etablissements
 */
export async function getBeersEstablishments(): Promise<BeersEstablishments[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("beers_establishments")
    .select("*");

  if (error) {
    console.error("Error fetching beers_establishments:", error);
    return [];
  }

  return (data as BeersEstablishments[]) || [];
}

/**
 * Recupere les bieres disponibles dans un etablissement
 */
export async function getBeersByEstablishment(
  establishmentId: number
): Promise<Beer[]> {
  const supabase = createClient();

  // Recuperer les IDs des bieres liees a cet etablissement
  const { data: junctions, error: junctionError } = await supabase
    .from("beers_establishments")
    .select("beer_id")
    .eq("establishment_id", establishmentId);

  if (junctionError || !junctions || junctions.length === 0) {
    return [];
  }

  const beerIds = (junctions as { beer_id: number }[]).map((j) => j.beer_id);

  // Recuperer les bieres
  const { data: beers, error: beersError } = await supabase
    .from("beers")
    .select("*, breweries(*)")
    .in("id", beerIds)
    .order("title");

  if (beersError) {
    console.error("Error fetching beers by establishment:", beersError);
    return [];
  }

  return (beers as Beer[]) || [];
}

/**
 * Recupere les etablissements ou une biere est disponible
 */
export async function getEstablishmentsByBeer(
  beerId: number
): Promise<Establishment[]> {
  const supabase = createClient();

  // Recuperer les IDs des etablissements lies a cette biere
  const { data: junctions, error: junctionError } = await supabase
    .from("beers_establishments")
    .select("establishment_id")
    .eq("beer_id", beerId);

  if (junctionError || !junctions || junctions.length === 0) {
    return [];
  }

  const establishmentIds = (junctions as { establishment_id: number }[]).map(
    (j) => j.establishment_id
  );

  // Recuperer les etablissements
  const { data: establishments, error: establishmentsError } = await supabase
    .from("establishments")
    .select("*")
    .in("id", establishmentIds)
    .order("title");

  if (establishmentsError) {
    console.error("Error fetching establishments by beer:", establishmentsError);
    return [];
  }

  return (establishments as Establishment[]) || [];
}

export interface ContentStatsResult {
  totalEstablishments: number;
  totalBeers: number;
  totalBreweries: number;
  totalStyles: number;
}

/**
 * Recupere les statistiques de contenu
 */
export async function getContentStats(): Promise<ContentStatsResult> {
  const supabase = createClient();

  const [establishments, beers, breweries, styles] = await Promise.all([
    supabase.from("establishments").select("id", { count: "exact", head: true }),
    supabase.from("beers").select("id", { count: "exact", head: true }),
    supabase.from("breweries").select("id", { count: "exact", head: true }),
    supabase.from("beer_styles").select("id", { count: "exact", head: true }),
  ]);

  return {
    totalEstablishments: establishments.count || 0,
    totalBeers: beers.count || 0,
    totalBreweries: breweries.count || 0,
    totalStyles: styles.count || 0,
  };
}

/**
 * Met a jour une biere
 */
export async function updateBeer(
  id: number,
  data: BeerUpdateType
): Promise<Beer> {
  const supabase = createClient();
  const payload = { ...data, updated_at: new Date().toISOString() };

  const { data: updated, error } = await supabase
    .from("beers")
    .update(payload as never)
    .eq("id", id)
    .select("*, breweries(*)")
    .single();

  if (error) {
    console.error("Error updating beer:", error);
    throw error;
  }

  return updated as Beer;
}

/**
 * Upload une image de biere dans Supabase Storage
 * Retourne le chemin de l'image dans le bucket
 */
export async function uploadBeerImage(
  beerId: number,
  file: File
): Promise<string> {
  const supabase = createClient();

  // Generer un nom de fichier unique
  const fileExt = file.name.split(".").pop();
  const fileName = `beers/${beerId}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("Error uploading beer image:", uploadError);
    throw uploadError;
  }

  return fileName;
}

/**
 * Supprime une image de biere dans Supabase Storage
 */
export async function deleteBeerImage(imagePath: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([imagePath]);

  if (error) {
    console.error("Error deleting beer image:", error);
    // On ne throw pas l'erreur car ce n'est pas critique
  }
}

/**
 * Upload une image d'etablissement dans Supabase Storage
 * Retourne le chemin de l'image dans le bucket
 */
export async function uploadEstablishmentImage(
  establishmentId: number,
  file: File,
  type: "featured" | "logo"
): Promise<string> {
  const supabase = createClient();

  // Generer un nom de fichier unique
  const fileExt = file.name.split(".").pop();
  const suffix = type === "logo" ? "_logo" : "";
  const fileName = `establishments/${establishmentId}${suffix}_${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("Error uploading establishment image:", uploadError);
    throw uploadError;
  }

  return fileName;
}

/**
 * Supprime une image d'etablissement dans Supabase Storage
 */
export async function deleteEstablishmentImage(imagePath: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([imagePath]);

  if (error) {
    console.error("Error deleting establishment image:", error);
    // On ne throw pas l'erreur car ce n'est pas critique
  }
}

/**
 * Met a jour un etablissement
 */
export async function updateEstablishment(
  id: number,
  data: EstablishmentUpdateType
): Promise<Establishment> {
  const supabase = createClient();
  const payload = { ...data, updated_at: new Date().toISOString() };

  const { data: updated, error } = await supabase
    .from("establishments")
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating establishment:", error);
    throw error;
  }

  return updated as Establishment;
}

// Level Thresholds (Storytelling)
export interface LevelThreshold {
  id: number;
  level: number;
  name: string;
  xp_required: number;
  description: string | null;
  lore: string | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export async function getLevelThresholds(): Promise<LevelThreshold[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("level_thresholds")
    .select("*")
    .order("level");

  if (error) throw error;
  return (data || []) as LevelThreshold[];
}

export async function updateLevelThreshold(
  id: number,
  data: { name?: string; xp_required?: number; description?: string | null; lore?: string | null }
): Promise<void> {
  const supabase = createClient();
  const payload = { ...data, updated_at: new Date().toISOString() };
  const { error } = await supabase
    .from("level_thresholds")
    .update(payload as never)
    .eq("id", id);

  if (error) throw error;
}

export async function createLevelThreshold(
  data: { level: number; name: string; xp_required: number; description?: string | null; lore?: string | null }
): Promise<LevelThreshold> {
  const supabase = createClient();

  const { data: maxRow } = await supabase
    .from("level_thresholds")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .single();
  const nextId = ((maxRow as { id: number } | null)?.id ?? 0) + 1;

  const now = new Date().toISOString();
  const { data: created, error } = await (supabase
    .from("level_thresholds") as any)
    .insert({
      id: nextId,
      ...data,
      sort_order: data.level,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) throw error;
  return created as LevelThreshold;
}

export async function deleteLevelThreshold(id: number): Promise<void> {
  const supabase = createClient();
  const { error } = await (supabase
    .from("level_thresholds") as any)
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function getXpPerEuro(): Promise<number> {
  const supabase = createClient();
  const { data, error } = await (supabase
    .from("constants") as any)
    .select("value")
    .eq("key", "xp_gains")
    .single();

  if (error) throw error;
  return parseFloat(data.value);
}
