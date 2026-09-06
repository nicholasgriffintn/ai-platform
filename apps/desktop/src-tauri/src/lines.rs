pub const MAX_STREAM_LINE: usize = 1024 * 1024;

#[derive(Default)]
pub struct LineReader {
    buffer: Vec<u8>,
}

impl LineReader {
    pub fn push(&mut self, piece: &[u8]) {
        self.buffer.extend_from_slice(piece);
    }

    pub fn overflowed(&self) -> bool {
        self.buffer.len() > MAX_STREAM_LINE
    }

    pub fn next_line(&mut self) -> Option<String> {
        let index = self.buffer.iter().position(|byte| *byte == b'\n')?;
        let line: Vec<u8> = self.buffer.drain(..=index).collect();

        Some(String::from_utf8_lossy(&line).into_owned())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn joins_a_character_split_across_two_chunks() {
        let text = "héllo wörld ✨\n";
        let bytes = text.as_bytes();
        let mut reader = LineReader::default();

        for byte in bytes {
            reader.push(&[*byte]);
        }

        assert_eq!(reader.next_line().as_deref(), Some(text));
    }

    #[test]
    fn returns_nothing_until_a_line_is_complete() {
        let mut reader = LineReader::default();

        reader.push(b"partial");

        assert!(reader.next_line().is_none());

        reader.push(b" line\n");

        assert_eq!(reader.next_line().as_deref(), Some("partial line\n"));
    }

    #[test]
    fn hands_back_every_line_in_a_chunk_that_carried_several() {
        let mut reader = LineReader::default();

        reader.push(b"one\ntwo\nthree");

        assert_eq!(reader.next_line().as_deref(), Some("one\n"));
        assert_eq!(reader.next_line().as_deref(), Some("two\n"));
        assert!(reader.next_line().is_none());
    }

    #[test]
    fn reports_a_line_that_grows_past_what_it_will_hold() {
        let mut reader = LineReader::default();

        assert!(!reader.overflowed());

        reader.push(&vec![b'x'; MAX_STREAM_LINE + 1]);

        assert!(reader.overflowed());
    }
}
