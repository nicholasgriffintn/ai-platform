use serde::{Deserialize, Serialize};

use super::pause::{was_paused_at, PauseRange};
use super::settings::NeverShareKey;

pub const LINE_LIMIT: usize = 40;
pub const LINE_LENGTH: usize = 280;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DigestItem {
    pub line: String,
    pub never_share: Option<NeverShareKey>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ActivityDigest {
    pub source: String,
    pub items: Vec<DigestItem>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ActivityCollection {
    pub machine_id: String,
    pub label: String,
    pub period_start: String,
    pub period_end: String,
    pub sources: Vec<ActivityDigest>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SentActivity {
    pub sent_at: String,
    pub collection: ActivityCollection,
}

pub struct ReadingWindow<'a> {
    pub start: i64,
    pub end: i64,
    pub pauses: &'a [PauseRange],
}

impl ReadingWindow<'_> {
    pub fn admits(&self, at: i64) -> bool {
        self.start <= at && at <= self.end && !was_paused_at(self.pauses, at)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collection_wire_contract_matches_desktop() {
        let collection = ActivityCollection {
            machine_id: "machine-1".to_string(),
            label: "Studio Mac".to_string(),
            period_start: "2026-10-24T00:00:00Z".to_string(),
            period_end: "2026-10-25T00:00:00Z".to_string(),
            sources: vec![ActivityDigest {
                source: "browsing".to_string(),
                items: vec![
                    DigestItem {
                        line: "example.com · 2 visits".to_string(),
                        never_share: Some(NeverShareKey::Domain("example.com".to_string())),
                    },
                    DigestItem {
                        line: "Searched “rust”".to_string(),
                        never_share: None,
                    },
                ],
            }],
        };

        assert_eq!(
            serde_json::to_value(&collection).expect("json"),
            serde_json::json!({
                "machineId": "machine-1",
                "label": "Studio Mac",
                "periodStart": "2026-10-24T00:00:00Z",
                "periodEnd": "2026-10-25T00:00:00Z",
                "sources": [{
                    "source": "browsing",
                    "items": [
                        { "line": "example.com · 2 visits", "neverShare": { "kind": "domain", "value": "example.com" } },
                        { "line": "Searched “rust”", "neverShare": null }
                    ]
                }]
            })
        );
    }
}
