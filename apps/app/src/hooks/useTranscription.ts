import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { fetchApi } from "~/lib/api/fetch-wrapper";

interface TranscriptionOptions {
  onTranscriptionReceived: (text: string, isPartial?: boolean) => void;
  onSpeechDetected?: (isActive: boolean) => void;
  inputStream?: MediaStream;
}

export function useTranscription({
  onTranscriptionReceived,
  onSpeechDetected,
  inputStream,
}: TranscriptionOptions) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "connecting" | "active" | "reconnecting" | "error"
  >("idle");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const connectionTimeoutRef = useRef<number | null>(null);
  const connectionMonitorRef = useRef<number | null>(null);
  const retryCountRef = useRef<number>(0);
  const transcriptBufferRef = useRef<string>("");
  const lastProcessedItemsRef = useRef<Set<string>>(new Set());
  const pendingDeltasRef = useRef<Map<string, string>>(new Map());
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const speechDetectionIntervalRef = useRef<number | null>(null);

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;
  const SPEECH_DETECTION_THRESHOLD = 0.05;
  const SILENCE_DURATION_THRESHOLD = 1500; // 1.5 seconds of silence before considering speech stopped

  const lastSpeechTimeRef = useRef<number>(0);
  const isSpeechActiveRef = useRef<boolean>(false);

  const getOptimalAudioStream = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    try {
      const audioTrack = stream.getAudioTracks()[0];
      await audioTrack.applyConstraints({
        autoGainControl: true,
        noiseSuppression: true,
        echoCancellation: true,
        sampleRate: 16000,
        channelCount: 1,
      });
    } catch (err) {
      console.warn("Using default audio constraints", err);
    }

    return stream;
  };

  const setupAudioAnalysis = (stream: MediaStream) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audioContext = audioContextRef.current;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;

      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);

      audioAnalyserRef.current = analyser;

      if (speechDetectionIntervalRef.current) {
        clearInterval(speechDetectionIntervalRef.current);
      }

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      speechDetectionIntervalRef.current = window.setInterval(() => {
        if (!analyser) return;

        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length / 255;

        const now = Date.now();
        const isSpeaking = average > SPEECH_DETECTION_THRESHOLD;

        if (isSpeaking) {
          lastSpeechTimeRef.current = now;

          if (!isSpeechActiveRef.current) {
            isSpeechActiveRef.current = true;
            onSpeechDetected?.(true);
          }
        } else if (
          isSpeechActiveRef.current &&
          now - lastSpeechTimeRef.current > SILENCE_DURATION_THRESHOLD
        ) {
          isSpeechActiveRef.current = false;
          onSpeechDetected?.(false);
        }
      }, 100);
    } catch (err) {
      console.error("Error setting up audio analysis:", err);
    }
  };

  const monitorConnection = (pc: RTCPeerConnection) => {
    if (connectionMonitorRef.current) {
      clearInterval(connectionMonitorRef.current);
    }

    connectionMonitorRef.current = window.setInterval(async () => {
      if (!pc || pc.connectionState === "closed") {
        if (connectionMonitorRef.current) {
          clearInterval(connectionMonitorRef.current);
          connectionMonitorRef.current = null;
        }
        return;
      }

      try {
        const stats = await pc.getStats();
        let packetLoss = 0;
        let jitter = 0;
        let audioLevel = 0;

        for (const report of stats) {
          if (report[1].type === "outbound-rtp" && report[1].kind === "audio") {
            if (report[1].packetsSent && report[1].packetsLost) {
              packetLoss = report[1].packetsLost / report[1].packetsSent;
            }
          }
          if (report[1].type === "remote-inbound-rtp") {
            jitter = report[1].jitter;
          }
          if (report[1].type === "media-source" && report[1].kind === "audio") {
            audioLevel = report[1].audioLevel;
          }
        }

        console.info(
          `Connection quality: Jitter=${jitter}ms, PacketLoss=${packetLoss * 100}%, AudioLevel=${audioLevel}`,
        );

        if (jitter > 30 || packetLoss > 0.1) {
          console.warn("Poor connection quality detected!");
        }
      } catch (err) {
        console.error("Failed to get connection stats", err);
      }
    }, 5000);
  };

  const processTranscriptText = (inputText: string, buffer: string) => {
    const cleanedText = inputText
      .replace(/\[Music\]/gi, "")
      .replace(/\[Background Noise\]/gi, "")
      .replace(/\[\s*[^\]]*\s*\]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanedText) return "";

    const paragraphEndRegex = /([.!?])\s+/g;
    const sentences = cleanedText.split(paragraphEndRegex);
    const paragraphs: string[] = [];

    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i];
      const punctuation = sentences[i + 1] || "";
      const full = (sentence + punctuation).trim();

      if (full.length > 5 && !buffer.includes(full)) {
        paragraphs.push(full);
      }
    }

    return paragraphs.join("\n\n");
  };

  const startTranscription = async (externalStream?: MediaStream) => {
    if (isTranscribing) {
      console.warn("Transcription already in progress");
      return;
    }

    stopTranscription(false);

    setIsTranscribing(true);
    setStatus("connecting");
    retryCountRef.current = 0;
    transcriptBufferRef.current = "";
    lastProcessedItemsRef.current.clear();
    pendingDeltasRef.current.clear();
    isSpeechActiveRef.current = false;
    lastSpeechTimeRef.current = 0;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const sessionRes = await fetchApi("/realtime/session/transcription", {
        method: "POST",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!sessionRes.ok) {
        throw new Error(
          `Failed to create realtime session: ${sessionRes.status}`,
        );
      }

      const sessionJson = (await sessionRes.json()) as {
        data: {
          client_secret: { value: string };
          id: string;
          input_audio_transcription?: { model: string };
          model: string;
        };
      };

      if (!sessionJson.data?.client_secret?.value) {
        throw new Error("Invalid session response");
      }

      const session = sessionJson.data;
      const clientSecret = session.client_secret.value;
      const sessionId = session.id;

      const stream =
        externalStream ?? inputStream ?? (await getOptimalAudioStream());
      mediaStreamRef.current = stream;

      setupAudioAnalysis(stream);

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
        ],
        iceTransportPolicy: "all",
        rtcpMuxPolicy: "require",
        bundlePolicy: "max-bundle",
        iceCandidatePoolSize: 10,
      });

      pcRef.current = pc;

      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      pc.oniceconnectionstatechange = () => {
        switch (pc.iceConnectionState) {
          case "connected":
          case "completed":
            setStatus("active");
            break;

          case "disconnected":
            setStatus("reconnecting");
            toast.warning("Connection interrupted - attempting to recover");
            setTimeout(() => {
              if (pc.iceConnectionState === "disconnected" && isTranscribing) {
                try {
                  pc.restartIce();
                } catch (err) {
                  console.error("Failed to restart ICE", err);
                }
              }
            }, 2000);
            break;

          case "failed":
            setStatus("error");
            toast.error("Connection lost - retrying");
            if (retryCountRef.current < MAX_RETRIES) {
              retryCountRef.current++;
              setTimeout(() => {
                if (isTranscribing) {
                  stopTranscription(false);
                  startTranscription();
                }
              }, RETRY_DELAY);
            } else {
              toast.error(
                "Failed to establish a stable connection after multiple attempts.",
              );
              stopTranscription(true);
            }
            break;

          case "closed":
            if (isTranscribing) {
              setStatus("idle");
            }
            break;
        }
      };

      monitorConnection(pc);

      const dc = pc.createDataChannel("oai-events", {
        ordered: true,
        maxRetransmits: 10,
      });
      dcRef.current = dc;

      dc.onopen = () => {
        setStatus("active");
      };

      dc.onclose = () => {
        if (isTranscribing) {
          setStatus("reconnecting");
        } else {
          setStatus("idle");
        }
      };

      dc.onerror = (err) => {
        console.error("Data channel error:", err);
        setStatus("error");
      };

      dc.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch (err) {
          console.error("Failed to parse transcription message", err);
          return;
        }

        const {
          item_id: itemId,
          type,
          delta,
          transcript,
        } = msg as {
          item_id: string;
          type: string;
          delta?: string;
          transcript?: string;
        };

        if (lastProcessedItemsRef.current.has(itemId)) {
          return;
        }

        if (type.endsWith(".delta") && typeof delta === "string") {
          const processedDelta = delta.trim();

          if (processedDelta) {
            const existingDelta = pendingDeltasRef.current.get(itemId) || "";
            const needsSpace = existingDelta && !existingDelta.endsWith(" ");
            const updatedDelta =
              existingDelta + (needsSpace ? " " : "") + processedDelta;
            pendingDeltasRef.current.set(itemId, updatedDelta);

            onTranscriptionReceived(processedDelta, true);
          }
        } else if (
          type.endsWith(".completed") &&
          typeof transcript === "string"
        ) {
          lastProcessedItemsRef.current.add(itemId);

          const hasPendingDelta = pendingDeltasRef.current.has(itemId);
          if (hasPendingDelta) {
            pendingDeltasRef.current.delete(itemId);
          }

          const processedText = processTranscriptText(
            transcript,
            transcriptBufferRef.current,
          );

          if (processedText) {
            const needsSpace =
              transcriptBufferRef.current &&
              !transcriptBufferRef.current.endsWith(" ");
            transcriptBufferRef.current +=
              (needsSpace ? " " : "") + processedText;

            onTranscriptionReceived(processedText, false);
          }
        }
      };

      const baseUrl = "https://api.openai.com/v1/realtime";

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });

      await pc.setLocalDescription(offer);

      const answerController = new AbortController();
      const answerTimeoutId = setTimeout(() => answerController.abort(), 10000);

      const answerRes = await fetch(`${baseUrl}?session_id=${sessionId}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          "Content-Type": "application/sdp",
        },
        signal: answerController.signal,
      });

      clearTimeout(answerTimeoutId);

      if (!answerRes.ok) {
        throw new Error(`Failed to get SDP answer: ${answerRes.status}`);
      }

      const answerSdp = await answerRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (err) {
      console.error("Error starting transcription:", err);
      toast.error(
        `Transcription error: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
      stopTranscription(true);
      setStatus("error");
    }
  };

  const stopTranscription = (showToast = true) => {
    if (showToast) {
      setIsTranscribing(false);
      setStatus("idle");
    }

    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    if (connectionMonitorRef.current) {
      clearInterval(connectionMonitorRef.current);
      connectionMonitorRef.current = null;
    }

    if (speechDetectionIntervalRef.current) {
      clearInterval(speechDetectionIntervalRef.current);
      speechDetectionIntervalRef.current = null;
    }

    if (audioContextRef.current?.state !== "closed") {
      try {
        audioContextRef.current?.suspend();
      } catch (err) {
        console.error("Error suspending audio context:", err);
      }
    }

    audioAnalyserRef.current = null;

    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }

    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (err) {
        console.error("Error closing peer connection:", err);
      } finally {
        pcRef.current = null;
      }
    }

    if (mediaStreamRef.current) {
      const tracks = mediaStreamRef.current.getTracks();

      for (const track of tracks) {
        try {
          track.stop();
        } catch (err) {
          console.error("Error stopping media track:", err);
        }
      }

      mediaStreamRef.current = null;
    }

    pendingDeltasRef.current.clear();

    if (isSpeechActiveRef.current) {
      isSpeechActiveRef.current = false;
      onSpeechDetected?.(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    return () => {
      stopTranscription(false);
    };
  }, []);

  return {
    isTranscribing,
    status,
    startTranscription,
    stopTranscription,
  };
}
