import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessState, type Phase } from "@/components/shared/ProcessState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canvasToBlob, downloadBlob, fileToDataUrl, loadImage } from "@/lib/image";
import { saveResult } from "@/lib/history";

type CollageLayout = {
  value: string;
  label: string;
  cols: number;
  rows: number;
  strip?: "h" | "v";
};

const LAYOUTS: CollageLayout[] = [
  { value: "2x2", label: "Grid 2 × 2", cols: 2, rows: 2 },
  { value: "3x3", label: "Grid 3 × 3", cols: 3, rows: 3 },
  { value: "2x3", label: "Grid 2 × 3", cols: 2, rows: 3 },
  { value: "3x2", label: "Grid 3 × 2", cols: 3, rows: 2 },
  { value: "strip-h", label: "Strip Horizontal (1 × 4)", cols: 4, rows: 1, strip: "h" },
  { value: "strip-v", label: "Strip Vertikal (4 × 1)", cols: 1, rows: 4, strip: "v" },
];

const BG_COLORS = [
  { value: "#ffffff", label: "Putih" },
  { value: "#000000", label: "Hitam" },
  { value: "#f5f5f5", label: "Abu Muda" },
  { value: "#1a1a2e", label: "Navy Gelap" },
  { value: "#2d5a3d", label: "Hijau Gelap" },
];

const CANVAS_SIZE = 1200;

type LoadedImage = { name: string; dataUrl: string; img: HTMLImageElement };

export function CollageCard() {
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [layout, setLayout] = useState("2x2");
  const [spacing, setSpacing] = useState(12);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const layoutDef = LAYOUTS.find((l) => l.value === layout) ?? LAYOUTS[0];
  const slots = layoutDef.cols * layoutDef.rows;

  async function handleFiles(files: File[]) {
    const valid = files.filter((f) => f.type.startsWith("image/"));
    if (!valid.length) {
      setPhase("error");
      setMessage("Pilih berkas gambar (JPG, PNG, atau WEBP).");
      return;
    }
    setPhase("working");
    setMessage("Memuat gambar...");
    try {
      const loaded: LoadedImage[] = [];
      for (const file of valid) {
        const dataUrl = await fileToDataUrl(file);
        const img = await loadImage(dataUrl);
        loaded.push({ name: file.name, dataUrl, img });
      }
      setImages((prev) => [...prev, ...loaded]);
      setPhase("done");
      setMessage(`${loaded.length} gambar ditambahkan.`);
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Gagal memuat gambar.");
    }
  }

  function renderCollage(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_SIZE;
    canvas.height = layoutDef.strip === "h" ? Math.round(CANVAS_SIZE * 0.3) : layoutDef.strip === "v" ? CANVAS_SIZE : Math.round(CANVAS_SIZE * (layoutDef.rows / layoutDef.cols));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cellW = (canvas.width - spacing * (layoutDef.cols + 1)) / layoutDef.cols;
    const cellH = (canvas.height - spacing * (layoutDef.rows + 1)) / layoutDef.rows;

    for (let i = 0; i < slots; i++) {
      const col = i % layoutDef.cols;
      const row = Math.floor(i / layoutDef.cols);
      const x = spacing + col * (cellW + spacing);
      const y = spacing + row * (cellH + spacing);
      const item = images[i];
      if (!item) {
        ctx.fillStyle = "#e5e5e5";
        ctx.fillRect(x, y, cellW, cellH);
        ctx.strokeStyle = "#bbb";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(x, y, cellW, cellH);
        ctx.setLineDash([]);
        ctx.fillStyle = "#999";
        ctx.font = "16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`Slot ${i + 1}`, x + cellW / 2, y + cellH / 2);
        continue;
      }
      const img = item.img;
      const scale = Math.max(cellW / img.naturalWidth, cellH / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, x + (cellW - w) / 2, y + (cellH - h) / 2, w, h);
    }
    return canvas;
  }

  useEffect(() => {
    if (!previewRef.current || !images.length) return;
    const canvas = renderCollage();
    const preview = previewRef.current;
    preview.width = canvas.width;
    preview.height = canvas.height;
    const ctx = preview.getContext("2d")!;
    ctx.drawImage(canvas, 0, 0);
  }, [images, layout, spacing, bgColor]);

  async function download(format: "jpg" | "png" | "pdf") {
    if (!images.length) return;
    setPhase("working");
    setMessage("Membuat kolase...");
    try {
      const canvas = renderCollage();
      const mime = format === "png" ? "image/png" : "image/jpeg";
      const blob = await canvasToBlob(canvas, mime, 0.92);
      const fileName = `kolase-${layoutDef.value}.${format === "pdf" ? "pdf" : format}`;
      if (format === "pdf") {
        const { PDFDocument } = await import("pdf-lib");
        const doc = await PDFDocument.create();
        const embedded = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        const page = doc.addPage([canvas.width, canvas.height]);
        page.drawImage(embedded, { x: 0, y: 0, width: canvas.width, height: canvas.height });
        const bytes = await doc.save();
        const pdf = new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" });
        downloadBlob(pdf, fileName);
        try {
          await saveResult({ category: "photo", tool: "kolase", fileName, blob: pdf });
        } catch {}
      } else {
        downloadBlob(blob, fileName);
        try {
          await saveResult({ category: "photo", tool: "kolase", fileName, blob });
        } catch {}
      }
      setPhase("done");
      setMessage(`${fileName} siap diunduh.`);
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Gagal membuat kolase.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kolase Foto</CardTitle>
        <CardDescription>
          Susun beberapa foto jadi satu kolase dengan berbagai layout kreatif. Atur jarak dan warna latar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FileDropzone
          accept="image/jpeg,image/png,image/webp"
          multiple
          onFiles={handleFiles}
          hint="Pilih beberapa foto sekaligus"
        />

        {images.length ? (
          <div className="space-y-2">
            <Label>Foto terpilih ({images.length})</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {images.map((item, i) => (
                <div key={`${item.name}-${i}`} className="relative rounded-lg border bg-card p-1">
                  <img
                    src={item.dataUrl}
                    alt={`Foto ${i + 1}`}
                    className="h-16 w-full rounded object-cover"
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label={`Hapus foto ${i + 1}`}
                    className="absolute right-0.5 top-0.5 size-5"
                    onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <X className="size-2.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Layout</Label>
            <Select value={layout} onValueChange={setLayout}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LAYOUTS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Warna latar</Label>
            <Select value={bgColor} onValueChange={setBgColor}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BG_COLORS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Jarak antar foto: {spacing}px</Label>
            <Slider
              min={0}
              max={40}
              step={2}
              value={[spacing]}
              onValueChange={([v]) => setSpacing(v ?? 12)}
            />
          </div>
        </div>

        {images.length ? (
          <div className="space-y-2">
            <Label>Preview kolase</Label>
            <div className="overflow-hidden rounded-lg border bg-muted/30 p-2">
              <canvas
                ref={previewRef}
                className="h-auto w-full"
                style={{ maxHeight: "400px" }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {images.length} dari {slots} slot terisi.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button disabled={!images.length || phase === "working"} onClick={() => download("jpg")}>
            Download JPG
          </Button>
          <Button
            variant="secondary"
            disabled={!images.length || phase === "working"}
            onClick={() => download("png")}
          >
            Download PNG
          </Button>
          <Button
            variant="secondary"
            disabled={!images.length || phase === "working"}
            onClick={() => download("pdf")}
          >
            Download PDF
          </Button>
          {images.length ? (
            <Button variant="ghost" onClick={() => setImages([])}>
              Kosongkan
            </Button>
          ) : null}
        </div>

        <ProcessState phase={phase} message={message} />
      </CardContent>
    </Card>
  );
}
