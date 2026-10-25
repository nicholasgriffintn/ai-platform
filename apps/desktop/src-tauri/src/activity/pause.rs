use serde::{Deserialize, Serialize};

const HOUR: i64 = 3600;
const DAY: i64 = 24 * HOUR;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PauseChoice {
    Hour,
    Tomorrow,
    UntilResumed,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PauseRange {
    pub start: i64,
    pub end: Option<i64>,
}

impl PauseRange {
    fn covers(&self, at: i64) -> bool {
        self.start <= at && self.end.is_none_or(|end| at < end)
    }
}

pub fn pause_end(choice: PauseChoice, now: i64, local_offset_seconds: i64) -> Option<i64> {
    match choice {
        PauseChoice::Hour => Some(now + HOUR),
        PauseChoice::Tomorrow => {
            let local_midnight = ((now + local_offset_seconds).div_euclid(DAY) + 1) * DAY;

            Some(local_midnight - local_offset_seconds)
        }
        PauseChoice::UntilResumed => None,
    }
}

pub fn active_pause(ranges: &[PauseRange], now: i64) -> Option<PauseRange> {
    ranges
        .iter()
        .filter(|range| range.covers(now))
        .max_by_key(|range| range.end.unwrap_or(i64::MAX))
        .copied()
}

pub fn was_paused_at(ranges: &[PauseRange], at: i64) -> bool {
    ranges.iter().any(|range| range.covers(at))
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_793_000_000;

    #[test]
    fn pausing_until_tomorrow_ends_at_the_next_local_midnight() {
        let offset = 3600;
        let end = pause_end(PauseChoice::Tomorrow, NOW, offset).expect("an end");

        assert_eq!((end + offset).rem_euclid(DAY), 0);
        assert!(end > NOW && end - NOW <= DAY);
    }

    #[test]
    fn an_open_pause_lasts_until_resumed() {
        let ranges = [PauseRange {
            start: NOW - 10,
            end: None,
        }];

        assert_eq!(pause_end(PauseChoice::UntilResumed, NOW, 0), None);
        assert!(active_pause(&ranges, NOW + 30 * DAY).is_some());
    }

    #[test]
    fn readings_inside_a_finished_pause_are_still_recognised_after_resuming() {
        let ranges = [PauseRange {
            start: NOW - 2 * HOUR,
            end: Some(NOW - HOUR),
        }];

        assert!(active_pause(&ranges, NOW).is_none());
        assert!(was_paused_at(&ranges, NOW - 90 * 60));
        assert!(!was_paused_at(&ranges, NOW - HOUR));
        assert!(!was_paused_at(&ranges, NOW - 3 * HOUR));
    }
}
