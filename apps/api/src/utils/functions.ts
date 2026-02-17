import { type ResponseDisplay, ResponseDisplayType } from "~/types/functions";

export const formatFunctionName = (name: string): string => {
	return name
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
};

export const getFunctionIcon = (name: string): string => {
	if (name.includes("weather")) return "cloud";
	if (name.includes("search")) return "search";
	if (name.includes("image") || name.includes("screenshot")) return "image";
	if (name.includes("speech")) return "speech";
	if (name.includes("video")) return "video";
	if (name.includes("music")) return "music";
	if (name.includes("note")) return "file-text";
	if (name.includes("extract") || name.includes("content")) return "file-text";
	if (name.includes("create")) return "plus-circle";
	if (name.includes("get")) return "folder-open";
	if (name === "compose_functions") return "braces";
	if (name === "if_then_else") return "brain-circuit";
	if (name === "parallel_execute") return "users";
	if (name.startsWith("mcp_")) return "file-text";
	if (name.startsWith("analyse_")) return "file-text";
	return "app";
};

export const getFunctionResponseType = (name: string): ResponseDisplayType => {
	if (name.includes("search")) return ResponseDisplayType.CUSTOM;
	if (name.includes("weather")) return ResponseDisplayType.TEMPLATE;
	if (name.includes("image") || name.includes("screenshot"))
		return ResponseDisplayType.TEMPLATE;
	if (name.includes("video")) return ResponseDisplayType.TEMPLATE;
	if (name.includes("extract")) return ResponseDisplayType.TEXT;
	if (name.includes("speech")) return ResponseDisplayType.TEXT;
	if (name.includes("prompt_coach")) return ResponseDisplayType.TEMPLATE;
	if (
		name === "run_feature_implementation" ||
		name === "run_code_review" ||
		name === "run_test_suite" ||
		name === "run_bug_fix"
	)
		return ResponseDisplayType.TEMPLATE;
	if (name.includes("call_api")) return ResponseDisplayType.JSON;
	if (name === "request_approval") return ResponseDisplayType.TEMPLATE;
	if (name === "ask_user") return ResponseDisplayType.TEMPLATE;
	if (
		name === "compose_functions" ||
		name === "if_then_else" ||
		name === "parallel_execute"
	) {
		return ResponseDisplayType.TEMPLATE;
	}
	if (name.startsWith("mcp_")) return ResponseDisplayType.JSON;
	if (name.startsWith("analyse_")) return ResponseDisplayType.TEMPLATE;
	return ResponseDisplayType.CUSTOM;
};

export const getFunctionResponseDisplay = (name: string): ResponseDisplay => {
	const display: ResponseDisplay = {
		fields: [
			{ key: "status", label: "Status" },
			{ key: "content", label: "Content" },
		],
	};

	if (name.startsWith("analyse_")) {
		display.template = `
      <div class="analysis-container prose dark:prose-invert">
        <h2>Analysis</h2>
        <div class="analysis-content">
          {{md data.analysis.content}}
        </div>
        
        {{#if data.stories}}
        <div class="stories-container">
          <h3>Top Stories</h3>
          <ul class="stories-list">
            {{#each data.stories}}
              <li class="story-item">
                <a href="{{this.link}}" target="_blank" rel="noopener noreferrer">{{this.title}}</a>
              </li>
            {{/each}}
          </ul>
        </div>
        {{/if}}
        
        {{#if data.analysis.usage}}
        <div class="usage-info">
          <p><small>Tokens used: {{data.analysis.usage.total_tokens}} ({{data.analysis.usage.prompt_tokens}} prompt, {{data.analysis.usage.completion_tokens}} completion)</small></p>
        </div>
        {{/if}}
      </div>
    `;
	} else if (name.includes("weather")) {
		display.template = `
      <div class="weather-response">
        <h2>Weather Information</h2>
        <p>{{content}}</p>
        {{#if data.weather}}
          <div class="weather-details">
            <div class="weather-icon">
              <img src="https://openweathermap.org/img/wn/{{data.weather.0.icon}}@2x.png" alt="{{data.weather.0.description}}">
            </div>
            <div class="weather-info">
              <p><strong>Temperature:</strong> {{data.main.temp}}°C</p>
              <p><strong>Feels Like:</strong> {{data.main.feels_like}}°C</p>
              <p><strong>Humidity:</strong> {{data.main.humidity}}%</p>
              <p><strong>Wind:</strong> {{data.wind.speed}} m/s</p>
            </div>
          </div>
        {{/if}}
      </div>
    `;
	} else if (name.includes("image") || name.includes("screenshot")) {
		display.template = `
      <div class="image-response">
        <h2>Generated Image</h2>
        <p>{{content}}</p>
        {{#if data.url}}
          <div class="image-container">
            <img src="{{data.url}}" alt="Generated image" class="generated-image">
          </div>
        {{/if}}
      </div>
    `;
	} else if (name.includes("speech")) {
		display.template = `
      <div class="speech-response">
        <h2>Generated Speech</h2>
        <p>{{content}}</p>
      </div>
    `;
	} else if (name.includes("prompt_coach")) {
		display.template = `
      <div class="prompt-coach-response prose dark:prose-invert">
        <h2>Prompt Coach</h2>
        {{#if data.analysis}}
          <div class="analysis">
            <h3>Analysis</h3>
            <p>{{data.analysis}}</p>
          </div>
        {{/if}}
        {{#if data.suggested_prompt}}
          <div class="suggested-prompt">
            <h3>Suggested Prompt</h3>
            <p>{{data.suggested_prompt}}</p>
          </div>
        {{/if}}
        {{#if data.suggestions}}
          <div class="suggestions">
            <h3>Suggestions</h3>
            <ul>
              {{#each data.suggestions}}
                <li>{{this}}</li>
              {{/each}}
            </ul>
          </div>
        {{/if}}
        {{#if data.format_optimization}}
          <div class="format-optimization">
            <h3>Format Optimization</h3>
            <p>{{data.format_optimization}}</p>
          </div>
        {{/if}}
        {{#if data.confidence_score}}
          <div class="confidence-score">
            <h3>Confidence Score</h3>
            <p>{{data.confidence_score}}</p>
          </div>
        {{/if}}
        {{#if data.prompt_type}}
          <div class="prompt-type">
            <h3>Prompt Type</h3>
            <p>{{data.prompt_type}}</p>
          </div>
        {{/if}}
      </div>
    `;
	} else if (
		name === "run_feature_implementation" ||
		name === "run_code_review" ||
		name === "run_test_suite" ||
		name === "run_bug_fix"
	) {
		const sandboxHeading =
			name === "run_code_review"
				? "Sandbox Code Review"
				: name === "run_test_suite"
					? "Sandbox Test Suite"
					: name === "run_bug_fix"
						? "Sandbox Bug Fix"
						: "Sandbox Implementation";
		display.fields = [
			{ key: "success", label: "Success" },
			{ key: "summary", label: "Summary" },
			{ key: "branchName", label: "Branch" },
			{ key: "diff", label: "Diff" },
			{ key: "logs", label: "Logs" },
			{ key: "error", label: "Error" },
		];
		display.template = `
      <div class="sandbox-response prose dark:prose-invert">
        <h2>${sandboxHeading}</h2>
        {{#if summary}}
          <p>{{summary}}</p>
        {{/if}}
        {{#if branchName}}
          <p><strong>Branch:</strong> <code>{{branchName}}</code></p>
        {{/if}}
        {{#if diff}}
          <details>
            <summary>Diff</summary>
            <pre><code>{{diff}}</code></pre>
          </details>
        {{/if}}
        {{#if error}}
          <p><strong>Error:</strong> {{error}}</p>
        {{/if}}
      </div>
    `;
	} else if (name === "request_approval") {
		display.template = `
      <div class="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-off-white dark:bg-zinc-800 p-5 space-y-4">
        <div class="flex items-center gap-2">
          <span class="text-xl">⏸️</span>
          <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Approval Required</h3>
        </div>
        <div class="text-sm text-zinc-700 dark:text-zinc-300">
          <p>{{data.message}}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          {{#each data.options}}
            <button class="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" data-option="{{this}}">{{this}}</button>
          {{/each}}
        </div>
        {{#if data.context}}
          <details class="mt-2">
            <summary class="cursor-pointer text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200">Additional Context</summary>
            <pre class="mt-2 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-md text-xs overflow-x-auto border border-zinc-200 dark:border-zinc-700"><code>{{json data.context}}</code></pre>
          </details>
        {{/if}}
        <div class="text-xs text-zinc-500 dark:text-zinc-400">
          {{data.timestamp}}
        </div>
      </div>
    `;
	} else if (name === "ask_user") {
		display.template = `
      <div class="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-off-white dark:bg-zinc-800 p-5 space-y-4">
        <div class="flex items-center gap-2">
          <span class="text-xl">❓</span>
          <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Input Required</h3>
        </div>
        <div class="text-sm text-zinc-700 dark:text-zinc-300">
          <p>{{data.question}}</p>
        </div>
        {{#if data.expected_format}}
          <div class="text-xs text-zinc-600 dark:text-zinc-400 italic">
            Expected format: {{data.expected_format}}
          </div>
        {{/if}}
        {{#if data.suggestions}}
          <div class="flex flex-wrap gap-2">
            {{#each data.suggestions}}
              <button class="px-3 py-1.5 rounded-md bg-off-white-highlight dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40" data-suggestion="{{this}}">{{this}}</button>
            {{/each}}
          </div>
        {{/if}}
        <div class="flex gap-2">
          <input type="text" class="flex-1 h-9 px-3 py-1 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" placeholder="Your answer..." />
          <button class="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">Submit</button>
        </div>
        {{#if data.context}}
          <details class="mt-2">
            <summary class="cursor-pointer text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200">Additional Context</summary>
            <pre class="mt-2 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-md text-xs overflow-x-auto border border-zinc-200 dark:border-zinc-700"><code>{{json data.context}}</code></pre>
          </details>
        {{/if}}
        <div class="text-xs text-zinc-500 dark:text-zinc-400">
          {{data.timestamp}}
        </div>
      </div>
    `;
	} else if (
		name === "compose_functions" ||
		name === "parallel_execute" ||
		name === "if_then_else"
	) {
		const headerTitle =
			name === "compose_functions"
				? "Workflow Results"
				: name === "parallel_execute"
					? "Parallel Execution"
					: "Conditional Workflow";

		display.template = `
      <div class="workflow-response rounded-lg border border-zinc-200 dark:border-zinc-700 bg-off-white dark:bg-zinc-800 p-5 space-y-4">
        <div class="workflow-header flex items-start justify-between gap-4">
          <div>
            <h2 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">${headerTitle}</h2>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Execution summary</p>
          </div>
          <div class="flex flex-wrap gap-2 text-xs">
            {{#if data.branch}}
              <span class="workflow-branch rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100 px-2 py-0.5">Branch: {{data.branch}}</span>
            {{/if}}
            {{#if data.condition}}
              <span class="workflow-condition rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-700/50 dark:text-zinc-200 px-2 py-0.5">Condition: {{data.condition.name}}</span>
            {{/if}}
          </div>
        </div>
        {{#if data.steps}}
          <ol class="workflow-steps space-y-3">
            {{#each data.steps}}
              <li class="workflow-step rounded-md border border-zinc-200/70 dark:border-zinc-700/60 bg-white/70 dark:bg-zinc-900/40 p-3 space-y-2">
                <div class="workflow-step-header flex items-center justify-between text-xs">
                  <span class="step-name font-medium text-zinc-900 dark:text-zinc-100">{{this.name}}</span>
                  <span class="step-status uppercase tracking-wide text-[10px] text-zinc-500 dark:text-zinc-400">{{this.status}}</span>
                </div>
                {{#if this.output_var}}
                  <div class="step-output text-xs text-zinc-600 dark:text-zinc-300">Output: {{this.output_var}}</div>
                {{/if}}
                {{#if this.result_preview}}
                  <pre class="step-preview text-xs whitespace-pre-wrap rounded-md bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-700/60 p-2 text-zinc-700 dark:text-zinc-200">{{this.result_preview}}</pre>
                {{/if}}
                {{#if this.error}}
                  <div class="step-error text-xs text-red-600 dark:text-red-400">{{this.error}}</div>
                {{/if}}
              </li>
            {{/each}}
          </ol>
        {{/if}}
        {{#if data.failed_count}}
          <div class="workflow-summary text-xs text-red-600 dark:text-red-400">Failed: {{data.failed_count}}</div>
        {{/if}}
      </div>
    `;
	}
	return display;
};
