use super::agents::{digest_agents, read_claude_sessions, read_codex_sessions};
use super::browsers::{find_browser, read_profile_history, BrowserHistory};
use super::browsing::{digest_browsing, pick_pages};
use super::digest::{
    ActivityCollection, ActivityDigest, DigestEntry, DigestItem, ReadingWindow, ENTRY_LIMIT,
    LINE_LIMIT,
};
use super::mac::computer_name;
use super::pause::active_pause;
use super::samples::{digest_apps, digest_music, SampleKind};
use super::settings::{ActivitySettings, BrowsingSettings};
use crate::clock::rfc3339;
use crate::store::Store;
use crate::text::clip;

pub const WINDOW_SECONDS: i64 = 24 * 3600;
const LABEL_LENGTH: usize = 120;

fn digest(
    source: &str,
    mut items: Vec<DigestItem>,
    mut entries: Vec<DigestEntry>,
) -> ActivityDigest {
    items.truncate(LINE_LIMIT);
    entries.truncate(ENTRY_LIMIT);

    ActivityDigest {
        source: source.to_string(),
        items,
        entries,
    }
}

fn read_browsing(settings: &BrowsingSettings, since: i64) -> BrowserHistory {
    let mut history = BrowserHistory::default();

    for selection in &settings.browsers {
        let Some(browser) = find_browser(&selection.browser) else {
            continue;
        };

        for profile in &selection.profiles {
            match read_profile_history(browser, profile, since) {
                Ok(read) => {
                    history.visits.extend(read.visits);
                    history.searches.extend(read.searches);
                    history.search_pages.extend(read.search_pages);
                }
                Err(error) => eprintln!("{} history could not be read: {error}", browser.name),
            }
        }
    }

    history
        .searches
        .sort_by_key(|search| std::cmp::Reverse(search.at));
    history
}

fn collect_sources(
    store: &Store,
    settings: &ActivitySettings,
    window: &ReadingWindow<'_>,
) -> Result<Vec<ActivityDigest>, String> {
    let mut sources = Vec::new();
    let sharing = settings.sharing();

    if sharing.contains(&"browsing") {
        let history = read_browsing(&settings.browsing, window.start);

        sources.push(digest(
            "browsing",
            digest_browsing(
                &history.visits,
                &history.searches,
                window,
                &settings.browsing,
                &settings.never_share.domains,
            ),
            if settings.browsing.titles {
                pick_pages(
                    &history.visits,
                    &history.search_pages,
                    window,
                    &settings.never_share.domains,
                )
            } else {
                Vec::new()
            },
        ));
    }

    if sharing.contains(&"agents") {
        let mut sessions = Vec::new();

        if settings.agents.claude_code {
            sessions.extend(read_claude_sessions(window));
        }

        if settings.agents.codex {
            sessions.extend(read_codex_sessions(window));
        }

        let agents = digest_agents(sessions, &settings.agents, &settings.never_share.projects);

        sources.push(digest("agents", agents.items, agents.entries));
    }

    if sharing.contains(&"apps") {
        sources.push(digest(
            "apps",
            digest_apps(
                &store.list_activity_samples(SampleKind::App, window.start)?,
                &settings.apps,
                &settings.never_share.apps,
            ),
            Vec::new(),
        ));
    }

    if sharing.contains(&"music") {
        sources.push(digest(
            "music",
            digest_music(
                &store.list_activity_samples(SampleKind::Track, window.start)?,
                &settings.music,
            ),
            Vec::new(),
        ));
    }

    Ok(sources)
}

pub fn collect(store: &Store, now: i64) -> Result<Option<ActivityCollection>, String> {
    let settings = store.read_activity_settings()?;

    if !settings.enabled {
        return Ok(None);
    }

    let start = now - WINDOW_SECONDS;
    let pauses = store.list_activity_pauses(start)?;

    if active_pause(&pauses, now).is_some() {
        return Ok(None);
    }

    let window = ReadingWindow {
        start,
        end: now,
        pauses: &pauses,
    };

    Ok(Some(ActivityCollection {
        machine_id: store.machine_id()?,
        label: computer_name()
            .map(|name| clip(&name, LABEL_LENGTH))
            .unwrap_or_else(|| "your Mac".to_string()),
        period_start: rfc3339(start),
        period_end: rfc3339(now),
        sources: collect_sources(store, &settings, &window)?,
    }))
}
