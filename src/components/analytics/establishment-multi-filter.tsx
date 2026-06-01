"use client";

import { Check, ChevronsUpDown, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// =============================================================================
// Multi-sélection d'établissements pour la timeline analytics.
// Sélection vide = tous les établissements (la RPC reçoit null).
// =============================================================================

export interface EstablishmentOption {
  id: number;
  title: string;
}

interface EstablishmentMultiFilterProps {
  establishments: EstablishmentOption[];
  selected: number[];
  onChange: (ids: number[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EstablishmentMultiFilter({
  establishments,
  selected,
  onChange,
  open,
  onOpenChange,
}: EstablishmentMultiFilterProps) {
  const selectedSet = new Set(selected);

  const toggle = (id: number) => {
    if (selectedSet.has(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const label =
    selected.length === 0
      ? "Tous les établissements"
      : selected.length === 1
        ? (establishments.find((e) => e.id === selected[0])?.title ?? "1 établissement")
        : `${selected.length} établissements`;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal sm:w-auto sm:min-w-[260px]"
        >
          <span className="flex items-center gap-2 truncate">
            <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
            {label}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher un établissement…" />
          <CommandList>
            <CommandEmpty>Aucun établissement.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__all__"
                onSelect={() => onChange([])}
                className="font-medium"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selected.length === 0 ? "opacity-100" : "opacity-0"
                  )}
                />
                Tous les établissements
              </CommandItem>
              {establishments.map((e) => (
                <CommandItem
                  key={e.id}
                  value={e.title}
                  onSelect={() => toggle(e.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedSet.has(e.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {e.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
