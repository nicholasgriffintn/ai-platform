use std::collections::HashMap;

use url::{Host, Url};

use super::browsers::{Search, Visit};
use super::digest::{DigestItem, ReadingWindow, LINE_LENGTH};
use super::settings::{is_never_shared_domain, BrowsingSettings, NeverShareKey};
use crate::text::{clip, describe_duration, plural};

const DOMAIN_LIMIT: usize = 30;
const SEARCH_LIMIT: usize = 10;
const TITLES_PER_DOMAIN: usize = 3;
const TITLE_LENGTH: usize = 70;

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

    let mut items: Vec<DigestItem> = ranked
        .into_iter()
        .take(DOMAIN_LIMIT)
        .map(|(host, visits)| {
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
        })
        .collect();

    if settings.searches {
        items.extend(
            searches
                .iter()
                .filter(|search| window.admits(search.at) && !search.term.trim().is_empty())
                .take(SEARCH_LIMIT)
                .map(|search| DigestItem {
                    line: clip(&format!("Searched “{}”", search.term.trim()), LINE_LENGTH),
                    never_share: None,
                }),
        );
    }

    items
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
        let items = digest_browsing(&visits, &searches, &window, &with_searches, &[]);
        assert_eq!(items[1].line, "Searched “flights to lisbon”");
    }
}
