import { Loader2, AlertCircle, CheckCircle2, Inbox } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export type Phase = "idle" | "working" | "done" | "error";

export function ProcessState({
  phase,
  message,
  progress,
}: {
  phase: Phase;
  message?: string;
  progress?: number;
}) {
  if (phase === "idle") return null;

  if (phase === "working") {
    return (
      <div className="space-y-2 rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="size-4 animate-spin text-primary" />
          {message ?? "Memproses..."}
        </div>
        {typeof progress === "number" ? <Progress value={progress} /> : null}
      </div>
    );
  }

  if (phase === "done") {
    return (
      <Alert>
        <CheckCircle2 className="size-4" />
        <AlertTitle>Selesai</AlertTitle>
        <AlertDescription>{message ?? "Proses berhasil diselesaikan."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle>Gagal</AlertTitle>
      <AlertDescription>{message ?? "Proses gagal. Silakan coba lagi."}</AlertDescription>
    </Alert>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-center">
      <Inbox className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
