import "react-router";

declare module "react-router" {
	interface Future {
		v8_middleware: true;
		v8_passThroughRequests: true;
		v8_splitRouteModules: true;
		v8_trailingSlashAwareDataRequests: true;
		v8_viteEnvironmentApi: true;
	}
}
