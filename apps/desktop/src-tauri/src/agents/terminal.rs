use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::State;

use super::changes::WorktreeRoot;
use super::process::DirectoryGrants;
use super::workspace;

const MAX_SCROLLBACK_BYTES: usize = 2 * 1024 * 1024;
const READ_CHUNK_BYTES: usize = 16 * 1024;

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum TerminalEvent {
    Output { data: String },
    Exited { code: Option<u32> },
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOpenRequest {
    pub directory_id: String,
    pub conversation_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOpened {
    pub terminal_id: String,
    pub cwd: String,
    pub scrollback: String,
}

struct TerminalOutput {
    scrollback: Vec<u8>,
    channel: Option<Channel<TerminalEvent>>,
}

struct Terminal {
    cwd: String,
    master: Mutex<Box<dyn MasterPty + Send>>,
    writer: Mutex<Box<dyn Write + Send>>,
    child: Mutex<Box<dyn Child + Send + Sync>>,
    output: Mutex<TerminalOutput>,
}

#[derive(Default, Clone)]
pub struct TerminalRegistry {
    terminals: Arc<Mutex<HashMap<String, Arc<Terminal>>>>,
}

impl TerminalRegistry {
    fn get(&self, id: &str) -> Result<Arc<Terminal>, String> {
        self.terminals
            .lock()
            .map_err(|_| "The terminal registry is unavailable.".to_string())?
            .get(id)
            .cloned()
            .ok_or_else(|| "That terminal has closed.".to_string())
    }

    fn insert(&self, id: String, terminal: Arc<Terminal>) -> Result<(), String> {
        self.terminals
            .lock()
            .map_err(|_| "The terminal registry is unavailable.".to_string())?
            .insert(id, terminal);
        Ok(())
    }

    fn remove(&self, id: &str) -> Option<Arc<Terminal>> {
        self.terminals.lock().ok()?.remove(id)
    }
}

pub fn trim_scrollback(scrollback: &mut Vec<u8>) {
    if scrollback.len() <= MAX_SCROLLBACK_BYTES {
        return;
    }

    let excess = scrollback.len() - MAX_SCROLLBACK_BYTES;
    let cut = scrollback[excess..]
        .iter()
        .position(|byte| *byte == b'\n')
        .map(|offset| excess + offset + 1)
        .unwrap_or(excess);

    scrollback.drain(..cut);
}

pub fn decode_utf8(carry: &mut Vec<u8>, chunk: &[u8]) -> String {
    carry.extend_from_slice(chunk);

    let valid = match std::str::from_utf8(carry) {
        Ok(_) => carry.len(),
        Err(error) if error.error_len().is_none() => error.valid_up_to(),
        Err(_) => carry.len(),
    };
    let decoded = String::from_utf8_lossy(&carry[..valid]).into_owned();

    carry.drain(..valid);
    decoded
}

fn terminal_id(conversation_id: &str) -> String {
    format!("terminal:{conversation_id}")
}

fn size(cols: u16, rows: u16) -> PtySize {
    PtySize {
        rows: rows.clamp(2, 500),
        cols: cols.clamp(2, 1000),
        pixel_width: 0,
        pixel_height: 0,
    }
}

fn spawn_reader(
    id: String,
    terminal: Arc<Terminal>,
    mut reader: Box<dyn Read + Send>,
    registry: TerminalRegistry,
) {
    std::thread::spawn(move || {
        let mut buffer = vec![0u8; READ_CHUNK_BYTES];
        let mut carry = Vec::new();

        loop {
            let read = match reader.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(read) => read,
            };
            let data = decode_utf8(&mut carry, &buffer[..read]);

            if let Ok(mut output) = terminal.output.lock() {
                output.scrollback.extend_from_slice(&buffer[..read]);
                trim_scrollback(&mut output.scrollback);

                if !data.is_empty() {
                    if let Some(channel) = &output.channel {
                        let _ = channel.send(TerminalEvent::Output { data });
                    }
                }
            }
        }

        let code = terminal
            .child
            .lock()
            .ok()
            .and_then(|mut child| child.wait().ok())
            .map(|status| status.exit_code());

        registry.remove(&id);

        if let Ok(output) = terminal.output.lock() {
            if let Some(channel) = &output.channel {
                let _ = channel.send(TerminalEvent::Exited { code });
            }
        }
    });
}

struct SpawnedShell {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    reader: Box<dyn Read + Send>,
    child: Box<dyn Child + Send + Sync>,
}

fn spawn_shell(
    program: &str,
    args: &[&str],
    directory: &std::path::Path,
    size: PtySize,
) -> Result<SpawnedShell, String> {
    let pair = native_pty_system()
        .openpty(size)
        .map_err(|cause| format!("A terminal could not be opened: {cause}"))?;
    let mut command = CommandBuilder::new(program);

    command.args(args);
    command.cwd(directory);
    command.env("TERM", "xterm-256color");

    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|cause| format!("The shell could not start: {cause}"))?;

    drop(pair.slave);

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|cause| cause.to_string())?;
    let writer = pair.master.take_writer().map_err(|cause| cause.to_string())?;

    Ok(SpawnedShell {
        master: pair.master,
        writer,
        reader,
        child,
    })
}

fn default_shell() -> String {
    std::env::var("SHELL")
        .ok()
        .filter(|shell| !shell.is_empty())
        .unwrap_or_else(|| "/bin/zsh".to_string())
}

#[tauri::command]
pub fn terminal_open(
    request: TerminalOpenRequest,
    on_event: Channel<TerminalEvent>,
    directories: State<'_, DirectoryGrants>,
    root: State<'_, WorktreeRoot>,
    registry: State<'_, TerminalRegistry>,
) -> Result<TerminalOpened, String> {
    let TerminalOpenRequest {
        directory_id,
        conversation_id,
        cols,
        rows,
    } = request;
    let id = terminal_id(&conversation_id);

    if let Ok(existing) = registry.get(&id) {
        let mut output = existing
            .output
            .lock()
            .map_err(|_| "The terminal is unavailable.".to_string())?;

        output.channel = Some(on_event);
        let _ = existing
            .master
            .lock()
            .map(|master| master.resize(size(cols, rows)));

        return Ok(TerminalOpened {
            terminal_id: id,
            cwd: existing.cwd.clone(),
            scrollback: String::from_utf8_lossy(&output.scrollback).into_owned(),
        });
    }

    let directory = workspace::resolve(&directories, &root, &directory_id, &conversation_id)?
        .directory();
    let shell = spawn_shell(&default_shell(), &["-l"], &directory, size(cols, rows))?;
    let cwd = directory.to_string_lossy().into_owned();
    let terminal = Arc::new(Terminal {
        cwd: cwd.clone(),
        master: Mutex::new(shell.master),
        writer: Mutex::new(shell.writer),
        child: Mutex::new(shell.child),
        output: Mutex::new(TerminalOutput {
            scrollback: Vec::new(),
            channel: Some(on_event),
        }),
    });

    registry.insert(id.clone(), terminal.clone())?;
    spawn_reader(id.clone(), terminal, shell.reader, registry.inner().clone());

    Ok(TerminalOpened {
        terminal_id: id,
        cwd,
        scrollback: String::new(),
    })
}

#[tauri::command]
pub fn terminal_write(
    terminal_id: String,
    data: String,
    registry: State<'_, TerminalRegistry>,
) -> Result<(), String> {
    let terminal = registry.get(&terminal_id)?;
    let mut writer = terminal
        .writer
        .lock()
        .map_err(|_| "The terminal is unavailable.".to_string())?;

    writer
        .write_all(data.as_bytes())
        .and_then(|_| writer.flush())
        .map_err(|cause| cause.to_string())
}

#[tauri::command]
pub fn terminal_resize(
    terminal_id: String,
    cols: u16,
    rows: u16,
    registry: State<'_, TerminalRegistry>,
) -> Result<(), String> {
    registry
        .get(&terminal_id)?
        .master
        .lock()
        .map_err(|_| "The terminal is unavailable.".to_string())?
        .resize(size(cols, rows))
        .map_err(|cause| cause.to_string())
}

#[tauri::command]
pub fn terminal_close(terminal_id: String, registry: State<'_, TerminalRegistry>) -> Result<(), String> {
    if let Some(terminal) = registry.remove(&terminal_id) {
        if let Ok(mut child) = terminal.child.lock() {
            let _ = child.kill();
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_multibyte_characters_whole_across_reads() {
        let mut carry = Vec::new();
        let text = "héllo";
        let bytes = text.as_bytes();

        let first = decode_utf8(&mut carry, &bytes[..2]);
        let second = decode_utf8(&mut carry, &bytes[2..]);

        assert_eq!(first, "h");
        assert_eq!(format!("{first}{second}"), text);
        assert!(carry.is_empty());
    }

    #[test]
    fn runs_commands_in_a_real_shell_in_the_folder() {
        let directory = std::env::temp_dir().canonicalize().unwrap();
        let mut shell = spawn_shell("/bin/sh", &[], &directory, size(80, 24)).unwrap();
        let mut reader = shell.reader;
        let (sender, receiver) = std::sync::mpsc::channel();

        std::thread::spawn(move || {
            let mut buffer = [0u8; 4096];

            while let Ok(read) = reader.read(&mut buffer) {
                if read == 0 || sender.send(buffer[..read].to_vec()).is_err() {
                    break;
                }
            }
        });

        shell
            .writer
            .write_all(b"echo polychat-$((40 + 2)); pwd\n")
            .unwrap();
        shell.writer.flush().unwrap();

        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
        let mut output = String::new();

        while !(output.contains("polychat-42\r\n") && output.contains("private")) {
            let remaining = deadline.saturating_duration_since(std::time::Instant::now());

            match receiver.recv_timeout(remaining) {
                Ok(chunk) => output.push_str(&String::from_utf8_lossy(&chunk)),
                Err(_) => panic!("the shell didn't answer in time: {output:?}"),
            }
        }

        let _ = shell.child.kill();

        assert!(output.contains("polychat-42"));
    }

    #[test]
    fn sees_the_end_of_output_when_the_shell_exits() {
        let directory = std::env::temp_dir().canonicalize().unwrap();
        let mut shell = spawn_shell("/bin/sh", &[], &directory, size(80, 24)).unwrap();
        let mut reader = shell.reader;
        let (sender, receiver) = std::sync::mpsc::channel();

        std::thread::spawn(move || {
            let mut buffer = [0u8; 4096];

            loop {
                match reader.read(&mut buffer) {
                    Ok(0) | Err(_) => break,
                    Ok(_) => {}
                }
            }

            let _ = sender.send(());
        });

        shell.writer.write_all(b"exit\n").unwrap();
        shell.writer.flush().unwrap();

        assert!(receiver
            .recv_timeout(std::time::Duration::from_secs(10))
            .is_ok());
        let _ = shell.child.wait();
    }

    #[test]
    fn trims_scrollback_at_a_line_boundary() {
        let mut scrollback = vec![b'x'; MAX_SCROLLBACK_BYTES];

        scrollback.extend_from_slice(b"\nlatest line\n");
        trim_scrollback(&mut scrollback);

        assert!(scrollback.len() <= MAX_SCROLLBACK_BYTES);
        assert!(scrollback.ends_with(b"latest line\n"));
    }
}
