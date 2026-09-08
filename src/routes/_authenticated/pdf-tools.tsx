import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, RotateCw, Scissors, Layers, FileOutput, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { PdfToWordCard } from "@/components/shared/PdfToWordCard";
import { ProcessState, type Phase } from "@/components/shared/ProcessState";
import {
  PdfThumbnailGrid,
  buildSelections,
  buildSelectedOnly,
  type PageItem,
} from "@/components/shared/PdfThumbnailGrid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { downloadBlob } from "@/lib/image";
import {
  assemblePdfPages,
  compressPdf,
  compressPdfToTarget,
  docxToPdf,
  extractPages,
  imagesToPdf,
  mergePdfs,
  parsePageRanges,
  pdfInfo,
  pdfToImages,
  protectPdf,
  rotatePages,
  splitPdf,
  unlockPdf,
  watermarkPdf,
} from "@/lib/pdf";
import { saveResult, type HistoryCategory } from "@/lib/history";

export const Route = createFileRoute("/_authenticated/pdf-tools")({
  head: () => ({
    meta: [
      { title: "PDF Tools — ROY DIGITAL SOLUTION" },
      {
        name: "description",
        content: "Convert, gabung, pisah, kompres, putar, dan lindungi dokumen PDF Anda.",
      },
      { property: "og:title", content: "PDF Tools — ROY DIGITAL SOLUTION" },
      {
        property: "og:description",
        content: "Convert, gabung, pisah, kompres, putar, dan lindungi dokumen PDF Anda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PdfToolsPage,
});

function useRunner(category: HistoryCategory) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [progress, setProgress] = useState<number | undefined>(undefined);

  async function run(tool: string, fn: () => Promise<{ blob: Blob; fileName: string }[]>) {
    setPhase("working");
    setMessage("Memproses berkas...");
    setProgress(undefined);
    try {
      const results = await fn();
      for (const result of results) {
        downloadBlob(result.blob, result.fileName);
        try {
          await saveResult({ category, tool, fileName: result.fileName, blob: result.blob });
        } catch {
          // Riwayat opsional: unduhan tetap berhasil.
        }
      }
      setPhase("done");
      setMessage(`${results.length} berkas siap diunduh dan tersimpan di Riwayat.`);
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Terjadi kesalahan.");
    } finally {
      setProgress(undefined);
    }
  }

  return { phase, message, progress, run, setProgress, setMessage };
}

function ToolCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function PdfToolsPage() {
  const { phase, message, progress, run, setProgress, setMessage } = useRunner("pdf");

  const [toPdfFiles, setToPdfFiles] = useState<File[]>([]);
  const [fromPdfFile, setFromPdfFile] = useState<File[]>([]);
  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const [manageFile, setManageFile] = useState<File[]>([]);
  const [ranges, setRanges] = useState("1-2");
  const [splitAt, setSplitAt] = useState(1);
  const [angle, setAngle] = useState(90);
  const [watermark, setWatermark] = useState("ROY DIGITAL");
  const [protectFile, setProtectFile] = useState<File[]>([]);
  const [unlockFile, setUnlockFile] = useState<File[]>([]);
  const [pdfPassword, setPdfPassword] = useState("");
  const [unlockPassword, setUnlockPassword] = useState("");
  const [compressTarget, setCompressTarget] = useState(1);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);

  // Thumbnail grid state for merge and manage modes
  const [mergeItems, setMergeItems] = useState<PageItem[]>([]);
  const [manageItems, setManageItems] = useState<PageItem[]>([]);
  const [manageMode, setManageMode] = useState<"all" | "select">("all");
  const [manageSelectedCount, setManageSelectedCount] = useState(0);

  const baseName = (file: File) => file.name.replace(/\.[^.]+$/, "");

  return (
    <div>
      <PageHeader
        title="PDF Tools"
        description="Semua kebutuhan dokumen PDF dalam satu tempat — konversi, kelola, dan amankan."
        icon={FileText}
      />

      <ProcessState phase={phase} message={message} progress={progress} />

      <Tabs defaultValue="convert" className="mt-6">
        <TabsList>
          <TabsTrigger value="convert">Konversi</TabsTrigger>
          <TabsTrigger value="manage">Kelola</TabsTrigger>
          <TabsTrigger value="secure">Keamanan</TabsTrigger>
          <TabsTrigger value="batch">Cetak Batch</TabsTrigger>
        </TabsList>

        <TabsContent value="convert" className="mt-4 grid gap-4 lg:grid-cols-2">
          <PdfToWordCard category="pdf" />

          <ToolCard
            title="Gambar / Word ke PDF"
            description="Unggah JPG, PNG, WEBP, atau DOCX untuk dijadikan PDF."
          >
            <FileDropzone
              accept="image/jpeg,image/png,image/webp,.docx"
              multiple
              files={toPdfFiles}
              onFiles={setToPdfFiles}
              hint="JPG, PNG, WEBP, atau DOCX"
            />
            <Button
              disabled={!toPdfFiles.length || phase === "working"}
              onClick={() =>
                run("to-pdf", async () => {
                  const docx = toPdfFiles.filter((f) => f.name.toLowerCase().endsWith(".docx"));
                  const images = toPdfFiles.filter((f) => f.type.startsWith("image/"));
                  const out: { blob: Blob; fileName: string }[] = [];
                  if (images.length) {
                    out.push({ blob: await imagesToPdf(images), fileName: "gambar-ke-pdf.pdf" });
                  }
                  for (const file of docx) {
                    out.push({ blob: await docxToPdf(file), fileName: `${baseName(file)}.pdf` });
                  }
                  if (!out.length) throw new Error("Format berkas tidak didukung.");
                  return out;
                })
              }
            >
              Konversi ke PDF
            </Button>
          </ToolCard>

          <ToolCard
            title="PDF ke Gambar"
            description="Ubah setiap halaman PDF menjadi berkas JPG atau PNG."
          >
            <FileDropzone
              accept="application/pdf"
              files={fromPdfFile}
              onFiles={setFromPdfFile}
              hint="Satu berkas PDF"
            />
            <div className="flex gap-2">
              {(["image/jpeg", "image/png"] as const).map((type) => (
                <Button
                  key={type}
                  variant={type === "image/jpeg" ? "default" : "secondary"}
                  disabled={!fromPdfFile.length || phase === "working"}
                  onClick={() =>
                    run("pdf-to-image", async () => {
                      const file = fromPdfFile[0]!;
                      setProgress(0);
                      setMessage("Merender halaman PDF...");
                      const blobs = await pdfToImages(file, type, 2, (done, total) => {
                        setProgress(Math.round((done / total) * 100));
                        setMessage(`Merender halaman ${done}/${total}...`);
                      });
                      const ext = type === "image/jpeg" ? "jpg" : "png";
                      return blobs.map((blob, i) => ({
                        blob,
                        fileName: `${baseName(file)}-hal-${i + 1}.${ext}`,
                      }));
                    })
                  }
                >
                  Ke {type === "image/jpeg" ? "JPG" : "PNG"}
                </Button>
              ))}
            </div>
          </ToolCard>
        </TabsContent>

        <TabsContent value="manage" className="mt-4 space-y-4">
          {/* ===== GABUNG PDF ===== */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="size-4 text-primary" />
                Gabung PDF
              </CardTitle>
              <CardDescription>
                Unggah beberapa PDF, atur urutan halaman dengan drag-and-drop, buang halaman yang tidak perlu, lalu gabungkan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileDropzone
                accept="application/pdf"
                multiple
                files={mergeFiles}
                onFiles={(picked) => {
                  setMergeFiles((previous) => {
                    const existing = new Set(previous.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
                    return [
                      ...previous,
                      ...picked.filter((file) => !existing.has(`${file.name}-${file.size}-${file.lastModified}`)),
                    ];
                  });
                }}
                onRemoveFile={(index) => {
                  setMergeFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index));
                }}
                hint="Minimal dua berkas PDF"
              />
              {mergeFiles.length >= 2 && (
                <PdfThumbnailGrid
                  files={mergeFiles}
                  mode="merge"
                  items={mergeItems}
                  setItems={setMergeItems}
                />
              )}
              <Button
                disabled={mergeFiles.length < 2 || phase === "working" || mergeItems.filter((i) => !i.excluded).length === 0}
                onClick={() =>
                  run("merge", async () => {
                    const selections = buildSelections(mergeItems, mergeFiles);
                    if (!selections.length) throw new Error("Pilih setidaknya satu halaman.");
                    return [
                      { blob: await assemblePdfPages(selections), fileName: "gabungan.pdf" },
                    ];
                  })
                }
              >
                <Layers className="size-4" />
                Gabungkan ({mergeItems.filter((i) => !i.excluded).length} halaman)
              </Button>
            </CardContent>
          </Card>

          {/* ===== PISAH, EKSTRAK, PUTAR & KOMPRES ===== */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Scissors className="size-4 text-primary" />
                Pisah, Ekstrak, Putar & Kompres
              </CardTitle>
              <CardDescription>
                Pilih satu PDF, lihat semua halaman sebagai thumbnail, putar/hapus halaman individual, lalu ekstrak atau pisah.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileDropzone
                accept="application/pdf"
                files={manageFile}
                onFiles={async (files) => {
                  setManageFile(files);
                  setManageItems([]);
                  const file = files[0];
                  if (file) {
                    const info = await pdfInfo(file);
                    setSplitAt(Math.max(1, Math.floor(info.pages / 2)));
                  }
                }}
                hint="Satu berkas PDF"
              />

              {manageFile.length > 0 && (
                <>
                  {/* Mode toggle */}
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
                    <span className="text-xs font-semibold text-foreground">Mode Ekstrak:</span>
                    <button
                      type="button"
                      onClick={() => setManageMode("all")}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        manageMode === "all"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/70",
                      )}
                    >
                      <FileOutput className="mr-1 inline size-3" />
                      Semua halaman aktif
                    </button>
                    <button
                      type="button"
                      onClick={() => setManageMode("select")}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        manageMode === "select"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/70",
                      )}
                    >
                      <Sparkles className="mr-1 inline size-3" />
                      Pilih halaman tertentu
                    </button>
                    {manageMode === "select" && (
                      <Badge variant="secondary" className="text-[10px]">
                        {manageSelectedCount} dipilih
                      </Badge>
                    )}
                  </div>

                  <PdfThumbnailGrid
                    files={manageFile}
                    mode="manage"
                    items={manageItems}
                    setItems={setManageItems}
                    selectionMode={manageMode === "select"}
                    onSelectionChange={setManageSelectedCount}
                  />

                  {/* Split control */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="splitAt">Pisah setelah halaman</Label>
                      <Input
                        id="splitAt"
                        type="number"
                        min={1}
                        value={splitAt}
                        onChange={(e) => setSplitAt(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      disabled={!manageFile.length || phase === "working"}
                      onClick={() =>
                        run("extract", async () => {
                          const file = manageFile[0]!;
                          if (manageMode === "select") {
                            const selections = buildSelectedOnly(manageItems, manageFile);
                            if (!selections.length) throw new Error("Pilih setidaknya satu halaman.");
                            return [
                              { blob: await assemblePdfPages(selections), fileName: `${baseName(file)}-ekstrak.pdf` },
                            ];
                          }
                          const selections = buildSelections(manageItems, manageFile);
                          if (!selections.length) throw new Error("Tidak ada halaman aktif.");
                          return [
                            { blob: await assemblePdfPages(selections), fileName: `${baseName(file)}-ekstrak.pdf` },
                          ];
                        })
                      }
                    >
                      <FileOutput className="size-4" />
                      {manageMode === "select"
                        ? `Ekstrak ${manageSelectedCount} halaman terpilih`
                        : `Ekstrak ${manageItems.filter((i) => !i.excluded).length} halaman aktif`}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!manageFile.length || phase === "working"}
                      onClick={() =>
                        run("split", async () => {
                          const file = manageFile[0]!;
                          const [first, second] = await splitPdf(file, splitAt);
                          return [
                            { blob: first!, fileName: `${baseName(file)}-bagian-1.pdf` },
                            { blob: second!, fileName: `${baseName(file)}-bagian-2.pdf` },
                          ];
                        })
                      }
                    >
                      <Scissors className="size-4" />
                      Pisah
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!manageFile.length || phase === "working"}
                      onClick={() =>
                        run("compress", async () => {
                          const file = manageFile[0]!;
                          return [
                            { blob: await compressPdf(file), fileName: `${baseName(file)}-kompres.pdf` },
                          ];
                        })
                      }
                    >
                      Kompres
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="secure" className="mt-4 grid gap-4 lg:grid-cols-2">
          <ToolCard title="Watermark PDF" description="Tambahkan teks watermark di setiap halaman.">
            <FileDropzone
              accept="application/pdf"
              files={manageFile}
              onFiles={setManageFile}
              hint="Satu berkas PDF"
            />
            <div className="space-y-1.5">
              <Label htmlFor="watermark">Teks watermark</Label>
              <Input
                id="watermark"
                value={watermark}
                onChange={(e) => setWatermark(e.target.value)}
              />
            </div>
            <Button
              disabled={!manageFile.length || !watermark || phase === "working"}
              onClick={() =>
                run("watermark", async () => {
                  const file = manageFile[0]!;
                  return [
                    {
                      blob: await watermarkPdf(file, watermark),
                      fileName: `${baseName(file)}-watermark.pdf`,
                    },
                  ];
                })
              }
            >
              Tambah watermark
            </Button>
          </ToolCard>

          <ToolCard
            title="Proteksi PDF dengan Password"
            description="Tambahkan password untuk membuka PDF. Penerima harus tahu passwordnya untuk membaca file."
          >
            <FileDropzone
              accept="application/pdf"
              files={protectFile}
              onFiles={setProtectFile}
              hint="Satu berkas PDF"
            />
            <div className="space-y-1.5">
              <Label htmlFor="pdf-password">Password</Label>
              <Input
                id="pdf-password"
                type="password"
                value={pdfPassword}
                onChange={(e) => setPdfPassword(e.target.value)}
                placeholder="Masukkan password untuk PDF"
              />
            </div>
            <Button
              disabled={!protectFile.length || !pdfPassword || phase === "working"}
              onClick={() =>
                run("protect-pdf", async () => {
                  const file = protectFile[0]!;
                  return [
                    {
                      blob: await protectPdf(file, pdfPassword),
                      fileName: `${baseName(file)}-terproteksi.pdf`,
                    },
                  ];
                })
              }
            >
              Proteksi PDF
            </Button>
          </ToolCard>

          <ToolCard
            title="Buka Password PDF"
            description="Hapus password dari PDF yang terkunci. Masukkan password yang benar untuk membukanya."
          >
            <FileDropzone
              accept="application/pdf"
              files={unlockFile}
              onFiles={setUnlockFile}
              hint="Satu berkas PDF terkunci"
            />
            <div className="space-y-1.5">
              <Label htmlFor="unlock-password">Password PDF</Label>
              <Input
                id="unlock-password"
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="Masukkan password PDF"
              />
            </div>
            <Button
              disabled={!unlockFile.length || !unlockPassword || phase === "working"}
              onClick={() =>
                run("unlock-pdf", async () => {
                  const file = unlockFile[0]!;
                  return [
                    {
                      blob: await unlockPdf(file, unlockPassword),
                      fileName: `${baseName(file)}-terbuka.pdf`,
                    },
                  ];
                })
              }
            >
              Buka Password
            </Button>
          </ToolCard>

          <ToolCard
            title="Kompres PDF ke Target Ukuran"
            description="Kecilkan PDF sampai di bawah ukuran yang Anda tentukan."
          >
            <FileDropzone
              accept="application/pdf"
              files={manageFile}
              onFiles={setManageFile}
              hint="Satu berkas PDF"
            />
            <div className="space-y-1.5">
              <Label htmlFor="compress-target">Target ukuran maksimal (MB)</Label>
              <Input
                id="compress-target"
                type="number"
                min={0.1}
                step={0.1}
                value={compressTarget}
                onChange={(e) => setCompressTarget(Number(e.target.value) || 1)}
              />
            </div>
            <Button
              disabled={!manageFile.length || phase === "working"}
              onClick={() =>
                run("compress-target", async () => {
                  const file = manageFile[0]!;
                  setProgress(0);
                  setMessage("Mengompres PDF ke target ukuran...");
                  const blob = await compressPdfToTarget(file, compressTarget, (info) => {
                    setProgress(Math.round((info.done / info.total) * 100));
                    setMessage(`${info.phase}...`);
                  });
                  return [{ blob, fileName: `${baseName(file)}-kompres-${compressTarget}mb.pdf` }];
                })
              }
            >
              Kompres ke Target
            </Button>
          </ToolCard>
        </TabsContent>

        <TabsContent value="batch" className="mt-4">
          <ToolCard
            title="Cetak PDF Batch"
            description="Unggah beberapa file PDF berbeda, gabungkan dan cetak semuanya sekaligus dalam satu proses."
          >
            <FileDropzone
              accept="application/pdf"
              multiple
              files={batchFiles}
              onFiles={setBatchFiles}
              hint="Pilih dua atau lebih file PDF"
            />
            {batchFiles.length > 0 ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {batchFiles.length} file siap diproses:
                </p>
                <ol className="list-inside list-decimal space-y-0.5 text-sm text-muted-foreground">
                  {batchFiles.map((f, i) => (
                    <li key={i} className="truncate">
                      {f.name} ({(f.size / 1024).toFixed(0)} KB)
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={batchFiles.length < 2 || phase === "working"}
                onClick={() =>
                  run("batch-merge-print", async () => {
                    setProgress(0);
                    setMessage(`Menggabungkan ${batchFiles.length} PDF...`);
                    const blob = await mergePdfs(batchFiles);
                    setProgress(100);
                    return [
                      { blob, fileName: "cetak-batch-gabungan.pdf" },
                    ];
                  })
                }
              >
                Gabung & Cetak Semua
              </Button>
              <Button
                variant="secondary"
                disabled={!batchFiles.length || phase === "working"}
                onClick={() =>
                  run("batch-print", async () => {
                    setProgress(0);
                    const out: { blob: Blob; fileName: string }[] = [];
                    for (let i = 0; i < batchFiles.length; i++) {
                      setProgress(Math.round(((i + 1) / batchFiles.length) * 100));
                      setMessage(`Memproses ${i + 1}/${batchFiles.length}: ${batchFiles[i]!.name}`);
                      out.push({
                        blob: await compressPdf(batchFiles[i]!),
                        fileName: `${baseName(batchFiles[i]!)}-cetak.pdf`,
                      });
                    }
                    return out;
                  })
                }
              >
                Cetak Per File
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              "Gabung & Cetak Semua" menggabungkan semua PDF menjadi satu file lalu mengunduhnya.
              "Cetak Per File" memproses setiap PDF secara terpisah dan mengunduhnya satu per satu.
            </p>
          </ToolCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
