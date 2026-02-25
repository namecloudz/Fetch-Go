import type { Params, ParamsSerializer } from '../types/index.js';

function defaultSerializer(params: Params): string {
    const parts: string[] = [];

    for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined) continue;

        if (Array.isArray(value)) {
            for (const v of value) {
                if (v === null || v === undefined) continue;
                parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
            }
        } else {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        }
    }

    return parts.join('&');
}

export function buildURL(
    baseURL?: string,
    url?: string,
    params?: Params,
    paramsSerializer?: ParamsSerializer
): string {
    let fullURL = '';

    if (baseURL && url) {

        if (/^https?:\/\//i.test(url)) {
            fullURL = url;
        } else {
            const base = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
            const path = url.startsWith('/') ? url : `/${url}`;
            fullURL = base + path;
        }
    } else {
        fullURL = url || baseURL || '';
    }

    if (params && Object.keys(params).length > 0) {
        const serializer = paramsSerializer || defaultSerializer;
        const queryString = serializer(params);
        if (queryString) {
            const separator = fullURL.includes('?') ? '&' : '?';
            fullURL += separator + queryString;
        }
    }

    return fullURL;
}
