// Lifecycle configuration — Story 3.7
// Thresholds are configurable via environment variables.
// Defaults: stale raw = 30 days, stale validated = 90 days, archive rejected = 180 days.

export const LIFECYCLE_CONFIG = {
  STALE_RAW_DAYS: parseInt(process.env['STALE_RAW_DAYS'] ?? '30', 10),
  STALE_VALIDATED_DAYS: parseInt(process.env['STALE_VALIDATED_DAYS'] ?? '90', 10),
  ARCHIVE_REJECTED_DAYS: parseInt(process.env['ARCHIVE_REJECTED_DAYS'] ?? '180', 10),
} as const;
