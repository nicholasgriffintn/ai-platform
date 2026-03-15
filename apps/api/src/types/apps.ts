import type { ChatMode, ChatRole, MessageContent, Platform } from "./chat";

export type IFunctionResponse = {
	status?: string;
	name?: string;
	content?: string | MessageContent[];
	data?: any;
	role?: ChatRole;
	citations?: string[] | null;
	log_id?: string;
	mode?: ChatMode;
	id?: string;
	timestamp?: number;
	model?: string;
	platform?: Platform;
	[key: string]: any;
};

export interface IWeather {
	cod: number;
	main: {
		temp: number;
		feels_like: number;
		temp_min: number;
		temp_max: number;
		pressure: number;
		humidity: number;
	};
	weather: {
		main: string;
		description: string;
	}[];
	wind: {
		speed: number;
		deg: number;
	};
	clouds: {
		all: number;
	};
	sys: {
		country: string;
	};
	name: string;
}
