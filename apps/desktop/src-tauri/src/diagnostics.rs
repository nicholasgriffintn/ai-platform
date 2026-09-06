use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostics {
    pub app_version: String,
    pub target: String,
    pub api_base_url: String,
    pub database_path: String,
    pub endpoint_count: usize,
    pub keychain_available: bool,
    pub signed_in: bool,
    pub collected_at: String,
}

pub fn redact(text: &str, secrets: &[&str]) -> String {
    let mut redacted = text.to_string();

    for secret in secrets {
        if secret.len() < 8 {
            continue;
        }

        redacted = redacted.replace(secret, "[redacted]");
    }

    redacted
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn removes_a_secret_wherever_it_appears() {
        let text = "Authorization: Bearer sk-live-abcdefghij failed for sk-live-abcdefghij";

        assert_eq!(
            redact(text, &["sk-live-abcdefghij"]),
            "Authorization: Bearer [redacted] failed for [redacted]"
        );
    }

    #[test]
    fn leaves_text_alone_when_no_secret_is_present() {
        assert_eq!(redact("nothing to hide", &["sk-live-abcdefghij"]), "nothing to hide");
    }

    #[test]
    fn refuses_to_redact_a_value_short_enough_to_appear_by_accident() {
        assert_eq!(redact("the cat sat", &["cat"]), "the cat sat");
    }
}
