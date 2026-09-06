import {
  Button,
  FormInput,
  Label,
  SingleFileUploader,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import { Link as LinkIcon } from "lucide-react";

import type { RecordingFormData } from "./types";

export interface UploadStepProps {
  formData: RecordingFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleFileChange: (file: File) => void;
  handleUpload: () => void;
  isUploading: boolean;
  setFormData: React.Dispatch<React.SetStateAction<RecordingFormData>>;
  uploaderAnalytics?: {
    onFilesAdded?: (files: any[]) => void;
    onFilesChange?: (files: any[]) => void;
    [key: string]: unknown;
  };
}

export function UploadStep({
  formData,
  handleChange,
  handleFileChange,
  handleUpload,
  isUploading,
  setFormData,
  uploaderAnalytics,
}: UploadStepProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <h2 className="mb-4 text-xl font-semibold text-foreground">Upload Your Recording</h2>

      <div className="space-y-4">
        <FormInput
          id="title"
          name="title"
          label="Recording Title *"
          value={formData.title}
          onChange={handleChange}
          placeholder="My Amazing Recording"
          required
        />

        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="What's your recording about?"
          rows={3}
        />

        <div>
          <div className="mb-4 flex space-x-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="audioSource"
                value="file"
                checked={formData.audioSource === "file"}
                onChange={() => setFormData((prev) => ({ ...prev, audioSource: "file" }))}
                className="h-4 w-4 border-border-strong text-active-work focus:ring-active-work"
              />
              <span className="ml-2 text-foreground">Upload File</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="audioSource"
                value="url"
                checked={formData.audioSource === "url"}
                onChange={() => setFormData((prev) => ({ ...prev, audioSource: "url" }))}
                className="h-4 w-4 border-border-strong text-active-work focus:ring-active-work"
              />
              <span className="ml-2 text-foreground">Enter URL</span>
            </label>
          </div>

          {formData.audioSource === "file" ? (
            <>
              <label htmlFor="audioFile" className="mb-1 block text-sm font-medium text-foreground">
                Audio File * (MP3, WAV, M4A)
              </label>
              <SingleFileUploader
                id="audioFile"
                maxSize={10 * 1024 * 1024}
                {...uploaderAnalytics}
                onFilesAdded={(files) => {
                  uploaderAnalytics?.onFilesAdded?.(files);
                  if (files[0].file instanceof File) {
                    handleFileChange(files[0].file);
                  }
                }}
              />
            </>
          ) : (
            <div className="relative">
              <FormInput
                id="audioUrl"
                name="audioUrl"
                label="Audio URL * (MP3, WAV, M4A)"
                value={formData.audioUrl}
                onChange={handleChange}
                placeholder="https://example.com/recording.mp3"
                description="Enter a direct URL to your audio file (must be publicly accessible)"
                required
                className="pl-10"
              />
              <div className="pointer-events-none absolute top-[37px] left-3">
                <LinkIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          type="button"
          variant="primary"
          onClick={handleUpload}
          disabled={
            !formData.title ||
            (formData.audioSource === "file" && !formData.audioFile) ||
            (formData.audioSource === "url" && !formData.audioUrl) ||
            isUploading
          }
          isLoading={isUploading}
        >
          {isUploading ? "Uploading..." : "Upload & Continue"}
        </Button>
      </div>
    </div>
  );
}
