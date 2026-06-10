"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";
import { User, Menu, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import {
  CommandPalette,
  CommandPaletteTrigger,
  useCommandPalette,
} from "@/components/command-palette";

const roleConfig: Record<string, { label: string; className: string }> = {
  admin: { label: "Admin", className: "bg-violet-100 text-violet-700 border-violet-200" },
  establishment: { label: "Gérant", className: "bg-amber-100 text-amber-700 border-amber-200" },
  employee: { label: "Employé", className: "border text-muted-foreground" },
  client: { label: "Client", className: "border text-muted-foreground" },
};

interface HeaderProps {
  mobile?: boolean;
  onMenuClick?: () => void;
}

export function Header({ mobile = false, onMenuClick }: HeaderProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const supabase = createClient();
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette();

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (data) {
          setProfile(data);
        }
      }
    };

    fetchProfile();
  }, [supabase]);

  if (mobile) {
    return (
      <header className="flex h-16 items-center justify-between border-b bg-background px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div className="flex items-center gap-2 font-semibold">
          <Trophy className="h-5 w-5" />
          <span className="text-sm">Royaume Admin</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <User className="h-4 w-4" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b bg-background px-6">
      <Breadcrumbs />
      <div className="flex items-center gap-3">
        <CommandPaletteTrigger onClick={() => setPaletteOpen(true)} />
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        <ThemeToggle />
        <div className="flex items-center gap-2 text-sm">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <User className="h-4 w-4" />
          </div>
          <span className="font-medium">
            {profile?.first_name || profile?.email || "Admin"}
          </span>
          {(() => {
            const config = profile?.role ? roleConfig[profile.role] : undefined;
            if (!config) return null;
            return (
              <Badge variant="outline" className={`text-xs ${config.className}`}>
                {config.label}
              </Badge>
            );
          })()}
        </div>
      </div>
    </header>
  );
}
