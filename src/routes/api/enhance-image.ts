import { createFileRoute } from "@tanstack/react-router";

const SPACE_BASE = "https://roymartine-royupscale.hf.space";

export const Route = createFileRoute("/api/enhance-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { callGradio, fileData, readImageUpload } = await import("@/lib/ai/gradio.server");
        try {
          const dataUrl = await readImageUpload(request);
          const image = await callGradio(SPACE_BASE, "/inference", [
            fileData(dataUrl),
            true, // face_align
            true, // background_enhance
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
