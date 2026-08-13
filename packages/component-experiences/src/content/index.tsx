import type { ReactNode } from "react";
import "../styles.css";

export interface ContentExperienceSection {
	id: string;
	title: string;
	content: ReactNode;
}

export function ContentExperience({
	title,
	description,
	sections,
	actions,
}: {
	title: string;
	description?: string;
	sections: ContentExperienceSection[];
	actions?: ReactNode;
}) {
	return (
		<article className="polychat-experience-content">
			<header>
				<div>
					<h1>{title}</h1>
					{description && <p>{description}</p>}
				</div>
				{actions}
			</header>
			{sections.map((section) => (
				<section key={section.id} aria-labelledby={`polychat-experience-section-${section.id}`}>
					<h2 id={`polychat-experience-section-${section.id}`}>{section.title}</h2>
					{section.content}
				</section>
			))}
		</article>
	);
}
