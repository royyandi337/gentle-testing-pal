import { useCallback, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  RotateCw,
  RotateCcw,
  X,
  Plus,
  Download,
  Trash2,
  ImagePlus,
  Images,
  Maximize2,
  FileArchive,
  RefreshCw,
  Package,
  LayoutGrid,
  Camera,
} from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { LabelPrintCard } from "@/components/shared/LabelPrintCard";
import { CollageCard } from "@/components/shared/CollageCard";
import { PolaroidCard } from "@/components/shared/PolaroidCard";
import { ProcessState, type Phase } from "@/components/shared/ProcessState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { canvasToBlob, downloadBlob, loadImage } from "@/lib/image";
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

/* ===== Segmented tabs (mockup style) ===== */

const TABS = [
  { value: "resize", label: "Resize", icon: Maximize2 },
  { value: "compress", label: "Kompres", icon: FileArchive },
  { value: "convert", label: "Konversi", icon: RefreshCw },
  { value: "rotate", label: "Rotasi", icon: RotateCw },
  { value: "label", label: "Cetak Label", icon: Package },
  { value: "kolase", label: "Kolase", icon: LayoutGrid },
  { value: "polaroid", label: "Polaroid", icon: Camera },
] as const;

function SegmentedTabs({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="tool-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          className={value === tab.value ? "active" : ""}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ===== Task head (icon + title) ===== */

function TaskHead({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="task-head-mockup">
      <div className="ic">
        <Icon className="size-4" />
      </div>
      <div>
        <h3 className="text-[15px] font-bold text-foreground">{title}</h3>
        <p className="mt-0.5 text-[12.5px] text-slate">{desc}</p>
      </div>
    </div>
  );
}

/* ===== Batch card grid (mockup style) ===== */

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
    <div className="compress-grid">
      {items.map((item) => (
        <div key={item.id} className="batch-card-mockup">
          <button className="cc-remove" onClick={() => onRemove(item.id)} aria-label="Hapus">
            <X />
          </button>
          <p className="cc-name">{item.file.name}</p>
          <p className="cc-orig">{formatSize(item.file.size)}</p>
          <div className="cc-thumb">
            <img src={item.url} alt={item.file.name} />
          </div>
          <p className={item.done ? "cc-newsize" : "cc-newsize pending"}>{item.resultLabel}</p>
          <button className="cc-dl" disabled={!item.done} onClick={() => onDownload(item)}>
            Unduh
          </button>
        </div>
      ))}
    </div>
  );
}

/* ===== Batch bottom bar (mockup style) ===== */

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
    <div className="compress-bottombar">
      <button
        className="btn-secondary-line"
        onClick={onAdd}
        style={{ flex: "0 0 auto", padding: "11px 16px" }}
      >
        <ImagePlus className="size-4" /> Pilih Gambar
      </button>
      <button
        className="icon-btn"
        onClick={onClear}
        aria-label="Hapus semua"
        style={{ flex: "0 0 auto" }}
      >
        <Trash2 className="size-4" />
      </button>
      <button
        className="btn-action-mockup"
        disabled={disabled}
        onClick={onProcess}
        style={{ flex: 1 }}
      >
        <Download className="size-4" /> {processLabel}
      </button>
    </div>
  );
}

/* ===== Shared batch hook ===== */

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

/* ===== Hidden file input ===== */

function HiddenInput({
  inputRef,
  onFiles,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (files: File[]) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      className="hidden"
      onChange={(e) => {
        if (e.target.files) onFiles(Array.from(e.target.files));
        e.target.value = "";
      }}
    />
  );
}

/* ===== Resize Panel ===== */

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
          targetH =
            height > 0
              ? height
              : Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * targetW));
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
        } catch {
          /* Riwayat opsional */
        }
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
    <div className="task-card-mockup">
      <TaskHead
        icon={Maximize2}
        title="Resize Foto"
        desc="Kecilkan atau perbesar dimensi foto — persen atau piksel."
      />

      <div className="compress-toolbar">
        <div className="space-y-1.5">
          <Label>Mode</Label>
          <div className="choice-pills">
            <button
              className={`choice-pill ${mode === "percent" ? "active" : ""}`}
              onClick={() => setMode("percent")}
            >
              Persen
            </button>
            <button
              className={`choice-pill ${mode === "pixel" ? "active" : ""}`}
              onClick={() => setMode("pixel")}
            >
              Pixel
            </button>
          </div>
        </div>
        {mode === "percent" ? (
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <Label>Skala</Label>
              <span className="value-badge">{percent}%</span>
            </div>
            <Slider
              min={10}
              max={100}
              step={5}
              value={[percent]}
              onValueChange={([v]) => setPercent(v ?? 75)}
            />
          </div>
        ) : (
          <div className="flex flex-1 gap-3">
            <div className="flex-1 space-y-1.5">
              <Label>Lebar (px)</Label>
              <Input
                type="number"
                min={1}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>Tinggi (0=auto)</Label>
              <Input
                type="number"
                min={0}
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>

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
      <HiddenInput inputRef={tool.fileInputRef} onFiles={tool.addFiles} />
      <ProcessState phase={tool.phase} message={tool.message} />
    </div>
  );
}

/* ===== Compress Panel ===== */

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
        } catch {
          /* Riwayat opsional */
        }
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
    <div className="task-card-mockup">
      <TaskHead
        icon={FileArchive}
        title="Kompres Foto"
        desc="Kurangi ukuran file tanpa mengurangi kualitas secara signifikan."
      />

      <div className="compress-toolbar">
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <Label>Tingkat Kompresi</Label>
            <span className="value-badge">{quality}%</span>
          </div>
          <Slider
            min={10}
            max={100}
            step={5}
            value={[quality]}
            onValueChange={([v]) => setQuality(v ?? 60)}
          />
        </div>
      </div>

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
      <HiddenInput inputRef={tool.fileInputRef} onFiles={tool.addFiles} />
      <ProcessState phase={tool.phase} message={tool.message} />
    </div>
  );
}

/* ===== Convert Panel ===== */

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
        } catch {
          /* Riwayat opsional */
        }
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
    <div className="task-card-mockup">
      <TaskHead
        icon={RefreshCw}
        title="Konversi Format"
        desc="Ubah format foto ke JPG, PNG, atau WEBP."
      />

      <div className="compress-toolbar">
        <div className="space-y-1.5">
          <Label>Format tujuan</Label>
          <div className="choice-pills">
            {(["jpg", "png", "webp"] as const).map((f) => (
              <button
                key={f}
                className={`choice-pill ${format === f ? "active" : ""}`}
                onClick={() => setFormat(f)}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

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
      <HiddenInput inputRef={tool.fileInputRef} onFiles={tool.addFiles} />
      <ProcessState phase={tool.phase} message={tool.message} />
    </div>
  );
}

/* ===== Rotate Panel ===== */

function RotatePanel() {
  const [items, setItems] = useState<{ id: string; file: File; url: string; angle: number }[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: File[]) {
    const newItems = files
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({
        id: `${f.name}-${Date.now()}-${Math.random()}`,
        file: f,
        url: URL.createObjectURL(f),
        angle: 0,
      }));
    setItems((prev) => [...prev, ...newItems]);
  }
  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }
  function rotateItem(id: string, delta: number) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, angle: item.angle + delta } : item)),
    );
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
        } catch {
          /* Riwayat opsional */
        }
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
    <div className="task-card-mockup">
      <TaskHead
        icon={RotateCw}
        title="Putar Foto"
        desc="Unggah beberapa foto, lalu putar satu per satu — pratinjau langsung berubah."
      />

      {!items.length ? (
        <FileDropzone
          accept="image/jpeg,image/png,image/webp"
          multiple
          onFiles={addFiles}
          hint="Tarik & lepas file di sini — bisa banyak foto sekaligus"
        />
      ) : (
        <>
          <div className="rotate-grid">
            {items.map((item) => (
              <div key={item.id} className="rotate-card-mockup">
                <button
                  className="cc-remove"
                  onClick={() => removeItem(item.id)}
                  aria-label="Hapus foto"
                >
                  <X />
                </button>
                <p className="cc-name">{item.file.name}</p>
                <div className="rotate-viewport">
                  <img
                    src={item.url}
                    alt={item.file.name}
                    style={{ transform: `rotate(${item.angle}deg)` }}
                  />
                </div>
                <p className="rotate-angle">{((item.angle % 360) + 360) % 360}°</p>
                <div className="rotate-actions">
                  <button aria-label="Putar kiri" onClick={() => rotateItem(item.id, -90)}>
                    <RotateCcw />
                  </button>
                  <button className="reset-btn" onClick={() => resetItem(item.id)}>
                    Reset
                  </button>
                  <button aria-label="Putar kanan" onClick={() => rotateItem(item.id, 90)}>
                    <RotateCw />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="compress-bottombar">
            <button
              className="btn-secondary-line"
              onClick={() => fileInputRef.current?.click()}
              style={{ flex: "0 0 auto", padding: "11px 16px" }}
            >
              <ImagePlus className="size-4" /> Pilih Gambar
            </button>
            <button
              className="icon-btn"
              onClick={clearAll}
              aria-label="Hapus semua"
              style={{ flex: "0 0 auto" }}
            >
              <Trash2 className="size-4" />
            </button>
            <button
              className="btn-action-mockup"
              disabled={phase === "working"}
              onClick={applyAll}
              style={{ flex: 1 }}
            >
              <Download className="size-4" /> Terapkan & Unduh Semua
            </button>
          </div>
        </>
      )}
      <HiddenInput inputRef={fileInputRef} onFiles={addFiles} />
      <ProcessState phase={phase} message={message} />
    </div>
  );
}

/* ===== Main page ===== */

function PhotoToolsPage() {
  const [tab, setTab] = useState("resize");

  return (
    <div>
      <PageHeader
        title="Photo Tools"
        description="Ubah ukuran, kompres, konversi format, dan putar foto secara instan."
        icon={Images}
      />

      <SegmentedTabs value={tab} onChange={setTab} />

      {tab === "resize" && <ResizePanel />}
      {tab === "compress" && <CompressPanel />}
      {tab === "convert" && <ConvertPanel />}
      {tab === "rotate" && <RotatePanel />}
      {tab === "label" && <LabelPrintCard />}
      {tab === "kolase" && <CollageCard />}
      {tab === "polaroid" && <PolaroidCard />}
    </div>
  );
}
