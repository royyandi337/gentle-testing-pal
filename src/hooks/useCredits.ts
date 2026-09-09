import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Tier = "trial" | "regular" | "premium";

type CreditsInfo = {
  remaining: number; // -1 = unlimited
  tier: Tier;
  dailyLimit: number; // -1 = unlimited
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  deduct: (amount: number) => Promise<boolean>;
};

const TIER_LIMITS: Record<Tier, number> = {
  trial: 10,
  regular: 100,
  premium: -1,
};

type CreditsState = {
  remaining: number;
  tier: Tier;
};

/** Module-level shared cache + listeners so every useCredits() instance stays in sync. */
let cached: CreditsState | null = null;
const listeners = new Set<(s: CreditsState) => void>();
let inFlight: Promise<void> | null = null;

function notifyAll(state: CreditsState) {
  cached = state;
  for (const fn of listeners) fn(state);
}

/** Force a fresh fetch from the database and update all consumers. */
export async function refreshCredits(): Promise<void> {
  const { data: remData, error: remError } = await supabase.rpc("get_remaining_credits");
  if (remError) throw remError;

  const { data: profData } = await supabase.from("profiles").select("tier").maybeSingle();

  notifyAll({
    remaining: (remData as number) ?? 0,
    tier: (profData?.tier as Tier) ?? "trial",
  });
}

export function useCredits(): CreditsInfo {
  const [state, setState] = useState<CreditsState>(cached ?? { remaining: 0, tier: "trial" });
  const [loading, setLoading] = useState(cached === null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await refreshCredits();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat credit.");
    } finally {
      setLoading(false);
    }
  }, []);

  const deduct = useCallback(async (amount: number): Promise<boolean> => {
    try {
      const { data, error: dedError } = await supabase.rpc("deduct_credit", { amount });
      if (dedError) throw dedError;
      notifyAll({
        remaining: (data as number) ?? 0,
        tier: cached?.tier ?? "trial",
      });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengurangi credit.");
      return false;
    }
  }, []);

  useEffect(() => {
    const listener = (s: CreditsState) => setState(s);
    listeners.add(listener);
    const realtimeChannel = supabase
      .channel("sidebar-credits-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          void refreshCredits().catch(() => undefined);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "usage_credits" },
        () => {
          void refreshCredits().catch(() => undefined);
        },
      )
      .subscribe();

    if (cached === null) {
      // Deduplicate the initial fetch across simultaneously mounted consumers.
      if (!inFlight) {
        inFlight = refreshCredits()
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "Gagal memuat credit.");
          })
          .finally(() => {
            inFlight = null;
          });
      }
      inFlight.then(() => setLoading(false));
    } else {
      setState(cached);
      setLoading(false);
    }

    return () => {
      listeners.delete(listener);
      void supabase.removeChannel(realtimeChannel);
    };
  }, []);

  return {
    remaining: state.remaining,
    tier: state.tier,
    dailyLimit: TIER_LIMITS[state.tier],
    loading,
    error,
    refresh,
    deduct,
  };
}
