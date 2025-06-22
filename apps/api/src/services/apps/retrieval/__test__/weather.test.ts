import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/utils/errors", () => ({
  AssistantError: class extends Error {
    type: string;
    constructor(message: string, type?: string) {
      super(message);
      this.type = type || "UNKNOWN";
    }
  },
  ErrorType: {
    PARAMS_ERROR: "PARAMS_ERROR",
  },
}));

global.fetch = vi.fn();

import { getWeatherForLocation } from "../weather";

describe("getWeatherForLocation", () => {
  const mockEnv = {
    OPENWEATHERMAP_API_KEY: "test-api-key",
  } as any;

  const mockLocation = {
    latitude: 40.7128,
    longitude: -74.006,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should successfully fetch weather data", async () => {
    const mockWeatherData = {
      cod: 200,
      main: {
        temp: 22.5,
        feels_like: 23.1,
        temp_min: 20.0,
        temp_max: 25.0,
        pressure: 1013,
        humidity: 65,
      },
      weather: [
        {
          id: 800,
          main: "Clear",
          description: "clear sky",
          icon: "01d",
        },
      ],
      name: "New York",
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockWeatherData),
    } as Response);

    const result = await getWeatherForLocation(mockEnv, mockLocation);

    expect(result).toEqual({
      status: "success",
      name: "get_weather",
      content: "The current temperature is 22.5°C with Clear",
      data: mockWeatherData,
    });

    expect(fetch).toHaveBeenCalledWith(
      `https://api.openweathermap.org/data/2.5/weather?lat=40.7128&lon=-74.006&units=metric&appid=test-api-key`,
    );
  });

  it("should throw error for missing API key", async () => {
    const envWithoutKey = {};

    await expect(
      getWeatherForLocation(envWithoutKey, mockLocation),
    ).rejects.toThrow("Error fetching weather results");
  });

  it("should handle API response with non-200 status", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const result = await getWeatherForLocation(mockEnv, mockLocation);

    expect(result).toEqual({
      status: "error",
      name: "get_weather",
      content: "Error fetching weather results",
      data: {},
    });
  });

  it("should handle weather API error response", async () => {
    const errorWeatherData = {
      cod: 404,
      message: "city not found",
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(errorWeatherData),
    } as Response);

    const result = await getWeatherForLocation(mockEnv, mockLocation);

    expect(result).toEqual({
      status: "error",
      name: "get_weather",
      content: "Sorry, I couldn't find the weather for that location",
      data: {},
    });
  });

  it("should handle different weather conditions", async () => {
    const rainyWeatherData = {
      cod: 200,
      main: {
        temp: 18.3,
      },
      weather: [
        {
          main: "Rain",
          description: "light rain",
        },
      ],
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(rainyWeatherData),
    } as Response);

    const result = await getWeatherForLocation(mockEnv, mockLocation);

    expect(result).toEqual({
      status: "success",
      name: "get_weather",
      content: "The current temperature is 18.3°C with Rain",
      data: rainyWeatherData,
    });
  });

  it("should handle network errors", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    await expect(getWeatherForLocation(mockEnv, mockLocation)).rejects.toThrow(
      "Error fetching weather results",
    );
  });

  it("should handle invalid JSON response", async () => {
    // @ts-ignore - fetch is mocked
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error("Invalid JSON")),
    } as Response);

    await expect(getWeatherForLocation(mockEnv, mockLocation)).rejects.toThrow(
      "Error fetching weather results",
    );
  });

  it("should construct correct API URL with coordinates", async () => {
    const customLocation = {
      latitude: 51.5074,
      longitude: -0.1278,
    };

    const mockWeatherData = {
      cod: 200,
      main: { temp: 15.0 },
      weather: [{ main: "Cloudy" }],
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockWeatherData),
    } as Response);

    await getWeatherForLocation(mockEnv, customLocation);

    expect(fetch).toHaveBeenCalledWith(
      `https://api.openweathermap.org/data/2.5/weather?lat=51.5074&lon=-0.1278&units=metric&appid=test-api-key`,
    );
  });

  it("should handle negative coordinates", async () => {
    const southernLocation = {
      latitude: -33.8688,
      longitude: 151.2093,
    };

    const mockWeatherData = {
      cod: 200,
      main: { temp: 25.0 },
      weather: [{ main: "Sunny" }],
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockWeatherData),
    } as Response);

    const result = await getWeatherForLocation(mockEnv, southernLocation);

    expect(result.status).toBe("success");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("lat=-33.8688&lon=151.2093"),
    );
  });
});
