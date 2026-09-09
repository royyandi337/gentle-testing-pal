import { Zap, Loader2, Crown } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import { cn } from "@/lib/utils";
import { hasUnlimitedAI, getEffectiveRole, type AppRole } from "@/lib/permissions";

export function CreditIndicator({ className }: { className?: string }) {
  const { remaining, tier, dailyLimit, loading } = useCredits();

  if (loading) {
    return (
      <div
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-lg bg-sidebar-accent/50 px-2.5 py-1.5 text-xs text-sidebar-foreground/70",
          className,
        )}
      >
        <Loader2 className="size-3 animate-spin" />
        Memuat...
      </div>
    );
  }

  const effective = getEffectiveRole(null, tier);

  if (hasUnlimitedAI(effective) || remaining === -1) {
    return (
      <div
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-lg bg-accent/15 px-2.5 py-1.5 text-xs font-medium text-accent",
          className,
        )}
      >
        <Crown className="size-3" /> PRO
      </div>
    );
  }

  const pct = dailyLimit > 0 ? Math.round((remaining / dailyLimit) * 100) : 0;
  const color =
    pct > 50
      ? "text-success"
      : pct > 20
        ? "text-accent"
        : "text-destructive";

  return (
    <div
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg bg-sidebar-accent/50 px-2.5 py-1.5 text-xs text-sidebar-foreground/80",
        className,
      )}
    >
      <Zap className={cn("size-3", color)} />
      <span className="font-semibold tabular-nums text-sidebar-foreground">{remaining}</span>
      <span className="text-sidebar-foreground/50">/ {dailyLimit} AI</span>
    </div>
  );
}
