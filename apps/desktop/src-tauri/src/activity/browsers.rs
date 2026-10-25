use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OpenFlags};
use serde::Serialize;
use serde_json::Value;

const CHROMIUM_EPOCH_OFFSET: i64 = 11_644_473_600;
const MICROS: i64 = 1_000_000;
const VISIT_LIMIT: i64 = 20_000;
const SEARCH_LIMIT: i64 = 50;
const HISTORY_FILES: [&str; 3] = ["History", "History-journal", "History-wal"];

pub struct BrowserKind {
    pub id: &'static str,
    pub name: &'static str,
    data_dir: &'static str,
}

pub const BROWSERS: &[BrowserKind] = &[
    BrowserKind {
        id: "helium",
        name: "Helium",
        data_dir: "net.imput.helium",
    },
    BrowserKind {
        id: "chrome",
        name: "Google Chrome",
        data_dir: "Google/Chrome",
    },
    BrowserKind {
        id: "brave",
        name: "Brave",
        data_dir: "BraveSoftware/Brave-Browser",
    },
    BrowserKind {
        id: "arc",
        name: "Arc",
        data_dir: "Arc/User Data",
    },
    BrowserKind {
        id: "edge",
        name: "Microsoft Edge",
        data_dir: "Microsoft Edge",
    },
    BrowserKind {
        id: "vivaldi",
        name: "Vivaldi",
        data_dir: "Vivaldi",
    },
    BrowserKind {
        id: "chromium",
        name: "Chromium",
        data_dir: "Chromium",
    },
];

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BrowserProfile {
    pub id: String,
    pub name: String,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DetectedBrowser {
    pub id: String,
    pub name: String,
    pub profiles: Vec<BrowserProfile>,
}

pub struct Visit {
    pub url: String,
    pub title: String,
    pub at: i64,
    pub seconds: i64,
}

pub struct Search {
    pub term: String,
    pub at: i64,
}

#[derive(Default)]
pub struct BrowserHistory {
    pub visits: Vec<Visit>,
    pub searches: Vec<Search>,
}

struct HistoryCopy {
    directory: PathBuf,
}

impl Drop for HistoryCopy {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.directory);
    }
}

fn application_support() -> Option<PathBuf> {
    std::env::var_os("HOME").map(|home| PathBuf::from(home).join("Library/Application Support"))
}

fn browser_directory(browser: &BrowserKind) -> Option<PathBuf> {
    application_support().map(|support| support.join(browser.data_dir))
}

pub fn find_browser(id: &str) -> Option<&'static BrowserKind> {
    BROWSERS.iter().find(|browser| browser.id == id)
}

pub fn read_profiles(local_state: &Value) -> Vec<BrowserProfile> {
    let Some(cache) = local_state
        .pointer("/profile/info_cache")
        .and_then(Value::as_object)
    else {
        return Vec::new();
    };
    let mut profiles: Vec<BrowserProfile> = cache
        .iter()
        .filter(|(id, _)| is_profile_directory(id))
        .map(|(id, info)| BrowserProfile {
            id: id.clone(),
            name: info
                .get("name")
                .and_then(Value::as_str)
                .filter(|name| !name.trim().is_empty())
                .unwrap_or(id)
                .to_string(),
        })
        .collect();

    profiles.sort_by(|left, right| left.id.cmp(&right.id));
    profiles
}

fn is_profile_directory(id: &str) -> bool {
    !id.is_empty() && id != "." && id != ".." && !id.contains(['/', '\\'])
}

fn profiles_on_disk(directory: &Path) -> Vec<BrowserProfile> {
    let local_state = std::fs::read_to_string(directory.join("Local State"))
        .ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok());
    let profiles = local_state.as_ref().map(read_profiles).unwrap_or_default();

    if profiles.is_empty() && directory.join("Default/History").is_file() {
        return vec![BrowserProfile {
            id: "Default".to_string(),
            name: "Default".to_string(),
        }];
    }

    profiles
        .into_iter()
        .filter(|profile| directory.join(&profile.id).join("History").is_file())
        .collect()
}

pub fn detect_browsers() -> Vec<DetectedBrowser> {
    BROWSERS
        .iter()
        .filter_map(|browser| {
            let directory = browser_directory(browser)?;
            let profiles = profiles_on_disk(&directory);

            (!profiles.is_empty()).then(|| DetectedBrowser {
                id: browser.id.to_string(),
                name: browser.name.to_string(),
                profiles,
            })
        })
        .collect()
}

pub fn to_chromium_time(unix_seconds: i64) -> i64 {
    (unix_seconds + CHROMIUM_EPOCH_OFFSET) * MICROS
}

pub fn from_chromium_time(chromium: i64) -> i64 {
    chromium / MICROS - CHROMIUM_EPOCH_OFFSET
}

fn copy_history(profile_directory: &Path) -> Result<HistoryCopy, String> {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_nanos())
        .unwrap_or_default();
    let copy = HistoryCopy {
        directory: std::env::temp_dir()
            .join(format!("polychat-history-{}-{nanos}", std::process::id())),
    };

    std::fs::create_dir(&copy.directory).map_err(|cause| cause.to_string())?;

    for file in HISTORY_FILES {
        let source = profile_directory.join(file);

        if source.is_file() {
            std::fs::copy(&source, copy.directory.join(file)).map_err(|cause| cause.to_string())?;
        }
    }

    Ok(copy)
}

pub fn read_history(database: &Path, since: i64) -> Result<BrowserHistory, String> {
    let connection = Connection::open_with_flags(database, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|cause| cause.to_string())?;
    let since = to_chromium_time(since);
    let mut statement = connection
        .prepare(
            "SELECT urls.url, COALESCE(urls.title, ''), visits.visit_time, visits.visit_duration
             FROM visits JOIN urls ON urls.id = visits.url
             WHERE visits.visit_time >= ?1
             ORDER BY visits.visit_time DESC
             LIMIT ?2",
        )
        .map_err(|cause| cause.to_string())?;
    let visits = statement
        .query_map(params![since, VISIT_LIMIT], |row| {
            Ok(Visit {
                url: row.get(0)?,
                title: row.get(1)?,
                at: from_chromium_time(row.get(2)?),
                seconds: row.get::<_, i64>(3)? / MICROS,
            })
        })
        .and_then(|rows| rows.collect::<rusqlite::Result<Vec<_>>>())
        .map_err(|cause| cause.to_string())?;
    let searches = connection
        .prepare(
            "SELECT terms.term, MAX(visits.visit_time)
             FROM keyword_search_terms terms JOIN visits ON visits.url = terms.url_id
             WHERE visits.visit_time >= ?1
             GROUP BY terms.term
             ORDER BY 2 DESC
             LIMIT ?2",
        )
        .and_then(|mut statement| {
            statement
                .query_map(params![since, SEARCH_LIMIT], |row| {
                    Ok(Search {
                        term: row.get(0)?,
                        at: from_chromium_time(row.get(1)?),
                    })
                })?
                .collect::<rusqlite::Result<Vec<_>>>()
        })
        .unwrap_or_default();

    Ok(BrowserHistory { visits, searches })
}

pub fn read_profile_history(
    browser: &BrowserKind,
    profile: &str,
    since: i64,
) -> Result<BrowserHistory, String> {
    let directory =
        browser_directory(browser).ok_or_else(|| "Your home folder is unavailable.".to_string())?;

    if !profiles_on_disk(&directory)
        .iter()
        .any(|known| known.id == profile)
    {
        return Err(format!("{} has no profile called {profile}.", browser.name));
    }

    let copy = copy_history(&directory.join(profile))?;

    read_history(&copy.directory.join("History"), since)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_profile_names_and_skips_directories_that_escape_the_browser_folder() {
        let local_state = serde_json::json!({
            "profile": {
                "info_cache": {
                    "Default": { "name": "Personal" },
                    "Profile 1": { "name": "" },
                    "../Elsewhere": { "name": "Escape" }
                }
            }
        });

        assert_eq!(
            read_profiles(&local_state),
            vec![
                BrowserProfile {
                    id: "Default".to_string(),
                    name: "Personal".to_string()
                },
                BrowserProfile {
                    id: "Profile 1".to_string(),
                    name: "Profile 1".to_string()
                },
            ]
        );
    }

    fn history_fixture(directory: &Path) -> PathBuf {
        let path = directory.join("History");
        let connection = Connection::open(&path).expect("fixture");

        connection
            .execute_batch(
                "CREATE TABLE urls (id INTEGER PRIMARY KEY, url TEXT, title TEXT);
                 CREATE TABLE visits (id INTEGER PRIMARY KEY, url INTEGER, visit_time INTEGER, visit_duration INTEGER);
                 CREATE TABLE keyword_search_terms (keyword_id INTEGER, url_id INTEGER, term TEXT);",
            )
            .expect("schema");
        connection
            .execute_batch(&format!(
                "INSERT INTO urls VALUES (1, 'https://example.com/a', 'Example A');
                 INSERT INTO urls VALUES (2, 'https://search.example/?q=rust', 'rust - Search');
                 INSERT INTO visits VALUES (1, 1, {old}, 0);
                 INSERT INTO visits VALUES (2, 1, {recent}, 90000000);
                 INSERT INTO visits VALUES (3, 2, {recent}, 0);
                 INSERT INTO keyword_search_terms VALUES (1, 2, 'rust');",
                old = to_chromium_time(1_000),
                recent = to_chromium_time(5_000),
            ))
            .expect("rows");

        path
    }

    #[test]
    fn reads_only_visits_since_the_window_opened_with_their_searches() {
        let directory =
            std::env::temp_dir().join(format!("polychat-history-test-{}", std::process::id()));
        std::fs::create_dir_all(&directory).expect("directory");
        let history = read_history(&history_fixture(&directory), 2_000).expect("history");
        let _ = std::fs::remove_dir_all(&directory);

        assert_eq!(history.visits.len(), 2);
        assert!(history.visits.iter().all(|visit| visit.at == 5_000));
        assert_eq!(
            history
                .visits
                .iter()
                .find(|visit| visit.url == "https://example.com/a")
                .map(|visit| visit.seconds),
            Some(90)
        );
        assert_eq!(history.searches.len(), 1);
        assert_eq!(history.searches[0].term, "rust");
    }
}
