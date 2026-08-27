import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: number | string;
  previous?: number | null;
  className?: string;
};

function trendPercent(current: number, previous: number | null | undefined) {
  if (previous == null || previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  return Math.round(pct * 10) / 10;
}

export function StatCard({ title, value, previous, className }: StatCardProps) {
  const numeric = typeof value === "number" ? value : Number(value);
  const trend =
    typeof numeric === "number" && Number.isFinite(numeric)
      ? trendPercent(numeric, previous)
      : null;
  const up = trend != null && trend >= 0;

  return (
    <Card className={cn("shadow-sm", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 p-5 pb-2">
        <CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-5 pt-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-3xl font-semibold tracking-tight">{value}</div>
          {trend != null ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                up
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              )}
            >
              {up ? (
                <TrendingUp className="size-3.5" />
              ) : (
                <TrendingDown className="size-3.5" />
              )}
              {up ? "+" : ""}
              {trend}%
            </span>
          ) : null}
        </div>
        <Separator />
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Vs last month:{" "}
          {previous == null ? "—" : previous.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}
