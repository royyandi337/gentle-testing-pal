// Server-only AI provider registry. Swap the active provider here when a real
// vendor is wired up; the rest of the app keeps using the AiImageProvider shape.
import { AI_NOT_CONFIGURED, type AiImageProvider, type AiRequest, type AiResult } from "./types";

function unavailable(input: AiRequest): AiResult {
  return {
    jobId: "",
    status: "failed",
    errorMessage: `${AI_NOT_CONFIGURED} (${input.jobType})`,
  };
}

/** Placeholder provider — no fake processing, it reports "not configured". */
const notConfiguredProvider: AiImageProvider = {
  name: "not-configured",
  async removeBackground(input) {
    return unavailable(input);
  },
  async enhanceImage(input) {
    return unavailable(input);
  },
  async autoPhoto(input) {
    return unavailable(input);
  },
};

export function getAiProvider(): AiImageProvider {
  // Example for the next phase:
  // if (process.env['AI_PROVIDER'] === 'replicate') return createReplicateProvider(process.env['REPLICATE_API_TOKEN']!)
  return notConfiguredProvider;
}
