import { Button } from "@ngriffin_uk/polychat-component-ui";
import { BookText, ImageIcon, Mic } from "lucide-react";

import type { PodcastFormData } from "./types";
import { PodcastWorkflowStep } from "./workflow";

interface ProcessingStepProps {
  formData: PodcastFormData;
  processingStatus: {
    transcribing: boolean;
    summarizing: boolean;
    generatingImage: boolean;
  };
  processingErrors: {
    transcribing: string | null;
    summarizing: string | null;
    generatingImage: string | null;
  };
  processingComplete: {
    transcribing: boolean;
    summarizing: boolean;
    generatingImage: boolean;
  };
  handleRetry: (process: "transcribe" | "summarise" | "generate-image") => void;
  setCurrentStep: (step: PodcastWorkflowStep) => void;
  uploadedPodcastId: string;
  basePath: string;
  navigate: (path: string) => void;
}

export function ProcessingStep({
  formData,
  processingStatus,
  processingErrors,
  processingComplete,
  handleRetry,
  setCurrentStep,
  uploadedPodcastId,
  basePath,
  navigate,
}: ProcessingStepProps) {
  const hasErrors = Object.values(processingErrors).some((error) => error !== null);

  return (
    <div className="border-border bg-surface rounded-lg border p-6">
      <h2 className="text-xl font-semibold mb-6 text-foreground">Processing Your Podcast</h2>

      <div className="space-y-6">
        {formData.transcribe && (
          <div className="flex items-center">
            <div className={processingStatus.transcribing ? "mr-4 animate-spin" : "mr-4"}>
              <Mic
                size={24}
                className={
                  processingErrors.transcribing
                    ? "text-failure"
                    : processingComplete.transcribing
                      ? "text-success"
                      : processingStatus.transcribing
                        ? "text-active-work"
                        : "text-muted-foreground"
                }
              />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Transcribing Audio</p>
              <p className="text-sm text-muted-foreground">
                {processingErrors.transcribing ? (
                  <span role="alert" className="text-failure">
                    {processingErrors.transcribing}
                  </span>
                ) : processingStatus.transcribing ? (
                  "Converting your audio to text..."
                ) : processingComplete.transcribing ? (
                  "Transcription complete"
                ) : (
                  "Waiting to start..."
                )}
              </p>
            </div>
            {processingErrors.transcribing && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleRetry("transcribe")}
                disabled={processingStatus.transcribing}
              >
                Retry
              </Button>
            )}
          </div>
        )}

        {formData.summarise && (
          <div className="flex items-center">
            <div className={processingStatus.summarizing ? "mr-4 animate-spin" : "mr-4"}>
              <BookText
                size={24}
                className={
                  processingErrors.summarizing
                    ? "text-failure"
                    : processingComplete.summarizing
                      ? "text-success"
                      : processingStatus.summarizing
                        ? "text-active-work"
                        : !processingComplete.transcribing && formData.transcribe
                          ? "text-muted-foreground"
                          : "text-muted-foreground"
                }
              />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Generating Summary</p>
              <p className="text-sm text-muted-foreground">
                {processingErrors.summarizing ? (
                  <span role="alert" className="text-failure">
                    {processingErrors.summarizing}
                  </span>
                ) : processingStatus.summarizing ? (
                  "Creating a summary of your podcast..."
                ) : processingComplete.summarizing ? (
                  "Summary generation complete"
                ) : !processingComplete.transcribing && formData.transcribe ? (
                  "Waiting for transcription to complete..."
                ) : (
                  "Waiting to start..."
                )}
              </p>
            </div>
            {processingErrors.summarizing && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleRetry("summarise")}
                disabled={processingStatus.summarizing}
              >
                Retry
              </Button>
            )}
          </div>
        )}

        {formData.generateImage && (
          <div className="flex items-center">
            <div className={processingStatus.generatingImage ? "mr-4 animate-spin" : "mr-4"}>
              <ImageIcon
                size={24}
                className={
                  processingErrors.generatingImage
                    ? "text-failure"
                    : processingComplete.generatingImage
                      ? "text-success"
                      : processingStatus.generatingImage
                        ? "text-active-work"
                        : (!processingComplete.summarizing && formData.summarise) ||
                            (!processingComplete.transcribing && formData.transcribe)
                          ? "text-muted-foreground"
                          : "text-muted-foreground"
                }
              />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Generating Cover Image</p>
              <p className="text-sm text-muted-foreground">
                {processingErrors.generatingImage ? (
                  <span role="alert" className="text-failure">
                    {processingErrors.generatingImage}
                  </span>
                ) : processingStatus.generatingImage ? (
                  "Creating a cover image for your podcast..."
                ) : processingComplete.generatingImage ? (
                  "Image generation complete"
                ) : (!processingComplete.summarizing && formData.summarise) ||
                  (!processingComplete.transcribing && formData.transcribe) ? (
                  "Waiting for previous steps to complete..."
                ) : (
                  "Waiting to start..."
                )}
              </p>
            </div>
            {processingErrors.generatingImage && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleRetry("generate-image")}
                disabled={processingStatus.generatingImage}
              >
                Retry
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 text-center">
        {hasErrors ? (
          <div className="space-y-4">
            <p role="alert" className="text-failure">
              One or more processes failed. You can retry individual steps or return to the form.
            </p>
            <div className="flex justify-center space-x-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCurrentStep(PodcastWorkflowStep.Process)}
              >
                Back to Options
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => navigate(`${basePath}/${uploadedPodcastId}`)}
                disabled={!uploadedPodcastId}
              >
                Continue to Podcast
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            <p>Please don't close this page while processing</p>
            <p>You'll be redirected when all processing is complete</p>
          </div>
        )}
      </div>
    </div>
  );
}
