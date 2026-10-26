import {
  formatRealtimeSpeakerLabel,
  type RealtimeTranscriptResult,
} from "@ngriffin_uk/polychat-library-realtime/messages";
import { type Dispatch, type SetStateAction, useCallback, useRef, useState } from "react";

import {
  appendDictation,
  countSentences,
  DICTATION_PARAGRAPH_SENTENCES,
  DICTATION_PARAGRAPH_TURN_SENTENCES,
  joinTranscriptFragment,
  splitFinishedSentences,
  unwrittenRemainder,
} from "../dictation.js";

interface DictationTurn {
  heard: string;
  writtenLength: number;
  written: string;
  sentences: number;
}

const EMPTY_TURN: DictationTurn = { heard: "", writtenLength: 0, written: "", sentences: 0 };

export function useDictationWriter({
  setText,
  takeParagraphBreak,
}: {
  setText: Dispatch<SetStateAction<string>>;
  takeParagraphBreak: () => boolean;
}) {
  const [pending, setPending] = useState("");
  const turnRef = useRef<DictationTurn>(EMPTY_TURN);
  const sentencesRef = useRef(0);
  const breakAfterTurnRef = useRef(false);
  const lastSpeakerRef = useRef<string | undefined>(undefined);

  const write = useCallback(
    (phrase: string, speaker: string | undefined) => {
      const speakerChanged = speaker !== undefined && speaker !== lastSpeakerRef.current;
      const startsParagraph =
        takeParagraphBreak() ||
        breakAfterTurnRef.current ||
        speakerChanged ||
        sentencesRef.current >= DICTATION_PARAGRAPH_SENTENCES;
      const entry = speakerChanged ? `${formatRealtimeSpeakerLabel(speaker)}: ${phrase}` : phrase;

      if (speakerChanged) {
        lastSpeakerRef.current = speaker;
      }

      const sentences = countSentences(phrase);

      breakAfterTurnRef.current = false;
      sentencesRef.current = (startsParagraph ? 0 : sentencesRef.current) + sentences;
      turnRef.current = { ...turnRef.current, sentences: turnRef.current.sentences + sentences };
      setText((current) => appendDictation(current, entry, startsParagraph));
    },
    [setText, takeParagraphBreak],
  );

  const writeFinishedSentences = useCallback(
    (speaker: string | undefined) => {
      const turn = turnRef.current;
      const { finished, rest } = splitFinishedSentences(turn.heard.slice(turn.writtenLength));

      if (finished.trim()) {
        write(finished.trim(), speaker);
        turnRef.current = {
          ...turnRef.current,
          heard: turn.heard,
          writtenLength: turn.writtenLength + finished.length,
          written: `${turn.written} ${finished}`,
        };
      }

      setPending(rest.trim());
    },
    [write],
  );

  const handleTranscript = useCallback(
    (transcript: RealtimeTranscriptResult) => {
      if (transcript.source === "output") {
        return;
      }

      const speaker = transcript.speaker;

      if (!transcript.isFinal) {
        const heard = transcript.isDelta
          ? joinTranscriptFragment(turnRef.current.heard, transcript.text)
          : transcript.text;

        turnRef.current = { ...turnRef.current, heard };
        writeFinishedSentences(speaker);

        return;
      }

      if (speaker === undefined && lastSpeakerRef.current !== undefined) {
        return;
      }

      const finalText = transcript.isDelta
        ? joinTranscriptFragment(turnRef.current.heard, transcript.text)
        : transcript.text;
      const remainder = unwrittenRemainder(finalText, turnRef.current.written);

      if (remainder) {
        write(remainder, speaker);
      }

      breakAfterTurnRef.current = turnRef.current.sentences >= DICTATION_PARAGRAPH_TURN_SENTENCES;
      turnRef.current = EMPTY_TURN;
      setPending("");
    },
    [write, writeFinishedSentences],
  );

  const finish = useCallback(() => {
    const turn = turnRef.current;
    const remainder = turn.heard.slice(turn.writtenLength).trim();

    if (remainder) {
      write(remainder, lastSpeakerRef.current);
    }

    turnRef.current = EMPTY_TURN;
    setPending("");
  }, [write]);

  const reset = useCallback(() => {
    turnRef.current = EMPTY_TURN;
    sentencesRef.current = 0;
    breakAfterTurnRef.current = false;
    lastSpeakerRef.current = undefined;
    setPending("");
  }, []);

  return { pending, handleTranscript, finish, reset };
}
