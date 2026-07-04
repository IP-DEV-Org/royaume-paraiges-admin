"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2, Smartphone } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { redirectLinkKeys } from "@/lib/queries/keys";
import {
  createRedirectLink,
  updateRedirectLink,
  REDIRECT_BASE_URL,
} from "@/lib/services/redirectLinkService";
import type { RedirectLink } from "@/types/database";

const urlRegex = /^https?:\/\/\S+$/;
const optionalUrl = z
  .string()
  .regex(urlRegex, "URL invalide (doit commencer par http(s)://)")
  .or(z.literal(""));

const formSchema = z.object({
  slug: z
    .string()
    .min(1, "Slug requis")
    .max(60)
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
      "Minuscules, chiffres et tirets, sans tiret en début ou fin",
    ),
  label: z.string().min(1, "Nom requis").max(120),
  description: z.string().max(500),
  target_url: z
    .string()
    .min(1, "URL requise")
    .regex(urlRegex, "URL invalide (doit commencer par http(s)://)"),
  target_url_ios: optionalUrl,
  target_url_android: optionalUrl,
  is_active: z.boolean(),
});

type FormInput = z.infer<typeof formSchema>;

/** Formulaire partagé création + édition d'un lien de redirection. */
export function LinkForm({ link }: { link?: RedirectLink }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showSmartLinks, setShowSmartLinks] = useState(
    Boolean(link?.target_url_ios || link?.target_url_android),
  );

  const form = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      slug: link?.slug ?? "",
      label: link?.label ?? "",
      description: link?.description ?? "",
      target_url: link?.target_url ?? "",
      target_url_ios: link?.target_url_ios ?? "",
      target_url_android: link?.target_url_android ?? "",
      is_active: link?.is_active ?? true,
    },
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  const slug = watch("slug");

  const submit = handleSubmit(async (values) => {
    const payload = {
      slug: values.slug,
      label: values.label,
      description: values.description.trim() || null,
      target_url: values.target_url,
      target_url_ios: values.target_url_ios || null,
      target_url_android: values.target_url_android || null,
      is_active: values.is_active,
    };
    try {
      if (link) {
        await updateRedirectLink(link.id, payload);
        toast.success("Lien mis à jour");
      } else {
        await createRedirectLink(payload);
        toast.success(`Lien ${REDIRECT_BASE_URL}/${values.slug} créé`);
      }
      queryClient.invalidateQueries({ queryKey: redirectLinkKeys.all });
      router.push("/links");
    } catch (err: unknown) {
      console.error(err);
      const isDuplicateSlug =
        typeof err === "object" && err !== null && "code" in err && err.code === "23505";
      toast.error("Erreur", {
        description: isDuplicateSlug
          ? "Ce slug est déjà utilisé par un autre lien."
          : err instanceof Error
            ? err.message
            : "Impossible d'enregistrer le lien",
      });
    }
  });

  return (
    <form onSubmit={submit}>
      <Card>
        <CardHeader>
          <CardTitle>{link ? "Modifier le lien" : "Nouveau lien"}</CardTitle>
          <CardDescription>
            La cible est modifiable à tout moment, même après impression du QR
            code — la redirection est résolue à chaque visite.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="slug">URL courte</Label>
            <div className="flex items-center gap-0">
              <span className="rounded-l-md border border-r-0 bg-muted px-3 py-2 text-sm text-muted-foreground">
                {REDIRECT_BASE_URL.replace("https://", "")}/
              </span>
              <Input
                id="slug"
                placeholder="menu"
                className="rounded-l-none"
                {...register("slug")}
              />
            </div>
            {errors.slug && (
              <p className="text-xs text-destructive">{errors.slug.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="label">Nom</Label>
            <Input
              id="label"
              placeholder="Menu du restaurant"
              {...register("label")}
            />
            {errors.label && (
              <p className="text-xs text-destructive">{errors.label.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optionnelle)</Label>
            <Textarea
              id="description"
              rows={2}
              placeholder="QR code imprimé sur les menus papier"
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="target_url">URL de destination</Label>
            <Input
              id="target_url"
              placeholder="https://auxparaiges.fr/menu"
              {...register("target_url")}
            />
            {errors.target_url && (
              <p className="text-xs text-destructive">
                {errors.target_url.message}
              </p>
            )}
          </div>

          <div className="border-t pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowSmartLinks((s) => !s)}
            >
              <Smartphone className="mr-2 h-4 w-4" aria-hidden="true" />
              Cibles par appareil (smart link)
              {showSmartLinks ? (
                <ChevronUp className="ml-1 h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="ml-1 h-4 w-4" aria-hidden="true" />
              )}
            </Button>
            {showSmartLinks && (
              <div className="mt-3 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Si renseignées, ces URLs remplacent la destination par défaut
                  sur iPhone/iPad et Android — utile pour envoyer vers l&apos;App
                  Store ou le Play Store depuis un même lien.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="target_url_ios">Cible iOS</Label>
                  <Input
                    id="target_url_ios"
                    placeholder="https://apps.apple.com/…"
                    {...register("target_url_ios")}
                  />
                  {errors.target_url_ios && (
                    <p className="text-xs text-destructive">
                      {errors.target_url_ios.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="target_url_android">Cible Android</Label>
                  <Input
                    id="target_url_android"
                    placeholder="https://play.google.com/store/apps/…"
                    {...register("target_url_android")}
                  />
                  {errors.target_url_android && (
                    <p className="text-xs text-destructive">
                      {errors.target_url_android.message}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <div>
              <Label htmlFor="is_active">Lien actif</Label>
              <p className="text-sm text-muted-foreground">
                Désactivé, le lien redirige vers auxparaiges.fr sans perdre son
                historique.
              </p>
            </div>
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <Switch
                  id="is_active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/links")}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {link ? "Enregistrer" : `Créer ${slug ? `/${slug}` : "le lien"}`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
