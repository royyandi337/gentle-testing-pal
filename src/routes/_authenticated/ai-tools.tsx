import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Sparkles, Scissors, Crop, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessState, type Phase } from "@/components/shared/ProcessState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
          "Enhance Image dan Remove Background berbasis AI: perjelas foto dan hapus background jadi PNG transparan.",
      },
      { property: "og:title", content: "AI Tools — ROY DIGITAL SOLUTION" },
      {
        property: "og:description",
        content: "Perjelas foto dan hapus background otomatis dengan AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiToolsPage,
});

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

type ToolKind = "enhance" | "remove-bg" | "auto-crop";

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
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
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

function AiToolCard({ kind }: { kind: ToolKind }) {
  const [file, setFile] = useState<File | null>(null);
  const [before, setBefore] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);

  const endpoint = kind === "enhance" ? "/api/enhance-image" : "/api/remove-background";
  const actionLabel = kind === "enhance" ? "Proses Enhance Image" : kind === "remove-bg" ? "Hapus Background" : "Auto Crop & Align";
  const icon: ReactNode = kind === "enhance" ? <Sparkles className="size-4" /> : kind === "remove-bg" ? <Scissors className="size-4" /> : <Crop className="size-4" />;

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
    setBefore(await fileToDataUrl(picked));
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
      let resultDataUrl: string;
      if (kind === "auto-crop") {
        resultDataUrl = await autoCropImage(file);
      } else {
        const form = new FormData();
        form.append("image", file);
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const res = await fetch(endpoint, {
          method: "POST",
          body: form,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const payload = (await res.json().catch(() => ({}))) as { image?: string; error?: string };
        if (!res.ok || !payload.image) {
          throw new Error(payload.error ?? `Proses AI gagal (${res.status}).`);
        }
        resultDataUrl = payload.image;
      }
      setAfter(resultDataUrl);
      setPhase("done");
      setMessage("Hasil siap. Bandingkan sebelum/sesudah lalu unduh.");
      try {
        const blob = await (await fetch(resultDataUrl)).blob();
        await saveResult({
          category: "photo",
          tool: kind === "enhance" ? "ai-enhance" : kind === "remove-bg" ? "ai-remove-bg" : "ai-auto-crop",
          fileName: `${file.name.replace(/\.[^.]+$/, "")}-${kind}.png`,
          blob,
        });
      } catch {
        // Riwayat opsional.
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

  function download() {
    if (!after) return;
    const a = document.createElement("a");
    a.href = after;
    a.download = `${(file?.name ?? "hasil").replace(/\.[^.]+$/, "")}-${kind}.png`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            {kind === "enhance" ? "Enhance Image" : kind === "remove-bg" ? "Remove Background" : "Auto Crop & Align"}
          </CardTitle>
          <CardDescription>
            {kind === "enhance"
              ? "Perjelas dan tingkatkan kualitas foto otomatis."
              : kind === "remove-bg"
                ? "Hapus background foto, hasil PNG transparan."
                : "Potong & rapikan foto otomatis sesuai subjek."}
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
            {after ? (
              <Button variant="secondary" onClick={download}>
                <Download className="size-4" />
                Unduh hasil
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {phase === "error" && isCreditError(message) ? (
        <CreditExhaustedAlert />
      ) : (
        <ProcessState phase={phase} message={message} />
      )}

      {before ? (
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
    </div>
  );
}

function AiToolsPage() {
  return (
    <div>
      <PageHeader
        title="AI Tools"
        description="Perjelas foto, hapus background, dan auto-crop otomatis — diproses aman lewat server."
        icon={Wand2}
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <AiToolCard kind="enhance" />
        <AiToolCard kind="remove-bg" />
        <AiToolCard kind="auto-crop" />
      </div>
    </div>
  );
}
