import { useCallback, useEffect, useRef, useState } from "react";
import { X, Plus, Download, Trash2, ImagePlus } from "lucide-react";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessState, type Phase } from "@/components/shared/ProcessState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { canvasToBlob, downloadBlob, loadImage } from "@/lib/image";
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

type LoadedImage = { id: string; name: string; url: string; img: HTMLImageElement };

export function PolaroidCard() {
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [frameStyle, setFrameStyle] = useState("classic");
  const [caption, setCaption] = useState("");
  const [captionSize, setCaptionSize] = useState(24);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const previewRefs = useRef<HTMLCanvasElement[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const style = FRAME_STYLES.find((s) => s.value === frameStyle) ?? FRAME_STYLES[0]!;

  const MAX_FILE_SIZE = 20 * 1024 * 1024;

  const handleFiles = useCallback(async (files: File[]) => {
    const valid = files.filter((f) => f.type.startsWith("image/"));
    if (!valid.length) {
      setPhase("error");
      setMessage("Pilih berkas gambar (JPG, PNG, atau WEBP).");
      return;
    }
    const tooLarge = valid.filter((f) => f.size > MAX_FILE_SIZE);
    const ok = valid.filter((f) => f.size <= MAX_FILE_SIZE);
    setPhase("working");
    setMessage("Memuat gambar...");
    try {
      const loaded: LoadedImage[] = [];
      for (const file of ok) {
        const url = URL.createObjectURL(file);
        try {
          const img = await loadImage(url);
          loaded.push({ id: `${file.name}-${Date.now()}-${Math.random()}`, name: file.name, url, img });
        } catch {
          URL.revokeObjectURL(url);
        }
      }
      setImages((prev) => [...prev, ...loaded]);
      if (tooLarge.length) {
        setPhase("error");
        setMessage(`${tooLarge.length} file dilewati karena melebihi batas 20MB.`);
      } else {
        setPhase("done");
        setMessage(`${loaded.length} foto ditambahkan.`);
      }
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Gagal memuat gambar.");
    }
  }, []);

  function removeImage(id: string) {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((item) => item.id !== id);
    });
  }
  function clearAll() {
    setImages((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.url));
      return [];
    });
    setPhase("idle");
    setMessage(undefined);
    previewRefs.current = [];
  }

  const renderPolaroid = useCallback(
    (item: LoadedImage): HTMLCanvasElement => {
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx = canvas.getContext("2d")!;

      ctx.fillStyle = style.frameColor;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      ctx.strokeStyle = style.frameColor === "#ffffff" ? "#e0e0e0" : "rgba(0,0,0,0.15)";
      ctx.lineWidth = 1;
      ctx.strokeRect(FRAME_BORDER, FRAME_BORDER, PHOTO_W, PHOTO_H);

      if (style.sepia > 0) ctx.filter = `sepia(${style.sepia})`;

      const scale = Math.max(PHOTO_W / item.img.naturalWidth, PHOTO_H / item.img.naturalHeight);
      const w = item.img.naturalWidth * scale;
      const h = item.img.naturalHeight * scale;
      const photoX = FRAME_BORDER + (PHOTO_W - w) / 2;
      const photoY = FRAME_BORDER + (PHOTO_H - h) / 2;
      ctx.drawImage(item.img, photoX, photoY, w, h);
      ctx.filter = "none";

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
    },
    [style, caption, captionSize],
  );

  useEffect(() => {
    previewRefs.current = previewRefs.current.slice(0, images.length);
    images.forEach((item, i) => {
      const preview = previewRefs.current[i];
      if (!preview) return;
      const canvas = renderPolaroid(item);
      preview.width = canvas.width;
      preview.height = canvas.height;
      const ctx = preview.getContext("2d")!;
      ctx.drawImage(canvas, 0, 0);
    });
  }, [images, renderPolaroid]);

  async function download(format: "jpg" | "png") {
    if (!images.length) return;
    setPhase("working");
    setMessage("Membuat polaroid...");
    try {
      for (let i = 0; i < images.length; i++) {
        const canvas = renderPolaroid(images[i]!);
        const mime = format === "png" ? "image/png" : "image/jpeg";
        const blob = await canvasToBlob(canvas, mime, 0.92);
        const fileName = `polaroid-${i + 1}.${format}`;
        if (i === 0) {
          downloadBlob(blob, fileName);
        } else {
          setTimeout(() => downloadBlob(blob, fileName), i * 300);
        }
        try {
          await saveResult({ category: "photo", tool: "polaroid", fileName, blob });
        } catch { /* Riwayat opsional */ }
      }
      setPhase("done");
      setMessage(`${images.length} polaroid diunduh.`);
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Gagal membuat polaroid.");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]">
      {/* Form column (left) */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Polaroid</CardTitle>
          <CardDescription>
            Beri bingkai polaroid pada foto Anda. Tambahkan caption dan pilih gaya bingkai.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Photo strip */}
          {images.length ? (
            <div className="space-y-2">
              <Label>Foto terpilih ({images.length})</Label>
              <div className="grid grid-cols-4 gap-2">
                {images.map((item) => (
                  <div key={item.id} className="relative aspect-square overflow-hidden rounded-lg border bg-muted/30">
                    <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
                    <button
                      className="absolute right-1 top-1 flex size-7 items-center justify-center rounded bg-black/75 text-white"
                      onClick={() => removeImage(item.id)}
                      aria-label="Hapus foto"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Plus className="size-4" />
                  <span className="text-[10px] font-semibold">Tambah</span>
                </button>
              </div>
            </div>
          ) : (
            <FileDropzone
              accept="image/*"
              multiple
              onFiles={handleFiles}
              hint="Pilih satu atau beberapa foto"
            />
          )}

          {/* Frame style — visual picker */}
          <div className="space-y-2">
            <Label>Gaya bingkai</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {FRAME_STYLES.map((s) => (
                <button
                  key={s.value}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 transition ${
                    frameStyle === s.value
                      ? "border-primary bg-muted/40"
                      : "border-border bg-card hover:border-foreground/30"
                  }`}
                  onClick={() => setFrameStyle(s.value)}
                  aria-label={s.label}
                >
                  <span
                    className="size-7 rounded border border-black/10"
                    style={{ backgroundColor: s.frameColor }}
                  />
                  <span className="text-[10px] font-semibold leading-tight">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Caption */}
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

          {/* Caption size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Ukuran teks caption</Label>
              <span className="text-xs font-bold text-muted-foreground">{captionSize}px</span>
            </div>
            <Slider
              min={14}
              max={36}
              step={2}
              value={[captionSize]}
              onValueChange={([v]) => setCaptionSize(v ?? 24)}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 border-t border-dashed border-border pt-4">
            <Button disabled={!images.length || phase === "working"} onClick={() => download("jpg")}>
              <Download className="size-4" /> Download JPG
            </Button>
            <Button
              variant="secondary"
              disabled={!images.length || phase === "working"}
              onClick={() => download("png")}
            >
              <Download className="size-4" /> PNG
            </Button>
            {images.length ? (
              <>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <ImagePlus className="size-4" /> Tambah Foto
                </Button>
                <Button variant="ghost" size="icon" aria-label="Hapus semua" onClick={clearAll}>
                  <Trash2 className="size-4" />
                </Button>
              </>
            ) : null}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(Array.from(e.target.files));
              e.target.value = "";
            }}
          />
          <ProcessState phase={phase} message={message} />
        </CardContent>
      </Card>

      {/* Preview column (right) */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Pratinjau Polaroid</CardTitle>
          <CardDescription>
            {images.length
              ? `${images.length} foto · ${style.label}`
              : "Unggah foto untuk melihat pratinjau polaroid."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[200px] flex-wrap items-center justify-center gap-4 rounded-xl bg-muted/40 p-4 lg:min-h-[400px]">
            {!images.length ? (
              <div className="text-center text-sm text-muted-foreground">
                <Plus className="mx-auto mb-2 size-8 opacity-40" />
                Pratinjau akan muncul di sini setelah foto diunggah.
              </div>
            ) : (
              images.map((item, i) => (
                <canvas
                  key={item.id}
                  ref={(el) => {
                    previewRefs.current[i] = el;
                  }}
                  className="h-auto rounded-lg shadow-md"
                  style={{ maxHeight: "220px", width: "auto" }}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
