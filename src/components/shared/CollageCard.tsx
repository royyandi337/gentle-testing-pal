import { useCallback, useEffect, useRef, useState } from "react";
import { X, Plus, Image as ImageIcon, Download } from "lucide-react";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessState, type Phase } from "@/components/shared/ProcessState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { canvasToBlob, downloadBlob, loadImage } from "@/lib/image";
import { saveResult } from "@/lib/history";

type LayoutId = "2x2" | "1x2" | "2x1" | "2x3" | "3x3";

const LAYOUTS: { id: LayoutId; label: string; cols: number; rows: number; slots: number }[] = [
  { id: "2x2", label: "2 × 2", cols: 2, rows: 2, slots: 4 },
  { id: "1x2", label: "1 × 2", cols: 2, rows: 1, slots: 2 },
  { id: "2x1", label: "2 × 1", cols: 1, rows: 2, slots: 2 },
  { id: "2x3", label: "2 × 3", cols: 2, rows: 3, slots: 6 },
  { id: "3x3", label: "3 × 3", cols: 3, rows: 3, slots: 9 },
];

type ShapeId = "square" | "circle" | "triangle" | "diamond" | "hexagon" | "star" | "heart";

const SHAPES: { id: ShapeId; label: string }[] = [
  { id: "square", label: "Kotak" },
  { id: "circle", label: "Bulat" },
  { id: "triangle", label: "Segitiga" },
  { id: "diamond", label: "Wajik" },
  { id: "hexagon", label: "Segi Enam" },
  { id: "star", label: "Bintang" },
  { id: "heart", label: "Love" },
];

const BG_COLORS = [
  { value: "#FFFFFF", label: "Putih" },
  { value: "#171A21", label: "Hitam" },
  { value: "#F2E6C9", label: "Krem" },
];

const CANVAS_SIZE = 1200;

type LoadedImage = { id: string; name: string; url: string; img: HTMLImageElement };
type TextOverlay = { id: string; text: string; size: number; position: "atas" | "tengah" | "bawah" };

const SHAPE_CLIP: Record<ShapeId, string> = {
  square: "none",
  circle: "circle(50% at 50% 50%)",
  triangle: "polygon(50% 2%, 2% 98%, 98% 98%)",
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  hexagon: "polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%)",
  star: "polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)",
  heart: "url(#collage-heart-clip)",
};

export function CollageCard() {
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [layoutId, setLayoutId] = useState<LayoutId>("2x2");
  const [shape, setShape] = useState<ShapeId>("square");
  const [bgColor, setBgColor] = useState("#FFFFFF");
  const [spacing, setSpacing] = useState(10);
  const [texts, setTexts] = useState<TextOverlay[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const layoutDef = LAYOUTS.find((l) => l.id === layoutId) ?? LAYOUTS[0]!;
  const slots = layoutDef.slots;
  const maxPhotos = 9;
  const MAX_FILE_SIZE = 20 * 1024 * 1024;

  async function handleFiles(files: File[]) {
    const valid = files.filter((f) => f.type.startsWith("image/"));
    if (!valid.length) return;
    const tooLarge = valid.filter((f) => f.size > MAX_FILE_SIZE);
    const ok = valid.filter((f) => f.size <= MAX_FILE_SIZE);
    setPhase("working");
    setMessage("Memuat gambar...");
    try {
      const loaded: LoadedImage[] = [];
      for (const file of ok) {
        if (images.length + loaded.length >= maxPhotos) break;
        const url = URL.createObjectURL(file);
        const img = await loadImage(url);
        loaded.push({ id: `${file.name}-${Date.now()}-${Math.random()}`, name: file.name, url, img });
      }
      setImages((prev) => [...prev, ...loaded]);
      if (tooLarge.length) {
        setPhase("error");
        setMessage(`${tooLarge.length} file dilewati karena melebihi batas 20MB.`);
      } else {
        setPhase("done");
        setMessage(`${loaded.length} gambar ditambahkan.`);
      }
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Gagal memuat gambar.");
    }
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((item) => item.id !== id);
    });
  }

  const renderCollage = useCallback((): HTMLCanvasElement => {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_SIZE;
    canvas.height = Math.round(CANVAS_SIZE * (layoutDef.rows / layoutDef.cols));
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
        continue;
      }
      const img = item.img;
      const scale = Math.max(cellW / img.naturalWidth, cellH / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.save();
      if (shape !== "square") {
        ctx.beginPath();
        const cx = x + cellW / 2;
        const cy = y + cellH / 2;
        if (shape === "circle") {
          ctx.arc(cx, cy, Math.min(cellW, cellH) / 2, 0, Math.PI * 2);
        } else if (shape === "triangle") {
          ctx.moveTo(cx, y);
          ctx.lineTo(x + cellW, y + cellH);
          ctx.lineTo(x, y + cellH);
          ctx.closePath();
        } else if (shape === "diamond") {
          ctx.moveTo(cx, y);
          ctx.lineTo(x + cellW, cy);
          ctx.lineTo(cx, y + cellH);
          ctx.lineTo(x, cy);
          ctx.closePath();
        } else if (shape === "hexagon") {
          for (let j = 0; j < 6; j++) {
            const angle = (Math.PI / 3) * j - Math.PI / 2;
            const px = cx + (Math.min(cellW, cellH) / 2) * Math.cos(angle);
            const py = cy + (Math.min(cellW, cellH) / 2) * Math.sin(angle);
            if (j === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
        } else if (shape === "star") {
          const r = Math.min(cellW, cellH) / 2;
          for (let j = 0; j < 10; j++) {
            const angle = (Math.PI / 5) * j - Math.PI / 2;
            const radius = j % 2 === 0 ? r : r * 0.4;
            const px = cx + radius * Math.cos(angle);
            const py = cy + radius * Math.sin(angle);
            if (j === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
        } else if (shape === "heart") {
          const w2 = cellW / 2;
          const h2 = cellH / 2;
          ctx.moveTo(x + w2, y + h2 * 0.3);
          ctx.bezierCurveTo(x + w2, y, x, y, x + w2 * 0.1, y + h2 * 0.1);
          ctx.bezierCurveTo(x, y + h2 * 0.5, x + w2, y + h2 * 0.8, x + w2, y + h2);
          ctx.bezierCurveTo(x + w2, y + h2 * 0.8, x + cellW, y + h2 * 0.5, x + cellW - w2 * 0.1, y + h2 * 0.1);
          ctx.bezierCurveTo(x + cellW, y, x + w2, y, x + w2, y + h2 * 0.3);
          ctx.closePath();
        }
        ctx.clip();
      }
      ctx.drawImage(img, x + (cellW - w) / 2, y + (cellH - h) / 2, w, h);
      ctx.restore();
    }

    for (const t of texts) {
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 3;
      ctx.font = `bold ${t.size}px "Space Grotesk", sans-serif`;
      ctx.textAlign = "center";
      const yPos =
        t.position === "atas" ? t.size + 20 : t.position === "tengah" ? canvas.height / 2 : canvas.height - 20;
      ctx.strokeText(t.text, canvas.width / 2, yPos);
      ctx.fillText(t.text, canvas.width / 2, yPos);
    }

    return canvas;
  }, [images, layoutDef, slots, spacing, bgColor, shape, texts]);

  useEffect(() => {
    if (!previewRef.current || !images.length) return;
    const canvas = renderCollage();
    const preview = previewRef.current;
    preview.width = canvas.width;
    preview.height = canvas.height;
    const ctx = preview.getContext("2d")!;
    ctx.drawImage(canvas, 0, 0);
  }, [renderCollage, images.length]);

  async function download(format: "jpg" | "png" | "pdf") {
    if (!images.length) return;
    setPhase("working");
    setMessage("Membuat kolase...");
    try {
      const canvas = renderCollage();
      const mime = format === "png" ? "image/png" : "image/jpeg";
      const blob = await canvasToBlob(canvas, mime, 0.92);
      const fileName = `kolase-${layoutDef.id}.${format === "pdf" ? "pdf" : format}`;
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
        } catch { /* Riwayat opsional */ }
      } else {
        downloadBlob(blob, fileName);
        try {
          await saveResult({ category: "photo", tool: "kolase", fileName, blob });
        } catch { /* Riwayat opsional */ }
      }
      setPhase("done");
      setMessage(`${fileName} siap diunduh.`);
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Gagal membuat kolase.");
    }
  }

  function addText() {
    setTexts((prev) => [...prev, { id: `text-${Date.now()}-${Math.random()}`, text: "", size: 24, position: "bawah" }]);
  }
  function updateText(id: string, key: keyof TextOverlay, value: string | number) {
    setTexts((prev) => prev.map((t) => (t.id === id ? { ...t, [key]: value } : t)));
  }
  function removeText(id: string) {
    setTexts((prev) => prev.filter((t) => t.id !== id));
  }

  const filledSlots = Math.min(images.length, slots);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kolase Foto</CardTitle>
        <CardDescription>
          Susun beberapa foto jadi satu kolase dengan berbagai layout dan bentuk kreatif.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
          {/* Left sidebar — controls */}
          <div className="space-y-5">
            {/* Photo strip */}
            <div className="space-y-2">
              <Label>Foto ({images.length}/{maxPhotos})</Label>
              <div className="grid grid-cols-3 gap-2">
                {images.map((item) => (
                  <div key={item.id} className="relative aspect-square overflow-hidden rounded-lg border bg-muted/30">
                    <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
                    <button
                      className="absolute right-1 top-1 flex size-5 items-center justify-center rounded bg-black/75 text-white"
                      onClick={() => removeImage(item.id)}
                      aria-label="Hapus foto"
                    >
                      <X className="size-2.5" />
                    </button>
                  </div>
                ))}
                {images.length < maxPhotos ? (
                  <button
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus className="size-4" />
                    <span className="text-[10px] font-semibold">Tambah</span>
                  </button>
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
            </div>

            {/* Layout picker — visual buttons */}
            <div className="space-y-2">
              <Label>Layout</Label>
              <div className="flex flex-wrap gap-2">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.id}
                    className={`grid size-11 gap-0.5 rounded-lg border p-1.5 transition ${
                      layoutId === l.id
                        ? "border-primary bg-muted/40"
                        : "border-border bg-card hover:border-foreground/30"
                    }`}
                    style={{
                      gridTemplateColumns: `repeat(${l.cols}, 1fr)`,
                      gridTemplateRows: `repeat(${l.rows}, 1fr)`,
                    }}
                    onClick={() => setLayoutId(l.id)}
                    aria-label={l.label}
                  >
                    {Array.from({ length: l.slots }).map((_, i) => (
                      <i key={i} className="block rounded-[1px]" style={{
                        backgroundColor: layoutId === l.id ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.4)",
                      }} />
                    ))}
                  </button>
                ))}
              </div>
            </div>

            {/* Shape picker */}
            <div className="space-y-2">
              <Label>Bentuk foto</Label>
              <div className="grid grid-cols-4 gap-2">
                {SHAPES.map((s) => (
                  <button
                    key={s.id}
                    className={`flex aspect-square items-center justify-center rounded-lg border transition ${
                      shape === s.id
                        ? "border-primary bg-muted/40"
                        : "border-border bg-card hover:border-foreground/30"
                    }`}
                    onClick={() => setShape(s.id)}
                    aria-label={s.label}
                  >
                    <ShapeIcon id={s.id} active={shape === s.id} />
                  </button>
                ))}
              </div>
            </div>

            {/* Background color */}
            <div className="space-y-2">
              <Label>Warna latar</Label>
              <div className="flex flex-wrap gap-2">
                {BG_COLORS.map((c) => (
                  <button
                    key={c.value}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      bgColor === c.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-foreground/30"
                    }`}
                    onClick={() => setBgColor(c.value)}
                  >
                    <span
                      className="size-3 rounded border border-black/15"
                      style={{ backgroundColor: c.value }}
                    />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Spacing slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Jarak antar foto</Label>
                <span className="text-xs font-bold text-muted-foreground">{spacing}px</span>
              </div>
              <Slider
                min={0}
                max={30}
                step={1}
                value={[spacing]}
                onValueChange={([v]) => setSpacing(v ?? 10)}
              />
            </div>

            {/* Text overlay */}
            <div className="space-y-2">
              <Label>Teks pada kolase</Label>
              <div className="space-y-2">
                {texts.map((t) => (
                  <div key={t.id} className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="text"
                        placeholder="Tulis teks..."
                        value={t.text}
                        onChange={(e) => updateText(t.id, "text", e.target.value)}
                        className="h-8 text-xs"
                      />
                      <button
                        className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground hover:text-foreground"
                        onClick={() => removeText(t.id)}
                        aria-label="Hapus teks"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={10}
                        max={60}
                        value={t.size}
                        onChange={(e) => updateText(t.id, "size", Number(e.target.value))}
                        className="h-8 w-16 text-xs"
                      />
                      <select
                        value={t.position}
                        onChange={(e) => updateText(t.id, "position", e.target.value)}
                        className="h-8 flex-1 rounded-md border bg-card px-1 text-xs"
                      >
                        <option value="atas">Atas</option>
                        <option value="tengah">Tengah</option>
                        <option value="bawah">Bawah</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="border border-dashed px-3 py-1.5 text-xs font-semibold text-primary hover:bg-muted/40"
                onClick={addText}
              >
                + Tambah baris teks
              </button>
            </div>
          </div>

          {/* Right — live canvas preview */}
          <div className="flex flex-col items-center gap-3">
            {!images.length ? (
              <div className="w-full">
                <FileDropzone
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onFiles={handleFiles}
                  hint="Pilih beberapa foto sekaligus"
                />
              </div>
            ) : (
              <>
                <div className="w-full overflow-hidden rounded-xl border bg-muted/30 p-2">
                  <canvas
                    ref={previewRef}
                    className="h-auto w-full"
                    style={{ maxHeight: "420px" }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {filledSlots} dari {slots} slot terisi
                </p>
                <div className="flex w-full flex-wrap gap-2">
                  <Button size="sm" className="flex-1" disabled={phase === "working"} onClick={() => download("jpg")}>
                    <Download className="size-4" /> Download JPG
                  </Button>
                  <Button variant="outline" size="sm" disabled={phase === "working"} onClick={() => download("png")}>
                    <Download className="size-4" /> PNG
                  </Button>
                  <Button variant="outline" size="sm" disabled={phase === "working"} onClick={() => download("pdf")}>
                    <Download className="size-4" /> PDF
                  </Button>
                </div>
              </>
            )}
            <ProcessState phase={phase} message={message} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ShapeIcon({ id, active }: { id: ShapeId; active: boolean }) {
  const color = active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.5)";
  const fill = active ? "hsl(var(--primary) / 0.15)" : "hsl(var(--muted) / 0.3)";
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill={fill} stroke={color} strokeWidth={1.8}>
      {id === "square" && <rect x="3" y="3" width="18" height="18" rx="2" />}
      {id === "circle" && <circle cx="12" cy="12" r="9" />}
      {id === "triangle" && <path d="M12 3 3 21h18z" strokeLinejoin="round" />}
      {id === "diamond" && <path d="M12 2 22 12 12 22 2 12z" strokeLinejoin="round" />}
      {id === "hexagon" && <path d="M8 3h8l5 9-5 9H8l-5-9z" strokeLinejoin="round" />}
      {id === "star" && (
        <path d="m12 2 2.9 6 6.6.9-4.8 4.6 1.1 6.5L12 17l-5.8 3 1.1-6.5-4.8-4.6 6.6-.9z" strokeLinejoin="round" />
      )}
      {id === "heart" && (
        <path
          d="M12 21s-7.5-4.6-10-9.3C.6 8.4 2.6 5 6 5c2 0 3.6 1.1 4.5 2.4C11.4 6.1 13 5 15 5c3.4 0 5.4 3.4 4 6.7C19.5 16.4 12 21 12 21z"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
