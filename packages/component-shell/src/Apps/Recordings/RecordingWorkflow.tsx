import {
  RecordingWorkflowStep,
  ProcessingStep,
  ProcessStep,
  ProgressStepper,
  UploadStep,
} from "@ngriffin_uk/polychat-component-experiences/content";
import { useFileUploadAnalytics } from "@ngriffin_uk/polychat-library-react";
import { useNavigate } from "react-router";

import { useRecordingWorkflow } from "./useRecordingWorkflow.js";

export function RecordingWorkflow({ basePath, projectId }: RecordingWorkflowProps) {
  const navigate = useNavigate();
  const workflow = useRecordingWorkflow(basePath, projectId);
  const uploaderAnalytics = useFileUploadAnalytics("audioFile");

  return (
    <div className="mx-auto max-w-3xl">
      <ProgressStepper currentStep={workflow.currentStep} />
      {workflow.workflowError && (
        <p role="alert" className="mb-4 text-sm text-failure">
          {workflow.workflowError}
        </p>
      )}

      {workflow.currentStep === RecordingWorkflowStep.Upload && (
        <UploadStep
          formData={workflow.formData}
          handleChange={workflow.actions.handleChange}
          handleFileChange={workflow.actions.handleFileChange}
          handleUpload={() => void workflow.actions.upload()}
          isUploading={workflow.isUploading}
          setFormData={workflow.setFormData}
          uploaderAnalytics={uploaderAnalytics}
        />
      )}

      {workflow.currentStep === RecordingWorkflowStep.Process && (
        <ProcessStep
          formData={workflow.formData}
          handleChange={workflow.actions.handleChange}
          handleProcess={() => void workflow.actions.process()}
          isProcessing={workflow.isProcessing}
        />
      )}

      {workflow.currentStep === RecordingWorkflowStep.Processing && (
        <ProcessingStep
          formData={workflow.formData}
          processingStatus={workflow.processingStatus}
          processingErrors={workflow.processingErrors}
          processingComplete={workflow.processingComplete}
          handleRetry={(process) => void workflow.actions.retry(process)}
          setCurrentStep={workflow.setCurrentStep}
          uploadedRecordingId={workflow.uploadedRecordingId}
          basePath={basePath}
          navigate={(path) => void navigate(path)}
        />
      )}
    </div>
  );
}

interface RecordingWorkflowProps {
  basePath: string;
  projectId?: string;
}
