import { RecordingWorkflowStep } from "./workflow";

interface StepperProps {
  currentStep: RecordingWorkflowStep;
}

export function ProgressStepper({ currentStep }: StepperProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            currentStep >= RecordingWorkflowStep.Upload
              ? "bg-active-work text-canvas"
              : "bg-selection text-muted-foreground"
          }`}
        >
          1
        </div>
        <div
          className={`mx-2 h-1 flex-1 ${
            currentStep >= RecordingWorkflowStep.Process ? "bg-active-work" : "bg-selection"
          }`}
        />
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            currentStep >= RecordingWorkflowStep.Process
              ? "bg-active-work text-canvas"
              : "bg-selection text-muted-foreground"
          }`}
        >
          2
        </div>
        <div
          className={`mx-2 h-1 flex-1 ${
            currentStep >= RecordingWorkflowStep.Processing ? "bg-active-work" : "bg-selection"
          }`}
        />
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            currentStep >= RecordingWorkflowStep.Processing
              ? "bg-active-work text-canvas"
              : "bg-selection text-muted-foreground"
          }`}
        >
          3
        </div>
      </div>
      <div className="mt-2 flex justify-between text-sm">
        <div className="w-24 text-center text-muted-foreground">Upload</div>
        <div className="w-24 text-center text-muted-foreground">Process</div>
        <div className="w-24 text-center text-muted-foreground">Complete</div>
      </div>
    </div>
  );
}
