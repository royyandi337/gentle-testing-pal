// PDF -> Word (DOCX) di browser.
// Mode "text": ekstrak teks + posisi dari PDF (layout mengikuti aslinya).
// Mode "ocr": halaman dirender lalu dibaca Tesseract (untuk PDF hasil scan).
// Mode "image": setiap halaman jadi gambar penuh di Word (paling mirip aslinya).

export type PdfToWordMode = "auto" | "text" | "ocr" | "image";

export type PdfToWordOptions = {
  mode?: PdfToWordMode;
  /** Bahasa OCR Tesseract, mis. "ind+eng". */
  ocrLang?: string;
  onProgress?: (info: { done: number; total: number; label: string }) => void;
};

const PT_TO_DXA = 20; // 1pt = 20 DXA
const PT_TO_EMU = 12700;

type Line = {
  text: string;
  x: number; // pt dari kiri
  y: number; // pt dari atas
  size: number; // pt
  bold: boolean;
  italic: boolean;
};

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

/** Kelompokkan item teks pdf.js menjadi baris berdasarkan posisi Y. */
function itemsToLines(items: any[], pageHeight: number): Line[] {
  type Raw = Line & { right: number };
  const raws: Raw[] = [];

  for (const item of items) {
    const str: string = item.str ?? "";
    if (!str.trim()) continue;
    const t = (item.transform ?? []) as number[];
    const size = Math.abs(t[3] || t[0] || 11);
    const x = t[4] ?? 0;
    const y = pageHeight - (t[5] ?? 0);
    const font = String(item.fontName ?? "");
    raws.push({
      text: str,
      x,
      y,
      size,
      bold: /bold|black|heavy|semib/i.test(font),
      italic: /italic|oblique/i.test(font),
      right: x + (item.width ?? str.length * size * 0.5),
    });
  }

  raws.sort((a, b) => a.y - b.y || a.x - b.x);

  const lines: Line[] = [];
  let current: Raw | null = null;
  for (const raw of raws) {
    const tol = Math.max(2, raw.size * 0.5);
    if (current && Math.abs(raw.y - current.y) <= tol) {
      const gap = raw.x - current.right;
      const space = gap > raw.size * 0.25 ? " " : "";
      current.text += space + raw.text;
      current.right = Math.max(current.right, raw.right);
      current.size = Math.max(current.size, raw.size);
      current.bold = current.bold && raw.bold;
      continue;
    }
    if (current) lines.push(stripRaw(current));
    current = { ...raw };
  }
  if (current) lines.push(stripRaw(current));

  return lines.map((l) => ({ ...l, text: l.text.replace(/\s+/g, " ").trim() })).filter((l) => l.text);
}

function stripRaw(raw: Line & { right: number }): Line {
  const { right: _right, ...line } = raw;
  return line;
}

async function renderPage(page: any, scale: number) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas;
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error("Gagal merender halaman PDF."));
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/png"),
  );
}

/** OCR satu canvas halaman menjadi baris berposisi (pt). */
async function ocrCanvas(
  canvas: HTMLCanvasElement,
  scale: number,
  lang: string,
): Promise<Line[]> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(lang);
  try {
    const { data } = await worker.recognize(canvas, {}, { blocks: true });
    const blocks: any[] = (data as any).blocks ?? [];
    const lines: Line[] = [];
    for (const block of blocks) {
      for (const par of block.paragraphs ?? []) {
        for (const line of par.lines ?? []) {
          const text = String(line.text ?? "").replace(/\s+/g, " ").trim();
          if (!text) continue;
          const bbox = line.bbox ?? { x0: 0, y0: 0, y1: 0 };
          const height = Math.max(1, (bbox.y1 - bbox.y0) / scale);
          lines.push({
            text,
            x: bbox.x0 / scale,
            y: bbox.y0 / scale,
            size: Math.min(24, Math.max(8, height * 0.78)),
            bold: false,
            italic: false,
          });
        }
      }
    }
    return lines;
  } finally {
    await worker.terminate();
  }
}

/**
 * Konversi PDF ke DOCX. Ukuran halaman, margin, posisi & ukuran teks
 * mengikuti PDF aslinya sedekat mungkin.
 */
export async function pdfToWord(file: File, options: PdfToWordOptions = {}) {
  const { mode = "auto", ocrLang = "ind+eng", onProgress } = options;
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const total = doc.numPages;

  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    ImageRun,
    AlignmentType,
    PageBreak,
  } = await import("docx");

  const sections: any[] = [];
  let usedOcr = false;

  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const widthPt = viewport.width;
    const heightPt = viewport.height;

    let lines: Line[] = [];
    let pageImage: Uint8Array | null = null;

    if (mode === "image") {
      onProgress?.({ done: i - 1, total, label: `Merender halaman ${i}/${total}...` });
      pageImage = await canvasToPngBytes(await renderPage(page, 2));
    } else {
      onProgress?.({ done: i - 1, total, label: `Membaca teks halaman ${i}/${total}...` });
      const textContent = await page.getTextContent();
      lines = itemsToLines(textContent.items as any[], heightPt);

      const scanned = lines.join === undefined || lines.length === 0;
      const shouldOcr =
        mode === "ocr" || (mode === "auto" && (scanned || lines.length < 3));
      if (shouldOcr) {
        onProgress?.({ done: i - 1, total, label: `OCR halaman ${i}/${total}...` });
        const scale = 2;
        const canvas = await renderPage(page, scale);
        lines = await ocrCanvas(canvas, scale, ocrLang);
        usedOcr = true;
      }
    }

    const children: any[] = [];

    if (pageImage) {
      const margin = 24;
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              type: "png",
              data: pageImage,
              transformation: {
                width: Math.round(widthPt - margin * 2),
                height: Math.round(heightPt - margin * 2),
              },
              altText: {
                title: `Halaman ${i}`,
                description: `Halaman ${i} dari ${file.name}`,
                name: `page-${i}`,
              },
            }),
          ],
        }),
      );
    } else {
      const marginLeft = lines.length
        ? Math.max(0, Math.min(...lines.map((l) => l.x)))
        : 56;
      let prevBottom = lines.length ? lines[0]!.y : 0;

      lines.forEach((line, index) => {
        const gap = index === 0 ? 0 : Math.max(0, line.y - prevBottom - line.size * 1.15);
        prevBottom = line.y;
        const indent = Math.max(0, line.x - marginLeft);
        const centered =
          indent > 40 && widthPt - (line.x + line.text.length * line.size * 0.5) > 20;

        children.push(
          new Paragraph({
            alignment: centered ? AlignmentType.CENTER : AlignmentType.LEFT,
            spacing: { before: Math.round(gap * PT_TO_DXA), line: 240 },
            ...(centered ? {} : { indent: { left: Math.round(indent * PT_TO_DXA) } }),
            children: [
              new TextRun({
                text: line.text,
                size: Math.round(line.size * 2), // half-points
                bold: line.bold,
                italics: line.italic,
                font: "Arial",
              }),
            ],
          }),
        );
      });

      if (!children.length) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `[Halaman ${i} tidak memuat teks]`, size: 22, font: "Arial" }),
            ],
          }),
        );
      }
    }

    if (i < total) children.push(new Paragraph({ children: [new PageBreak()] }));

    sections.push({
      properties: {
        page: {
          size: {
            width: Math.round(widthPt * PT_TO_DXA),
            height: Math.round(heightPt * PT_TO_DXA),
          },
          margin: pageImage
            ? { top: 240, right: 240, bottom: 240, left: 240 }
            : { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children,
    });

    onProgress?.({ done: i, total, label: `Halaman ${i}/${total} selesai.` });
  }

  const wordDocument = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
    sections,
  });

  const blob = await Packer.toBlob(wordDocument);
  return {
    blob: new Blob([blob], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    usedOcr,
    pages: total,
  };
}

/** Ekstrak teks mentah dari PDF (dengan OCR bila halaman berupa scan). */
export async function pdfToText(file: File, ocrLang = "ind+eng") {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    let lines = itemsToLines((await page.getTextContent()).items as any[], viewport.height);
    if (lines.length < 3) {
      const scale = 2;
      lines = await ocrCanvas(await renderPage(page, scale), scale, ocrLang);
    }
    out.push(lines.map((l) => l.text).join("\n"));
  }
  return out.join("\n\n");
}
