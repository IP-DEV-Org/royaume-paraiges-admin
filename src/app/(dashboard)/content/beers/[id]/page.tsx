"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Upload, X } from "lucide-react";
import {
  getBeer,
  getBreweries,
  updateBeer,
  uploadBeerImage,
  deleteBeerImage,
  getImageUrl,
  type Beer,
  type Brewery,
} from "@/lib/services/contentService";
import { toast } from "sonner";

export default function EditBeerPage() {
  const router = useRouter();
  const params = useParams();
  const id = parseInt(params.id as string);

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [breweries, setBreweries] = useState<Brewery[]>([]);
  const [currentImagePath, setCurrentImagePath] = useState<string | null>(null);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    ibu: "",
    abv: "",
    breweryId: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [beer, breweriesData] = await Promise.all([
          getBeer(id),
          getBreweries(),
        ]);

        setBreweries(breweriesData);

        if (beer) {
          setForm({
            title: beer.title || "",
            description: beer.description || "",
            ibu: beer.ibu?.toString() || "",
            abv: beer.abv?.toString() || "",
            breweryId: beer.brewery_id?.toString() || "",
          });
          setCurrentImagePath(beer.featured_image);
        } else {
          toast.error("Erreur", { description: "Bière introuvable" });
          router.push("/content/beers");
        }
      } catch (error) {
        toast.error("Erreur", { description: "Impossible de charger la bière" });
        router.push("/content/beers");
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [id, router]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewImageFile(file);
      // Creer un apercu local
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveNewImage = () => {
    setNewImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let newImagePath = currentImagePath;

      // Si une nouvelle image a ete selectionnee, l'uploader
      if (newImageFile) {
        // Supprimer l'ancienne image si elle existe
        if (currentImagePath) {
          await deleteBeerImage(currentImagePath);
        }
        // Uploader la nouvelle image
        newImagePath = await uploadBeerImage(id, newImageFile);
      }

      await updateBeer(id, {
        title: form.title,
        description: form.description || null,
        ibu: form.ibu ? parseInt(form.ibu) : null,
        abv: form.abv ? parseFloat(form.abv) : null,
        brewery_id: form.breweryId ? parseInt(form.breweryId) : null,
        featured_image: newImagePath,
      });

      toast.success("Bière mise à jour");
      router.push("/content/beers");
    } catch (error) {
      toast.error("Erreur", {
        description: "Impossible de mettre à jour la bière",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/content/beers">
          <Button variant="ghost" size="icon" aria-label="Retour à la liste des bières">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Modifier la bière</h1>
          <p className="text-muted-foreground">{form.title}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Informations de la bière</CardTitle>
            <CardDescription>
              Modifiez les caractéristiques de la bière
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Nom de la bière *</Label>
              <Input
                id="title"
                placeholder="Ex: Blonde des Paraiges"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Description de la bière"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brewery">Brasserie</Label>
              <Select
                value={form.breweryId}
                onValueChange={(value) =>
                  setForm({ ...form, breweryId: value === "none" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une brasserie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune brasserie</SelectItem>
                  {breweries.map((brewery) => (
                    <SelectItem key={brewery.id} value={brewery.id.toString()}>
                      {brewery.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Image de la bière</Label>
              <div className="flex items-start gap-4">
                {/* Aperçu de l'image actuelle ou nouvelle */}
                {(imagePreview || currentImagePath) && (
                  <div className="relative">
                    <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-lg border bg-muted/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview || getImageUrl(currentImagePath) || ""}
                        alt="Aperçu"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    {imagePreview && (
                      <button
                        type="button"
                        onClick={handleRemoveNewImage}
                        aria-label="Retirer la nouvelle image"
                        className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground hover:bg-destructive/90"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}

                {/* Zone d'upload */}
                <div className="flex-1">
                  <label
                    htmlFor="image-upload"
                    className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 transition-colors hover:border-muted-foreground/50"
                  >
                    <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {newImageFile
                        ? newImageFile.name
                        : currentImagePath
                        ? "Changer l'image"
                        : "Importer une image"}
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      PNG, JPG jusqu’à 5MB
                    </span>
                  </label>
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/avif"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ibu">IBU (International Bitterness Units)</Label>
                <Input
                  id="ibu"
                  type="number"
                  placeholder="Ex: 35"
                  value={form.ibu}
                  onChange={(e) => setForm({ ...form, ibu: e.target.value })}
                  min={0}
                  max={120}
                />
                <p className="text-xs text-muted-foreground">
                  Indice d’amertume (0-120)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="abv">ABV (Degré d’alcool %)</Label>
                <Input
                  id="abv"
                  type="number"
                  step="0.1"
                  placeholder="Ex: 5.5"
                  value={form.abv}
                  onChange={(e) => setForm({ ...form, abv: e.target.value })}
                  min={0}
                  max={20}
                />
                <p className="text-xs text-muted-foreground">
                  Pourcentage d’alcool par volume
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Link href="/content/beers">
                <Button type="button" variant="outline">
                  Annuler
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
