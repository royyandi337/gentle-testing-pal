import { useState } from "react";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessState, type Phase } from "@/components/shared/ProcessState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadBlob } from "@/lib/image";
import { pdfToWord, type PdfToWordMode } from "@/lib/pdf-to-word";
import { saveResult, type HistoryCategory } from "@/lib/history";

const MODES: { value: PdfToWordMode; label: string; hint: string }[] = [
  {
    value: "auto",
    label: "Otomatis (disarankan)",
    hint: "Pakai teks asli PDF; halaman hasil scan otomatis dibaca dengan OCR.",
  },
  { value: "text", label: "Teks PDF saja", hint: "Cepat, untuk PDF digital yang sudah berteks." },
  { value: "ocr", label: "OCR semua halaman", hint: "Untuk PDF hasil scan/foto. Lebih lambat." },
  {
    value: "image",
    label: "Salin tampilan (gambar)",
    hint: "Tampilan Word 100% sama seperti PDF, namun teks tidak bisa diedit.",
  },
];

export function PdfToWordCard({ category = "word" }: { category?: HistoryCategory }) {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<PdfToWordMode>("auto");
  const [lang, setLang] = useState("ind+eng");
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);

  async function convert() {
    const file = files[0];
    if (!file) return;
    setPhase("working");
    setMessage("Menyiapkan konversi...");
    try {
      const result = await pdfToWord(file, {
        mode,
        ocrLang: lang,
        onProgress: ({ label }) => setMessage(label),
      });
      const fileName = `${file.name.replace(/\.[^.]+$/, "")}.docx`;
      downloadBlob(result.blob, fileName);
      try {
        await saveResult({
          category,
          tool: result.usedOcr ? "pdf-to-word-ocr" : "pdf-to-word",
          fileName,
          blob: result.blob,
        });
      } catch {
        // Riwayat opsional.
      }
      setPhase("done");
      setMessage(
        `${fileName} siap diunduh (${result.pages} halaman${result.usedOcr ? ", OCR aktif" : ""}).`,
      );
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Konversi PDF ke Word gagal.");
    }
  }

  const active = MODES.find((m) => m.value === mode);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">PDF ke Word (dengan OCR)</CardTitle>
        <CardDescription>
          Ubah PDF menjadi .docx. Ukuran halaman, posisi, dan ukuran teks mengikuti PDF aslinya. PDF
          hasil scan dibaca otomatis memakai OCR.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FileDropzone
          accept="application/pdf"
          files={files}
          onFiles={setFiles}
          hint="Satu berkas PDF"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Metode konversi</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as PdfToWordMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Bahasa OCR</Label>
            <Select value={lang} onValueChange={setLang} disabled={mode === "text" || mode === "image"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ind+eng">Indonesia + Inggris</SelectItem>
                <SelectItem value="ind">Indonesia</SelectItem>
                <SelectItem value="eng">Inggris</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {active ? <p className="text-xs text-muted-foreground">{active.hint}</p> : null}

        <Button disabled={!files.length || phase === "working"} onClick={convert}>
          Konversi ke Word
        </Button>

        <ProcessState phase={phase} message={message} />
      </CardContent>
    </Card>
  );
}
