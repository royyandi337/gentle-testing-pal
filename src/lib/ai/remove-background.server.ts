// Server-only proxy to the Hugging Face Space that removes image backgrounds.
// The browser never talks to the Space directly.

const SPACE_BASE = "https://roymartine-roy-digital-background-removal.hf.space";
const CALL_URL = `${SPACE_BASE}/gradio_api/call/png`;
const POST_TIMEOUT_MS = 30_000;
const RESULT_TIMEOUT_MS = 120_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;

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
  // Only needed if the Space is private; public Spaces work without a token.
  const token = process.env["HUGGINGFACE_TOKEN"];
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Parses the Gradio SSE stream and returns the URL of the produced PNG. */
function extractResultUrl(sse: string): string {
  const events = sse.split("\n\n");
  for (const chunk of events) {
    const isComplete = /^event:\s*complete/m.test(chunk);
    const isError = /^event:\s*error/m.test(chunk);
    const dataLine = chunk.match(/^data:\s*(.*)$/m)?.[1];
    if (isError) throw new Error(`Gradio error: ${dataLine ?? "unknown"}`);
    if (!isComplete || !dataLine) continue;
    const payload = JSON.parse(dataLine) as Array<{ url?: string } | null>;
    const url = payload?.[0]?.url;
    if (url) return url;
  }
  throw new Error("Hasil PNG tidak ditemukan pada respons AI.");
}

/**
 * Sends a base64 data URL to the Space `/png` endpoint (POST to create the job,
 * GET to read the result) and returns the transparent PNG as a data URL.
 */
export async function removeBackgroundFromDataUrl(dataUrl: string): Promise<string> {
  const createRes = await fetchWithTimeout(
    CALL_URL,
    {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        data: [{ path: null, url: dataUrl, meta: { _type: "gradio.FileData" } }],
      }),
    },
    POST_TIMEOUT_MS,
  );
  if (!createRes.ok) {
    throw new Error(`Gagal membuat job AI (${createRes.status}).`);
  }
  const { event_id: eventId } = (await createRes.json()) as { event_id?: string };
  if (!eventId) throw new Error("Job AI tidak mengembalikan event id.");

  const resultRes = await fetchWithTimeout(
    `${CALL_URL}/${eventId}`,
    { headers: { accept: "text/event-stream", ...authHeaders() } },
    RESULT_TIMEOUT_MS,
  );
  if (!resultRes.ok) throw new Error(`Gagal mengambil hasil AI (${resultRes.status}).`);
  const fileUrl = extractResultUrl(await resultRes.text());

  const fileRes = await fetchWithTimeout(fileUrl, { headers: authHeaders() }, DOWNLOAD_TIMEOUT_MS);
  if (!fileRes.ok) throw new Error(`Gagal mengunduh PNG hasil (${fileRes.status}).`);
  const bytes = new Uint8Array(await fileRes.arrayBuffer());

  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}
