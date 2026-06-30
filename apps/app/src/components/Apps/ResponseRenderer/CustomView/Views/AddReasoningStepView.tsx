import { ReasoningSection } from "~/components/ConversationThread/ChatMessage/ReasoningSection";

export const AddReasoningStepView = ({
	data,
	embedded,
}: {
	data: {
		title: string;
		enhancedContent: string;
		content: string;
		nextStep: "continue" | "finalAnswer";
		reasoning_enhanced: boolean;
		confidence: number;
		evaluation: string;
	};
	embedded: boolean;
}) => {
	const combinedContent = `## ${data.title}${data.reasoning_enhanced ? " ✓" : ""}

**Confidence**: ${data.confidence || "unknown"}

${data.content}

${data.enhancedContent ? `**Enhanced Content:** ${data.enhancedContent}` : ""}

${data.evaluation ? `**Evaluation:** ${data.evaluation}` : ""}

${data.nextStep ? `**Next Step:** ${data.nextStep}` : ""}
`;
	return (
		<div className="max-w-full overflow-x-hidden">
			<ReasoningSection reasoning={{ content: combinedContent, collapsed: embedded }} />
		</div>
	);
};
