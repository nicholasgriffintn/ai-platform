import { useRef, useState } from "react";

import { apiService } from "~/lib/api/api-service";

interface UseVoiceRecorderProps {
  onTranscribe: (data: {
    response: {
      content: string;
    };
  }) => void;
}

export function useVoiceRecorder({ onTranscribe }: UseVoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        try {
          setIsTranscribing(true);

          if (!chunksRef?.current) {
            throw new Error("No audio provided.");
          }

          const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
          const data = await apiService.transcribeAudio(audioBlob);

          await onTranscribe(data);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
      setIsRecording(false);
    }
  };

  return {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
  };
}
