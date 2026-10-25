use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BrowserSelection {
    pub browser: String,
    pub profiles: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct BrowsingSettings {
    pub enabled: bool,
    pub browsers: Vec<BrowserSelection>,
    pub titles: bool,
    pub searches: bool,
}

impl Default for BrowsingSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            browsers: Vec::new(),
            titles: true,
            searches: false,
        }
    }
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct AgentSettings {
    pub claude_code: bool,
    pub codex: bool,
    pub prompts: bool,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct AppSettings {
    pub enabled: bool,
    pub window_titles: bool,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct MusicSettings {
    pub apple_music: bool,
    pub spotify: bool,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct NeverShare {
    pub domains: Vec<String>,
    pub apps: Vec<String>,
    pub projects: Vec<String>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct ActivitySettings {
    pub enabled: bool,
    pub browsing: BrowsingSettings,
    pub agents: AgentSettings,
    pub apps: AppSettings,
    pub music: MusicSettings,
    pub never_share: NeverShare,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", content = "value", rename_all = "camelCase")]
pub enum NeverShareKey {
    Domain(String),
    App(String),
    Project(String),
}

impl ActivitySettings {
    pub fn sharing(&self) -> Vec<&'static str> {
        [
            (
                self.browsing.enabled && !self.browsing.browsers.is_empty(),
                "browsing",
            ),
            (self.agents.claude_code || self.agents.codex, "agents"),
            (self.apps.enabled, "apps"),
            (self.music.apple_music || self.music.spotify, "music"),
        ]
        .into_iter()
        .filter_map(|(on, name)| on.then_some(name))
        .collect()
    }

    pub fn never_share_key(&mut self, key: NeverShareKey) {
        let (list, value) = match key {
            NeverShareKey::Domain(value) => (&mut self.never_share.domains, value),
            NeverShareKey::App(value) => (&mut self.never_share.apps, value),
            NeverShareKey::Project(value) => (&mut self.never_share.projects, value),
        };
        let value = value.trim().to_lowercase();

        if !value.is_empty() && !list.contains(&value) {
            list.push(value);
        }
    }
}

pub fn is_never_shared_domain(host: &str, domains: &[String]) -> bool {
    let host = host.to_lowercase();

    domains.iter().any(|domain| {
        host == *domain
            || host
                .strip_suffix(domain.as_str())
                .is_some_and(|prefix| prefix.ends_with('.'))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_never_shared_domain_covers_its_subdomains_but_not_lookalikes() {
        let domains = vec!["bank.example".to_string()];

        assert!(is_never_shared_domain("bank.example", &domains));
        assert!(is_never_shared_domain("Online.Bank.Example", &domains));
        assert!(!is_never_shared_domain("mybank.example", &domains));
    }

    #[test]
    fn adds_a_never_share_key_once_and_ignores_blanks() {
        let mut settings = ActivitySettings::default();

        settings.never_share_key(NeverShareKey::Domain("News.Example".to_string()));
        settings.never_share_key(NeverShareKey::Domain("news.example".to_string()));
        settings.never_share_key(NeverShareKey::App("  ".to_string()));

        assert_eq!(settings.never_share.domains, vec!["news.example"]);
        assert!(settings.never_share.apps.is_empty());
    }

    #[test]
    fn reads_settings_saved_before_a_field_existed() {
        let settings: ActivitySettings =
            serde_json::from_str(r#"{"enabled":true,"browsing":{"enabled":true}}"#)
                .expect("settings");

        assert!(settings.enabled);
        assert!(settings.browsing.titles);
        assert!(!settings.browsing.searches);
    }
}
