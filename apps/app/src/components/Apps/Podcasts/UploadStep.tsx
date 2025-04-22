import { Link as LinkIcon, Upload } from "lucide-react";

import { Button, TextArea, TextInput } from "~/components/ui";
import type { PodcastFormData } from "~/types/podcast";

interface UploadStepProps {
  formData: PodcastFormData;
  handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleUpload: () => void;
  isUploading: boolean;
  setFormData: React.Dispatch<React.SetStateAction<PodcastFormData>>;
}

export function UploadStep({
  formData,
  handleChange,
  handleFileChange,
  handleUpload,
  isUploading,
  setFormData,
}: UploadStepProps) {
  return (
    <div className="bg-off-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-zinc-200">
        Upload Your Podcast
      </h2>

      <div className="space-y-4">
        <TextInput
          id="title"
          name="title"
          label="Podcast Title *"
          value={formData.title}
          onChange={handleChange}
          placeholder="My Amazing Podcast"
          required
        />

        <TextArea
          id="description"
          name="description"
          label="Description"
          value={formData.description}
          onChange={handleChange}
          placeholder="What's your podcast about?"
          rows={3}
        />

        <div>
          <div className="flex space-x-4 mb-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="audioSource"
                value="file"
                checked={formData.audioSource === "file"}
                onChange={() =>
                  setFormData((prev) => ({ ...prev, audioSource: "file" }))
                }
                className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-zinc-300 dark:border-zinc-600"
              />
              <span className="ml-2 text-zinc-700 dark:text-zinc-300">
                Upload File
              </span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="audioSource"
                value="url"
                checked={formData.audioSource === "url"}
                onChange={() =>
                  setFormData((prev) => ({ ...prev, audioSource: "url" }))
                }
                className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-zinc-300 dark:border-zinc-600"
              />
              <span className="ml-2 text-zinc-700 dark:text-zinc-300">
                Enter URL
              </span>
            </label>
          </div>

          {formData.audioSource === "file" ? (
            <>
              <label
                htmlFor="audioFile"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Audio File * (MP3, WAV, M4A)
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-zinc-300 dark:border-zinc-600 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <Upload
                    className="mx-auto h-12 w-12 text-zinc-400 dark:text-zinc-500"
                    strokeWidth={1}
                  />
                  <div className="flex text-sm text-zinc-600 dark:text-zinc-400">
                    <label
                      htmlFor="audioFile"
                      className="relative cursor-pointer bg-white dark:bg-zinc-800 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 focus-within:outline-none"
                    >
                      <span>Upload a file</span>
                      <input
                        id="audioFile"
                        name="audioFile"
                        type="file"
                        className="sr-only"
                        accept=".mp3,.wav,.m4a"
                        onChange={handleFileChange}
                        required
                      />
                    </label>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    MP3, WAV, or M4A up to 200MB
                  </p>
                  {formData.audioFile && (
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {formData.audioFile.name}
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="relative">
              <TextInput
                id="audioUrl"
                name="audioUrl"
                label="Audio URL * (MP3, WAV, M4A)"
                value={formData.audioUrl}
                onChange={handleChange}
                placeholder="https://example.com/podcast.mp3"
                description="Enter a direct URL to your audio file (must be publicly accessible)"
                required
                className="pl-10"
              />
              <div className="absolute left-3 top-[37px] pointer-events-none">
                <LinkIcon
                  className="h-5 w-5 text-zinc-400"
                  aria-hidden="true"
                />
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
