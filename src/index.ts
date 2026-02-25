/**
 * Fetch-Go — Lightweight Axios-compatible HTTP client built on native fetch()
 *
 * @example
 * ```typescript
 * import fetchgo from 'fetch-go';
 *
 * // Simple GET
 * const { data } = await fetchgo.get<User[]>('/api/users');
 *
 * // POST with body
 * const { data } = await fetchgo.post('/api/users', { name: 'John' });
 *
 * // Create instance with defaults
 * const api = fetchgo.create({
 *   baseURL: 'https://api.example.com',
 *   timeout: 5000,
 *   headers: { 'Authorization': 'Bearer token' }
 * });
 *
 * // Interceptors
 * api.interceptors.request.use((config) => {
 *   config.headers = { ...config.headers, 'X-Request-ID': crypto.randomUUID() };
 *   return config;
 * });
 * ```
 *
 * @packageDocumentation
 */

import { FetchGo } from './core/FetchGo.js';

// Re-export everything
export { FetchGo } from './core/FetchGo.js';
export { FetchGoError, isFetchGoError, isCancel, ERR_CANCELED, ERR_NETWORK, ERR_TIMEOUT, ERR_BAD_REQUEST, ERR_BAD_RESPONSE } from './error/FetchGoError.js';
export { InterceptorManager } from './core/InterceptorManager.js';
export { buildURL } from './helpers/buildURL.js';

// Re-export types
export type {
    Method,
    Params,
    ParamsSerializer,
    FetchGoRequestConfig,
    FetchGoResponse,
    RetryConfig,
    FetchGoInstance,
    InterceptorHandlers,
    InterceptorManagerInterface,
} from './types/index.js';

// Create default instance
const fetchgo = new FetchGo({
    headers: {
        'Accept': 'application/json, text/plain, */*',
    },
    timeout: 0,
    validateStatus: (status: number) => status >= 200 && status < 300,
});

// Default export
export default fetchgo;

// Named export
export { fetchgo };
