# Royaume des Paraiges - Admin Dashboard

> Interface d'administration du Royaume des Paraiges

## Demarrage Rapide

```bash
npm install
npm run dev
```

L'application sera disponible sur [http://localhost:3000](http://localhost:3000)

---

## Stack Technique

| Technologie | Version | Usage |
|-------------|---------|-------|
| Next.js | 16.1.4 | Framework React avec App Router |
| React | 19.2.3 | Bibliotheque UI |
| TypeScript | 5.7.3 | Typage statique |
| Supabase | 2.47.14 | Backend (Auth, Database, Storage) |
| Radix UI / shadcn/ui | - | Composants UI |
| Tailwind CSS | 3.4.17 | Styling |
| Recharts | 2.15.0 | Graphiques |

---

## Fonctionnalites

### Gestion des Utilisateurs
- Liste et recherche des utilisateurs
- Consultation des profils detailles
- Historique des transactions par utilisateur

### Gestion des Coupons
- Creation de coupons manuels (gestes commerciaux)
- Suivi des coupons distribues et utilises
- Filtrage par statut, type, utilisateur

### Modeles de Coupons (Templates)
- Creation et gestion des modeles de coupons
- Activation/desactivation des modeles
- Utilisation pour la creation manuelle et automatique

### Systeme de Recompenses
- Configuration des paliers de recompenses (weekly, monthly, yearly)
- Attribution de coupons et badges par rang
- Distribution automatique des recompenses du leaderboard
- Previsualisation avant distribution

### Analytics
- Tableau de bord avec metriques cles
- Graphiques de tendances
- Statistiques des utilisateurs et transactions

### Gestion du Contenu
- Administration des bieres
- Administration des etablissements

---

## Variables d'Environnement

Creez un fichier `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://uflgfsoekkgegdgecubb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon
```

---

## Scripts Disponibles

```bash
# Developpement
npm run dev

# Build production
npm run build

# Lancement production
npm start

# Linting
npm run lint

# Generation des types Supabase
npm run supabase:types
```

---

## Structure du Projet

```
src/
├── app/                      # Routes Next.js (App Router)
│   ├── (auth)/               # Authentification
│   └── (dashboard)/          # Dashboard (routes protegees)
│       ├── analytics/        # Tableau de bord analytique
│       ├── coupons/          # Gestion des coupons
│       ├── templates/        # Modeles de coupons
│       ├── users/            # Gestion des utilisateurs
│       ├── receipts/         # Historique des tickets
│       ├── rewards/          # Systeme de recompenses
│       │   ├── tiers/        # Paliers de recompenses
│       │   ├── periods/      # Configuration des periodes
│       │   └── distribute/   # Distribution
│       └── content/          # Contenu (bieres, etablissements)
├── components/               # Composants React
│   ├── ui/                   # shadcn/ui
│   └── layout/               # Layout
├── lib/                      # Utilitaires
│   ├── services/             # Services metier
│   └── supabase/             # Client Supabase
└── types/                    # Types TypeScript
```

---

## Documentation

La documentation complete du backend est disponible dans le submodule `docs/` :
- `docs/docs/supabase/` - Schema de base de donnees, fonctions RPC, politiques RLS

Pour les instructions detaillees destinees aux agents IA, consultez `CLAUDE.md`.

---

## Roles et Acces

| Role | Description | Acces Admin |
|------|-------------|-------------|
| `admin` | Administrateur | Complet |
| `establishment` | Gerant d'etablissement | Limite |
| `employee` | Employe (serveur) | Aucun |
| `client` | Client | Aucun |

---

## License

Projet prive - Royaume des Paraiges

---

*Derniere mise a jour : 2026-01-23*

<!-- post-org-conversion deploy check: 2026-05-13 -->
