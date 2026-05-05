# CLAUDE.md - Royaume des Paraiges Admin

> **Refonte mécaniques de jeu — avril 2026** (en prod)
> Migrations 005-009 appliquées : grille 25 niveaux narratifs, coefficient PdB +0,2/niveau auto-maintenu, cycle de saison (snapshot/badges/reset) avec UI manuelle, 6 badges « mémoire de saison », paliers récompense refondus.
> Voir section « Cloture de saison » et « Points d'attention » plus bas.
>
> **Refonte des quêtes — avril 2026** (en prod)
> Migrations 010-013 : consolidation (17 doublons désactivés), nouveau type `consumption_count`, 9 nouvelles quêtes, 3 badges quête. Modèle conservé (template récurrent + instances par période). UI admin étendue avec Select `consumption_type` conditionnel.
>
> **Zéro euro côté client — avril 2026** (en prod)
> Migrations 028-029 : nouveau `quest_type = 'cashback_earned'` (progression = SUM(`gains.cashback_money`) sur la période, coefficient client et bonus coupons inclus). `amount_spent` déprécié — **retiré du formulaire de création** (pages `quests/create` et `quests/[id]`) mais conservé dans l'enum pour compatibilité. Règle produit : le front client Expo ne doit jamais afficher d'euros — l'admin reste libre d'afficher en €.
>
> **Badges succès — avril 2026** (en prod)
> Migrations 022-027 + 030 : nouvelle catégorie `achievement` sur `badge_types` avec `criterion_type` paramétrable (`first_order`, `orders_threshold`, `cities_visited`, `all_establishments_visited`, `establishments_threshold`, `consecutive_weekly_quests`), attribution temps réel via hook dans `create_receipt` (step 12b), cron nocturne 02:00 UTC pour les critères de streak, RLS durcie (self-only sauf admin/employee/establishment). Admin UI : `/rewards/achievements` (liste + create + édition + soft-delete via `archived_at` + bouton « Réévaluer pour tous »), formulaire dynamique par `criterion_type` (pattern copié de `quests/create`). Nouveau service `lib/services/achievementBadgeService.ts`. Cf. `docs/docs/supabase/functions/achievement_badges.md`.

## Apercu du Projet

**royaume-paraiges-admin** est l'interface d'administration du Royaume des Paraiges, une application de fidelite gamifiee autour de la biere. Cette interface permet aux administrateurs de gerer les utilisateurs, les coupons, les recompenses et de visualiser les statistiques.

## Stack Technique

| Technologie | Version | Usage |
|-------------|---------|-------|
| Next.js | 16.1.4 | Framework React avec App Router |
| React | 19.2.3 | Bibliotheque UI |
| TypeScript | 5.7.3 | Typage statique |
| Supabase | 2.47.14 | Backend (Auth, Database, Storage) |
| Radix UI / shadcn/ui | - | Composants UI |
| Tailwind CSS | 3.4.17 | Styling |
| Recharts | 2.15.0 | Graphiques et visualisations |

## Structure du Projet

```
royaume-paraiges-admin/
├── src/
│   ├── app/                      # App Router Next.js
│   │   ├── (auth)/               # Routes authentification
│   │   │   └── login/
│   │   ├── (dashboard)/          # Routes dashboard (protegees)
│   │   │   ├── analytics/        # Tableau de bord analytique
│   │   │   ├── coupons/          # Gestion des coupons
│   │   │   │   └── create/       # Creation de coupon
│   │   │   ├── templates/        # Gestion des modeles de coupons
│   │   │   │   ├── create/       # Creation de modele
│   │   │   │   └── [id]/         # Edition de modele
│   │   │   ├── users/            # Gestion des utilisateurs
│   │   │   │   └── [id]/         # Detail utilisateur
│   │   │   ├── receipts/         # Historique des tickets
│   │   │   ├── history/          # Historique general
│   │   │   ├── rewards/          # Systeme de recompenses
│   │   │   │   ├── tiers/        # Paliers de recompenses
│   │   │   │   │   ├── create/   # Creation de palier
│   │   │   │   │   └── [id]/     # Edition de palier
│   │   │   │   ├── periods/      # Configuration des periodes
│   │   │   │   │   ├── create/   # Creation de periode
│   │   │   │   │   └── [periodType]/[identifier]/ # Detail periode
│   │   │   │   └── distribute/   # Distribution des recompenses
│   │   │   ├── quests/           # Gestion des quetes
│   │   │   │   ├── create/       # Creation de quete
│   │   │   │   └── [id]/         # Edition de quete
│   │   │   ├── content/          # Contenu (bieres, etablissements)
│   │   │   │   ├── beers/
│   │   │   │   │   └── [id]/     # Detail biere
│   │   │   │   └── establishments/
│   │   │   │       └── [id]/     # Detail etablissement
│   │   │   └── page.tsx          # Dashboard principal
│   │   └── layout.tsx
│   │
│   ├── components/               # Composants React
│   │   ├── ui/                   # Composants shadcn/ui
│   │   └── layout/               # Layout (Sidebar, Header)
│   │
│   ├── lib/                      # Utilitaires et services
│   │   ├── services/             # Services metier
│   │   │   ├── analyticsService.ts  # Statistiques et metriques
│   │   │   ├── contentService.ts    # Contenu (bieres, etablissements)
│   │   │   ├── couponService.ts     # Gestion des coupons
│   │   │   ├── periodService.ts     # Gestion des periodes
│   │   │   ├── questService.ts      # Gestion des quetes
│   │   │   ├── receiptService.ts    # Historique des tickets
│   │   │   ├── rewardService.ts     # Paliers et distributions
│   │   │   ├── templateService.ts   # Modeles de coupons
│   │   │   └── userService.ts       # Gestion utilisateurs
│   │   ├── supabase/             # Client Supabase
│   │   └── utils.ts
│   │
│   └── types/                    # Types TypeScript
│       └── database.ts           # Types Supabase (toutes les tables)
│
├── docs/                         # SUBMODULE - Documentation partagee
│   └── docs/
│       ├── supabase/             # Doc Supabase
│       │   ├── tables/           # Structure des tables
│       │   ├── functions/        # Fonctions PostgreSQL
│       │   ├── policies/         # Politiques RLS
│       │   └── README.md
│       └── claude/               # Config Claude
│
└── package.json
```

## Documentation de Reference

> **IMPORTANT** : La documentation complete du backend est dans le submodule `docs/`.

### Supabase (Base de donnees)

| Document | Chemin | Description |
|----------|--------|-------------|
| Tables | `docs/docs/supabase/tables/` | Structure de toutes les tables |
| Coupons | `docs/docs/supabase/tables/coupons.md` | Table des coupons |
| Coupon Templates | `docs/docs/supabase/tables/coupon_templates.md` | Modeles de coupons |
| Profiles | `docs/docs/supabase/tables/profiles.md` | Table des utilisateurs |
| Gains | `docs/docs/supabase/tables/gains.md` | Table des gains (XP, cashback) |
| Receipts | `docs/docs/supabase/tables/receipts.md` | Table des tickets |
| Receipt Lines | `docs/docs/supabase/tables/receipt_lines.md` | Lignes de paiement |
| Receipt Consumption Items | `docs/docs/supabase/tables/receipt_consumption_items.md` | Types de consommation (optionnel) |
| Spendings | `docs/docs/supabase/tables/spendings.md` | Depenses cashback |
| Reward Tiers | `docs/docs/supabase/tables/reward_tiers.md` | Paliers de recompenses |
| Period Reward Configs | `docs/docs/supabase/tables/period_reward_configs.md` | Config des periodes |
| Badge Types | `docs/docs/supabase/tables/badge_types.md` | Types de badges |
| Quests | `docs/docs/supabase/tables/quests.md` | Quetes |
| Quest Progress | `docs/docs/supabase/tables/quest_progress.md` | Progression des quetes |
| Available Periods | `docs/docs/supabase/tables/available_periods.md` | Periodes disponibles |
| Legal Pages | `docs/docs/supabase/tables/legal_pages.md` | Pages legales (CGU, confidentialite) |
| Fonctions | `docs/docs/supabase/functions/` | Fonctions PostgreSQL |
| create_receipt | `docs/docs/supabase/functions/create_receipt.md` | Creation de ticket (POS) |
| calculate_gains | `docs/docs/supabase/functions/calculate_gains.md` | Calcul XP et cashback |
| credit_bonus_cashback | `docs/docs/supabase/functions/credit_bonus_cashback.md` | Credit bonus cashback |
| create_manual_coupon | `docs/docs/supabase/functions/create_manual_coupon.md` | Creation coupon manuel (admin) |
| distribute_period_rewards_v2 | `docs/docs/supabase/functions/distribute_period_rewards_v2.md` | Distribution recompenses leaderboard (v2) |
| distribute_leaderboard_rewards | `docs/docs/supabase/functions/distribute_leaderboard_rewards.md` | Distribution recompenses (legacy) |
| handle_new_user | `docs/docs/supabase/functions/handle_new_user.md` | Trigger creation profil |
| get_analytics_revenue | `docs/docs/supabase/functions/get_analytics_revenue.md` | Recettes (ventes, euros, PdB) |
| get_analytics_debts | `docs/docs/supabase/functions/get_analytics_debts.md` | Dettes PdB par categorie |
| get_analytics_stock | `docs/docs/supabase/functions/get_analytics_stock.md` | Stock PdB ouverture/fermeture |
| Politiques RLS | `docs/docs/supabase/policies/README.md` | Toutes les politiques de securite |

### Tables de contenu

| Table | Description |
|-------|-------------|
| `breweries` | Brasseries |
| `establishments` | Etablissements partenaires |
| `beer_styles` | Styles de bieres |
| `beers` | Catalogue des bieres |
| `news` | Actualites |
| `level_thresholds` | Niveaux et XP requis |
| `beers_establishments` | Liaison M2M bieres-etablissements |
| `beers_beer_styles` | Liaison M2M bieres-styles |
| `news_establishments` | Liaison M2M news-etablissements |
| `legal_pages` | Pages legales (CGU, confidentialite) |

## Fonctionnalites Principales

### 1. Gestion des Coupons

**Fichiers cles** :
- `src/app/(dashboard)/coupons/page.tsx` - Liste des coupons
- `src/app/(dashboard)/coupons/create/page.tsx` - Creation de coupon
- `src/lib/services/couponService.ts` - Service metier

**Fonction RPC** : `create_manual_coupon()` - Cree un coupon manuel. Si montant fixe, credite directement en bonus cashback.

```typescript
// Exemple d'utilisation
import { createManualCoupon } from '@/lib/services/couponService';

await createManualCoupon({
  customerId: 'uuid',
  templateId: 1,        // Ou amount/percentage
  notes: 'Geste commercial',
  adminId: currentUser.id
});
```

### 2. Gestion des Utilisateurs

**Fichiers cles** :
- `src/app/(dashboard)/users/page.tsx` - Liste des utilisateurs
- `src/app/(dashboard)/users/[id]/page.tsx` - Detail utilisateur (6 onglets)
- `src/lib/services/userService.ts` - Service metier

**Onglets detail utilisateur** : Profil | **Activité** (inclut Quêtes) | **Gains** | Coupons | Tickets | Modifier

**Onglet Activité** : Affiche 5 KPI filtrables par période via `PeriodSelector` :
- Commandes (nombre de receipts)
- Dépensé EUR (somme des montants receipts)
- XP Gagné (somme gains.xp)
- Cashback Gagné (somme gains.cashback_money, sous-titre organique/récompenses)
- Cashback Dépensé (somme spendings.amount)

**Onglet Gains** : Liste détaillée paginée de chaque entrée `gains` pour l'utilisateur. Filtre par `source_type` (Ticket, Bonus manuel, Classement, Quête, Trigger, Migration). Colonnes : ID, Source (badge coloré), XP, Cashback, Établissement, Période, Date.

**Section Quêtes (dans Activité)** : Progression des quêtes de l'utilisateur depuis `quest_progress` avec join `quests`. Filtres par type de période (hebdo/mensuel/annuel) et statut (en cours/complétée/récompensée). Barre de progression colorée par statut. Formatage spécifique par type : `amount_spent` en euros (legacy), `cashback_earned` en PdB, `xp_earned` en XP, etc. Colonnes : Quête (lien), Période, Progression (barre + texte), Statut (badge coloré), Complétée le, Mise à jour.

**Fonction** : `getUserActivityStats(userId, startDate, endDate)` dans `userService.ts` — 3 requêtes parallèles (receipts, gains, spendings)
**Fonction** : `getUserGains(userId, limit, offset, sourceFilter?)` dans `userService.ts` — requête paginée `gains` avec join établissement
**Fonction** : `getUserQuestProgress(userId, limit, offset, periodTypeFilter?, statusFilter?)` dans `userService.ts` — requête paginée `quest_progress` avec join quête

### 3. Analytics Dashboard

**Fichiers cles** :
- `src/app/(dashboard)/page.tsx` - Dashboard principal
- `src/app/(dashboard)/analytics/page.tsx` - Tableau de bord analytique detaille (3 onglets)
- `src/lib/services/analyticsService.ts` - Statistiques et metriques

**Architecture** : 3 onglets avec filtres periode/etablissement/employe :

| Onglet | RPC | Contenu |
|--------|-----|---------|
| Recettes | `get_analytics_revenue` | Nombre de ventes, total euros (carte+especes), PdB depenses |
| Dettes | `get_analytics_debts` | PdB par categorie (organique/recompenses) + coupons % actifs |
| Stock PdB | `get_analytics_stock` | Stock ouverture/fermeture par categorie avec allocation proportionnelle |

**Filtres** :
- **Periode** : 6 presets (aujourd'hui, 7j, 30j, mois en cours, mois precedent, depuis le debut)
- **Etablissement** : filtre les recettes et PdB organiques. Recompenses affichent 0 quand filtre actif
- **Employe** : filtre via `receipts.employee_id`. Reset automatique au changement d'etablissement

**Categories PdB affichees (dettes)** :
- **Organique** : `source_type = 'receipt'` — PdB gagnes via depenses euros
- **Recompenses** : `source_type IN ('bonus_cashback_quest', 'bonus_cashback_leaderboard')` — quetes/classement

> **Note** : La categorie "Bonus Coupons" (`bonus_cashback_manual`, `bonus_cashback_trigger`, `bonus_cashback_migration`) existe toujours cote backend (les RPC `get_analytics_debts` et `get_analytics_stock` retournent les champs `pdb_bonus_coupons` / `bonus_coupons` / `earned_bonus_coupons`) mais n'est plus affichee dans le frontend admin. Les donnees historiques ont ete reclassees en `bonus_cashback_leaderboard`.

**Fonctions du service** :
```typescript
import {
  getAnalyticsRevenue,
  getAnalyticsDebts,
  getAnalyticsStock,
  getEmployeesByEstablishment
} from '@/lib/services/analyticsService';
```

### 4. Gestion des Modeles de Coupons (Templates)

**Fichiers cles** :
- `src/app/(dashboard)/templates/page.tsx` - Liste des modeles
- `src/app/(dashboard)/templates/create/page.tsx` - Creation de modele
- `src/app/(dashboard)/templates/[id]/page.tsx` - Edition de modele
- `src/lib/services/templateService.ts` - Service metier

**Fonctions disponibles** :
```typescript
import {
  getTemplates,
  getActiveTemplates,
  createTemplate,
  updateTemplate,
  toggleTemplateActive,
  deleteTemplate
} from '@/lib/services/templateService';

// Exemples d'utilisation
const templates = await getTemplates();
const activeTemplates = await getActiveTemplates();
await createTemplate({ name: 'Nouveau modele', amount: 500 });
await toggleTemplateActive(templateId, false);
```

### 5. Systeme de Recompenses (Rewards)

Systeme complet de gestion des recompenses par classement (leaderboard).

**Fichiers cles** :
- `src/app/(dashboard)/rewards/page.tsx` - Vue d'ensemble (inclut la liste des paliers)
- `src/app/(dashboard)/rewards/tiers/create/page.tsx` - Creation de palier
- `src/app/(dashboard)/rewards/tiers/[id]/page.tsx` - Edition de palier
- `src/app/(dashboard)/rewards/periods/page.tsx` - Configuration des periodes
- `src/app/(dashboard)/rewards/periods/create/page.tsx` - Creation de periode
- `src/app/(dashboard)/rewards/periods/[periodType]/[identifier]/page.tsx` - Detail periode
- `src/app/(dashboard)/rewards/distribute/page.tsx` - Distribution des recompenses
- `src/lib/services/rewardService.ts` - Service metier

**Structure d'un palier (Reward Tier)** :

| Champ | Type | Description |
|-------|------|-------------|
| id | BIGINT | PK |
| name | TEXT | Nom du palier (ex: "Top 1") |
| period_type | VARCHAR | weekly, monthly, yearly |
| rank_from | INTEGER | Rang de debut (ex: 1) |
| rank_to | INTEGER | Rang de fin (ex: 1) |
| coupon_template_id | BIGINT | FK vers coupon_templates |
| badge_type_id | BIGINT | FK vers badge_types |
| display_order | INTEGER | Ordre d'affichage |
| is_active | BOOLEAN | Actif ou non |

**Fonctions RPC** :
```typescript
// Previsualisation des recompenses a distribuer
const preview = await supabase.rpc('get_period_preview', {
  p_period_type: 'weekly'
});

// Distribution des recompenses
await supabase.rpc('distribute_period_rewards_v2', {
  p_period_type: 'weekly',
  p_period_identifier: '2026-W03'
});
```

**Fonctions du service** :
```typescript
import {
  getRewardTiers,
  createRewardTier,
  updateRewardTier,
  deleteRewardTier
} from '@/lib/services/rewardService';
```

**Paliers en prod (avril 2026, après refonte)** :

| Période | Champion | Podium 2-3 | Top 4-10 |
|---------|----------|------------|----------|
| Hebdo   | 5 € + badge epic | 3 € + badge rare | 2 € + badge common |
| Mensuel | 30 € + badge epic | 20 € + badge rare | 12 € + badge common |
| Annuel  | **50 € + badge legendary** | badge epic seul | badge rare seul |

L'ancien template `Coupon Hebdo 50€` (qui créditait en réalité 3,90 €) est désactivé. Les nouveaux templates s'appellent `Champion/Podium/Top 10 Hebdomadaire <montant>€` et `Champion Annuel 50€`.

### 5b. Cloture de saison (avril 2026)

Système de clôture annuelle 31/12 → 1/1 : snapshot du rang max → distribution badges « mémoire de saison » → reset coefficients à 1,0.

**Fichiers cles** :
- `src/app/(dashboard)/rewards/season/page.tsx` - UI de clôture (manuelle pour an 1)
- `src/lib/services/seasonService.ts` - Service métier (4 RPC + 2 queries)
- `src/lib/services/levelService.ts` - Helpers `levelToCoefficient`, `levelToRankName`

**Tables** :
- `season_snapshots` (year, customer_id, max_level, max_xp, max_coefficient, rank_name, rank_slug) — multi-saisons, PK composite garantit l'idempotence
- `season_closure_log` (year, step, executed_at, source, affected_rows, duration_ms, notes) — journal des étapes

**Fonctions RPC PostgreSQL** (toutes idempotentes) :

| Fonction | Description | Garde |
|----------|-------------|-------|
| `preview_season_closure(p_year)` | Dry-run : distribution simulée des rangs + état avancement | aucune |
| `snapshot_season(p_year, p_source)` | Étape 1/3 : fige les rangs dans `season_snapshots` | aucune |
| `award_season_rank_badges(p_year, p_source)` | Étape 2/3 : distribue les 6 badges saison | snapshot fait |
| `reset_season(p_year, p_source)` | Étape 3/3 : remet `cashback_coefficient = 100` partout | badges distribués |

`p_source` ∈ `'cron' | 'cron_fallback' | 'manual' | 'dry_run_aborted'`.

**Workflow attendu (an 1, décembre 2026)** :
1. Admin va sur `/rewards/season`
2. Sélectionne l'année 2026, vérifie le preview (distribution + total profils + PdB préservées)
3. Clique « Snapshot » → confirmation → exécution → toast
4. Clique « Distribuer badges » → idem (désactivé tant que snapshot pas fait)
5. Clique « Reset » → idem (désactivé tant que badges pas distribués)
6. Le journal en bas de page récapitule toutes les exécutions

**An 2+ (à faire ultérieurement)** : ajouter pg_cron (3 crons + fallback) selon spec dans `animation/01-fonctionnel/changelog-anticipe.md`.

**Important** :
- Le reset ne touche **pas** au solde PdB (table `gains` intacte)
- Le reset ne touche **pas** au `xp_coefficient` (réservé aux promos admin)
- Le « niveau » se réinitialise implicitement : `get_season_xp(customer_id)` filtre `gains.created_at` par année courante, donc dès le 1/1 le total saison redémarre à 0

### 6. Gestion des Quetes

Systeme de defis periodiques pour les utilisateurs.

**Fichiers cles** :
- `src/app/(dashboard)/quests/page.tsx` - Liste des quetes
- `src/app/(dashboard)/quests/create/page.tsx` - Creation de quete
- `src/app/(dashboard)/quests/[id]/page.tsx` - Edition de quete
- `src/lib/services/questService.ts` - Service metier
- `src/lib/services/periodService.ts` - Gestion des periodes

**Types de quetes** :

| Type | Description | Unite objectif |
|------|-------------|----------------|
| `xp_earned` | Gagner de l'XP | XP |
| `cashback_earned` | Collecter des Paraiges de Bronze (ajouté migration 028) | PdB (1 PdB = 1 centime). Target saisi directement en PdB, pas de conversion. Progression = SUM(`gains.cashback_money`) sur la période, coefficient client et bonus coupons inclus. |
| `amount_spent` | Depenser de l'argent (**déprécié** avril 2026) | Euros (€) dans le frontend, centimes en BDD. Retiré du formulaire de création ; conservé dans l'enum et la logique d'édition pour compatibilité. |
| `establishments_visited` | Visiter des etablissements | Nombre |
| `orders_count` | Passer des commandes | Nombre |
| `quest_completed` | Completer des quetes dans N sous-periodes | Nombre de sous-periodes (monthly→weekly, yearly→monthly). Incompatible avec `weekly`. |
| `consumption_count` | Consommer N produits d'un type donné | Nombre. **Champ supplémentaire requis** : `quests.consumption_type` (biere, cocktail, alcool, soft, boisson_chaude, restauration). Calcul via SUM(`receipt_consumption_items.quantity`) sur la période. |

**Statuts de progression (`quest_progress.status`)** :

| Statut | Description |
|--------|-------------|
| `in_progress` | Quete en cours, periode pas encore terminee |
| `completed` | Objectif atteint, recompense pas encore distribuee |
| `rewarded` | Recompense distribuee |
| `expired` | Periode terminee sans completion (mis a jour automatiquement par `expire_quest_progress()` via pg_cron quotidien) |

**Meta-quetes (`quest_completed`)** :

> Les quetes de type `quest_completed` sont des "meta-quetes" qui trackent la completion d'autres quetes sur des sous-periodes. Exemple : une quete mensuelle "Complete au moins 1 quete hebdo pendant 4 semaines" avec `target_value = 4`. La progression est calculee en comptant les `DISTINCT period_identifier` dans `quest_completion_logs`. La propagation se fait via `update_meta_quest_progress()` appelee par le trigger `distribute_quest_rewards`. La chaine est naturellement limitee : weekly → monthly → yearly → fin.

**Conversion Euros/Centimes** :

> **IMPORTANT** : Le champ `target_value` pour le type `amount_spent` est stocke en **centimes** dans la base de donnees, mais saisi et affiche en **euros** dans le frontend.

```typescript
// Saisie → Sauvegarde (euros → centimes)
const targetValue = form.questType === "amount_spent"
  ? Math.round(parseFloat(form.targetValue) * 100)
  : parseInt(form.targetValue);

// Chargement → Affichage (centimes → euros)
const targetValueDisplay = quest.quest_type === "amount_spent"
  ? (quest.target_value / 100).toString()
  : quest.target_value.toString();
```

**Fonctions du service** :
```typescript
import {
  getQuests,
  getActiveQuests,
  getQuest,
  createQuest,
  updateQuest,
  deleteQuest,
  toggleQuestActive,
  getQuestPeriods,
  setQuestPeriods
} from '@/lib/services/questService';
```

### 6b. Gestion des Badges succès (avril 2026)

**Fichiers clés** :
- `src/app/(dashboard)/rewards/achievements/page.tsx` — Liste des badges achievement actifs (`category = 'achievement' AND archived_at IS NULL`), tri par date de création décroissante.
- `src/app/(dashboard)/rewards/achievements/create/page.tsx` — Formulaire de création, attribution rétroactive automatique au submit.
- `src/app/(dashboard)/rewards/achievements/[id]/page.tsx` — Édition + bouton « Réévaluer pour tous » + AlertDialog soft-delete (`archived_at = now()`).
- `src/app/(dashboard)/rewards/achievements/_form/AchievementBadgeForm.tsx` — Formulaire dynamique (switch sur `criterion_type` → champs `threshold` / `min_cities` / `n_weeks` conditionnels). Pattern copié de `quests/create/page.tsx`.
- `src/lib/services/achievementBadgeService.ts` — CRUD complet + `archiveAchievementBadge` (soft-delete) + `reawardAchievementBadge` (via RPC `award_achievements_for_all_for_badge`).

**Règles de conception** :
- **Soft-delete uniquement** : la FK `user_badges.badge_id` est `ON DELETE CASCADE` — un hard-delete effacerait tous les badges déjà obtenus. Passer par `archived_at`.
- **`criterion_type` extensible** : ajouter un nouveau type nécessite (1) une fonction SQL `check_achievement_*` + `progress_achievement_*` (migration), (2) une entrée `CASE` dans chaque dispatcher (`award_achievements_for_user`, `get_achievement_progress`), (3) une option dans `CRITERION_OPTIONS` du formulaire admin.
- **RLS durcie depuis migration 030** : `award_achievements_for_all_for_badge` requiert `get_current_user_role() = 'admin'`. Le client Supabase admin s'exécute bien dans ce rôle via RLS.

### 7. Gestion du Contenu

**Fichiers cles** :
- `src/app/(dashboard)/content/beers/page.tsx` - Liste des bieres
- `src/app/(dashboard)/content/beers/[id]/page.tsx` - Detail/edition biere
- `src/app/(dashboard)/content/establishments/page.tsx` - Liste des etablissements
- `src/app/(dashboard)/content/establishments/[id]/page.tsx` - Detail/edition etablissement (2 onglets)
- `src/lib/services/contentService.ts` - Service metier

**Onglets detail etablissement** : Informations | **Statistiques**

**Onglet Statistiques** : Affiche 6 KPI filtrables par période via `PeriodSelector` + filtre employé :
- *Recettes* : Ventes (nombre), CA Enregistré (euros, detail carte/espèces), PdB Dépensés
- *Dettes PdB* : PdB Organiques, PdB Récompenses, Total Dettes PdB

Réutilise `getAnalyticsRevenue()`, `getAnalyticsDebts()` et `getEmployeesByEstablishment()` de `analyticsService.ts`.

## Schema de la Base de Donnees (Resume)

### Table `coupons`

| Colonne | Type | Description |
|---------|------|-------------|
| id | BIGINT | PK |
| customer_id | UUID | FK vers profiles |
| amount | INTEGER | Montant en centimes (ou NULL) |
| percentage | INTEGER | Pourcentage (ou NULL) |
| used | BOOLEAN | Coupon utilise ? |
| expires_at | TIMESTAMPTZ | Date d'expiration |
| distribution_type | VARCHAR | Source (manual, leaderboard, etc.) |
| template_id | BIGINT | FK vers coupon_templates |
| period_identifier | VARCHAR | Periode associee (ex: 2026-W06) |

> Documentation complete : `docs/docs/supabase/tables/coupons.md`

### Table `profiles`

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | PK (= auth.users.id) |
| email | TEXT | Email |
| first_name | TEXT | Prenom |
| last_name | TEXT | Nom |
| username | TEXT | Nom d'utilisateur (genere auto) |
| role | user_role | client, employee, establishment, admin |
| avatar_url | TEXT | URL de l'avatar |
| phone | TEXT | Telephone |
| birthdate | DATE | Date de naissance |
| xp_coefficient | INTEGER | Coefficient XP (defaut: 100, ×100). Réservé aux promos admin, jamais reset. |
| cashback_coefficient | INTEGER | Coefficient cashback (×100). Maintenu auto par trigger sur `gains` : `100 + (level-1)*20` (avril 2026). Reset à 100 au 31/12. |
| attached_establishment_id | INTEGER | FK vers establishments (pour employees/gerants) |

> **Note** : `total_xp` et `cashback_balance` ne sont PAS des colonnes de `profiles`. Ils sont calcules via la vue materialisee `user_stats` (qui agrege depuis `gains`).

> Documentation complete : `docs/docs/supabase/tables/profiles.md`

### Table `gains`

| Colonne | Type | Description |
|---------|------|-------------|
| id | BIGINT | PK |
| customer_id | UUID | FK vers profiles (NOT NULL) |
| receipt_id | BIGINT | FK vers receipts (NULL pour bonus cashback) |
| establishment_id | INTEGER | FK vers establishments (NULL pour bonus cashback) |
| xp | INTEGER | XP gagne |
| cashback_money | INTEGER | Cashback gagne (centimes) |
| source_type | VARCHAR | Source: receipt, bonus_cashback_manual, bonus_cashback_leaderboard, bonus_cashback_quest, bonus_cashback_trigger |
| coupon_id | BIGINT | FK vers coupons (pour bonus cashback) |
| period_identifier | VARCHAR | Periode associee (ex: 2026-W06) |

> Table centrale du systeme de gains. Relie les profils aux XP et cashback gagnes, que ce soit via des tickets ou des bonus cashback directs.

> Documentation complete : `docs/docs/supabase/tables/gains.md`

### Table `receipt_consumption_items`

| Colonne | Type | Description |
|---------|------|-------------|
| id | BIGINT | PK |
| created_at | TIMESTAMPTZ | Date de creation |
| receipt_id | BIGINT | FK vers receipts (ON DELETE CASCADE) |
| consumption_type | consumption_type | Type de consommation (ENUM) |
| quantity | INTEGER | Quantite (> 0) |

### ENUM `consumption_type`

`cocktail`, `biere`, `alcool`, `soft`, `boisson_chaude`, `restauration`

> Tracking optionnel des types de consommation. Insere via `create_receipt(p_consumption_items)`.

> Documentation complete : `docs/docs/supabase/tables/receipt_consumption_items.md`

## Systeme Bonus Cashback (Fevrier 2026)

Refonte majeure du systeme de coupons : les coupons a montant fixe sont desormais credites directement en cashback.

### Coupons montant fixe → Bonus Cashback

- Credites **immediatement** au solde cashback du client via la table `gains`
- Le coupon est cree avec `used = true` et `expires_at = NULL`
- La fonction `credit_bonus_cashback()` insere un gain avec `source_type` = `bonus_cashback_manual`, `bonus_cashback_leaderboard`, `bonus_cashback_quest` ou `bonus_cashback_trigger`
- `validate_coupons()` **rejette** les coupons montant fixe (deja consommes)
- `get_customer_available_coupons()` ne retourne **que** les coupons pourcentage

### Coupons pourcentage → Bonus cashback sur commande

- Toujours utilisables sur les commandes via `create_receipt()`
- Ajoutent un bonus cashback de X% du montant total au lieu de reduire le prix
- Plus de `receipt_lines` avec `payment_method = 'coupon'`

### Vue materialisee `user_stats`

- Joint `profiles → gains` directement (plus via receipts)
- Calcule `total_xp`, `cashback_earned`, `cashback_spent`, `cashback_available`
- Rafraichie automatiquement par `credit_bonus_cashback()` et `create_receipt()`

### Fonction `credit_bonus_cashback()`

```typescript
// Via RPC
await (supabase.rpc as any)('credit_bonus_cashback', {
  p_customer_id: 'uuid',
  p_amount: 500,           // 5.00€ en centimes
  p_coupon_id: 123,        // Optionnel
  p_source_type: 'bonus_cashback_manual',
  p_period_identifier: '2026-W06'  // Optionnel
});
```

## Roles Utilisateurs

| Role | Description | Acces Admin |
|------|-------------|-------------|
| `admin` | Administrateur | Complet |
| `establishment` | Gerant d'etablissement | Limite |
| `employee` | Employe (serveur) | Aucun |
| `client` | Client | Aucun |

## Commandes de Developpement

```bash
# Installation
npm install

# Developpement
npm run dev

# Build production
npm run build

# Linting
npm run lint

# Generer les types Supabase
npm run supabase:types
```

## Variables d'Environnement

```env
NEXT_PUBLIC_SUPABASE_URL=https://uflgfsoekkgegdgecubb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

## Conventions de Code

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
- `quest_type === "amount_spent"` (déprécié) : `parseFloat(value) * 100` → centimes
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

- **Supabase Dashboard** : https://app.supabase.com/project/uflgfsoekkgegdgecubb

---

**Derniere mise a jour** : 2026-04-19 (refonte mécaniques de jeu)

## Tâches en attente

Voir `animation/01-fonctionnel/changelog-anticipe.md` pour la liste complète. Côté admin, à venir :

- **Refonte des quêtes** (différée, gros chantier) : changement de modèle vers « one-shot par période ». Va impacter `/quests/*`, services, types.
- **Cron auto pour la clôture an 2+** : 3 pg_cron + 3 fallbacks à mettre en place après validation manuelle de la saison 2026.
- **Setup staging propre** : Supabase Branches (option A) à industrialiser. Pour l'instant, les migrations partent direct en prod sur décision Basile.
- **Modal level-up enrichie** : afficher « Tu gagnes désormais X,Y PdB par € » au franchissement d'un niveau (côté front, mais visualisable depuis l'admin via simulation).
