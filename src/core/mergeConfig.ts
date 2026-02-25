import type { FetchGoRequestConfig } from '../types/index.js';
import { deepMerge, normalizeHeaders } from '../helpers/utils.js';

export function mergeConfig(
    defaults: FetchGoRequestConfig,
    overrides: FetchGoRequestConfig = {}
): FetchGoRequestConfig {
    const config: FetchGoRequestConfig = deepMerge(
        defaults as Record<string, unknown>,
        overrides as Record<string, unknown>
    ) as FetchGoRequestConfig;

    const defaultHeaders = normalizeHeaders(defaults.headers);
    const overrideHeaders = normalizeHeaders(overrides.headers);
    config.headers = { ...defaultHeaders, ...overrideHeaders };

    return config;
}
