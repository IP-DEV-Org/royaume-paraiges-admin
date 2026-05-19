import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowRight,
  Calendar,
  Crown,
  Medal,
  PlayCircle,
  Sparkles,
} from "lucide-react";

const sections = [
  {
    href: "/rewards/periods",
    title: "Périodes",
    description:
      "Consultez et configurez les périodes (hebdo, mensuelle, annuelle) ouvertes à la distribution.",
    icon: Calendar,
  },
  {
    href: "/rewards/tiers",
    title: "Paliers du leaderboard",
    description:
      "Définissez les coupons et badges associés à chaque rang du classement.",
    icon: Crown,
  },
  {
    href: "/rewards/achievements",
    title: "Badges succès",
    description:
      "Badges débloqués automatiquement selon un critère (commandes, villes, streaks…).",
    icon: Medal,
  },
  {
    href: "/rewards/distribute",
    title: "Distribuer",
    description:
      "Prévisualisez puis lancez la distribution des récompenses d'une période.",
    icon: PlayCircle,
  },
  {
    href: "/rewards/season",
    title: "Clôture de saison",
    description:
      "Workflow annuel : snapshot, attribution des badges de saison, reset des coefficients.",
    icon: Sparkles,
  },
];

export default function RewardsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Récompenses</h1>
        <p className="text-muted-foreground">
          Tout ce qui concerne les récompenses des joueurs : paliers, badges,
          périodes et distribution.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full transition-colors hover:border-foreground/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md border bg-muted p-2">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle>{title}</CardTitle>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
