export const exportVersions = {
  schemaVersion: "trade-events.v1",
  exportVersion: "trade-events-export.v1",
  indicatorCalcVersion: "indicators.v1",
  structureCalcVersion: "structure.v1"
} as const;

export type ExportVersions = typeof exportVersions;
