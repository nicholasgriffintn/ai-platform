import { type ResponseDisplay, ResponseDisplayType } from "../types/functions";

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
  return ResponseDisplayType.CUSTOM;
};

export const getFunctionResponseDisplay = (name: string): ResponseDisplay => {
  const display: ResponseDisplay = {
    fields: [
      { key: "status", label: "Status" },
      { key: "content", label: "Content" },
    ],
  };

  if (name.includes("weather")) {
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
  }

  return display;
};
