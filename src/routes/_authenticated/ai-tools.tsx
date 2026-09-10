import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Download,
  Sparkles,
  Scissors,
  Crop,
  Wand2,
  ScanText,
  Copy,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessState, type Phase } from "@/components/shared/ProcessState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { fileToDataUrl } from "@/lib/image";
import { saveResult } from "@/lib/history";
import { isCreditError, CreditExhaustedAlert } from "@/components/shared/CreditExhaustedAlert";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ai-tools")({
  head: () => ({
    meta: [
      { title: "AI Tools — ROY DIGITAL SOLUTION" },
      {
        name: "description",
        content:
          "Enhance Image, Remove Background, dan OCR berbasis AI: perjelas foto, hapus background, dan ekstrak teks dari gambar.",
      },
      { property: "og:title", content: "AI Tools — ROY DIGITAL SOLUTION" },
      {
        property: "og:description",
        content: "Perjelas foto, hapus background, dan ekstrak teks dengan AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiToolsPage,
});

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

type ToolKind = "enhance" | "remove-bg" | "auto-crop" | "ocr";

const CHECKER =
  "repeating-conic-gradient(var(--color-muted) 0% 25%, var(--color-background) 0% 50%) 0 0 / 20px 20px";

async function autoCropImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak didukung di browser ini.");
  ctx.drawImage(bitmap, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imgData;

  let minX = width, minY = height, maxX = 0, maxY = 0;
  let found = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!, a = data[i + 3]!;
      if (a < 10) continue;
      const brightness = (r + g + b) / 3;
      if (brightness < 245) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) return canvas.toDataURL("image/png");

  const pad = Math.round(Math.min(width, height) * 0.03);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width, maxX + pad);
  maxY = Math.min(height, maxY + pad);

  const cropW = maxX - minX;
  const cropH = maxY - minY;
  const side = Math.max(cropW, cropH);
  const offX = Math.round((side - cropW) / 2);
  const offY = Math.round((side - cropH) / 2);

  const out = document.createElement("canvas");
  out.width = side;
  out.height = side;
  const outCtx = out.getContext("2d");
  if (!outCtx) throw new Error("Canvas tidak didukung di browser ini.");
  outCtx.fillStyle = "#FFFFFF";
  outCtx.fillRect(0, 0, side, side);
  outCtx.drawImage(canvas, minX, minY, cropW, cropH, offX, offY, cropW, cropH);
  return out.toDataURL("image/png");
}

/**
 * Invoke an Edge Function that returns a binary image on success.
 * Supabase functions.invoke parses JSON by default, so for binary
 * responses we use the raw fetch path via the Supabase Functions API URL
 * with the user's access token.
 */
async function invokeImageFunction(
  functionName: string,
  file: File,
  extraFields?: Record<string, string>,
): Promise<string> {
  const form = new FormData();
  form.append("image", file);
  if (extraFields) {
    for (const [key, value] of Object.entries(extraFields)) {
      form.append(key, value);
    }
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sesi berakhir. Silakan masuk kembali.");

  const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"];
  const supabaseKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!supabaseUrl || !supabaseKey) throw new Error("Konfigurasi server tidak ditemukan.");

  const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;
  const res = await fetch(functionUrl, {
    method: "POST",
    body: form,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseKey,
    },
  });

  const contentType = res.headers.get("content-type") ?? "";

  if (!res.ok) {
    let errorMsg: string;
    if (contentType.includes("application/json")) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      errorMsg = payload.error ?? `Proses AI gagal (${res.status}).`;
    } else {
      errorMsg = `Proses AI gagal (${res.status}).`;
    }
    throw new Error(errorMsg);
  }

  if (contentType.includes("application/json")) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string; image?: string };
    if (payload.error) throw new Error(payload.error);
    if (payload.image) return payload.image;
    throw new Error("Respons AI tidak berisi gambar.");
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

async function invokeOcrFunction(file: File): Promise<string> {
  const form = new FormData();
  form.append("image", file);

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sesi berakhir. Silakan masuk kembali.");

  const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"];
  const supabaseKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!supabaseUrl || !supabaseKey) throw new Error("Konfigurasi server tidak ditemukan.");

  const functionUrl = `${supabaseUrl}/functions/v1/jpg-to-ocr`;
  const res = await fetch(functionUrl, {
    method: "POST",
    body: form,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseKey,
    },
  });

  const contentType = res.headers.get("content-type") ?? "";

  if (!res.ok) {
    let errorMsg: string;
    if (contentType.includes("application/json")) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      errorMsg = payload.error ?? `Proses OCR gagal (${res.status}).`;
    } else {
      errorMsg = `Proses OCR gagal (${res.status}).`;
    }
    throw new Error(errorMsg);
  }

  if (!contentType.includes("application/json")) {
    throw new Error("Format respons OCR tidak dikenali.");
  }

  const payload = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (payload.error) throw new Error(payload.error);
  if (typeof payload.text !== "string") throw new Error("Respons OCR tidak berisi teks.");
  return payload.text;
}

function AiToolCard({ kind }: { kind: ToolKind }) {
  const [file, setFile] = useState<File | null>(null);
  const [before, setBefore] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);

  const isImageTool = kind === "enhance" || kind === "remove-bg" || kind === "auto-crop";
  const isOcrTool = kind === "ocr";

  const actionLabel =
    kind === "enhance" ? "Proses Enhance Image"
    : kind === "remove-bg" ? "Hapus Background"
    : kind === "auto-crop" ? "Auto Crop & Align"
    : "Ekstrak Teks (OCR)";

  const icon: ReactNode =
    kind === "enhance" ? <Sparkles className="size-4" />
    : kind === "remove-bg" ? <Scissors className="size-4" />
    : kind === "auto-crop" ? <Crop className="size-4" />
    : <ScanText className="size-4" />;

  async function pick(files: File[]) {
    const picked = files[0];
    if (!picked) return;
    if (!ALLOWED.includes(picked.type)) {
      setPhase("error");
      setMessage("Format tidak didukung. Gunakan JPG, PNG, atau WEBP.");
      return;
    }
    if (picked.size > MAX_BYTES) {
      setPhase("error");
      setMessage("Ukuran file melebihi 10MB. Kompres foto terlebih dahulu.");
      return;
    }
    setFile(picked);
    setAfter(null);
    setPhase("idle");
    setMessage(undefined);
    if (isImageTool) {
      setBefore(await fileToDataUrl(picked));
    }
  }

  async function run() {
    if (!file) return;
    setPhase("working");
    setAfter(null);
    setMessage(
      kind === "auto-crop"
        ? "Menganalisis foto dan memotong otomatis..."
        : "Mengirim ke server AI... proses pertama bisa 10–30 detik (cold start).",
    );
    try {
      let resultUrl: string | null = null;
      if (kind === "auto-crop") {
        resultUrl = await autoCropImage(file);
      } else if (kind === "enhance") {
        resultUrl = await invokeImageFunction("enhance-image", file, { transparent: "false" });
      } else if (kind === "remove-bg") {
        resultUrl = await invokeImageFunction("remove-background", file);
      } else if (kind === "ocr") {
        const text = await invokeOcrFunction(file);
        resultUrl = text;
      }
      setAfter(resultUrl);
      setPhase("done");
      setMessage(
        isOcrTool
          ? "Teks berhasil diekstrak. Salin atau unduh sebagai .txt."
          : "Hasil siap. Bandingkan sebelum/sesudah lalu unduh.",
      );
      if (isImageTool && resultUrl && resultUrl.startsWith("blob:")) {
        try {
          const blob = await (await fetch(resultUrl)).blob();
          await saveResult({
            category: "photo",
            tool: kind === "enhance" ? "ai-enhance" : kind === "remove-bg" ? "ai-remove-bg" : "ai-auto-crop",
            fileName: `${file.name.replace(/\.[^.]+$/, "")}-${kind}.png`,
            blob,
          });
        } catch {
          // Riwayat opsional.
        }
      }
    } catch (error) {
      setPhase("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Tidak dapat menghubungi layanan AI. Coba lagi beberapa saat.",
      );
    }
  }

  function downloadImage() {
    if (!after) return;
    const a = document.createElement("a");
    a.href = after;
    a.download = `${(file?.name ?? "hasil").replace(/\.[^.]+$/, "")}-${kind}.png`;
    a.click();
  }

  function downloadText() {
    if (!after) return;
    const blob = new Blob([after], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(file?.name ?? "hasil").replace(/\.[^.]+$/, "")}-ocr.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function copyText() {
    if (!after) return;
    navigator.clipboard.writeText(after);
    toast.success("Teks disalin ke clipboard.");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            {kind === "enhance" ? "Enhance Image"
              : kind === "remove-bg" ? "Remove Background"
              : kind === "auto-crop" ? "Auto Crop & Align"
              : "JPG to OCR"}
          </CardTitle>
          <CardDescription>
            {kind === "enhance"
              ? "Perjelas dan tingkatkan kualitas foto otomatis."
              : kind === "remove-bg"
                ? "Hapus background foto, hasil PNG transparan."
                : kind === "auto-crop"
                  ? "Potong & rapikan foto otomatis sesuai subjek."
                  : "Ekstrak teks dari gambar (JPG/PNG) menjadi teks yang bisa disalin."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileDropzone
            accept="image/jpeg,image/png,image/webp"
            files={file ? [file] : []}
            onFiles={pick}
            hint="Satu gambar per proses (maks. 10MB)"
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={!file || phase === "working"} onClick={run}>
              {icon}
              {actionLabel}
            </Button>
            {after && isImageTool ? (
              <Button variant="secondary" onClick={downloadImage}>
                <Download className="size-4" />
                Unduh hasil
              </Button>
            ) : null}
            {after && isOcrTool ? (
              <>
                <Button variant="secondary" onClick={copyText}>
                  <Copy className="size-4" />
                  Salin teks
                </Button>
                <Button variant="secondary" onClick={downloadText}>
                  <FileText className="size-4" />
                  Unduh .txt
                </Button>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {phase === "error" && isCreditError(message) ? (
        <CreditExhaustedAlert />
      ) : (
        <ProcessState phase={phase} message={message} />
      )}

      {isImageTool && before ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Sebelum</CardTitle>
            </CardHeader>
            <CardContent>
              <img
                src={before}
                alt="Gambar sebelum diproses AI"
                className="max-h-[420px] w-full rounded-lg object-contain"
                style={{ background: CHECKER }}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Sesudah</CardTitle>
            </CardHeader>
            <CardContent>
              {after ? (
                <img
                  src={after}
                  alt="Gambar hasil proses AI"
                  className="max-h-[420px] w-full rounded-lg object-contain"
                  style={{ background: CHECKER }}
                />
              ) : (
                <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                  {phase === "working" ? "Sedang diproses AI..." : "Belum ada hasil"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isOcrTool && phase === "done" && after ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ScanText className="size-4" /> Hasil Ekstraksi Teks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={after}
              readOnly
              rows={12}
              className="resize-y font-mono text-sm"
              placeholder="Teks hasil OCR akan muncul di sini..."
            />
          </CardContent>
        </Card>
      ) : null}

      {isOcrTool && phase === "working" ? (
        <Card>
          <CardContent className="py-8">
            <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              Sedang mengekstrak teks dari gambar...
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function AiToolsPage() {
  return (
    <div>
      <PageHeader
        title="AI Tools"
        description="Perjelas foto, hapus background, auto-crop, dan ekstrak teks — diproses aman lewat server."
        icon={Wand2}
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <AiToolCard kind="enhance" />
        <AiToolCard kind="remove-bg" />
        <AiToolCard kind="auto-crop" />
      </div>
      <div className="mt-5">
        <AiToolCard kind="ocr" />
      </div>
    </div>
  );
}
