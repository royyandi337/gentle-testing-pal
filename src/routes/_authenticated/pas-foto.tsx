import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, RotateCcw, Save, Sparkles, Wand2, Rocket, Printer } from "lucide-react";

import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { ProcessState, type Phase } from "@/components/shared/ProcessState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  "Editor pas foto lengkap: preset 2x3, 3x4, 4x6, visa, custom, penyesuaian warna, background, dan lembar cetak A4.";

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
    canvas.style.maxHeight = "420px";
    canvas.style.width = "auto";
    canvas.style.maxWidth = "100%";
    canvas.className = "rounded-lg border shadow-sm";
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
    result.canvas.className = "rounded-lg border shadow-sm bg-white";
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
    toast.info("Fitur AI belum aktif. Menunggu konfigurasi AI provider di Edge Function.");
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


  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Pas Foto"
        description="Satu workspace lengkap: unggah, atur, sunting, ganti background, dan cetak."
      />

      {!file ? (
        <Card>
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
      ) : (
        <Tabs defaultValue="editor">
          <TabsList className="mb-4">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="ai">Fitur AI</TabsTrigger>
            <TabsTrigger value="print">Cetak Banyak</TabsTrigger>
          </TabsList>

          <TabsContent value="editor">
            <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Preview</CardTitle>
                    <CardDescription>
                      {size.label} — {targetW} × {targetH} px @ {dpi} DPI
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setFile(null)}>
                    Ganti Foto
                  </Button>
                </CardHeader>
                <CardContent>
                  <div
                    ref={previewRef}
                    className="flex min-h-[320px] items-center justify-center rounded-lg bg-[repeating-conic-gradient(var(--color-muted)_0%_25%,transparent_0%_50%)] bg-[length:20px_20px] p-4"
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={() => exportPhoto("image/jpeg", true)}>
                      <Download className="size-4" /> Unduh JPG
                    </Button>
                    <Button variant="outline" onClick={() => exportPhoto("image/png", true)}>
                      <Download className="size-4" /> Unduh PNG
                    </Button>
                    <Button variant="ghost" onClick={() => setAdj(DEFAULT_ADJUSTMENTS)}>
                      <RotateCcw className="size-4" /> Reset
                    </Button>
                  </div>
                  <div className="mt-4">
                    <ProcessState phase={phase} message={statusMsg} />
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Ukuran &amp; Resolusi</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label>Ukuran Pas Foto</Label>
                      <Select value={sizeId} onValueChange={setSizeId}>
                        <SelectTrigger>
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
                      <Label>DPI</Label>
                      <Select value={String(dpi)} onValueChange={(v) => setDpi(Number(v))}>
                        <SelectTrigger>
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
                    <div className="space-y-2">
                      <Label>Kualitas JPG ({quality}%)</Label>
                      <Slider
                        value={[quality]}
                        min={40}
                        max={100}
                        step={1}
                        onValueChange={([v]) => setQuality(v ?? 92)}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Background</CardTitle>
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
                    <p className="text-xs text-muted-foreground">
                      Background solid akan terlihat penuh setelah latar asli dihapus dengan AI
                      Remove Background.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Photo Editor</CardTitle>
                    <CardDescription>Crop, posisi, rotasi, dan koreksi warna.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <SliderRow
                      label="Zoom / Crop"
                      value={adj.zoom}
                      min={0.5}
                      max={3}
                      step={0.01}
                      suffix="×"
                      onChange={(zoom) => setAdj((a) => ({ ...a, zoom }))}
                    />
                    <SliderRow
                      label="Position X"
                      value={adj.offsetX}
                      min={-500}
                      max={500}
                      step={1}
                      onChange={(offsetX) => setAdj((a) => ({ ...a, offsetX }))}
                    />
                    <SliderRow
                      label="Position Y"
                      value={adj.offsetY}
                      min={-500}
                      max={500}
                      step={1}
                      onChange={(offsetY) => setAdj((a) => ({ ...a, offsetY }))}
                    />
                    <SliderRow
                      label="Rotate"
                      value={adj.rotate}
                      min={-180}
                      max={180}
                      step={1}
                      suffix="°"
                      onChange={(rotate) => setAdj((a) => ({ ...a, rotate }))}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant={adj.flipH ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAdj((a) => ({ ...a, flipH: !a.flipH }))}
                      >
                        Flip Horizontal
                      </Button>
                      <Button
                        variant={adj.flipV ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAdj((a) => ({ ...a, flipV: !a.flipV }))}
                      >
                        Flip Vertical
                      </Button>
                    </div>
                    <SliderRow
                      label="Brightness"
                      value={adj.brightness}
                      min={20}
                      max={200}
                      step={1}
                      suffix="%"
                      onChange={(brightness) => setAdj((a) => ({ ...a, brightness }))}
                    />
                    <SliderRow
                      label="Contrast"
                      value={adj.contrast}
                      min={20}
                      max={200}
                      step={1}
                      suffix="%"
                      onChange={(contrast) => setAdj((a) => ({ ...a, contrast }))}
                    />
                    <SliderRow
                      label="Saturation"
                      value={adj.saturation}
                      min={0}
                      max={200}
                      step={1}
                      suffix="%"
                      onChange={(saturation) => setAdj((a) => ({ ...a, saturation }))}
                    />
                    <SliderRow
                      label="Sharpen"
                      value={adj.sharpen}
                      min={0}
                      max={100}
                      step={1}
                      suffix="%"
                      onChange={(sharpen) => setAdj((a) => ({ ...a, sharpen }))}
                    />
                    <SliderRow
                      label="Red"
                      value={adj.red}
                      min={50}
                      max={150}
                      step={1}
                      suffix="%"
                      onChange={(red) => setAdj((a) => ({ ...a, red }))}
                    />
                    <SliderRow
                      label="Green"
                      value={adj.green}
                      min={50}
                      max={150}
                      step={1}
                      suffix="%"
                      onChange={(green) => setAdj((a) => ({ ...a, green }))}
                    />
                    <SliderRow
                      label="Blue"
                      value={adj.blue}
                      min={50}
                      max={150}
                      step={1}
                      suffix="%"
                      onChange={(blue) => setAdj((a) => ({ ...a, blue }))}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ai">
            <div className="grid gap-4 md:grid-cols-3">
              <AiCard
                icon={Wand2}
                title="✨ AI Remove Background"
                desc="Deteksi subjek otomatis, hapus latar, hasilkan PNG transparan, lalu pilih background."
                onClick={aiUnavailable}
              />
              <AiCard
                icon={Sparkles}
                title="✨ AI Enhance"
                desc="Sharpen, noise reduction, upscale, koreksi cahaya & warna dengan tampilan before/after."
                onClick={aiUnavailable}
              />
              <AiCard
                icon={Rocket}
                title="🚀 AI Auto Photo"
                desc="Alur otomatis: deteksi orang, hapus latar, enhance, auto crop & posisi, pilih ukuran, ekspor."
                onClick={aiUnavailable}
              />
            </div>
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">Status Integrasi AI</CardTitle>
                <CardDescription>
                  Arsitektur sudah siap: Frontend → Supabase Edge Function → AI Provider → Storage →
                  Database. Fitur aktif setelah API key AI provider dikonfigurasi sebagai secret.
                </CardDescription>
              </CardHeader>
            </Card>
          </TabsContent>

          <TabsContent value="print">
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cetak Banyak Pas Foto</CardTitle>
                  <CardDescription>
                    {sheetInfo
                      ? `${sheetInfo.cols} × ${sheetInfo.rows} grid — ${sheetInfo.placed} foto ditempatkan.`
                      : "Klik Buat Preview untuk melihat lembar cetak."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    ref={sheetPreviewRef}
                    className="flex min-h-[320px] items-center justify-center rounded-lg bg-muted/40 p-4"
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={renderSheet} variant="outline">
                      <Printer className="size-4" /> Buat Preview
                    </Button>
                    <Button onClick={() => exportSheet("image/jpeg")}>
                      <Download className="size-4" /> JPG
                    </Button>
                    <Button onClick={() => exportSheet("image/png")} variant="outline">
                      <Download className="size-4" /> PNG
                    </Button>
                    <Button onClick={() => exportSheet("pdf")} variant="outline">
                      <Save className="size-4" /> PDF
                    </Button>
                  </div>
                  <div className="mt-4">
                    <ProcessState phase={phase} message={statusMsg} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pengaturan Lembar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Ukuran Kertas</Label>
                    <Select value={paperId} onValueChange={setPaperId}>
                      <SelectTrigger>
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
                    label="Spacing (cm)"
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
                  <p className="text-xs text-muted-foreground">
                    Ukuran pas foto mengikuti pilihan di tab Editor: {size.label}.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
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
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs text-muted-foreground">
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

function AiCard({
  icon: Icon,
  title,
  desc,
  onClick,
}: {
  icon: typeof Wand2;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <Icon className="size-6 text-primary" />
        <CardTitle className="flex items-center gap-2 text-base">
          {title}
          <Badge variant="secondary" className="text-xs">
            Menunggu AI
          </Badge>
        </CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" className="w-full" onClick={onClick}>
          Jalankan
        </Button>
      </CardContent>
    </Card>
  );
}
