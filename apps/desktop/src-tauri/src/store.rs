use std::sync::Mutex;

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::egress::{DesktopEndpoint, EndpointKind, EndpointTransport};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalConversation {
    pub id: String,
    pub account_id: String,
    pub endpoint_id: String,
    pub native_model_id: String,
    pub title: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalMessage {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub status: String,
    pub created_at: String,
}

pub struct Store {
    connection: Mutex<Connection>,
}

fn kind_from_text(value: &str) -> EndpointKind {
    match value {
        "agent" => EndpointKind::Agent,
        _ => EndpointKind::Model,
    }
}

fn kind_to_text(kind: EndpointKind) -> &'static str {
    match kind {
        EndpointKind::Agent => "agent",
        EndpointKind::Model => "model",
    }
}

fn transport_from_text(value: &str) -> EndpointTransport {
    match value {
        "network" => EndpointTransport::Network,
        _ => EndpointTransport::Loopback,
    }
}

fn transport_to_text(transport: EndpointTransport) -> &'static str {
    match transport {
        EndpointTransport::Network => "network",
        EndpointTransport::Loopback => "loopback",
    }
}

impl Store {
    pub fn open(connection: Connection) -> Result<Self, String> {
        let store = Self {
            connection: Mutex::new(connection),
        };

        store.migrate()?;

        Ok(store)
    }

    fn with_connection<T>(
        &self,
        action: impl FnOnce(&Connection) -> rusqlite::Result<T>,
    ) -> Result<T, String> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| "The local database is unavailable.".to_string())?;

        action(&connection).map_err(|cause| cause.to_string())
    }

    fn migrate(&self) -> Result<(), String> {
        self.with_connection(|connection| {
            connection.execute_batch(
                "PRAGMA foreign_keys = ON;
                PRAGMA journal_mode = WAL;
                CREATE TABLE IF NOT EXISTS endpoints (
                    id TEXT PRIMARY KEY,
                    kind TEXT NOT NULL,
                    vendor TEXT NOT NULL,
                    label TEXT NOT NULL,
                    url TEXT NOT NULL,
                    transport TEXT NOT NULL,
                    pairing_secret_stored INTEGER NOT NULL,
                    approved_at TEXT NOT NULL,
                    last_seen_at TEXT
                );
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    account_id TEXT NOT NULL,
                    endpoint_id TEXT NOT NULL,
                    native_model_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS conversations_by_account
                    ON conversations (account_id, updated_at DESC);
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL
                        REFERENCES conversations (id) ON DELETE CASCADE,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'complete',
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS messages_by_conversation
                    ON messages (conversation_id, created_at);
                CREATE TABLE IF NOT EXISTS local_chats (
                    scope TEXT NOT NULL,
                    id TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (scope, id)
                );
                CREATE INDEX IF NOT EXISTS local_chats_by_scope
                    ON local_chats (scope, updated_at DESC);
                CREATE TABLE IF NOT EXISTS announcements (
                    scope TEXT NOT NULL,
                    item_id TEXT NOT NULL,
                    announced_at TEXT NOT NULL,
                    PRIMARY KEY (scope, item_id)
                );
                CREATE INDEX IF NOT EXISTS announcements_by_scope
                    ON announcements (scope, announced_at DESC);",
            )
        })
    }

    pub fn list_endpoints(&self) -> Result<Vec<DesktopEndpoint>, String> {
        self.with_connection(|connection| {
            let mut statement = connection.prepare(
                "SELECT id, kind, vendor, label, url, transport, pairing_secret_stored,
                        approved_at, last_seen_at
                 FROM endpoints
                 ORDER BY approved_at, id",
            )?;

            let rows = statement.query_map([], |row| {
                Ok(DesktopEndpoint {
                    id: row.get(0)?,
                    kind: kind_from_text(&row.get::<_, String>(1)?),
                    vendor: row.get(2)?,
                    label: row.get(3)?,
                    url: row.get(4)?,
                    transport: transport_from_text(&row.get::<_, String>(5)?),
                    pairing_secret_stored: row.get::<_, i64>(6)? != 0,
                    approved_at: row.get(7)?,
                    last_seen_at: row.get(8)?,
                })
            })?;

            rows.collect()
        })
    }

    pub fn save_endpoint(&self, endpoint: &DesktopEndpoint) -> Result<(), String> {
        self.with_connection(|connection| {
            connection.execute(
                "INSERT INTO endpoints (id, kind, vendor, label, url, transport,
                                        pairing_secret_stored, approved_at, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                 ON CONFLICT(id) DO UPDATE SET
                    kind = excluded.kind,
                    vendor = excluded.vendor,
                    label = excluded.label,
                    url = excluded.url,
                    transport = excluded.transport,
                    pairing_secret_stored = excluded.pairing_secret_stored,
                    last_seen_at = excluded.last_seen_at",
                params![
                    endpoint.id,
                    kind_to_text(endpoint.kind),
                    endpoint.vendor,
                    endpoint.label,
                    endpoint.url,
                    transport_to_text(endpoint.transport),
                    i64::from(endpoint.pairing_secret_stored),
                    endpoint.approved_at,
                    endpoint.last_seen_at,
                ],
            )?;

            Ok(())
        })
    }

    pub fn forget_endpoint(&self, endpoint_id: &str) -> Result<(), String> {
        self.with_connection(|connection| {
            connection.execute("DELETE FROM endpoints WHERE id = ?1", params![endpoint_id])?;

            Ok(())
        })
    }

    pub fn save_conversation(&self, conversation: &LocalConversation) -> Result<(), String> {
        self.with_connection(|connection| {
            connection.execute(
                "INSERT INTO conversations (id, account_id, endpoint_id, native_model_id,
                                            title, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    updated_at = excluded.updated_at",
                params![
                    conversation.id,
                    conversation.account_id,
                    conversation.endpoint_id,
                    conversation.native_model_id,
                    conversation.title,
                    conversation.updated_at,
                ],
            )?;

            Ok(())
        })
    }

    pub fn list_conversations(&self, account_id: &str) -> Result<Vec<LocalConversation>, String> {
        self.with_connection(|connection| {
            let mut statement = connection.prepare(
                "SELECT id, account_id, endpoint_id, native_model_id, title, updated_at
                 FROM conversations
                 WHERE account_id = ?1
                 ORDER BY updated_at DESC, id",
            )?;

            let rows = statement.query_map(params![account_id], |row| {
                Ok(LocalConversation {
                    id: row.get(0)?,
                    account_id: row.get(1)?,
                    endpoint_id: row.get(2)?,
                    native_model_id: row.get(3)?,
                    title: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })?;

            rows.collect()
        })
    }

    pub fn append_message(&self, message: &LocalMessage) -> Result<(), String> {
        self.with_connection(|connection| {
            connection.execute(
                "INSERT INTO messages (id, conversation_id, role, content, status, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    message.id,
                    message.conversation_id,
                    message.role,
                    message.content,
                    message.status,
                    message.created_at,
                ],
            )?;
            connection.execute(
                "UPDATE conversations SET updated_at = ?2 WHERE id = ?1",
                params![message.conversation_id, message.created_at],
            )?;

            Ok(())
        })
    }

    pub fn list_messages(&self, conversation_id: &str) -> Result<Vec<LocalMessage>, String> {
        self.with_connection(|connection| {
            let mut statement = connection.prepare(
                "SELECT id, conversation_id, role, content, status, created_at
                 FROM messages
                 WHERE conversation_id = ?1
                 ORDER BY created_at, id",
            )?;

            let rows = statement.query_map(params![conversation_id], |row| {
                Ok(LocalMessage {
                    id: row.get(0)?,
                    conversation_id: row.get(1)?,
                    role: row.get(2)?,
                    content: row.get(3)?,
                    status: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })?;

            rows.collect()
        })
    }

    pub fn save_local_chat(
        &self,
        scope: &str,
        id: &str,
        payload: &str,
        updated_at: &str,
    ) -> Result<(), String> {
        self.with_connection(|connection| {
            connection.execute(
                "INSERT INTO local_chats (scope, id, payload, updated_at)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT (scope, id) DO UPDATE SET
                    payload = excluded.payload,
                    updated_at = excluded.updated_at",
                params![scope, id, payload, updated_at],
            )?;

            Ok(())
        })
    }

    pub fn list_local_chats(&self, scope: &str) -> Result<Vec<String>, String> {
        self.with_connection(|connection| {
            let mut statement = connection.prepare(
                "SELECT payload FROM local_chats WHERE scope = ?1 ORDER BY updated_at DESC",
            )?;
            let rows = statement.query_map(params![scope], |row| row.get::<_, String>(0))?;

            rows.collect()
        })
    }

    pub fn delete_local_chat(&self, scope: &str, id: &str) -> Result<(), String> {
        self.with_connection(|connection| {
            connection.execute(
                "DELETE FROM local_chats WHERE scope = ?1 AND id = ?2",
                params![scope, id],
            )?;

            Ok(())
        })
    }

    pub fn delete_all_local_chats(&self, scope: &str) -> Result<(), String> {
        self.with_connection(|connection| {
            connection.execute("DELETE FROM local_chats WHERE scope = ?1", params![scope])?;

            Ok(())
        })
    }

    pub fn unshown(&self, scope: &str, item_ids: &[String]) -> Result<Vec<String>, String> {
        self.with_connection(|connection| {
            let mut statement =
                connection.prepare("SELECT 1 FROM announcements WHERE scope = ?1 AND item_id = ?2")?;
            let mut unseen = Vec::new();

            for item_id in item_ids {
                if !statement.exists(params![scope, item_id])? {
                    unseen.push(item_id.clone());
                }
            }

            Ok(unseen)
        })
    }

    pub fn record_shown(
        &self,
        scope: &str,
        item_ids: &[String],
        announced_at: &str,
    ) -> Result<(), String> {
        self.with_connection(|connection| {
            let mut statement = connection.prepare(
                "INSERT INTO announcements (scope, item_id, announced_at)
                 VALUES (?1, ?2, ?3)
                 ON CONFLICT(scope, item_id) DO NOTHING",
            )?;

            for item_id in item_ids {
                statement.execute(params![scope, item_id, announced_at])?;
            }

            Ok(())
        })
    }

    pub fn forget_shown(&self, scope: &str, keep: usize) -> Result<(), String> {
        self.with_connection(|connection| {
            connection.execute(
                "DELETE FROM announcements
                 WHERE scope = ?1
                   AND item_id NOT IN (
                     SELECT item_id FROM announcements
                     WHERE scope = ?1
                     ORDER BY announced_at DESC
                     LIMIT ?2
                   )",
                params![scope, keep as i64],
            )?;

            Ok(())
        })
    }

    pub fn seed_missing(&self, endpoints: &[DesktopEndpoint]) -> Result<(), String> {
        self.with_connection(|connection| {
            for endpoint in endpoints {
                connection.execute(
                    "INSERT OR IGNORE INTO endpoints (id, kind, vendor, label, url, transport,
                                                      pairing_secret_stored, approved_at, last_seen_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![
                        endpoint.id,
                        kind_to_text(endpoint.kind),
                        endpoint.vendor,
                        endpoint.label,
                        endpoint.url,
                        transport_to_text(endpoint.transport),
                        i64::from(endpoint.pairing_secret_stored),
                        endpoint.approved_at,
                        endpoint.last_seen_at,
                    ],
                )?;
            }

            Ok(())
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SIGNED_OUT_ACCOUNT: &str = "device-only";

    fn store() -> Store {
        Store::open(Connection::open_in_memory().expect("in-memory database")).expect("migrated")
    }

    fn endpoint(id: &str, label: &str) -> DesktopEndpoint {
        DesktopEndpoint {
            id: id.to_string(),
            kind: EndpointKind::Model,
            vendor: "ollama".to_string(),
            label: label.to_string(),
            url: "http://127.0.0.1:11434".to_string(),
            transport: EndpointTransport::Loopback,
            pairing_secret_stored: false,
            approved_at: "2026-09-06T09:00:00Z".to_string(),
            last_seen_at: None,
        }
    }

    #[test]
    fn returns_saved_endpoints_with_their_fields_intact() {
        let store = store();
        let mut agent = endpoint("gateway", "Home gateway");
        agent.kind = EndpointKind::Agent;
        agent.transport = EndpointTransport::Network;
        agent.pairing_secret_stored = true;
        agent.url = "http://10.0.0.4:18789".to_string();

        store.save_endpoint(&agent).expect("saved");
        let saved = store.list_endpoints().expect("listed");

        assert_eq!(saved.len(), 1);
        assert_eq!(saved[0].kind, EndpointKind::Agent);
        assert_eq!(saved[0].transport, EndpointTransport::Network);
        assert!(saved[0].pairing_secret_stored);
        assert_eq!(saved[0].url, "http://10.0.0.4:18789");
    }

    #[test]
    fn seeding_twice_does_not_duplicate_or_overwrite() {
        let store = store();
        let built_ins = vec![endpoint("ollama-loopback", "Ollama")];

        store.seed_missing(&built_ins).expect("seeded");
        store
            .save_endpoint(&endpoint("ollama-loopback", "Renamed by the user"))
            .expect("renamed");
        store.seed_missing(&built_ins).expect("seeded again");

        let saved = store.list_endpoints().expect("listed");

        assert_eq!(saved.len(), 1);
        assert_eq!(saved[0].label, "Renamed by the user");
    }

    #[test]
    fn saving_the_same_endpoint_again_updates_it_rather_than_failing() {
        let store = store();

        store.save_endpoint(&endpoint("a", "First")).expect("saved");
        store
            .save_endpoint(&endpoint("a", "Second"))
            .expect("saved");

        let saved = store.list_endpoints().expect("listed");

        assert_eq!(saved.len(), 1);
        assert_eq!(saved[0].label, "Second");
    }

    fn conversation(id: &str, account_id: &str) -> LocalConversation {
        LocalConversation {
            id: id.to_string(),
            account_id: account_id.to_string(),
            endpoint_id: "ollama-loopback".to_string(),
            native_model_id: "gpt-oss:20b".to_string(),
            title: "Untitled".to_string(),
            updated_at: "2026-09-06T09:00:00Z".to_string(),
        }
    }

    fn message(id: &str, conversation_id: &str, role: &str, created_at: &str) -> LocalMessage {
        LocalMessage {
            id: id.to_string(),
            conversation_id: conversation_id.to_string(),
            role: role.to_string(),
            content: format!("content of {id}"),
            status: "complete".to_string(),
            created_at: created_at.to_string(),
        }
    }

    #[test]
    fn never_shows_one_accounts_conversations_to_another() {
        let store = store();

        store
            .save_conversation(&conversation("a", "account-1"))
            .expect("saved");
        store
            .save_conversation(&conversation("b", "account-2"))
            .expect("saved");
        store
            .save_conversation(&conversation("c", SIGNED_OUT_ACCOUNT))
            .expect("saved");

        let first = store.list_conversations("account-1").expect("listed");
        let signed_out = store
            .list_conversations(SIGNED_OUT_ACCOUNT)
            .expect("listed");

        assert_eq!(first.len(), 1);
        assert_eq!(first[0].id, "a");
        assert_eq!(signed_out.len(), 1);
        assert_eq!(signed_out[0].id, "c");
    }

    #[test]
    fn returns_messages_in_the_order_they_were_written() {
        let store = store();

        store
            .save_conversation(&conversation("a", "account-1"))
            .expect("saved");
        store
            .append_message(&message("m1", "a", "user", "2026-09-06T09:00:00Z"))
            .expect("appended");
        store
            .append_message(&message("m2", "a", "assistant", "2026-09-06T09:00:01Z"))
            .expect("appended");

        let messages = store.list_messages("a").expect("listed");

        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].role, "user");
        assert_eq!(messages[1].role, "assistant");
    }

    #[test]
    fn appending_a_message_moves_its_conversation_to_the_front() {
        let store = store();

        store
            .save_conversation(&conversation("older", "account-1"))
            .expect("saved");
        store
            .save_conversation(&conversation("newer", "account-1"))
            .expect("saved");
        store
            .append_message(&message("m1", "older", "user", "2026-09-06T10:00:00Z"))
            .expect("appended");

        let listed = store.list_conversations("account-1").expect("listed");

        assert_eq!(listed[0].id, "older");
    }

    #[test]
    fn keeps_an_interrupted_reply_marked_as_interrupted() {
        let store = store();

        store
            .save_conversation(&conversation("a", "account-1"))
            .expect("saved");

        let mut stopped = message("m1", "a", "assistant", "2026-09-06T09:00:00Z");
        stopped.status = "interrupted".to_string();

        store.append_message(&stopped).expect("appended");

        let messages = store.list_messages("a").expect("listed");

        assert_eq!(messages[0].status, "interrupted");
    }

    #[test]
    fn keeps_messages_out_of_conversations_that_did_not_produce_them() {
        let store = store();

        store
            .save_conversation(&conversation("a", "account-1"))
            .expect("saved");
        store
            .save_conversation(&conversation("b", "account-1"))
            .expect("saved");
        store
            .append_message(&message("m1", "a", "user", "2026-09-06T09:00:00Z"))
            .expect("appended");

        assert_eq!(store.list_messages("b").expect("listed").len(), 0);
    }

    #[test]
    fn keeps_one_scopes_local_chats_away_from_another() {
        let store = store();

        store
            .save_local_chat(
                "user-1",
                "chat-1",
                "{\"id\":\"chat-1\"}",
                "2026-01-01T00:00:00Z",
            )
            .expect("saved");
        store
            .save_local_chat(
                "user-2",
                "chat-2",
                "{\"id\":\"chat-2\"}",
                "2026-01-02T00:00:00Z",
            )
            .expect("saved");

        assert_eq!(
            store.list_local_chats("user-1").expect("listed"),
            vec!["{\"id\":\"chat-1\"}".to_string()]
        );

        store.delete_all_local_chats("user-1").expect("cleared");

        assert!(store.list_local_chats("user-1").expect("listed").is_empty());
        assert_eq!(store.list_local_chats("user-2").expect("listed").len(), 1);
    }

    #[test]
    fn saving_a_local_chat_again_replaces_its_payload() {
        let store = store();

        store
            .save_local_chat(
                "user-1",
                "chat-1",
                "{\"title\":\"first\"}",
                "2026-01-01T00:00:00Z",
            )
            .expect("saved");
        store
            .save_local_chat(
                "user-1",
                "chat-1",
                "{\"title\":\"second\"}",
                "2026-01-03T00:00:00Z",
            )
            .expect("saved");

        assert_eq!(
            store.list_local_chats("user-1").expect("listed"),
            vec!["{\"title\":\"second\"}".to_string()]
        );

        store
            .delete_local_chat("user-1", "chat-1")
            .expect("deleted");

        assert!(store.list_local_chats("user-1").expect("listed").is_empty());
    }

    #[test]
    fn shows_an_item_once_on_this_device_and_keeps_scopes_apart() {
        let store = store();
        let items = vec!["task-1".to_string(), "task-2".to_string()];

        assert_eq!(store.unshown("user-1", &items).expect("read"), items);

        store
            .record_shown("user-1", &["task-1".to_string()], "2026-09-07T09:00:00Z")
            .expect("recorded");

        assert_eq!(
            store.unshown("user-1", &items).expect("read"),
            vec!["task-2".to_string()]
        );
        assert_eq!(store.unshown("user-2", &items).expect("read"), items);
    }

    #[test]
    fn recording_the_same_item_twice_does_not_fail() {
        let store = store();
        let items = vec!["task-1".to_string()];

        store
            .record_shown("user-1", &items, "2026-09-07T09:00:00Z")
            .expect("recorded");
        store
            .record_shown("user-1", &items, "2026-09-07T10:00:00Z")
            .expect("recorded again");

        assert!(store.unshown("user-1", &items).expect("read").is_empty());
    }

    #[test]
    fn forgets_the_oldest_shown_items_beyond_the_kept_window() {
        let store = store();

        for index in 0..5 {
            store
                .record_shown(
                    "user-1",
                    &[format!("task-{index}")],
                    &format!("2026-09-0{}T09:00:00Z", index + 1),
                )
                .expect("recorded");
        }

        store.forget_shown("user-1", 2).expect("trimmed");

        let all: Vec<String> = (0..5).map(|index| format!("task-{index}")).collect();

        assert_eq!(
            store.unshown("user-1", &all).expect("read"),
            vec![
                "task-0".to_string(),
                "task-1".to_string(),
                "task-2".to_string()
            ]
        );
    }

    #[test]
    fn forgetting_an_endpoint_removes_only_that_one() {
        let store = store();

        store.save_endpoint(&endpoint("a", "Keep")).expect("saved");
        store.save_endpoint(&endpoint("b", "Drop")).expect("saved");
        store.forget_endpoint("b").expect("forgotten");

        let saved = store.list_endpoints().expect("listed");

        assert_eq!(saved.len(), 1);
        assert_eq!(saved[0].id, "a");
    }
}
