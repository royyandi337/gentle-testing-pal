import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Crop,
  Download,
  Image as ImageIcon,
  Info,
  Minus,
  Palette,
  Plus,
  Printer,
  RotateCcw,
  RotateCw,
  Save,
  SkipForward,
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

const TITLE = "Pas Foto — ROY DIGITAL SOLUTION";
const DESCRIPTION =
  "Alur kerja pas foto langkah demi langkah: unggah, enhance AI, hapus background AI, atur ukuran & crop, susun lembar cetak, lalu unduh.";

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

const STEPS = [
  { id: 1, label: "Upload" },
  { id: 2, label: "Remove BG" },
  { id: 3, label: "Ukuran & Crop" },
  { id: 4, label: "Enhance" },
  { id: 5, label: "Cetak" },
  { id: 6, label: "Download" },
] as const;

type AiStatus = "pending" | "applied" | "skipped";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

async function callAiEndpoint(
  path: string,
  file: File,
  extra?: Record<string, string>,
): Promise<string> {
  const form = new FormData();
  form.append("image", file);
  for (const [key, value] of Object.entries(extra ?? {})) form.append(key, value);
  const res = await fetch(path, { method: "POST", body: form });
  const json = (await res.json().catch(() => ({}))) as { image?: string; error?: string };
  if (!res.ok || !json.image) {
    throw new Error(json.error ?? "Proses AI gagal. Silakan coba lagi.");
  }
  return json.image;
}

async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: blob.type || "image/png" });
}

function PasFotoPage() {
  const [step, setStep] = useState(1);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  const [removeBgStatus, setRemoveBgStatus] = useState<AiStatus>("pending");
  const [enhanceStatus, setEnhanceStatus] = useState<AiStatus>("pending");
  const [aiBusy, setAiBusy] = useState(false);

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
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);

  // Print sheet options
  const [paperId, setPaperId] = useState("4r");
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
        if (!cancelled) setImg(loaded);
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
  }, [buildPhotoCanvas, step]);

  const renderSheet = useCallback(() => {
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
  }, [buildPhotoCanvas, paperId, size.wCm, size.hCm, margin, spacing, dpi, count]);

  useEffect(() => {
    if (step === 5) renderSheet();
  }, [step, renderSheet]);

  function handleUpload(picked: File | null) {
    if (!picked) return;
    if (!ALLOWED_TYPES.includes(picked.type)) {
      toast.error("Format tidak didukung. Gunakan JPG, PNG, atau WEBP.");
      return;
    }
    if (picked.size > MAX_UPLOAD_BYTES) {
      toast.error("Ukuran file melebihi 10MB.");
      return;
    }
    setOriginalFile(picked);
    setFile(picked);
    setAdj(DEFAULT_ADJUSTMENTS);
    setRemoveBgStatus("pending");
    setEnhanceStatus("pending");
    setBgId("white");
    setPhase("idle");
    setStatusMsg(undefined);
    setStep(2);
  }

  function resetAll() {
    setOriginalFile(null);
    setFile(null);
    setImg(null);
    setRemoveBgStatus("pending");
    setEnhanceStatus("pending");
    setPhase("idle");
    setStatusMsg(undefined);
    setStep(1);
  }

  async function runRemoveBackground() {
    if (!file) return;
    setAiBusy(true);
    setPhase("working");
    setStatusMsg("AI sedang menghapus background... (bisa 10–30 detik)");
    try {
      const image = await callAiEndpoint("/api/remove-background", file);
      const cutout = await dataUrlToFile(image, "pas-foto-tanpa-background.png");
      setFile(cutout);
      setBgId("white");
      setRemoveBgStatus("applied");
      setPhase("done");
      setStatusMsg("Background berhasil dihapus.");
      toast.success("Background berhasil dihapus");
      setStep(3);
    } catch (error) {
      setPhase("error");
      const msg = error instanceof Error ? error.message : "AI Remove Background gagal.";
      setStatusMsg(msg);
      toast.error(msg);
    } finally {
      setAiBusy(false);
    }
  }

  async function runEnhance() {
    if (!file) return;
    setAiBusy(true);
    setPhase("working");
    setStatusMsg("AI sedang meningkatkan kualitas foto... (bisa 10–30 detik)");
    try {
      const image = await callAiEndpoint("/api/enhance-image", file, {
        transparent: removeBgStatus === "applied" ? "true" : "false",
      });
      const enhanced = await dataUrlToFile(image, "pas-foto-enhanced.png");
      setFile(enhanced);
      setEnhanceStatus("applied");
      setPhase("done");
      setStatusMsg("Foto berhasil ditingkatkan.");
      toast.success("Foto berhasil ditingkatkan");
      setStep(5);
    } catch (error) {
      setPhase("error");
      const msg = error instanceof Error ? error.message : "AI Enhance gagal.";
      setStatusMsg(msg);
      toast.error(msg);
    } finally {
      setAiBusy(false);
    }
  }

  async function exportPhoto(type: "image/jpeg" | "image/png") {
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
      setStatusMsg("Menyimpan ke Riwayat...");
      await saveResult({
        category: "pas-foto",
        tool: `Pas Foto ${size.label}`,
        fileName: name,
        blob,
        settings: { size, dpi, adj, background: bgId, removeBgStatus, enhanceStatus },
      });
      setPhase("done");
      setStatusMsg("File diunduh dan disimpan di Riwayat.");
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

  function goTo(next: number) {
    if (next < 1 || next > 6) return;
    if (next > 1 && !file) return;
    setPhase("idle");
    setStatusMsg(undefined);
    setStep(next);
  }

  const visibleTemplates = showAllTemplates ? TEMPLATES : TEMPLATES.slice(0, 5);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">Pas Foto</h1>
            <p className="truncate text-xs text-muted-foreground">
              {file
                ? `${size.label} · ${targetW} × ${targetH} px · ${dpi} DPI`
                : "Alur kerja 6 langkah: unggah, AI, atur, cetak, unduh."}
            </p>
          </div>
          {file ? (
            <Button variant="outline" size="sm" onClick={resetAll} className="shrink-0">
              <Upload className="size-4" /> Ganti Foto
            </Button>
          ) : null}
        </header>

        <StepIndicator step={step} onSelect={goTo} enabled={Boolean(file)} />

        <div className="mt-5">
          {step === 1 ? (
            <Card className="mx-auto max-w-3xl border shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">1. Unggah Foto</CardTitle>
                <CardDescription>
                  Mendukung JPG, JPEG, PNG, dan WEBP. Maksimal 10MB.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileDropzone
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  hint="JPG, JPEG, PNG, WEBP — maks 10MB"
                  onFiles={(files) => handleUpload(files[0] ?? null)}
                />
              </CardContent>
            </Card>
          ) : null}

          {step === 4 ? (
            <AiStepCard
              stepLabel="4. Enhance Foto (AI)"
              description="Dijalankan setelah background diganti warna solid agar AI tidak mengarang background baru. Proses AI bisa memakan 10–30 detik."
              icon={Sparkles}
              actionLabel="Enhance Foto dengan AI"
              busy={aiBusy}
              status={enhanceStatus}
              onRun={runEnhance}
              onSkip={() => {
                setEnhanceStatus("skipped");
                goTo(5);
              }}
              onBack={() => goTo(3)}
              phase={phase}
              statusMsg={statusMsg}
              file={file}
            />
          ) : null}

          {step === 2 ? (
            <AiStepCard
              stepLabel="2. Hapus Background (AI)"
              description="Langkah pertama yang disarankan: hapus background asli agar bisa diganti warna resmi. Proses AI bisa memakan 10–30 detik."
              icon={Wand2}
              actionLabel="Hapus Background dengan AI"
              busy={aiBusy}
              status={removeBgStatus}
              onRun={runRemoveBackground}
              onSkip={() => {
                setRemoveBgStatus("skipped");
                goTo(3);
              }}
              onBack={() => goTo(1)}
              phase={phase}
              statusMsg={statusMsg}
              file={file}
            />
          ) : null}

          {step === 4 ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
              {/* Preview column */}
              <div className="space-y-4">
                <Card className="border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">4. Ukuran, Posisi &amp; Background</CardTitle>
                    <CardDescription>
                      Atur hasil akhir pas foto sebelum menyusun lembar cetak.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
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

                    <StepNav
                      onBack={() => goTo(3)}
                      onNext={() => goTo(5)}
                      nextLabel="Lanjut ke Cetak"
                    />
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
                      className="h-auto shrink-0 p-0"
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
                            {t.swatch ? null : (
                              <ImageIcon className="size-5 text-muted-foreground" />
                            )}
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
                      {[...BACKGROUNDS, { id: "custom", label: "Custom", value: customBg }].map(
                        (b) => (
                          <Button
                            key={b.id}
                            variant={bgId === b.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => setBgId(b.id)}
                          >
                            {b.id === "custom" ? <Palette className="size-3.5" /> : null}
                            {b.label}
                          </Button>
                        ),
                      )}
                    </div>
                    {bgId === "custom" ? (
                      <Input
                        type="color"
                        value={customBg}
                        onChange={(e) => setCustomBg(e.target.value)}
                        className="h-10 p-1"
                      />
                    ) : null}
                    {removeBgStatus !== "applied" ? (
                      <p className="text-xs text-muted-foreground">
                        Warna background bekerja paling baik jika langkah Remove BG dijalankan.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>

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
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Naik"
                        onClick={() => nudge(0, -10)}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Turun"
                        onClick={() => nudge(0, 10)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Kiri"
                        onClick={() => nudge(-10, 0)}
                      >
                        <ArrowLeft className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Kanan"
                        onClick={() => nudge(10, 0)}
                      >
                        <ArrowRight className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

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
                            <Sun className="size-4 text-muted-foreground" /> Pencahayaan &amp;
                            Ketajaman
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

                      <AccordionItem value="warna">
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
                    </Accordion>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">5. Lembar Cetak</CardTitle>
                  <CardDescription>
                    Preview susunan {size.label} pada kertas yang dipilih.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    ref={sheetPreviewRef}
                    className="flex min-h-[320px] items-center justify-center rounded-xl bg-muted/40 p-3"
                  />
                  {sheetInfo ? (
                    <p className="text-xs text-muted-foreground">
                      Grid {sheetInfo.cols} × {sheetInfo.rows} — {sheetInfo.placed} pcs foto
                      tersusun.
                    </p>
                  ) : null}
                  <StepNav
                    onBack={() => goTo(4)}
                    onNext={() => goTo(6)}
                    nextLabel="Lanjut ke Download"
                  />
                </CardContent>
              </Card>

              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Printer className="size-4 text-muted-foreground" /> Pengaturan Cetak
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                    label="Jumlah Foto (pcs)"
                    value={count}
                    min={1}
                    max={60}
                    step={1}
                    onChange={setCount}
                  />
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
                  <Button variant="outline" size="sm" onClick={renderSheet} className="w-full">
                    <Printer className="size-4" /> Perbarui Preview
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {step === 6 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Pas Foto Tunggal</CardTitle>
                  <CardDescription>
                    {size.label} · {targetW} × {targetH} px · {dpi} DPI
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    ref={previewRef}
                    className={`flex min-h-[260px] items-center justify-center rounded-xl p-4 ${CHECKER}`}
                  />
                  <SliderRow
                    label="Kualitas JPG"
                    value={quality}
                    min={40}
                    max={100}
                    step={1}
                    suffix="%"
                    onChange={setQuality}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => exportPhoto("image/jpeg")}>
                      <Download className="size-4" /> Unduh JPG
                    </Button>
                    <Button variant="outline" onClick={() => exportPhoto("image/png")}>
                      <Download className="size-4" /> Unduh PNG
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Lembar Cetak</CardTitle>
                  <CardDescription>
                    {PAPER_SIZES.find((p) => p.id === paperId)?.label} · {count} pcs
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    ref={sheetPreviewRef}
                    className="flex min-h-[260px] items-center justify-center rounded-xl bg-muted/40 p-3"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <Button onClick={() => exportSheet("pdf")}>
                      <Save className="size-4" /> PDF
                    </Button>
                    <Button variant="outline" onClick={() => exportSheet("image/jpeg")}>
                      <Download className="size-4" /> JPG
                    </Button>
                    <Button variant="outline" onClick={() => exportSheet("image/png")}>
                      <Download className="size-4" /> PNG
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => goTo(5)}>
                    <ArrowLeft className="size-4" /> Kembali ke Cetak
                  </Button>
                </CardContent>
              </Card>

              <div className="lg:col-span-2">
                <ProcessState phase={phase} message={statusMsg} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}

function StepIndicator({
  step,
  onSelect,
  enabled,
}: {
  step: number;
  onSelect: (n: number) => void;
  enabled: boolean;
}) {
  return (
    <ol className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
      {STEPS.map((s, i) => {
        const done = s.id < step;
        const current = s.id === step;
        return (
          <li key={s.id} className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={!enabled && s.id !== 1}
              onClick={() => onSelect(s.id)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                current
                  ? "border-primary bg-primary text-primary-foreground"
                  : done
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "bg-card text-muted-foreground hover:bg-accent/10"
              }`}
            >
              <span className="grid size-5 place-items-center rounded-full border border-current text-[10px]">
                {done ? <Check className="size-3" /> : s.id}
              </span>
              {s.label}
            </button>
            {i < STEPS.length - 1 ? (
              <span className="h-px w-4 shrink-0 bg-border" aria-hidden="true" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function StepNav({
  onBack,
  onNext,
  nextLabel,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button variant="outline" size="sm" onClick={onBack}>
        <ArrowLeft className="size-4" /> Kembali
      </Button>
      <Button size="sm" onClick={onNext}>
        {nextLabel} <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

function AiStepCard({
  stepLabel,
  description,
  icon: Icon,
  actionLabel,
  busy,
  status,
  onRun,
  onSkip,
  onBack,
  phase,
  statusMsg,
  file,
}: {
  stepLabel: string;
  description: string;
  icon: typeof Wand2;
  actionLabel: string;
  busy: boolean;
  status: AiStatus;
  onRun: () => void;
  onSkip: () => void;
  onBack: () => void;
  phase: Phase;
  statusMsg?: string | undefined;
  file: File | null;
}) {
  const [preview, setPreview] = useState<string>();

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    fileToDataUrl(file).then((url) => {
      if (!cancelled) setPreview(url);
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  return (
    <Card className="mx-auto max-w-3xl border shadow-sm">
      <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="size-4 text-accent" /> {stepLabel}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {status === "applied" ? (
          <Badge variant="secondary" className="shrink-0">
            Sudah diterapkan
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`flex min-h-[260px] items-center justify-center rounded-xl p-4 ${CHECKER}`}>
          {preview ? (
            <img
              src={preview}
              alt="Preview foto yang sedang diproses"
              className="max-h-[360px] max-w-full rounded-xl border shadow-sm"
            />
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={onRun} disabled={busy}>
            <Icon className="size-4" /> {busy ? "Memproses..." : actionLabel}
          </Button>
          <Button variant="outline" onClick={onSkip} disabled={busy}>
            <SkipForward className="size-4" /> Lewati langkah ini
          </Button>
        </div>

        <ProcessState phase={phase} message={statusMsg} />

        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} disabled={busy}>
            <ArrowLeft className="size-4" /> Kembali
          </Button>
          {status === "applied" ? (
            <Button variant="secondary" size="sm" onClick={onSkip} disabled={busy}>
              Lanjut <ArrowRight className="size-4" />
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
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
      {asTitle ? <CardTitle className="text-base">{label}</CardTitle> : <Label>{label}</Label>}
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
        <span className="text-xs tabular-nums text-muted-foreground">
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
