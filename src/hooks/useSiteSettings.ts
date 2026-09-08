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
  price_weekly: number;
  price_monthly: number;
  price_yearly: number;
  price_weekly_enabled: boolean;
  price_monthly_enabled: boolean;
  price_yearly_enabled: boolean;
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
  price_weekly: 15000,
  price_monthly: 29000,
  price_yearly: 290000,
  price_weekly_enabled: false,
  price_monthly_enabled: true,
  price_yearly_enabled: true,
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
    .select("site_name, site_name_main, site_name_sub, site_address, site_tagline, logo_data_url, payment_mode, payment_gateway, manual_payment_info, accent_color, price_weekly, price_monthly, price_yearly, price_weekly_enabled, price_monthly_enabled, price_yearly_enabled")
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
    price_weekly: data.price_weekly ?? DEFAULT_SETTINGS.price_weekly,
    price_monthly: data.price_monthly ?? DEFAULT_SETTINGS.price_monthly,
    price_yearly: data.price_yearly ?? DEFAULT_SETTINGS.price_yearly,
    price_weekly_enabled: data.price_weekly_enabled ?? false,
    price_monthly_enabled: data.price_monthly_enabled ?? true,
    price_yearly_enabled: data.price_yearly_enabled ?? true,
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
