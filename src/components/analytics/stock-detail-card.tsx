import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { Info } from "lucide-react";
import type { StockData } from "@/lib/services/analyticsService";

interface StockDetailCardProps {
  stock: StockData;
}

export function StockDetailCard({ stock }: StockDetailCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-base">Détail par catégorie</CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 hover:text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px] text-xs">
              Ouverture / fermeture = stock de PdB en circulation aux bornes de la période. Les dépenses sont réparties par allocation proportionnelle entre catégories.
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-right">Ouverture</TableHead>
              <TableHead className="text-right text-green-700">
                + Gagnés
              </TableHead>
              <TableHead className="text-right text-red-700">
                - Dépensés
              </TableHead>
              <TableHead className="text-right">Fermeture</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-bronze" />
                  PdB Organiques
                </span>
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(stock.opening.organic)}
              </TableCell>
              <TableCell className="text-right text-green-700">
                +{formatCurrency(stock.movements.earnedOrganic)}
              </TableCell>
              <TableCell className="text-right text-red-700">
                {formatCurrency(
                  Math.max(0, stock.opening.organic +
                    stock.movements.earnedOrganic -
                    stock.closing.organic)
                )}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(stock.closing.organic)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-gold" />
                  PdB Récompenses
                </span>
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(stock.opening.rewards)}
              </TableCell>
              <TableCell className="text-right text-green-700">
                +{formatCurrency(stock.movements.earnedRewards)}
              </TableCell>
              <TableCell className="text-right text-red-700">
                {formatCurrency(
                  Math.max(0, stock.opening.rewards +
                    stock.movements.earnedRewards -
                    stock.closing.rewards)
                )}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(stock.closing.rewards)}
              </TableCell>
            </TableRow>
            <TableRow className="border-t-2 font-bold">
              <TableCell>Total</TableCell>
              <TableCell className="text-right">
                {formatCurrency(stock.opening.total)}
              </TableCell>
              <TableCell className="text-right text-green-700">
                +
                {formatCurrency(
                  stock.movements.earnedOrganic +
                    stock.movements.earnedRewards
                )}
              </TableCell>
              <TableCell className="text-right text-red-700">
                {formatCurrency(stock.movements.spent)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(stock.closing.total)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p className="mt-3 text-xs text-muted-foreground">
          * Répartition des dépenses par allocation proportionnelle
        </p>
      </CardContent>
    </Card>
  );
}
