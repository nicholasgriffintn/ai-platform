// Source: https://originui.com/file-upload

import {
	AlertCircleIcon,
	PaperclipIcon,
	UploadIcon,
	XIcon,
} from "lucide-react";

import { Button } from "~/components/ui/Button";
import {
	type FileWithPreview,
	formatBytes,
	useFileUpload,
} from "~/hooks/use-file-upload";
import { useTrackEvent } from "~/hooks/use-track-event";

interface SingleFileUploaderProps {
	id: string;
	initialFiles?: {
		name: string;
		size: number;
		type: string;
		url: string;
		id: string;
	}[];
	maxSize?: number;
	onFilesAdded?: (files: FileWithPreview[]) => void;
	onFilesChange?: (files: FileWithPreview[]) => void;
}

export function SingleFileUploader({
	id,
	initialFiles,
	maxSize = 10 * 1024 * 1024, // 10MB default
	onFilesAdded,
	onFilesChange,
}: SingleFileUploaderProps) {
	const { trackFeatureUsage } = useTrackEvent();
	const [
		{ files, isDragging, errors },
		{
			handleDragEnter,
			handleDragLeave,
			handleDragOver,
			handleDrop,
			openFileDialog,
			removeFile,
			getInputProps,
		},
	] = useFileUpload({
		maxFiles: 1,
		maxSize,
		initialFiles,
		onFilesAdded: (addedFiles) => {
			trackFeatureUsage("file_added", {
				uploader_id: id,
				file_count: addedFiles.length,
				file_type: addedFiles[0]?.file.type || "unknown",
				file_size: addedFiles[0]?.file.size || 0,
				upload_method: "dialog",
			});
			onFilesAdded?.(addedFiles);
		},
		onFilesChange: (changedFiles) => {
			if (changedFiles.length > 0) {
				trackFeatureUsage("file_upload_active", {
					uploader_id: id,
					file_count: changedFiles.length,
					file_type: changedFiles[0]?.file.type || "unknown",
					file_size: changedFiles[0]?.file.size || 0,
				});
			}
			onFilesChange?.(changedFiles);
		},
	});

	const file = files[0];

	const trackEnhancedDrop = (e: React.DragEvent<HTMLButtonElement>) => {
		handleDrop(e);
		if (e.dataTransfer.files.length > 0) {
			trackFeatureUsage("file_added", {
				uploader_id: id,
				file_count: e.dataTransfer.files.length,
				file_type: e.dataTransfer.files[0]?.type || "unknown",
				file_size: e.dataTransfer.files[0]?.size || 0,
				upload_method: "drag_and_drop",
			});
		}
	};

	const handleRemoveFile = (fileId: string) => {
		if (files.length > 0) {
			trackFeatureUsage("file_removed", {
				uploader_id: id,
				file_type: files[0]?.file.type || "unknown",
				file_size: files[0]?.file.size || 0,
			});
		}
		removeFile(fileId);
	};

	return (
		<div className="flex flex-col gap-2">
			<button
				type="button"
				tabIndex={0}
				onClick={openFileDialog}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						openFileDialog();
					}
				}}
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={trackEnhancedDrop}
				data-dragging={isDragging || undefined}
				className="border-input hover:bg-accent/50 data-[dragging=true]:bg-accent/50 has-[input:focus]:border-ring has-[input:focus]:ring-ring/50 flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed p-4 transition-colors has-disabled:pointer-events-none has-disabled:opacity-50 has-[input:focus]:ring-[3px]"
			>
				<input
					{...getInputProps()}
					id={id}
					className="sr-only"
					aria-label="Upload file"
					disabled={Boolean(file)}
				/>

				<div className="flex flex-col items-center justify-center text-center">
					<div
						className="bg-background mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border"
						aria-hidden="true"
					>
						<UploadIcon className="size-4 opacity-60" />
					</div>
					<p className="mb-1.5 text-sm font-medium">Upload file</p>
					<p className="text-muted-foreground text-xs">
						Drag & drop or click to browse (max. {formatBytes(maxSize)})
					</p>
				</div>
			</button>

			{errors.length > 0 && (
				<div
					className="text-destructive flex items-center gap-1 text-xs"
					role="alert"
				>
					<AlertCircleIcon className="size-3 shrink-0" />
					<span>{errors[0]}</span>
				</div>
			)}

			{file && (
				<div className="space-y-2">
					<div
						key={file.id}
						className="flex items-center justify-between gap-2 rounded-xl border px-4 py-2"
					>
						<div className="flex items-center gap-3 overflow-hidden">
							<PaperclipIcon
								className="size-4 shrink-0 opacity-60"
								aria-hidden="true"
							/>
							<div className="min-w-0">
								<p className="truncate text-[13px] font-medium">
									{file.file.name}
								</p>
							</div>
						</div>

						<Button
							size="icon"
							variant="ghost"
							className="text-muted-foreground/80 hover:text-foreground -me-2 size-8 hover:bg-transparent"
							onClick={() => handleRemoveFile(files[0]?.id)}
							aria-label="Remove file"
						>
							<XIcon className="size-4" aria-hidden="true" />
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
