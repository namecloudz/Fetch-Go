/**
 * XHR Adapter — fallback for upload progress in browsers
 * that don't support ReadableStream as fetch() body (e.g. Safari).
 *
 * Only used when:
 *   1. onUploadProgress is specified
 *   2. Browser doesn't support request streams
 *   3. Running in a browser (not Node.js)
 */
import type { FetchGoRequestConfig, FetchGoResponse, FetchGoProgressEvent } from '../types/index.js';
import { FetchGoError, ERR_NETWORK, ERR_TIMEOUT, ERR_CANCELED, ERR_BAD_REQUEST, ERR_BAD_RESPONSE } from '../error/FetchGoError.js';
import { buildURL } from '../helpers/buildURL.js';
import { isPlainObject, isFormData, isURLSearchParams, objectToFormData, objectToURLSearchParams } from '../helpers/utils.js';

function defaultValidateStatus(status: number): boolean {
    return status >= 200 && status < 300;
}

function prepareXHRBody(
    data: unknown,
    headers: Record<string, string>,
    config: FetchGoRequestConfig
): BodyInit | undefined {
    if (data === undefined || data === null) return undefined;

    if (typeof data === 'string' || isFormData(data) || isURLSearchParams(data)) {
        return data as BodyInit;
    }

    if (data instanceof Blob || data instanceof ArrayBuffer) {
        return data;
    }

    if (isPlainObject(data) || Array.isArray(data)) {
        const ct = headers['content-type'] || '';
        const fs = config.formSerializer;

        if (fs === 'formdata' || ct.includes('multipart/form-data')) {
            delete headers['content-type']; // let XHR set boundary
            const FormDataClass = config.env?.FormData || globalThis.FormData;
            const opts = typeof config.formSerializer === 'object' ? config.formSerializer : undefined;
            return objectToFormData(data as Record<string, unknown>, new FormDataClass(), undefined, opts);
        }

        if (fs === 'urlencoded' || ct.includes('application/x-www-form-urlencoded')) {
            headers['content-type'] = 'application/x-www-form-urlencoded';
            return objectToURLSearchParams(data as Record<string, unknown>).toString();
        }

        if (!headers['content-type']) {
            headers['content-type'] = 'application/json';
        }
        return JSON.stringify(data);
    }

    return data as BodyInit;
}

/** Detect if the browser supports ReadableStream as fetch body */
let _supportsRequestStreams: boolean | undefined;
export function supportsRequestStreams(): boolean {
    if (_supportsRequestStreams !== undefined) return _supportsRequestStreams;

    try {
        _supportsRequestStreams = typeof ReadableStream !== 'undefined' &&
            typeof Request !== 'undefined' &&
            'body' in new Request('http://x', {
                method: 'POST',
                body: new ReadableStream(),
                // @ts-expect-error — duplex is not yet in all TS type defs
                duplex: 'half',
            });
    } catch {
        _supportsRequestStreams = false;
    }
    return _supportsRequestStreams;
}

export function xhrAdapter(config: FetchGoRequestConfig): Promise<FetchGoResponse> {
    return new Promise<FetchGoResponse>((resolve, reject) => {
        // Check XHR availability
        if (typeof XMLHttpRequest === 'undefined') {
            reject(new FetchGoError('XMLHttpRequest is not available', ERR_NETWORK, config));
            return;
        }

        const headers = (config.headers || {}) as Record<string, string>;

        let body = config.data;
        if (config.transformRequest) {
            for (const transform of config.transformRequest) {
                body = transform(body, headers);
            }
        }

        const prepared = prepareXHRBody(body, headers, config);

        // Auth
        if (config.auth) {
            const { username, password } = config.auth;
            headers['authorization'] = 'Basic ' + btoa(`${username}:${password}`);
        }

        const url = buildURL(config.baseURL, config.url, config.params, config.paramsSerializer, config.allowAbsoluteUrls);
        if (!url) {
            reject(new FetchGoError('No URL provided', ERR_BAD_REQUEST, config));
            return;
        }

        const method = (config.method || 'GET').toUpperCase();
        const xhr = new XMLHttpRequest();

        xhr.open(method, url, true);

        // Set headers
        for (const [key, value] of Object.entries(headers)) {
            if (key.toLowerCase() === 'content-type' && isFormData(prepared)) continue; // let XHR set boundary
            xhr.setRequestHeader(key, value);
        }

        // Credentials
        if (config.withCredentials) {
            xhr.withCredentials = true;
        }

        // Response type
        if (config.responseType && config.responseType !== 'json') {
            switch (config.responseType) {
                case 'arraybuffer': xhr.responseType = 'arraybuffer'; break;
                case 'blob': xhr.responseType = 'blob'; break;
                case 'text': xhr.responseType = 'text'; break;
                case 'document': xhr.responseType = 'document'; break;
                default: xhr.responseType = 'text';
            }
        }

        // Timeout
        if (config.timeout) {
            xhr.timeout = config.timeout;
        }

        // XSRF
        if (config.xsrfCookieName && config.xsrfHeaderName) {
            try {
                const cookies = document.cookie.split(';');
                for (const cookie of cookies) {
                    const [name, ...rest] = cookie.trim().split('=');
                    if (name === config.xsrfCookieName) {
                        xhr.setRequestHeader(config.xsrfHeaderName, decodeURIComponent(rest.join('=')));
                        break;
                    }
                }
            } catch { /* ignore if no document.cookie */ }
        }

        // ── Upload progress (the main reason this adapter exists) ──
        if (config.onUploadProgress && xhr.upload) {
            const startTime = Date.now();
            xhr.upload.addEventListener('progress', (e: ProgressEvent) => {
                const elapsed = (Date.now() - startTime) / 1000;
                const rate = elapsed > 0 ? e.loaded / elapsed : 0;
                const event: FetchGoProgressEvent = {
                    loaded: e.loaded,
                    total: e.lengthComputable ? e.total : undefined,
                    progress: e.lengthComputable ? e.loaded / e.total : undefined,
                    bytes: e.loaded, // cumulative in XHR
                    rate,
                    estimated: e.lengthComputable && rate > 0 ? (e.total - e.loaded) / rate : undefined,
                    upload: true,
                };
                config.onUploadProgress!(event);
            });
        }

        // ── Download progress ──
        if (config.onDownloadProgress) {
            const startTime = Date.now();
            xhr.addEventListener('progress', (e: ProgressEvent) => {
                const elapsed = (Date.now() - startTime) / 1000;
                const rate = elapsed > 0 ? e.loaded / elapsed : 0;
                const event: FetchGoProgressEvent = {
                    loaded: e.loaded,
                    total: e.lengthComputable ? e.total : undefined,
                    progress: e.lengthComputable ? e.loaded / e.total : undefined,
                    bytes: e.loaded,
                    rate,
                    estimated: e.lengthComputable && rate > 0 ? (e.total - e.loaded) / rate : undefined,
                    download: true,
                };
                config.onDownloadProgress!(event);
            });
        }

        // ── Cancel ──
        if (config.signal) {
            if (config.signal.aborted) {
                xhr.abort();
                reject(new FetchGoError('Request canceled', ERR_CANCELED, config));
                return;
            }
            config.signal.addEventListener('abort', () => {
                xhr.abort();
                reject(new FetchGoError('Request canceled', ERR_CANCELED, config));
            }, { once: true });
        }

        // ── Handlers ──
        xhr.addEventListener('load', () => {
            // Parse response headers
            const responseHeaders = new Headers();
            const rawHeaders = xhr.getAllResponseHeaders();
            if (rawHeaders) {
                for (const line of rawHeaders.trim().split(/[\r\n]+/)) {
                    const idx = line.indexOf(': ');
                    if (idx > 0) {
                        responseHeaders.set(line.substring(0, idx).toLowerCase(), line.substring(idx + 2));
                    }
                }
            }

            // Parse response data
            let data: unknown;
            const responseContentType = responseHeaders.get('content-type') || '';

            if (config.responseType === 'document') {
                data = xhr.responseXML || xhr.response;
            } else if (!config.responseType || config.responseType === 'json') {
                const shouldParseJSON = config.responseType === 'json' ||
                    responseContentType.includes('application/json') ||
                    config.transitional?.forcedJSONParsing;
                if (typeof xhr.response === 'string' && shouldParseJSON) {
                    try { data = JSON.parse(xhr.response); } catch { data = xhr.response; }
                } else {
                    data = xhr.response;
                }
            } else {
                data = xhr.response;
            }

            // Apply transforms
            if (config.transformResponse) {
                for (const transform of config.transformResponse) {
                    data = transform(data);
                }
            }

            // Max content length check
            if (config.maxContentLength && typeof data === 'string' && data.length > config.maxContentLength) {
                reject(new FetchGoError(
                    `Response size exceeds maxContentLength (${config.maxContentLength})`,
                    ERR_BAD_RESPONSE,
                    config
                ));
                return;
            }

            const response: FetchGoResponse = {
                data,
                status: xhr.status,
                statusText: xhr.statusText,
                headers: responseHeaders,
                config,
                request: xhr as unknown as Response,
            };

            const validateStatus = config.validateStatus || defaultValidateStatus;
            if (!validateStatus(response.status)) {
                reject(new FetchGoError(
                    `Request failed with status code ${response.status}`,
                    response.status >= 400 && response.status < 500 ? ERR_BAD_REQUEST : ERR_BAD_RESPONSE,
                    config,
                    response
                ));
                return;
            }

            resolve(response);
        });

        xhr.addEventListener('error', () => {
            reject(new FetchGoError('Network Error', ERR_NETWORK, config));
        });

        xhr.addEventListener('timeout', () => {
            const code = config.transitional?.clarifyTimeoutError !== false ? 'ETIMEDOUT' : ERR_TIMEOUT;
            reject(new FetchGoError(
                `Request timeout of ${config.timeout}ms exceeded`,
                code,
                config
            ));
        });

        xhr.addEventListener('abort', () => {
            reject(new FetchGoError('Request canceled', ERR_CANCELED, config));
        });

        // Send
        xhr.send(prepared as XMLHttpRequestBodyInit | undefined);
    });
}
