import { useParams } from "react-router";

import { PersonalExperienceRoute } from "~/components/Chat/PersonalExperienceRoute";

export function meta() {
	return [{ title: "Experience - Polychat" }];
}

export default function PersonalExperiencePage() {
	const params = useParams();
	return (
		<PersonalExperienceRoute experienceId={params.experienceId ?? ""} subpath={params["*"] ?? ""} />
	);
}
