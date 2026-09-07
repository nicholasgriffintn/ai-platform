use serde::Deserialize;

pub const MAX_INDIVIDUAL: usize = 3;
pub const LEDGER_LIMIT: usize = 500;

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Announcement {
    pub id: String,
    pub title: String,
    pub body: String,
}

#[derive(Debug, PartialEq, Eq)]
pub enum AnnouncementPlan {
    Nothing,
    Each(Vec<Announcement>),
    Summary { count: usize },
}

pub fn plan(unannounced: Vec<Announcement>, max_individual: usize) -> AnnouncementPlan {
    match unannounced.len() {
        0 => AnnouncementPlan::Nothing,
        count if count > max_individual => AnnouncementPlan::Summary { count },
        _ => AnnouncementPlan::Each(unannounced),
    }
}

pub fn summary_body(count: usize) -> String {
    format!("{count} things are waiting on you.")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(id: &str) -> Announcement {
        Announcement {
            id: id.to_string(),
            title: "A task finished".to_string(),
            body: "Weekly digest".to_string(),
        }
    }

    #[test]
    fn says_nothing_when_nothing_is_new() {
        assert_eq!(plan(Vec::new(), MAX_INDIVIDUAL), AnnouncementPlan::Nothing);
    }

    #[test]
    fn announces_a_handful_of_items_one_by_one() {
        let items = vec![item("a"), item("b")];

        assert_eq!(
            plan(items.clone(), MAX_INDIVIDUAL),
            AnnouncementPlan::Each(items)
        );
    }

    #[test]
    fn collapses_a_backlog_into_one_notification() {
        let items = (0..9).map(|index| item(&index.to_string())).collect();

        assert_eq!(
            plan(items, MAX_INDIVIDUAL),
            AnnouncementPlan::Summary { count: 9 }
        );
    }

    #[test]
    fn counts_the_backlog_in_the_words_it_shows() {
        assert!(summary_body(9).contains('9'));
    }
}
