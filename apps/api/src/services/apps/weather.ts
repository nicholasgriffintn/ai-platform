import type { IFunctionResponse, IWeather } from "../../types";
import { AssistantError, ErrorType } from "../../utils/errors";

export const getWeatherForLocation = async (
  env: any,
  location: { latitude: number; longitude: number },
): Promise<IFunctionResponse> => {
  try {
    if (!env.OPENWEATHERMAP_API_KEY) {
      throw new AssistantError(
        "Missing OPENWEATHERMAP_API_KEY variable",
        ErrorType.PARAMS_ERROR,
      );
    }

    const baseUrl = "https://api.openweathermap.org/data/2.5/weather";
    const url = `${baseUrl}?lat=${location.latitude}&lon=${location.longitude}&units=metric&appid=${env.OPENWEATHERMAP_API_KEY}`;

    const weatherResponse = await fetch(url);

    if (!weatherResponse.ok) {
      const response = "Error fetching weather results";
      return {
        status: "error",
        name: "get_weather",
        content: response,
        data: {},
      };
    }

    const weatherData: IWeather = await weatherResponse.json();

    if (weatherData.cod !== 200) {
      const response = "Sorry, I couldn't find the weather for that location";

      return {
        status: "error",
        name: "get_weather",
        content: response,
        data: {},
      };
    }

    const response = `The current temperature is ${weatherData.main.temp}°C with ${weatherData.weather[0].main}`;
    return {
      status: "success",
      name: "get_weather",
      content: response,
      data: weatherData,
    };
  } catch (error) {
    throw new AssistantError("Error fetching weather results");
  }
};
