use std::collections::HashMap;

use super::digest::{DigestItem, LINE_LENGTH};
use super::settings::{AppSettings, MusicSettings, NeverShareKey};
use crate::text::{clip, describe_duration};

const APP_LIMIT: usize = 25;
const TRACK_LIMIT: usize = 30;
const TITLES_PER_APP: usize = 3;
const TITLE_LENGTH: usize = 70;
const MINIMUM_SECONDS: i64 = 60;
pub const APPLE_MUSIC: &str = "com.apple.Music";
pub const SPOTIFY: &str = "com.spotify.client";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SampleKind {
    App,
    Track,
}

impl SampleKind {
    pub fn as_text(self) -> &'static str {
        match self {
            SampleKind::App => "app",
            SampleKind::Track => "track",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Sample {
    pub kind: SampleKind,
    pub key: String,
    pub name: String,
    pub detail: String,
    pub hour: i64,
    pub seconds: i64,
}

#[derive(Default)]
struct AppTime {
    name: String,
    seconds: i64,
    titles: HashMap<String, i64>,
}

pub fn digest_apps(
    samples: &[Sample],
    settings: &AppSettings,
    never_shared: &[String],
) -> Vec<DigestItem> {
    let mut apps: HashMap<String, AppTime> = HashMap::new();

    for sample in samples {
        if never_shared.contains(&sample.key.to_lowercase()) {
            continue;
        }

        let entry = apps.entry(sample.key.clone()).or_default();

        entry.name.clone_from(&sample.name);
        entry.seconds += sample.seconds;

        if !sample.detail.is_empty() {
            *entry.titles.entry(sample.detail.clone()).or_default() += sample.seconds;
        }
    }

    let mut ranked: Vec<(String, AppTime)> = apps
        .into_iter()
        .filter(|(_, time)| time.seconds >= MINIMUM_SECONDS)
        .collect();

    ranked.sort_by_key(|(_, time)| std::cmp::Reverse(time.seconds));
    ranked
        .into_iter()
        .take(APP_LIMIT)
        .map(|(key, time)| {
            let mut line = format!("{} · {}", time.name, describe_duration(time.seconds));

            if settings.window_titles {
                let mut titles: Vec<(String, i64)> = time.titles.into_iter().collect();

                titles.sort_by_key(|(_, seconds)| std::cmp::Reverse(*seconds));

                let titles: Vec<String> = titles
                    .into_iter()
                    .take(TITLES_PER_APP)
                    .map(|(title, _)| clip(&title, TITLE_LENGTH))
                    .collect();

                if !titles.is_empty() {
                    line.push_str(&format!(" · {}", titles.join("; ")));
                }
            }

            DigestItem {
                line: clip(&line, LINE_LENGTH),
                never_share: Some(NeverShareKey::App(key.to_lowercase())),
            }
        })
        .collect()
}

pub fn digest_music(samples: &[Sample], settings: &MusicSettings) -> Vec<DigestItem> {
    let mut tracks: HashMap<(String, String), i64> = HashMap::new();

    for sample in samples.iter().filter(|sample| match sample.key.as_str() {
        APPLE_MUSIC => settings.apple_music,
        SPOTIFY => settings.spotify,
        _ => false,
    }) {
        *tracks
            .entry((sample.name.clone(), sample.detail.clone()))
            .or_default() += sample.seconds;
    }

    let mut ranked: Vec<((String, String), i64)> = tracks.into_iter().collect();

    ranked.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(&right.0)));
    ranked
        .into_iter()
        .take(TRACK_LIMIT)
        .map(|((track, artist), seconds)| {
            let line = if artist.is_empty() {
                format!("{track} · {}", describe_duration(seconds))
            } else {
                format!("{track} by {artist} · {}", describe_duration(seconds))
            };

            DigestItem {
                line: clip(&line, LINE_LENGTH),
                never_share: None,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(kind: SampleKind, key: &str, name: &str, detail: &str, seconds: i64) -> Sample {
        Sample {
            kind,
            key: key.to_string(),
            name: name.to_string(),
            detail: detail.to_string(),
            hour: 0,
            seconds,
        }
    }

    #[test]
    fn totals_app_time_and_shows_window_titles_only_when_asked() {
        let samples = [
            sample(
                SampleKind::App,
                "com.apple.dt.Xcode",
                "Xcode",
                "ContentView.swift",
                600,
            ),
            sample(SampleKind::App, "com.apple.dt.Xcode", "Xcode", "", 600),
            sample(SampleKind::App, "com.example.Brief", "Brief", "", 30),
        ];
        let quiet = digest_apps(&samples, &AppSettings::default(), &[]);

        assert_eq!(quiet.len(), 1);
        assert_eq!(quiet[0].line, "Xcode · 20m");

        let titled = digest_apps(
            &samples,
            &AppSettings {
                enabled: true,
                window_titles: true,
            },
            &[],
        );
        assert_eq!(titled[0].line, "Xcode · 20m · ContentView.swift");
        assert!(digest_apps(
            &samples,
            &AppSettings::default(),
            &["com.apple.dt.xcode".to_string()]
        )
        .is_empty());
    }

    #[test]
    fn shares_tracks_only_from_the_players_that_are_switched_on() {
        let samples = [
            sample(SampleKind::Track, APPLE_MUSIC, "Song", "Artist", 240),
            sample(SampleKind::Track, SPOTIFY, "Other", "Band", 240),
        ];
        let items = digest_music(
            &samples,
            &MusicSettings {
                apple_music: true,
                spotify: false,
            },
        );

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].line, "Song by Artist · 4m");
    }
}
