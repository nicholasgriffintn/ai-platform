use rusqlite::{params, Connection, OptionalExtension};

use super::digest::SentActivity;
use super::pause::PauseRange;
use super::samples::{Sample, SampleKind};
use super::settings::ActivitySettings;
use crate::store::Store;

const SAMPLE_RETENTION: i64 = 48 * 3600;
const PAUSE_RETENTION: i64 = 48 * 3600;
const SENT_RETENTION: i64 = 7 * 24 * 3600;

pub fn migrate(connection: &Connection) -> rusqlite::Result<()> {
    connection.execute_batch(
        "CREATE TABLE IF NOT EXISTS activity_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            payload TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS activity_pauses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at INTEGER NOT NULL,
            ends_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS activity_samples (
            kind TEXT NOT NULL,
            key TEXT NOT NULL,
            name TEXT NOT NULL,
            detail TEXT NOT NULL,
            hour INTEGER NOT NULL,
            seconds INTEGER NOT NULL,
            PRIMARY KEY (kind, key, name, detail, hour)
        );
        CREATE TABLE IF NOT EXISTS activity_sent (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sent_at INTEGER NOT NULL,
            payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS activity_sent_by_time ON activity_sent (sent_at DESC);",
    )
}

fn to_text(error: serde_json::Error) -> rusqlite::Error {
    rusqlite::Error::ToSqlConversionFailure(Box::new(error))
}

impl Store {
    pub fn read_activity_settings(&self) -> Result<ActivitySettings, String> {
        self.with_connection(|connection| {
            let payload = connection
                .query_row(
                    "SELECT payload FROM activity_settings WHERE id = 1",
                    [],
                    |row| row.get::<_, String>(0),
                )
                .optional()?;

            Ok(payload
                .and_then(|payload| serde_json::from_str(&payload).ok())
                .unwrap_or_default())
        })
    }

    pub fn save_activity_settings(&self, settings: &ActivitySettings) -> Result<(), String> {
        let payload = serde_json::to_string(settings).map_err(|cause| cause.to_string())?;

        self.with_connection(|connection| {
            connection.execute(
                "INSERT INTO activity_settings (id, payload) VALUES (1, ?1)
                 ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
                params![payload],
            )?;

            Ok(())
        })
    }

    pub fn list_activity_pauses(&self, since: i64) -> Result<Vec<PauseRange>, String> {
        self.with_connection(|connection| {
            connection
                .prepare(
                    "SELECT started_at, ends_at FROM activity_pauses
                     WHERE ends_at IS NULL OR ends_at >= ?1
                     ORDER BY started_at",
                )?
                .query_map(params![since], |row| {
                    Ok(PauseRange {
                        start: row.get(0)?,
                        end: row.get(1)?,
                    })
                })?
                .collect()
        })
    }

    pub fn pause_activity(&self, start: i64, end: Option<i64>) -> Result<(), String> {
        self.with_connection(|connection| {
            connection.execute(
                "UPDATE activity_pauses SET ends_at = ?1
                 WHERE started_at <= ?1 AND (ends_at IS NULL OR ends_at > ?1)",
                params![start],
            )?;
            connection.execute(
                "INSERT INTO activity_pauses (started_at, ends_at) VALUES (?1, ?2)",
                params![start, end],
            )?;

            Ok(())
        })
    }

    pub fn resume_activity(&self, now: i64) -> Result<(), String> {
        self.with_connection(|connection| {
            connection.execute(
                "UPDATE activity_pauses SET ends_at = ?1
                 WHERE started_at <= ?1 AND (ends_at IS NULL OR ends_at > ?1)",
                params![now],
            )?;

            Ok(())
        })
    }

    pub fn add_activity_sample(&self, sample: &Sample) -> Result<(), String> {
        self.with_connection(|connection| {
            connection.execute(
                "INSERT INTO activity_samples (kind, key, name, detail, hour, seconds)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(kind, key, name, detail, hour)
                 DO UPDATE SET seconds = seconds + excluded.seconds",
                params![
                    sample.kind.as_text(),
                    sample.key,
                    sample.name,
                    sample.detail,
                    sample.hour,
                    sample.seconds
                ],
            )?;

            Ok(())
        })
    }

    pub fn list_activity_samples(
        &self,
        kind: SampleKind,
        since: i64,
    ) -> Result<Vec<Sample>, String> {
        self.with_connection(|connection| {
            connection
                .prepare(
                    "SELECT key, name, detail, hour, seconds FROM activity_samples
                     WHERE kind = ?1 AND hour + 3600 > ?2",
                )?
                .query_map(params![kind.as_text(), since], |row| {
                    Ok(Sample {
                        kind,
                        key: row.get(0)?,
                        name: row.get(1)?,
                        detail: row.get(2)?,
                        hour: row.get(3)?,
                        seconds: row.get(4)?,
                    })
                })?
                .collect()
        })
    }

    pub fn record_activity_sent(&self, sent_at: i64, sent: &SentActivity) -> Result<(), String> {
        self.with_connection(|connection| {
            connection.execute(
                "INSERT INTO activity_sent (sent_at, payload) VALUES (?1, ?2)",
                params![sent_at, serde_json::to_string(sent).map_err(to_text)?],
            )?;

            Ok(())
        })
    }

    pub fn list_activity_sent(&self, since: i64) -> Result<Vec<SentActivity>, String> {
        self.with_connection(|connection| {
            let payloads = connection
                .prepare(
                    "SELECT payload FROM activity_sent WHERE sent_at >= ?1 ORDER BY sent_at DESC",
                )?
                .query_map(params![since], |row| row.get::<_, String>(0))?
                .collect::<rusqlite::Result<Vec<_>>>()?;

            Ok(payloads
                .iter()
                .filter_map(|payload| serde_json::from_str(payload).ok())
                .collect())
        })
    }

    pub fn last_activity_sent_at(&self) -> Result<Option<i64>, String> {
        self.with_connection(|connection| {
            connection
                .query_row("SELECT MAX(sent_at) FROM activity_sent", [], |row| {
                    row.get(0)
                })
                .optional()
                .map(Option::flatten)
        })
    }

    pub fn forget_activity(&self) -> Result<(), String> {
        self.with_connection(|connection| {
            connection.execute_batch("DELETE FROM activity_sent; DELETE FROM activity_samples;")
        })
    }

    pub fn prune_activity(&self, now: i64) -> Result<(), String> {
        self.with_connection(|connection| {
            connection.execute(
                "DELETE FROM activity_samples WHERE hour < ?1",
                params![now - SAMPLE_RETENTION],
            )?;
            connection.execute(
                "DELETE FROM activity_pauses WHERE ends_at IS NOT NULL AND ends_at < ?1",
                params![now - PAUSE_RETENTION],
            )?;
            connection.execute(
                "DELETE FROM activity_sent WHERE sent_at < ?1",
                params![now - SENT_RETENTION],
            )?;

            Ok(())
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::activity::digest::ActivityCollection;

    fn store() -> Store {
        Store::open(Connection::open_in_memory().expect("in-memory database")).expect("migrated")
    }

    #[test]
    fn resuming_closes_an_open_pause_so_later_readings_are_kept() {
        let store = store();

        store.pause_activity(100, None).expect("paused");
        store.resume_activity(200).expect("resumed");

        assert_eq!(
            store.list_activity_pauses(0).expect("pauses"),
            vec![PauseRange {
                start: 100,
                end: Some(200)
            }]
        );
    }

    #[test]
    fn a_new_pause_replaces_the_one_already_running() {
        let store = store();

        store.pause_activity(100, Some(10_000)).expect("paused");
        store.pause_activity(300, None).expect("paused again");

        assert_eq!(
            store.list_activity_pauses(0).expect("pauses"),
            vec![
                PauseRange {
                    start: 100,
                    end: Some(300)
                },
                PauseRange {
                    start: 300,
                    end: None
                },
            ]
        );
    }

    #[test]
    fn adds_up_samples_for_the_same_hour() {
        let store = store();
        let sample = Sample {
            kind: SampleKind::App,
            key: "net.imput.helium".to_string(),
            name: "Helium".to_string(),
            detail: String::new(),
            hour: 3600,
            seconds: 30,
        };

        store.add_activity_sample(&sample).expect("sample");
        store.add_activity_sample(&sample).expect("sample");

        let samples = store
            .list_activity_samples(SampleKind::App, 0)
            .expect("samples");

        assert_eq!(samples.len(), 1);
        assert_eq!(samples[0].seconds, 60);
    }

    #[test]
    fn keeps_a_week_of_sent_activity_and_two_days_of_samples() {
        let store = store();
        let now = 30 * 24 * 3600;
        let sent = SentActivity {
            sent_at: "then".to_string(),
            collection: ActivityCollection {
                machine_id: String::new(),
                label: String::new(),
                period_start: String::new(),
                period_end: String::new(),
                sources: Vec::new(),
            },
        };

        store
            .record_activity_sent(now - 8 * 24 * 3600, &sent)
            .expect("old");
        store
            .record_activity_sent(now - 3600, &sent)
            .expect("recent");
        store
            .add_activity_sample(&Sample {
                kind: SampleKind::Track,
                key: "music".to_string(),
                name: "Song".to_string(),
                detail: "Artist".to_string(),
                hour: now - 3 * 24 * 3600,
                seconds: 30,
            })
            .expect("sample");
        store.prune_activity(now).expect("pruned");

        assert_eq!(store.list_activity_sent(0).expect("sent").len(), 1);
        assert!(store
            .list_activity_samples(SampleKind::Track, 0)
            .expect("samples")
            .is_empty());
    }
}
