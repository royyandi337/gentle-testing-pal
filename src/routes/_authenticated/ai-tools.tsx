import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Sparkles, Scissors } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessState, type Phase } from "@/components/shared/ProcessState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fileToDataUrl } from "@/lib/image";
import { saveResult } from "@/lib/history";
import { isCreditError, CreditExhaustedAlert } from "@/components/shared/CreditExhaustedAlert";

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

type ToolKind = "enhance" | "remove-bg";

const CHECKER =
  "repeating-conic-gradient(var(--color-muted) 0% 25%, var(--color-background) 0% 50%) 0 0 / 20px 20px";

function AiToolCard({ kind }: { kind: ToolKind }) {
  const [file, setFile] = useState<File | null>(null);
  const [before, setBefore] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);

  const endpoint = kind === "enhance" ? "/api/enhance-image" : "/api/remove-background";
  const actionLabel = kind === "enhance" ? "Proses Enhance Image" : "Hapus Background";

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
    setMessage("Mengirim ke server AI... proses pertama bisa 10–30 detik (cold start).");
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch(endpoint, { method: "POST", body: form });
      const payload = (await res.json().catch(() => ({}))) as { image?: string; error?: string };
      if (!res.ok || !payload.image) {
        throw new Error(payload.error ?? `Proses AI gagal (${res.status}).`);
      }
      setAfter(payload.image);
      setPhase("done");
      setMessage("Hasil AI siap. Bandingkan sebelum/sesudah lalu unduh.");
      try {
        const blob = await (await fetch(payload.image)).blob();
        await saveResult({
          category: "photo",
          tool: kind === "enhance" ? "ai-enhance" : "ai-remove-bg",
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
          <CardTitle className="text-base">Unggah gambar</CardTitle>
          <CardDescription>JPG, PNG, atau WEBP. Maksimal 10MB.</CardDescription>
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
              {kind === "enhance" ? (
                <Sparkles className="size-4" />
              ) : (
                <Scissors className="size-4" />
              )}
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
        description="Perjelas foto (Enhance Image) dan hapus background otomatis, diproses aman lewat server."
      />
      <Tabs defaultValue="enhance" className="mt-6">
        <TabsList>
          <TabsTrigger value="enhance">Enhance Image</TabsTrigger>
          <TabsTrigger value="remove-bg">Remove Background</TabsTrigger>
        </TabsList>
        <TabsContent value="enhance" className="mt-4">
          <AiToolCard kind="enhance" />
        </TabsContent>
        <TabsContent value="remove-bg" className="mt-4">
          <AiToolCard kind="remove-bg" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
