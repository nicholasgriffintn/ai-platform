ALTER TABLE story_version ADD COLUMN cost_micros INTEGER NOT NULL DEFAULT 0;
ALTER TABLE story_version ADD COLUMN body_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE coverage_daily (
  day TEXT NOT NULL,
  subject_kind TEXT NOT NULL CHECK (subject_kind IN ('topic', 'story')),
  subject_key TEXT NOT NULL,
  outlet_id TEXT NOT NULL,
  outlet_name TEXT NOT NULL,
  article_count INTEGER NOT NULL DEFAULT 0,
  lead_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, subject_kind, subject_key, outlet_id)
);

CREATE INDEX coverage_daily_subject_idx ON coverage_daily (subject_kind, day);

CREATE TABLE term_daily (
  day TEXT NOT NULL,
  term_kind TEXT NOT NULL CHECK (term_kind IN ('entity', 'topic')),
  term_key TEXT NOT NULL,
  term TEXT NOT NULL,
  article_count INTEGER NOT NULL DEFAULT 0,
  story_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, term_kind, term_key)
);

CREATE INDEX term_daily_kind_day_idx ON term_daily (term_kind, day);
