import {
  Award,
  Calendar,
  Coins,
  IdCard,
  Mail,
  Phone,
  Receipt,
  TrendingUp,
  User,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserQrCode } from "@/components/user-qr-code";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Establishment } from "@/lib/services/contentService";
import { UserRoleBadge } from "./user-role-badge";
import { getUserDisplayName, type UserDetail, type UserFullStats } from "./types";

interface OverviewTabProps {
  user: UserDetail;
  fullStats: UserFullStats | null;
  establishments: Establishment[];
}

export function OverviewTab({ user, fullStats, establishments }: OverviewTabProps) {
  const displayName = getUserDisplayName(user);

  const getEstablishmentName = (id: number | null) => {
    if (!id) return "-";
    const establishment = establishments.find((e) => e.id === id);
    return establishment?.title || `Établissement #${id}`;
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Informations personnelles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Nom complet</p>
              <p className="font-medium">{displayName}</p>
            </div>
          </div>
          {user.username && (
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Pseudo</p>
                <p className="font-medium">@{user.username}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user.email || "-"}</p>
            </div>
          </div>
          {user.phone && (
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Téléphone</p>
                <p className="font-medium">{user.phone}</p>
              </div>
            </div>
          )}
          {user.birthdate && (
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Date de naissance</p>
                <p className="font-medium">{formatDate(user.birthdate)}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Membre depuis</p>
              <p className="font-medium">{formatDate(user.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <IdCard className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Photo d&apos;identification</p>
              {user.identityPhotoUrl ? (
                <img
                  src={user.identityPhotoUrl}
                  alt="Photo d'identification"
                  className="mt-2 h-32 w-32 rounded-lg object-cover border"
                />
              ) : (
                <p className="text-sm text-muted-foreground italic">Non fournie</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Statut et cashback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Award className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <div className="mt-1">
                <UserRoleBadge role={user.role} />
              </div>
            </div>
          </div>
          {user.attachedEstablishmentId && (
            <div className="flex items-center gap-3">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Établissement de reference</p>
                <p className="font-medium">
                  {getEstablishmentName(user.attachedEstablishmentId)}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Cashback gagne</p>
              <p className="font-medium">{formatCurrency(fullStats?.cashbackEarned || 0)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Coins className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Cashback depense</p>
              <p className="font-medium">{formatCurrency(fullStats?.cashbackSpent || 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>QR code client</CardTitle>
          <CardDescription>
            Sceau personnel présenté au comptoir, identique à celui de l&apos;app client.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-2">
          <UserQrCode userId={user.id} />
        </CardContent>
      </Card>
    </div>
  );
}
