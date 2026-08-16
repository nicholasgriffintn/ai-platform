import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { useProcessPodcast, useUploadPodcast } from "~/hooks/usePodcasts";
import { getErrorMessage } from "~/lib/errors";
import type { PodcastFormData } from "~/types/podcast";
import { PodcastWorkflowStep } from "./workflow";

type PodcastProcess = "transcribe" | "summarise" | "generate-image";
type ProcessingKey = "transcribing" | "summarizing" | "generatingImage";
type ProcessingStatus = Record<ProcessingKey, boolean>;
type ProcessingErrors = Record<ProcessingKey, string | null>;

const INITIAL_FORM_DATA: PodcastFormData = {
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

function getProcessingKey(process: PodcastProcess): ProcessingKey {
	if (process === "transcribe") return "transcribing";
	if (process === "summarise") return "summarizing";
	return "generatingImage";
}

function allRequestedProcessesComplete(
	formData: PodcastFormData,
	complete: ProcessingStatus,
): boolean {
	return (
		(!formData.transcribe || complete.transcribing) &&
		(!formData.summarise || complete.summarizing) &&
		(!formData.generateImage || complete.generatingImage)
	);
}

export function usePodcastWorkflow(basePath: string, projectId?: string) {
	const navigate = useNavigate();
	const [currentStep, setCurrentStep] = useState(PodcastWorkflowStep.Upload);
	const [formData, setFormData] = useState<PodcastFormData>(INITIAL_FORM_DATA);
	const [uploadedPodcastId, setUploadedPodcastId] = useState("");
	const [processingStatus, setProcessingStatus] = useState(EMPTY_STATUS);
	const [processingErrors, setProcessingErrors] = useState(EMPTY_ERRORS);
	const [processingComplete, setProcessingComplete] = useState(EMPTY_STATUS);
	const [workflowError, setWorkflowError] = useState<string | null>(null);
	const uploadPodcast = useUploadPodcast(projectId);
	const processPodcast = useProcessPodcast(projectId);

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
			if (Object.keys(current.speakers).length === current.numberOfSpeakers) return current;
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
		if (!formData.title.trim()) return;
		if (formData.audioSource === "file" && !formData.audioFile) return;
		if (formData.audioSource === "url" && !formData.audioUrl.trim()) return;
		setWorkflowError(null);
		try {
			const result = await uploadPodcast.mutateAsync({
				title: formData.title.trim(),
				description: formData.description.trim() || undefined,
				...(formData.audioSource === "file"
					? { audio: formData.audioFile ?? undefined }
					: { audioUrl: formData.audioUrl.trim() }),
			});
			const podcastId = result.response.completion_id;
			setUploadedPodcastId(podcastId);
			setCurrentStep(PodcastWorkflowStep.Process);
		} catch (error) {
			setWorkflowError(getErrorMessage(error, "Upload failed."));
		}
	}, [formData, uploadPodcast]);

	const runProcess = useCallback(
		async (process: PodcastProcess): Promise<boolean> => {
			if (!uploadedPodcastId) return false;
			const key = getProcessingKey(process);
			setProcessingErrors((current) => ({ ...current, [key]: null }));
			setProcessingStatus((current) => ({ ...current, [key]: true }));
			try {
				await processPodcast.mutateAsync({
					podcastId: uploadedPodcastId,
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
		[formData, processPodcast, uploadedPodcastId],
	);

	const process = useCallback(async () => {
		if (!uploadedPodcastId) return;
		setProcessingErrors(EMPTY_ERRORS);
		setProcessingComplete(EMPTY_STATUS);
		setCurrentStep(PodcastWorkflowStep.Processing);
		const requested: PodcastProcess[] = [
			...(formData.transcribe ? (["transcribe"] as const) : []),
			...(formData.summarise ? (["summarise"] as const) : []),
			...(formData.generateImage ? (["generate-image"] as const) : []),
		];
		for (const action of requested) {
			if (!(await runProcess(action))) return;
		}
		navigate(`${basePath}/${uploadedPodcastId}`);
	}, [basePath, formData, navigate, runProcess, uploadedPodcastId]);

	const retry = useCallback(
		async (processToRetry: PodcastProcess) => {
			if (!(await runProcess(processToRetry))) return;
			const complete = {
				...processingComplete,
				[getProcessingKey(processToRetry)]: true,
			};
			if (allRequestedProcessesComplete(formData, complete)) {
				navigate(`${basePath}/${uploadedPodcastId}`);
			}
		},
		[basePath, formData, navigate, processingComplete, runProcess, uploadedPodcastId],
	);

	return {
		currentStep,
		formData,
		isProcessing: processPodcast.isPending,
		isUploading: uploadPodcast.isPending,
		processingComplete,
		processingErrors,
		processingStatus,
		setCurrentStep,
		setFormData,
		uploadedPodcastId,
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
