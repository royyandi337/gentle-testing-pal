// Server-only Gradio Space client. The browser never calls the Spaces directly
// (CORS + Zero GPU cold starts), so every request goes through this proxy.

const POST_TIMEOUT_MS = 45_000;
const RESULT_TIMEOUT_MS = 180_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders(): Record<string, string> {
  const token = process.env["HUGGINGFACE_TOKEN"];
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Payload for a file that has already been uploaded to the Space.
 * Raw data URLs must never be inlined here — large images break the call.
 */
export function fileData(uploadedPath: string) {
  return { path: uploadedPath, meta: { _type: "gradio.FileData" } };
}

function findUrl(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value.startsWith("http") ? value : undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUrl(item);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj["url"] === "string") return obj["url"] as string;
    return findUrl(Object.values(obj));
  }
  return undefined;
}

/** Parses the Gradio SSE stream and returns the URL of the produced image. */
function extractResultUrl(sse: string): string {
  for (const chunk of sse.split("\n\n")) {
    const isComplete = /^event:\s*complete/m.test(chunk);
    const isError = /^event:\s*error/m.test(chunk);
    const dataLine = chunk.match(/^data:\s*(.*)$/m)?.[1];
    if (isError) throw new Error(`Space AI mengembalikan error: ${dataLine ?? "tidak diketahui"}`);
    if (!isComplete || !dataLine) continue;
    const url = findUrl(JSON.parse(dataLine));
    if (url) return url;
  }
  throw new Error("Hasil gambar tidak ditemukan pada respons AI.");
}

async function toDataUrl(url: string): Promise<string> {
  const res = await fetchWithTimeout(url, { headers: authHeaders() }, DOWNLOAD_TIMEOUT_MS);
  if (!res.ok) throw new Error(`Gagal mengunduh hasil AI (${res.status}).`);
  const mime = res.headers.get("content-type")?.split(";")[0] || "image/png";
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

async function callOnce(base: string, endpoint: string, payload: unknown[]): Promise<string> {
  const callUrl = `${base}/gradio_api/call${endpoint}`;
  const createRes = await fetchWithTimeout(
    callUrl,
    {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({ data: payload }),
    },
    POST_TIMEOUT_MS,
  );
  if (!createRes.ok) {
    const detail = await createRes.text().catch(() => "");
    throw new Error(
      createRes.status === 503
        ? "Space AI sedang bangun dari mode sleep. Coba lagi beberapa saat."
        : `Gagal membuat job AI (${createRes.status}). ${detail.slice(0, 160)}`,
    );
  }
  const { event_id: eventId } = (await createRes.json()) as { event_id?: string };
  if (!eventId) throw new Error("Job AI tidak mengembalikan event id.");

  const resultRes = await fetchWithTimeout(
    `${callUrl}/${eventId}`,
    { headers: { accept: "text/event-stream", ...authHeaders() } },
    RESULT_TIMEOUT_MS,
  );
  if (!resultRes.ok) throw new Error(`Gagal mengambil hasil AI (${resultRes.status}).`);
  return extractResultUrl(await resultRes.text());
}

/** Calls a Gradio endpoint with retries (Zero GPU Spaces need cold-start time). */
export async function callGradio(
  base: string,
  endpoint: string,
  payload: unknown[],
  attempts = 3,
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const url = await callOnce(base, endpoint, payload);
      return await toDataUrl(url);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((r) => setTimeout(r, attempt * 4000));
      }
    }
  }
  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new Error("Permintaan ke Space AI timeout. Space mungkin sedang sibuk, coba lagi.");
  }
  throw lastError instanceof Error ? lastError : new Error("Proses AI gagal.");
}

/** Reads and validates the uploaded image from a multipart request. */
export async function readImageUpload(request: Request): Promise<string> {
  return imageFromForm(await request.formData());
}

export async function imageFromForm(form: FormData): Promise<string> {
  const file = form.get("image");
  if (!(file instanceof File)) throw new Error("File gambar tidak ditemukan pada permintaan.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Ukuran file melebihi 10MB.");
  if (!ALLOWED_MIME.includes(file.type)) {
    throw new Error("Format tidak didukung. Gunakan JPG, PNG, atau WEBP.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${file.type};base64,${btoa(binary)}`;
}

export const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** Uploads a file to a Gradio Space and returns its server-side path. */
export async function uploadToSpace(base: string, file: File): Promise<string> {
  const form = new FormData();
  form.append("files", file, file.name);
  const res = await fetchWithTimeout(
    `${base}/gradio_api/upload`,
    { method: "POST", body: form, headers: authHeaders() },
    POST_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`Gagal mengunggah berkas ke Space AI (${res.status}).`);
  const paths = (await res.json()) as string[];
  if (!paths?.[0]) throw new Error("Space AI tidak mengembalikan lokasi berkas.");
  return paths[0];
}

/** Calls a Gradio endpoint and returns the produced file as an ArrayBuffer. */
export async function callGradioFile(
  base: string,
  endpoint: string,
  payload: unknown[],
  attempts = 3,
): Promise<{ bytes: ArrayBuffer; mime: string }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const url = await callOnce(base, endpoint, payload);
      const res = await fetchWithTimeout(url, { headers: authHeaders() }, DOWNLOAD_TIMEOUT_MS);
      if (!res.ok) throw new Error(`Gagal mengunduh hasil (${res.status}).`);
      return {
        bytes: await res.arrayBuffer(),
        mime:
          res.headers.get("content-type")?.split(";")[0] ||
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((r) => setTimeout(r, attempt * 4000));
    }
  }
  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new Error("Permintaan ke Space AI timeout. Space mungkin sedang sibuk, coba lagi.");
  }
  throw lastError instanceof Error ? lastError : new Error("Konversi di Space AI gagal.");
}
