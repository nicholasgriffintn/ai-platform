import { BookText, ImageIcon, Mic } from "lucide-react";

import { Button } from "~/components/ui";
import { type PodcastFormData, Step } from "~/pages/apps/podcasts/new";

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
  setCurrentStep: (step: Step) => void;
  uploadedPodcastId: string;
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
  navigate,
}: ProcessingStepProps) {
  const hasErrors = Object.values(processingErrors).some(
    (error) => error !== null,
  );

  return (
    <div className="bg-off-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-6 text-zinc-800 dark:text-zinc-200">
        Processing Your Podcast
      </h2>

      <div className="space-y-6">
        {formData.transcribe && (
          <div className="flex items-center">
            <div
              className={
                processingStatus.transcribing ? "mr-4 animate-spin" : "mr-4"
              }
            >
              <Mic
                size={24}
                className={
                  processingErrors.transcribing
                    ? "text-red-500"
                    : processingComplete.transcribing
                      ? "text-green-500"
                      : processingStatus.transcribing
                        ? "text-blue-500"
                        : "text-zinc-400"
                }
              />
            </div>
            <div className="flex-1">
              <p className="font-medium text-zinc-800 dark:text-zinc-200">
                Transcribing Audio
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {processingErrors.transcribing ? (
                  <span className="text-red-500">
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
            <div
              className={
                processingStatus.summarizing ? "mr-4 animate-spin" : "mr-4"
              }
            >
              <BookText
                size={24}
                className={
                  processingErrors.summarizing
                    ? "text-red-500"
                    : processingComplete.summarizing
                      ? "text-green-500"
                      : processingStatus.summarizing
                        ? "text-blue-500"
                        : !processingComplete.transcribing &&
                            formData.transcribe
                          ? "text-zinc-400"
                          : "text-zinc-500"
                }
              />
            </div>
            <div className="flex-1">
              <p className="font-medium text-zinc-800 dark:text-zinc-200">
                Generating Summary
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {processingErrors.summarizing ? (
                  <span className="text-red-500">
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
            <div
              className={
                processingStatus.generatingImage ? "mr-4 animate-spin" : "mr-4"
              }
            >
              <ImageIcon
                size={24}
                className={
                  processingErrors.generatingImage
                    ? "text-red-500"
                    : processingComplete.generatingImage
                      ? "text-green-500"
                      : processingStatus.generatingImage
                        ? "text-blue-500"
                        : (!processingComplete.summarizing &&
                              formData.summarise) ||
                            (!processingComplete.transcribing &&
                              formData.transcribe)
                          ? "text-zinc-400"
                          : "text-zinc-500"
                }
              />
            </div>
            <div className="flex-1">
              <p className="font-medium text-zinc-800 dark:text-zinc-200">
                Generating Cover Image
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {processingErrors.generatingImage ? (
                  <span className="text-red-500">
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
            <p className="text-red-500">
              One or more processes failed. You can retry individual steps or
              return to the form.
            </p>
            <div className="flex justify-center space-x-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCurrentStep(Step.Process)}
              >
                Back to Options
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => navigate(`/apps/podcasts/${uploadedPodcastId}`)}
                disabled={!uploadedPodcastId}
              >
                Continue to Podcast
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            <p>Please don't close this page while processing</p>
            <p>You'll be redirected when all processing is complete</p>
          </div>
        )}
      </div>
    </div>
  );
}
