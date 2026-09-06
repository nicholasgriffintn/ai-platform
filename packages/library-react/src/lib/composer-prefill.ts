export const COMPOSER_PREFILL_PARAM = "prompt";

export const COMPOSER_PREFILL_MAX_LENGTH = 2000;

export function buildComposerPrefillHref(prompt: string, basePath = "/"): string {
  const query = new URLSearchParams({
    [COMPOSER_PREFILL_PARAM]: prompt.slice(0, COMPOSER_PREFILL_MAX_LENGTH),
  });

  return `${basePath}?${query.toString()}`;
}

export function readComposerPrefill(search: URLSearchParams): string | null {
  const prompt = search.get(COMPOSER_PREFILL_PARAM)?.trim();

  return prompt ? prompt.slice(0, COMPOSER_PREFILL_MAX_LENGTH) : null;
}
