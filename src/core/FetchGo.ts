import type { FetchGoRequestConfig, FetchGoResponse } from '../types/index.js';
import { InterceptorManager } from './InterceptorManager.js';
import { mergeConfig } from './mergeConfig.js';
import { dispatchRequest } from './dispatchRequest.js';

/**
 * FetchGo — Lightweight Axios-compatible HTTP client built on native fetch().
 *
 * Usage:
 *   const api = new FetchGo({ baseURL: 'https://api.example.com' });
 *   const { data } = await api.get<User[]>('/users');
 */
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

    /**
     * Main request method — runs interceptor chain + dispatch.
     */
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

        // Build interceptor chain
        // Request interceptors (LIFO order, like Axios)
        type ChainItem = {
            fulfilled: (value: unknown) => unknown | Promise<unknown>;
            rejected?: (error: unknown) => unknown;
        };

        const requestChain: ChainItem[] = [];
        this.interceptors.request.forEach((handler) => {
            requestChain.unshift(handler as ChainItem);
        });

        const responseChain: ChainItem[] = [];
        this.interceptors.response.forEach((handler) => {
            responseChain.push(handler as ChainItem);
        });

        // Apply request interceptors
        let currentConfig = config;
        for (const { fulfilled, rejected } of requestChain) {
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

        // Dispatch request
        let response: FetchGoResponse;
        try {
            response = await dispatchRequest(currentConfig);
        } catch (error) {
            // Run response error interceptors
            for (const { rejected } of responseChain) {
                if (rejected) {
                    try {
                        const result = await rejected(error);
                        // If interceptor returns a response, treat as recovered
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

        // Apply response interceptors
        for (const { fulfilled, rejected } of responseChain) {
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

    // --------------- Convenience Methods ---------------

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

    // --------------- Factory ---------------

    /**
     * Create a new FetchGo instance with merged defaults.
     */
    create(config?: FetchGoRequestConfig): FetchGo {
        return new FetchGo(mergeConfig(this.defaults, config));
    }
}
