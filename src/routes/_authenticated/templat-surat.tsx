import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { FileEdit } from "lucide-react";

export const Route = createFileRoute("/_authenticated/templat-surat")({
  head: () => ({
    meta: [
      { title: "Templat Surat — ROY DIGITAL SOLUTION" },
      {
        name: "description",
        content: "Pilih templat, isi bagian kosong, langsung jadi.",
      },
    ],
  }),
  component: TemplatSuratPage,
});

function TemplatSuratPage() {
  return (
    <div>
      <PageHeader
        title="Templat Surat"
        description="Pilih templat, isi bagian kosong, langsung jadi."
      />
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-paper-dim">
            <FileEdit className="size-6 text-slate" strokeWidth={1.6} />
          </div>
          <h2 className="font-display text-lg font-semibold text-foreground">
            Segera hadir
          </h2>
          <p className="mt-2 max-w-xs text-sm text-slate">
            Fitur Templat Surat sedang dalam pengembangan. Nantikan kemudahan
            membuat surat resmi dalam hitungan menit.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
