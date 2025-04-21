import { Button, Checkbox, TextArea, TextInput } from "~/components/ui";
import type { PodcastFormData } from "~/pages/apps/podcasts/new";

interface ProcessStepProps {
  formData: PodcastFormData;
  handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  handleProcess: () => void;
  isProcessing: boolean;
}

export function ProcessStep({
  formData,
  handleChange,
  handleProcess,
  isProcessing,
}: ProcessStepProps) {
  return (
    <div className="bg-off-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-zinc-200">
        Processing Options
      </h2>

      <div className="space-y-4">
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <Checkbox
              id="transcribe"
              name="transcribe"
              checked={formData.transcribe}
              onChange={handleChange}
              labelPosition="right"
            />
          </div>
          <div className="ml-3">
            <label
              htmlFor="transcribe"
              className="font-medium text-zinc-700 dark:text-zinc-300"
            >
              Transcribe Podcast
            </label>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Generate a text transcript of your podcast
            </p>

            {formData.transcribe && (
              <div className="mt-2">
                <TextInput
                  id="numberOfSpeakers"
                  name="numberOfSpeakers"
                  label="Number of Speakers"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.numberOfSpeakers}
                  onChange={handleChange}
                  className="w-20"
                />

                <div className="mt-3">
                  <TextInput
                    id="transcribePrompt"
                    name="transcribePrompt"
                    label="Transcription Instructions"
                    value={formData.transcribePrompt}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start">
          <div className="flex items-center h-5">
            <Checkbox
              id="summarise"
              name="summarise"
              checked={formData.summarise}
              onChange={handleChange}
              labelPosition="right"
            />
          </div>
          <div className="ml-3">
            <label
              htmlFor="summarise"
              className="font-medium text-zinc-700 dark:text-zinc-300"
            >
              Generate Summary
            </label>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Create a brief summary of your podcast content
            </p>

            {formData.summarise && formData.transcribe && (
              <div className="mt-2 space-y-2">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Speaker Names (for summary)
                </p>
                {Array.from({ length: formData.numberOfSpeakers }).map(
                  (_, i) => {
                    const speakerId = String(i + 1);
                    return (
                      <div key={speakerId} className="flex items-center">
                        <label
                          htmlFor={`speaker_${speakerId}`}
                          className="text-sm text-zinc-500 dark:text-zinc-400 w-24"
                        >
                          Speaker {speakerId}:
                        </label>
                        <TextInput
                          id={`speaker_${speakerId}`}
                          name={`speaker_${speakerId}`}
                          value={
                            formData.speakers[speakerId] ||
                            `Speaker ${speakerId}`
                          }
                          onChange={handleChange}
                          className="ml-2"
                        />
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start">
          <div className="flex items-center h-5">
            <Checkbox
              id="generateImage"
              name="generateImage"
              checked={formData.generateImage}
              onChange={handleChange}
              labelPosition="right"
            />
          </div>
          <div className="ml-3">
            <label
              htmlFor="generateImage"
              className="font-medium text-zinc-700 dark:text-zinc-300"
            >
              Generate Cover Image
            </label>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Create a cover image based on your podcast title and description
            </p>
          </div>
        </div>

        {formData.generateImage && (
          <div className="ml-7">
            <TextArea
              id="imagePrompt"
              name="imagePrompt"
              label="Image Generation Prompt (optional)"
              value={formData.imagePrompt}
              onChange={handleChange}
              placeholder="A podcast cover with..."
              rows={2}
            />
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          type="button"
          variant="primary"
          onClick={handleProcess}
          disabled={isProcessing}
          isLoading={isProcessing}
        >
          {isProcessing ? "Processing..." : "Process Podcast"}
        </Button>
      </div>
    </div>
  );
}
