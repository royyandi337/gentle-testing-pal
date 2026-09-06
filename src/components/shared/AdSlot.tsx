import { useCredits, type Tier } from "@/hooks/useCredits";
import { Skeleton } from "@/components/ui/skeleton";

export type AdSlotVariant = "banner" | "sidebar" | "inline";

const VARIANT_CLASSES: Record<AdSlotVariant, string> = {
  banner: "h-20 w-full",
  sidebar: "h-64 w-full",
  inline: "h-28 w-full",
};

const VARIANT_LABEL: Record<AdSlotVariant, string> = {
  banner: "Banner",
  sidebar: "Sidebar",
  inline: "Inline",
};

export function AdSlot({
  variant = "banner",
  className,
}: {
  variant?: AdSlotVariant;
  className?: string;
}) {
  const { tier, loading } = useCredits();

  if (loading) {
    return <Skeleton className={`${VARIANT_CLASSES[variant]} ${className ?? ""}`} />;
  }

  if (tier === "regular" || tier === "premium") return null;

  return (
    <div
      className={`${VARIANT_CLASSES[variant]} ${className ?? ""} flex items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 text-center`}
      aria-label="Slot iklan"
    >
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Iklan
        </p>
        <p className="text-[10px] text-muted-foreground/70">
          {VARIANT_LABEL[variant]} — khusus pengguna Trial
        </p>
      </div>
    </div>
  );
}
