"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
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
import { beerKeys, breweryKeys } from "@/lib/queries/keys";
import { toast } from "sonner";

// Schéma UI : inputs string, conversions number au submit
const formSchema = z.object({
  title: z.string().min(1, "Le nom est requis"),
  description: z.string(),
  ibu: z.string().refine(
    (v) => {
      if (!v) return true;
      const n = parseInt(v, 10);
      return !isNaN(n) && n >= 0 && n <= 120;
    },
    { message: "L'IBU doit être un entier entre 0 et 120." }
  ),
  abv: z.string().refine(
    (v) => {
      if (!v) return true;
      const n = parseFloat(v);
      return !isNaN(n) && n >= 0 && n <= 20;
    },
    { message: "L'ABV doit être entre 0 et 20." }
  ),
  breweryId: z.string(),
});

type FormInput = z.infer<typeof formSchema>;

export default function EditBeerPage() {
  const router = useRouter();
  const params = useParams();
  const id = parseInt(params.id as string);

  const beerQuery = useQuery({
    queryKey: beerKeys.detail(id),
    queryFn: () => getBeer(id),
  });
  const breweriesQuery = useQuery({
    queryKey: breweryKeys.lists(),
    queryFn: getBreweries,
  });

  // getBeer renvoie null si introuvable (le service ne throw pas)
  const notFound = beerQuery.isSuccess && !beerQuery.data;

  useEffect(() => {
    if (notFound || beerQuery.isError) {
      toast.error("Erreur", { description: "Bière introuvable" });
      router.push("/content/beers");
    }
  }, [notFound, beerQuery.isError, router]);

  if (!beerQuery.data || breweriesQuery.isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <BeerForm beer={beerQuery.data} breweries={breweriesQuery.data ?? []} />
  );
}

function BeerForm({ beer, breweries }: { beer: Beer; breweries: Brewery[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const currentImagePath = beer.featured_image;
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: beer.title || "",
      description: beer.description || "",
      ibu: beer.ibu?.toString() ?? "",
      abv: beer.abv?.toString() ?? "",
      breweryId: beer.brewery_id?.toString() ?? "",
    },
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  const title = watch("title");

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

  const submit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      let newImagePath = currentImagePath;

      // Si une nouvelle image a ete selectionnee, l'uploader
      if (newImageFile) {
        // Supprimer l'ancienne image si elle existe
        if (currentImagePath) {
          await deleteBeerImage(currentImagePath);
        }
        // Uploader la nouvelle image
        newImagePath = await uploadBeerImage(beer.id, newImageFile);
      }

      await updateBeer(beer.id, {
        title: values.title,
        description: values.description || null,
        ibu: values.ibu ? parseInt(values.ibu, 10) : null,
        abv: values.abv ? parseFloat(values.abv) : null,
        brewery_id: values.breweryId ? parseInt(values.breweryId, 10) : null,
        featured_image: newImagePath,
      });

      queryClient.invalidateQueries({ queryKey: beerKeys.all });
      toast.success("Bière mise à jour");
      router.push("/content/beers");
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : "Impossible de mettre à jour la bière"
      );
      toast.error("Erreur", {
        description: "Impossible de mettre à jour la bière",
      });
    }
  });

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
          <p className="text-muted-foreground">{title}</p>
        </div>
      </div>

      <form onSubmit={submit}>
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
                {...register("title")}
              />
              {errors.title && (
                <p className="text-xs text-destructive">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Description de la bière"
                rows={4}
                {...register("description")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brewery">Brasserie</Label>
              <Controller
                name="breweryId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) =>
                      field.onChange(value === "none" ? "" : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une brasserie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune brasserie</SelectItem>
                      {breweries.map((brewery) => (
                        <SelectItem
                          key={brewery.id}
                          value={brewery.id.toString()}
                        >
                          {brewery.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
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
                  min={0}
                  max={120}
                  {...register("ibu")}
                />
                {errors.ibu && (
                  <p className="text-xs text-destructive">
                    {errors.ibu.message}
                  </p>
                )}
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
                  min={0}
                  max={20}
                  {...register("abv")}
                />
                {errors.abv && (
                  <p className="text-xs text-destructive">
                    {errors.abv.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Pourcentage d’alcool par volume
                </p>
              </div>
            </div>

            {serverError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {serverError}
              </div>
            )}

            <div className="flex justify-end gap-4">
              <Link href="/content/beers">
                <Button type="button" variant="outline">
                  Annuler
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
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
