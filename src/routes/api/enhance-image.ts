import { createFileRoute } from "@tanstack/react-router";

const SPACE_BASE = "https://roymartine-royupscale.hf.space";

export const Route = createFileRoute("/api/enhance-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getUserFromRequest, checkCredit, deductCredit } = await import(
          "@/lib/ai/credit-guard.server"
        );
        const { callGradio, uploadImagePayload, imageFromForm } = await import(
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

          const form = await request.formData();
          const file = await imageFromForm(form);
          const transparentFlag = String(form.get("transparent") ?? "") === "true";
          const backgroundEnhance = !transparentFlag;
          const payload = await uploadImagePayload(SPACE_BASE, file);
          const image = await callGradio(SPACE_BASE, "/inference", [
            payload,
            true,
            backgroundEnhance,
            true,
            2,
            0.5,
          ]);
          const deduction = await deductCredit(auth.supabase);
          if (!deduction.ok) {
            return Response.json({ error: deduction.error }, { status: 500 });
          }
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
