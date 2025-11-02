import { Link as LinkIcon } from "lucide-react";

import { SingleFileUploader } from "~/components/Uploader/SingleFileUploader";
import { Button, FormInput, Label, Textarea } from "~/components/ui";
import type { PodcastFormData } from "~/types/podcast";

interface UploadStepProps {
	formData: PodcastFormData;
	handleChange: (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => void;
	handleFileChange: (file: File) => void;
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
				<FormInput
					id="title"
					name="title"
					label="Podcast Title *"
					value={formData.title}
					onChange={handleChange}
					placeholder="My Amazing Podcast"
					required
				/>

				<Label htmlFor="description">Description</Label>
				<Textarea
					id="description"
					name="description"
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
							<SingleFileUploader
								id="audioFile"
								maxSize={10 * 1024 * 1024}
								onFilesAdded={(files) => {
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
