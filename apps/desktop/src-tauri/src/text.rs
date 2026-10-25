pub fn clip(value: &str, max_chars: usize) -> String {
    let trimmed = value.trim();

    if trimmed.chars().count() <= max_chars {
        return trimmed.to_string();
    }

    let mut clipped: String = trimmed.chars().take(max_chars.saturating_sub(1)).collect();

    clipped.push('…');
    clipped
}

pub fn plural(count: usize, one: &str, many: &str) -> String {
    format!("{count} {}", if count == 1 { one } else { many })
}

pub fn describe_duration(seconds: i64) -> String {
    let minutes = seconds.max(0) / 60;

    match (minutes / 60, minutes % 60) {
        (0, 0) => "under a minute".to_string(),
        (0, minutes) => format!("{minutes}m"),
        (hours, 0) => format!("{hours}h"),
        (hours, minutes) => format!("{hours}h {minutes}m"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clips_on_characters_rather_than_bytes() {
        assert_eq!(clip("  héllo  ", 10), "héllo");
        assert_eq!(clip("ünïcödé text", 5), "ünïc…");
    }

    #[test]
    fn describes_durations_the_way_people_read_them() {
        assert_eq!(describe_duration(20), "under a minute");
        assert_eq!(describe_duration(25 * 60), "25m");
        assert_eq!(describe_duration(2 * 3600), "2h");
        assert_eq!(describe_duration(80 * 60), "1h 20m");
    }
}
