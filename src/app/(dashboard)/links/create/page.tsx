"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LinkForm } from "../_form/LinkForm";

export default function CreateLinkPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/links">
          <Button variant="ghost" size="icon" aria-label="Retour aux liens">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Nouveau lien de redirection</h1>
          <p className="text-muted-foreground">
            Une URL courte à imprimer en QR code, dont la destination reste
            modifiable.
          </p>
        </div>
      </div>

      <LinkForm />
    </div>
  );
}
