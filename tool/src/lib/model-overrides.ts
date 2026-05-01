/**
 * Allowed model overrides for per-phase model pinning.
 * Operators can pin a specific Claude model to any phase before running it.
 * null / "" = use the default model from environment / phase config.
 */
export const ALLOWED_MODEL_OVERRIDES = [
  { value: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { value: "claude-opus-4-7", label: "Opus 4.7" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
] as const;

export const ALLOWED_MODEL_VALUES = ALLOWED_MODEL_OVERRIDES.map((m) => m.value);

export type AllowedModelValue = (typeof ALLOWED_MODEL_OVERRIDES)[number]["value"];
