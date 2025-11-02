import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import {
  ProcessStep,
  ProcessingStep,
  ProgressStepper,
  UploadStep,
} from "~/components/Apps/Podcasts";
import { BackLink } from "~/components/Core/BackLink";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import { useProcessPodcast, useUploadPodcast } from "~/hooks/usePodcasts";
import type { PodcastFormData } from "~/types/podcast";

export function meta() {
  return [
    { title: "Upload Podcast - Polychat" },
    { name: "description", content: "Upload and process your podcast" },
  ];
}

export enum Step {
  Upload = 0,
  Process = 1,
  Processing = 2,
}

export default function NewPodcastPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>(Step.Upload);
  const [formData, setFormData] = useState<PodcastFormData>({
    title: "",
    description: "",
    audioFile: null,
    audioUrl: "",
    audioSource: "file",
    transcribe: true,
    summarise: true,
    generateImage: true,
    imagePrompt: "",
    transcribePrompt: "Transcribe this podcast",
    numberOfSpeakers: 2,
    speakers: { "1": "Speaker 1", "2": "Speaker 2" },
  });
  const [uploadedPodcastId, setUploadedPodcastId] = useState<string>("");
  const [processingStatus, setProcessingStatus] = useState<{
    transcribing: boolean;
    summarizing: boolean;
    generatingImage: boolean;
  }>({
    transcribing: false,
    summarizing: false,
    generatingImage: false,
  });

  const [processingErrors, setProcessingErrors] = useState<{
    transcribing: string | null;
    summarizing: string | null;
    generatingImage: string | null;
  }>({
    transcribing: null,
    summarizing: null,
    generatingImage: null,
  });

  const [processingComplete, setProcessingComplete] = useState<{
    transcribing: boolean;
    summarizing: boolean;
    generatingImage: boolean;
  }>({
    transcribing: false,
    summarizing: false,
    generatingImage: false,
  });

  const { mutateAsync: uploadPodcast, isPending: isUploading } =
    useUploadPodcast();
  const { mutateAsync: processPodcast, isPending: isProcessing } =
    useProcessPodcast();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value, type } = e.target;
      if (type === "checkbox") {
        const { checked } = e.target as HTMLInputElement;
        setFormData((prev) => ({ ...prev, [name]: checked }));
      } else if (name.startsWith("speaker_")) {
        const speakerId = name.replace("speaker_", "");
        setFormData((prev) => ({
          ...prev,
          speakers: { ...prev.speakers, [speakerId]: value },
        }));
      } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
      }
    },
    [],
  );

  const handleFileChange = useCallback((file: File) => {
    setFormData((prev) => ({ ...prev, audioFile: file }));
  }, []);

  const handleUpload = useCallback(async () => {
    if (!formData.title) return;
    if (formData.audioSource === "file" && !formData.audioFile) return;
    if (formData.audioSource === "url" && !formData.audioUrl) return;

    try {
      const uploadData = {
        title: formData.title,
        description: formData.description,
      };

      if (formData.audioSource === "file") {
        Object.assign(uploadData, { audio: formData.audioFile });
      } else {
        Object.assign(uploadData, { audioUrl: formData.audioUrl });
      }

      const result = await uploadPodcast(uploadData);

      if (result?.response?.completion_id) {
        setUploadedPodcastId(result.response.completion_id);
        setCurrentStep(Step.Process);
      }
    } catch (error) {
      console.error("Upload failed:", error);
    }
  }, [formData, uploadPodcast]);

  const handleRetry = useCallback(
    async (process: "transcribe" | "summarise" | "generate-image") => {
      if (!uploadedPodcastId) return;

      try {
        setProcessingErrors((prev) => ({
          ...prev,
          [process === "generate-image" ? "generatingImage" : `${process}ing`]:
            null,
        }));

        if (process === "transcribe") {
          setProcessingStatus((prev) => ({ ...prev, transcribing: true }));
          await processPodcast({
            podcastId: uploadedPodcastId,
            action: "transcribe",
            numberOfSpeakers: Number(formData.numberOfSpeakers),
            prompt: formData.transcribePrompt,
          });
          setProcessingStatus((prev) => ({ ...prev, transcribing: false }));
          setProcessingComplete((prev) => ({ ...prev, transcribing: true }));
        } else if (process === "summarise") {
          setProcessingStatus((prev) => ({ ...prev, summarizing: true }));
          await processPodcast({
            podcastId: uploadedPodcastId,
            action: "summarise",
            speakers: formData.speakers,
          });
          setProcessingStatus((prev) => ({ ...prev, summarizing: false }));
          setProcessingComplete((prev) => ({ ...prev, summarizing: true }));
        } else if (process === "generate-image") {
          setProcessingStatus((prev) => ({ ...prev, generatingImage: true }));
          await processPodcast({
            podcastId: uploadedPodcastId,
            action: "generate-image",
            prompt: formData.imagePrompt,
          });
          setProcessingStatus((prev) => ({ ...prev, generatingImage: false }));
          setProcessingComplete((prev) => ({ ...prev, generatingImage: true }));
        }

        const allComplete = () => {
          const processes = {
            transcribe: formData.transcribe,
            summarise: formData.summarise,
            generateImage: formData.generateImage,
          };

          return Object.entries(processes).every(([key, isRequested]) => {
            if (!isRequested) return true;
            const completionKey =
              key === "generateImage" ? "generatingImage" : `${key}ing`;
            return processingComplete[
              completionKey as keyof typeof processingComplete
            ];
          });
        };

        if (allComplete()) {
          navigate(`/apps/podcasts/${uploadedPodcastId}`);
        }
      } catch (error) {
        console.error(`${process} failed:`, error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        setProcessingErrors((prev) => ({
          ...prev,
          [process === "generate-image" ? "generatingImage" : `${process}ing`]:
            errorMessage,
        }));
      }
    },
    [formData, uploadedPodcastId, processPodcast, navigate, processingComplete],
  );

  const handleProcess = useCallback(async () => {
    if (!uploadedPodcastId) return;

    setProcessingErrors({
      transcribing: null,
      summarizing: null,
      generatingImage: null,
    });

    setProcessingComplete({
      transcribing: false,
      summarizing: false,
      generatingImage: false,
    });

    setCurrentStep(Step.Processing);

    if (formData.transcribe) {
      try {
        setProcessingStatus((prev) => ({ ...prev, transcribing: true }));
        await processPodcast({
          podcastId: uploadedPodcastId,
          action: "transcribe",
          numberOfSpeakers: Number(formData.numberOfSpeakers),
          prompt: formData.transcribePrompt,
        });
        setProcessingStatus((prev) => ({ ...prev, transcribing: false }));
        setProcessingComplete((prev) => ({ ...prev, transcribing: true }));
      } catch (error) {
        console.error("Transcription failed:", error);
        setProcessingStatus((prev) => ({ ...prev, transcribing: false }));
        setProcessingErrors((prev) => ({
          ...prev,
          transcribing:
            error instanceof Error ? error.message : "Transcription failed",
        }));
        return;
      }
    } else {
      setProcessingComplete((prev) => ({ ...prev, transcribing: true }));
    }

    if (formData.summarise) {
      try {
        setProcessingStatus((prev) => ({ ...prev, summarizing: true }));
        await processPodcast({
          podcastId: uploadedPodcastId,
          action: "summarise",
          speakers: formData.speakers,
        });
        setProcessingStatus((prev) => ({ ...prev, summarizing: false }));
        setProcessingComplete((prev) => ({ ...prev, summarizing: true }));
      } catch (error) {
        console.error("Summarization failed:", error);
        setProcessingStatus((prev) => ({ ...prev, summarizing: false }));
        setProcessingErrors((prev) => ({
          ...prev,
          summarizing:
            error instanceof Error ? error.message : "Summarization failed",
        }));
        return;
      }
    } else {
      setProcessingComplete((prev) => ({ ...prev, summarizing: true }));
    }

    if (formData.generateImage) {
      try {
        setProcessingStatus((prev) => ({ ...prev, generatingImage: true }));
        await processPodcast({
          podcastId: uploadedPodcastId,
          action: "generate-image",
          prompt: formData.imagePrompt,
        });
        setProcessingStatus((prev) => ({ ...prev, generatingImage: false }));
        setProcessingComplete((prev) => ({ ...prev, generatingImage: true }));
      } catch (error) {
        console.error("Image generation failed:", error);
        setProcessingStatus((prev) => ({ ...prev, generatingImage: false }));
        setProcessingErrors((prev) => ({
          ...prev,
          generatingImage:
            error instanceof Error ? error.message : "Image generation failed",
        }));
        return;
      }
    } else {
      setProcessingComplete((prev) => ({ ...prev, generatingImage: true }));
    }

    navigate(`/apps/podcasts/${uploadedPodcastId}`);
  }, [formData, uploadedPodcastId, processPodcast, navigate]);

  useEffect(() => {
    const updateSpeakers = () => {
      const currentSpeakerCount = Object.keys(formData.speakers).length;

      if (currentSpeakerCount !== formData.numberOfSpeakers) {
        const newSpeakers: Record<string, string> = {};
        for (let i = 1; i <= formData.numberOfSpeakers; i++) {
          const speakerId = i.toString();
          newSpeakers[speakerId] =
            formData.speakers[speakerId] || `Speaker ${i}`;
        }

        setFormData((prev) => ({
          ...prev,
          speakers: newSpeakers,
        }));
      }
    };

    updateSpeakers();
  }, [formData.numberOfSpeakers, formData.speakers]);

  return (
    <PageShell
      sidebarContent={<AppsSidebarContent />}
      className="max-w-7xl mx-auto"
      headerContent={
        <PageHeader>
          <BackLink to="/apps/podcasts" label="Back to podcasts" />
          <PageTitle title="Upload New Podcast" />
        </PageHeader>
      }
      isBeta={true}
    >
      <div className="max-w-3xl mx-auto">
        <ProgressStepper currentStep={currentStep} />

        {currentStep === Step.Upload && (
          <UploadStep
            formData={formData}
            handleChange={handleChange}
            handleFileChange={handleFileChange}
            handleUpload={handleUpload}
            isUploading={isUploading}
            setFormData={setFormData}
          />
        )}

        {currentStep === Step.Process && (
          <ProcessStep
            formData={formData}
            handleChange={handleChange}
            handleProcess={handleProcess}
            isProcessing={isProcessing}
          />
        )}

        {currentStep === Step.Processing && (
          <ProcessingStep
            formData={formData}
            processingStatus={processingStatus}
            processingErrors={processingErrors}
            processingComplete={processingComplete}
            handleRetry={handleRetry}
            setCurrentStep={setCurrentStep}
            uploadedPodcastId={uploadedPodcastId}
            navigate={navigate}
          />
        )}
      </div>
    </PageShell>
  );
}
