import type { FetchGoRequestConfig, FetchGoResponse } from '../types/index.js';
import { FetchGoError, ERR_NETWORK, ERR_TIMEOUT, ERR_CANCELED, ERR_BAD_REQUEST, ERR_BAD_RESPONSE } from '../error/FetchGoError.js';
import { buildURL } from '../helpers/buildURL.js';
import { normalizeHeaders, isPlainObject, objectToURLSearchParams } from '../helpers/utils.js';

interface NodeModules {
    http: typeof import('http');
    https: typeof import('https');
    zlib: typeof import('zlib');
}

let _cached: NodeModules | null | undefined;

async function getNodeModules(): Promise<NodeModules | null> {
    if (_cached !== undefined) return _cached;
    try {
        const [h, hs, z] = await Promise.all([
            import('http'),
            import('https'),
            import('zlib'),
        ]);
        _cached = { http: h, https: hs, zlib: z };
    } catch {
        _cached = null;
    }
    return _cached;
}

function defaultValidateStatus(status: number): boolean {
    return status >= 200 && status < 300;
}

function prepareNodeBody(
    data: unknown,
    headers: Record<string, string>,
    config: FetchGoRequestConfig
): string | undefined {
    if (data === undefined || data === null) return undefined;
    if (typeof data === 'string') return data;

    if (isPlainObject(data) || Array.isArray(data)) {
        const ct = headers['content-type'] || '';
        const serializer = config.formSerializer;

        if (serializer === 'urlencoded' || ct.includes('application/x-www-form-urlencoded')) {
            headers['content-type'] = 'application/x-www-form-urlencoded';
            return objectToURLSearchParams(data as Record<string, unknown>).toString();
        }

        if (!headers['content-type']) {
            headers['content-type'] = 'application/json';
        }
        return JSON.stringify(data);
    }

    return String(data);
}

function parseNodeResponse(buffer: Buffer, contentType: string, responseType?: string): unknown {
    if (responseType === 'arraybuffer') return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    if (responseType === 'blob') return new Blob([new Uint8Array(buffer)]);
    if (responseType === 'stream') return buffer;

    const text = buffer.toString('utf-8');
    if (responseType === 'text') return text;

    if (responseType === 'json' || contentType.includes('application/json')) {
        try { return JSON.parse(text); } catch { return text; }
    }

    if (!contentType || contentType.includes('text/')) {
        try { return JSON.parse(text); } catch { return text; }
    }

    return text;
}

export async function httpAdapter(config: FetchGoRequestConfig): Promise<FetchGoResponse> {
    const mods = await getNodeModules();
    if (!mods) {
        throw new FetchGoError('Node.js http/https modules not available', ERR_NETWORK, config);
    }

    const { http, https, zlib } = mods;
    const headers = normalizeHeaders(config.headers);

    let body = config.data;
    if (config.transformRequest) {
        for (const transform of config.transformRequest) {
            body = transform(body, headers);
        }
    }

    const preparedBody = prepareNodeBody(body, headers, config);

    if (preparedBody !== undefined && !headers['content-length']) {
        const len = Buffer.byteLength(preparedBody);
        headers['content-length'] = String(len);

        if (config.maxBodyLength && len > config.maxBodyLength) {
            throw new FetchGoError(
                `Request body size (${len}) exceeds maxBodyLength (${config.maxBodyLength})`,
                ERR_BAD_REQUEST,
                config
            );
        }
    }

    const url = buildURL(config.baseURL, config.url, config.params, config.paramsSerializer);
    if (!url) {
        throw new FetchGoError('No URL provided', ERR_BAD_REQUEST, config);
    }

    const parsedUrl = new URL(url);
    const maxRedirects = config.maxRedirects ?? 5;

    return new Promise<FetchGoResponse>((resolve, reject) => {
        let redirectCount = 0;

        function doRequest(requestUrl: URL): void {
            const options: import('http').RequestOptions = {
                hostname: requestUrl.hostname,
                port: requestUrl.port || (requestUrl.protocol === 'https:' ? 443 : 80),
                path: requestUrl.pathname + requestUrl.search,
                method: (config.method || 'GET').toUpperCase(),
                headers,
                timeout: config.timeout || 0,
            };

            const transport = requestUrl.protocol === 'https:' ? https : http;
            const req = transport.request(options, (res) => {
                if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                    redirectCount++;
                    if (redirectCount > maxRedirects) {
                        reject(new FetchGoError(
                            `Maximum redirects (${maxRedirects}) exceeded`,
                            ERR_BAD_REQUEST,
                            config
                        ));
                        return;
                    }
                    const nextUrl = new URL(res.headers.location, requestUrl.href);
                    doRequest(nextUrl);
                    return;
                }

                const chunks: Buffer[] = [];
                let loaded = 0;
                const total = parseInt(res.headers['content-length'] || '0', 10) || undefined;
                const startTime = Date.now();

                const contentEncoding = res.headers['content-encoding'];
                let stream: NodeJS.ReadableStream = res;

                if (contentEncoding) {
                    if (contentEncoding === 'gzip') {
                        stream = res.pipe(zlib.createGunzip());
                    } else if (contentEncoding === 'deflate') {
                        stream = res.pipe(zlib.createInflate());
                    } else if (contentEncoding === 'br') {
                        stream = res.pipe(zlib.createBrotliDecompress());
                    }
                }

                stream.on('data', (chunk: Buffer) => {
                    const bytes = chunk.length;
                    loaded += bytes;

                    if (config.maxContentLength && loaded > config.maxContentLength) {
                        res.destroy();
                        reject(new FetchGoError(
                            `Response size (${loaded}) exceeds maxContentLength (${config.maxContentLength})`,
                            ERR_BAD_RESPONSE,
                            config
                        ));
                        return;
                    }

                    chunks.push(chunk);

                    if (config.onDownloadProgress) {
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
                });

                stream.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    const contentType = res.headers['content-type'] || '';
                    let data: unknown;

                    try {
                        data = parseNodeResponse(buffer, contentType, config.responseType);
                        if (config.transformResponse) {
                            for (const transform of config.transformResponse) {
                                data = transform(data);
                            }
                        }
                    } catch {
                        data = buffer.toString('utf-8');
                    }

                    const responseHeaders = new Headers();
                    for (const [key, value] of Object.entries(res.headers)) {
                        if (value) {
                            responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
                        }
                    }

                    const response: FetchGoResponse = {
                        data,
                        status: res.statusCode || 0,
                        statusText: res.statusMessage || '',
                        headers: responseHeaders,
                        config,
                        request: new Response(null) as Response,
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

                stream.on('error', (err: Error) => {
                    reject(new FetchGoError(err.message, ERR_NETWORK, config));
                });
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new FetchGoError(
                    `Request timeout of ${config.timeout}ms exceeded`,
                    ERR_TIMEOUT,
                    config
                ));
            });

            req.on('error', (err: Error) => {
                if (config.signal?.aborted) {
                    reject(new FetchGoError('Request canceled', ERR_CANCELED, config));
                    return;
                }
                reject(new FetchGoError(err.message, ERR_NETWORK, config));
            });

            if (config.signal) {
                if (config.signal.aborted) {
                    req.destroy();
                    reject(new FetchGoError('Request canceled', ERR_CANCELED, config));
                    return;
                }
                config.signal.addEventListener('abort', () => {
                    req.destroy();
                    reject(new FetchGoError('Request canceled', ERR_CANCELED, config));
                }, { once: true });
            }

            if (preparedBody !== undefined && !['GET', 'HEAD'].includes(options.method!)) {
                if (config.onUploadProgress) {
                    const bodyBuf = Buffer.from(preparedBody);
                    const totalSize = bodyBuf.length;
                    const chunkSize = 16384;
                    let uploaded = 0;
                    const uploadStart = Date.now();

                    const writeChunk = (offset: number) => {
                        const end = Math.min(offset + chunkSize, totalSize);
                        const chunk = bodyBuf.subarray(offset, end);
                        const bytes = chunk.length;
                        uploaded += bytes;

                        const elapsed = (Date.now() - uploadStart) / 1000;
                        const rate = elapsed > 0 ? uploaded / elapsed : 0;

                        config.onUploadProgress!({
                            loaded: uploaded,
                            total: totalSize,
                            progress: totalSize > 0 ? uploaded / totalSize : undefined,
                            bytes,
                            rate,
                            estimated: rate > 0 ? (totalSize - uploaded) / rate : undefined,
                            upload: true,
                        });

                        if (end < totalSize) {
                            req.write(chunk, () => writeChunk(end));
                        } else {
                            req.end(chunk);
                        }
                    };

                    writeChunk(0);
                } else {
                    req.end(preparedBody);
                }
            } else {
                req.end();
            }
        }

        doRequest(parsedUrl);
    });
}
