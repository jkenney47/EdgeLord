import type { CaptureMode, LabelSource } from "./api";

export function normalizeLabelSourceForMode(mode: CaptureMode, labelSource: LabelSource): LabelSource {
  if (mode === "replay" && labelSource === "retrospective_hindsight") return "retrospective_replay";
  if (mode === "regular" && labelSource === "retrospective_replay") return "retrospective_hindsight";
  return labelSource;
}
