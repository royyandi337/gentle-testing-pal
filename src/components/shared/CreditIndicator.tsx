import { Zap, Loader2, Crown } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function CreditIndicator({ className }: { className?: string }) {
  const { remaining, tier, dailyLimit, loading } = useCredits();

  if (loading) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <Loader2 className="size-3 animate-spin" />
        Memuat...
      </div>
    );
  }

  if (tier === "premium" || remaining === -1) {
    return (
      <Badge variant="default" className={cn("gap-1 bg-amber-500 hover:bg-amber-500", className)}>
        <Crown className="size-3" /> Premium
      </Badge>
    );
  }

  const pct = dailyLimit > 0 ? Math.round((remaining / dailyLimit) * 100) : 0;
  const color = pct > 50 ? "text-emerald-600" : pct > 20 ? "text-amber-600" : "text-red-600";

  return (
    <div className={cn("flex items-center gap-1.5 text-xs", className)}>
      <Zap className={cn("size-3", color)} />
      <span className="font-medium tabular-nums">{remaining}</span>
      <span className="text-muted-foreground">/ {dailyLimit} AI</span>
    </div>
  );
}
