"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { navigationGroups } from "@/lib/navigation";
import { useCurrentAdmin } from "@/components/providers/CurrentAdminProvider";
import type { FeatureKey } from "@/lib/features";

// Pages secondaires accessibles via la palette mais absentes de la sidebar.
// Chaque page hérite de la fonctionnalité de sa section parente.
const extraPages: { name: string; href: string; featureKey?: FeatureKey }[] = [
  { name: "Créer un coupon", href: "/coupons/create", featureKey: "coupons" },
  { name: "Créer une quête", href: "/quests/create", featureKey: "quests" },
  { name: "Santé des quêtes", href: "/quests/health", featureKey: "quests" },
  { name: "Santé du matching Cashpad", href: "/reconciliation/health", featureKey: "reconciliation" },
  { name: "Périodes de classement", href: "/rewards/periods", featureKey: "rewards" },
  { name: "Paliers du leaderboard", href: "/rewards/tiers", featureKey: "rewards" },
  { name: "Distribution des récompenses", href: "/rewards/distribute", featureKey: "rewards" },
  { name: "Clôture de saison", href: "/rewards/season", featureKey: "rewards" },
];

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return { open, setOpen };
}

export function CommandPaletteTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      aria-label="Rechercher une page (Cmd+K)"
      className="gap-2 text-muted-foreground"
    >
      <Search className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="hidden lg:inline">Rechercher…</span>
      <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium lg:inline">
        ⌘K
      </kbd>
    </Button>
  );
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { isFeatureEnabled, isSuperAdmin } = useCurrentAdmin();

  const navigate = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router]
  );

  // Navigation et pages secondaires filtrées par les accès de l'admin connecté.
  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (!item.featureKey || isFeatureEnabled(item.featureKey)) &&
          (!item.superAdminOnly || isSuperAdmin)
      ),
    }))
    .filter((group) => group.items.length > 0);

  const visibleExtraPages = extraPages.filter(
    (page) => !page.featureKey || isFeatureEnabled(page.featureKey)
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Aller à une page…" />
      <CommandList>
        <CommandEmpty>Aucune page trouvée.</CommandEmpty>
        {visibleGroups.map((group) => (
          <CommandGroup key={group.title} heading={group.title}>
            {group.items.map((item) => (
              <CommandItem
                key={item.href}
                value={`${group.title} ${item.name}`}
                onSelect={() => navigate(item.href)}
              >
                <item.icon className="mr-2 h-4 w-4" aria-hidden="true" />
                {item.name}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Autres pages">
          {visibleExtraPages.map((page) => (
            <CommandItem
              key={page.href}
              value={page.name}
              onSelect={() => navigate(page.href)}
            >
              {page.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
