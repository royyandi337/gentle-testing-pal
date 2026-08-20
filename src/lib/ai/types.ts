// Provider-agnostic AI contracts. The frontend never talks to an AI vendor
// directly — it calls server functions in src/lib/ai.functions.ts, which are the
// only place where provider credentials are read.

export type AiJobType = "background_removal" | "image_enhancement" | "auto_photo";
export type AiJobStatus = "queued" | "processing" | "completed" | "failed";

export type AiRequest = {
  /** Storage path (bucket/path) of the uploaded source image. */
  inputPath: string;
  jobType: AiJobType;
  options?: Record<string, unknown>;
};

export type AiResult = {
  jobId: string;
  status: AiJobStatus;
  /** Storage path (bucket/path) of the produced image, when completed. */
  outputPath?: string;
  errorMessage?: string;
};

export interface AiImageProvider {
  readonly name: string;
  removeBackground(input: AiRequest): Promise<AiResult>;
  enhanceImage(input: AiRequest): Promise<AiResult>;
  autoPhoto(input: AiRequest): Promise<AiResult>;
}

export const AI_NOT_CONFIGURED =
  "Fitur AI belum aktif. Provider AI akan diintegrasikan pada tahap berikutnya.";
