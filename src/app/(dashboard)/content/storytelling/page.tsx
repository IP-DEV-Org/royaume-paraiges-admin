"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Pencil,
  BookOpen,
  Plus,
  Trash2,
  Crown,
  AlertTriangle,
} from "lucide-react";
import {
  getLevelThresholds,
  getXpPerEuro,
  updateLevelThreshold,
  createLevelThreshold,
  deleteLevelThreshold,
} from "@/lib/services/contentService";
import type { LevelThreshold } from "@/lib/services/contentService";
import {
  levelToCoefficient,
  resolveRankName,
} from "@/lib/services/levelService";
import {
  getRanks,
  createRank,
  updateRank,
  deleteRank,
} from "@/lib/services/rankService";
import { rankKeys } from "@/lib/queries/keys";
import type { Rank } from "@/types/database";
import { toast } from "sonner";

interface LevelForm {
  name: string;
  xp_required: string;
  description: string;
  lore: string;
}

interface RankForm {
  name: string;
  slug: string;
  min_level: string;
  max_level: string;
  sort_order: string;
}

const emptyLevelForm: LevelForm = {
  name: "",
  xp_required: "",
  description: "",
  lore: "",
};
const emptyRankForm: RankForm = {
  name: "",
  slug: "",
  min_level: "",
  max_level: "",
  sort_order: "",
};

const LEVELS_QUERY_KEY = ["storytelling", "levels"] as const;
const XP_PER_EURO_QUERY_KEY = ["storytelling", "xp_per_euro"] as const;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function StorytellingPage() {
  const queryClient = useQueryClient();

  const { data: levels = [], isLoading: levelsLoading } = useQuery({
    queryKey: LEVELS_QUERY_KEY,
    queryFn: getLevelThresholds,
  });
  const { data: xpPerEuro = 10 } = useQuery({
    queryKey: XP_PER_EURO_QUERY_KEY,
    queryFn: getXpPerEuro,
  });
  const { data: ranks = [], isLoading: ranksLoading } = useQuery({
    queryKey: rankKeys.lists(),
    queryFn: getRanks,
  });

  // --- État édition Niveaux ---
  const [editingLevel, setEditingLevel] = useState<LevelThreshold | null>(null);
  const [creatingLevel, setCreatingLevel] = useState(false);
  const [levelForm, setLevelForm] = useState<LevelForm>(emptyLevelForm);
  const [savingLevel, setSavingLevel] = useState(false);
  const [deleteLevelTarget, setDeleteLevelTarget] = useState<LevelThreshold | null>(null);
  const [deletingLevel, setDeletingLevel] = useState(false);

  // --- État édition Rangs ---
  const [editingRank, setEditingRank] = useState<Rank | null>(null);
  const [creatingRank, setCreatingRank] = useState(false);
  const [rankForm, setRankForm] = useState<RankForm>(emptyRankForm);
  const [savingRank, setSavingRank] = useState(false);
  const [deleteRankTarget, setDeleteRankTarget] = useState<Rank | null>(null);
  const [deletingRank, setDeletingRank] = useState(false);

  const rankOverlapWarning = useMemo(() => {
    const sorted = [...ranks].sort((a, b) => a.min_level - b.min_level);
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (current && next && current.max_level >= next.min_level) {
        return `Chevauchement entre « ${current.name} » (${current.min_level}-${current.max_level}) et « ${next.name} » (${next.min_level}-${next.max_level}).`;
      }
    }
    return null;
  }, [ranks]);

  // --- Helpers Niveaux ---
  const openEditLevel = (level: LevelThreshold) => {
    setEditingLevel(level);
    setLevelForm({
      name: level.name,
      xp_required: String(level.xp_required),
      description: level.description || "",
      lore: level.lore || "",
    });
  };

  const openCreateLevel = () => {
    const lastXp = levels.length > 0 ? levels[levels.length - 1]?.xp_required ?? 0 : 0;
    setLevelForm({
      name: "",
      xp_required: String(lastXp > 0 ? lastXp + 1000 : 0),
      description: "",
      lore: "",
    });
    setCreatingLevel(true);
  };

  const validateLevelForm = (): {
    name: string;
    xp_required: number;
    description: string | null;
    lore: string | null;
  } | null => {
    const xpValue = parseInt(levelForm.xp_required, 10);
    if (!levelForm.name.trim()) {
      toast.error("Le nom du niveau est obligatoire");
      return null;
    }
    if (isNaN(xpValue) || xpValue < 0) {
      toast.error("L'XP requis doit être un nombre positif");
      return null;
    }
    return {
      name: levelForm.name.trim(),
      xp_required: xpValue,
      description: levelForm.description.trim() || null,
      lore: levelForm.lore.trim() || null,
    };
  };

  const handleSaveLevel = async () => {
    if (!editingLevel) return;
    const payload = validateLevelForm();
    if (!payload) return;

    setSavingLevel(true);
    try {
      await updateLevelThreshold(editingLevel.id, payload);
      await queryClient.invalidateQueries({ queryKey: LEVELS_QUERY_KEY });
      toast.success("Niveau mis à jour");
      setEditingLevel(null);
    } catch {
      toast.error("Impossible de modifier le niveau");
    } finally {
      setSavingLevel(false);
    }
  };

  const handleCreateLevel = async () => {
    const payload = validateLevelForm();
    if (!payload) return;

    const nextLevel =
      levels.length > 0 ? Math.max(...levels.map((l) => l.level)) + 1 : 1;

    setSavingLevel(true);
    try {
      await createLevelThreshold({ level: nextLevel, ...payload });
      await queryClient.invalidateQueries({ queryKey: LEVELS_QUERY_KEY });
      toast.success("Niveau créé");
      setCreatingLevel(false);
    } catch {
      toast.error("Impossible de créer le niveau");
    } finally {
      setSavingLevel(false);
    }
  };

  const handleDeleteLevel = async () => {
    if (!deleteLevelTarget) return;
    setDeletingLevel(true);
    try {
      await deleteLevelThreshold(deleteLevelTarget.id);
      await queryClient.invalidateQueries({ queryKey: LEVELS_QUERY_KEY });
      toast.success("Niveau supprimé");
      setDeleteLevelTarget(null);
      setEditingLevel(null);
    } catch {
      toast.error("Impossible de supprimer le niveau");
    } finally {
      setDeletingLevel(false);
    }
  };

  const closeLevelDialog = () => {
    setEditingLevel(null);
    setCreatingLevel(false);
  };
  const isLevelDialogOpen = !!editingLevel || creatingLevel;

  // --- Helpers Rangs ---
  const openEditRank = (rank: Rank) => {
    setEditingRank(rank);
    setRankForm({
      name: rank.name,
      slug: rank.slug,
      min_level: String(rank.min_level),
      max_level: String(rank.max_level),
      sort_order: String(rank.sort_order),
    });
  };

  const openCreateRank = () => {
    const nextSortOrder =
      ranks.length > 0 ? Math.max(...ranks.map((r) => r.sort_order)) + 1 : 1;
    const nextMin =
      ranks.length > 0 ? Math.max(...ranks.map((r) => r.max_level)) + 1 : 1;
    setRankForm({
      name: "",
      slug: "",
      min_level: String(nextMin),
      max_level: String(nextMin),
      sort_order: String(nextSortOrder),
    });
    setCreatingRank(true);
  };

  const validateRankForm = (): {
    name: string;
    slug: string;
    min_level: number;
    max_level: number;
    sort_order: number;
  } | null => {
    const name = rankForm.name.trim();
    const slug = rankForm.slug.trim() || slugify(name);
    const minLevel = parseInt(rankForm.min_level, 10);
    const maxLevel = parseInt(rankForm.max_level, 10);
    const sortOrder = parseInt(rankForm.sort_order, 10) || 0;

    if (!name) {
      toast.error("Le nom du rang est obligatoire");
      return null;
    }
    if (!slug || !/^[a-z0-9_]+$/.test(slug)) {
      toast.error("Slug invalide (a-z, 0-9, _ uniquement)");
      return null;
    }
    if (isNaN(minLevel) || minLevel < 1) {
      toast.error("Niveau min invalide");
      return null;
    }
    if (isNaN(maxLevel) || maxLevel < 1) {
      toast.error("Niveau max invalide");
      return null;
    }
    if (minLevel > maxLevel) {
      toast.error("Niveau min doit être <= niveau max");
      return null;
    }

    // Chevauchement avec les autres rangs (alerte non bloquante).
    const others = ranks.filter((r) => r.id !== editingRank?.id);
    const overlap = others.find(
      (r) => minLevel <= r.max_level && maxLevel >= r.min_level,
    );
    if (overlap) {
      const ok = window.confirm(
        `Chevauchement avec « ${overlap.name} » (${overlap.min_level}-${overlap.max_level}). Continuer ?`,
      );
      if (!ok) return null;
    }

    return {
      name,
      slug,
      min_level: minLevel,
      max_level: maxLevel,
      sort_order: sortOrder,
    };
  };

  const handleSaveRank = async () => {
    if (!editingRank) return;
    const payload = validateRankForm();
    if (!payload) return;

    setSavingRank(true);
    try {
      await updateRank(editingRank.id, payload);
      await queryClient.invalidateQueries({ queryKey: rankKeys.all });
      toast.success("Rang mis à jour");
      setEditingRank(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      toast.error(`Impossible de modifier le rang : ${msg}`);
    } finally {
      setSavingRank(false);
    }
  };

  const handleCreateRank = async () => {
    const payload = validateRankForm();
    if (!payload) return;

    setSavingRank(true);
    try {
      await createRank(payload);
      await queryClient.invalidateQueries({ queryKey: rankKeys.all });
      toast.success("Rang créé");
      setCreatingRank(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      toast.error(`Impossible de créer le rang : ${msg}`);
    } finally {
      setSavingRank(false);
    }
  };

  const handleDeleteRank = async () => {
    if (!deleteRankTarget) return;
    setDeletingRank(true);
    try {
      await deleteRank(deleteRankTarget.id);
      await queryClient.invalidateQueries({ queryKey: rankKeys.all });
      toast.success("Rang supprimé");
      setDeleteRankTarget(null);
      setEditingRank(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      toast.error(`Impossible de supprimer le rang : ${msg}`);
    } finally {
      setDeletingRank(false);
    }
  };

  const closeRankDialog = () => {
    setEditingRank(null);
    setCreatingRank(false);
  };
  const isRankDialogOpen = !!editingRank || creatingRank;

  if (levelsLoading || ranksLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Storytelling</h1>
          <p className="text-muted-foreground">
            Gérez les rangs et les textes narratifs affichés sur la homepage
          </p>
        </div>
      </div>

      {/* Card Rangs */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Rangs
            </CardTitle>
            <CardDescription>
              Groupes de niveaux affichés dans le tableau ci-dessous. Modifier
              ici n&apos;impacte que l&apos;admin (pas l&apos;app cliente ni les
              badges de saison).
            </CardDescription>
          </div>
          <Button onClick={openCreateRank} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un rang
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {rankOverlapWarning && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>{rankOverlapWarning}</span>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Ordre</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="w-[100px] text-right">Niv. min</TableHead>
                <TableHead className="w-[100px] text-right">Niv. max</TableHead>
                <TableHead className="w-[100px] text-right">Niveaux</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    Aucun rang configuré. Ajoute-en un pour commencer.
                  </TableCell>
                </TableRow>
              )}
              {[...ranks]
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((rank) => (
                  <TableRow key={rank.id}>
                    <TableCell className="font-bold">{rank.sort_order}</TableCell>
                    <TableCell className="font-medium">{rank.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {rank.slug}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rank.min_level}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rank.max_level}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {rank.max_level - rank.min_level + 1}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditRank(rank)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Card Niveaux */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Lore par niveau
            </CardTitle>
            <CardDescription>
              Chaque joueur voit le texte correspondant à son niveau actuel sur la homepage
            </CardDescription>
          </div>
          <Button onClick={openCreateLevel} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un niveau
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Niv.</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead className="w-[200px]">Rang</TableHead>
                <TableHead className="w-[100px] text-right">XP requis</TableHead>
                <TableHead className="w-[100px] text-right">Δ XP</TableHead>
                <TableHead className="w-[110px] text-right">Équiv. €</TableHead>
                <TableHead className="w-[110px] text-right">Coef. PdB</TableHead>
                <TableHead>Lore</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {levels.map((level, index) => {
                const previousXp =
                  index > 0 ? (levels[index - 1]?.xp_required ?? 0) : 0;
                const xpDelta = level.xp_required - previousXp;
                const equivalentEuros =
                  xpPerEuro > 0 ? level.xp_required / xpPerEuro : 0;
                return (
                  <TableRow key={level.id}>
                    <TableCell className="font-bold">{level.level}</TableCell>
                    <TableCell className="font-medium">{level.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {resolveRankName(level.level, ranks)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {level.xp_required.toLocaleString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {index === 0
                        ? "—"
                        : `+${xpDelta.toLocaleString("fr-FR")}`}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {equivalentEuros.toLocaleString("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                        maximumFractionDigits: 0,
                      })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      ×{" "}
                      {levelToCoefficient(level.level).toLocaleString("fr-FR", {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}
                    </TableCell>
                    <TableCell className="max-w-[400px] truncate text-muted-foreground">
                      {level.lore || <span className="italic">Aucun lore</span>}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditLevel(level)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog création / édition niveau */}
      <Dialog
        open={isLevelDialogOpen}
        onOpenChange={(open) => !open && closeLevelDialog()}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {creatingLevel
                ? "Ajouter un niveau"
                : `Modifier le niveau ${editingLevel?.level}`}
            </DialogTitle>
            <DialogDescription>
              {creatingLevel
                ? `Ce sera le niveau ${
                    levels.length > 0
                      ? Math.max(...levels.map((l) => l.level)) + 1
                      : 1
                  }`
                : `Rang : ${
                    editingLevel ? resolveRankName(editingLevel.level, ranks) : ""
                  } · Coef. PdB : × ${
                    editingLevel
                      ? levelToCoefficient(editingLevel.level).toLocaleString(
                          "fr-FR",
                          { minimumFractionDigits: 1 },
                        )
                      : ""
                  }`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nom du niveau</Label>
                <Input
                  id="edit-name"
                  value={levelForm.name}
                  onChange={(e) =>
                    setLevelForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Ex : Écuyer I"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-xp">XP requis</Label>
                <Input
                  id="edit-xp"
                  type="number"
                  min={0}
                  value={levelForm.xp_required}
                  onChange={(e) =>
                    setLevelForm((f) => ({ ...f, xp_required: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={levelForm.description}
                onChange={(e) =>
                  setLevelForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Description courte du niveau..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lore">Lore</Label>
              <Textarea
                id="edit-lore"
                value={levelForm.lore}
                onChange={(e) =>
                  setLevelForm((f) => ({ ...f, lore: e.target.value }))
                }
                placeholder="Ex : Bienvenue dans le Royaume, jeune aventurier..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="flex-row justify-between sm:justify-between">
            {editingLevel && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteLevelTarget(editingLevel)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={closeLevelDialog}>
                Annuler
              </Button>
              <Button
                onClick={creatingLevel ? handleCreateLevel : handleSaveLevel}
                disabled={savingLevel}
              >
                {savingLevel && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {creatingLevel ? "Créer" : "Enregistrer"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog création / édition rang */}
      <Dialog
        open={isRankDialogOpen}
        onOpenChange={(open) => !open && closeRankDialog()}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {creatingRank ? "Ajouter un rang" : `Modifier le rang « ${editingRank?.name} »`}
            </DialogTitle>
            <DialogDescription>
              Définit la plage de niveaux et le libellé affiché dans la colonne
              « Rang ».
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rank-name">Nom</Label>
              <Input
                id="rank-name"
                value={rankForm.name}
                onChange={(e) => {
                  const value = e.target.value;
                  setRankForm((f) => ({
                    ...f,
                    name: value,
                    // auto-fill slug uniquement à la création tant qu'il est vide
                    slug:
                      creatingRank && !f.slug ? slugify(value) : f.slug,
                  }));
                }}
                placeholder="Ex : Écuyer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rank-slug">Slug</Label>
              <Input
                id="rank-slug"
                value={rankForm.slug}
                onChange={(e) =>
                  setRankForm((f) => ({ ...f, slug: e.target.value }))
                }
                placeholder="ecuyer"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                a-z, 0-9, _ uniquement. Identifiant interne.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rank-min">Niveau min</Label>
                <Input
                  id="rank-min"
                  type="number"
                  min={1}
                  value={rankForm.min_level}
                  onChange={(e) =>
                    setRankForm((f) => ({ ...f, min_level: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rank-max">Niveau max</Label>
                <Input
                  id="rank-max"
                  type="number"
                  min={1}
                  value={rankForm.max_level}
                  onChange={(e) =>
                    setRankForm((f) => ({ ...f, max_level: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rank-order">Ordre</Label>
                <Input
                  id="rank-order"
                  type="number"
                  min={0}
                  value={rankForm.sort_order}
                  onChange={(e) =>
                    setRankForm((f) => ({ ...f, sort_order: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-row justify-between sm:justify-between">
            {editingRank && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteRankTarget(editingRank)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={closeRankDialog}>
                Annuler
              </Button>
              <Button
                onClick={creatingRank ? handleCreateRank : handleSaveRank}
                disabled={savingRank}
              >
                {savingRank && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {creatingRank ? "Créer" : "Enregistrer"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression niveau */}
      <AlertDialog
        open={!!deleteLevelTarget}
        onOpenChange={(open) => !open && setDeleteLevelTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer le niveau {deleteLevelTarget?.level} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Le niveau « {deleteLevelTarget?.name} » sera définitivement
              supprimé. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingLevel}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLevel}
              disabled={deletingLevel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingLevel && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation suppression rang */}
      <AlertDialog
        open={!!deleteRankTarget}
        onOpenChange={(open) => !open && setDeleteRankTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer le rang « {deleteRankTarget?.name} » ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Le rang sera supprimé de la BDD. Les niveaux qu&apos;il couvrait
              afficheront le rang du fallback hardcodé (ou un autre rang qui
              couvre la plage).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingRank}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRank}
              disabled={deletingRank}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingRank && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
