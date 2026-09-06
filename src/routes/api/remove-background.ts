import { createFileRoute } from "@tanstack/react-router";

const SPACE_BASE = "https://roymartine-roy-digital-background-removal.hf.space";

export const Route = createFileRoute("/api/remove-background")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { callGradio, uploadImagePayload, readImageUpload } = await import(
          "@/lib/ai/gradio.server"
        );
        try {
          const file = await readImageUpload(request);
          const payload = await uploadImagePayload(SPACE_BASE, file);
          const image = await callGradio(SPACE_BASE, "/png", [payload]);
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
