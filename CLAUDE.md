# CLAUDE.md - Royaume des Paraiges Admin

Interface d'administration du Royaume des Paraiges (app de fidélité gamifiée bière). Backend Supabase partagé avec les apps front, scanner, waiters.

## Stack

Next.js 16.1 (App Router) · React 19.2 · TypeScript 5.7 · Supabase 2.47 · Tailwind 3.4 · Radix/shadcn · Recharts.

## Documentation

- **Backend Supabase** : submodule `docs/docs/supabase/` (tables, functions, policies). Toujours consulter avant de toucher au schéma.
- **Types BDD** : `src/types/database.ts` (généré + extensions manuelles en bas du fichier).
- **Services** : `src/lib/services/*Service.ts` — un par domaine (coupons, quests, rewards, season, achievementBadge, content, analytics, user, receipt, template, period, level).

## Terminologie quêtes

- **défis** = quêtes **récurrentes** (weekly/monthly/yearly), seul modèle implémenté.
- **missions** = quêtes **ponctuelles** (à venir).
- Les noms BDD restent `quests`/`quest_progress`/etc. — la distinction est fonctionnelle.

## Règles produit en vigueur

- **Zéro euro côté client** : l'app Expo ne doit jamais afficher d'euros. Les quêtes purement monétaires côté client utilisent `quest_type = 'cashback_earned'` (target en PdB, 1 PdB = 1 centime). Le type `amount_spent` reste disponible à la création (target saisie en €, stockée en centimes via ×100) — l'admin/scanner/waiters peuvent afficher en €, mais si une telle quête est rendue visible côté Expo, prévoir un affichage non-monétaire (libellé descriptif, conversion en PdB attendus, etc.).
- **Refonte mécaniques de jeu (en prod)** : grille 25 niveaux, `cashback_coefficient = 100 + (level-1)*20` auto-maintenu par trigger sur `gains`, cycle de saison (snapshot → badges → reset) via `/rewards/season`.
- **Badges succès** : catégorie `achievement` sur `badge_types`, `criterion_type` paramétrable, attribution temps réel via hook dans `create_receipt` (step 12b) + cron nocturne 02:00 UTC pour les streaks. Soft-delete via `archived_at`. Cf. `docs/docs/supabase/functions/achievement_badges.md`.

## Conventions de code

### Validation runtime — Zod obligatoire

Tout service qui mute la BDD (RPC ou table-write) valide son input avec un schéma Zod dans `src/lib/schemas/`, appelé via `schema.parse(input)` au début. Schémas existants : `manualCouponSchema`, `questSchema`/`questUpdateSchema`, `achievementBadgeSchema`/`achievementBadgeUpdateSchema`, `distributeRewardsSchema`, `seasonClosureSchema`. Les schémas servent aussi de base aux forms UI.

### Forms — react-hook-form + zodResolver

Pattern : `useForm<FormInput>({ resolver: zodResolver(schema), defaultValues })` puis `form.handleSubmit(async values => ...)`. Le schéma UI peut différer du schéma service (inputs string pour les number, conversions €→centimes au submit).

- `register("name")` pour les `<Input>`, `<Controller>` pour les `<Select>`/`<Switch>` shadcn.
- Erreurs Zod : `errors.name?.message` avec `text-xs text-destructive`.
- Erreur serveur : state local `serverError`, bandeau au-dessus des actions.
- Toasts : `import { toast } from "sonner"` (pas le `useToast` shadcn).

Forms migrés : `coupons/create`, `rewards/achievements/_form/AchievementBadgeForm`, `quests/_form/QuestForm`.

**`/settings`** : simplifié (mai 2026). Header purgé du jargon BDD (`admin_settings`, "migration 020"). Descriptions des champs réécrites en français clair (plus de balises `<code>` exposant les noms d'enum quest_type). Lien vers `/quests/health` ajouté pour expliquer où les alertes apparaissent. Migration TanStack Query + sonner. Pattern : page = chargement queries + handoff vers `<SettingsForm>` enfant qui initialise son state depuis les props (évite la règle eslint `react-hooks/set-state-in-effect` de React 19).

**`/content/beers`** et **`/content/establishments`** : simplifiés (mai 2026). Cartes stats "Source: Supabase" supprimées (purement noise), `IBU moyen` retirée. Migration TanStack Query + sonner. Pages volontairement légères (lecture seule) : recherche + table + dialog réciproque (bières ↔ établissements).

**`/quests`** : refonte en vue calendaire « En ce moment » (mai 2026). Plus d'onglets type-période ni de pills Actuelles/À venir/Archives. Layout : **3 colonnes** Semaine / Mois / Année affichées simultanément, chacune avec sa **frise temporelle cliquable** (périodes issues de `quest_periods` ∪ période courante, triées ; bouton *Aujourd'hui* pour revenir au présent). Une période sélectionnée passée affiche la **participation** (`getQuestProgressStatsForPeriod`, scopée `quest_progress.period_identifier`) ; présente/future affiche le toggle actif + duplication. Les quêtes **sans planning** (`quest_periods` vide) sont sorties dans une **section « Permanentes »** dédiée (groupée par type), badgées *En continu* si actives. Filtre **Inactives** (caché par défaut) dans le header. Cartes compactes cliquables → détail. Outils CSV (template / export / import) toujours dans le dropdown **Outils** ; dialog d'import et `QuestConflictDialog` toujours gérés dans la page. TanStack Query + sonner.

**`/coupons/create`** : formulaire simplifié (mai 2026). Plus de notion de "mode template / custom" — toujours saisie directe : radios *Bonus cashback (€) / Coupon (%)* puis un seul champ. Les `coupon_templates` restent en BDD et continuent d'alimenter la distribution leaderboard (`/rewards/distribute`) ainsi que `/templates`, mais ne sont plus exposés dans le flux de création manuelle d'un coupon.

**`/analytics`** : refonte en **tableau timeline par journée fiscale** (juin 2026, migrations 045-046). Remplace les StatCards/graphiques Recharts (Recettes/Dettes/Stock). Layout : le tableau est **pleine largeur** (`-mx-4 sm:-mx-6` pour sortir du `p-6` du `<main>`). **Entête figé sans scrollbar verticale interne** via une architecture à **deux tables alignées** (`timeline-table.tsx`) : un **entête sticky séparé** (`sticky top-{hauteur barre de filtres}`, conteneur `overflow-hidden`) + le **corps en flux normal** (`overflow-x-auto`, scroll vertical = la page `<main>`). Le défilement horizontal du corps est **synchronisé en JS** sur l'entête (`onScroll` → `headerRef.scrollLeft`). Alignement des colonnes garanti par des **largeurs fixes** (`FIRST_COL_W`/`COL_W` + `table-fixed` + `colgroup` ; la table fait exactement `tableWidth`, **sans** `minWidth:100%` — les colonnes ne s'étirent donc jamais quand il y a peu de journées). La **1ʳᵉ colonne** reste figée à gauche (`sticky left-0`) dans les deux tables. L'offset de l'entête = hauteur réelle de la barre de filtres, **mesurée** dans `page.tsx` (`ResizeObserver` + `getComputedStyle().top`) et passée via `stickyHeaderTop`. **z-index** : barre de filtres `z-40` > entête sticky `z-20`. Fines **lignes verticales** `border-border/30` entre colonnes ; lignes de métriques **groupées par établissement** (séparateur épais entre groupes), **colonnes = journées fiscales** (clôture → clôture). Métriques par établissement et journée fiscale, en **blocs séparés** (migrations 054-055, réconciliation Cashpad ↔ Royaume) : **(0) Euros Cashpad** — ligne seule en tête, `euro_cashpad_other_cents` = paiements Cashpad SANS lien Royaume (tous modes sauf « Euros Royaume »/« Paraiges de Bronze » ; `NULL`→« — » en fallback) ; **(1) Euros Royaume** — *selon Cashpad* (`euro_cashpad_cents` : mode de paiement Cashpad « Euros Royaume », `LIKE '%royaume%'`, millièmes ÷10, `NULL`→« — » en fallback), *selon Royaume* (`euro_royaume_cents` : `receipt_lines` `card`+`cash`, cliquable → drilldown), *Différence (Cashpad − Royaume)* ; **(2) Paiements PdB** — *selon Cashpad* (`pdb_cashpad_cents` : mode Cashpad « Paraiges de Bronze », `LIKE '%paraige%'` ; quasi toujours 0 car peu utilisé en caisse), *selon Royaume* (`pdb_royaume_cents` : `receipt_lines` `cashback`, cliquable), *Différence* ; **(3) Génération** — *PdB organiques générés* (`gains` `source_type='receipt'`, cliquable), *PdB gains générés* (`gains` `source_type='bonus_cashback_quest'`, rattachés par **heuristique** à l'établissement du dernier receipt du client antérieur au gain — ces gains n'ont ni `receipt_id` ni `establishment_id`). Les lignes *Différence* sont calculées côté UI (vert si = 0, ambre si ≠ 0). Le **bloc global** « toutes enseignes » a été **retiré** : les gains hors quête sans établissement (leaderboard/manuel/rollback) ne sont plus affichés (la RPC `_global` reste en base mais n'est plus appelée). **Tous les montants (PdB inclus) sont affichés en euros** via `formatCurrency` (centimes ÷ 100, virgule décimale) — 1 PdB = 0,01 €. Filtre **multi-établissements** + sélecteur de plage **Jour/Semaine/Mois** (défaut Mois, pattern récon­ciliation). Clic sur une cellule → `DrilldownModal` scopé à la fenêtre fiscale `[range_begin, range_end]`. Les **PdB récompense/total** (`bonus_cashback_*`, sans `establishment_id`) sont dans un **bloc global provisoire** « Royaume — toutes enseignes » (par jour calendaire) en attendant le **modèle de dettes inter-établissements** (chantier backend à venir : attribution au prorata des dépenses qualifiantes). Service : `getAnalyticsTimeline` / `getAnalyticsTimelineGlobal` (RPC `as any`). Query keys : `analyticsKeys`. Composants : `src/components/analytics/{timeline-table,timeline-period-range,establishment-multi-filter,timeline-global-block}.tsx`. Les bornes fiscales viennent de `cashpad_closures` (peuplée par l'edge function `cashpad-reconcile-daily`) ; sans clôture, **fallback jour calendaire** `Europe/Paris` (colonne badgée « cal. »). ⚠️ Nécessite le **déploiement de l'edge function** + un **backfill** (réconciliation globale) pour passer du fallback aux vraies colonnes fiscales.

### Data fetching — TanStack React Query

`QueryProvider` dans `src/app/layout.tsx` (staleTime 30s, retry 1, no refetchOnWindowFocus). Query keys factories : `src/lib/queries/keys.ts` par domaine.

**Règle** : toute mutation qui change un listing **doit** invalider `xxxKeys.all` du domaine, sinon stale jusqu'à 30s.

Listings migrés : `rewards/achievements`, `rewards/tiers`, `coupons`, `users`, `templates`, `quests`, `content/beers`, `content/establishments`.

### Conversion target_value des quêtes — piège récurrent

Dans `QuestForm.submit` :
- `amount_spent` : `parseFloat(value) * 100` → centimes
- `cashback_earned` : `parseInt(value)` → PdB direct (saisie "50" = `target_value = 50`, **pas 5000**)
- Autres : `parseInt(value)` → unités directes

## Gotchas BDD

- Colonne `used` (pas `is_used`) dans `coupons`. Pas de `establishment_id` ni `used_at`.
- Pas de `total_xp` / `cashback_balance` dans `profiles` → vue matérialisée `user_stats`.
- `gains.establishment_id` est **nullable** (NULL pour bonus cashback directs).
- `receipts.employee_id` est **nullable** (NULL pour historique).
- RPC analytics (`get_analytics_revenue`/`_debts`/`_stock`) : avec filtre établissement/employé actif, PdB Récompenses + Bonus Coupons retournent 0.
- **Bornes de journée fiscale** (clôture → clôture) : persistées uniquement dans `cashpad_closures` (migration 045), peuplée par l'edge function `cashpad-reconcile-daily`. La RPC `get_analytics_timeline` (page `/analytics`) s'en sert pour bucketer les receipts ; sans clôture → fallback jour calendaire `Europe/Paris`. Cf. `docs/docs/supabase/tables/cashpad_closures.md`.
- Catégorie « Bonus Coupons » existe encore en backend mais n'est plus affichée admin (reclassée en `bonus_cashback_leaderboard`).
- `badge_types.category` ∈ {`weekly`, `monthly`, `yearly`, `special`, `season_rank`, `quest`, `achievement`}.
- **Soft-delete des badges achievement** : la FK `user_badges.badge_id` est `ON DELETE CASCADE`, un hard-delete effacerait tous les badges déjà obtenus → toujours passer par `archived_at`.
- **Reset de saison** n'efface jamais : ni le solde PdB (`gains` intact), ni les badges (`user_badges`), ni les snapshots. Seul `cashback_coefficient` revient à 100.
- **`profiles.cashback_coefficient` est auto-maintenu** par trigger sur `gains` — ne JAMAIS le modifier manuellement (sauf via RPC `reset_season`).
- **Solde PdB ne peut plus passer négatif** (migration 043) : trigger `trg_enforce_non_negative_cashback` sur `gains` (AFTER INSERT/UPDATE/DELETE). Toute mutation de `gains` rendant `SUM(cashback_money) − dépenses_cashback < 0` pour un client est rejetée (`SQLSTATE P0423`, message `CASHBACK_BALANCE_NEGATIVE:`). En pratique : une annulation (gain négatif `rollback_beta_correction`) ne peut plus dépasser le solde disponible. Ne couvre pas le chemin de dépense (`receipt_lines`/`create_receipt`). Cf. `docs/docs/supabase/functions/enforce_non_negative_cashback.md`.
- **Suppression d'un ticket** (migration 044) : passe **toujours** par la RPC `admin_delete_receipt(p_receipt_id)` (service `receiptService.deleteReceipt`), jamais par un `DELETE FROM receipts` direct côté client. La cascade BDD (`receipt_lines`, `gains`, `receipt_consumption_items`, `spendings`, `cashpad_reconciliations`) est en `ON DELETE CASCADE`, mais l'ordre de cascade entre `gains` et `receipt_lines` peut déclencher un **faux positif** `P0423` du garde-fou solde négatif ; la RPC supprime donc dans un ordre maîtrisé (`receipt_lines` → `gains` → `receipts`) en une transaction atomique, puis `REFRESH MATERIALIZED VIEW CONCURRENTLY user_stats`. Si les PdB gagnés sur le ticket ont déjà été dépensés ailleurs, la suppression est **refusée** (P0423, message UX dédié). UI : bouton corbeille + `AlertDialog` sur chaque ligne de la table tickets de `/users/[id]`. Cf. `docs/docs/supabase/functions/admin_delete_receipt.md`.
- `level_thresholds` : 25 lignes (Écuyer I → Chevalier de la Table Ronde), à lire dynamiquement, jamais hardcoder.
- 17 quêtes désactivées (ids 10-26 sauf 27-28) — préservées pour l'historique de `quest_progress` / `quest_completion_logs`. **Ne pas DELETE**.
- 6 quêtes consumption hebdo créées mais désactivées par défaut (à activer une à une selon calendrier produit).
- **Convention semaine = ISO 8601 partout (lundi→dimanche)**. SQL : `get_period_identifier` (`IYYY-"W"IW`), `get_period_bounds`, et la table `available_periods` (réalignée migration `042` — elle était en dimanche→samedi, ce qui expirait les quêtes un jour trop tôt chaque dimanche, cf. `docs/.../tables/available_periods.md`). TS : **un seul** générateur de labels, `getPeriodIdentifier(periodType, date?)` dans `src/lib/utils.ts` (ISO) ; `periodService.getCurrentPeriodIdentifier` y délègue. Ne JAMAIS réintroduire un calcul de semaine local (`Math.ceil((days + getDay()+1)/7)` = dimanche→samedi, source de bugs de bord de semaine sur `quest_periods` / `period_reward_configs`).

## Typage Supabase

- `(supabase.rpc as any)` pour les appels RPC (limitation typage).
- `(supabase.from("table") as any)` pour insert/update/delete.

## Types de quêtes

| Type | Unité | Notes |
|------|-------|-------|
| `xp_earned` | XP | |
| `cashback_earned` | PdB | Progression = SUM(`gains.cashback_money`) sur la période |
| `amount_spent` | Centimes BDD / € UI | Conversion ×100 au submit |
| `establishments_visited` | Nombre | |
| `orders_count` | Nombre | |
| `quest_completed` | Nb sous-périodes | Méta-quête, incompatible avec `weekly` |
| `consumption_count` | Nombre | Requiert `quests.consumption_type` non-NULL |

ENUM `consumption_type` : `cocktail`, `biere`, `alcool`, `soft`, `boisson_chaude`, `restauration`, `boucherie`.

Statuts `quest_progress.status` : `in_progress`, `completed`, `rewarded`, `expired` (via cron quotidien `expire_quest_progress()`).

## Cycle de saison (clôture annuelle)

UI : `/rewards/season` (manuelle pour an 1, cron à venir an 2+). Service : `seasonService.ts`.

3 étapes idempotentes via RPC :
1. `snapshot_season(year, source)` — fige les rangs dans `season_snapshots`
2. `award_season_rank_badges(year, source)` — distribue 6 badges saison (garde : snapshot fait)
3. `reset_season(year, source)` — `cashback_coefficient = 100` partout (garde : badges distribués)

`source` ∈ `'cron' | 'cron_fallback' | 'manual' | 'dry_run_aborted'`. Journal dans `season_closure_log`.

## Structure UI `/rewards`

Page hub (`/rewards/page.tsx`) = pure navigation (5 cartes, zéro fetch). Sous-routes :
- `/rewards/periods` — gestion des périodes
- `/rewards/tiers` — listing paliers leaderboard (TanStack Query) + section secondaire « Lore des badges » (toutes catégories de `badge_types`, édition via dialog inline — emplacement provisoire en attendant arbitrage UX)
- `/rewards/achievements` — badges succès (catégorie `achievement` uniquement)
- `/rewards/distribute` — distribution périodique
- `/rewards/season` — clôture annuelle

## Rôles utilisateurs

`admin` (complet) · `establishment` (limité) · `employee` (aucun accès admin) · `client` (aucun).

## Commandes

```bash
npm install
npm run dev          # port 3000
npm run build
npm run lint
npm run supabase:types
```

## Variables d'environnement

```env
NEXT_PUBLIC_SUPABASE_URL=https://kioysoveqemzjolfwpnu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

## Liens

### Imports

```typescript
// 1. React/Next
import { useState } from 'react';
import Link from 'next/link';

// 2. Composants UI
import { Button } from '@/components/ui/button';

// 3. Services
import { getCoupons } from '@/lib/services/couponService';

// 4. Types
import type { Coupon } from '@/types/database';
```

### Services

Les services encapsulent toute la logique d'appel API :

```typescript
// src/lib/services/couponService.ts
export async function getCoupons(filters?: CouponFilters) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
```

### Types

Les types sont generes depuis Supabase et etendus si necessaire :

```typescript
// src/types/database.ts
export type Coupon = Database['public']['Tables']['coupons']['Row'];

// Extension pour les relations
export type CouponWithRelations = Coupon & {
  profiles: Pick<Profile, 'first_name' | 'last_name' | 'email'> | null;
  coupon_templates: Pick<CouponTemplate, 'name'> | null;
};
```

### Validation runtime (Zod) — refonte fondations 2026

Tous les services qui mutent la BDD via une RPC ou un table-write valident leur input avec un schéma Zod défini dans `src/lib/schemas/` :

| Service | Schéma | Couvre |
|---------|--------|--------|
| `couponService.createManualCoupon` | `manualCouponSchema` | UUIDs, XOR template/amount/percentage, format date YYYY-MM-DD |
| `questService.createQuest` / `updateQuest` | `questSchema` / `questUpdateSchema` | slug regex, target positif, consumption_type cohérent, weekly+quest_completed interdit |
| `achievementBadgeService.create` / `update` | `achievementBadgeSchema` / `achievementBadgeUpdateSchema` | slug regex, criterion_params per criterion_type, mode cron requis pour streaks |
| `rewardService.distributeRewards` | `distributeRewardsSchema` | period_type enum, force/previewOnly booléens |
| `seasonService.snapshot` / `awardBadges` / `reset` | `seasonClosureSchema` | year ∈ [2020, 2100], source enum |

**Règle** : si tu ajoutes un nouveau service mutateur, ajoute aussi son schéma Zod dans `src/lib/schemas/` et appelle `schema.parse(input)` au début. Les schémas peuvent ensuite servir de base pour les forms côté UI.

### Forms — react-hook-form + zodResolver

Les forms admin migrés (avril 2026) suivent ce pattern :

```typescript
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Schéma UI : peut différer du schéma service (champs string pour les inputs number)
const formSchema = z.object({ /* … */ }).superRefine(/* cross-field */);
type FormInput = z.infer<typeof formSchema>;

const form = useForm<FormInput>({
  resolver: zodResolver(formSchema),
  defaultValues: { /* … */ },
});

const submit = form.handleSubmit(async (values) => {
  // transform values → service payload (conversions €→centimes, etc.)
  await service(payload);
});
```

**Conventions** :
- `register("name")` pour les `<Input>` simples, `<Controller>` pour les `<Select>`/`<Switch>` shadcn
- Erreurs Zod affichées sous chaque champ via `errors.name?.message` (className `text-xs text-destructive`)
- Erreur serveur capturée dans un state local `serverError`, affichée en bandeau au-dessus des actions
- Toast de succès/erreur via `import { toast } from "sonner"` (pas le `useToast` shadcn)

**Forms migrés à date** : `coupons/create`, `rewards/achievements/_form/AchievementBadgeForm` (shared create+edit), `quests/_form/QuestForm` (shared create+edit).

### Data fetching — TanStack React Query

Le `QueryProvider` est branché dans `src/app/layout.tsx` (staleTime 30s, retry 1, no refetchOnWindowFocus).

**Convention des query keys** : `src/lib/queries/keys.ts` expose des factories par domaine.

```typescript
// Lecture
const { data, isLoading } = useQuery({
  queryKey: questKeys.lists(),
  queryFn: getQuests,
});

// Mutation avec invalidation
const queryClient = useQueryClient();
await createQuest(payload);
queryClient.invalidateQueries({ queryKey: questKeys.all });
```

**Règle** : toute mutation qui change le contenu d'un listing **doit** invalider la query key `xxxKeys.all` du domaine pour que la liste se rafraîchisse au retour. Sans ça, l'utilisateur voit du stale jusqu'à 30s.

**Listings migrés à date** : `rewards/achievements`, `coupons`, `users`, `templates`. Le listing `quests` reste sur `useEffect+useState` (909 lignes, à migrer dans une PR dédiée).

### Conversion target_value des quêtes — piège récurrent

Dans `QuestForm.submit` :
- `quest_type === "amount_spent"` : `parseFloat(value) * 100` → centimes (€ saisis → centimes stockés)
- `quest_type === "cashback_earned"` : `parseInt(value)` → PdB direct (1 PdB = 1 centime, mais saisi en PdB)
- Tous les autres : `parseInt(value)` → unités directes

Si tu modifies cette logique, **vérifie cashback_earned** : la saisie "50" doit donner `target_value = 50`, pas 5000.

## Consignes pour les Agents IA

### Avant de modifier du code

1. **Lire la documentation** dans `docs/docs/supabase/` pour comprendre le schema
2. **Verifier les types** dans `src/types/database.ts`
3. **Consulter les services existants** avant d'en creer de nouveaux

### Points d'attention

- La colonne s'appelle `used` (pas `is_used`) dans la table `coupons`
- Il n'y a PAS de colonne `establishment_id` dans la table `coupons`
- Il n'y a PAS de colonne `used_at` dans la table `coupons`
- Il n'y a PAS de colonnes `total_xp` / `cashback_balance` dans `profiles` (voir vue `user_stats`)
- `establishment_id` dans `gains` est **nullable** (NULL pour les bonus cashback directs)
- `employee_id` dans `receipts` est **nullable** (NULL pour les receipts historiques, rempli via `create_receipt(p_employee_id)`)
- Les fonctions RPC analytics (`get_analytics_revenue`, `get_analytics_debts`, `get_analytics_stock`) : quand un filtre etablissement/employe est actif, les PdB Recompenses et Bonus Coupons retournent 0 (pas de lien etablissement/employe)
- Les fonctions RPC utilisent `SECURITY DEFINER` et bypass RLS
- Les admins creent des coupons via `create_manual_coupon()` RPC
- **Coupons montant fixe** = bonus cashback credite immediatement (used=true des la creation)
- **Coupons pourcentage** = seuls coupons utilisables sur les commandes
- **Quetes** : Le `target_value` pour `amount_spent` est en **centimes** en BDD mais en **euros** dans le frontend (conversion x100)
- Utiliser `(supabase.rpc as any)` pour les appels RPC (limitation de typage)
- Utiliser `(supabase.from("table") as any)` pour insert/update/delete

### Refonte des quêtes (avril 2026) — règles à connaître

- **Modèle template récurrent conservé** : une quête `period_type = weekly` est instanciée par Compagnon × semaine via `quest_progress`, contrainte UNIQUE `(quest_id, customer_id, period_identifier)` garantit « réalisable une fois par semaine ».
- **Nouveau type `consumption_count`** : nécessite `quests.consumption_type` non-NULL (CHECK constraint). Le formulaire admin affiche un Select conditionnel.
- **6 quêtes consumption hebdo créées mais désactivées par défaut** (`weekly_5_bieres`, `weekly_3_cocktails`, etc.). À activer une à une depuis `/quests` selon le calendrier produit.
- **Badges catégorie `quest`** : 3 templates créés (`quest_pelerin`, `quest_grand_pelerin`, `quest_fidele_legendary`). `quest_grand_pelerin` (3 mois consécutifs) doit être attribué manuellement pour l'instant.
- **17 quêtes désactivées en BDD** (ids 10-26 sauf 27-28) — préservées pour l'historique de `quest_progress` / `quest_completion_logs`. Ne pas DELETE.
- **Helpers TypeScript** : `Quest`, `QuestInsert`, `QuestUpdate`, `QuestType`, `ConsumptionType`, `QuestWithRelations`, etc. exposés depuis `@/types/database` (ajoutés manuellement en bas du fichier en avril 2026).
- **Planning `quest_periods` appliqué par le moteur (mai 2026, migration `041`)** : `update_quest_progress_for_receipt` honore désormais `quest_periods` (comme `update_meta_quest_progress`). Quête **sans** période = permanente (récompense chaque période active) ; quête **avec** périodes = récompense **uniquement** si la période courante y figure (rotation). Avant le fix, le moteur ignorait le planning → crédits PdB hors rotation + quêtes défuntes restées actives qui continuaient de payer (incident quête 9 « Dix coupes en sept jours », reprise via gains `rollback_beta_correction`). `/quests/health` alerte sur les quêtes actives **permanentes** (aucune période) ou à **planning périmé** (aucune période ≥ courante) ; l'onglet **Archives** de `/quests` badge en rouge une quête archivée encore `is_active`. ⚠️ Vérifier que l'app **front** respecte aussi `quest_periods` à l'affichage.

### Refonte mécaniques de jeu (avril 2026) — règles à connaître

- **`level_thresholds` contient exactement 25 lignes** (Écuyer I → Chevalier de la Table Ronde). Toute requête doit s'y fier dynamiquement, jamais hardcoder le plafond.
- **Niveau dérivé du XP de la saison courante** : `compute_level_from_xp(p_xp)` lit `level_thresholds`, `get_season_xp(p_customer_id)` filtre `gains.created_at` par année calendaire en cours.
- **`profiles.cashback_coefficient` est auto-maintenu** : ne JAMAIS le modifier manuellement (sauf via la RPC `reset_season`). Un trigger sur `gains` recalcule à chaque INSERT/UPDATE/DELETE.
- **`badge_types.category` accepte 7 valeurs** : `weekly | monthly | yearly | special | season_rank | quest | achievement`. Les 6 badges `season_rank_*` sont attribués au reset annuel via `award_season_rank_badges`. Les 5 badges `achievement_*` (seed migration 025) sont attribués automatiquement via le hook realtime de `create_receipt` ou le cron nocturne selon le `evaluation_mode`. La catégorie `quest` est prête mais aucun badge de quête n'est encore créé.
- **Tables `season_snapshots` et `season_closure_log`** : photographies par année pour la mémoire de saison. Idempotence garantie par PK composite. Ne pas DELETE manuellement sauf debug.
- **Reset n'efface JAMAIS** : ni le solde PdB (`gains` intact), ni les badges (`user_badges` intact), ni les snapshots passés. Seul `cashback_coefficient` revient à 100.

### Apres modification

1. Verifier que les types correspondent a la BDD
2. Mettre a jour la documentation dans `docs/` si necessaire
3. Tester l'integration avec Supabase

## Liens Utiles

- **Supabase Dashboard** : https://app.supabase.com/project/kioysoveqemzjolfwpnu

---

**Derniere mise a jour** : 2026-04-19 (refonte mécaniques de jeu)

## Tâches en attente

Voir `animation/01-fonctionnel/changelog-anticipe.md` pour la liste complète. Côté admin, à venir :

- **Refonte des quêtes** (différée, gros chantier) : changement de modèle vers « one-shot par période ». Va impacter `/quests/*`, services, types.
- **Cron auto pour la clôture an 2+** : 3 pg_cron + 3 fallbacks à mettre en place après validation manuelle de la saison 2026.
- **Setup staging propre** : Supabase Branches (option A) à industrialiser. Pour l'instant, les migrations partent direct en prod sur décision Basile.
- **Modal level-up enrichie** : afficher « Tu gagnes désormais X,Y PdB par € » au franchissement d'un niveau (côté front, mais visualisable depuis l'admin via simulation).
- **Migrer le listing `/quests` vers TanStack Query** : seul listing admin encore sur `useEffect + useState` (909 lignes). Réutiliser `questKeys` de `src/lib/queries/keys.ts` et invalider `questKeys.all` après les mutations existantes. PR dédiée.
- **Bug `distribute_period_rewards_v2` ignore `p_period_identifier`** (détecté mai 2026 via tests branche `security-040`). La RPC lit `weekly_xp_leaderboard` / `monthly_xp_leaderboard` / `yearly_xp_leaderboard` telles quelles sans filtrer par `period_identifier`, donc la prévisualisation et la distribution renvoient toujours le leaderboard de la période en cours, peu importe le `p_period_identifier` passé. À fixer : soit reconstruire le leaderboard scopé via une CTE qui filtre `gains.created_at` par les bornes de période (`get_period_bounds`), soit créer des matviews historisées par période. Impact actuel limité : la feature de distribution n'est utilisée qu'en temps réel sur la période courante — mais empêche tout rattrapage / re-distribution d'une période passée.
