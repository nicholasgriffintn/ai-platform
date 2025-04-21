import { Step } from "~/pages/apps/podcasts/new";

interface StepperProps {
  currentStep: Step;
}

export function ProgressStepper({ currentStep }: StepperProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center">
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full ${
            currentStep >= Step.Upload
              ? "bg-blue-500 text-white"
              : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
          }`}
        >
          1
        </div>
        <div
          className={`flex-1 h-1 mx-2 ${
            currentStep >= Step.Process
              ? "bg-blue-500"
              : "bg-zinc-200 dark:bg-zinc-700"
          }`}
        />
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full ${
            currentStep >= Step.Process
              ? "bg-blue-500 text-white"
              : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
          }`}
        >
          2
        </div>
        <div
          className={`flex-1 h-1 mx-2 ${
            currentStep >= Step.Processing
              ? "bg-blue-500"
              : "bg-zinc-200 dark:bg-zinc-700"
          }`}
        />
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full ${
            currentStep >= Step.Processing
              ? "bg-blue-500 text-white"
              : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
          }`}
        >
          3
        </div>
      </div>
      <div className="flex justify-between mt-2 text-sm">
        <div className="text-center w-24 text-zinc-600 dark:text-zinc-400">
          Upload
        </div>
        <div className="text-center w-24 text-zinc-600 dark:text-zinc-400">
          Process
        </div>
        <div className="text-center w-24 text-zinc-600 dark:text-zinc-400">
          Complete
        </div>
      </div>
    </div>
  );
}
