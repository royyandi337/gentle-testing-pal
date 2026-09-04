import { createFileRoute } from "@tanstack/react-router";

const SPACE_BASE = "https://roymartine-roy-digital-background-removal.hf.space";

export const Route = createFileRoute("/api/remove-background")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { callGradio, fileData, readImageUpload } = await import("@/lib/ai/gradio.server");
        try {
          const dataUrl = await readImageUpload(request);
          const image = await callGradio(SPACE_BASE, "/png", [fileData(dataUrl)]);
          return Response.json({ image });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Hapus background gagal." },
            { status: 502 },
          );
        }
      },
    },
  },
});
