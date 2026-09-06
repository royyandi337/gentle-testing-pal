// Client-side PDF processing (pdf-lib for structure, pdfjs-dist for rasterizing).
import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib";

export async function readPdf(file: File | Blob) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc;
}

export async function pdfInfo(file: File) {
  const doc = await readPdf(file);
  return { pages: doc.getPageCount(), name: file.name, size: file.size };
}

function toBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" });
}

export async function mergePdfs(files: File[]) {
  const out = await PDFDocument.create();
  for (const file of files) {
    const doc = await readPdf(file);
    const pages = await out.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return toBlob(await out.save());
}

/** Parses "1-3,5" into zero-based indices constrained to pageCount. */
export function parsePageRanges(input: string, pageCount: number): number[] {
  const result = new Set<number>();
  for (const part of input.split(",")) {
    const chunk = part.trim();
    if (!chunk) continue;
    const m = chunk.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const from = Number(m[1]);
      const to = Number(m[2]);
      for (let i = Math.min(from, to); i <= Math.max(from, to); i++) {
        if (i >= 1 && i <= pageCount) result.add(i - 1);
      }
    } else if (/^\d+$/.test(chunk)) {
      const n = Number(chunk);
      if (n >= 1 && n <= pageCount) result.add(n - 1);
    }
  }
  return [...result].sort((a, b) => a - b);
}

export async function extractPages(file: File, indices: number[]) {
  const src = await readPdf(file);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  return toBlob(await out.save());
}

export async function deletePages(file: File, indices: number[]) {
  const src = await readPdf(file);
  const keep = src.getPageIndices().filter((i) => !indices.includes(i));
  return extractPagesFromDoc(src, keep);
}

async function extractPagesFromDoc(src: PDFDocument, indices: number[]) {
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  return toBlob(await out.save());
}

export async function reorderPages(file: File, order: number[]) {
  const src = await readPdf(file);
  return extractPagesFromDoc(src, order);
}

export async function duplicatePages(file: File, indices: number[]) {
  const src = await readPdf(file);
  const order: number[] = [];
  src.getPageIndices().forEach((i) => {
    order.push(i);
    if (indices.includes(i)) order.push(i);
  });
  return extractPagesFromDoc(src, order);
}

export async function rotatePages(file: File, indices: number[], angle: number) {
  const doc = await readPdf(file);
  doc.getPages().forEach((page, i) => {
    if (indices.length === 0 || indices.includes(i)) {
      page.setRotation(degrees((page.getRotation().angle + angle) % 360));
    }
  });
  return toBlob(await doc.save());
}

export async function splitPdf(file: File, at: number) {
  const doc = await readPdf(file);
  const total = doc.getPageCount();
  const cut = Math.min(Math.max(1, at), total - 1);
  const first = await extractPages(file, range(0, cut));
  const second = await extractPages(file, range(cut, total));
  return [first, second] as const;
}

function range(from: number, to: number) {
  return Array.from({ length: to - from }, (_, i) => from + i);
}

export async function watermarkPdf(file: File, text: string, opacity = 0.25) {
  const doc = await readPdf(file);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const size = Math.min(width, height) / 12;
    page.drawText(text, {
      x: width * 0.1,
      y: height * 0.45,
      size,
      font,
      color: rgb(0.55, 0.55, 0.6),
      opacity,
      rotate: degrees(30),
    });
  }
  return toBlob(await doc.save());
}

/** Encrypts a PDF with a user password (required to open) and optional owner password. */
export async function protectPdf(file: File, userPassword: string, ownerPassword?: string) {
  const doc = await readPdf(file);
  const bytes = await doc.save({
    userPassword,
    ownerPassword: ownerPassword || userPassword,
  });
  return toBlob(bytes);
}

/** Removes encryption from a PDF by re-saving without password. Requires the correct password to load. */
export async function unlockPdf(file: File, password: string) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await PDFDocument.load(bytes, {
    ignoreEncryption: true,
    password,
  });
  const saved = await doc.save();
  return toBlob(saved);
}

/** Object-stream re-save; shrinks most PDFs without touching page content. */
export async function compressPdf(file: File) {
  const doc = await readPdf(file);
  const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });
  return toBlob(bytes);
}

/**
 * Compresses a PDF to a target file size (in MB) by rasterizing pages to JPEG
 * at decreasing quality levels until the target is met.
 */
export async function compressPdfToTarget(
  file: File,
  targetMB: number,
  onProgress?: (info: { phase: string; done: number; total: number }) => void,
): Promise<Blob> {
  const targetBytes = targetMB * 1024 * 1024;

  // First try object-stream compression (lossless, preserves text).
  const doc = await readPdf(file);
  const lossless = await doc.save({ useObjectStreams: true, addDefaultPage: false });
  if (lossless.byteLength <= targetBytes) {
    return toBlob(lossless);
  }

  // Fall back to rasterization: render each page as JPEG at decreasing quality.
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const srcDoc = await pdfjs.getDocument({ data }).promise;
  const numPages = srcDoc.numPages;

  const qualities = [0.85, 0.7, 0.55, 0.4, 0.25];
  const scales = [1.5, 1.0, 0.75];

  for (const scale of scales) {
    for (const quality of qualities) {
      onProgress?.({ phase: `Skala ${scale}, kualitas ${Math.round(quality * 100)}%`, done: 0, total: numPages });
      const out = await PDFDocument.create();

      for (let i = 1; i <= numPages; i++) {
        onProgress?.({ phase: `Render halaman ${i}/${numPages}`, done: i, total: numPages });
        const page = await srcDoc.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("Gagal merender halaman."))),
            "image/jpeg",
            quality,
          ),
        );
        const jpgBytes = new Uint8Array(await blob.arrayBuffer());
        const img = await out.embedJpg(jpgBytes);
        out.addPage([canvas.width, canvas.height]).drawImage(img, {
          x: 0, y: 0, width: canvas.width, height: canvas.height,
        });
      }

      const result = await out.save();
      if (result.byteLength <= targetBytes) {
        return toBlob(result);
      }
    }
  }

  // Last resort: lowest scale + lowest quality.
  const out = await PDFDocument.create();
  for (let i = 1; i <= numPages; i++) {
    onProgress?.({ phase: `Render akhir halaman ${i}/${numPages}`, done: i, total: numPages });
    const page = await srcDoc.getPage(i);
    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Gagal merender halaman."))),
        "image/jpeg",
        0.2,
      ),
    );
    const jpgBytes = new Uint8Array(await blob.arrayBuffer());
    const img = await out.embedJpg(jpgBytes);
    out.addPage([canvas.width, canvas.height]).drawImage(img, {
      x: 0, y: 0, width: canvas.width, height: canvas.height,
    });
  }
  return toBlob(await out.save());
}

async function fileToJpgBytes(file: File): Promise<{ bytes: Uint8Array; isPng: boolean }> {
  const isPng = file.type.includes("png");
  if (!file.type.includes("webp")) {
    return { bytes: new Uint8Array(await file.arrayBuffer()), isPng };
  }
  // pdf-lib cannot embed WEBP — rasterize to PNG via canvas first.
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Gagal membaca gambar WEBP."));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Gagal memuat gambar WEBP."));
    el.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal konversi WEBP."))), "image/png"),
  );
  return { bytes: new Uint8Array(await blob.arrayBuffer()), isPng: true };
}

export async function imagesToPdf(files: File[], fit: "a4" | "auto" = "a4") {
  const out = await PDFDocument.create();
  for (const file of files) {
    const { bytes, isPng } = await fileToJpgBytes(file);
    const image = isPng ? await out.embedPng(bytes) : await out.embedJpg(bytes);
    if (fit === "auto") {
      const page = out.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    } else {
      const page = out.addPage([595.28, 841.89]);
      const scale = Math.min(
        (page.getWidth() - 40) / image.width,
        (page.getHeight() - 40) / image.height,
      );
      const w = image.width * scale;
      const h = image.height * scale;
      page.drawImage(image, {
        x: (page.getWidth() - w) / 2,
        y: (page.getHeight() - h) / 2,
        width: w,
        height: h,
      });
    }
  }
  return toBlob(await out.save());
}

/** Renders each PDF page to a raster blob. */
export async function pdfToImages(
  file: File,
  type: "image/jpeg" | "image/png",
  scale = 2,
  onProgress?: (done: number, total: number) => void,
) {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const blobs: Blob[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d")!;
    if (type === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Gagal merender halaman."))),
        type,
        0.92,
      ),
    );
    blobs.push(blob);
    onProgress?.(i, doc.numPages);
  }
  return blobs;
}

/** DOCX -> PDF (teks & judul; layout kompleks disederhanakan). */
export async function docxToPdf(file: File) {
  const mammoth = await import("mammoth");
  const { default: JsPDF } = await import("jspdf");
  const { value: html } = await mammoth.convertToHtml({
    arrayBuffer: await file.arrayBuffer(),
  });
  const container = document.createElement("div");
  container.innerHTML = html;

  const pdf = new JsPDF({ unit: "pt", format: "a4" });
  const marginX = 56;
  const marginY = 64;
  const width = pdf.internal.pageSize.getWidth() - marginX * 2;
  const pageHeight = pdf.internal.pageSize.getHeight();
  let y = marginY;

  const blocks = Array.from(container.querySelectorAll("h1,h2,h3,h4,p,li"));
  const nodes = blocks.length ? blocks : [container];
  for (const node of nodes) {
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const heading = /^H[1-4]$/.test(node.tagName);
    const size = heading ? 16 : 11;
    pdf.setFont("helvetica", heading ? "bold" : "normal");
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(node.tagName === "LI" ? `• ${text}` : text, width);
    for (const line of lines) {
      if (y + size * 1.5 > pageHeight - marginY) {
        pdf.addPage();
        y = marginY;
      }
      pdf.text(line, marginX, y);
      y += size * 1.5;
    }
    y += heading ? 10 : 6;
  }
  return pdf.output("blob");
}
