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

export function useCredits(): CreditsInfo {
  const [remaining, setRemaining] = useState<number>(0);
  const [tier, setTier] = useState<Tier>("trial");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: remData, error: remError } = await supabase.rpc("get_remaining_credits");
      if (remError) throw remError;
      setRemaining((remData as number) ?? 0);

      const { data: profData } = await supabase
        .from("profiles")
        .select("tier")
        .maybeSingle();
      const t = (profData?.tier as Tier) ?? "trial";
      setTier(t);
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
      setRemaining((data as number) ?? 0);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengurangi credit.");
      return false;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    remaining,
    tier,
    dailyLimit: TIER_LIMITS[tier],
    loading,
    error,
    refresh,
    deduct,
  };
}
