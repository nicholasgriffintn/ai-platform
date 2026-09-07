use serde::{Deserialize, Serialize};
use url::{Host, Url};

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum EndpointTransport {
    Loopback,
    Network,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum EndpointKind {
    Model,
    Agent,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopEndpoint {
    pub id: String,
    pub kind: EndpointKind,
    pub vendor: String,
    pub label: String,
    pub url: String,
    pub transport: EndpointTransport,
    pub pairing_secret_stored: bool,
    pub approved_at: String,
    pub last_seen_at: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TransportFailure {
    Timeout,
    Unreachable,
    Unreadable,
    Refused,
}

pub fn describe_transport_failure(label: &str, failure: TransportFailure) -> String {
    let reason = match failure {
        TransportFailure::Timeout => "did not answer in time",
        TransportFailure::Unreachable => "could not be reached",
        TransportFailure::Unreadable => "sent a reply this application could not read",
        TransportFailure::Refused => "refused the request",
    };

    format!("{label} {reason}.")
}

#[derive(Debug, PartialEq, Eq)]
pub enum EgressRefusal {
    UnknownEndpoint,
    Unparsable,
    UnsupportedScheme,
    LoopbackExpected,
    UnprotectedAgentRuntime,
}

pub fn is_loopback_host(url: &Url) -> bool {
    match url.host() {
        Some(Host::Domain(name)) => name == "localhost" || name.ends_with(".localhost"),
        Some(Host::Ipv4(address)) => address.is_loopback(),
        Some(Host::Ipv6(address)) => address.is_loopback(),
        None => false,
    }
}

pub fn resolve_target(
    endpoints: &[DesktopEndpoint],
    endpoint_id: &str,
) -> Result<Url, EgressRefusal> {
    let endpoint = endpoints
        .iter()
        .find(|candidate| candidate.id == endpoint_id)
        .ok_or(EgressRefusal::UnknownEndpoint)?;

    let url = Url::parse(&endpoint.url).map_err(|_| EgressRefusal::Unparsable)?;

    if url.scheme() != "http" && url.scheme() != "https" {
        return Err(EgressRefusal::UnsupportedScheme);
    }

    if endpoint.transport == EndpointTransport::Loopback && !is_loopback_host(&url) {
        return Err(EgressRefusal::LoopbackExpected);
    }

    let unprotected_agent = endpoint.kind == EndpointKind::Agent
        && endpoint.transport == EndpointTransport::Network
        && url.scheme() != "https"
        && !endpoint.pairing_secret_stored;

    if unprotected_agent {
        return Err(EgressRefusal::UnprotectedAgentRuntime);
    }

    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_the_runtime_and_what_went_wrong_without_repeating_the_request() {
        assert_eq!(
            describe_transport_failure("Ollama", TransportFailure::Timeout),
            "Ollama did not answer in time."
        );
        assert_eq!(
            describe_transport_failure("LM Studio", TransportFailure::Unreachable),
            "LM Studio could not be reached."
        );
    }

    #[test]
    fn never_repeats_a_credential_or_an_address_back_to_the_window() {
        let secret = "pairing-secret-value";
        let address = "http://127.0.0.1:11434";

        for failure in [
            TransportFailure::Timeout,
            TransportFailure::Unreachable,
            TransportFailure::Unreadable,
            TransportFailure::Refused,
        ] {
            let described = describe_transport_failure("Ollama", failure);

            assert!(!described.contains(secret));
            assert!(!described.contains(address));
            assert!(described.starts_with("Ollama "));
        }
    }

    fn endpoint(
        id: &str,
        url: &str,
        kind: EndpointKind,
        transport: EndpointTransport,
    ) -> DesktopEndpoint {
        DesktopEndpoint {
            id: id.to_string(),
            kind,
            vendor: "ollama".to_string(),
            label: "Test".to_string(),
            url: url.to_string(),
            transport,
            pairing_secret_stored: false,
            approved_at: "2026-09-06T09:00:00Z".to_string(),
            last_seen_at: None,
        }
    }

    #[test]
    fn refuses_an_endpoint_that_was_never_configured() {
        let endpoints = vec![endpoint(
            "a",
            "http://127.0.0.1:11434",
            EndpointKind::Model,
            EndpointTransport::Loopback,
        )];

        assert_eq!(
            resolve_target(&endpoints, "b"),
            Err(EgressRefusal::UnknownEndpoint)
        );
    }

    #[test]
    fn refuses_a_remote_host_declared_as_loopback() {
        let endpoints = vec![endpoint(
            "a",
            "http://10.0.0.4:11434",
            EndpointKind::Model,
            EndpointTransport::Loopback,
        )];

        assert_eq!(
            resolve_target(&endpoints, "a"),
            Err(EgressRefusal::LoopbackExpected)
        );
    }

    #[test]
    fn refuses_a_scheme_that_is_not_http() {
        let endpoints = vec![endpoint(
            "a",
            "file:///etc/passwd",
            EndpointKind::Model,
            EndpointTransport::Network,
        )];

        assert_eq!(
            resolve_target(&endpoints, "a"),
            Err(EgressRefusal::UnsupportedScheme)
        );
    }

    #[test]
    fn refuses_an_unprotected_network_agent_runtime() {
        let endpoints = vec![endpoint(
            "a",
            "http://10.0.0.4:18789",
            EndpointKind::Agent,
            EndpointTransport::Network,
        )];

        assert_eq!(
            resolve_target(&endpoints, "a"),
            Err(EgressRefusal::UnprotectedAgentRuntime)
        );
    }

    #[test]
    fn allows_a_network_agent_runtime_with_a_pairing_secret() {
        let mut paired = endpoint(
            "a",
            "http://10.0.0.4:18789",
            EndpointKind::Agent,
            EndpointTransport::Network,
        );
        paired.pairing_secret_stored = true;

        assert!(resolve_target(&[paired], "a").is_ok());
    }

    #[test]
    fn resolves_configured_loopback_and_protected_network_endpoints() {
        let endpoints = vec![
            endpoint(
                "loop",
                "http://127.0.0.1:11434",
                EndpointKind::Model,
                EndpointTransport::Loopback,
            ),
            endpoint(
                "named",
                "http://localhost:1234",
                EndpointKind::Model,
                EndpointTransport::Loopback,
            ),
            endpoint(
                "net",
                "https://nest.local:18789",
                EndpointKind::Agent,
                EndpointTransport::Network,
            ),
        ];

        assert!(resolve_target(&endpoints, "loop").is_ok());
        assert!(resolve_target(&endpoints, "named").is_ok());
        assert!(resolve_target(&endpoints, "net").is_ok());
    }
}
