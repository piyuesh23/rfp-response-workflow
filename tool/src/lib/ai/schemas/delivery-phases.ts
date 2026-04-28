import { z } from "zod";

export const DeliveryPhaseInferenceSchema = z.object({
  phases: z
    .array(
      z.object({
        name: z.string(),
        summary: z.string(),
        scopeBullets: z.array(z.string()),
        targetDurationWeeks: z.number().int().positive().optional(),
        rationale: z.string(),
        mappedTorSections: z.array(z.string()),
      })
    )
    .min(2)
    .max(8),
});

export type DeliveryPhaseInference = z.infer<typeof DeliveryPhaseInferenceSchema>;
