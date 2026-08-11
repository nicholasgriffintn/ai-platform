import { Logo } from "~/components/Core/Logo";
import { cn } from "~/lib/utils";
import { SampleQuestions } from "./SampleQuestions";

interface WelcomeScreenProps {
	setInput: (input: string) => void;
	title?: string;
	description?: string;
	isLoading?: boolean;
	sampleQuestions?: Array<{
		id: string;
		text: string;
		question: string;
		category: string;
	}> | null;
}

export const WelcomeScreen = ({
	setInput,
	title,
	description,
	isLoading = false,
	sampleQuestions,
}: WelcomeScreenProps) => {
	const resolvedTitle = title ?? "What would you like to know?";
	const resolvedDescription =
		description ?? "I'm a helpful assistant that can answer questions about basically anything.";

	return (
		<div className="w-full px-4 pt-4 pb-2 text-center" aria-busy={isLoading} aria-live="polite">
			<div className="w-32 h-32 mx-auto">
				<Logo variant="logo_control" />
			</div>
			<h2 className="flex min-h-16 items-end justify-center text-2xl font-semibold text-zinc-800 md:min-h-12 md:text-4xl dark:text-zinc-200">
				<span
					key={resolvedTitle}
					aria-hidden={isLoading}
					className={cn(
						isLoading
							? "opacity-0"
							: "animate-in fade-in-0 slide-in-from-bottom-2 duration-500 motion-reduce:animate-none motion-reduce:transform-none",
					)}
				>
					{resolvedTitle}
				</span>
			</h2>
			<p className="mt-2 mb-4 flex min-h-12 items-start justify-center text-zinc-600 md:min-h-6 dark:text-zinc-400">
				<span
					key={resolvedDescription}
					aria-hidden={isLoading}
					className={cn(
						isLoading
							? "opacity-0"
							: "animate-in fade-in-0 slide-in-from-bottom-1 delay-100 duration-500 motion-reduce:animate-none motion-reduce:transform-none",
					)}
				>
					{resolvedDescription}
				</span>
			</p>
			<SampleQuestions
				setInput={setInput}
				questionsOverride={sampleQuestions}
				isLoading={isLoading}
			/>
		</div>
	);
};
