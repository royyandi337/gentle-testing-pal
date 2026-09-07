import { useCallback, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RotateCw, RotateCcw, X, Plus, Download, Trash2, ImagePlus } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { LabelPrintCard } from "@/components/shared/LabelPrintCard";
import { CollageCard } from "@/components/shared/CollageCard";
import { PolaroidCard } from "@/components/shared/PolaroidCard";
import { ProcessState, type Phase } from "@/components/shared/ProcessState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

type BatchItem = {
  id: string;
  file: File;
  url: string;
  done: boolean;
  resultLabel: string;
  blob?: Blob;
};

function formatSize(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function BatchToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-4 border-b border-dashed border-border pb-4">
      {children}
    </div>
  );
}

function BatchGrid({
  items,
  onRemove,
  onDownload,
}: {
  items: BatchItem[];
  onRemove: (id: string) => void;
  onDownload: (item: BatchItem) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="relative flex flex-col gap-2 rounded-xl border bg-card p-3"
        >
          <button
            className="absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-md border bg-background text-muted-foreground hover:text-foreground"
            onClick={() => onRemove(item.id)}
            aria-label="Hapus"
          >
            <X className="size-3" />
          </button>
          <p className="truncate pr-6 text-xs font-semibold text-foreground">
            {item.file.name}
          </p>
          <p className="-mt-1 text-[11px] text-muted-foreground">
            {formatSize(item.file.size)}
          </p>
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border bg-background">
            <img src={item.url} alt={item.file.name} className="h-full w-full object-cover" />
          </div>
          {item.done ? (
            <p className="text-center text-xs font-bold text-green-600">{item.resultLabel}</p>
          ) : (
            <p className="text-center text-xs font-medium text-muted-foreground">
              {item.resultLabel}
            </p>
          )}
          <button
            className="w-full rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground"
            disabled={!item.done}
            onClick={() => onDownload(item)}
          >
            Unduh
          </button>
        </div>
      ))}
    </div>
  );
}

function BatchBottomBar({
  onAdd,
  onClear,
  onProcess,
  processLabel,
  disabled,
}: {
  onAdd: () => void;
  onClear: () => void;
  onProcess: () => void;
  processLabel: string;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-dashed border-border pt-4">
      <Button variant="outline" size="sm" onClick={onAdd}>
        <Plus className="size-4" /> Pilih Gambar
      </Button>
      <Button variant="outline" size="icon" aria-label="Hapus semua" onClick={onClear}>
        <Trash2 className="size-4" />
      </Button>
      <Button className="flex-1" disabled={disabled} onClick={onProcess}>
        <Download className="size-4" /> {processLabel}
      </Button>
    </div>
  );
}

function useBatchTool() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: File[]) => {
    const valid = files.filter((f) => f.type.startsWith("image/"));
    if (!valid.length) return;
    const newItems: BatchItem[] = valid.map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      file: f,
      url: URL.createObjectURL(f),
      done: false,
      resultLabel: "Belum diproses",
    }));
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    setPhase("idle");
    setMessage(undefined);
  }, []);

  return {
    items,
    setItems,
    phase,
    setPhase,
    message,
    setMessage,
    fileInputRef,
    addFiles,
    removeItem,
    clearAll,
  };
}

function ResizePanel() {
  const tool = useBatchTool();
  const [mode, setMode] = useState<"percent" | "pixel">("percent");
  const [percent, setPercent] = useState(75);
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(0);

  async function processAll() {
    if (!tool.items.length) return;
    tool.setPhase("working");
    tool.setMessage(`Memproses ${tool.items.length} foto...`);
    try {
      let done = 0;
      const updated: BatchItem[] = [];
      for (const item of tool.items) {
        const img = await loadImage(item.url);
        let targetW = img.naturalWidth;
        let targetH = img.naturalHeight;
        if (mode === "percent") {
          targetW = Math.max(1, Math.round((img.naturalWidth * percent) / 100));
          targetH = Math.max(1, Math.round((img.naturalHeight * percent) / 100));
        } else {
          targetW = Math.max(1, width);
          targetH = height > 0 ? height : Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * targetW));
        }
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d")!;
        const type = item.file.type || "image/jpeg";
        if (type !== "image/png") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const blob = await canvasToBlob(canvas, type, 0.92);
        const fileName = `${item.file.name.replace(/\.[^.]+$/, "")}-resized.${type === "image/png" ? "png" : "jpg"}`;
        const label = mode === "percent" ? `Diskalakan ${percent}%` : `Diubah ke ${width}px`;
        updated.push({ ...item, done: true, resultLabel: label, blob });
        try {
          await saveResult({ category: "photo", tool: "resize", fileName, blob });
        } catch { /* Riwayat opsional */ }
        done += 1;
        tool.setMessage(`Memproses ${done}/${tool.items.length} foto...`);
      }
      tool.setItems(updated);
      tool.setPhase("done");
      tool.setMessage(`${tool.items.length} foto selesai di-resize.`);
    } catch (error) {
      tool.setPhase("error");
      tool.setMessage(error instanceof Error ? error.message : "Proses resize gagal.");
    }
  }

  function downloadItem(item: BatchItem) {
    if (item.blob) {
      const ext = item.file.type === "image/png" ? "png" : "jpg";
      downloadBlob(item.blob, `${item.file.name.replace(/\.[^.]+$/, "")}-resized.${ext}`);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <BatchToolbar>
          <div className="space-y-1.5">
            <Label>Mode</Label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={mode === "percent" ? "default" : "outline"}
                onClick={() => setMode("percent")}
              >
                Persen
              </Button>
              <Button
                size="sm"
                variant={mode === "pixel" ? "default" : "outline"}
                onClick={() => setMode("pixel")}
              >
                Pixel
              </Button>
            </div>
          </div>
          {mode === "percent" ? (
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Skala</Label>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold">{percent}%</span>
              </div>
              <Slider min={10} max={100} step={5} value={[percent]} onValueChange={([v]) => setPercent(v ?? 75)} />
            </div>
          ) : (
            <div className="flex flex-1 gap-3">
              <div className="flex-1 space-y-1.5">
                <Label>Lebar (px)</Label>
                <Input type="number" min={1} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label>Tinggi (0=auto)</Label>
                <Input type="number" min={0} value={height} onChange={(e) => setHeight(Number(e.target.value))} />
              </div>
            </div>
          )}
          <Button disabled={!tool.items.length || tool.phase === "working"} onClick={processAll}>
            Resize Semua
          </Button>
          {tool.items.length ? (
            <Button variant="outline" onClick={tool.clearAll}>Hapus Semua</Button>
          ) : null}
        </BatchToolbar>

        {!tool.items.length ? (
          <FileDropzone
            accept="image/jpeg,image/png,image/webp"
            multiple
            onFiles={tool.addFiles}
            hint="Tarik & lepas file di sini — bisa banyak foto sekaligus"
          />
        ) : (
          <>
            <BatchGrid items={tool.items} onRemove={tool.removeItem} onDownload={downloadItem} />
            <BatchBottomBar
              onAdd={() => tool.fileInputRef.current?.click()}
              onClear={tool.clearAll}
              onProcess={processAll}
              processLabel="Unduh Semua"
              disabled={tool.phase === "working"}
            />
          </>
        )}
        <input
          ref={tool.fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) tool.addFiles(Array.from(e.target.files)); e.target.value = ""; }}
        />
        <ProcessState phase={tool.phase} message={tool.message} />
      </CardContent>
    </Card>
  );
}

function CompressPanel() {
  const tool = useBatchTool();
  const [quality, setQuality] = useState(60);

  async function processAll() {
    if (!tool.items.length) return;
    tool.setPhase("working");
    tool.setMessage(`Memproses ${tool.items.length} foto...`);
    try {
      let done = 0;
      const updated: BatchItem[] = [];
      for (const item of tool.items) {
        const img = await loadImage(item.url);
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        const type = item.file.type || "image/jpeg";
        if (type !== "image/png") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0);
        const blob = await canvasToBlob(canvas, type, quality / 100);
        const fileName = `${item.file.name.replace(/\.[^.]+$/, "")}-compressed.${type === "image/png" ? "png" : "jpg"}`;
        const label = `Ukuran baru: ${formatSize(blob.size)}`;
        updated.push({ ...item, done: true, resultLabel: label, blob });
        try {
          await saveResult({ category: "photo", tool: "compress", fileName, blob });
        } catch { /* Riwayat opsional */ }
        done += 1;
        tool.setMessage(`Memproses ${done}/${tool.items.length} foto...`);
      }
      tool.setItems(updated);
      tool.setPhase("done");
      tool.setMessage(`${tool.items.length} foto selesai dikompres.`);
    } catch (error) {
      tool.setPhase("error");
      tool.setMessage(error instanceof Error ? error.message : "Proses kompres gagal.");
    }
  }

  function downloadItem(item: BatchItem) {
    if (item.blob) {
      const ext = item.file.type === "image/png" ? "png" : "jpg";
      downloadBlob(item.blob, `${item.file.name.replace(/\.[^.]+$/, "")}-compressed.${ext}`);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <BatchToolbar>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tingkat Kompresi</Label>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold">{quality}%</span>
            </div>
            <Slider min={10} max={100} step={5} value={[quality]} onValueChange={([v]) => setQuality(v ?? 60)} />
          </div>
          <Button disabled={!tool.items.length || tool.phase === "working"} onClick={processAll}>
            Kompres Semua
          </Button>
          {tool.items.length ? (
            <Button variant="outline" onClick={tool.clearAll}>Hapus Semua</Button>
          ) : null}
        </BatchToolbar>

        {!tool.items.length ? (
          <FileDropzone
            accept="image/jpeg,image/png,image/webp"
            multiple
            onFiles={tool.addFiles}
            hint="Tarik & lepas foto di sini — JPG, PNG, WEBP, bisa banyak sekaligus"
          />
        ) : (
          <>
            <BatchGrid items={tool.items} onRemove={tool.removeItem} onDownload={downloadItem} />
            <BatchBottomBar
              onAdd={() => tool.fileInputRef.current?.click()}
              onClear={tool.clearAll}
              onProcess={processAll}
              processLabel="Unduh Semua"
              disabled={tool.phase === "working"}
            />
          </>
        )}
        <input
          ref={tool.fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) tool.addFiles(Array.from(e.target.files)); e.target.value = ""; }}
        />
        <ProcessState phase={tool.phase} message={tool.message} />
      </CardContent>
    </Card>
  );
}

function ConvertPanel() {
  const tool = useBatchTool();
  const [format, setFormat] = useState<"jpg" | "png" | "webp">("jpg");

  async function processAll() {
    if (!tool.items.length) return;
    tool.setPhase("working");
    tool.setMessage(`Memproses ${tool.items.length} foto...`);
    try {
      let done = 0;
      const updated: BatchItem[] = [];
      for (const item of tool.items) {
        const img = await loadImage(item.url);
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        const type = MIME[format]!;
        if (type !== "image/png") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0);
        const blob = await canvasToBlob(canvas, type, 0.92);
        const fileName = `${item.file.name.replace(/\.[^.]+$/, "")}.${format}`;
        const label = `→ ${format.toUpperCase()}`;
        updated.push({ ...item, done: true, resultLabel: label, blob });
        try {
          await saveResult({ category: "photo", tool: "convert", fileName, blob });
        } catch { /* Riwayat opsional */ }
        done += 1;
        tool.setMessage(`Memproses ${done}/${tool.items.length} foto...`);
      }
      tool.setItems(updated);
      tool.setPhase("done");
      tool.setMessage(`${tool.items.length} foto selesai dikonversi.`);
    } catch (error) {
      tool.setPhase("error");
      tool.setMessage(error instanceof Error ? error.message : "Proses konversi gagal.");
    }
  }

  function downloadItem(item: BatchItem) {
    if (item.blob) {
      downloadBlob(item.blob, `${item.file.name.replace(/\.[^.]+$/, "")}.${format}`);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <BatchToolbar>
          <div className="space-y-1.5">
            <Label>Format tujuan</Label>
            <div className="flex gap-2">
              {(["jpg", "png", "webp"] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={format === f ? "default" : "outline"}
                  onClick={() => setFormat(f)}
                >
                  {f.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
          <Button disabled={!tool.items.length || tool.phase === "working"} onClick={processAll}>
            Konversi Semua
          </Button>
          {tool.items.length ? (
            <Button variant="outline" onClick={tool.clearAll}>Hapus Semua</Button>
          ) : null}
        </BatchToolbar>

        {!tool.items.length ? (
          <FileDropzone
            accept="image/jpeg,image/png,image/webp"
            multiple
            onFiles={tool.addFiles}
            hint="Tarik & lepas file di sini — bisa banyak foto sekaligus"
          />
        ) : (
          <>
            <BatchGrid items={tool.items} onRemove={tool.removeItem} onDownload={downloadItem} />
            <BatchBottomBar
              onAdd={() => tool.fileInputRef.current?.click()}
              onClear={tool.clearAll}
              onProcess={processAll}
              processLabel="Unduh Semua"
              disabled={tool.phase === "working"}
            />
          </>
        )}
        <input
          ref={tool.fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) tool.addFiles(Array.from(e.target.files)); e.target.value = ""; }}
        />
        <ProcessState phase={tool.phase} message={tool.message} />
      </CardContent>
    </Card>
  );
}

function RotatePanel() {
  const [items, setItems] = useState<{ id: string; file: File; url: string; angle: number }[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: File[]) {
    const newItems = files
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({ id: `${f.name}-${Date.now()}-${Math.random()}`, file: f, url: URL.createObjectURL(f), angle: 0 }));
    setItems((prev) => [...prev, ...newItems]);
  }
  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }
  function rotateItem(id: string, delta: number) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, angle: item.angle + delta } : item)));
  }
  function resetItem(id: string) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, angle: 0 } : item)));
  }
  function clearAll() {
    setItems([]);
    setPhase("idle");
    setMessage(undefined);
  }

  async function applyAll() {
    if (!items.length) return;
    setPhase("working");
    setMessage(`Memproses ${items.length} foto...`);
    try {
      let done = 0;
      for (const item of items) {
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
        const blob = await canvasToBlob(canvas, type, 0.92);
        const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
        const fileName = `${item.file.name.replace(/\.[^.]+$/, "")}-rotated.${ext}`;
        downloadBlob(blob, fileName);
        try {
          await saveResult({ category: "photo", tool: "rotate", fileName, blob });
        } catch { /* Riwayat opsional */ }
        done += 1;
        setMessage(`Memproses ${done}/${items.length} foto...`);
      }
      setPhase("done");
      setMessage(`${items.length} foto selesai diputar dan diunduh.`);
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Proses rotasi gagal.");
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <RotateCw className="size-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Putar Foto</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Unggah beberapa foto, lalu putar satu per satu — pratinjau langsung berubah setiap kali tombol ditekan.
            </p>
          </div>
        </div>

        {!items.length ? (
          <FileDropzone
            accept="image/jpeg,image/png,image/webp"
            multiple
            onFiles={addFiles}
            hint="Tarik & lepas file di sini — bisa banyak foto sekaligus"
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => (
                <div key={item.id} className="relative flex flex-col gap-2.5 rounded-xl border bg-card p-3">
                  <button
                    className="absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-md border bg-background text-muted-foreground hover:text-foreground"
                    onClick={() => removeItem(item.id)}
                    aria-label="Hapus foto"
                  >
                    <X className="size-3" />
                  </button>
                  <p className="truncate pr-6 text-xs font-semibold text-foreground">{item.file.name}</p>
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
                    <Button variant="outline" size="icon" className="flex-1" aria-label="Putar kiri" onClick={() => rotateItem(item.id, -90)}>
                      <RotateCcw className="size-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="flex-none px-2 text-xs" onClick={() => resetItem(item.id)}>
                      Reset
                    </Button>
                    <Button variant="outline" size="icon" className="flex-1" aria-label="Putar kanan" onClick={() => rotateItem(item.id, 90)}>
                      <RotateCw className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 border-t border-dashed border-border pt-4">
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="size-4" /> Pilih Gambar
              </Button>
              <Button variant="outline" size="icon" aria-label="Hapus semua" onClick={clearAll}>
                <Trash2 className="size-4" />
              </Button>
              <Button className="flex-1" disabled={phase === "working"} onClick={applyAll}>
                <Download className="size-4" /> Terapkan & Unduh Semua
              </Button>
            </div>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = ""; }}
        />
        <ProcessState phase={phase} message={message} />
      </CardContent>
    </Card>
  );
}

function PhotoToolsPage() {
  return (
    <div>
      <PageHeader
        title="Photo Tools"
        description="Ubah ukuran, kompres, konversi format, dan putar foto secara instan."
      />

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
          <ResizePanel />
        </TabsContent>

        <TabsContent value="compress" className="mt-4">
          <CompressPanel />
        </TabsContent>

        <TabsContent value="convert" className="mt-4">
          <ConvertPanel />
        </TabsContent>

        <TabsContent value="rotate" className="mt-4">
          <RotatePanel />
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
