import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SPACE_BASE = "https://roymartine-royupscale.hf.space";
const POST_TIMEOUT_MS = 45_000;
const RESULT_TIMEOUT_MS = 180_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

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
  return {};
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

async function callGradioImage(
  endpoint: string,
  payload: unknown[],
  attempts = 4,
): Promise<{ bytes: ArrayBuffer; mime: string }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
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

      const fileRes = await fetchWithTimeout(fileUrl, { headers: authHeaders() }, DOWNLOAD_TIMEOUT_MS);
      if (!fileRes.ok) throw new Error(`Failed to download result (${fileRes.status}).`);
      return {
        bytes: await fileRes.arrayBuffer(),
        mime: fileRes.headers.get("content-type")?.split(";")[0] || "image/png",
      };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((r) => setTimeout(r, attempt * 4000));
      }
    }
  }
  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new Error("Request to Space AI timed out. Try again.");
  }
  throw lastError instanceof Error ? lastError : new Error("Image enhancement failed.");
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
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { data: remaining, error: remErr } = await supabase.rpc("get_remaining_credits");
    if (remErr) {
      return new Response(JSON.stringify({ error: "Failed to check credits." }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    if ((remaining as number) !== -1 && (remaining as number) <= 0) {
      return new Response(JSON.stringify({ error: "Credit tidak mencukupi. Silakan upgrade ke Premium." }), {
        status: 402,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "Image file not found in request." }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return new Response(JSON.stringify({ error: "Image exceeds 10MB limit." }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return new Response(JSON.stringify({ error: "Unsupported format. Use JPG, PNG, or WEBP." }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const transparentFlag = String(form.get("transparent") ?? "") === "true";
    const backgroundEnhance = !transparentFlag;

    const uploadedPath = await uploadToSpace(file);
    const { bytes, mime } = await callGradioImage("/inference", [
      { path: uploadedPath, meta: { _type: "gradio.FileData" } },
      true,
      backgroundEnhance,
      true,
      2,
      0.5,
    ]);

    const { error: dedErr } = await supabase.rpc("deduct_credit", { p_feature_key: "enhance_image" });
    if (dedErr) console.error("Failed to deduct credit:", dedErr.message);

    return new Response(bytes, {
      headers: { ...corsHeaders, "content-type": mime },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image enhancement failed.";
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
