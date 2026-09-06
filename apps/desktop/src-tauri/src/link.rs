use std::io::{BufRead, BufReader, Read, Write};
use std::net::{Ipv4Addr, TcpListener, TcpStream};
use std::time::{Duration, Instant};

const CALLBACK_PATH: &str = "/callback";
const ACCEPT_POLL: Duration = Duration::from_millis(200);
const READ_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_REQUEST_LINE: u64 = 8 * 1024;
const SUCCESS_BODY: &str = "<!doctype html><meta charset=\"utf-8\"><title>Polychat</title><p>You are signed in. You can close this tab and return to Polychat.";
const REFUSED_BODY: &str =
    "<!doctype html><meta charset=\"utf-8\"><title>Polychat</title><p>This sign-in could not be matched to the one you started. Try again from Polychat.";

pub struct LoopbackListener {
    listener: TcpListener,
    port: u16,
    state: String,
}

#[derive(Debug, PartialEq, Eq)]
pub enum CallbackOutcome {
    Code(String),
    Refused,
    NotTheCallback,
}

pub fn read_callback(request_line: &str, expected_state: &str) -> CallbackOutcome {
    let Some(target) = request_line.split_whitespace().nth(1) else {
        return CallbackOutcome::NotTheCallback;
    };
    let Ok(url) = url::Url::parse("http://127.0.0.1").and_then(|base| base.join(target)) else {
        return CallbackOutcome::NotTheCallback;
    };

    if url.path() != CALLBACK_PATH {
        return CallbackOutcome::NotTheCallback;
    }

    let mut code = None;
    let mut state = None;

    for (key, value) in url.query_pairs() {
        match key.as_ref() {
            "code" => code = Some(value.into_owned()),
            "state" => state = Some(value.into_owned()),
            _ => {}
        }
    }

    if state.as_deref() != Some(expected_state) {
        return CallbackOutcome::Refused;
    }

    match code {
        Some(code) if !code.is_empty() => CallbackOutcome::Code(code),
        _ => CallbackOutcome::Refused,
    }
}

fn reply(body: &str) -> String {
    format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{body}",
        body.len()
    )
}

impl LoopbackListener {
    pub fn bind(state: String) -> Result<Self, String> {
        let listener =
            TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).map_err(|cause| cause.to_string())?;
        let port = listener
            .local_addr()
            .map_err(|cause| cause.to_string())?
            .port();

        listener
            .set_nonblocking(true)
            .map_err(|cause| cause.to_string())?;

        Ok(Self {
            listener,
            port,
            state,
        })
    }

    pub fn redirect_uri(&self) -> String {
        format!("http://127.0.0.1:{}{CALLBACK_PATH}", self.port)
    }

    pub fn wait_for_code(&self, timeout: Duration) -> Result<String, String> {
        let deadline = Instant::now() + timeout;

        while Instant::now() < deadline {
            match self.listener.accept() {
                Ok((mut stream, _)) => {
                    if let Some(code) = self.handle(&mut stream) {
                        return Ok(code);
                    }
                }
                Err(cause) if cause.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(ACCEPT_POLL);
                }
                Err(cause) => return Err(cause.to_string()),
            }
        }

        Err("Sign-in timed out before the browser came back.".to_string())
    }

    fn handle(&self, stream: &mut TcpStream) -> Option<String> {
        let _ = stream.set_read_timeout(Some(READ_TIMEOUT));
        let _ = stream.set_write_timeout(Some(READ_TIMEOUT));

        let mut request_line = String::new();
        let readable = stream.try_clone().ok()?;

        BufReader::new(readable.take(MAX_REQUEST_LINE))
            .read_line(&mut request_line)
            .ok()?;

        let outcome = read_callback(&request_line, &self.state);
        let body = match outcome {
            CallbackOutcome::Code(_) => SUCCESS_BODY,
            _ => REFUSED_BODY,
        };

        let _ = stream.write_all(reply(body).as_bytes());
        let _ = stream.flush();

        match outcome {
            CallbackOutcome::Code(code) => Some(code),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const STATE: &str = "state-abc";

    #[test]
    fn reads_the_code_when_the_state_matches_the_one_it_started() {
        assert_eq!(
            read_callback("GET /callback?code=abc.123&state=state-abc HTTP/1.1", STATE),
            CallbackOutcome::Code("abc.123".to_string())
        );
    }

    #[test]
    fn refuses_a_code_that_arrives_without_the_state_it_started() {
        assert_eq!(
            read_callback("GET /callback?code=abc.123 HTTP/1.1", STATE),
            CallbackOutcome::Refused
        );
    }

    #[test]
    fn refuses_a_code_carrying_somebody_elses_state() {
        assert_eq!(
            read_callback("GET /callback?code=attacker&state=other HTTP/1.1", STATE),
            CallbackOutcome::Refused
        );
    }

    #[test]
    fn refuses_a_matching_state_with_no_usable_code() {
        assert_eq!(
            read_callback("GET /callback?state=state-abc HTTP/1.1", STATE),
            CallbackOutcome::Refused
        );
        assert_eq!(
            read_callback("GET /callback?code=&state=state-abc HTTP/1.1", STATE),
            CallbackOutcome::Refused
        );
    }

    #[test]
    fn ignores_a_request_for_any_other_path() {
        assert_eq!(
            read_callback("GET /?code=abc&state=state-abc HTTP/1.1", STATE),
            CallbackOutcome::NotTheCallback
        );
        assert_eq!(
            read_callback("GET /other?code=abc&state=state-abc HTTP/1.1", STATE),
            CallbackOutcome::NotTheCallback
        );
        assert_eq!(
            read_callback("nonsense", STATE),
            CallbackOutcome::NotTheCallback
        );
    }

    #[test]
    fn declares_the_length_of_whatever_it_actually_sends() {
        for body in [SUCCESS_BODY, REFUSED_BODY] {
            let response = reply(body);
            let declared = response
                .split("Content-Length: ")
                .nth(1)
                .and_then(|rest| rest.split("\r\n").next())
                .and_then(|value| value.parse::<usize>().ok())
                .expect("a declared length");

            assert_eq!(declared, body.len());
            assert!(response.ends_with(body));
        }
    }

    #[test]
    fn binds_a_loopback_port_and_describes_itself_as_the_callback() {
        let listener = LoopbackListener::bind(STATE.to_string()).expect("bound");
        let redirect = listener.redirect_uri();

        assert!(redirect.starts_with("http://127.0.0.1:"));
        assert!(redirect.ends_with("/callback"));
    }

    #[test]
    fn gives_up_when_the_browser_never_comes_back() {
        let listener = LoopbackListener::bind(STATE.to_string()).expect("bound");
        let started = Instant::now();

        let result = listener.wait_for_code(Duration::from_millis(400));

        assert!(result.is_err());
        assert!(started.elapsed() < Duration::from_secs(5));
    }
}
