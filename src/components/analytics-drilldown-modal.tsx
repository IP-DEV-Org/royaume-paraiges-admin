"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  User,
  Store,
  CalendarDays,
  CreditCard,
  Banknote,
  Coins,
  Hash,
  UserCheck,
  Zap,
  Tag,
  Clock,
  Percent,
  UtensilsCrossed,
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPercentage,
} from "@/lib/utils";
import {
  getDrilldownReceipts,
  getDrilldownSpendings,
  getDrilldownGains,
  getDrilldownActiveCoupons,
  type DrilldownMetric,
  type DrilldownFilters,
  type ReceiptDrilldownRow,
  type SpendingDrilldownRow,
  type GainDrilldownRow,
  type CouponDrilldownRow,
} from "@/lib/services/analyticsService";
import { cn } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [20, 50, 100, 250] as const;

const CONSUMPTION_TYPE_LABELS: Record<string, string> = {
  cocktail: "Cocktail",
  biere: "Bi\u00e8re",
  alcool: "Alcool",
  soft: "Soft",
  boisson_chaude: "Boisson chaude",
  restauration: "Restauration",
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  receipt: "Ticket",
  bonus_cashback_manual: "Bonus manuel",
  bonus_cashback_leaderboard: "Classement",
  bonus_cashback_quest: "Qu\u00eate",
  bonus_cashback_trigger: "Trigger",
  bonus_cashback_migration: "Migration",
};

const DISTRIBUTION_TYPE_LABELS: Record<string, string> = {
  manual: "Manuel",
  leaderboard: "Classement",
  quest: "Qu\u00eate",
  trigger: "Trigger",
};

function sourceLabel(st: string): string {
  return SOURCE_TYPE_LABELS[st] || st;
}

function distributionLabel(dt: string): string {
  return DISTRIBUTION_TYPE_LABELS[dt] || dt;
}

/** Render a currency value, dimmed when zero */
function Cur({ value, className }: { value: number; className?: string }) {
  return (
    <span className={value === 0 ? "opacity-30" : className}>
      {formatCurrency(value)}
    </span>
  );
}

/** Render an integer value, dimmed when zero */
function Num({ value, className }: { value: number; className?: string }) {
  return (
    <span className={value === 0 ? "opacity-30" : className}>
      {value.toLocaleString("fr-FR")}
    </span>
  );
}

/** Client name as a link to /users/[id] */
function CustomerLink({ id, name }: { id: string; name: string }) {
  return (
    <Link
      href={`/users/${id}`}
      className="hover:underline text-primary font-semibold"
      onClick={(e) => e.stopPropagation()}
    >
      {name}
    </Link>
  );
}

/** Establishment name as a link to /content/establishments/[id] */
function EstablishmentLink({
  id,
  name,
}: {
  id: number | null;
  name: string;
}) {
  if (!id || name === "\u2014") return <span>{name}</span>;
  return (
    <Link
      href={`/content/establishments/${id}`}
      className="hover:underline text-primary font-semibold"
      onClick={(e) => e.stopPropagation()}
    >
      {name}
    </Link>
  );
}

// ─── Detail field helper ───────────────────────────────────────────────

function DetailField({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium">{children}</div>
      </div>
    </div>
  );
}

// ─── Selected item type ────────────────────────────────────────────────

type SelectedItem =
  | { metric: "receipts"; data: ReceiptDrilldownRow }
  | { metric: "spendings"; data: SpendingDrilldownRow }
  | {
      metric: "gainsOrganic" | "gainsRewards" | "gainsAll";
      data: GainDrilldownRow;
    }
  | { metric: "couponsActive"; data: CouponDrilldownRow };

// ─── Detail panels ─────────────────────────────────────────────────────

function ReceiptDetail({ data }: { data: ReceiptDrilldownRow }) {
  return (
    <div className="space-y-4">
      <DetailField icon={<Hash className="h-4 w-4" />} label="ID Ticket">
        #{data.id}
      </DetailField>
      <DetailField
        icon={<CalendarDays className="h-4 w-4" />}
        label="Date et heure"
      >
        {formatDateTime(data.created_at)}
      </DetailField>
      <Separator />
      <DetailField icon={<User className="h-4 w-4" />} label="Client">
        <CustomerLink id={data.customer_id} name={data.customer_name} />
      </DetailField>
      <DetailField
        icon={<Store className="h-4 w-4" />}
        label="Établissement"
      >
        <EstablishmentLink
          id={data.establishment_id}
          name={data.establishment_name}
        />
      </DetailField>
      <DetailField icon={<UserCheck className="h-4 w-4" />} label="Serveur">
        {data.employee_name}
      </DetailField>
      <Separator />
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Détail du paiement
      </p>
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <CreditCard className="h-3.5 w-3.5" />
            Carte
          </span>
          <Cur value={data.card_total} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Banknote className="h-3.5 w-3.5" />
            Espèces
          </span>
          <Cur value={data.cash_total} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Coins className="h-3.5 w-3.5" />
            PdB (cashback)
          </span>
          <Cur value={data.cashback_spent} className="text-amber-600" />
        </div>
        <Separator />
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>Total</span>
          <span>{formatCurrency(data.total)}</span>
        </div>
      </div>
      {data.consumption_items.length > 0 && (
        <>
          <Separator />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Consommations
          </p>
          <div className="rounded-lg border p-3 space-y-2">
            {data.consumption_items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <UtensilsCrossed className="h-3.5 w-3.5" />
                  {CONSUMPTION_TYPE_LABELS[item.consumption_type] || item.consumption_type}
                </span>
                <span>{item.quantity}x</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SpendingDetail({ data }: { data: SpendingDrilldownRow }) {
  return (
    <div className="space-y-4">
      <DetailField icon={<Hash className="h-4 w-4" />} label="ID Dépense">
        #{data.id}
      </DetailField>
      <DetailField
        icon={<CalendarDays className="h-4 w-4" />}
        label="Date et heure"
      >
        {formatDateTime(data.created_at)}
      </DetailField>
      <Separator />
      <DetailField icon={<User className="h-4 w-4" />} label="Client">
        <CustomerLink id={data.customer_id} name={data.customer_name} />
      </DetailField>
      <DetailField
        icon={<Store className="h-4 w-4" />}
        label="Établissement"
      >
        <EstablishmentLink
          id={data.establishment_id}
          name={data.establishment_name}
        />
      </DetailField>
      <Separator />
      <DetailField
        icon={<Coins className="h-4 w-4" />}
        label="Montant dépensé (PdB)"
      >
        <span className="text-lg font-bold text-amber-600">
          {formatCurrency(data.amount)}
        </span>
      </DetailField>
    </div>
  );
}

function GainDetail({ data }: { data: GainDrilldownRow }) {
  return (
    <div className="space-y-4">
      <DetailField icon={<Hash className="h-4 w-4" />} label="ID Gain">
        #{data.id}
      </DetailField>
      <DetailField
        icon={<CalendarDays className="h-4 w-4" />}
        label="Date et heure"
      >
        {formatDateTime(data.created_at)}
      </DetailField>
      <Separator />
      <DetailField icon={<User className="h-4 w-4" />} label="Client">
        <CustomerLink id={data.customer_id} name={data.customer_name} />
      </DetailField>
      <DetailField
        icon={<Store className="h-4 w-4" />}
        label="Établissement"
      >
        <EstablishmentLink
          id={data.establishment_id}
          name={data.establishment_name}
        />
      </DetailField>
      <DetailField icon={<Tag className="h-4 w-4" />} label="Source">
        <Badge variant="secondary">{sourceLabel(data.source_type)}</Badge>
      </DetailField>
      {data.period_identifier && (
        <DetailField
          icon={<Clock className="h-4 w-4" />}
          label="Période"
        >
          {data.period_identifier}
        </DetailField>
      )}
      <Separator />
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Zap className="h-3.5 w-3.5" />
            XP gagné
          </span>
          <Num value={data.xp} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Coins className="h-3.5 w-3.5" />
            Cashback gagné
          </span>
          <Cur value={data.cashback_money} className="text-amber-600" />
        </div>
      </div>
    </div>
  );
}

function CouponDetail({ data }: { data: CouponDrilldownRow }) {
  const isExpired = data.expires_at && new Date(data.expires_at) < new Date();
  return (
    <div className="space-y-4">
      <DetailField icon={<Hash className="h-4 w-4" />} label="ID Coupon">
        #{data.id}
      </DetailField>
      <DetailField
        icon={<CalendarDays className="h-4 w-4" />}
        label="Date de création"
      >
        {formatDateTime(data.created_at)}
      </DetailField>
      <Separator />
      <DetailField icon={<User className="h-4 w-4" />} label="Client">
        <CustomerLink id={data.customer_id} name={data.customer_name} />
      </DetailField>
      <DetailField
        icon={<Percent className="h-4 w-4" />}
        label="Pourcentage"
      >
        <span className="text-lg font-bold">
          {formatPercentage(data.percentage)}
        </span>
      </DetailField>
      <Separator />
      <DetailField icon={<Tag className="h-4 w-4" />} label="Source">
        <Badge variant="secondary">
          {distributionLabel(data.distribution_type)}
        </Badge>
      </DetailField>
      {data.period_identifier && (
        <DetailField
          icon={<Clock className="h-4 w-4" />}
          label="Période"
        >
          {data.period_identifier}
        </DetailField>
      )}
      <DetailField
        icon={<CalendarDays className="h-4 w-4" />}
        label="Expiration"
      >
        {data.expires_at ? (
          <span className={isExpired ? "text-destructive" : ""}>
            {formatDate(data.expires_at)}
            {isExpired && (
              <Badge variant="destructive" className="ml-2">
                Expiré
              </Badge>
            )}
          </span>
        ) : (
          "Sans expiration"
        )}
      </DetailField>
    </div>
  );
}

// ─── Detail sidebar renderer ───────────────────────────────────────────

function DetailSidebar({
  item,
  onClose,
}: {
  item: SelectedItem;
  onClose: () => void;
}) {
  const titleMap: Record<string, string> = {
    receipts: "Détail du ticket",
    spendings: "Détail de la dépense",
    gainsOrganic: "Détail du gain",
    gainsRewards: "Détail du gain",
    gainsAll: "Détail du gain",
    couponsActive: "Détail du coupon",
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{titleMap[item.metric]}</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {item.metric === "receipts" && (
          <ReceiptDetail data={item.data as ReceiptDrilldownRow} />
        )}
        {item.metric === "spendings" && (
          <SpendingDetail data={item.data as SpendingDrilldownRow} />
        )}
        {(item.metric === "gainsOrganic" ||
          item.metric === "gainsRewards" ||
          item.metric === "gainsAll") && (
          <GainDetail data={item.data as GainDrilldownRow} />
        )}
        {item.metric === "couponsActive" && (
          <CouponDetail data={item.data as CouponDrilldownRow} />
        )}
      </div>
    </div>
  );
}

// ─── Main types ────────────────────────────────────────────────────────

type DrilldownData =
  | ReceiptDrilldownRow[]
  | SpendingDrilldownRow[]
  | GainDrilldownRow[]
  | CouponDrilldownRow[];

interface DrilldownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: DrilldownMetric | null;
  title: string;
  filters: DrilldownFilters;
}

// ─── Main component ────────────────────────────────────────────────────

export function DrilldownModal({
  open,
  onOpenChange,
  metric,
  title,
  filters,
}: DrilldownModalProps) {
  const [data, setData] = useState<DrilldownData>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  const fetchData = useCallback(async () => {
    if (!metric) return;
    setLoading(true);
    try {
      const offset = page * pageSize;
      let result: { data: DrilldownData; count: number };

      switch (metric) {
        case "receipts":
          result = await getDrilldownReceipts(filters, pageSize, offset);
          break;
        case "spendings":
          result = await getDrilldownSpendings(filters, pageSize, offset);
          break;
        case "gainsOrganic":
          result = await getDrilldownGains(
            filters,
            "organic",
            pageSize,
            offset
          );
          break;
        case "gainsRewards":
          result = await getDrilldownGains(
            filters,
            "rewards",
            pageSize,
            offset
          );
          break;
        case "gainsAll":
          result = await getDrilldownGains(filters, "all", pageSize, offset);
          break;
        case "couponsActive":
          result = await getDrilldownActiveCoupons(filters, pageSize, offset);
          break;
      }

      setData(result.data);
      setCount(result.count);
    } catch {
      setData([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [metric, filters, page, pageSize]);

  // Reset page and selection when metric, filters, or pageSize change
  useEffect(() => {
    setPage(0);
    setSelectedItem(null);
  }, [
    metric,
    filters.startDate,
    filters.endDate,
    filters.establishmentId,
    filters.employeeId,
    pageSize,
  ]);

  // Close selection on page change
  useEffect(() => {
    setSelectedItem(null);
  }, [page]);

  // Fetch when open, metric, filters, or page change
  useEffect(() => {
    if (open && metric) {
      fetchData();
    }
  }, [open, metric, fetchData]);

  // Close selection when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedItem(null);
    }
  }, [open]);

  const offset = page * pageSize;

  const handleRowClick = (row: ReceiptDrilldownRow | SpendingDrilldownRow | GainDrilldownRow | CouponDrilldownRow) => {
    if (!metric) return;
    // Toggle off if clicking the same row
    if (selectedItem && selectedItem.data.id === row.id) {
      setSelectedItem(null);
      return;
    }
    setSelectedItem({ metric, data: row } as SelectedItem);
  };

  const selectedId = selectedItem?.data.id ?? null;

  const renderTable = () => {
    if (!metric) return null;

    switch (metric) {
      case "receipts":
        return (
          <ReceiptsTable
            data={data as ReceiptDrilldownRow[]}
            startIndex={offset}
            selectedId={selectedId}
            onRowClick={handleRowClick}
          />
        );
      case "spendings":
        return (
          <SpendingsTable
            data={data as SpendingDrilldownRow[]}
            startIndex={offset}
            selectedId={selectedId}
            onRowClick={handleRowClick}
          />
        );
      case "gainsOrganic":
        return (
          <GainsOrganicTable
            data={data as GainDrilldownRow[]}
            startIndex={offset}
            selectedId={selectedId}
            onRowClick={handleRowClick}
          />
        );
      case "gainsRewards":
        return (
          <GainsRewardsTable
            data={data as GainDrilldownRow[]}
            startIndex={offset}
            selectedId={selectedId}
            onRowClick={handleRowClick}
          />
        );
      case "gainsAll":
        return (
          <GainsAllTable
            data={data as GainDrilldownRow[]}
            startIndex={offset}
            selectedId={selectedId}
            onRowClick={handleRowClick}
          />
        );
      case "couponsActive":
        return (
          <CouponsTable
            data={data as CouponDrilldownRow[]}
            startIndex={offset}
            selectedId={selectedId}
            onRowClick={handleRowClick}
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] max-w-7xl flex flex-col"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {count} résultat{count !== 1 ? "s" : ""} sur la période
            sélectionnée
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 gap-0">
          {/* Left: table list */}
          <div className="flex-1 overflow-auto min-h-0 min-w-0 border-r">
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : data.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                Aucune donnée pour ces filtres
              </div>
            ) : (
              renderTable()
            )}
          </div>

          {/* Right: detail sidebar */}
          <div className="w-[340px] shrink-0 overflow-hidden">
            {selectedItem ? (
              <DetailSidebar
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
                Sélectionnez une ligne pour voir le détail
              </div>
            )}
          </div>
        </div>

        {count > 0 && (
          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Lignes</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => setPageSize(Number(v))}
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                {offset + 1} sur{" "}
                {count}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((p) => Math.min(totalPages - 1, p + 1))
                }
                disabled={page >= totalPages - 1 || loading}
              >
                Suivant
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Table components ──────────────────────────────────────────────────

interface TableProps<T> {
  data: T[];
  startIndex: number;
  selectedId: number | null;
  onRowClick: (row: T) => void;
}

function ReceiptsTable({
  data,
  startIndex,
  selectedId,
  onRowClick,
}: TableProps<ReceiptDrilldownRow>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Établissement</TableHead>
          <TableHead>Serveur</TableHead>
          <TableHead className="text-right">Carte</TableHead>
          <TableHead className="text-right">Espèces</TableHead>
          <TableHead className="text-right">PdB</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Conso.</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r, i) => (
          <TableRow
            key={r.id}
            className={cn(
              "cursor-pointer transition-colors",
              selectedId === r.id
                ? "bg-muted"
                : "hover:bg-muted/50"
            )}
            onClick={() => onRowClick(r)}
          >
            <TableCell className="text-muted-foreground tabular-nums">
              {startIndex + i + 1}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {formatDate(r.created_at)}
            </TableCell>
            <TableCell>
              <CustomerLink id={r.customer_id} name={r.customer_name} />
            </TableCell>
            <TableCell>
              <EstablishmentLink
                id={r.establishment_id}
                name={r.establishment_name}
              />
            </TableCell>
            <TableCell>{r.employee_name}</TableCell>
            <TableCell className="text-right">
              <Cur value={r.card_total} />
            </TableCell>
            <TableCell className="text-right">
              <Cur value={r.cash_total} />
            </TableCell>
            <TableCell className="text-right">
              <Cur value={r.cashback_spent} className="text-amber-600" />
            </TableCell>
            <TableCell className="text-right font-medium">
              <Cur value={r.total} />
            </TableCell>
            <TableCell>
              {r.consumption_items.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {r.consumption_items.map((item) => (
                    <Badge key={item.id} variant="outline" className="text-xs whitespace-nowrap">
                      {item.quantity}x {CONSUMPTION_TYPE_LABELS[item.consumption_type] || item.consumption_type}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SpendingsTable({
  data,
  startIndex,
  selectedId,
  onRowClick,
}: TableProps<SpendingDrilldownRow>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Établissement</TableHead>
          <TableHead className="text-right">Montant (PdB)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r, i) => (
          <TableRow
            key={r.id}
            className={cn(
              "cursor-pointer transition-colors",
              selectedId === r.id
                ? "bg-muted"
                : "hover:bg-muted/50"
            )}
            onClick={() => onRowClick(r)}
          >
            <TableCell className="text-muted-foreground tabular-nums">
              {startIndex + i + 1}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {formatDate(r.created_at)}
            </TableCell>
            <TableCell>
              <CustomerLink id={r.customer_id} name={r.customer_name} />
            </TableCell>
            <TableCell>
              <EstablishmentLink
                id={r.establishment_id}
                name={r.establishment_name}
              />
            </TableCell>
            <TableCell className="text-right">
              <Cur value={r.amount} className="text-amber-600" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function GainsOrganicTable({
  data,
  startIndex,
  selectedId,
  onRowClick,
}: TableProps<GainDrilldownRow>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Établissement</TableHead>
          <TableHead className="text-right">XP</TableHead>
          <TableHead className="text-right">Cashback (PdB)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r, i) => (
          <TableRow
            key={r.id}
            className={cn(
              "cursor-pointer transition-colors",
              selectedId === r.id
                ? "bg-muted"
                : "hover:bg-muted/50"
            )}
            onClick={() => onRowClick(r)}
          >
            <TableCell className="text-muted-foreground tabular-nums">
              {startIndex + i + 1}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {formatDate(r.created_at)}
            </TableCell>
            <TableCell>
              <CustomerLink id={r.customer_id} name={r.customer_name} />
            </TableCell>
            <TableCell>
              <EstablishmentLink
                id={r.establishment_id}
                name={r.establishment_name}
              />
            </TableCell>
            <TableCell className="text-right">
              <Num value={r.xp} />
            </TableCell>
            <TableCell className="text-right">
              <Cur value={r.cashback_money} className="text-amber-600" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function GainsRewardsTable({
  data,
  startIndex,
  selectedId,
  onRowClick,
}: TableProps<GainDrilldownRow>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Période</TableHead>
          <TableHead className="text-right">Cashback (PdB)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r, i) => (
          <TableRow
            key={r.id}
            className={cn(
              "cursor-pointer transition-colors",
              selectedId === r.id
                ? "bg-muted"
                : "hover:bg-muted/50"
            )}
            onClick={() => onRowClick(r)}
          >
            <TableCell className="text-muted-foreground tabular-nums">
              {startIndex + i + 1}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {formatDate(r.created_at)}
            </TableCell>
            <TableCell>
              <CustomerLink id={r.customer_id} name={r.customer_name} />
            </TableCell>
            <TableCell>{sourceLabel(r.source_type)}</TableCell>
            <TableCell>{r.period_identifier || "\u2014"}</TableCell>
            <TableCell className="text-right">
              <Cur value={r.cashback_money} className="text-amber-600" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function GainsAllTable({
  data,
  startIndex,
  selectedId,
  onRowClick,
}: TableProps<GainDrilldownRow>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Établissement</TableHead>
          <TableHead>Source</TableHead>
          <TableHead className="text-right">XP</TableHead>
          <TableHead className="text-right">Cashback (PdB)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r, i) => (
          <TableRow
            key={r.id}
            className={cn(
              "cursor-pointer transition-colors",
              selectedId === r.id
                ? "bg-muted"
                : "hover:bg-muted/50"
            )}
            onClick={() => onRowClick(r)}
          >
            <TableCell className="text-muted-foreground tabular-nums">
              {startIndex + i + 1}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {formatDate(r.created_at)}
            </TableCell>
            <TableCell>
              <CustomerLink id={r.customer_id} name={r.customer_name} />
            </TableCell>
            <TableCell>
              <EstablishmentLink
                id={r.establishment_id}
                name={r.establishment_name}
              />
            </TableCell>
            <TableCell>{sourceLabel(r.source_type)}</TableCell>
            <TableCell className="text-right">
              <Num value={r.xp} />
            </TableCell>
            <TableCell className="text-right">
              <Cur value={r.cashback_money} className="text-amber-600" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CouponsTable({
  data,
  startIndex,
  selectedId,
  onRowClick,
}: TableProps<CouponDrilldownRow>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Date création</TableHead>
          <TableHead>Client</TableHead>
          <TableHead className="text-right">Pourcentage</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Période</TableHead>
          <TableHead>Expire le</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r, i) => (
          <TableRow
            key={r.id}
            className={cn(
              "cursor-pointer transition-colors",
              selectedId === r.id
                ? "bg-muted"
                : "hover:bg-muted/50"
            )}
            onClick={() => onRowClick(r)}
          >
            <TableCell className="text-muted-foreground tabular-nums">
              {startIndex + i + 1}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {formatDate(r.created_at)}
            </TableCell>
            <TableCell>
              <CustomerLink id={r.customer_id} name={r.customer_name} />
            </TableCell>
            <TableCell className="text-right">
              {formatPercentage(r.percentage)}
            </TableCell>
            <TableCell>{distributionLabel(r.distribution_type)}</TableCell>
            <TableCell>{r.period_identifier || "\u2014"}</TableCell>
            <TableCell>
              {r.expires_at ? formatDate(r.expires_at) : "\u2014"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
