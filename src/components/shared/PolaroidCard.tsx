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

const FRAME_STYLES = [
  { value: "classic", label: "Putih Klasik", frameColor: "#ffffff", bgTint: "#f0f0f0", sepia: 0 },
  { value: "vintage", label: "Vintage", frameColor: "#f5f0e6", bgTint: "#e8e0d0", sepia: 0.3 },
  { value: "dark", label: "Gelap", frameColor: "#2a2a2a", bgTint: "#1a1a1a", sepia: 0 },
  { value: "kraft", label: "Kraft", frameColor: "#d4a574", bgTint: "#c4956a", sepia: 0.15 },
  { value: "rose", label: "Rose", frameColor: "#fce4ec", bgTint: "#f8d7e0", sepia: 0 },
];

const PHOTO_W = 600;
const PHOTO_H = 600;
const FRAME_BORDER = 40;
const CAPTION_H = 80;
const CANVAS_W = PHOTO_W + FRAME_BORDER * 2;
const CANVAS_H = PHOTO_H + FRAME_BORDER + CAPTION_H;

type LoadedImage = { name: string; dataUrl: string; img: HTMLImageElement };

export function PolaroidCard() {
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [frameStyle, setFrameStyle] = useState("classic");
  const [caption, setCaption] = useState("");
  const [captionSize, setCaptionSize] = useState(24);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const previewRefs = useRef<HTMLCanvasElement[]>([]);

  const style = FRAME_STYLES.find((s) => s.value === frameStyle) ?? FRAME_STYLES[0];

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
      setMessage(`${loaded.length} foto ditambahkan.`);
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Gagal memuat gambar.");
    }
  }

  function renderPolaroid(item: LoadedImage, idx: number): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = style.frameColor;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (style.sepia > 0) {
      ctx.filter = `sepia(${style.sepia})`;
    }

    const scale = Math.max(PHOTO_W / item.img.naturalWidth, PHOTO_H / item.img.naturalHeight);
    const w = item.img.naturalWidth * scale;
    const h = item.img.naturalHeight * scale;
    const photoX = FRAME_BORDER + (PHOTO_W - w) / 2;
    const photoY = FRAME_BORDER + (PHOTO_H - h) / 2;
    ctx.drawImage(item.img, photoX, photoY, w, h);

    ctx.filter = "none";

    ctx.strokeStyle = style.frameColor === "#ffffff" ? "#e0e0e0" : "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(FRAME_BORDER, FRAME_BORDER, PHOTO_W, PHOTO_H);

    if (caption) {
      ctx.fillStyle = style.frameColor === "#2a2a2a" ? "#e0e0e0" : "#333333";
      ctx.font = `${captionSize}px "Bradley Hand", "Marker Felt", cursive, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const captionY = FRAME_BORDER + PHOTO_H + CAPTION_H / 2;
      const maxWidth = CANVAS_W - FRAME_BORDER * 2;
      ctx.fillText(caption, CANVAS_W / 2, captionY, maxWidth);
    }

    return canvas;
  }

  useEffect(() => {
    images.forEach((item, i) => {
      const preview = previewRefs.current[i];
      if (!preview) return;
      const canvas = renderPolaroid(item, i);
      preview.width = canvas.width;
      preview.height = canvas.height;
      const ctx = preview.getContext("2d")!;
      ctx.drawImage(canvas, 0, 0);
    });
  }, [images, frameStyle, caption, captionSize]);

  async function download(format: "jpg" | "png") {
    if (!images.length) return;
    setPhase("working");
    setMessage("Membuat polaroid...");
    try {
      for (let i = 0; i < images.length; i++) {
        const canvas = renderPolaroid(images[i], i);
        const mime = format === "png" ? "image/png" : "image/jpeg";
        const blob = await canvasToBlob(canvas, mime, 0.92);
        const fileName = `polaroid-${i + 1}.${format}`;
        downloadBlob(blob, fileName);
        try {
          await saveResult({ category: "photo", tool: "polaroid", fileName, blob });
        } catch {}
      }
      setPhase("done");
      setMessage(`${images.length} polaroid diunduh.`);
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Gagal membuat polaroid.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Polaroid</CardTitle>
        <CardDescription>
          Beri bingkai polaroid pada foto Anda. Tambahkan caption dan pilih gaya bingkai.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FileDropzone
          accept="image/jpeg,image/png,image/webp"
          multiple
          onFiles={handleFiles}
          hint="Pilih satu atau beberapa foto"
        />

        {images.length ? (
          <div className="space-y-2">
            <Label>Foto terpilih ({images.length})</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {images.map((item, i) => (
                <div key={`${item.name}-${i}`} className="relative rounded-lg border bg-card p-1">
                  <img
                    src={item.dataUrl}
                    alt={`Foto ${i + 1}`}
                    className="h-20 w-full rounded object-cover"
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Gaya bingkai</Label>
            <Select value={frameStyle} onValueChange={setFrameStyle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FRAME_STYLES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="polaroid-caption">Caption (opsional)</Label>
            <Input
              id="polaroid-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Tulis caption di sini"
              maxLength={40}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Ukuran teks caption: {captionSize}px</Label>
          <Slider
            min={14}
            max={36}
            step={2}
            value={[captionSize]}
            onValueChange={([v]) => setCaptionSize(v ?? 24)}
          />
        </div>

        {images.length ? (
          <div className="space-y-2">
            <Label>Preview polaroid</Label>
            <div className="flex flex-wrap gap-4">
              {images.map((item, i) => (
                <canvas
                  key={`${item.name}-${i}`}
                  ref={(el) => {
                    if (el) previewRefs.current[i] = el;
                  }}
                  className="h-auto rounded-lg shadow-md"
                  style={{ maxHeight: "300px", width: "auto" }}
                />
              ))}
            </div>
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
