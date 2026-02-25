import type { FetchGoRequestConfig, FetchGoResponse, RetryConfig } from '../types/index.js';
import { FetchGoError, ERR_NETWORK, ERR_TIMEOUT, ERR_CANCELED, ERR_BAD_REQUEST, ERR_BAD_RESPONSE } from '../error/FetchGoError.js';
import { buildURL } from '../helpers/buildURL.js';
import { normalizeHeaders, isPlainObject, isFormData, isURLSearchParams, isBlob, isArrayBuffer, isStream, getCookie, objectToFormData, objectToURLSearchParams } from '../helpers/utils.js';
import { httpAdapter } from '../adapters/http.js';

const DEFAULT_RETRY: RetryConfig = {
    retries: 0,
    delay: 300,
    backoff: 2,
    retryOn: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'],
    retryStatusCodes: [408, 429, 500, 502, 503, 504],
};

function defaultValidateStatus(status: number): boolean {
    return status >= 200 && status < 300;
}

function normalizeRetryConfig(retry?: Partial<RetryConfig> | number | boolean): RetryConfig {
    if (retry === false || retry === undefined) {
        return { ...DEFAULT_RETRY, retries: 0 };
    }
    if (retry === true) {
        return { ...DEFAULT_RETRY, retries: 3 };
    }
    if (typeof retry === 'number') {
        return { ...DEFAULT_RETRY, retries: retry };
    }
    return { ...DEFAULT_RETRY, ...retry };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
            return;
        }

        const timer = setTimeout(resolve, ms);

        signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
        }, { once: true });
    });
}

function prepareBody(
    data: unknown,
    headers: Record<string, string>,
    config: FetchGoRequestConfig
): BodyInit | undefined {
    if (data === undefined || data === null) return undefined;

    if (
        typeof data === 'string' ||
        isFormData(data) ||
        isBlob(data) ||
        isArrayBuffer(data) ||
        isStream(data) ||
        isURLSearchParams(data)
    ) {
        return data as BodyInit;
    }

    if (isPlainObject(data) || Array.isArray(data)) {
        const ct = headers['content-type'] || '';
        const serializer = config.formSerializer;

        if (serializer === 'formdata' || ct.includes('multipart/form-data')) {
            delete headers['content-type'];
            return objectToFormData(data as Record<string, unknown>);
        }

        if (serializer === 'urlencoded' || ct.includes('application/x-www-form-urlencoded')) {
            headers['content-type'] = 'application/x-www-form-urlencoded';
            return objectToURLSearchParams(data as Record<string, unknown>);
        }

        if (!headers['content-type']) {
            headers['content-type'] = 'application/json';
        }
        return JSON.stringify(data);
    }

    return data as BodyInit;
}

async function parseResponse(
    response: Response,
    responseType?: string
): Promise<unknown> {
    if (responseType === 'stream') return response.body;
    if (responseType) {
        switch (responseType) {
            case 'json': return response.json();
            case 'text': return response.text();
            case 'blob': return response.blob();
            case 'arraybuffer': return response.arrayBuffer();
            case 'formdata': return response.formData();
        }
    }

    if (response.status === 204 || response.status === 304) {
        return null;
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        try {
            return await response.json();
        } catch {
            return null;
        }
    }

    if (!contentType || contentType.includes('text/')) {
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    return response.text();
}

function buildAbortSignal(
    config: FetchGoRequestConfig
): { signal: AbortSignal | undefined; cleanup: () => void } {
    const signals: AbortSignal[] = [];
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    if (config.signal) {
        signals.push(config.signal);
    }

    if (config.timeout && config.timeout > 0) {
        if ('timeout' in AbortSignal) {
            signals.push(AbortSignal.timeout(config.timeout));
        } else {
            controller = new AbortController();
            timeoutId = setTimeout(() => controller!.abort(new DOMException('Timeout', 'TimeoutError')), config.timeout);
            signals.push(controller.signal);
        }
    }

    if (signals.length === 0) {
        return { signal: undefined, cleanup: () => { } };
    }

    if (signals.length === 1) {
        return {
            signal: signals[0],
            cleanup: () => {
                if (timeoutId) clearTimeout(timeoutId);
            },
        };
    }

    if ('any' in AbortSignal) {
        return {
            signal: AbortSignal.any(signals),
            cleanup: () => {
                if (timeoutId) clearTimeout(timeoutId);
            },
        };
    }

    const combined = new AbortController();
    const onAbort = () => combined.abort();
    for (const s of signals) {
        if (s.aborted) {
            combined.abort();
            break;
        }
        s.addEventListener('abort', onAbort, { once: true });
    }

    return {
        signal: combined.signal,
        cleanup: () => {
            if (timeoutId) clearTimeout(timeoutId);
            for (const s of signals) {
                s.removeEventListener('abort', onAbort);
            }
        },
    };
}

async function executeFetch(
    config: FetchGoRequestConfig
): Promise<FetchGoResponse> {
    const headers = normalizeHeaders(config.headers);

    let body = config.data;
    if (config.transformRequest) {
        for (const transform of config.transformRequest) {
            body = transform(body, headers);
        }
    }

    const preparedBody = prepareBody(body, headers, config);

    if (config.xsrfCookieName && config.xsrfHeaderName) {
        const token = getCookie(config.xsrfCookieName);
        if (token) {
            headers[config.xsrfHeaderName.toLowerCase()] = token;
        }
    }

    if (config.auth) {
        const { username, password } = config.auth;
        headers['authorization'] = 'Basic ' + btoa(`${username}:${password}`);
    }

    const url = buildURL(config.baseURL, config.url, config.params, config.paramsSerializer, config.allowAbsoluteUrls);

    if (!url) {
        throw new FetchGoError('No URL provided', ERR_BAD_REQUEST, config);
    }

    const { signal, cleanup } = buildAbortSignal(config);

    const method = (config.method || 'GET').toUpperCase();
    const useManualRedirect = config.maxRedirects !== undefined;
    const init: RequestInit = {
        method,
        headers,
        signal,
        redirect: useManualRedirect ? 'manual' : (config.redirect || 'follow'),
        ...config.fetchOptions,
    };

    let finalBody = preparedBody;
    if (finalBody !== undefined && !['GET', 'HEAD'].includes(method)) {
        if (config.onUploadProgress && finalBody instanceof Blob) {
            const blob = finalBody;
            const totalSize = blob.size;
            let uploaded = 0;
            const startTime = Date.now();
            const reader = blob.stream().getReader();

            finalBody = new ReadableStream({
                async pull(controller) {
                    const { done, value } = await reader.read();
                    if (done) {
                        controller.close();
                        return;
                    }
                    uploaded += value.byteLength;
                    const elapsed = (Date.now() - startTime) / 1000;
                    const rate = elapsed > 0 ? uploaded / elapsed : 0;
                    config.onUploadProgress!({
                        loaded: uploaded,
                        total: totalSize,
                        progress: totalSize > 0 ? uploaded / totalSize : undefined,
                        bytes: value.byteLength,
                        rate,
                        estimated: rate > 0 ? (totalSize - uploaded) / rate : undefined,
                        upload: true,
                    });
                    controller.enqueue(value);
                },
            });
            (init as Record<string, unknown>).duplex = 'half';
        }
        init.body = finalBody;
    }

    if (config.withCredentials) {
        init.credentials = 'include';
    }
    if (config.mode) init.mode = config.mode;
    if (config.cache) init.cache = config.cache;
    if (config.referrerPolicy) init.referrerPolicy = config.referrerPolicy;
    if (config.integrity) init.integrity = config.integrity;
    if (config.keepalive !== undefined) init.keepalive = config.keepalive;

    let rawResponse: Response;
    const maxRedirects = config.maxRedirects ?? 21;
    let redirectCount = 0;
    let currentUrl = url;
    let currentInit = init;

    try {
        rawResponse = await fetch(currentUrl, currentInit);

        while (useManualRedirect && [301, 302, 303, 307, 308].includes(rawResponse.status)) {
            redirectCount++;
            if (redirectCount > maxRedirects) {
                cleanup();
                throw new FetchGoError(
                    `Maximum redirects (${maxRedirects}) exceeded`,
                    ERR_BAD_REQUEST,
                    config
                );
            }
            const location = rawResponse.headers.get('location');
            if (!location) break;

            currentUrl = new URL(location, currentUrl).href;

            if (config.beforeRedirect) {
                const resHeaders: Record<string, string> = {};
                rawResponse.headers.forEach((v, k) => { resHeaders[k] = v; });
                config.beforeRedirect({ url: currentUrl, method: currentInit.method }, { headers: resHeaders });
            }

            if ([301, 302, 303].includes(rawResponse.status)) {
                currentInit = { ...currentInit, method: 'GET', body: undefined };
            }
            rawResponse = await fetch(currentUrl, currentInit);
        }
    } catch (error) {
        cleanup();

        if (error instanceof FetchGoError) throw error;

        if (error instanceof DOMException) {
            if (error.name === 'AbortError') {
                if (config.signal?.aborted) {
                    throw new FetchGoError('Request canceled', ERR_CANCELED, config);
                }
                throw new FetchGoError(
                    `Request timeout of ${config.timeout}ms exceeded`,
                    ERR_TIMEOUT,
                    config
                );
            }
            if (error.name === 'TimeoutError') {
                throw new FetchGoError(
                    `Request timeout of ${config.timeout}ms exceeded`,
                    ERR_TIMEOUT,
                    config
                );
            }
        }

        throw new FetchGoError(
            (error as Error).message || 'Network Error',
            ERR_NETWORK,
            config
        );
    }

    let data: unknown;

    if (config.onDownloadProgress && rawResponse.body) {
        const reader = rawResponse.body.getReader();
        const total = parseInt(rawResponse.headers.get('content-length') || '0', 10) || undefined;
        const chunks: Uint8Array[] = [];
        let loaded = 0;
        const startTime = Date.now();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            chunks.push(value);
            const bytes = value.byteLength;
            loaded += bytes;

            if (config.maxContentLength && loaded > config.maxContentLength) {
                reader.cancel();
                cleanup();
                throw new FetchGoError(
                    `Response size (${loaded}) exceeds maxContentLength (${config.maxContentLength})`,
                    ERR_BAD_RESPONSE,
                    config
                );
            }

            const elapsed = (Date.now() - startTime) / 1000;
            const rate = elapsed > 0 ? loaded / elapsed : 0;
            config.onDownloadProgress({
                loaded,
                total,
                progress: total ? loaded / total : undefined,
                bytes,
                rate,
                estimated: total && rate > 0 ? (total - loaded) / rate : undefined,
                download: true,
            });
        }

        const combined = new Uint8Array(loaded);
        let offset = 0;
        for (const chunk of chunks) {
            combined.set(chunk, offset);
            offset += chunk.byteLength;
        }


        const reconstructedResponse = new Response(combined, {
            status: rawResponse.status,
            statusText: rawResponse.statusText,
            headers: rawResponse.headers,
        });

        try {
            data = await parseResponse(reconstructedResponse, config.responseType);
        } catch {
            data = new TextDecoder().decode(combined);
        }
    } else {
        try {
            data = await parseResponse(rawResponse, config.responseType);
        } catch {
            data = null;
        }
    }

    cleanup();

    if (config.transformResponse) {
        for (const transform of config.transformResponse) {
            data = transform(data);
        }
    }

    const response: FetchGoResponse = {
        data,
        status: rawResponse.status,
        statusText: rawResponse.statusText,
        headers: rawResponse.headers,
        config,
        request: rawResponse,
    };

    const validateStatus = config.validateStatus || defaultValidateStatus;
    if (!validateStatus(rawResponse.status)) {
        throw new FetchGoError(
            `Request failed with status code ${rawResponse.status}`,
            rawResponse.status >= 400 && rawResponse.status < 500 ? ERR_BAD_REQUEST : ERR_BAD_RESPONSE,
            config,
            response
        );
    }

    return response;
}

function selectAdapter(config: FetchGoRequestConfig): (config: FetchGoRequestConfig) => Promise<FetchGoResponse> {
    if (config.adapter) {
        if (typeof config.adapter === 'function') return config.adapter;
        if (config.adapter === 'http') return httpAdapter;
        return executeFetch;
    }
    return executeFetch;
}

export async function dispatchRequest(
    config: FetchGoRequestConfig
): Promise<FetchGoResponse> {
    const retryConfig = normalizeRetryConfig(config.retry);
    const method = (config.method || 'GET').toUpperCase();
    const adapter = selectAdapter(config);

    let lastError: unknown;

    for (let attempt = 0; attempt <= retryConfig.retries; attempt++) {
        try {
            return await adapter(config);
        } catch (error) {
            lastError = error;

            if (error instanceof FetchGoError && error.code === ERR_CANCELED) {
                throw error;
            }

            if (config.signal?.aborted) {
                throw error;
            }

            const isLastAttempt = attempt === retryConfig.retries;
            if (isLastAttempt) throw error;

            if (!retryConfig.retryOn.includes(method)) throw error;

            if (retryConfig.retryCondition && !retryConfig.retryCondition(error)) {
                throw error;
            }

            if (error instanceof FetchGoError && error.status) {
                if (!retryConfig.retryStatusCodes.includes(error.status)) {
                    throw error;
                }
            }

            const delay = retryConfig.delay * Math.pow(retryConfig.backoff, attempt);
            await sleep(delay, config.signal);
        }
    }

    /* istanbul ignore next */
    throw lastError;
}
