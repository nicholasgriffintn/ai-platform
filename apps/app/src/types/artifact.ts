export interface ArtifactProps {
	identifier: string;
	type: string;
	language?: string;
	title?: string;
	content: string;
	onOpen?: (
		artifact: ArtifactProps,
		combine?: boolean,
		artifacts?: ArtifactProps[],
	) => void;
}
