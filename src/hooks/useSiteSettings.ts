import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SiteSettings = {
  site_name: string;
  site_address: string;
  site_tagline: string;
};

const DEFAULT_SETTINGS: SiteSettings = {
  site_name: "ROY DIGITAL SOLUTION",
  site_address: "",
  site_tagline: "Solusi digital untuk foto, dokumen, dan kebutuhan kreatif Anda.",
};

let cached: SiteSettings | null = null;

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(cached ?? DEFAULT_SETTINGS);

  useEffect(() => {
    if (cached) return;
    let active = true;
    supabase
      .from("site_settings")
      .select("site_name, site_address, site_tagline")
      .eq("id", true)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        cached = {
          site_name: data.site_name || DEFAULT_SETTINGS.site_name,
          site_address: data.site_address || "",
          site_tagline: data.site_tagline || DEFAULT_SETTINGS.site_tagline,
        };
        setSettings(cached);
      });
    return () => {
      active = false;
    };
  }, []);

  return settings;
}
