import { AssistantError, ErrorType } from "~/utils/errors";
import { fetchConnectorJson } from "./http";
import { getStringParam } from "./params";

export async function executeLinearOperation(
	token: string,
	operation: string,
	params: Record<string, unknown>,
) {
	if (operation === "search_issues") {
		const query = getStringParam(params, "query") ?? "";
		return fetchConnectorJson({
			url: "https://api.linear.app/graphql",
			token,
			method: "POST",
			body: {
				query: `
					query SearchIssues($query: String!) {
						issues(filter: { title: { containsIgnoreCase: $query } }, first: 20) {
							nodes {
								id
								identifier
								title
								url
								state { name }
								assignee { name }
							}
						}
					}
				`,
				variables: { query },
			},
		});
	}

	if (operation === "create_issue") {
		const teamId = getStringParam(params, "teamId");
		const title = getStringParam(params, "title");
		if (!teamId || !title) {
			throw new AssistantError("teamId and title are required", ErrorType.PARAMS_ERROR, 400);
		}
		return fetchConnectorJson({
			url: "https://api.linear.app/graphql",
			token,
			method: "POST",
			body: {
				query: `
					mutation CreateIssue($input: IssueCreateInput!) {
						issueCreate(input: $input) {
							success
							issue { id identifier title url }
						}
					}
				`,
				variables: {
					input: {
						teamId,
						title,
						description: getStringParam(params, "description"),
					},
				},
			},
		});
	}

	throw new AssistantError("Unsupported Linear operation", ErrorType.PARAMS_ERROR, 400);
}
