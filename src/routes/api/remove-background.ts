import { createFileRoute } from "@tanstack/react-router";

const SPACE_BASE = "https://roymartine-roy-digital-background-removal.hf.space";

export const Route = createFileRoute("/api/remove-background")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getUserFromRequest, checkCredit, deductCredit } = await import(
          "@/lib/ai/credit-guard.server"
        );
        const { callGradio, uploadImagePayload, readImageUpload } = await import(
          "@/lib/ai/gradio.server"
        );

        try {
          const auth = await getUserFromRequest(request);
          if (!auth) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          const credit = await checkCredit(auth.supabase);
          if (!credit.ok) {
            return Response.json({ error: credit.error }, { status: 402 });
          }

          const file = await readImageUpload(request);
          const payload = await uploadImagePayload(SPACE_BASE, file);
          const image = await callGradio(SPACE_BASE, "/png", [payload]);
          const deduction = await deductCredit(auth.supabase);
          if (!deduction.ok) {
            return Response.json({ error: deduction.error }, { status: 500 });
          }
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
