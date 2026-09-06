use std::io::{BufRead, BufReader, Write};
use std::net::{Ipv4Addr, TcpListener, TcpStream};
use std::time::Duration;

const CALLBACK_PATH: &str = "/callback";
const REPLY: &str = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\nContent-Length: 118\r\n\r\n<!doctype html><meta charset=\"utf-8\"><title>Polychat</title><p>You are signed in. You can close this tab and return to Polychat.";

pub struct LoopbackListener {
    listener: TcpListener,
    port: u16,
}

pub fn read_code(request_line: &str) -> Option<String> {
    let target = request_line.split_whitespace().nth(1)?;
    let url = url::Url::parse("http://127.0.0.1")
        .ok()?
        .join(target)
        .ok()?;

    if url.path() != CALLBACK_PATH {
        return None;
    }

    url.query_pairs()
        .find(|(key, _)| key == "code")
        .map(|(_, value)| value.into_owned())
        .filter(|code| !code.is_empty())
}

impl LoopbackListener {
    pub fn bind() -> Result<Self, String> {
        let listener =
            TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).map_err(|cause| cause.to_string())?;
        let port = listener
            .local_addr()
            .map_err(|cause| cause.to_string())?
            .port();

        Ok(Self { listener, port })
    }

    pub fn redirect_uri(&self) -> String {
        format!("http://127.0.0.1:{}{CALLBACK_PATH}", self.port)
    }

    pub fn wait_for_code(&self, timeout: Duration) -> Result<String, String> {
        self.listener
            .set_nonblocking(false)
            .map_err(|cause| cause.to_string())?;

        let deadline = std::time::Instant::now() + timeout;

        for incoming in self.listener.incoming() {
            if std::time::Instant::now() > deadline {
                return Err("Sign-in timed out before the browser came back.".to_string());
            }

            let mut stream = incoming.map_err(|cause| cause.to_string())?;

            if let Some(code) = handle(&mut stream) {
                return Ok(code);
            }
        }

        Err("Sign-in ended without a code.".to_string())
    }
}

fn handle(stream: &mut TcpStream) -> Option<String> {
    let mut request_line = String::new();

    BufReader::new(stream.try_clone().ok()?)
        .read_line(&mut request_line)
        .ok()?;

    let code = read_code(&request_line);

    let _ = stream.write_all(REPLY.as_bytes());
    let _ = stream.flush();

    code
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_code_from_the_callback_request() {
        assert_eq!(
            read_code("GET /callback?code=abc.123 HTTP/1.1"),
            Some("abc.123".to_string())
        );
    }

    #[test]
    fn ignores_a_request_for_any_other_path() {
        assert_eq!(read_code("GET /?code=abc.123 HTTP/1.1"), None);
        assert_eq!(read_code("GET /other?code=abc.123 HTTP/1.1"), None);
    }

    #[test]
    fn ignores_a_callback_without_a_usable_code() {
        assert_eq!(read_code("GET /callback HTTP/1.1"), None);
        assert_eq!(read_code("GET /callback?code= HTTP/1.1"), None);
        assert_eq!(read_code("GET /callback?error=denied HTTP/1.1"), None);
        assert_eq!(read_code("nonsense"), None);
    }

    #[test]
    fn binds_a_loopback_port_and_describes_itself_as_the_callback() {
        let listener = LoopbackListener::bind().expect("bound");
        let redirect = listener.redirect_uri();

        assert!(redirect.starts_with("http://127.0.0.1:"));
        assert!(redirect.ends_with("/callback"));
    }
}
