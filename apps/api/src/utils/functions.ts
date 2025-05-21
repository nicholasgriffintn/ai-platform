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
  }
  return display;
};
