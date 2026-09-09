// Client-side image processing helpers (canvas based).

export type PhotoSize = { id: string; label: string; wCm: number; hCm: number };

export const PHOTO_SIZES: PhotoSize[] = [
  { id: "2x3", label: "2 × 3 cm", wCm: 2, hCm: 3 },
  { id: "3x4", label: "3 × 4 cm", wCm: 3, hCm: 4 },
  { id: "4x6", label: "4 × 6 cm", wCm: 4, hCm: 6 },
  { id: "visa", label: "Visa (5,1 × 5,1 cm)", wCm: 5.1, hCm: 5.1 },
];

export const PAPER_SIZES = [
  { id: "a4", label: "A4 (21 × 29,7 cm)", wCm: 21, hCm: 29.7 },
  { id: "a5", label: "A5 (14,8 × 21 cm)", wCm: 14.8, hCm: 21 },
  { id: "4r", label: "4R (10,2 × 15,2 cm)", wCm: 10.2, hCm: 15.2 },
];

export function cmToPx(cm: number, dpi: number) {
  return Math.max(1, Math.round((cm / 2.54) * dpi));
}

export function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gambar tidak dapat dibaca."));
    img.src = src;
  });
}

export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("File tidak dapat dibaca."));
    reader.readAsDataURL(file);
  });
}

export type Adjustments = {
  zoom: number;
  offsetX: number;
  offsetY: number;
  rotate: number;
  flipH: boolean;
  flipV: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  sharpen: number;
  red: number;
  green: number;
  blue: number;
};

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  rotate: 0,
  flipH: false,
  flipV: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  sharpen: 0,
  red: 100,
  green: 100,
  blue: 100,
};

const MAX_PREVIEW_PIXELS = 8_000_000;

function supportsCanvasFilter(): boolean {
  try {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    return typeof ctx?.filter === "string";
  } catch {
    return false;
  }
}

let _filterSupported: boolean | null = null;
function canvasFilterSupported(): boolean {
  if (_filterSupported === null) _filterSupported = supportsCanvasFilter();
  return _filterSupported;
}

function applyBrightnessContrastSaturation(
  data: ImageData,
  brightness: number,
  contrast: number,
  saturation: number,
) {
  const d = data.data;
  const b = brightness / 100;
  const c = contrast / 100;
  const s = saturation / 100;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i]!;
    let g = d[i + 1]!;
    let bl = d[i + 2]!;
    r = (r - 128) * c + 128;
    g = (g - 128) * c + 128;
    bl = (bl - 128) * c + 128;
    r *= b;
    g *= b;
    bl *= b;
    const gray = 0.299 * r + 0.587 * g + 0.114 * bl;
    r = gray + (r - gray) * s;
    g = gray + (g - gray) * s;
    bl = gray + (bl - gray) * s;
    d[i] = Math.max(0, Math.min(255, r));
    d[i + 1] = Math.max(0, Math.min(255, g));
    d[i + 2] = Math.max(0, Math.min(255, bl));
  }
}

/** Renders the source image into a target-sized canvas with adjustments + background. */
export function renderPhoto(
  img: HTMLImageElement,
  targetW: number,
  targetH: number,
  adj: Adjustments,
  background: string | null,
  maxPixels?: number,
): HTMLCanvasElement {
  const limit = maxPixels ?? MAX_PREVIEW_PIXELS;
  const totalPixels = targetW * targetH;
  const needsPixelProcessing =
    adj.sharpen > 0 ||
    adj.red !== 100 ||
    adj.green !== 100 ||
    adj.blue !== 100 ||
    (!canvasFilterSupported() &&
      (adj.brightness !== 100 || adj.contrast !== 100 || adj.saturation !== 100));

  let scale = 1;
  if (totalPixels > limit && needsPixelProcessing) {
    scale = Math.sqrt(limit / totalPixels);
  }

  const renderW = Math.max(1, Math.round(targetW * scale));
  const renderH = Math.max(1, Math.round(targetH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = renderW;
  canvas.height = renderH;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, renderW, renderH);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, renderW, renderH);
  }

  const useFilter =
    canvasFilterSupported() &&
    (adj.brightness !== 100 || adj.contrast !== 100 || adj.saturation !== 100);

  ctx.save();
  if (useFilter) {
    ctx.filter = `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturation}%)`;
  }
  ctx.translate(renderW / 2 + adj.offsetX * scale, renderH / 2 + adj.offsetY * scale);
  ctx.rotate((adj.rotate * Math.PI) / 180);
  ctx.scale(adj.flipH ? -1 : 1, adj.flipV ? -1 : 1);

  const cover = Math.max(renderW / img.width, renderH / img.height) * adj.zoom;
  const w = img.width * cover;
  const h = img.height * cover;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();

  if (needsPixelProcessing) {
    const data = ctx.getImageData(0, 0, renderW, renderH);
    if (!canvasFilterSupported()) {
      applyBrightnessContrastSaturation(data, adj.brightness, adj.contrast, adj.saturation);
    }
    applyChannels(data, adj.red / 100, adj.green / 100, adj.blue / 100);
    if (adj.sharpen > 0) sharpenImageData(data, renderW, renderH, adj.sharpen / 100);
    ctx.putImageData(data, 0, 0);
  }

  if (scale < 1) {
    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = targetW;
    fullCanvas.height = targetH;
    const fullCtx = fullCanvas.getContext("2d")!;
    fullCtx.imageSmoothingEnabled = true;
    fullCtx.imageSmoothingQuality = "high";
    if (background) {
      fullCtx.fillStyle = background;
      fullCtx.fillRect(0, 0, targetW, targetH);
    }
    fullCtx.drawImage(canvas, 0, 0, targetW, targetH);
    return fullCanvas;
  }

  return canvas;
}

function applyChannels(data: ImageData, r: number, g: number, b: number) {
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.min(255, d[i]! * r);
    d[i + 1] = Math.min(255, d[i + 1]! * g);
    d[i + 2] = Math.min(255, d[i + 2]! * b);
  }
}

function sharpenImageData(data: ImageData, w: number, h: number, amount: number) {
  const src = new Uint8ClampedArray(data.data);
  const d = data.data;
  const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let ki = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            sum += src[((y + ky) * w + (x + kx)) * 4 + c]! * k[ki++]!;
          }
        }
        const idx = (y * w + x) * 4 + c;
        d[idx] = src[idx]! * (1 - amount) + sum * amount;
      }
    }
  }
}

let _webpSupported: boolean | null = null;

export function isWebpSupported(): boolean {
  if (_webpSupported !== null) return _webpSupported;
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    _webpSupported = c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    _webpSupported = false;
  }
  return _webpSupported;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality = 0.92) {
  return new Promise<Blob>((resolve, reject) => {
    const safeType = type === "image/webp" && !isWebpSupported() ? "image/jpeg" : type;
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Gagal membuat file gambar."))),
      safeType,
      quality,
    );
  });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Composes a print sheet full of identical photos. */
export function buildPrintSheet(opts: {
  photo: HTMLCanvasElement | HTMLImageElement;
  paperWCm: number;
  paperHCm: number;
  photoWCm: number;
  photoHCm: number;
  marginCm: number;
  spacingCm: number;
  dpi: number;
  count: number;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = cmToPx(opts.paperWCm, opts.dpi);
  canvas.height = cmToPx(opts.paperHCm, opts.dpi);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pw = cmToPx(opts.photoWCm, opts.dpi);
  const ph = cmToPx(opts.photoHCm, opts.dpi);
  const margin = cmToPx(opts.marginCm, opts.dpi);
  const gap = cmToPx(opts.spacingCm, opts.dpi);

  const cols = Math.max(1, Math.floor((canvas.width - margin * 2 + gap) / (pw + gap)));
  const rows = Math.max(1, Math.floor((canvas.height - margin * 2 + gap) / (ph + gap)));
  const maxCount = cols * rows;
  const total = Math.min(opts.count, maxCount);

  for (let i = 0; i < total; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    ctx.drawImage(opts.photo, margin + col * (pw + gap), margin + row * (ph + gap), pw, ph);
  }
  return { canvas, cols, rows, capacity: maxCount, placed: total };
}
