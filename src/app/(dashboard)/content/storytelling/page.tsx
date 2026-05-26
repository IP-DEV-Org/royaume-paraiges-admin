"use client";

import { useEffect, useState } from "react";
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
import { Loader2, Pencil, BookOpen, Plus, Trash2 } from "lucide-react";
import {
  getLevelThresholds,
  getXpPerEuro,
  updateLevelThreshold,
  createLevelThreshold,
  deleteLevelThreshold,
} from "@/lib/services/contentService";
import type { LevelThreshold } from "@/lib/services/contentService";
import { levelToCoefficient, levelToRankName } from "@/lib/services/levelService";
import { toast } from "sonner";

interface LevelForm {
  name: string;
  xp_required: string;
  description: string;
  lore: string;
}

const emptyForm: LevelForm = { name: "", xp_required: "", description: "", lore: "" };

export default function StorytellingPage() {
  const [levels, setLevels] = useState<LevelThreshold[]>([]);
  const [xpPerEuro, setXpPerEuro] = useState<number>(10);
  const [loading, setLoading] = useState(true);

  const [editingLevel, setEditingLevel] = useState<LevelThreshold | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<LevelForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<LevelThreshold | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [data, ratio] = await Promise.all([
          getLevelThresholds(),
          getXpPerEuro(),
        ]);
        setLevels(data);
        setXpPerEuro(ratio);
      } catch {
        toast.error("Impossible de charger les niveaux");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const openEdit = (level: LevelThreshold) => {
    setEditingLevel(level);
    setForm({
      name: level.name,
      xp_required: String(level.xp_required),
      description: level.description || "",
      lore: level.lore || "",
    });
  };

  const openCreate = () => {
    const maxLevel = levels.length > 0 ? Math.max(...levels.map((l) => l.level)) : 0;
    const lastXp = levels.length > 0 ? levels[levels.length - 1]?.xp_required ?? 0 : 0;
    setForm({
      name: "",
      xp_required: String(lastXp > 0 ? lastXp + 1000 : 0),
      description: "",
      lore: "",
    });
    setCreating(true);
  };

  const validateForm = (): { name: string; xp_required: number; description: string | null; lore: string | null } | null => {
    const xpValue = parseInt(form.xp_required, 10);
    if (!form.name.trim()) {
      toast.error("Le nom du niveau est obligatoire");
      return null;
    }
    if (isNaN(xpValue) || xpValue < 0) {
      toast.error("L'XP requis doit être un nombre positif");
      return null;
    }
    return {
      name: form.name.trim(),
      xp_required: xpValue,
      description: form.description.trim() || null,
      lore: form.lore.trim() || null,
    };
  };

  const handleSave = async () => {
    if (!editingLevel) return;
    const payload = validateForm();
    if (!payload) return;

    setSaving(true);
    try {
      await updateLevelThreshold(editingLevel.id, payload);
      setLevels((prev) =>
        prev
          .map((l) => (l.id === editingLevel.id ? { ...l, ...payload } : l))
          .sort((a, b) => a.xp_required - b.xp_required)
      );
      toast.success("Niveau mis à jour");
      setEditingLevel(null);
    } catch {
      toast.error("Impossible de modifier le niveau");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    const payload = validateForm();
    if (!payload) return;

    const nextLevel = levels.length > 0 ? Math.max(...levels.map((l) => l.level)) + 1 : 1;

    setSaving(true);
    try {
      const created = await createLevelThreshold({ level: nextLevel, ...payload });
      setLevels((prev) => [...prev, created].sort((a, b) => a.xp_required - b.xp_required));
      toast.success("Niveau créé");
      setCreating(false);
    } catch {
      toast.error("Impossible de créer le niveau");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteLevelThreshold(deleteTarget.id);
      setLevels((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      toast.success("Niveau supprimé");
      setDeleteTarget(null);
      setEditingLevel(null);
    } catch {
      toast.error("Impossible de supprimer le niveau");
    } finally {
      setDeleting(false);
    }
  };

  const closeDialog = () => {
    setEditingLevel(null);
    setCreating(false);
  };

  const isDialogOpen = !!editingLevel || creating;

  if (loading) {
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
            Gérez les textes narratifs affichés sur la homepage selon le niveau du joueur
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un niveau
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Lore par niveau
          </CardTitle>
          <CardDescription>
            Chaque joueur voit le texte correspondant à son niveau actuel sur la homepage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Niv.</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead className="w-[120px]">Rang</TableHead>
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
                const previousXp = index > 0 ? (levels[index - 1]?.xp_required ?? 0) : 0;
                const xpDelta = level.xp_required - previousXp;
                const equivalentEuros = xpPerEuro > 0 ? level.xp_required / xpPerEuro : 0;
                return (
                <TableRow key={level.id}>
                  <TableCell className="font-bold">{level.level}</TableCell>
                  <TableCell className="font-medium">{level.name}</TableCell>
                  <TableCell className="text-muted-foreground">{levelToRankName(level.level)}</TableCell>
                  <TableCell className="text-right tabular-nums">{level.xp_required.toLocaleString("fr-FR")}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {index === 0 ? "—" : `+${xpDelta.toLocaleString("fr-FR")}`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {equivalentEuros.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    × {levelToCoefficient(level.level).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </TableCell>
                  <TableCell className="max-w-[400px] truncate text-muted-foreground">
                    {level.lore || <span className="italic">Aucun lore</span>}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(level)}
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

      {/* Dialog création / édition */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {creating
                ? "Ajouter un niveau"
                : `Modifier le niveau ${editingLevel?.level}`}
            </DialogTitle>
            <DialogDescription>
              {creating
                ? `Ce sera le niveau ${levels.length > 0 ? Math.max(...levels.map((l) => l.level)) + 1 : 1}`
                : `Rang : ${editingLevel ? levelToRankName(editingLevel.level) : ""} · Coef. PdB : × ${editingLevel ? levelToCoefficient(editingLevel.level).toLocaleString("fr-FR", { minimumFractionDigits: 1 }) : ""}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nom du niveau</Label>
                <Input
                  id="edit-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex : Écuyer I"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-xp">XP requis</Label>
                <Input
                  id="edit-xp"
                  type="number"
                  min={0}
                  value={form.xp_required}
                  onChange={(e) => setForm((f) => ({ ...f, xp_required: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Description courte du niveau..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lore">Lore</Label>
              <Textarea
                id="edit-lore"
                value={form.lore}
                onChange={(e) => setForm((f) => ({ ...f, lore: e.target.value }))}
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
                onClick={() => setDeleteTarget(editingLevel)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={closeDialog}>
                Annuler
              </Button>
              <Button onClick={creating ? handleCreate : handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {creating ? "Créer" : "Enregistrer"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le niveau {deleteTarget?.level} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le niveau « {deleteTarget?.name} » sera définitivement supprimé. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
