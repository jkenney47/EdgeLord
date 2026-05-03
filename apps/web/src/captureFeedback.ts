import type { LabelAction } from "./api";

export function captureFeedback(action: LabelAction, shouldAdvance: boolean): string {
  if (action === "EXIT") {
    return shouldAdvance
      ? "EXIT saved; trade closed; advanced for SKIP/ENTRY review."
      : "EXIT saved; trade closed. Next collect SKIP/ENTRY decisions.";
  }
  if (action === "ENTRY") {
    return shouldAdvance
      ? "ENTRY saved; advanced to review the open trade."
      : "ENTRY saved; review forward until the exit.";
  }
  if (action === "SKIP") {
    return shouldAdvance
      ? "SKIP saved; advanced to next decision."
      : "SKIP saved.";
  }
  return shouldAdvance ? "INVALID saved; advanced." : "INVALID saved.";
}
