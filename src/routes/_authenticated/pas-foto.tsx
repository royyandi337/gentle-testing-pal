import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crop,
  Download,
  Image as ImageIcon,
  Info,
  Loader2,
  Minus,
  Palette,
  Plus,
  Printer,
  RotateCcw,
  RotateCw,
  Rocket,
  Save,
  Sparkles,
  Sun,
  Upload,
  Wand2,
} from "lucide-react";

import { toast } from "sonner";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessState, type Phase } from "@/components/shared/ProcessState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  PHOTO_SIZES,
  PAPER_SIZES,
  cmToPx,
  loadImage,
  fileToDataUrl,
  renderPhoto,
  canvasToBlob,
  downloadBlob,
  buildPrintSheet,
  DEFAULT_ADJUSTMENTS,
  type Adjustments,
} from "@/lib/image";
import { saveResult } from "@/lib/history";
import { removeBackground } from "@/lib/remove-bg.functions";

const TITLE = "Pas Foto — ROY DIGITAL SOLUTION";
const DESCRIPTION =
  "Editor pas foto sederhana: pilih ukuran 2x3, 3x4, 4x6 atau visa, ganti background, hapus latar dengan AI, dan unduh hasilnya.";

export const Route = createFileRoute("/_authenticated/pas-foto")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PasFotoPage,
});

const BACKGROUNDS = [
  { id: "original", label: "Original", value: null },
  { id: "transparent", label: "Transparan", value: null },
  { id: "red", label: "Merah", value: "#d32f2f" },
  { id: "blue", label: "Biru", value: "#1565c0" },
  { id: "white", label: "Putih", value: "#ffffff" },
];

const TEMPLATES = [
  { id: "none", label: "Kosong", bgId: "original", swatch: null },
  { id: "red", label: "Merah", bgId: "red", swatch: "#d32f2f" },
  { id: "blue", label: "Biru", bgId: "blue", swatch: "#1565c0" },
  { id: "white", label: "Putih", bgId: "white", swatch: "#ffffff" },
  { id: "gray", label: "Abu Formal", bgId: "custom", swatch: "#9aa4b2" },
  { id: "softblue", label: "Biru Muda", bgId: "custom", swatch: "#7fb3e8" },
];

const CHECKER =
  "bg-[repeating-conic-gradient(var(--color-muted)_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]";

function PasFotoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [sizeId, setSizeId] = useState("3x4");
  const [customW, setCustomW] = useState(3);
  const [customH, setCustomH] = useState(4);
  const [dpi, setDpi] = useState(300);
  const [adj, setAdj] = useState<Adjustments>(DEFAULT_ADJUSTMENTS);
  const [bgId, setBgId] = useState("white");
  const [customBg, setCustomBg] = useState("#0ea5e9");
  const [quality, setQuality] = useState(92);
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusMsg, setStatusMsg] = useState<string>();
  const [removingBg, setRemovingBg] = useState(false);
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);

  // A4 sheet options
  const [paperId, setPaperId] = useState("a4");
  const [margin, setMargin] = useState(0.5);
  const [spacing, setSpacing] = useState(0.2);
  const [count, setCount] = useState(8);
  const sheetPreviewRef = useRef<HTMLDivElement>(null);
  const [sheetInfo, setSheetInfo] = useState<{ cols: number; rows: number; placed: number }>();

  const size = useMemo(() => {
    if (sizeId === "custom") {
      return { id: "custom", label: "Custom", wCm: customW, hCm: customH };
    }
    return PHOTO_SIZES.find((s) => s.id === sizeId) ?? PHOTO_SIZES[1]!;
  }, [sizeId, customW, customH]);

  const targetW = Math.max(1, cmToPx(size.wCm, dpi));
  const targetH = Math.max(1, cmToPx(size.hCm, dpi));

  const background = useMemo(() => {
    if (bgId === "custom") return customBg;
    return BACKGROUNDS.find((b) => b.id === bgId)?.value ?? null;
  }, [bgId, customBg]);

  useEffect(() => {
    if (!file) {
      setImg(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const dataUrl = await fileToDataUrl(file);
        const loaded = await loadImage(dataUrl);
        if (!cancelled) {
          setImg(loaded);
          setAdj(DEFAULT_ADJUSTMENTS);
        }
      } catch {
        toast.error("Gambar tidak dapat dibaca. Silakan coba file lain.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const buildPhotoCanvas = useCallback(() => {
    if (!img) return null;
    return renderPhoto(img, targetW, targetH, adj, background);
  }, [img, targetW, targetH, adj, background]);

  // Live preview (scaled down for the screen).
  useEffect(() => {
    const host = previewRef.current;
    if (!host) return;
    host.replaceChildren();
    const canvas = buildPhotoCanvas();
    if (!canvas) return;
    canvas.style.maxHeight = "460px";
    canvas.style.width = "auto";
    canvas.style.maxWidth = "100%";
    canvas.className = "rounded-xl border shadow-sm";
    host.appendChild(canvas);
  }, [buildPhotoCanvas]);

  function renderSheet() {
    const photo = buildPhotoCanvas();
    const host = sheetPreviewRef.current;
    if (!photo || !host) return null;
    const paper = PAPER_SIZES.find((p) => p.id === paperId) ?? PAPER_SIZES[0]!;
    const result = buildPrintSheet({
      photo,
      paperWCm: paper.wCm,
      paperHCm: paper.hCm,
      photoWCm: size.wCm,
      photoHCm: size.hCm,
      marginCm: margin,
      spacingCm: spacing,
      dpi,
      count,
    });
    host.replaceChildren();
    result.canvas.style.maxHeight = "460px";
    result.canvas.style.width = "auto";
    result.canvas.style.maxWidth = "100%";
    result.canvas.className = "rounded-xl border shadow-sm bg-white";
    host.appendChild(result.canvas);
    setSheetInfo({ cols: result.cols, rows: result.rows, placed: result.placed });
    return result.canvas;
  }

  async function exportPhoto(type: "image/jpeg" | "image/png", store: boolean) {
    const canvas = buildPhotoCanvas();
    if (!canvas) {
      toast.error("Unggah foto terlebih dahulu.");
      return;
    }
    setPhase("working");
    setStatusMsg("Menyiapkan file...");
    try {
      const blob = await canvasToBlob(canvas, type, quality / 100);
      const ext = type === "image/png" ? "png" : "jpg";
      const name = `pas-foto-${size.label.replace(/\s+/g, "")}-${dpi}dpi.${ext}`;
      downloadBlob(blob, name);
      if (store) {
        setStatusMsg("Menyimpan ke Riwayat...");
        await saveResult({
          category: "pas-foto",
          tool: `Pas Foto ${size.label}`,
          fileName: name,
          blob,
          settings: { size, dpi, adj, background: bgId },
        });
      }
      setPhase("done");
      setStatusMsg(store ? "File diunduh dan disimpan di Riwayat." : "File berhasil diunduh.");
    } catch {
      setPhase("error");
      setStatusMsg("Proses gagal. Silakan coba lagi.");
    }
  }

  async function exportSheet(kind: "image/jpeg" | "image/png" | "pdf") {
    const canvas = renderSheet();
    if (!canvas) {
      toast.error("Unggah foto terlebih dahulu.");
      return;
    }
    setPhase("working");
    setStatusMsg("Membuat lembar cetak...");
    try {
      if (kind === "pdf") {
        const { default: JsPDF } = await import("jspdf");
        const paper = PAPER_SIZES.find((p) => p.id === paperId) ?? PAPER_SIZES[0]!;
        const pdf = new JsPDF({
          unit: "mm",
          format: [paper.wCm * 10, paper.hCm * 10],
          orientation: paper.wCm > paper.hCm ? "landscape" : "portrait",
        });
        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.95),
          "JPEG",
          0,
          0,
          paper.wCm * 10,
          paper.hCm * 10,
        );
        const blob = pdf.output("blob");
        downloadBlob(blob, "lembar-pas-foto.pdf");
        await saveResult({
          category: "pas-foto",
          tool: "Lembar Cetak Pas Foto",
          fileName: "lembar-pas-foto.pdf",
          blob,
        });
      } else {
        const blob = await canvasToBlob(canvas, kind, 0.95);
        const ext = kind === "image/png" ? "png" : "jpg";
        downloadBlob(blob, `lembar-pas-foto.${ext}`);
        await saveResult({
          category: "pas-foto",
          tool: "Lembar Cetak Pas Foto",
          fileName: `lembar-pas-foto.${ext}`,
          blob,
        });
      }
      setPhase("done");
      setStatusMsg("Lembar cetak berhasil dibuat dan disimpan di Riwayat.");
    } catch {
      setPhase("error");
      setStatusMsg("Proses gagal. Silakan coba lagi.");
    }
  }

  function aiUnavailable() {
    toast.info("Fitur AI ini belum aktif. Menunggu konfigurasi AI provider.");
  }

  const callRemoveBackground = useServerFn(removeBackground);

  async function handleRemoveBackground() {
    if (!file) {
      toast.error("Unggah foto terlebih dahulu.");
      return;
    }
    setRemovingBg(true);
    setPhase("working");
    setStatusMsg("AI sedang menghapus background...");
    try {
      const imageDataUrl = await fileToDataUrl(file);
      const { pngDataUrl } = await callRemoveBackground({ data: { imageDataUrl } });
      const blob = await (await fetch(pngDataUrl)).blob();
      const cutout = new File([blob], "pas-foto-tanpa-background.png", { type: "image/png" });
      setFile(cutout);
      setBgId("transparent");
      setPhase("done");
      setStatusMsg("Background berhasil dihapus");
      toast.success("Background berhasil dihapus");
    } catch {
      setPhase("error");
      setStatusMsg("AI Remove Background gagal. Silakan coba lagi.");
      toast.error("AI Remove Background gagal. Silakan coba lagi.");
    } finally {
      setRemovingBg(false);
    }
  }

  function applyTemplate(t: (typeof TEMPLATES)[number]) {
    if (t.bgId === "custom" && t.swatch) setCustomBg(t.swatch);
    setBgId(t.bgId);
  }

  function nudge(dx: number, dy: number) {
    setAdj((a) => ({ ...a, offsetX: a.offsetX + dx, offsetY: a.offsetY + dy }));
  }

  function setZoom(next: number) {
    setAdj((a) => ({ ...a, zoom: Math.min(3, Math.max(0.5, Math.round(next * 100) / 100)) }));
  }

  const visibleTemplates = showAllTemplates ? TEMPLATES : TEMPLATES.slice(0, 5);

  if (!file) {
    return (
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Pas Foto</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Unggah foto, pilih ukuran, atur background, lalu unduh. Sederhana.
          </p>
        </header>
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Unggah Foto</CardTitle>
            <CardDescription>Mendukung JPG, JPEG, PNG, dan WEBP.</CardDescription>
          </CardHeader>
          <CardContent>
            <FileDropzone
              accept="image/jpeg,image/jpg,image/png,image/webp"
              hint="JPG, JPEG, PNG, WEBP"
              onFiles={(files) => setFile(files[0] ?? null)}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">Pas Foto</h1>
            <p className="truncate text-xs text-muted-foreground">
              {size.label} · {targetW} × {targetH} px · {dpi} DPI
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setFile(null)} className="shrink-0">
            <Upload className="size-4" /> Ganti Foto
          </Button>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* Preview column */}
          <div className="space-y-4">
            <Card className="border shadow-sm">
              <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:justify-between">
                  <div className="flex min-w-0 items-center gap-1 rounded-lg border p-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Perkecil"
                      onClick={() => setZoom(adj.zoom - 0.1)}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-14 text-center text-sm font-medium tabular-nums">
                      {Math.round(adj.zoom * 100)}%
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Perbesar"
                      onClick={() => setZoom(adj.zoom + 0.1)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setAdj(DEFAULT_ADJUSTMENTS)}
                  >
                    <RotateCcw className="size-4" /> Reset
                  </Button>
                </div>

                <div
                  ref={previewRef}
                  className={`flex min-h-[320px] items-center justify-center rounded-xl p-4 ${CHECKER}`}
                />

                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => exportPhoto("image/jpeg", true)}>
                    <Download className="size-4" /> Unduh JPG
                  </Button>
                  <Button variant="outline" onClick={() => exportPhoto("image/png", true)}>
                    <Download className="size-4" /> Unduh PNG
                  </Button>
                </div>

                <ProcessState phase={phase} message={statusMsg} />
              </CardContent>
            </Card>

            {/* Template Cepat */}
            <Card className="border shadow-sm">
              <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <CardTitle className="truncate text-base">Template Cepat</CardTitle>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 shrink-0"
                  onClick={() => setShowAllTemplates((v) => !v)}
                >
                  {showAllTemplates ? "Sembunyikan" : "Lihat Semua"}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                  {visibleTemplates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className="group w-20 shrink-0 text-left"
                    >
                      <span
                        className={`flex h-24 w-20 items-center justify-center rounded-lg border transition group-hover:ring-2 group-hover:ring-ring/40 ${t.swatch ? "" : CHECKER}`}
                        style={t.swatch ? { backgroundColor: t.swatch } : undefined}
                      >
                        {t.swatch ? null : <ImageIcon className="size-5 text-muted-foreground" />}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {t.label}
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Settings column */}
          <div className="space-y-4">
            {/* Ukuran */}
            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Ukuran Pas Foto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Ukuran</Label>
                  <Select value={sizeId} onValueChange={setSizeId}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PHOTO_SIZES.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {sizeId === "custom" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Lebar (cm)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="1"
                        value={customW}
                        onChange={(e) => setCustomW(Number(e.target.value) || 1)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tinggi (cm)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="1"
                        value={customH}
                        onChange={(e) => setCustomH(Number(e.target.value) || 1)}
                      />
                    </div>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <LabelWithHint
                    label="DPI"
                    hint="Semakin tinggi DPI, semakin tajam hasil saat dicetak."
                  />
                  <Select value={String(dpi)} onValueChange={(v) => setDpi(Number(v))}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[150, 200, 300, 600].map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {d} DPI
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="size-3.5" /> Ukuran akhir: {targetW} × {targetH} px
                </p>
              </CardContent>
            </Card>

            {/* Background */}
            <Card className="border shadow-sm">
              <CardHeader>
                <LabelWithHint
                  label="Background"
                  hint="Pilihan warna background untuk hasil pas foto."
                  asTitle
                />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[...BACKGROUNDS, { id: "custom", label: "Custom", value: customBg }].map((b) => (
                    <Button
                      key={b.id}
                      variant={bgId === b.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setBgId(b.id)}
                    >
                      {b.id === "custom" ? <Palette className="size-3.5" /> : null}
                      {b.label}
                    </Button>
                  ))}
                </div>
                {bgId === "custom" ? (
                  <Input
                    type="color"
                    value={customBg}
                    onChange={(e) => setCustomBg(e.target.value)}
                    className="h-10 p-1"
                  />
                ) : null}
              </CardContent>
            </Card>

            {/* Posisi & Zoom */}
            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Posisi &amp; Zoom</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SliderRow
                  label="Zoom"
                  value={adj.zoom}
                  min={0.5}
                  max={3}
                  step={0.01}
                  suffix="×"
                  onChange={(zoom) => setAdj((a) => ({ ...a, zoom }))}
                />
                <div className="grid grid-cols-4 gap-2">
                  <Button variant="outline" size="icon" aria-label="Naik" onClick={() => nudge(0, -10)}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button variant="outline" size="icon" aria-label="Turun" onClick={() => nudge(0, 10)}>
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button variant="outline" size="icon" aria-label="Kiri" onClick={() => nudge(-10, 0)}>
                    <ArrowLeft className="size-4" />
                  </Button>
                  <Button variant="outline" size="icon" aria-label="Kanan" onClick={() => nudge(10, 0)}>
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* AI Tools */}
            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4 text-accent" /> AI Tools
                </CardTitle>
                <CardDescription>Bantuan otomatis untuk hasil lebih cepat.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <AiRow
                  icon={Wand2}
                  title="Hapus Background"
                  desc="AI menghapus background otomatis"
                  onClick={handleRemoveBackground}
                  loading={removingBg}
                  loadingLabel="AI sedang menghapus background..."
                  active
                />
                <AiRow
                  icon={Sparkles}
                  title="Enhance Foto"
                  desc="Perjelas dan tingkatkan kualitas foto"
                  onClick={aiUnavailable}
                />
                <AiRow
                  icon={Rocket}
                  title="Auto Pas Foto"
                  desc="Atur foto otomatis untuk pas foto"
                  onClick={aiUnavailable}
                />
              </CardContent>
            </Card>

            {/* Edit lanjutan */}
            <Card className="border shadow-sm">
              <CardContent className="pt-2">
                <Accordion type="single" collapsible>
                  <AccordionItem value="rotasi" className="border-b">
                    <AccordionTrigger className="text-sm">
                      <span className="flex items-center gap-2">
                        <RotateCw className="size-4 text-muted-foreground" /> Rotasi
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <SliderRow
                        label="Rotasi"
                        value={adj.rotate}
                        min={-180}
                        max={180}
                        step={1}
                        suffix="°"
                        onChange={(rotate) => setAdj((a) => ({ ...a, rotate }))}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={adj.flipH ? "default" : "outline"}
                          size="sm"
                          onClick={() => setAdj((a) => ({ ...a, flipH: !a.flipH }))}
                        >
                          Balik Horizontal
                        </Button>
                        <Button
                          variant={adj.flipV ? "default" : "outline"}
                          size="sm"
                          onClick={() => setAdj((a) => ({ ...a, flipV: !a.flipV }))}
                        >
                          Balik Vertikal
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="crop" className="border-b">
                    <AccordionTrigger className="text-sm">
                      <span className="flex items-center gap-2">
                        <Crop className="size-4 text-muted-foreground" /> Crop &amp; Posisi
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <SliderRow
                        label="Crop / Zoom"
                        value={adj.zoom}
                        min={0.5}
                        max={3}
                        step={0.01}
                        suffix="×"
                        onChange={(zoom) => setAdj((a) => ({ ...a, zoom }))}
                      />
                      <SliderRow
                        label="Posisi X"
                        value={adj.offsetX}
                        min={-500}
                        max={500}
                        step={1}
                        onChange={(offsetX) => setAdj((a) => ({ ...a, offsetX }))}
                      />
                      <SliderRow
                        label="Posisi Y"
                        value={adj.offsetY}
                        min={-500}
                        max={500}
                        step={1}
                        onChange={(offsetY) => setAdj((a) => ({ ...a, offsetY }))}
                      />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="cahaya" className="border-b">
                    <AccordionTrigger className="text-sm">
                      <span className="flex items-center gap-2">
                        <Sun className="size-4 text-muted-foreground" /> Pencahayaan &amp; Ketajaman
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <SliderRow
                        label="Pencahayaan"
                        value={adj.brightness}
                        min={20}
                        max={200}
                        step={1}
                        suffix="%"
                        onChange={(brightness) => setAdj((a) => ({ ...a, brightness }))}
                      />
                      <SliderRow
                        label="Kontras"
                        value={adj.contrast}
                        min={20}
                        max={200}
                        step={1}
                        suffix="%"
                        onChange={(contrast) => setAdj((a) => ({ ...a, contrast }))}
                      />
                      <SliderRow
                        label="Saturasi"
                        value={adj.saturation}
                        min={0}
                        max={200}
                        step={1}
                        suffix="%"
                        onChange={(saturation) => setAdj((a) => ({ ...a, saturation }))}
                      />
                      <SliderRow
                        label="Ketajaman"
                        value={adj.sharpen}
                        min={0}
                        max={100}
                        step={1}
                        suffix="%"
                        onChange={(sharpen) => setAdj((a) => ({ ...a, sharpen }))}
                      />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="warna" className="border-b">
                    <AccordionTrigger className="text-sm">
                      <span className="flex items-center gap-2">
                        <Palette className="size-4 text-muted-foreground" /> Warna
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <SliderRow
                        label="Merah"
                        value={adj.red}
                        min={50}
                        max={150}
                        step={1}
                        suffix="%"
                        onChange={(red) => setAdj((a) => ({ ...a, red }))}
                      />
                      <SliderRow
                        label="Hijau"
                        value={adj.green}
                        min={50}
                        max={150}
                        step={1}
                        suffix="%"
                        onChange={(green) => setAdj((a) => ({ ...a, green }))}
                      />
                      <SliderRow
                        label="Biru"
                        value={adj.blue}
                        min={50}
                        max={150}
                        step={1}
                        suffix="%"
                        onChange={(blue) => setAdj((a) => ({ ...a, blue }))}
                      />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="ekspor">
                    <AccordionTrigger className="text-sm">
                      <span className="flex items-center gap-2">
                        <Printer className="size-4 text-muted-foreground" /> Cetak Banyak &amp;
                        Kualitas
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Tabs defaultValue="sheet">
                        <TabsList className="mb-3">
                          <TabsTrigger value="sheet">Lembar Cetak</TabsTrigger>
                          <TabsTrigger value="quality">Kualitas</TabsTrigger>
                        </TabsList>
                        <TabsContent value="sheet" className="space-y-4">
                          <div className="space-y-2">
                            <Label>Ukuran Kertas</Label>
                            <Select value={paperId} onValueChange={setPaperId}>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PAPER_SIZES.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <SliderRow
                            label="Margin (cm)"
                            value={margin}
                            min={0}
                            max={3}
                            step={0.1}
                            onChange={setMargin}
                          />
                          <SliderRow
                            label="Jarak Antar Foto (cm)"
                            value={spacing}
                            min={0}
                            max={2}
                            step={0.1}
                            onChange={setSpacing}
                          />
                          <SliderRow
                            label="Jumlah Foto"
                            value={count}
                            min={1}
                            max={60}
                            step={1}
                            onChange={setCount}
                          />
                          <div
                            ref={sheetPreviewRef}
                            className="flex min-h-[120px] items-center justify-center rounded-xl bg-muted/40 p-3"
                          />
                          {sheetInfo ? (
                            <p className="text-xs text-muted-foreground">
                              {sheetInfo.cols} × {sheetInfo.rows} grid — {sheetInfo.placed} foto.
                            </p>
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={renderSheet}>
                              <Printer className="size-4" /> Preview
                            </Button>
                            <Button size="sm" onClick={() => exportSheet("image/jpeg")}>
                              <Download className="size-4" /> JPG
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => exportSheet("image/png")}
                            >
                              <Download className="size-4" /> PNG
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => exportSheet("pdf")}>
                              <Save className="size-4" /> PDF
                            </Button>
                          </div>
                        </TabsContent>
                        <TabsContent value="quality">
                          <SliderRow
                            label="Kualitas JPG"
                            value={quality}
                            min={40}
                            max={100}
                            step={1}
                            suffix="%"
                            onChange={(v) => setQuality(v)}
                          />
                        </TabsContent>
                      </Tabs>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function LabelWithHint({
  label,
  hint,
  asTitle = false,
}: {
  label: string;
  hint: string;
  asTitle?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {asTitle ? (
        <CardTitle className="text-base">{label}</CardTitle>
      ) : (
        <Label>{label}</Label>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label={`Info ${label}`} className="text-muted-foreground">
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-56">{hint}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {Math.round(value * 100) / 100}
          {suffix ?? ""}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v ?? value)}
      />
    </div>
  );
}

function AiRow({
  icon: Icon,
  title,
  desc,
  onClick,
  loading = false,
  loadingLabel,
  active = false,
}: {
  icon: typeof Wand2;
  title: string;
  desc: string;
  onClick: () => void;
  loading?: boolean;
  loadingLabel?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border p-3 text-left transition hover:bg-accent/10 disabled:opacity-70"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent-foreground">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{title}</span>
          {active ? (
            <Badge variant="secondary" className="text-[10px]">
              Aktif
            </Badge>
          ) : null}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {loading ? (loadingLabel ?? "Memproses...") : desc}
        </span>
      </span>
    </button>
  );
}
