import type { LucideIcon } from "lucide-react";
import { AlertCircle, Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
      <Icon className="mb-3 size-9 opacity-60" strokeWidth={1.5} />
      <h4 className="text-sm font-semibold">{title}</h4>
      {description ? (
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Terjadi kesalahan",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/50 bg-destructive/5 px-6 py-10 text-center">
      <AlertCircle className="mb-3 size-9 text-destructive" strokeWidth={1.5} />
      <h4 className="text-sm font-semibold text-destructive">{title}</h4>
      {description ? (
        <p className="mt-1 max-w-xs text-xs text-destructive/80">{description}</p>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-destructive/30 px-4 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10"
        >
          Coba lagi
        </button>
      ) : null}
    </div>
  );
}
