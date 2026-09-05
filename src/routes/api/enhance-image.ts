import { createFileRoute } from "@tanstack/react-router";

const SPACE_BASE = "https://roymartine-royupscale.hf.space";

export const Route = createFileRoute("/api/enhance-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { callGradio, fileData, imageFromForm } = await import("@/lib/ai/gradio.server");
        try {
          const form = await request.formData();
          const dataUrl = await imageFromForm(form);
          // When the input is already a transparent cutout, background restoration
          // would invent a fake background — keep it disabled in that case.
          const transparentFlag = String(form.get("transparent") ?? "") === "true";
          const isPng = dataUrl.startsWith("data:image/png");
          const backgroundEnhance = !(transparentFlag || isPng);
          const image = await callGradio(SPACE_BASE, "/inference", [
            fileData(dataUrl),
            true, // face_align
            backgroundEnhance, // background_enhance
            true, // face_upsample
            2, // upscale
            0.5, // codeformer_fidelity
          ]);
          return Response.json({ image });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Proses enhance gagal." },
            { status: 502 },
          );
        }
      },
    },
  },
});
