pub const SCHEME: &str = "polychat";
pub const DEEP_LINK_EVENT: &str = "polychat://deep-link";

pub fn find_deep_link<'a>(arguments: impl IntoIterator<Item = &'a String>) -> Option<&'a String> {
    arguments
        .into_iter()
        .find(|argument| argument.starts_with(&format!("{SCHEME}://")))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn arguments(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn reads_the_link_a_second_launch_carried() {
        let argv = arguments(&["/Applications/Polychat.app", "polychat://chat/abc-123"]);

        assert_eq!(
            find_deep_link(&argv),
            Some(&"polychat://chat/abc-123".to_string())
        );
    }

    #[test]
    fn ignores_a_launch_that_carried_no_link() {
        assert_eq!(
            find_deep_link(&arguments(&["/Applications/Polychat.app"])),
            None
        );
    }

    #[test]
    fn ignores_an_argument_addressing_another_scheme() {
        let argv = arguments(&[
            "/Applications/Polychat.app",
            "https://polychat.app/chat/abc",
        ]);

        assert_eq!(find_deep_link(&argv), None);
    }
}
