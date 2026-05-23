import { HomePage } from "~/components/Home/HomePage";

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
	return <HomePage />;
}
