import { useCallback, useEffect, useRef, useState } from "react";
import { X, Printer, FileText, Image as ImageIcon, ZoomIn, ZoomOut } from "lucide-react";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessState, type Phase } from "@/components/shared/ProcessState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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

type GridLayout = {
  type: "grid";
  value: string;
  label: string;
  cols: number;
  rows: number;
};

type CardLayout = {
  type: "card";
  value: string;
  label: string;
  cardWmm: number;
  cardHmm: number;
};

const LAYOUTS: (GridLayout | CardLayout)[] = [
  { type: "grid", value: "4", label: "4 per lembar (2 × 2)", cols: 2, rows: 2 },
  { type: "grid", value: "2", label: "2 per lembar (1 × 2)", cols: 1, rows: 2 },
  { type: "grid", value: "6", label: "6 per lembar (2 × 3)", cols: 2, rows: 3 },
  { type: "grid", value: "9", label: "9 per lembar (3 × 3)", cols: 3, rows: 3 },
  { type: "card", value: "ktp", label: "KTP (8,56 × 5,4 cm) — 10 per lembar", cardWmm: 85.6, cardHmm: 53.98 },
  { type: "card", value: "id", label: "Kartu ID (8,56 × 5,4 cm) — 10 per lembar", cardWmm: 85.6, cardHmm: 53.98 },
];

// A4 at 150 DPI.
const PAGE_W = 1240;
const PAGE_H = 1754;
const PAGE_MARGIN = 40;
const MM_TO_PX = 150 / 25.4;
const CROP_MARK_LEN = 14;
const CROP_MARK_GAP = 4;

type Cropped = { name: string; dataUrl: string; width: number; height: number };

async function autoCrop(file: File): Promise<Cropped> {
  const img = await loadImage(await fileToDataUrl(file));
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const probe = document.createElement("canvas");
  probe.width = w;
  probe.height = h;
  const pctx = probe.getContext("2d", { willReadFrequently: true })!;
  pctx.drawImage(img, 0, 0);
  const { data } = pctx.getImageData(0, 0, w, h);

  const step = Math.max(1, Math.floor(w / 200));
  const lightRatio: number[] = [];
  for (let y = 0; y < h; y += 1) {
    let light = 0;
    let total = 0;
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      const lum = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      if (lum > 170) light += 1;
      total += 1;
    }
    lightRatio.push(total ? light / total : 0);
  }

  const isContent = (y: number) => (lightRatio[y] ?? 0) >= 0.6;
  let top = 0;
  while (top < h - 1 && !isContent(top)) top += 1;
  let bottom = h - 1;
  while (bottom > top + 1 && !isContent(bottom)) bottom -= 1;

  if (bottom - top < h * 0.6) {
    top = 0;
    bottom = h - 1;
  }

  const ch = bottom - top + 1;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = ch;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, ch);
  ctx.drawImage(img, 0, top, w, ch, 0, 0, w, ch);
  return {
    name: file.name.replace(/\.[^.]+$/, ""),
    dataUrl: out.toDataURL("image/jpeg", 0.92),
    width: w,
    height: ch,
  };
}

function drawCropMarks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 1;
  const g = CROP_MARK_GAP;
  const len = CROP_MARK_LEN;

  const corners = [
    { cx: x, cy: y, dx: -1, dy: -1 },
    { cx: x + w, cy: y, dx: 1, dy: -1 },
    { cx: x, cy: y + h, dx: -1, dy: 1 },
    { cx: x + w, cy: y + h, dx: 1, dy: 1 },
  ];

  for (const { cx, cy, dx, dy } of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * g, cy + dy * g);
    ctx.lineTo(cx + dx * (g + len), cy + dy * g);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + dx * g, cy + dy * g);
    ctx.lineTo(cx + dx * g, cy + dy * (g + len));
    ctx.stroke();
  }
}

export function LabelPrintCard() {
  const [items, setItems] = useState<Cropped[]>([]);
  const [layout, setLayout] = useState<string>("4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [margin, setMargin] = useState(40);
  const [zoom, setZoom] = useState(1);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sheetInfo, setSheetInfo] = useState<{ pages: number; perPage: number }>();

  const layoutDef = LAYOUTS.find((l) => l.value === layout) ?? LAYOUTS[0]!;

  const isLandscape = orientation === "landscape";
  const pageW = isLandscape ? PAGE_H : PAGE_W;
  const pageH = isLandscape ? PAGE_W : PAGE_H;

  let perPage: number;
  let cols: number;
  let rows: number;
  let cardW = 0;
  let cardH = 0;

  if (layoutDef.type === "grid") {
    cols = layoutDef.cols;
    rows = layoutDef.rows;
    perPage = cols * rows;
  } else {
    cardW = Math.round(layoutDef.cardWmm * MM_TO_PX);
    cardH = Math.round(layoutDef.cardHmm * MM_TO_PX);
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2;
    const gap = CROP_MARK_GAP * 2 + CROP_MARK_LEN;
    cols = Math.floor((availW + gap) / (cardW + gap));
    rows = Math.floor((availH + gap) / (cardH + gap));
    perPage = cols * rows;
  }

  const pageCount = Math.max(1, Math.ceil(items.length / perPage));

  const renderPages = useCallback(async (): Promise<HTMLCanvasElement[]> => {
    const pages: HTMLCanvasElement[] = [];
    for (let p = 0; p < pageCount; p += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = pageW;
      canvas.height = pageH;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageW, pageH);

      if (layoutDef.type === "grid") {
        const cellW = (pageW - margin * 2) / cols;
        const cellH = (pageH - margin * 2) / rows;
        const slice = items.slice(p * perPage, (p + 1) * perPage);
        for (let i = 0; i < slice.length; i += 1) {
          const item = slice[i]!;
          const img = await loadImage(item.dataUrl);
          const col = i % cols;
          const row = Math.floor(i / cols);
          const pad = 12;
          const boxW = cellW - pad * 2;
          const boxH = cellH - pad * 2;
          const scale = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
          const w = img.naturalWidth * scale;
          const h = img.naturalHeight * scale;
          const x = margin + col * cellW + (cellW - w) / 2;
          const y = margin + row * cellH + (cellH - h) / 2;
          ctx.drawImage(img, x, y, w, h);
        }
      } else {
        const gap = CROP_MARK_GAP * 2 + CROP_MARK_LEN;
        const totalW = cols * cardW + (cols - 1) * gap;
        const totalH = rows * cardH + (rows - 1) * gap;
        const startX = (pageW - totalW) / 2;
        const startY = (pageH - totalH) / 2;
        const slice = items.slice(p * perPage, (p + 1) * perPage);
        for (let i = 0; i < slice.length; i += 1) {
          const item = slice[i]!;
          const img = await loadImage(item.dataUrl);
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = startX + col * (cardW + gap);
          const y = startY + row * (cardH + gap);
          const scale = Math.min(cardW / img.naturalWidth, cardH / img.naturalHeight);
          const w = img.naturalWidth * scale;
          const h = img.naturalHeight * scale;
          const dx = x + (cardW - w) / 2;
          const dy = y + (cardH - h) / 2;
          ctx.drawImage(img, dx, dy, w, h);
          drawCropMarks(ctx, x, y, cardW, cardH);
        }
      }

      pages.push(canvas);
    }
    return pages;
  }, [items, pageCount, pageW, pageH, layoutDef, cols, rows, perPage, cardW, cardH, margin]);

  // Live A4 sheet preview
  useEffect(() => {
    const host = sheetRef.current;
    if (!host || !items.length) {
      setSheetInfo(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      const pages = await renderPages();
      if (cancelled || !host) return;
      host.replaceChildren();
      for (const canvas of pages) {
        canvas.style.maxHeight = `${460 * zoom}px`;
        canvas.style.width = "auto";
        canvas.style.maxWidth = "100%";
        canvas.className = "rounded-xl border shadow-sm bg-white";
        host.appendChild(canvas);
      }
      setSheetInfo({ pages: pages.length, perPage });
    })();
    return () => { cancelled = true; };
  }, [renderPages, items.length, perPage, zoom]);

  async function handleFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) {
      setPhase("error");
      setMessage("Pilih berkas gambar (JPG, PNG, atau WEBP).");
      return;
    }
    setPhase("working");
    setMessage("Memotong otomatis area resi...");
    try {
      const cropped: Cropped[] = [];
      for (const file of images) cropped.push(await autoCrop(file));
      setItems((prev) => [...prev, ...cropped]);
      setPhase("done");
      setMessage(`${cropped.length} gambar dipotong otomatis.`);
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Gagal memotong gambar.");
    }
  }

  async function downloadPdf() {
    if (!items.length) return;
    setPhase("working");
    setMessage("Menyusun lembar cetak PDF...");
    try {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.create();
      for (const canvas of await renderPages()) {
        const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
        const embedded = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        const w = isLandscape ? 841.89 : 595.28;
        const h = isLandscape ? 595.28 : 841.89;
        const page = doc.addPage([w, h]);
        page.drawImage(embedded, { x: 0, y: 0, width: w, height: h });
      }
      const bytes = await doc.save();
      const pdf = new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" });
      const fileName = `label-resi-${items.length}pcs.pdf`;
      downloadBlob(pdf, fileName);
      try {
        await saveResult({ category: "photo", tool: "label-resi", fileName, blob: pdf });
      } catch {
        // Riwayat opsional.
      }
      setPhase("done");
      setMessage(`${fileName} siap dicetak (${pageCount} halaman).`);
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Gagal membuat PDF.");
    }
  }

  async function downloadJpgPages() {
    if (!items.length) return;
    setPhase("working");
    setMessage("Menyiapkan halaman JPG...");
    try {
      const pages = await renderPages();
      for (let i = 0; i < pages.length; i += 1) {
        const blob = await canvasToBlob(pages[i]!, "image/jpeg", 0.92);
        downloadBlob(blob, `label-resi-hal-${i + 1}.jpg`);
      }
      setPhase("done");
      setMessage(`${pages.length} halaman JPG diunduh.`);
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Gagal membuat JPG.");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
      {/* Form column (left) */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Printer className="size-4 text-muted-foreground" /> Cetak Label/Resi
          </CardTitle>
          <CardDescription>
            Unggah screenshot resi — status bar &amp; area chat dipotong otomatis, lalu disusun di kertas A4.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileDropzone
            accept="image/jpeg,image/png,image/webp"
            multiple
            onFiles={handleFiles}
            hint="Beberapa screenshot resi sekaligus"
          />

          {items.length ? (
            <div className="space-y-2">
              <Label>Preview hasil potong ({items.length} gambar)</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {items.map((item, i) => (
                  <div key={`${item.name}-${i}`} className="relative rounded-lg border bg-card p-1">
                    <img
                      src={item.dataUrl}
                      alt={`Resi ${i + 1}`}
                      className="h-24 w-full rounded object-contain"
                    />
                    <Button
                      variant="secondary"
                      size="icon"
                      aria-label={`Hapus resi ${i + 1}`}
                      className="absolute right-1 top-1 size-6"
                      onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>Layout cetak (A4)</Label>
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
            <Label>Orientasi kertas</Label>
            <div className="flex gap-2">
              <Button
                variant={orientation === "portrait" ? "default" : "outline"}
                size="sm"
                onClick={() => setOrientation("portrait")}
              >
                Portrait
              </Button>
              <Button
                variant={orientation === "landscape" ? "default" : "outline"}
                size="sm"
                onClick={() => setOrientation("landscape")}
              >
                Landscape
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Margin kertas</Label>
              <span className="text-xs font-medium text-muted-foreground">{margin}px</span>
            </div>
            <Slider
              min={0}
              max={80}
              step={5}
              value={[margin]}
              onValueChange={([v]) => setMargin(v ?? 40)}
            />
          </div>

          {items.length ? (
            <p className="text-xs text-muted-foreground">
              {items.length} gambar → {pageCount} halaman A4 ({perPage} per halaman).
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button disabled={!items.length || phase === "working"} onClick={downloadPdf}>
              <FileText className="size-4" /> Download PDF
            </Button>
            <Button
              variant="secondary"
              disabled={!items.length || phase === "working"}
              onClick={downloadJpgPages}
            >
              <ImageIcon className="size-4" /> JPG per halaman
            </Button>
            {items.length ? (
              <Button variant="ghost" onClick={() => setItems([])}>
                Kosongkan
              </Button>
            ) : null}
          </div>

          <ProcessState phase={phase} message={message} />
        </CardContent>
      </Card>

      {/* Preview column (right) */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Pratinjau Lembar A4</CardTitle>
          <CardDescription>
            {items.length
              ? `${pageCount} halaman · ${perPage} resi per halaman · ${orientation}`
              : "Unggah resi untuk melihat pratinjau susunan cetak."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            ref={sheetRef}
            className="flex min-h-[400px] flex-col items-center justify-center gap-4 overflow-auto rounded-xl bg-muted/40 p-4"
          >
            {!items.length ? (
              <div className="text-center text-sm text-muted-foreground">
                <Printer className="mx-auto mb-2 size-8 opacity-40" />
                Pratinjau akan muncul di sini setelah resi diunggah.
              </div>
            ) : null}
          </div>

          {items.length ? (
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Perkecil"
                onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
              >
                <ZoomOut className="size-4" />
              </Button>
              <span className="w-14 text-center text-xs font-medium tabular-nums text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="Perbesar"
                onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
              >
                <ZoomIn className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setZoom(1)}
              >
                Reset
              </Button>
            </div>
          ) : null}
          {sheetInfo ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {sheetInfo.pages} halaman · {sheetInfo.perPage} resi per halaman
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
