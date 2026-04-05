export function buildDefaultDynamicModule(sourceTask: string): string {
	const safeTask = JSON.stringify(sourceTask);
	return `
		export default {
			async fetch(request, env) {
				const input = await request.json();
				const now = await env.TOOLS.now();
				const echoed = await env.TOOLS.echo(input.task || ${safeTask});
				let fetched = null;
				if (Array.isArray(input.capabilities) && input.capabilities.includes("polychat_fetch")) {
					fetched = await env.TOOLS.polychatFetch("/status");
				}
				return Response.json({
					success: true,
					output: "Task processed: " + echoed,
					generatedAt: now,
					statusProbe: fetched,
				});
			},
		};
	`;
}
