import { useSiteSettings } from "@/hooks/useSiteSettings";
import { cn } from "@/lib/utils";

const DEFAULT_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" className="size-4">
    <path d="M12 2 3 7v10l9 5 9-5V7z" />
    <path d="M3 7l9 5 9-5" />
    <path d="M12 22V12" />
  </svg>
);

export function BrandMark({ light = false, className }: { light?: boolean; className?: string }) {
  const settings = useSiteSettings();
  const hasLogo = !!settings.logo_data_url;
  const nameMain = settings.site_name_main || "ROY DIGITAL";
  const nameSub = settings.site_name_sub || "SOLUTION";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px]",
          light ? "bg-white/10" : "bg-primary",
          hasLogo && "p-0.5",
        )}
      >
        {hasLogo ? (
          <img
            src={settings.logo_data_url!}
            alt={nameMain}
            className="h-full w-full object-contain"
          />
        ) : (
          DEFAULT_SVG
        )}
      </div>
      <div
        className={cn(
          "font-display text-[15px] font-bold leading-[1.1]",
          light ? "text-white" : "text-foreground",
        )}
      >
        {nameMain}
        <small
          className={cn(
            "block font-sans text-[10.5px] font-medium",
            light ? "text-white/50" : "text-slate",
          )}
          style={{ letterSpacing: "0.04em" }}
        >
          {nameSub}
        </small>
      </div>
    </div>
  );
}
