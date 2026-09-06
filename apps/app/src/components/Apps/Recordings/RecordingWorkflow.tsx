import {
  RecordingWorkflowStep,
  ProcessingStep,
  ProcessStep,
  ProgressStepper,
  UploadStep,
} from "@ngriffin_uk/polychat-component-experiences/content";
import { useFileUploadAnalytics } from "@ngriffin_uk/polychat-library-react";
import { useNavigate } from "react-router";

import { useRecordingWorkflow } from "./useRecordingWorkflow";

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
          handleUpload={workflow.actions.upload}
          isUploading={workflow.isUploading}
          setFormData={workflow.setFormData}
          uploaderAnalytics={uploaderAnalytics}
        />
      )}

      {workflow.currentStep === RecordingWorkflowStep.Process && (
        <ProcessStep
          formData={workflow.formData}
          handleChange={workflow.actions.handleChange}
          handleProcess={workflow.actions.process}
          isProcessing={workflow.isProcessing}
        />
      )}

      {workflow.currentStep === RecordingWorkflowStep.Processing && (
        <ProcessingStep
          formData={workflow.formData}
          processingStatus={workflow.processingStatus}
          processingErrors={workflow.processingErrors}
          processingComplete={workflow.processingComplete}
          handleRetry={workflow.actions.retry}
          setCurrentStep={workflow.setCurrentStep}
          uploadedRecordingId={workflow.uploadedRecordingId}
          basePath={basePath}
          navigate={navigate}
        />
      )}
    </div>
  );
}

interface RecordingWorkflowProps {
  basePath: string;
  projectId?: string;
}
