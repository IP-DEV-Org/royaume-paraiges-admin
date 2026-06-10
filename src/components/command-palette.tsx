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

// Pages secondaires accessibles via la palette mais absentes de la sidebar.
const extraPages = [
  { name: "Créer un coupon", href: "/coupons/create" },
  { name: "Créer une quête", href: "/quests/create" },
  { name: "Santé des quêtes", href: "/quests/health" },
  { name: "Santé du matching Cashpad", href: "/reconciliation/health" },
  { name: "Périodes de classement", href: "/rewards/periods" },
  { name: "Paliers du leaderboard", href: "/rewards/tiers" },
  { name: "Distribution des récompenses", href: "/rewards/distribute" },
  { name: "Clôture de saison", href: "/rewards/season" },
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

  const navigate = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router]
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Aller à une page…" />
      <CommandList>
        <CommandEmpty>Aucune page trouvée.</CommandEmpty>
        {navigationGroups.map((group) => (
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
          {extraPages.map((page) => (
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
