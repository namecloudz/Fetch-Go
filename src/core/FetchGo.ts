import type { FetchGoRequestConfig, FetchGoResponse } from '../types/index.js';
import { InterceptorManager } from './InterceptorManager.js';
import { mergeConfig } from './mergeConfig.js';
import { dispatchRequest } from './dispatchRequest.js';
import { buildURL } from '../helpers/buildURL.js';

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

        let response: FetchGoResponse;
        try {
            response = await dispatchRequest(currentConfig);
        } catch (error) {
            for (const { rejected } of responseChain) {
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
}
