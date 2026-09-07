import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SiteSettings = {
  site_name: string;
  site_name_main: string;
  site_name_sub: string;
  site_address: string;
  site_tagline: string;
  logo_data_url: string | null;
  payment_mode: "otomatis" | "manual";
  payment_gateway: string;
  manual_payment_info: string;
  accent_color: string;
};

const DEFAULT_SETTINGS: SiteSettings = {
  site_name: "ROY DIGITAL SOLUTION",
  site_name_main: "ROY DIGITAL",
  site_name_sub: "SOLUTION",
  site_address: "",
  site_tagline: "Solusi digital untuk foto, dokumen, dan kebutuhan kreatif Anda.",
  logo_data_url: null,
  payment_mode: "otomatis",
  payment_gateway: "Midtrans",
  manual_payment_info: "",
  accent_color: "#C79A46",
};

let cached: SiteSettings | null = null;
const listeners = new Set<(s: SiteSettings) => void>();

function notifyAll(settings: SiteSettings) {
  cached = settings;
  for (const fn of listeners) fn(settings);
}

async function fetchSettings(): Promise<SiteSettings> {
  const { data } = await supabase
    .from("site_settings")
    .select("site_name, site_name_main, site_name_sub, site_address, site_tagline, logo_data_url, payment_mode, payment_gateway, manual_payment_info, accent_color")
    .eq("id", true)
    .maybeSingle();
  if (!data) return cached ?? DEFAULT_SETTINGS;
  return {
    site_name: data.site_name || DEFAULT_SETTINGS.site_name,
    site_name_main: data.site_name_main || DEFAULT_SETTINGS.site_name_main,
    site_name_sub: data.site_name_sub || DEFAULT_SETTINGS.site_name_sub,
    site_address: data.site_address || "",
    site_tagline: data.site_tagline || DEFAULT_SETTINGS.site_tagline,
    logo_data_url: data.logo_data_url || null,
    payment_mode: data.payment_mode === "manual" ? "manual" : "otomatis",
    payment_gateway: data.payment_gateway || DEFAULT_SETTINGS.payment_gateway,
    manual_payment_info: data.manual_payment_info || "",
    accent_color: data.accent_color || DEFAULT_SETTINGS.accent_color,
  };
}

/** Force a fresh fetch from the database and update all consumers. */
export async function refreshSiteSettings() {
  const settings = await fetchSettings();
  notifyAll(settings);
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(cached ?? DEFAULT_SETTINGS);

  useEffect(() => {
    let active = true;
    const listener = (s: SiteSettings) => setSettings(s);
    listeners.add(listener);

    if (!cached) {
      fetchSettings().then((s) => {
        if (active) notifyAll(s);
      });
    }

    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, []);

  return settings;
}
