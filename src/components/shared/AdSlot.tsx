import { useCredits } from "@/hooks/useCredits";
import { Skeleton } from "@/components/ui/skeleton";

export type AdSlotVariant = "banner" | "sidebar" | "inline";

const VARIANT_CLASSES: Record<AdSlotVariant, string> = {
  banner: "h-20 w-full",
  sidebar: "h-40 w-full",
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
      className={`${VARIANT_CLASSES[variant]} ${className ?? ""} flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-sidebar-foreground/20 bg-sidebar-accent/30 text-center`}
      aria-label="Slot iklan"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/50">
        Iklan
      </p>
      <p className="text-[9.5px] text-sidebar-foreground/40">
        {VARIANT_LABEL[variant]} — tampil khusus tier Trial
      </p>
    </div>
  );
}
