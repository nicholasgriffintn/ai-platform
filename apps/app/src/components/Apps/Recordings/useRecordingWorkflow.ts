import {
  type RecordingFormData,
  RecordingWorkflowStep,
} from "@ngriffin_uk/polychat-component-experiences/content";
import {
  useProcessRecording,
  useUploadRecording,
  getErrorMessage,
} from "@ngriffin_uk/polychat-library-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

type RecordingProcess = "transcribe" | "summarise" | "generate-image";
type ProcessingKey = "transcribing" | "summarizing" | "generatingImage";
type ProcessingStatus = Record<ProcessingKey, boolean>;
type ProcessingErrors = Record<ProcessingKey, string | null>;

const INITIAL_FORM_DATA: RecordingFormData = {
  title: "",
  description: "",
  audioFile: null,
  audioUrl: "",
  audioSource: "file",
  transcribe: true,
  summarise: true,
  generateImage: true,
  imagePrompt: "",
  transcribePrompt: "Transcribe this recording",
  numberOfSpeakers: 2,
  speakers: { "1": "Speaker 1", "2": "Speaker 2" },
};

const EMPTY_STATUS: ProcessingStatus = {
  transcribing: false,
  summarizing: false,
  generatingImage: false,
};

const EMPTY_ERRORS: ProcessingErrors = {
  transcribing: null,
  summarizing: null,
  generatingImage: null,
};

function getProcessingKey(process: RecordingProcess): ProcessingKey {
  if (process === "transcribe") {
    return "transcribing";
  }

  if (process === "summarise") {
    return "summarizing";
  }

  return "generatingImage";
}

function allRequestedProcessesComplete(
  formData: RecordingFormData,
  complete: ProcessingStatus,
): boolean {
  return (
    (!formData.transcribe || complete.transcribing) &&
    (!formData.summarise || complete.summarizing) &&
    (!formData.generateImage || complete.generatingImage)
  );
}

export function useRecordingWorkflow(basePath: string, projectId?: string) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(RecordingWorkflowStep.Upload);
  const [formData, setFormData] = useState<RecordingFormData>(INITIAL_FORM_DATA);
  const [uploadedRecordingId, setUploadedRecordingId] = useState("");
  const [processingStatus, setProcessingStatus] = useState(EMPTY_STATUS);
  const [processingErrors, setProcessingErrors] = useState(EMPTY_ERRORS);
  const [processingComplete, setProcessingComplete] = useState(EMPTY_STATUS);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const uploadRecording = useUploadRecording(projectId);
  const processRecording = useProcessRecording(projectId);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value, type } = event.target;

      if (type === "checkbox") {
        const { checked } = event.target as HTMLInputElement;

        setFormData((current) => ({ ...current, [name]: checked }));

        return;
      }

      if (name.startsWith("speaker_")) {
        const speakerId = name.replace("speaker_", "");

        setFormData((current) => ({
          ...current,
          speakers: { ...current.speakers, [speakerId]: value },
        }));

        return;
      }

      if (name === "numberOfSpeakers") {
        setFormData((current) => ({ ...current, numberOfSpeakers: Number(value) }));

        return;
      }

      setFormData((current) => ({ ...current, [name]: value }));
    },
    [],
  );

  useEffect(() => {
    setFormData((current) => {
      if (Object.keys(current.speakers).length === current.numberOfSpeakers) {
        return current;
      }

      const speakers = Object.fromEntries(
        Array.from({ length: current.numberOfSpeakers }, (_, index) => {
          const speakerId = String(index + 1);

          return [speakerId, current.speakers[speakerId] ?? `Speaker ${speakerId}`];
        }),
      );

      return { ...current, speakers };
    });
  }, [formData.numberOfSpeakers]);

  const upload = useCallback(async () => {
    if (!formData.title.trim()) {
      return;
    }

    if (formData.audioSource === "file" && !formData.audioFile) {
      return;
    }

    if (formData.audioSource === "url" && !formData.audioUrl.trim()) {
      return;
    }

    setWorkflowError(null);
    try {
      const result = await uploadRecording.mutateAsync({
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        ...(formData.audioSource === "file"
          ? { audio: formData.audioFile ?? undefined }
          : { audioUrl: formData.audioUrl.trim() }),
      });
      const recordingId = result.response.completion_id;

      setUploadedRecordingId(recordingId);
      setCurrentStep(RecordingWorkflowStep.Process);
    } catch (error) {
      setWorkflowError(getErrorMessage(error, "Upload failed."));
    }
  }, [formData, uploadRecording]);

  const runProcess = useCallback(
    async (process: RecordingProcess): Promise<boolean> => {
      if (!uploadedRecordingId) {
        return false;
      }

      const key = getProcessingKey(process);

      setProcessingErrors((current) => ({ ...current, [key]: null }));
      setProcessingStatus((current) => ({ ...current, [key]: true }));
      try {
        await processRecording.mutateAsync({
          recordingId: uploadedRecordingId,
          action: process,
          ...(process === "transcribe"
            ? {
                numberOfSpeakers: Number(formData.numberOfSpeakers),
                prompt: formData.transcribePrompt,
              }
            : {}),
          ...(process === "summarise" ? { speakers: formData.speakers } : {}),
          ...(process === "generate-image" ? { prompt: formData.imagePrompt } : {}),
        });
        setProcessingComplete((current) => ({ ...current, [key]: true }));

        return true;
      } catch (error) {
        setProcessingErrors((current) => ({
          ...current,
          [key]: getErrorMessage(error, `${process} failed.`),
        }));

        return false;
      } finally {
        setProcessingStatus((current) => ({ ...current, [key]: false }));
      }
    },
    [formData, processRecording, uploadedRecordingId],
  );

  const process = useCallback(async () => {
    if (!uploadedRecordingId) {
      return;
    }

    setProcessingErrors(EMPTY_ERRORS);
    setProcessingComplete(EMPTY_STATUS);
    setCurrentStep(RecordingWorkflowStep.Processing);
    const requested: RecordingProcess[] = [
      ...(formData.transcribe ? (["transcribe"] as const) : []),
      ...(formData.summarise ? (["summarise"] as const) : []),
      ...(formData.generateImage ? (["generate-image"] as const) : []),
    ];

    for (const action of requested) {
      if (!(await runProcess(action))) {
        return;
      }
    }

    void navigate(`${basePath}/${uploadedRecordingId}`);
  }, [basePath, formData, navigate, runProcess, uploadedRecordingId]);

  const retry = useCallback(
    async (processToRetry: RecordingProcess) => {
      if (!(await runProcess(processToRetry))) {
        return;
      }

      const complete = {
        ...processingComplete,
        [getProcessingKey(processToRetry)]: true,
      };

      if (allRequestedProcessesComplete(formData, complete)) {
        void navigate(`${basePath}/${uploadedRecordingId}`);
      }
    },
    [basePath, formData, navigate, processingComplete, runProcess, uploadedRecordingId],
  );

  return {
    currentStep,
    formData,
    isProcessing: processRecording.isPending,
    isUploading: uploadRecording.isPending,
    processingComplete,
    processingErrors,
    processingStatus,
    setCurrentStep,
    setFormData,
    uploadedRecordingId,
    workflowError,
    actions: {
      handleChange,
      handleFileChange: (file: File) => setFormData((current) => ({ ...current, audioFile: file })),
      process,
      retry,
      upload,
    },
  };
}
