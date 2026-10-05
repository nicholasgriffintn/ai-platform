CREATE TABLE user_credential (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  kind text NOT NULL,
  user_id integer NOT NULL REFERENCES user(id),
  public_id text,
  provider text,
  external_id text,
  encrypted_value text,
  token_hash text,
  name text DEFAULT 'API Key',
  public_key text,
  counter integer,
  device_type text,
  backed_up integer,
  transports text,
  created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  updated_at text DEFAULT (CURRENT_TIMESTAMP),
  CONSTRAINT user_credential_shape_check CHECK (
    (kind = 'oauth' AND public_id IS NULL AND encrypted_value IS NULL AND token_hash IS NULL AND public_key IS NULL AND counter IS NULL AND device_type IS NULL AND backed_up IS NULL AND transports IS NULL)
    OR (kind = 'api_key' AND public_id IS NOT NULL AND encrypted_value IS NOT NULL AND token_hash IS NOT NULL AND provider IS NULL AND external_id IS NULL AND public_key IS NULL AND counter IS NULL AND device_type IS NULL AND backed_up IS NULL AND transports IS NULL)
    OR (kind = 'passkey' AND external_id IS NOT NULL AND public_key IS NOT NULL AND counter IS NOT NULL AND device_type IS NOT NULL AND backed_up IS NOT NULL AND public_id IS NULL AND provider IS NULL AND encrypted_value IS NULL AND token_hash IS NULL)
  )
);
--> statement-breakpoint
CREATE INDEX user_credential_owner_idx ON user_credential(user_id, kind, created_at);
--> statement-breakpoint
CREATE UNIQUE INDEX user_credential_oauth_identity_idx ON user_credential(provider, external_id) WHERE kind = 'oauth';
--> statement-breakpoint
CREATE UNIQUE INDEX user_credential_api_public_id_idx ON user_credential(public_id) WHERE kind = 'api_key';
--> statement-breakpoint
CREATE UNIQUE INDEX user_credential_api_hash_idx ON user_credential(token_hash) WHERE kind = 'api_key';
--> statement-breakpoint
CREATE UNIQUE INDEX user_credential_passkey_id_idx ON user_credential(external_id) WHERE kind = 'passkey';
--> statement-breakpoint
INSERT INTO user_credential (id, kind, user_id, external_id, public_key, counter, device_type, backed_up, transports, created_at, updated_at)
SELECT id, 'passkey', user_id, credential_id, public_key, counter, device_type, backed_up, transports, created_at, updated_at FROM passkey;
--> statement-breakpoint
INSERT INTO sqlite_sequence (name, seq)
SELECT 'user_credential', COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'passkey'), 0)
WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'user_credential');
--> statement-breakpoint
UPDATE sqlite_sequence SET seq = MAX(seq, COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'passkey'), 0))
WHERE name = 'user_credential';
--> statement-breakpoint
INSERT INTO user_credential (kind, user_id, provider, external_id)
SELECT 'oauth', user_id, provider_id, provider_user_id FROM oauth_account;
--> statement-breakpoint
INSERT INTO user_credential (kind, public_id, user_id, encrypted_value, token_hash, name, created_at, updated_at)
SELECT 'api_key', id, user_id, api_key, hashed_key, name, created_at, updated_at FROM user_api_keys;
--> statement-breakpoint
CREATE TABLE __user_credential_copy_guard (valid integer NOT NULL CHECK (valid = 1));
--> statement-breakpoint
INSERT INTO __user_credential_copy_guard SELECT
  (SELECT count(*) FROM user_credential WHERE kind = 'oauth') = (SELECT count(*) FROM oauth_account)
  AND (SELECT count(*) FROM user_credential WHERE kind = 'api_key') = (SELECT count(*) FROM user_api_keys)
  AND (SELECT count(*) FROM user_credential WHERE kind = 'passkey') = (SELECT count(*) FROM passkey);
--> statement-breakpoint
DROP TABLE passkey;
--> statement-breakpoint
DROP TABLE user_api_keys;
--> statement-breakpoint
DROP TABLE oauth_account;
--> statement-breakpoint
DROP TABLE __user_credential_copy_guard;
