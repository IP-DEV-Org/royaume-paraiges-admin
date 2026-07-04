"use client";

import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildShortUrl } from "@/lib/services/redirectLinkService";

const PNG_SIZE = 1024;

/** QR code du lien court, téléchargeable en SVG (impression) et PNG. */
export function LinkQrCard({ slug }: { slug: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shortUrl = buildShortUrl(slug);

  const getSvgMarkup = (): string | null => {
    const svg = containerRef.current?.querySelector("svg");
    return svg ? new XMLSerializer().serializeToString(svg) : null;
  };

  const triggerDownload = (href: string, filename: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
  };

  const downloadSvg = () => {
    const markup = getSvgMarkup();
    if (!markup) return;
    const url = URL.createObjectURL(
      new Blob([markup], { type: "image/svg+xml" }),
    );
    triggerDownload(url, `qr-${slug}.svg`);
    URL.revokeObjectURL(url);
  };

  const downloadPng = () => {
    const markup = getSvgMarkup();
    if (!markup) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = PNG_SIZE;
      canvas.height = PNG_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, PNG_SIZE, PNG_SIZE);
      // Marge blanche autour du code pour une lecture fiable une fois imprimé
      const margin = PNG_SIZE / 16;
      ctx.drawImage(img, margin, margin, PNG_SIZE - 2 * margin, PNG_SIZE - 2 * margin);
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error("Erreur", { description: "Export PNG impossible" });
          return;
        }
        const url = URL.createObjectURL(blob);
        triggerDownload(url, `qr-${slug}.png`);
        URL.revokeObjectURL(url);
      }, "image/png");
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>QR code</CardTitle>
        <CardDescription className="break-all">{shortUrl}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div ref={containerRef} className="rounded-xl bg-white p-4">
          <QRCodeSVG value={shortUrl} size={200} fgColor="#1a1208" bgColor="#FFFFFF" level="M" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadSvg}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            SVG
          </Button>
          <Button variant="outline" size="sm" onClick={downloadPng}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            PNG
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Le QR code encode l&apos;URL courte : la destination reste modifiable
          après impression.
        </p>
      </CardContent>
    </Card>
  );
}
