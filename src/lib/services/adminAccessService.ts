// Gestion des accès par fonctionnalité entre admins (migration 057).
// Un super admin (profiles.is_super_admin) peut désactiver l'accès par page
// aux autres admins via la table admin_disabled_features (une ligne = une
// feature désactivée ; absence de ligne = accès). La sécurité est portée par
// la RLS : lecture self ou super admin, écriture super admin uniquement.

import { createClient } from "@/lib/supabase/client";
import { toggleFeatureSchema, type ToggleFeatureInput } from "@/lib/schemas/adminAccess.schema";
import { FEATURE_KEYS, type FeatureKey } from "@/lib/features";
import type { AdminDisabledFeature, Profile } from "@/types/database";

// Compte système jamais connecté au dashboard : inutile de le restreindre.
const SYSTEM_ADMIN_EMAIL = "cashpad-system@royaume.internal";

export interface CurrentAdminAccess {
  profile: Profile;
  isSuperAdmin: boolean;
  disabledFeatures: FeatureKey[];
}

// Profil de l'admin connecté + ses features désactivées (même select embed
// que le middleware — le `!profile_id` désambiguïse les 2 FK vers profiles).
export async function getCurrentAdminAccess(): Promise<CurrentAdminAccess | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await (supabase.from("profiles") as any)
    .select("*, admin_disabled_features!profile_id(feature_key)")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  if (!data) return null;

  const { admin_disabled_features: disabledRows, ...profile } = data;
  const known = new Set<string>(FEATURE_KEYS);

  return {
    profile: profile as Profile,
    isSuperAdmin: profile.role === "admin" && profile.is_super_admin === true,
    disabledFeatures: ((disabledRows ?? []) as { feature_key: string }[])
      .map((row) => row.feature_key)
      .filter((key): key is FeatureKey => known.has(key)),
  };
}

// Admins gérables par le super admin (les super admins eux-mêmes sont exclus).
export async function getManagedAdmins(): Promise<Profile[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "admin")
    .eq("is_super_admin", false)
    .neq("email", SYSTEM_ADMIN_EMAIL)
    .is("deleted_at", null)
    .order("email");

  if (error) throw error;
  return data ?? [];
}

// Toutes les restrictions en cours (RLS : seul le super admin voit tout).
export async function getAllDisabledFeatures(): Promise<AdminDisabledFeature[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("admin_disabled_features")
    .select("*");

  if (error) throw error;
  return data ?? [];
}

// Désactive une fonctionnalité pour un admin (super admin uniquement, RLS).
export async function disableFeature(input: ToggleFeatureInput): Promise<void> {
  const { profileId, featureKey } = toggleFeatureSchema.parse(input);
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await (supabase.from("admin_disabled_features") as any).insert({
    profile_id: profileId,
    feature_key: featureKey,
    created_by: user?.id ?? null,
  });

  if (error) throw error;
}

// Réactive une fonctionnalité pour un admin (super admin uniquement, RLS).
export async function enableFeature(input: ToggleFeatureInput): Promise<void> {
  const { profileId, featureKey } = toggleFeatureSchema.parse(input);
  const supabase = createClient();

  const { error } = await (supabase.from("admin_disabled_features") as any)
    .delete()
    .eq("profile_id", profileId)
    .eq("feature_key", featureKey);

  if (error) throw error;
}
