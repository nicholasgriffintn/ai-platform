type BeaconPrimitive = string | number | boolean;
type BeaconProperties = Record<string, string>;
type BeaconEvaluationContext = Record<string, unknown>;
type BeaconFlagMetadata = Record<string, BeaconPrimitive>;
type BeaconObjectValue = Record<string, unknown>;

interface BeaconInitConfig {
	endpoint: string;
	cdnEndpoint?: string;
	siteId: string;
	debug: boolean;
	trackClicks: boolean;
	trackUserTimings: boolean;
	respectDoNotTrack: boolean;
	directEvents?: boolean;
	directPageViews?: boolean;
	batchSize?: number;
	batchTimeout?: number;
}

interface BeaconEvent {
	name: string;
	category: string;
	label?: string;
	value?: number | string;
	non_interaction?: boolean;
	properties?: BeaconProperties;
}

interface BeaconPageView {
	content_type?: string;
	virtual_pageview?: boolean;
	properties?: BeaconProperties;
}

interface BeaconClient {
	version: string;
	config: Record<string, string>;
	init: (config: BeaconInitConfig) => void;
	trackEvent: (event: BeaconEvent) => void;
	trackPageView: (pageView: BeaconPageView) => void;
	setConsent: (consent: boolean) => void;
	hasConsent: () => boolean;
	getUserId: () => string;
}

interface BeaconOpenFeatureConfig {
	endpoint: string;
	cdnEndpoint?: string;
	siteId?: string;
	debug: boolean;
	configUrl?: string;
	storageKey?: string;
	storageDuration?: number;
	configCacheDuration?: number;
}

interface BeaconOpenFeatureDetails<TValue> {
	flagKey: string;
	value: TValue;
	variant?: string;
	reason?: string;
	errorCode?: string;
	errorMessage?: string;
	flagMetadata: BeaconFlagMetadata;
}

interface BeaconOpenFeatureOptions {
	trackEvaluation?: boolean;
	flagValueType?: "boolean" | "string" | "number" | "object";
}

interface BeaconProviderMetadata {
	name: string;
}

interface BeaconOpenFeatureClient {
	version: string;
	config: BeaconOpenFeatureConfig;
	init: (config: Partial<BeaconOpenFeatureConfig>) => Promise<BeaconOpenFeatureClient>;
	setContext: (context?: BeaconEvaluationContext) => void;
	getContext: () => BeaconEvaluationContext;
	refresh: () => Promise<unknown>;
	getProviderMetadata: () => BeaconProviderMetadata;
	getProviderStatus: () => "READY" | "NOT_READY";
	getDetails: <TValue>(
		flagKey: string,
		defaultValue: TValue,
		context?: BeaconEvaluationContext,
		options?: BeaconOpenFeatureOptions,
	) => Promise<BeaconOpenFeatureDetails<TValue>>;
	getValue: <TValue>(
		flagKey: string,
		defaultValue: TValue,
		context?: BeaconEvaluationContext,
		options?: BeaconOpenFeatureOptions,
	) => Promise<TValue>;
	getBooleanDetails: (
		flagKey: string,
		defaultValue: boolean,
		context?: BeaconEvaluationContext,
		options?: BeaconOpenFeatureOptions,
	) => Promise<BeaconOpenFeatureDetails<boolean>>;
	getBooleanValue: (
		flagKey: string,
		defaultValue: boolean,
		context?: BeaconEvaluationContext,
		options?: BeaconOpenFeatureOptions,
	) => Promise<boolean>;
	getStringDetails: (
		flagKey: string,
		defaultValue: string,
		context?: BeaconEvaluationContext,
		options?: BeaconOpenFeatureOptions,
	) => Promise<BeaconOpenFeatureDetails<string>>;
	getStringValue: (
		flagKey: string,
		defaultValue: string,
		context?: BeaconEvaluationContext,
		options?: BeaconOpenFeatureOptions,
	) => Promise<string>;
	getNumberDetails: (
		flagKey: string,
		defaultValue: number,
		context?: BeaconEvaluationContext,
		options?: BeaconOpenFeatureOptions,
	) => Promise<BeaconOpenFeatureDetails<number>>;
	getNumberValue: (
		flagKey: string,
		defaultValue: number,
		context?: BeaconEvaluationContext,
		options?: BeaconOpenFeatureOptions,
	) => Promise<number>;
	getObjectDetails: <TValue extends BeaconObjectValue>(
		flagKey: string,
		defaultValue: TValue,
		context?: BeaconEvaluationContext,
		options?: BeaconOpenFeatureOptions,
	) => Promise<BeaconOpenFeatureDetails<TValue>>;
	getObjectValue: <TValue extends BeaconObjectValue>(
		flagKey: string,
		defaultValue: TValue,
		context?: BeaconEvaluationContext,
		options?: BeaconOpenFeatureOptions,
	) => Promise<TValue>;
	track: (
		trackingEventName: string,
		context?: BeaconEvaluationContext,
		details?: BeaconEvaluationContext,
	) => void;
	shutdown: () => void;
}

interface Window {
	Beacon?: BeaconClient;
	_beaconInitialized?: boolean;
	_openFeatureInitialized?: boolean;
	BeaconOpenFeature?: BeaconOpenFeatureClient;
	OpenFeature?: BeaconOpenFeatureClient;
}
