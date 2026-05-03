import type { CaptureMode, LabelSource } from "./api";

export function normalizeLabelSourceForMode(mode: CaptureMode, labelSource: LabelSource): LabelSource {
  if (mode === "replay" && labelSource === "retrospective_hindsight") return "retrospective_replay";
  return labelSource;
}
