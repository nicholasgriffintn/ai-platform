import type { ServiceContext } from "~/lib/context/serviceContext";

export const handleCreateMemoryGroup = async (
	context: ServiceContext,
	title: string,
	description?: string,
	category?: string,
): Promise<Record<string, unknown>> => {
	context.ensureDatabase();
	const user = context.requireUser();

	const repository = context.repositories.memories;

	const group = await repository.createMemoryGroup(
		user.id,
		title,
		description,
		category,
	);

	return group;
};
