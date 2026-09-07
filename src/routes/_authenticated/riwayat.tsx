import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ExternalLink, Trash2, History } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/shared/ProcessState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes } from "@/lib/image";
import {
  CATEGORY_LABEL,
  deleteHistoryItem,
  getSignedUrl,
  listHistory,
  type HistoryCategory,
} from "@/lib/history";

export const Route = createFileRoute("/_authenticated/riwayat")({
  head: () => ({
    meta: [
      { title: "Riwayat — ROY DIGITAL SOLUTION" },
      {
        name: "description",
        content: "Lihat, unduh, dan kelola semua hasil pekerjaan foto dan dokumen Anda.",
      },
      { property: "og:title", content: "Riwayat — ROY DIGITAL SOLUTION" },
      {
        property: "og:description",
        content: "Lihat, unduh, dan kelola semua hasil pekerjaan foto dan dokumen Anda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RiwayatPage,
});

const FILTERS: { id: "all" | HistoryCategory; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "pas-foto", label: "Pas Foto" },
  { id: "pdf", label: "PDF" },
  { id: "word", label: "Word" },
  { id: "photo", label: "Photo" },
];

function RiwayatPage() {
  const [filter, setFilter] = useState<"all" | HistoryCategory>("all");
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["history"],
    queryFn: listHistory,
  });

  const remove = useMutation({
    mutationFn: (row: { id: string; filePath?: string | null }) =>
      deleteHistoryItem(row.id, row.filePath ?? null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["history"] }),
  });

  const rows = (data ?? []).filter((row) => filter === "all" || row.category === filter);

  async function open(filePath: string, download: boolean, fileName: string) {
    const url = await getSignedUrl(filePath);
    if (download) {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div>
      <PageHeader
        title="Riwayat"
        description="Semua hasil pekerjaan Anda tersimpan aman dan hanya dapat diakses oleh Anda."
        icon={History}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={filter === f.id ? "default" : "secondary"}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          title="Gagal memuat riwayat"
          description={error instanceof Error ? error.message : "Silakan coba lagi."}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Belum ada riwayat"
          description="Hasil pekerjaan dari Pas Foto, PDF, Word, dan Photo Tools akan muncul di sini."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {CATEGORY_LABEL[row.category as HistoryCategory] ?? row.category}
                    </Badge>
                    <span className="truncate font-medium">{row.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.tool} · {new Date(row.created_at).toLocaleString("id-ID")}
                    {row.file?.file_size ? ` · ${formatBytes(row.file.file_size)}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {row.file ? (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => open(row.file!.file_path, false, row.file!.file_name)}
                      >
                        <ExternalLink className="size-4" /> Buka
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => open(row.file!.file_path, true, row.file!.file_name)}
                      >
                        <Download className="size-4" /> Unduh
                      </Button>
                    </>
                  ) : null}
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={remove.isPending}
                    onClick={() =>
                      remove.mutate({ id: row.id, filePath: row.file?.file_path ?? null })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
