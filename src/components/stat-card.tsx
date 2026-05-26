import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import { type ReactNode } from "react";

interface StatCardProps {
  title: string;
  icon: ReactNode;
  value: string | number;
  subtitle?: string;
  info?: string;
  valueClassName?: string;
  onClick?: () => void;
  active?: boolean;
}

export function StatCard({
  title,
  icon,
  value,
  subtitle,
  info,
  valueClassName,
  onClick,
  active,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "w-full max-w-[350px]",
        onClick && "cursor-pointer transition-colors hover:bg-accent",
        active && "border-primary bg-primary/5 hover:bg-primary/10"
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {info && (
            <Tooltip>
              <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 hover:text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[280px] text-xs">
                {info}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", valueClassName)}>{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
