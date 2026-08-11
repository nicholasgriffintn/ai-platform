import type {
	CreateTemplateInput,
	Template,
	TemplateKind,
	UpdateTemplateInput,
	ProjectDetail,
} from "@assistant/schemas";
import { projectTemplateConfigurationSchema } from "@assistant/schemas";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { TemplateRecord } from "~/repositories/TemplateRepository";
import { requireWorkspaceAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";
import { deriveProjectColour } from "@assistant/schemas";
import { generateId } from "~/utils/id";
import { validateProjectCapabilityReference } from "~/services/workspaces/capabilities";
import { validateProjectToolConfiguration } from "~/services/workspaces/projectTools";
import { getProject } from "~/services/workspaces";

function formatTemplate(record: TemplateRecord): Template {
	return {
		id: record.id,
		createdByUserId: record.created_by_user_id,
		workspaceId: record.workspace_id,
		kind: record.kind,
		capabilityId: record.capability_id,
		name: record.name,
		description: record.description,
		configuration: safeParseJson<Record<string, unknown>>(record.configuration) ?? {},
		status: record.status,
		createdAt: record.created_at,
		updatedAt: record.updated_at,
	};
}

async function requireTemplateAccess(
	context: ServiceContext,
	userId: number,
	templateId: string,
	mutate = false,
): Promise<TemplateRecord> {
	const template = await context.repositories.templates.getTemplateById(templateId);
	if (!template) throw new AssistantError("Template not found", ErrorType.NOT_FOUND, 404);
	if (!template.workspace_id) {
		if (template.created_by_user_id !== userId) {
			throw new AssistantError("Template not found", ErrorType.NOT_FOUND, 404);
		}
		return template;
	}
	const { role } = await requireWorkspaceAccess(context, template.workspace_id);
	if (mutate && role === "member" && template.created_by_user_id !== userId) {
		throw new AssistantError(
			"Only the template creator or a workspace admin can change it",
			ErrorType.FORBIDDEN,
			403,
		);
	}
	return template;
}

export async function listTemplates(
	context: ServiceContext,
	userId: number,
	filters: { workspaceId?: string; kind?: TemplateKind },
): Promise<{ templates: Template[] }> {
	const records = filters.workspaceId
		? (await requireWorkspaceAccess(context, filters.workspaceId),
			await context.repositories.templates.listWorkspaceTemplates(
				filters.workspaceId,
				filters.kind,
			))
		: await context.repositories.templates.listPersonalTemplates(userId, filters.kind);
	return { templates: records.map(formatTemplate) };
}

export async function createTemplate(
	context: ServiceContext,
	userId: number,
	input: CreateTemplateInput,
): Promise<Template> {
	if (input.workspaceId)
		await requireWorkspaceAccess(context, input.workspaceId, ["owner", "admin"]);
	const configuration =
		input.kind === "project"
			? projectTemplateConfigurationSchema.parse(input.configuration)
			: input.configuration;
	const created = await context.repositories.templates.createTemplate({
		createdByUserId: userId,
		workspaceId: input.workspaceId,
		kind: input.kind,
		capabilityId: input.capabilityId,
		name: input.name,
		description: input.description,
		configuration,
		status: input.status,
	});
	if (created.workspace_id) {
		await context.repositories.audit.createRecord({
			workspaceId: created.workspace_id,
			actorUserId: userId,
			action: "template.created",
			targetType: "template",
			targetId: created.id,
			metadata: { kind: created.kind },
		});
	}
	return formatTemplate(created);
}

export async function instantiateProjectTemplate(
	context: ServiceContext,
	userId: number,
	templateId: string,
	workspaceId: string,
	name?: string,
): Promise<ProjectDetail> {
	const template = await requireTemplateAccess(context, userId, templateId);
	await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
	if (template.kind !== "project" || template.status !== "active") {
		throw new AssistantError("Project template is unavailable", ErrorType.PARAMS_ERROR, 400);
	}
	const configuration = projectTemplateConfigurationSchema.parse(
		safeParseJson(template.configuration),
	);
	const capabilities = [];
	for (const capability of configuration.capabilities) {
		await validateProjectCapabilityReference(capability.kind, capability.capabilityId);
		capabilities.push({
			id: generateId(),
			kind: capability.kind,
			capabilityId: capability.capabilityId,
			configuration:
				capability.kind === "tool"
					? validateProjectToolConfiguration(capability.capabilityId, capability.configuration)
					: capability.configuration,
		});
	}
	const projectId = generateId();
	const projectName = name ?? configuration.project.name;
	await context.repositories.workspaces.createProjectWithCapabilities(
		{
			id: projectId,
			workspaceId,
			name: projectName,
			description: configuration.project.description,
			instructions: configuration.project.instructions,
			colour:
				configuration.project.colour ??
				deriveProjectColour(projectName, configuration.project.description),
			codingEnvironment: configuration.project.codingEnvironment,
			createdBy: userId,
		},
		capabilities,
	);
	await context.repositories.audit.createRecord({
		workspaceId,
		actorUserId: userId,
		action: "template.instantiated",
		targetType: "project",
		targetId: projectId,
		metadata: { templateId },
	});
	return getProject(context, projectId);
}

export async function getTemplate(context: ServiceContext, userId: number, templateId: string) {
	return formatTemplate(await requireTemplateAccess(context, userId, templateId));
}

export async function updateTemplate(
	context: ServiceContext,
	userId: number,
	templateId: string,
	input: UpdateTemplateInput,
): Promise<Template> {
	const existing = await requireTemplateAccess(context, userId, templateId, true);
	const updated = await context.repositories.templates.updateTemplate(templateId, input);
	if (!updated) throw new AssistantError("Template not found", ErrorType.NOT_FOUND, 404);
	if (existing.workspace_id) {
		await context.repositories.audit.createRecord({
			workspaceId: existing.workspace_id,
			actorUserId: userId,
			action: "template.updated",
			targetType: "template",
			targetId: templateId,
		});
	}
	return formatTemplate(updated);
}

export async function deleteTemplate(
	context: ServiceContext,
	userId: number,
	templateId: string,
): Promise<void> {
	const existing = await requireTemplateAccess(context, userId, templateId, true);
	await context.repositories.templates.deleteTemplate(templateId);
	if (existing.workspace_id) {
		await context.repositories.audit.createRecord({
			workspaceId: existing.workspace_id,
			actorUserId: userId,
			action: "template.deleted",
			targetType: "template",
			targetId: templateId,
		});
	}
}
