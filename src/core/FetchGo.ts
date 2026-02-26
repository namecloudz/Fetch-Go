import type { FetchGoRequestConfig, FetchGoResponse } from '../types/index.js';
import { InterceptorManager } from './InterceptorManager.js';
import { mergeConfig, flattenMethodHeaders } from './mergeConfig.js';
import { dispatchRequest } from './dispatchRequest.js';
import { buildURL } from '../helpers/buildURL.js';
import { isCancel } from '../error/FetchGoError.js';

export class FetchGo {
    defaults: FetchGoRequestConfig;

    interceptors: {
        request: InterceptorManager<FetchGoRequestConfig>;
        response: InterceptorManager<FetchGoResponse>;
    };

    // Cache: track if interceptors exist to skip chain processing
    private _hasRequestInterceptors = false;
    private _hasResponseInterceptors = false;

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
            if (overrides) {
                overrides.url = configOrUrl;
                config = mergeConfig(this.defaults, overrides);
            } else {
                config = mergeConfig(this.defaults, { url: configOrUrl });
            }
        } else {
            config = mergeConfig(this.defaults, configOrUrl);
        }

        // Flatten per-method headers — single pass
        const method = (config.method || 'GET').toUpperCase();
        config.headers = flattenMethodHeaders(config.headers, method);

        // Fast path: no interceptors (most common case)
        if (!this._hasRequestInterceptors && !this._hasResponseInterceptors) {
            return (await dispatchRequest(config)) as FetchGoResponse<T>;
        }

        // Process request interceptors
        let currentConfig = config;
        if (this._hasRequestInterceptors) {
            let sync = true;
            const chain: Array<{
                fulfilled: (v: unknown) => unknown;
                rejected?: (e: unknown) => unknown;
                runWhen?: (v: unknown) => boolean;
                synchronous?: boolean;
            }> = [];

            this.interceptors.request.forEach((h) => {
                if (!h.synchronous) sync = false;
                chain.unshift(h as typeof chain[0]);
            });

            for (const { fulfilled, rejected, runWhen } of chain) {
                if (runWhen && !runWhen(currentConfig)) continue;
                try {
                    currentConfig = (sync ? fulfilled(currentConfig) : await fulfilled(currentConfig)) as FetchGoRequestConfig;
                } catch (e) {
                    if (rejected) {
                        currentConfig = (sync ? rejected(e) : await rejected(e)) as FetchGoRequestConfig;
                    } else throw e;
                }
            }
        }

        // Dispatch
        let response: FetchGoResponse;
        if (!this._hasResponseInterceptors) {
            return (await dispatchRequest(currentConfig)) as FetchGoResponse<T>;
        }

        const resChain: Array<{
            fulfilled: (v: unknown) => unknown;
            rejected?: (e: unknown) => unknown;
            runWhen?: (v: unknown) => boolean;
        }> = [];
        this.interceptors.response.forEach((h) => resChain.push(h as typeof resChain[0]));

        try {
            response = await dispatchRequest(currentConfig);
        } catch (error) {
            let err = error;
            for (const { rejected } of resChain) {
                if (rejected) {
                    try {
                        const r = await rejected(err);
                        if (r && typeof r === 'object' && 'data' in (r as object) && 'status' in (r as object)) {
                            return r as FetchGoResponse<T>;
                        }
                    } catch (e) { err = e; }
                }
            }
            throw err;
        }

        for (const { fulfilled, rejected, runWhen } of resChain) {
            if (runWhen && typeof runWhen === 'function' && !runWhen(config)) continue;
            try {
                response = (await fulfilled(response)) as FetchGoResponse;
            } catch (e) {
                if (rejected) {
                    const r = await rejected(e);
                    if (r && typeof r === 'object' && 'data' in (r as object)) response = r as FetchGoResponse;
                } else throw e;
            }
        }

        return response as FetchGoResponse<T>;
    }

    get<T = unknown>(url: string, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>> {
        return config
            ? this.request<T>(url, { ...config, method: 'GET' })
            : this.request<T>(url, { method: 'GET' });
    }

    delete<T = unknown>(url: string, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>> {
        return config
            ? this.request<T>(url, { ...config, method: 'DELETE' })
            : this.request<T>(url, { method: 'DELETE' });
    }

    head<T = unknown>(url: string, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>> {
        return config
            ? this.request<T>(url, { ...config, method: 'HEAD' })
            : this.request<T>(url, { method: 'HEAD' });
    }

    options<T = unknown>(url: string, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>> {
        return config
            ? this.request<T>(url, { ...config, method: 'OPTIONS' })
            : this.request<T>(url, { method: 'OPTIONS' });
    }

    post<T = unknown>(url: string, data?: unknown, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>> {
        return config
            ? this.request<T>(url, { ...config, method: 'POST', data })
            : this.request<T>(url, { method: 'POST', data });
    }

    put<T = unknown>(url: string, data?: unknown, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>> {
        return config
            ? this.request<T>(url, { ...config, method: 'PUT', data })
            : this.request<T>(url, { method: 'PUT', data });
    }

    patch<T = unknown>(url: string, data?: unknown, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>> {
        return config
            ? this.request<T>(url, { ...config, method: 'PATCH', data })
            : this.request<T>(url, { method: 'PATCH', data });
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
