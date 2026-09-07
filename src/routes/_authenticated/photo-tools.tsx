import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RotateCw, RotateCcw, X, Plus, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { LabelPrintCard } from "@/components/shared/LabelPrintCard";
import { CollageCard } from "@/components/shared/CollageCard";
import { PolaroidCard } from "@/components/shared/PolaroidCard";
import { ProcessState, type Phase } from "@/components/shared/ProcessState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { canvasToBlob, downloadBlob, fileToDataUrl, loadImage } from "@/lib/image";
import { saveResult } from "@/lib/history";

export const Route = createFileRoute("/_authenticated/photo-tools")({
  head: () => ({
    meta: [
      { title: "Photo Tools — ROY DIGITAL SOLUTION" },
      {
        name: "description",
        content: "Resize, kompres, konversi, dan putar foto dengan kualitas terjaga.",
      },
      { property: "og:title", content: "Photo Tools — ROY DIGITAL SOLUTION" },
      {
        property: "og:description",
        content: "Resize, kompres, konversi, dan putar foto dengan kualitas terjaga.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PhotoToolsPage,
});

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function PhotoToolsPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);

  const [mode, setMode] = useState<"pixel" | "percent">("pixel");
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(0);
  const [percent, setPercent] = useState(50);
  const [quality, setQuality] = useState(80);
  const [format, setFormat] = useState<"jpg" | "png" | "webp">("jpg");

  // Per-image rotate state
  const [rotateItems, setRotateItems] = useState<{ id: string; file: File; url: string; angle: number }[]>([]);

  function addRotateFiles(files: File[]) {
    const newItems = files
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({ id: `${f.name}-${Date.now()}-${Math.random()}`, file: f, url: URL.createObjectURL(f), angle: 0 }));
    setRotateItems((prev) => [...prev, ...newItems]);
  }
  function removeRotateItem(id: string) {
    setRotateItems((prev) => prev.filter((item) => item.id !== id));
  }
  function rotateItem(id: string, delta: number) {
    setRotateItems((prev) => prev.map((item) => (item.id === id ? { ...item, angle: item.angle + delta } : item)));
  }
  function resetRotateItem(id: string) {
    setRotateItems((prev) => prev.map((item) => (item.id === id ? { ...item, angle: 0 } : item)));
  }
  async function applyAllRotations() {
    if (!rotateItems.length) return;
    setPhase("working");
    setMessage(`Memproses ${rotateItems.length} foto...`);
    try {
      let done = 0;
      for (const item of rotateItems) {
        const img = await loadImage(item.url);
        const rotate = ((item.angle % 360) + 360) % 360;
        const swap = rotate === 90 || rotate === 270;
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const canvas = document.createElement("canvas");
        canvas.width = swap ? h : w;
        canvas.height = swap ? w : h;
        const ctx = canvas.getContext("2d")!;
        const type = item.file.type || "image/jpeg";
        if (type !== "image/png") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotate * Math.PI) / 180);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        const blob = await canvasToBlob(canvas, type, quality / 100);
        const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
        const fileName = `${item.file.name.replace(/\.[^.]+$/, "")}-rotated.${ext}`;
        downloadBlob(blob, fileName);
        try {
          await saveResult({ category: "photo", tool: "rotate", fileName, blob });
        } catch {
          // Riwayat opsional.
        }
        done += 1;
        setMessage(`Memproses ${done}/${rotateItems.length} foto...`);
      }
      setPhase("done");
      setMessage(`${rotateItems.length} foto selesai diputar dan diunduh.`);
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Proses rotasi gagal.");
    }
  }

  async function process(tool: "resize" | "compress" | "convert" | "rotate") {
    if (!files.length) return;
    setPhase("working");
    setMessage(`Memproses ${files.length} foto...`);
    try {
      let done = 0;
      for (const file of files) {
        const img = await loadImage(await fileToDataUrl(file));
        let targetW = img.naturalWidth;
        let targetH = img.naturalHeight;

        if (tool === "resize") {
          if (mode === "percent") {
            targetW = Math.max(1, Math.round((img.naturalWidth * percent) / 100));
            targetH = Math.max(1, Math.round((img.naturalHeight * percent) / 100));
          } else {
            targetW = Math.max(1, width);
            targetH =
              height > 0
                ? height
                : Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * targetW));
          }
        }

        const rotate = 0;
        const swap = rotate === 90 || rotate === 270;
        const canvas = document.createElement("canvas");
        canvas.width = swap ? targetH : targetW;
        canvas.height = swap ? targetW : targetH;
        const ctx = canvas.getContext("2d")!;
        const type = tool === "convert" ? MIME[format]! : file.type || "image/jpeg";
        if (type !== "image/png") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotate * Math.PI) / 180);
        ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);

        const blob = await canvasToBlob(canvas, type, quality / 100);
        const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
        const fileName = `${file.name.replace(/\.[^.]+$/, "")}-${tool}.${ext}`;
        downloadBlob(blob, fileName);
        try {
          await saveResult({ category: "photo", tool, fileName, blob });
        } catch {
          // Riwayat opsional.
        }
        done += 1;
        setMessage(`Memproses ${done}/${files.length} foto...`);
      }
      setPhase("done");
      setMessage(`${files.length} foto selesai diproses dan diunduh.`);
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Proses foto gagal.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Photo Tools"
        description="Ubah ukuran, kompres, konversi format, dan putar foto secara instan."
      />

      <ProcessState phase={phase} message={message} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Unggah foto</CardTitle>
          <CardDescription>Format didukung: JPG, PNG, WEBP.</CardDescription>
        </CardHeader>
        <CardContent>
          <FileDropzone
            accept="image/jpeg,image/png,image/webp"
            multiple
            files={files}
            onFiles={setFiles}
            hint="Satu atau beberapa foto sekaligus"
          />
        </CardContent>
      </Card>

      <Tabs defaultValue="resize" className="mt-6">
        <TabsList>
          <TabsTrigger value="resize">Resize</TabsTrigger>
          <TabsTrigger value="compress">Kompres</TabsTrigger>
          <TabsTrigger value="convert">Konversi</TabsTrigger>
          <TabsTrigger value="rotate">Rotasi</TabsTrigger>
          <TabsTrigger value="label">Cetak Label/Resi</TabsTrigger>
          <TabsTrigger value="kolase">Kolase</TabsTrigger>
          <TabsTrigger value="polaroid">Polaroid</TabsTrigger>
        </TabsList>

        <TabsContent value="resize" className="mt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex gap-2">
                <Button
                  variant={mode === "pixel" ? "default" : "secondary"}
                  onClick={() => setMode("pixel")}
                >
                  Pixel
                </Button>
                <Button
                  variant={mode === "percent" ? "default" : "secondary"}
                  onClick={() => setMode("percent")}
                >
                  Persen
                </Button>
              </div>
              {mode === "pixel" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="w">Lebar (px)</Label>
                    <Input
                      id="w"
                      type="number"
                      min={1}
                      value={width}
                      onChange={(e) => setWidth(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="h">Tinggi (px, 0 = otomatis)</Label>
                    <Input
                      id="h"
                      type="number"
                      min={0}
                      value={height}
                      onChange={(e) => setHeight(Number(e.target.value))}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Skala: {percent}%</Label>
                  <Slider
                    min={5}
                    max={200}
                    step={5}
                    value={[percent]}
                    onValueChange={([v]) => setPercent(v ?? 50)}
                  />
                </div>
              )}
              <Button disabled={!files.length || phase === "working"} onClick={() => process("resize")}>
                Resize foto
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compress" className="mt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label>Kualitas: {quality}%</Label>
                <Slider
                  min={10}
                  max={100}
                  step={5}
                  value={[quality]}
                  onValueChange={([v]) => setQuality(v ?? 80)}
                />
              </div>
              <Button
                disabled={!files.length || phase === "working"}
                onClick={() => process("compress")}
              >
                Kompres foto
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="convert" className="mt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap gap-2">
                {(["jpg", "png", "webp"] as const).map((f) => (
                  <Button
                    key={f}
                    variant={format === f ? "default" : "secondary"}
                    onClick={() => setFormat(f)}
                  >
                    {f.toUpperCase()}
                  </Button>
                ))}
              </div>
              <Button
                disabled={!files.length || phase === "working"}
                onClick={() => process("convert")}
              >
                Konversi foto
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rotate" className="mt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-start gap-2">
                <RotateCw className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  Unggah beberapa foto, lalu putar satu per satu — pratinjau langsung berubah setiap kali tombol ditekan.
                </p>
              </div>
              <FileDropzone
                accept="image/jpeg,image/png,image/webp"
                multiple
                onFiles={addRotateFiles}
                hint="Satu atau beberapa foto sekaligus"
              />
              {rotateItems.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {rotateItems.map((item) => (
                      <div key={item.id} className="relative rounded-xl border bg-card p-3 space-y-2">
                        <button
                          className="absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-md border bg-background text-muted-foreground hover:text-foreground"
                          onClick={() => removeRotateItem(item.id)}
                          aria-label="Hapus foto"
                        >
                          <X className="size-3" />
                        </button>
                        <p className="truncate pr-6 text-xs font-medium text-foreground">{item.file.name}</p>
                        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border bg-background">
                          <img
                            src={item.url}
                            alt={item.file.name}
                            className="max-h-[78%] max-w-[78%] object-contain transition-transform duration-200"
                            style={{ transform: `rotate(${item.angle}deg)` }}
                          />
                        </div>
                        <p className="text-center text-xs font-medium text-muted-foreground">
                          {((item.angle % 360) + 360) % 360}°
                        </p>
                        <div className="flex gap-1.5">
                          <Button
                            variant="outline"
                            size="icon"
                            className="flex-1"
                            aria-label="Putar kiri"
                            onClick={() => rotateItem(item.id, -90)}
                          >
                            <RotateCcw className="size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-none px-2 text-xs"
                            onClick={() => resetRotateItem(item.id)}
                          >
                            Reset
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="flex-1"
                            aria-label="Putar kanan"
                            onClick={() => rotateItem(item.id, 90)}
                          >
                            <RotateCw className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 border-t border-dashed border-border pt-4">
                    <Button variant="outline" size="sm" onClick={() => addRotateFiles([])}>
                      <Plus className="size-4" /> Pilih Gambar
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={phase === "working"}
                      onClick={applyAllRotations}
                    >
                      <Download className="size-4" /> Terapkan & Unduh Semua
                    </Button>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="label" className="mt-4">
          <LabelPrintCard />
        </TabsContent>

        <TabsContent value="kolase" className="mt-4">
          <CollageCard />
        </TabsContent>

        <TabsContent value="polaroid" className="mt-4">
          <PolaroidCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
