import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { PdfToWordCard } from "@/components/shared/PdfToWordCard";
import { ProcessState, type Phase } from "@/components/shared/ProcessState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadBlob } from "@/lib/image";
import {
  compressPdf,
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
  const [pdfPassword, setPdfPassword] = useState("");
  const [unlockPassword, setUnlockPassword] = useState("");
  const [secureTab, setSecureTab] = useState("protect");

  const baseName = (file: File) => file.name.replace(/\.[^.]+$/, "");

  return (
    <div>
      <PageHeader
        title="PDF Tools"
        description="Semua kebutuhan dokumen PDF dalam satu tempat — konversi, kelola, dan amankan."
      />

      <ProcessState phase={phase} message={message} progress={progress} />

      <Tabs defaultValue="convert" className="mt-6">
        <TabsList>
          <TabsTrigger value="convert">Konversi</TabsTrigger>
          <TabsTrigger value="manage">Kelola</TabsTrigger>
          <TabsTrigger value="secure">Keamanan</TabsTrigger>
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

        <TabsContent value="manage" className="mt-4 grid gap-4 lg:grid-cols-2">
          <ToolCard title="Gabung PDF" description="Gabungkan beberapa PDF sesuai urutan unggahan.">
            <FileDropzone
              accept="application/pdf"
              multiple
              files={mergeFiles}
              onFiles={setMergeFiles}
              hint="Minimal dua berkas PDF"
            />
            <Button
              disabled={mergeFiles.length < 2 || phase === "working"}
              onClick={() =>
                run("merge", async () => [
                  { blob: await mergePdfs(mergeFiles), fileName: "gabungan.pdf" },
                ])
              }
            >
              Gabungkan
            </Button>
          </ToolCard>

          <ToolCard
            title="Pisah, Ekstrak, Putar & Kompres"
            description="Pilih satu PDF lalu jalankan operasi yang dibutuhkan."
          >
            <FileDropzone
              accept="application/pdf"
              files={manageFile}
              onFiles={async (files) => {
                setManageFile(files);
                const file = files[0];
                if (file) {
                  const info = await pdfInfo(file);
                  setSplitAt(Math.max(1, Math.floor(info.pages / 2)));
                }
              }}
              hint="Satu berkas PDF"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ranges">Halaman (mis. 1-3,5)</Label>
                <Input id="ranges" value={ranges} onChange={(e) => setRanges(e.target.value)} />
              </div>
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
              <div className="space-y-1.5">
                <Label htmlFor="angle">Rotasi (derajat)</Label>
                <Input
                  id="angle"
                  type="number"
                  step={90}
                  value={angle}
                  onChange={(e) => setAngle(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={!manageFile.length || phase === "working"}
                onClick={() =>
                  run("extract", async () => {
                    const file = manageFile[0]!;
                    const { pages: pageCount } = await pdfInfo(file);
                    const indices = parsePageRanges(ranges, pageCount);
                    return [
                      { blob: await extractPages(file, indices), fileName: `${baseName(file)}-ekstrak.pdf` },
                    ];
                  })
                }
              >
                Ekstrak halaman
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
                Pisah
              </Button>
              <Button
                variant="secondary"
                disabled={!manageFile.length || phase === "working"}
                onClick={() =>
                  run("rotate", async () => {
                    const file = manageFile[0]!;
                    const { pages: pageCount } = await pdfInfo(file);
                    const indices = parsePageRanges(ranges, pageCount);
                    return [
                      {
                        blob: await rotatePages(file, indices, angle),
                        fileName: `${baseName(file)}-rotasi.pdf`,
                      },
                    ];
                  })
                }
              >
                Putar
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
          </ToolCard>
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
              files={protectFile}
              onFiles={setProtectFile}
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
              disabled={!protectFile.length || !unlockPassword || phase === "working"}
              onClick={() =>
                run("unlock-pdf", async () => {
                  const file = protectFile[0]!;
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
