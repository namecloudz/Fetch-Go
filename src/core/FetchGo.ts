import type { FetchGoRequestConfig, FetchGoResponse } from '../types/index.js';
import { InterceptorManager } from './InterceptorManager.js';
import { mergeConfig } from './mergeConfig.js';
import { dispatchRequest } from './dispatchRequest.js';
import { buildURL } from '../helpers/buildURL.js';
import { isCancel } from '../error/FetchGoError.js';
import { normalizeHeaders } from '../helpers/utils.js';

const METHOD_HEADER_KEYS = new Set<string>(['common', 'get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

function flattenHeaders(
    headers: FetchGoRequestConfig['headers'],
    method: string
): Record<string, string> {
    if (!headers) return {};

    // If it's Headers or [string, string][] — normalize directly
    if (headers instanceof Headers || Array.isArray(headers)) {
        return normalizeHeaders(headers);
    }

    // Check if this is a MethodHeaders object (has common/get/post etc.)
    const hasMethodKeys = Object.keys(headers).some(k => METHOD_HEADER_KEYS.has(k.toLowerCase()));

    if (!hasMethodKeys) {
        return normalizeHeaders(headers as Record<string, string>);
    }

    const result: Record<string, string> = {};
    const methodHeaders = headers as Record<string, unknown>;

    // 1. Start with common headers
    if (methodHeaders.common && typeof methodHeaders.common === 'object') {
        Object.assign(result, methodHeaders.common);
    }

    // 2. Add method-specific headers
    const lowerMethod = method.toLowerCase();
    if (methodHeaders[lowerMethod] && typeof methodHeaders[lowerMethod] === 'object') {
        Object.assign(result, methodHeaders[lowerMethod] as Record<string, string>);
    }

    // 3. Add non-method-key headers (flat headers mixed in)
    for (const [key, value] of Object.entries(methodHeaders)) {
        if (!METHOD_HEADER_KEYS.has(key.toLowerCase()) && typeof value === 'string') {
            result[key] = value;
        }
    }

    return normalizeHeaders(result);
}

export class FetchGo {
    defaults: FetchGoRequestConfig;

    interceptors: {
        request: InterceptorManager<FetchGoRequestConfig>;
        response: InterceptorManager<FetchGoResponse>;
    };

    constructor(config: FetchGoRequestConfig = {}) {
        this.defaults = config;
        this.interceptors = {
            request: new InterceptorManager<FetchGoRequestConfig>(),
            response: new InterceptorManager<FetchGoResponse>(),
        };
    }

    async request<T = unknown>(
        configOrUrl: string | FetchGoRequestConfig,
        overrides?: FetchGoRequestConfig
    ): Promise<FetchGoResponse<T>> {
        let config: FetchGoRequestConfig;

        if (typeof configOrUrl === 'string') {
            config = mergeConfig(this.defaults, { ...overrides, url: configOrUrl });
        } else {
            config = mergeConfig(this.defaults, configOrUrl);
        }

        // Flatten per-method headers before dispatching
        const method = (config.method || 'GET').toUpperCase();
        config.headers = flattenHeaders(config.headers, method);

        type ChainItem = {
            fulfilled: (value: unknown) => unknown | Promise<unknown>;
            rejected?: (error: unknown) => unknown;
            runWhen?: (value: unknown) => boolean;
            synchronous?: boolean;
        };

        // Check if all request interceptors are synchronous
        let requestInterceptorsSynchronous = true;
        const requestChain: ChainItem[] = [];
        this.interceptors.request.forEach((handler) => {
            if (handler.synchronous !== true) {
                requestInterceptorsSynchronous = false;
            }
            requestChain.unshift(handler as ChainItem);
        });

        const responseChain: ChainItem[] = [];
        this.interceptors.response.forEach((handler) => {
            responseChain.push(handler as ChainItem);
        });

        // Filter by runWhen
        const activeRequestChain = requestChain.filter(item => {
            if (item.runWhen && typeof item.runWhen === 'function') {
                return item.runWhen(config);
            }
            return true;
        });

        let currentConfig = config;

        if (requestInterceptorsSynchronous) {
            // Run request interceptors synchronously (no await)
            for (const { fulfilled, rejected } of activeRequestChain) {
                try {
                    currentConfig = fulfilled(currentConfig) as FetchGoRequestConfig;
                } catch (error) {
                    if (rejected) {
                        currentConfig = rejected(error) as FetchGoRequestConfig;
                    } else {
                        throw error;
                    }
                }
            }
        } else {
            // Run request interceptors asynchronously (default)
            for (const { fulfilled, rejected } of activeRequestChain) {
                try {
                    currentConfig = (await fulfilled(currentConfig)) as FetchGoRequestConfig;
                } catch (error) {
                    if (rejected) {
                        currentConfig = (await rejected(error)) as FetchGoRequestConfig;
                    } else {
                        throw error;
                    }
                }
            }
        }

        // Filter response interceptors by runWhen too
        const activeResponseChain = responseChain.filter(item => {
            if (item.runWhen && typeof item.runWhen === 'function') {
                return item.runWhen(config);
            }
            return true;
        });

        let response: FetchGoResponse;
        try {
            response = await dispatchRequest(currentConfig);
        } catch (error) {
            for (const { rejected } of activeResponseChain) {
                if (rejected) {
                    try {
                        const result = await rejected(error);
                        if (result && typeof result === 'object' && 'data' in result && 'status' in result) {
                            return result as FetchGoResponse<T>;
                        }
                    } catch (interceptorError) {
                        error = interceptorError;
                    }
                }
            }
            throw error;
        }

        for (const { fulfilled, rejected } of activeResponseChain) {
            try {
                response = (await fulfilled(response)) as FetchGoResponse;
            } catch (error) {
                if (rejected) {
                    const result = await rejected(error);
                    if (result && typeof result === 'object' && 'data' in result && 'status' in result) {
                        response = result as FetchGoResponse;
                    }
                } else {
                    throw error;
                }
            }
        }

        return response as FetchGoResponse<T>;
    }


    get<T = unknown>(url: string, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>> {
        return this.request<T>(url, { ...config, method: 'GET' });
    }

    delete<T = unknown>(url: string, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>> {
        return this.request<T>(url, { ...config, method: 'DELETE' });
    }

    head<T = unknown>(url: string, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>> {
        return this.request<T>(url, { ...config, method: 'HEAD' });
    }

    options<T = unknown>(url: string, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>> {
        return this.request<T>(url, { ...config, method: 'OPTIONS' });
    }

    post<T = unknown>(url: string, data?: unknown, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>> {
        return this.request<T>(url, { ...config, method: 'POST', data });
    }

    put<T = unknown>(url: string, data?: unknown, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>> {
        return this.request<T>(url, { ...config, method: 'PUT', data });
    }

    patch<T = unknown>(url: string, data?: unknown, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>> {
        return this.request<T>(url, { ...config, method: 'PATCH', data });
    }

    postForm<T = unknown>(url: string, data?: unknown, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>> {
        return this.request<T>(url, { ...config, method: 'POST', data, formSerializer: 'formdata' });
    }

    putForm<T = unknown>(url: string, data?: unknown, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>> {
        return this.request<T>(url, { ...config, method: 'PUT', data, formSerializer: 'formdata' });
    }

    patchForm<T = unknown>(url: string, data?: unknown, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>> {
        return this.request<T>(url, { ...config, method: 'PATCH', data, formSerializer: 'formdata' });
    }

    getUri(config?: FetchGoRequestConfig): string {
        const merged = config ? mergeConfig(this.defaults, config) : this.defaults;
        return buildURL(merged.baseURL, merged.url, merged.params, merged.paramsSerializer, merged.allowAbsoluteUrls);
    }

    create(config?: FetchGoRequestConfig): FetchGo {
        return new FetchGo(mergeConfig(this.defaults, config));
    }

    // ── Static Helpers (Axios compat) ────────────────────────
    all<T>(promises: Promise<T>[]): Promise<T[]> {
        return Promise.all(promises);
    }

    spread<T, R>(callback: (...args: T[]) => R): (arr: T[]) => R {
        return (arr: T[]) => callback(...arr);
    }

    isCancel(error: unknown): boolean {
        return isCancel(error);
    }
}
