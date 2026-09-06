import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SPACE_BASE = "https://itsvilen-pdf-to-word.hf.space";
const POST_TIMEOUT_MS = 45_000;
const RESULT_TIMEOUT_MS = 180_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

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
  const token = Deno.env.get("HUGGINGFACE_TOKEN");
  return token ? { Authorization: `Bearer ${token}` } : {};
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

function extractResultUrl(sse: string): string {
  for (const chunk of sse.split("\n\n")) {
    const isComplete = /^event:\s*complete/m.test(chunk);
    const isError = /^event:\s*error/m.test(chunk);
    const dataLine = chunk.match(/^data:\s*(.*)$/m)?.[1];
    if (isError) throw new Error(`Space AI error: ${dataLine ?? "unknown"}`);
    if (!isComplete || !dataLine) continue;
    const url = findUrl(JSON.parse(dataLine));
    if (url) return url;
  }
  throw new Error("Result URL not found in Space AI response.");
}

async function uploadToSpace(file: File): Promise<string> {
  const form = new FormData();
  form.append("files", file, file.name);
  const res = await fetchWithTimeout(
    `${SPACE_BASE}/gradio_api/upload`,
    { method: "POST", body: form, headers: authHeaders() },
    POST_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`Failed to upload to Space (${res.status}).`);
  const paths = (await res.json()) as string[];
  if (!paths?.[0]) throw new Error("Space did not return file path.");
  return paths[0];
}

async function callGradioFile(
  endpoint: string,
  payload: unknown[],
): Promise<{ bytes: ArrayBuffer; mime: string }> {
  const callUrl = `${SPACE_BASE}/gradio_api/call${endpoint}`;
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
        ? "Space AI is waking up. Try again shortly."
        : `Failed to create job (${createRes.status}). ${detail.slice(0, 160)}`,
    );
  }
  const { event_id: eventId } = (await createRes.json()) as { event_id?: string };
  if (!eventId) throw new Error("No event id returned.");

  const resultRes = await fetchWithTimeout(
    `${callUrl}/${eventId}`,
    { headers: { accept: "text/event-stream", ...authHeaders() } },
    RESULT_TIMEOUT_MS,
  );
  if (!resultRes.ok) throw new Error(`Failed to get result (${resultRes.status}).`);
  const fileUrl = extractResultUrl(await resultRes.text());

  const fileRes = await fetchWithTimeout(
    fileUrl,
    { headers: authHeaders() },
    DOWNLOAD_TIMEOUT_MS,
  );
  if (!fileRes.ok) throw new Error(`Failed to download result (${fileRes.status}).`);
  return {
    bytes: await fileRes.arrayBuffer(),
    mime:
      fileRes.headers.get("content-type")?.split(";")[0] ||
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
}

function arrayBufferToBase64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < arr.length; i += CHUNK) {
    binary += String.fromCharCode(...arr.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return new Response(JSON.stringify({ error: "Server config error." }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Check credits before processing
    const { data: remaining, error: remErr } = await supabase.rpc("get_remaining_credits");
    if (remErr) {
      return new Response(JSON.stringify({ error: "Failed to check credits." }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    if ((remaining as number) <= 0) {
      return new Response(JSON.stringify({ error: "Insufficient credits" }), {
        status: 402,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Get the PDF file
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "PDF file not found in request." }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    if (file.size > MAX_PDF_BYTES) {
      return new Response(JSON.stringify({ error: "PDF exceeds 20MB limit." }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Upload to Space and call the conversion endpoint
    const uploadedPath = await uploadToSpace(file);
    const { bytes, mime } = await callGradioFile("/convert", [
      { path: uploadedPath, meta: { _type: "gradio.FileData" } },
    ]);

    // Deduct credit after successful conversion
    const { error: dedErr } = await supabase.rpc("deduct_credit", { amount: 1 });
    if (dedErr) {
      // Log but don't fail — the conversion already succeeded
      console.error("Failed to deduct credit:", dedErr.message);
    }

    const base64 = arrayBufferToBase64(bytes);
    const fileName = `${file.name.replace(/\.[^.]+$/, "")}.docx`;

    return new Response(
      JSON.stringify({ filename: fileName, mime, base64 }),
      { headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF to Word conversion failed.";
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
