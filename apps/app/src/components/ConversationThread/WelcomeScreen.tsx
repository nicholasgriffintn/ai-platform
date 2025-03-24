import { Logo } from "~/components/Logo";
import { SampleQuestions } from "./SampleQuestions";

interface WelcomeScreenProps {
  setInput: (input: string) => void;
}

export const WelcomeScreen = ({ setInput }: WelcomeScreenProps) => {
  return (
    <div className="text-center w-full">
      <div className="w-32 h-32 mx-auto">
        <Logo variant="default" />
      </div>
      <h2 className="md:text-4xl text-2xl font-semibold text-zinc-800 dark:text-zinc-200">
        What would you like to know?
      </h2>
      <p className="text-zinc-600 dark:text-zinc-400 mb-4 mt-2">
        I'm a helpful assistant that can answer questions about basically
        anything.
      </p>
      <SampleQuestions setInput={setInput} />
    </div>
  );
};
