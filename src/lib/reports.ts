export const REPORT_REASONS = [
  "Spam or misleading",
  "Hateful or abusive content",
  "Harassment or bullying",
  "Violent or dangerous acts",
  "Sexual content",
  "Child safety",
  "Infringes my rights",
  "Other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export function isReportReason(value: unknown): value is ReportReason {
  return (
    typeof value === "string" &&
    (REPORT_REASONS as readonly string[]).includes(value)
  );
}
