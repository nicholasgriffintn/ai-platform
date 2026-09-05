import { PodcastWorkflowStep } from "./workflow";

interface StepperProps {
  currentStep: PodcastWorkflowStep;
}

export function ProgressStepper({ currentStep }: StepperProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center">
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full ${
            currentStep >= PodcastWorkflowStep.Upload
              ? "bg-active-work text-canvas"
              : "bg-selection text-muted-foreground"
          }`}
        >
          1
        </div>
        <div
          className={`flex-1 h-1 mx-2 ${
            currentStep >= PodcastWorkflowStep.Process ? "bg-active-work" : "bg-selection"
          }`}
        />
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full ${
            currentStep >= PodcastWorkflowStep.Process
              ? "bg-active-work text-canvas"
              : "bg-selection text-muted-foreground"
          }`}
        >
          2
        </div>
        <div
          className={`flex-1 h-1 mx-2 ${
            currentStep >= PodcastWorkflowStep.Processing ? "bg-active-work" : "bg-selection"
          }`}
        />
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full ${
            currentStep >= PodcastWorkflowStep.Processing
              ? "bg-active-work text-canvas"
              : "bg-selection text-muted-foreground"
          }`}
        >
          3
        </div>
      </div>
      <div className="flex justify-between mt-2 text-sm">
        <div className="text-center w-24 text-muted-foreground">Upload</div>
        <div className="text-center w-24 text-muted-foreground">Process</div>
        <div className="text-center w-24 text-muted-foreground">Complete</div>
      </div>
    </div>
  );
}
