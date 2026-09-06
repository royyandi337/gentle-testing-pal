import { useState } from "react";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessState, type Phase } from "@/components/shared/ProcessState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { downloadBlob } from "@/lib/image";
import { saveResult, type HistoryCategory } from "@/lib/history";
import { isCreditError, CreditExhaustedAlert } from "@/components/shared/CreditExhaustedAlert";

const MAX_PDF_BYTES = 20 * 1024 * 1024;

type EdgeResult = { filename?: string; mime?: string; base64?: string; error?: string };

function base64ToBlob(base64: string, mime: string): Blob {
  const clean = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes.buffer], { type: mime });
}

export function PdfToWordCard({ category = "word" }: { category?: HistoryCategory }) {
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);

  async function convert() {
    const file = files[0];
    if (!file) return;
    if (file.size > MAX_PDF_BYTES) {
      setPhase("error");
      setMessage("Ukuran PDF melebihi 20MB.");
      return;
    }
    setPhase("working");
    setMessage("Mengunggah PDF dan menjalankan konversi... Proses bisa 10–90 detik.");
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      const { data, error } = await supabase.functions.invoke<EdgeResult>("pdf-to-word", {
        body: form,
      });
      if (error) throw new Error(error.message);
      if (!data?.base64) throw new Error(data?.error ?? "Server konversi tidak mengembalikan hasil.");

      const mime =
        data.mime ||
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const blob = base64ToBlob(data.base64, mime);
      const fileName = data.filename || `${file.name.replace(/\.[^.]+$/, "")}.docx`;
      downloadBlob(blob, fileName);
      try {
        await saveResult({ category, tool: "pdf-to-word-ocr", fileName, blob });
      } catch {
        // Riwayat opsional.
      }
      setPhase("done");
      setMessage(`${fileName} siap diunduh.`);
    } catch (error) {
      setPhase("error");
      const raw = error instanceof Error ? error.message : "";
      setMessage(
        raw.toLowerCase().includes("timeout") || raw.toLowerCase().includes("fetch")
          ? "Server konversi belum siap atau permintaan timeout. Tunggu sebentar lalu coba lagi."
          : raw || "Konversi PDF ke Word gagal. Coba lagi.",
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">PDF ke Word (dengan OCR)</CardTitle>
        <CardDescription>
          Ubah PDF menjadi .docx. Tata letak mengikuti PDF aslinya dan PDF hasil scan dibaca
          otomatis memakai OCR di server.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FileDropzone
          accept="application/pdf"
          files={files}
          onFiles={setFiles}
          hint="Satu berkas PDF — maks 20MB"
        />

        <p className="text-xs text-muted-foreground">
          Konversi berjalan di server. Permintaan pertama bisa memakan 10–90 detik.
        </p>

        <Button disabled={!files.length || phase === "working"} onClick={convert}>
          {phase === "working" ? "Mengonversi..." : "Konversi ke Word"}
        </Button>

        {phase === "error" && isCreditError(message) ? (
          <CreditExhaustedAlert />
        ) : (
          <ProcessState phase={phase} message={message} />
        )}
      </CardContent>
    </Card>
  );
}
