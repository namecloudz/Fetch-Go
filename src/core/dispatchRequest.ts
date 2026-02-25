import type { FetchGoRequestConfig, FetchGoResponse, RetryConfig } from '../types/index.js';
import { FetchGoError, ERR_NETWORK, ERR_TIMEOUT, ERR_CANCELED, ERR_BAD_REQUEST, ERR_BAD_RESPONSE } from '../error/FetchGoError.js';
import { buildURL } from '../helpers/buildURL.js';
import { normalizeHeaders, isPlainObject, isFormData, isURLSearchParams, isBlob, isArrayBuffer, isStream } from '../helpers/utils.js';

/** Default retry config */
const DEFAULT_RETRY: RetryConfig = {
    retries: 0,
    delay: 300,
    backoff: 2,
    retryOn: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'],
    retryStatusCodes: [408, 429, 500, 502, 503, 504],
};

/** Default status validator (2xx = success) */
function defaultValidateStatus(status: number): boolean {
    return status >= 200 && status < 300;
}

/**
 * Normalize retry config from various input formats
 */
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

/**
 * Sleep utility for retry delays
 */
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

/**
 * Prepare the request body — auto-serialize objects to JSON.
 */
function prepareBody(
    data: unknown,
    headers: Record<string, string>
): BodyInit | undefined {
    if (data === undefined || data === null) return undefined;

    // Don't touch FormData, Blob, ArrayBuffer, ReadableStream, URLSearchParams, or strings
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

    // Auto-serialize plain objects and arrays to JSON
    if (isPlainObject(data) || Array.isArray(data)) {
        if (!headers['content-type']) {
            headers['content-type'] = 'application/json';
        }
        return JSON.stringify(data);
    }

    return data as BodyInit;
}

/**
 * Parse the response body based on content-type or explicit responseType.
 */
async function parseResponse(
    response: Response,
    responseType?: string
): Promise<unknown> {
    // Explicit response type takes precedence
    if (responseType) {
        switch (responseType) {
            case 'json': return response.json();
            case 'text': return response.text();
            case 'blob': return response.blob();
            case 'arraybuffer': return response.arrayBuffer();
            case 'formdata': return response.formData();
        }
    }

    // No body to parse
    if (response.status === 204 || response.status === 304) {
        return null;
    }

    const contentType = response.headers.get('content-type') || '';

    // Auto-detect JSON
    if (contentType.includes('application/json')) {
        try {
            return await response.json();
        } catch {
            return null;
        }
    }

    // Try JSON parsing for unknown content types (common pattern)
    if (!contentType || contentType.includes('text/')) {
        const text = await response.text();
        // Attempt JSON parse for text responses
        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    // Default: return text
    return response.text();
}

/**
 * Build a combined AbortSignal from timeout + user signal.
 */
function buildAbortSignal(
    config: FetchGoRequestConfig
): { signal: AbortSignal | undefined; cleanup: () => void } {
    const signals: AbortSignal[] = [];
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    // User-supplied signal
    if (config.signal) {
        signals.push(config.signal);
    }

    // Timeout signal
    if (config.timeout && config.timeout > 0) {
        // Use AbortSignal.timeout if available
        if ('timeout' in AbortSignal) {
            signals.push(AbortSignal.timeout(config.timeout));
        } else {
            // Fallback for older environments
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

    // Combine multiple signals using AbortSignal.any if available
    if ('any' in AbortSignal) {
        return {
            signal: AbortSignal.any(signals),
            cleanup: () => {
                if (timeoutId) clearTimeout(timeoutId);
            },
        };
    }

    // Fallback: manual combination
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

/**
 * Dispatch a single fetch request (no interceptors).
 */
async function executeFetch(
    config: FetchGoRequestConfig
): Promise<FetchGoResponse> {
    const headers = normalizeHeaders(config.headers);

    // Apply request transforms
    let body = config.data;
    if (config.transformRequest) {
        for (const transform of config.transformRequest) {
            body = transform(body, headers);
        }
    }

    // Prepare body (auto JSON.stringify)
    const preparedBody = prepareBody(body, headers);

    // Build final URL
    const url = buildURL(config.baseURL, config.url, config.params, config.paramsSerializer);

    if (!url) {
        throw new FetchGoError('No URL provided', ERR_BAD_REQUEST, config);
    }

    // Build abort signal
    const { signal, cleanup } = buildAbortSignal(config);

    // Build fetch init
    const method = (config.method || 'GET').toUpperCase();
    const init: RequestInit = {
        method,
        headers,
        signal,
        ...config.fetchOptions,
    };

    // Only include body for methods that support it
    if (preparedBody !== undefined && !['GET', 'HEAD'].includes(method)) {
        init.body = preparedBody;
    }

    if (config.withCredentials) {
        init.credentials = 'include';
    }
    if (config.mode) init.mode = config.mode;
    if (config.cache) init.cache = config.cache;
    if (config.redirect) init.redirect = config.redirect;
    if (config.referrerPolicy) init.referrerPolicy = config.referrerPolicy;
    if (config.integrity) init.integrity = config.integrity;
    if (config.keepalive !== undefined) init.keepalive = config.keepalive;

    let rawResponse: Response;

    try {
        rawResponse = await fetch(url, init);
    } catch (error) {
        cleanup();

        if (error instanceof DOMException) {
            if (error.name === 'AbortError') {
                // Check if it was a timeout or user cancel
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

    // Parse response
    let data: unknown;
    try {
        data = await parseResponse(rawResponse, config.responseType);
    } catch {
        data = null;
    }

    cleanup();

    // Apply response transforms
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

    // Check status code
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

/**
 * Dispatch a request with retry logic.
 * This is the main entry point called by FetchGo.request() after interceptors.
 */
export async function dispatchRequest(
    config: FetchGoRequestConfig
): Promise<FetchGoResponse> {
    const retryConfig = normalizeRetryConfig(config.retry);
    const method = (config.method || 'GET').toUpperCase();

    let lastError: unknown;

    for (let attempt = 0; attempt <= retryConfig.retries; attempt++) {
        try {
            return await executeFetch(config);
        } catch (error) {
            lastError = error;

            // Don't retry if cancelled
            if (error instanceof FetchGoError && error.code === ERR_CANCELED) {
                throw error;
            }

            // Don't retry if signal aborted
            if (config.signal?.aborted) {
                throw error;
            }

            // Check if we should retry
            const isLastAttempt = attempt === retryConfig.retries;
            if (isLastAttempt) throw error;

            // Check method
            if (!retryConfig.retryOn.includes(method)) throw error;

            // Check custom condition
            if (retryConfig.retryCondition && !retryConfig.retryCondition(error)) {
                throw error;
            }

            // Check status code
            if (error instanceof FetchGoError && error.status) {
                if (!retryConfig.retryStatusCodes.includes(error.status)) {
                    throw error;
                }
            }

            // Wait before retry (exponential backoff)
            const delay = retryConfig.delay * Math.pow(retryConfig.backoff, attempt);
            await sleep(delay, config.signal);
        }
    }

    /* istanbul ignore next */
    throw lastError;
}
