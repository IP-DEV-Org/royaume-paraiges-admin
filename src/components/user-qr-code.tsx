"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * Reproduit le « sceau personnel » (QR code client) généré dans l'app front.
 * Encodage identique : l'UUID du profil avec chaque tiret remplacé par la
 * séquence `0x0x0x0` (cf. front `QrCodeModal` → `qrCodeData.replace(/-/g, '0x0x0x0')`).
 * Couleurs reprises du front : avant-plan `#1a1208`, fond blanc, cadre doré.
 */
export function UserQrCode({ userId, size = 200 }: { userId: string; size?: number }) {
  const formattedQrData = userId.replace(/-/g, "0x0x0x0");

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="rounded-2xl p-[3px]"
        style={{ backgroundColor: "#D4A24C" }}
      >
        <div className="rounded-xl bg-white p-3">
          <QRCodeSVG
            value={formattedQrData}
            size={size}
            fgColor="#1a1208"
            bgColor="#FFFFFF"
            level="M"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Sceau personnel — identique à l&apos;app client
      </p>
    </div>
  );
}
