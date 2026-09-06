import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { LabelPrintCard } from "@/components/shared/LabelPrintCard";
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
  const [rotation, setRotation] = useState(90);

  async function process(tool: "resize" | "compress" | "convert" | "rotate") {
    const file = files[0];
    if (!file) return;
    setPhase("working");
    setMessage("Memproses foto...");
    try {
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

      const rotate = tool === "rotate" ? ((rotation % 360) + 360) % 360 : 0;
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
      setPhase("done");
      setMessage(`${fileName} siap diunduh.`);
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
            files={files}
            onFiles={setFiles}
            hint="Satu foto per proses"
          />
        </CardContent>
      </Card>

      <Tabs defaultValue="resize" className="mt-6">
        <TabsList>
          <TabsTrigger value="resize">Resize</TabsTrigger>
          <TabsTrigger value="compress">Kompres</TabsTrigger>
          <TabsTrigger value="convert">Konversi</TabsTrigger>
          <TabsTrigger value="rotate">Rotasi</TabsTrigger>
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
              <div className="flex flex-wrap gap-2">
                {[90, 180, 270].map((deg) => (
                  <Button
                    key={deg}
                    variant={rotation === deg ? "default" : "secondary"}
                    onClick={() => setRotation(deg)}
                  >
                    {deg}°
                  </Button>
                ))}
              </div>
              <Button
                disabled={!files.length || phase === "working"}
                onClick={() => process("rotate")}
              >
                Putar foto
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
