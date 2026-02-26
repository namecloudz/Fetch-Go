import type { FetchGoRequestConfig } from '../types/index.js';

export function validateConfig(config: FetchGoRequestConfig): void {
    if (config.timeout !== undefined) {
        if (typeof config.timeout !== 'number' || config.timeout < 0) {
            throw new TypeError(`'timeout' must be a non-negative number, got ${JSON.stringify(config.timeout)}`);
        }
    }

    if (config.maxRedirects !== undefined) {
        if (typeof config.maxRedirects !== 'number' || config.maxRedirects < 0) {
            throw new TypeError(`'maxRedirects' must be a non-negative number, got ${JSON.stringify(config.maxRedirects)}`);
        }
    }

    if (config.maxContentLength !== undefined && (typeof config.maxContentLength !== 'number' || config.maxContentLength < 0)) {
        throw new TypeError(`'maxContentLength' must be a non-negative number`);
    }

    if (config.maxBodyLength !== undefined && (typeof config.maxBodyLength !== 'number' || config.maxBodyLength < 0)) {
        throw new TypeError(`'maxBodyLength' must be a non-negative number`);
    }

    if (config.method !== undefined) {
        const valid = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
        if (!valid.includes(String(config.method).toLowerCase())) {
            throw new TypeError(`'method' must be one of: ${valid.join(', ')}, got '${config.method}'`);
        }
    }

    if (config.responseType !== undefined) {
        const valid = ['json', 'text', 'blob', 'arraybuffer', 'formdata', 'stream', 'document'];
        if (!valid.includes(config.responseType)) {
            throw new TypeError(`'responseType' must be one of: ${valid.join(', ')}, got '${config.responseType}'`);
        }
    }

    if (config.httpVersion !== undefined && config.httpVersion !== 1 && config.httpVersion !== 2) {
        throw new TypeError(`'httpVersion' must be 1 or 2, got ${config.httpVersion}`);
    }

    if (config.auth !== undefined && config.auth !== null) {
        if (typeof config.auth !== 'object' || !('username' in config.auth) || !('password' in config.auth)) {
            throw new TypeError(`'auth' must be { username: string, password: string }`);
        }
    }

    if (config.proxy !== undefined && config.proxy !== false) {
        if (typeof config.proxy !== 'object' || !('host' in config.proxy) || !('port' in config.proxy)) {
            throw new TypeError(`'proxy' must be { host: string, port: number } or false`);
        }
    }

    if (config.validateStatus !== undefined && typeof config.validateStatus !== 'function') {
        throw new TypeError(`'validateStatus' must be a function`);
    }
}
