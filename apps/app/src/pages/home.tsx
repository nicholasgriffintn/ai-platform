import { ConversationPage } from "~/components/ConversationThread/ConversationPage";

export function meta() {
	return [
		{ title: "Polychat" },
		{
			name: "description",
			content: "Chat with multiple AI models from one place",
		},
	];
}

export default function Home() {
	return <ConversationPage title="Conversation" />;
}
