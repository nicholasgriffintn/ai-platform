import {
  Button,
  FormInput,
  Label,
  Textarea,
  FormCheckbox,
} from "@ngriffin_uk/polychat-component-ui";

import type { RecordingFormData } from "./types";

interface ProcessStepProps {
  formData: RecordingFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
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
    <div className="rounded-lg border border-border bg-surface p-6">
      <h2 className="mb-4 text-xl font-semibold text-foreground">Processing Options</h2>

      <div className="space-y-4">
        <div className="flex items-start">
          <div className="flex h-5 items-center">
            <FormCheckbox
              id="transcribe"
              name="transcribe"
              checked={formData.transcribe}
              onChange={handleChange}
              labelPosition="right"
            />
          </div>
          <div className="ml-3">
            <label htmlFor="transcribe" className="font-medium text-foreground">
              Transcribe Recording
            </label>
            <p className="text-sm text-muted-foreground">
              Generate a text transcript of your recording
            </p>

            {formData.transcribe && (
              <div className="mt-2">
                <FormInput
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
                  <FormInput
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
          <div className="flex h-5 items-center">
            <FormCheckbox
              id="summarise"
              name="summarise"
              checked={formData.summarise}
              onChange={handleChange}
              labelPosition="right"
            />
          </div>
          <div className="ml-3">
            <label htmlFor="summarise" className="font-medium text-foreground">
              Generate Summary
            </label>
            <p className="text-sm text-muted-foreground">
              Create a brief summary of your recording content
            </p>

            {formData.summarise && formData.transcribe && (
              <div className="mt-2 space-y-2">
                <p className="text-sm font-medium text-foreground">Speaker Names (for summary)</p>
                {Array.from({ length: formData.numberOfSpeakers }).map((_, i) => {
                  const speakerId = String(i + 1);

                  return (
                    <div key={speakerId} className="flex items-center">
                      <label
                        htmlFor={`speaker_${speakerId}`}
                        className="w-24 text-sm text-muted-foreground"
                      >
                        Speaker {speakerId}:
                      </label>
                      <FormInput
                        id={`speaker_${speakerId}`}
                        name={`speaker_${speakerId}`}
                        value={formData.speakers[speakerId] || `Speaker ${speakerId}`}
                        onChange={handleChange}
                        className="ml-2"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start">
          <div className="flex h-5 items-center">
            <FormCheckbox
              id="generateImage"
              name="generateImage"
              checked={formData.generateImage}
              onChange={handleChange}
              labelPosition="right"
            />
          </div>
          <div className="ml-3">
            <label htmlFor="generateImage" className="font-medium text-foreground">
              Generate Cover Image
            </label>
            <p className="text-sm text-muted-foreground">
              Create a cover image based on your recording title and description
            </p>
          </div>
        </div>

        {formData.generateImage && (
          <div className="ml-7">
            <Label htmlFor="imagePrompt">Image Generation Prompt (optional)</Label>
            <Textarea
              id="imagePrompt"
              name="imagePrompt"
              value={formData.imagePrompt}
              onChange={handleChange}
              placeholder="A recording cover with..."
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
          {isProcessing ? "Processing..." : "Process Recording"}
        </Button>
      </div>
    </div>
  );
}
