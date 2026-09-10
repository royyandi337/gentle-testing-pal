import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SPACE_BASE = "https://merterbak-deepseek-ocr-demo.hf.space";
const POST_TIMEOUT_MS = 45_000;
const RESULT_TIMEOUT_MS = 180_000;
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
  const token = Deno.env.get("HUGGINGFACE_TOKEN");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Extract the result array from the Gradio SSE stream.
 * DeepSeek-OCR /run returns 5 outputs:
 *   [0] textbox (plain text / HTML table)
 *   [1] markdown (rendered markdown with embedded images)
 *   [2] textbox (detection references)
 *   [3] image
 *   [4] gallery
 */
function extractResultArray(sse: string): unknown[] {
  for (const chunk of sse.split("\n\n")) {
    const isComplete = /^event:\s*complete/m.test(chunk);
    const isError = /^event:\s*error/m.test(chunk);
    const dataLine = chunk.match(/^data:\s*(.*)$/m)?.[1];
    if (isError) throw new Error(`Space AI error: ${dataLine ?? "unknown"}`);
    if (!isComplete || !dataLine) continue;
    const parsed = JSON.parse(dataLine);
    if (Array.isArray(parsed)) return parsed;
    throw new Error("Unexpected response format from Space AI.");
  }
  throw new Error("Result not found in Space AI response.");
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

async function callGradioOcr(
  payload: unknown[],
  attempts = 4,
): Promise<unknown[]> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const callUrl = `${SPACE_BASE}/gradio_api/call/run`;
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
      return extractResultArray(await resultRes.text());
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((r) => setTimeout(r, attempt * 4000));
      }
    }
  }
  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new Error("Permintaan ke Space AI timeout. Coba lagi.");
  }
  throw lastError instanceof Error ? lastError : new Error("OCR gagal.");
}

/** Strip embedded base64 images from markdown to keep the text clean. */
function cleanMarkdown(md: string): string {
  return md.replace(/!\[[^\]]*\]\(data:image\/[^;]+;base64,[^)]+\)/g, "").trim();
}

/** Convert HTML tables to plain text for the text output. */
function htmlToText(html: string): string {
  return html
    .replace(/<table[^>]*>/g, "\n")
    .replace(/<\/table>/g, "\n")
    .replace(/<tr[^>]*>/g, "")
    .replace(/<\/tr>/g, "\n")
    .replace(/<t[dh][^>]*>/g, " | ")
    .replace(/<\/t[dh]>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+\|/g, " |")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

    const uploadedPath = await uploadToSpace(file);
    const results = await callGradioOcr([
      { path: uploadedPath, meta: { _type: "gradio.FileData" } },
      { path: uploadedPath, meta: { _type: "gradio.FileData" } },
      "📋 Markdown",
      "",
      1,
    ]);

    // outputs: [textbox, markdown, textbox, image, gallery]
    const rawText = typeof results[0] === "string" ? results[0] as string : "";
    const rawMarkdown = typeof results[1] === "string" ? results[1] as string : "";

    const text = rawText ? htmlToText(rawText) : (rawMarkdown ? cleanMarkdown(rawMarkdown) : "");
    const markdown = rawMarkdown ? cleanMarkdown(rawMarkdown) : undefined;

    const { error: dedErr } = await supabase.rpc("deduct_credit", { p_feature_key: "jpg_to_ocr" });
    if (dedErr) console.error("Failed to deduct credit:", dedErr.message);

    return new Response(
      JSON.stringify({ text, markdown, source: file.name }),
      { headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "OCR gagal.";
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
