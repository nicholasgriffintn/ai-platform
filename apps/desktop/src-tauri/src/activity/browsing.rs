use std::collections::{HashMap, HashSet};

use url::{Host, Url};

use super::browsers::{Search, Visit};
use super::digest::{DigestEntry, DigestItem, ReadingWindow, ENTRY_TITLE_LENGTH, LINE_LENGTH};
use super::settings::{is_never_shared_domain, BrowsingSettings, NeverShareKey};
use crate::text::{clip, describe_duration, plural};

const DOMAIN_LIMIT: usize = 30;
const SEARCH_LIMIT: usize = 10;
const TITLES_PER_DOMAIN: usize = 3;
const TITLE_LENGTH: usize = 70;
const PAGE_LIMIT: usize = 8;

#[derive(Default)]
struct PageVisits {
    title: String,
    visits: usize,
    seconds: i64,
    last_at: i64,
}

#[derive(Default)]
struct DomainVisits {
    visits: usize,
    seconds: i64,
    titles: HashMap<String, usize>,
}

fn shareable_host(url: &str) -> Option<String> {
    let parsed = Url::parse(url).ok()?;

    if !matches!(parsed.scheme(), "http" | "https") {
        return None;
    }

    let Host::Domain(host) = parsed.host()? else {
        return None;
    };
    let host = host.trim_end_matches('.').to_lowercase();

    if host == "localhost"
        || host.ends_with(".localhost")
        || host.ends_with(".local")
        || !host.contains('.')
    {
        return None;
    }

    Some(host.strip_prefix("www.").unwrap_or(&host).to_string())
}

fn top_titles(titles: &HashMap<String, usize>) -> Vec<String> {
    let mut ranked: Vec<(&String, &usize)> = titles.iter().collect();

    ranked.sort_by(|left, right| right.1.cmp(left.1).then_with(|| left.0.cmp(right.0)));
    ranked
        .into_iter()
        .take(TITLES_PER_DOMAIN)
        .map(|(title, _)| clip(title, TITLE_LENGTH))
        .collect()
}

pub fn digest_browsing(
    visits: &[Visit],
    searches: &[Search],
    window: &ReadingWindow<'_>,
    settings: &BrowsingSettings,
    never_shared: &[String],
) -> Vec<DigestItem> {
    let mut domains: HashMap<String, DomainVisits> = HashMap::new();

    for visit in visits.iter().filter(|visit| window.admits(visit.at)) {
        let Some(host) = shareable_host(&visit.url) else {
            continue;
        };

        if is_never_shared_domain(&host, never_shared) {
            continue;
        }

        let entry = domains.entry(host.clone()).or_default();
        let title = visit.title.trim();

        entry.visits += 1;
        entry.seconds += visit.seconds.max(0);

        if !title.is_empty() && !title.eq_ignore_ascii_case(&host) && !title.starts_with("http") {
            *entry.titles.entry(title.to_string()).or_default() += 1;
        }
    }

    let mut ranked: Vec<(String, DomainVisits)> = domains.into_iter().collect();

    ranked.sort_by(|left, right| {
        right
            .1
            .seconds
            .cmp(&left.1.seconds)
            .then_with(|| right.1.visits.cmp(&left.1.visits))
            .then_with(|| left.0.cmp(&right.0))
    });

    let mut items: Vec<DigestItem> = Vec::new();

    if settings.searches {
        let mut seen = HashSet::new();

        items.extend(
            searches
                .iter()
                .filter(|search| window.admits(search.at))
                .map(|search| search.term.trim())
                .filter(|term| !term.is_empty() && seen.insert(term.to_lowercase()))
                .take(SEARCH_LIMIT)
                .map(|term| DigestItem {
                    line: clip(&format!("Searched “{term}”"), LINE_LENGTH),
                    never_share: None,
                }),
        );
    }

    items.extend(ranked.into_iter().take(DOMAIN_LIMIT).map(|(host, visits)| {
        let mut line = format!("{host} · {}", plural(visits.visits, "visit", "visits"));

        if visits.seconds >= 60 {
            line.push_str(&format!(", {}", describe_duration(visits.seconds)));
        }

        let titles = top_titles(&visits.titles);

        if settings.titles && !titles.is_empty() {
            line.push_str(&format!(" · {}", titles.join("; ")));
        }

        DigestItem {
            line: clip(&line, LINE_LENGTH),
            never_share: Some(NeverShareKey::Domain(host)),
        }
    }));

    items
}

fn page_address(url: &str) -> Option<String> {
    let mut parsed = Url::parse(url).ok()?;

    parsed.set_fragment(None);

    Some(parsed.to_string())
}

pub fn pick_pages(
    visits: &[Visit],
    search_pages: &HashSet<String>,
    window: &ReadingWindow<'_>,
    never_shared: &[String],
) -> Vec<DigestEntry> {
    let mut pages: HashMap<String, PageVisits> = HashMap::new();

    for visit in visits.iter().filter(|visit| window.admits(visit.at)) {
        let title = visit.title.trim();

        if title.is_empty() || search_pages.contains(&visit.url) {
            continue;
        }

        let Some(host) = shareable_host(&visit.url) else {
            continue;
        };

        if is_never_shared_domain(&host, never_shared) {
            continue;
        }

        let Some(address) = page_address(&visit.url) else {
            continue;
        };
        let page = pages.entry(address).or_default();

        if visit.at >= page.last_at {
            page.title = title.to_string();
            page.last_at = visit.at;
        }

        page.visits += 1;
        page.seconds += visit.seconds.max(0);
    }

    let mut ranked: Vec<(String, PageVisits)> = pages.into_iter().collect();

    ranked.sort_by(|left, right| {
        right
            .1
            .seconds
            .cmp(&left.1.seconds)
            .then_with(|| right.1.visits.cmp(&left.1.visits))
            .then_with(|| left.0.cmp(&right.0))
    });
    ranked
        .into_iter()
        .take(PAGE_LIMIT)
        .map(|(url, page)| DigestEntry {
            title: clip(&page.title, ENTRY_TITLE_LENGTH),
            url: Some(url),
            detail: None,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::activity::pause::PauseRange;

    fn visit(url: &str, title: &str, at: i64, seconds: i64) -> Visit {
        Visit {
            url: url.to_string(),
            title: title.to_string(),
            at,
            seconds,
        }
    }

    fn settings() -> BrowsingSettings {
        BrowsingSettings {
            enabled: true,
            browsers: Vec::new(),
            titles: true,
            searches: false,
        }
    }

    #[test]
    fn groups_visits_by_site_and_ranks_by_time_spent() {
        let visits = [
            visit("https://www.example.com/a", "Example A", 100, 30),
            visit("https://example.com/b", "Example B", 110, 600),
            visit("https://news.example/x", "Story", 120, 60),
        ];
        let window = ReadingWindow {
            start: 0,
            end: 1_000,
            pauses: &[],
        };
        let items = digest_browsing(&visits, &[], &window, &settings(), &[]);

        assert_eq!(items.len(), 2);
        assert!(items[0].line.starts_with("example.com · 2 visits, 10m · "));
        assert_eq!(
            items[0].never_share,
            Some(NeverShareKey::Domain("example.com".to_string()))
        );
    }

    #[test]
    fn leaves_out_paused_time_local_addresses_and_never_shared_sites() {
        let visits = [
            visit("https://paused.example/", "Paused", 500, 0),
            visit("http://localhost:5173/", "Dev", 100, 0),
            visit("http://192.168.1.1/", "Router", 100, 0),
            visit("chrome://settings", "Settings", 100, 0),
            visit("https://online.bank.example/", "Bank", 100, 0),
            visit("https://kept.example/", "Kept", 100, 0),
        ];
        let pauses = [PauseRange {
            start: 400,
            end: Some(600),
        }];
        let window = ReadingWindow {
            start: 0,
            end: 1_000,
            pauses: &pauses,
        };
        let items = digest_browsing(
            &visits,
            &[],
            &window,
            &settings(),
            &["bank.example".to_string()],
        );

        assert_eq!(items.len(), 1);
        assert!(items[0].line.starts_with("kept.example"));
    }

    #[test]
    fn sends_domains_only_and_searches_only_when_asked() {
        let visits = [visit("https://example.com/", "Private title", 100, 0)];
        let searches = [Search {
            term: "flights to lisbon".to_string(),
            at: 100,
        }];
        let window = ReadingWindow {
            start: 0,
            end: 1_000,
            pauses: &[],
        };
        let quiet = BrowsingSettings {
            titles: false,
            ..settings()
        };

        let items = digest_browsing(&visits, &searches, &window, &quiet, &[]);
        assert_eq!(items.len(), 1);
        assert!(!items[0].line.contains("Private title"));

        let with_searches = BrowsingSettings {
            searches: true,
            ..settings()
        };
        let repeated = [
            Search {
                term: "flights to lisbon".to_string(),
                at: 120,
            },
            Search {
                term: "Flights to Lisbon ".to_string(),
                at: 100,
            },
        ];
        let items = digest_browsing(&visits, &repeated, &window, &with_searches, &[]);
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].line, "Searched “flights to lisbon”");
        assert!(items[1].line.starts_with("example.com"));
    }

    #[test]
    fn picks_the_pages_read_longest_and_leaves_out_searches_and_never_shared_sites() {
        let visits = [
            visit("https://example.com/long#intro", "Long read", 100, 600),
            visit("https://example.com/long", "Long read", 120, 300),
            visit("https://example.com/short", "Short read", 130, 30),
            visit("https://search.example/?q=rust", "rust - Search", 140, 900),
            visit(
                "https://online.bank.example/statement",
                "Statement",
                150,
                900,
            ),
            visit("https://example.com/untitled", "", 160, 900),
        ];
        let search_pages = HashSet::from(["https://search.example/?q=rust".to_string()]);
        let window = ReadingWindow {
            start: 0,
            end: 1_000,
            pauses: &[],
        };
        let pages = pick_pages(
            &visits,
            &search_pages,
            &window,
            &["bank.example".to_string()],
        );

        assert_eq!(
            pages,
            vec![
                DigestEntry {
                    title: "Long read".to_string(),
                    url: Some("https://example.com/long".to_string()),
                    detail: None,
                },
                DigestEntry {
                    title: "Short read".to_string(),
                    url: Some("https://example.com/short".to_string()),
                    detail: None,
                },
            ]
        );
    }
}
