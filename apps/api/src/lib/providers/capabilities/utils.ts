interface GenerationProvider<Request, Result = unknown> {
	generate(request: Request): Promise<Result>;
}

type GenerationProviderResult<Provider> =
	Provider extends GenerationProvider<any, infer Result> ? Result : never;

interface GenerateWithProviderFallbackOptions<
	Request extends { model?: string },
	Provider extends GenerationProvider<Request, any>,
> {
	providerName: string;
	defaultProvider: string;
	request: Request;
	getProvider: (providerName: string) => Provider;
	allowFallback?: boolean;
}

export async function generateWithProviderFallback<
	Request extends { model?: string },
	Provider extends GenerationProvider<Request, any>,
>({
	providerName,
	defaultProvider,
	request,
	getProvider,
	allowFallback = true,
}: GenerateWithProviderFallbackOptions<Request, Provider>): Promise<
	GenerationProviderResult<Provider>
> {
	try {
		return await getProvider(providerName).generate(request);
	} catch (error) {
		if (allowFallback && providerName !== defaultProvider && !request.model) {
			return getProvider(defaultProvider).generate(request);
		}

		throw error;
	}
}
