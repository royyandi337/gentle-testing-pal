import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  // Base64 data URL of the source photo (JPG/PNG/WEBP).
  imageDataUrl: z
    .string()
    .min(32)
    .max(20_000_000)
    .refine((v) => /^data:image\/(png|jpeg|jpg|webp);base64,/.test(v), "Format gambar tidak valid."),
});

/** Frontend → server proxy → Hugging Face Space `/png`. Returns a transparent PNG data URL. */
export const removeBackground = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { removeBackgroundFromDataUrl } = await import("./ai/remove-background.server");
    const pngDataUrl = await removeBackgroundFromDataUrl(data.imageDataUrl);
    return { pngDataUrl };
  });
