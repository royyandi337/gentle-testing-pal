import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    const isNewKey =
      supabaseKey.startsWith("sb_publishable_") || supabaseKey.startsWith("sb_secret_");
    if (isNewKey && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export async function getUserFromRequest(request: Request): Promise<{
  supabase: ReturnType<typeof createClient<Database>>;
  userId: string;
} | null> {
  const SUPABASE_URL = process.env["SUPABASE_URL"];
  const SUPABASE_KEY =
    process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_ANON_KEY"];
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  if (!token || token.split(".").length !== 3) return null;

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_KEY),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;

  return { supabase, userId: data.claims.sub };
}

export async function checkCredit(
  supabase: ReturnType<typeof createClient<Database>>,
): Promise<{ ok: boolean; error?: string }> {
  const { data: remaining, error: remErr } = await supabase.rpc("get_remaining_credits");
  if (remErr) return { ok: false, error: "Gagal memeriksa credit." };
  const remainingCredits = remaining as number;
  // -1 means unlimited (premium tier) — must never be treated as "insufficient".
  if (remainingCredits !== -1 && remainingCredits <= 0) {
    return { ok: false, error: "Credit tidak mencukupi. Silakan upgrade ke Premium." };
  }
  return { ok: true };
}

export async function deductCredit(
  supabase: ReturnType<typeof createClient<Database>>,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("deduct_credit", { amount: 1 });
  return error ? { ok: false, error: "Gagal memotong credit." } : { ok: true };
}
