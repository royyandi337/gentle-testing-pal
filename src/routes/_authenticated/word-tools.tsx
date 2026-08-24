import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { PdfToWordCard } from "@/components/shared/PdfToWordCard";
import { ProcessState, type Phase } from "@/components/shared/ProcessState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadBlob } from "@/lib/image";
import { docxToPdf } from "@/lib/pdf";
import { saveResult } from "@/lib/history";

export const Route = createFileRoute("/_authenticated/word-tools")({
  head: () => ({
    meta: [
      { title: "Word Tools — ROY DIGITAL SOLUTION" },
      {
        name: "description",
        content: "Konversi dokumen Word ke PDF dan ekstrak teks dokumen dengan cepat.",
      },
      { property: "og:title", content: "Word Tools — ROY DIGITAL SOLUTION" },
      {
        property: "og:description",
        content: "Konversi dokumen Word ke PDF dan ekstrak teks dokumen dengan cepat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WordToolsPage,
});

function WordToolsPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);

  async function convert(mode: "pdf" | "txt") {
    const file = files[0];
    if (!file) return;
    setPhase("working");
    setMessage("Mengonversi dokumen...");
    try {
      const base = file.name.replace(/\.[^.]+$/, "");
      let blob: Blob;
      let fileName: string;
      if (mode === "pdf") {
        blob = await docxToPdf(file);
        fileName = `${base}.pdf`;
      } else {
        const mammoth = await import("mammoth");
        const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        blob = new Blob([value], { type: "text/plain" });
        fileName = `${base}.txt`;
      }
      downloadBlob(blob, fileName);
      try {
        await saveResult({ category: "word", tool: `word-to-${mode}`, fileName, blob });
      } catch {
        // Riwayat opsional.
      }
      setPhase("done");
      setMessage(`${fileName} siap diunduh.`);
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Konversi gagal.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Word Tools"
        description="Konversi dan kelola dokumen Word (.docx) langsung dari browser."
      />

      <ProcessState phase={phase} message={message} />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Word ke PDF / Teks</CardTitle>
            <CardDescription>
              Unggah berkas .docx, lalu pilih format keluaran yang diinginkan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileDropzone accept=".docx" files={files} onFiles={setFiles} hint="Berkas .docx" />
            <div className="flex flex-wrap gap-2">
              <Button disabled={!files.length || phase === "working"} onClick={() => convert("pdf")}>
                Konversi ke PDF
              </Button>
              <Button
                variant="secondary"
                disabled={!files.length || phase === "working"}
                onClick={() => convert("txt")}
              >
                Ekstrak teks (.txt)
              </Button>
            </div>
          </CardContent>
        </Card>

        <PdfToWordCard category="word" />

      </div>
    </div>
  );
}
