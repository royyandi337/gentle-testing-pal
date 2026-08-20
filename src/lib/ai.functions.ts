import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const requestSchema = z.object({
  inputPath: z.string().min(1),
  projectId: z.string().uuid().optional(),
  options: z.record(z.unknown()).optional(),
});

const jobSchema = requestSchema.extend({
  jobType: z.enum(["background_removal", "image_enhancement", "auto_photo"]),
});

/**
 * Single entry point for AI image jobs. Records the job in ai_jobs, then hands
 * the work to the configured provider. Provider credentials stay server-side.
 */
export const runAiJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => jobSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { getAiProvider } = await import("./ai/provider.server");
    const provider = getAiProvider();

    const { data: job, error } = await context.supabase
      .from("ai_jobs")
      .insert({
        user_id: context.userId,
        project_id: data.projectId ?? null,
        job_type: data.jobType,
        status: "processing",
        input_path: data.inputPath,
      })
      .select()
      .single();
    if (error) throw error;

    const request = {
      inputPath: data.inputPath,
      jobType: data.jobType,
      ...(data.options ? { options: data.options } : {}),
    };
    const result =
      data.jobType === "background_removal"
        ? await provider.removeBackground(request)
        : data.jobType === "image_enhancement"
          ? await provider.enhanceImage(request)
          : await provider.autoPhoto(request);

    await context.supabase
      .from("ai_jobs")
      .update({
        status: result.status,
        output_path: result.outputPath ?? null,
        error_message: result.errorMessage ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return { ...result, jobId: job.id, provider: provider.name };
  });
