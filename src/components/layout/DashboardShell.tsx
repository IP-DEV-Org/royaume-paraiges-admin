"use client";

import { Suspense, useState } from "react";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CurrentAdminProvider } from "@/components/providers/CurrentAdminProvider";
import { FeatureDisabledToast } from "@/components/feature-disabled-toast";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 899px)");

  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Toast « accès désactivé » après redirection middleware (?error=feature_disabled).
  // Suspense requis : le composant lit useSearchParams.
  const featureDisabledToast = (
    <Suspense fallback={null}>
      <FeatureDisabledToast />
    </Suspense>
  );

  // Mobile layout
  if (isMobile) {
    return (
      <CurrentAdminProvider>
        <TooltipProvider>
          {featureDisabledToast}
          <div className="flex h-screen flex-col overflow-hidden">
            <Header mobile onMenuClick={() => setMobileOpen(true)} />
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetContent side="left" className="w-64 p-0">
                <Sidebar onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <main className="flex-1 overflow-y-auto bg-muted/30 p-4">
              {children}
            </main>
          </div>
        </TooltipProvider>
      </CurrentAdminProvider>
    );
  }

  // Tablet layout
  if (isTablet) {
    return (
      <CurrentAdminProvider>
        <TooltipProvider>
          {featureDisabledToast}
          <div className="flex h-screen overflow-hidden">
            <Sidebar
              collapsed={!sidebarExpanded}
              showToggle
              onToggle={() => setSidebarExpanded(!sidebarExpanded)}
              onNavigate={() => setSidebarExpanded(false)}
            />
            <div className="flex flex-1 flex-col overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
                {children}
              </main>
            </div>
          </div>
        </TooltipProvider>
      </CurrentAdminProvider>
    );
  }

  // Desktop layout
  return (
    <CurrentAdminProvider>
      <TooltipProvider>
        {featureDisabledToast}
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
              {children}
            </main>
          </div>
        </div>
      </TooltipProvider>
    </CurrentAdminProvider>
  );
}
