CREATE TABLE story (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at TEXT NOT NULL,
  last_article_at TEXT NOT NULL,
  closed_at TEXT,
  article_count INTEGER NOT NULL DEFAULT 0,
  outlet_count INTEGER NOT NULL DEFAULT 0,
  primary_topic_key TEXT,
  lead_entity_ids TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 0,
  versioned_at TEXT,
  versioned_article_count INTEGER NOT NULL DEFAULT 0,
  versioned_outlet_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX story_status_last_article_idx ON story (status, last_article_at);

CREATE TABLE article_fact (
  id TEXT PRIMARY KEY NOT NULL,
  url TEXT NOT NULL,
  outlet_id TEXT NOT NULL,
  outlet_name TEXT NOT NULL,
  headline TEXT NOT NULL,
  standfirst TEXT NOT NULL DEFAULT '',
  published_at TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  language TEXT,
  topic_key TEXT,
  story_id TEXT NOT NULL REFERENCES story(id) ON DELETE CASCADE,
  image_url TEXT
);

CREATE INDEX article_fact_story_published_idx ON article_fact (story_id, published_at);
CREATE INDEX article_fact_published_idx ON article_fact (published_at);

CREATE TABLE story_version (
  story_id TEXT NOT NULL REFERENCES story(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  written_at TEXT NOT NULL,
  overview TEXT NOT NULL,
  agreed TEXT NOT NULL,
  disputed TEXT NOT NULL,
  gaps TEXT NOT NULL,
  outlet_angles TEXT NOT NULL,
  article_ids TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (story_id, version)
);

CREATE INDEX story_version_written_idx ON story_version (written_at);

CREATE INDEX resource_source_external_uri_idx ON resource (external_uri)
  WHERE resource_type = 'source' AND external_uri IS NOT NULL;
