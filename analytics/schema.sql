CREATE TABLE IF NOT EXISTS visit_events (
    event_id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
    page_path TEXT NOT NULL CHECK (length(page_path) <= 255),
    referrer_origin TEXT CHECK (referrer_origin IS NULL OR length(referrer_origin) <= 255),
    device_category TEXT NOT NULL CHECK (device_category IN ('mobile', 'tablet', 'desktop'))
);

CREATE INDEX IF NOT EXISTS idx_visit_events_created_at
    ON visit_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_visit_events_device_created_at
    ON visit_events (device_category, created_at DESC);
