CREATE TABLE entity (
  id TEXT PRIMARY KEY NOT NULL,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('person', 'organisation', 'place', 'product')),
  aliases TEXT NOT NULL DEFAULT '[]',
  wikidata_id TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  mention_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE entity_mention (
  entity_id TEXT NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  story_id TEXT NOT NULL REFERENCES story(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('subject', 'quoted', 'mentioned')),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  mention_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (entity_id, story_id)
);

CREATE INDEX entity_mention_story_idx ON entity_mention (story_id);
CREATE INDEX entity_mention_entity_seen_idx ON entity_mention (entity_id, last_seen_at);

CREATE TABLE quote (
  id TEXT PRIMARY KEY NOT NULL,
  story_id TEXT NOT NULL REFERENCES story(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL REFERENCES article_fact(id) ON DELETE CASCADE,
  outlet_id TEXT NOT NULL,
  speaker TEXT NOT NULL,
  speaker_entity_id TEXT REFERENCES entity(id) ON DELETE SET NULL,
  context TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL,
  verified_at TEXT NOT NULL
);

CREATE INDEX quote_story_idx ON quote (story_id, verified_at);
CREATE INDEX quote_speaker_idx ON quote (speaker_entity_id, verified_at);

CREATE TABLE story_edge (
  from_story_id TEXT NOT NULL REFERENCES story(id) ON DELETE CASCADE,
  to_story_id TEXT NOT NULL REFERENCES story(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('continues', 'background', 'contrast')),
  score REAL NOT NULL,
  created_by TEXT NOT NULL CHECK (created_by IN ('vector', 'entity', 'model')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (from_story_id, to_story_id)
);

CREATE INDEX story_edge_to_idx ON story_edge (to_story_id);
