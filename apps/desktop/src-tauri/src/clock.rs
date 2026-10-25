use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

pub fn now_seconds() -> i64 {
    OffsetDateTime::now_utc().unix_timestamp()
}

pub fn rfc3339(unix_seconds: i64) -> String {
    OffsetDateTime::from_unix_timestamp(unix_seconds)
        .ok()
        .and_then(|instant| instant.format(&Rfc3339).ok())
        .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string())
}

pub fn local_clock_time(unix_seconds: i64, offset_seconds: i64) -> String {
    let seconds = (unix_seconds + offset_seconds).rem_euclid(24 * 3600);

    format!("{:02}:{:02}", seconds / 3600, (seconds % 3600) / 60)
}
