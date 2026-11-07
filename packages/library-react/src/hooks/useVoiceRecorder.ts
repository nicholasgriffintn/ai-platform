import { apiService } from "@ngriffin_uk/polychat-library-client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface UseVoiceRecorderProps {
  onTranscribe: (data: {
    response: {
      content: string;
    };
  }) => void | Promise<void>;
}

function releaseRecorder(recorder: MediaRecorder) {
  if (recorder.state !== "inactive") {
    recorder.stop();
  }

  recorder.stream.getTracks().forEach((track) => track.stop());
}

export function useVoiceRecorder({ onTranscribe }: UseVoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const isStartingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      const recorder = mediaRecorderRef.current;

      if (recorder) {
        mediaRecorderRef.current = null;
        recorder.onstop = null;
        releaseRecorder(recorder);
      }
    };
  }, []);

  const startRecording = async () => {
    if (isStartingRef.current || mediaRecorderRef.current) {
      return;
    }

    isStartingRef.current = true;

    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());

        return;
      }

      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        if (mediaRecorderRef.current === mediaRecorder) {
          mediaRecorderRef.current = null;
          releaseRecorder(mediaRecorder);
          setIsRecording(false);
        }

        try {
          setIsTranscribing(true);

          const audioBlob = new Blob(chunks, { type: "audio/webm" });
          const data = await apiService.transcribeAudio(audioBlob);

          await onTranscribe(data);
        } catch (error) {
          console.error("Error transcribing recording:", error);
          toast.error("Your recording could not be transcribed");
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());

      console.error("Error starting recording:", error);
      toast.error("The microphone could not be started");
    } finally {
      isStartingRef.current = false;
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;

    if (!recorder) {
      return;
    }

    mediaRecorderRef.current = null;
    releaseRecorder(recorder);
    setIsRecording(false);
  };

  return {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
  };
}
