import { useNavigate } from "react-router";

import { ProcessStep } from "./ProcessStep";
import { ProcessingStep } from "./ProcessingStep";
import { ProgressStepper } from "./ProgressStepper";
import { UploadStep } from "./UploadStep";
import { usePodcastWorkflow } from "./usePodcastWorkflow";
import { PodcastWorkflowStep } from "./workflow";

export function PodcastWorkflow({ basePath, projectId }: PodcastWorkflowProps) {
	const navigate = useNavigate();
	const workflow = usePodcastWorkflow(basePath, projectId);

	return (
		<div className="mx-auto max-w-3xl">
			<ProgressStepper currentStep={workflow.currentStep} />
			{workflow.workflowError && (
				<p role="alert" className="mb-4 text-sm text-red-700 dark:text-red-400">
					{workflow.workflowError}
				</p>
			)}

			{workflow.currentStep === PodcastWorkflowStep.Upload && (
				<UploadStep
					formData={workflow.formData}
					handleChange={workflow.actions.handleChange}
					handleFileChange={workflow.actions.handleFileChange}
					handleUpload={workflow.actions.upload}
					isUploading={workflow.isUploading}
					setFormData={workflow.setFormData}
				/>
			)}

			{workflow.currentStep === PodcastWorkflowStep.Process && (
				<ProcessStep
					formData={workflow.formData}
					handleChange={workflow.actions.handleChange}
					handleProcess={workflow.actions.process}
					isProcessing={workflow.isProcessing}
				/>
			)}

			{workflow.currentStep === PodcastWorkflowStep.Processing && (
				<ProcessingStep
					formData={workflow.formData}
					processingStatus={workflow.processingStatus}
					processingErrors={workflow.processingErrors}
					processingComplete={workflow.processingComplete}
					handleRetry={workflow.actions.retry}
					setCurrentStep={workflow.setCurrentStep}
					uploadedPodcastId={workflow.uploadedPodcastId}
					basePath={basePath}
					navigate={navigate}
				/>
			)}
		</div>
	);
}

interface PodcastWorkflowProps {
	basePath: string;
	projectId: string;
}
