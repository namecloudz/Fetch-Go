import type { FetchGoRequestConfig } from '../types/index.js';

const METHOD_HEADER_KEYS = new Set(['common', 'get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

export function mergeConfig(
    defaults: FetchGoRequestConfig,
    overrides: FetchGoRequestConfig = {}
): FetchGoRequestConfig {
    // Fast path: if no defaults, just return overrides
    if (!defaults || Object.keys(defaults).length === 0) return overrides;

    const config: FetchGoRequestConfig = { ...defaults };

    // Only copy defined overrides (avoid creating unnecessary properties)
    for (const key of Object.keys(overrides) as (keyof FetchGoRequestConfig)[]) {
        const val = overrides[key];
        if (val !== undefined) {
            (config as Record<string, unknown>)[key] = val;
        }
    }

    // Merge headers: keep as-is, defer normalization to dispatch time
    if (defaults.headers || overrides.headers) {
        const dh = defaults.headers;
        const oh = overrides.headers;

        if (!dh) {
            config.headers = oh;
        } else if (!oh) {
            config.headers = dh;
        } else if (dh instanceof Headers || oh instanceof Headers || Array.isArray(dh) || Array.isArray(oh)) {
            // Complex header types — normalize once
            const flatD = flattenToRecord(dh);
            const flatO = flattenToRecord(oh);
            config.headers = { ...flatD, ...flatO };
        } else {
            // Both are plain objects — fast merge
            config.headers = { ...(dh as Record<string, unknown>), ...(oh as Record<string, unknown>) } as Record<string, string>;
        }
    }

    return config;
}

function flattenToRecord(h: FetchGoRequestConfig['headers']): Record<string, string> {
    if (!h) return {};
    if (h instanceof Headers) {
        const r: Record<string, string> = {};
        h.forEach((v, k) => { r[k] = v; });
        return r;
    }
    if (Array.isArray(h)) {
        const r: Record<string, string> = {};
        for (const [k, v] of h) r[k] = v;
        return r;
    }
    return h as Record<string, string>;
}

/**
 * Flatten per-method headers (common/get/post) into a flat Record.
 * Called once in the request path.
 */
export function flattenMethodHeaders(
    headers: FetchGoRequestConfig['headers'],
    method: string
): Record<string, string> {
    if (!headers) return {};

    if (headers instanceof Headers) {
        const r: Record<string, string> = {};
        headers.forEach((v, k) => { r[k] = v; });
        return r;
    }
    if (Array.isArray(headers)) {
        const r: Record<string, string> = {};
        for (const [k, v] of headers) r[k] = v;
        return r;
    }

    // Fast check: does it have method-level keys?
    const h = headers as Record<string, unknown>;
    const firstKey = Object.keys(h)[0];
    if (!firstKey) return {};

    // Quick heuristic: if first value is a string, it's flat headers
    if (typeof h[firstKey] === 'string' && !METHOD_HEADER_KEYS.has(firstKey)) {
        return headers as Record<string, string>;
    }

    // Check for method keys
    let hasMethodKeys = false;
    for (const k of Object.keys(h)) {
        if (METHOD_HEADER_KEYS.has(k)) {
            hasMethodKeys = true;
            break;
        }
    }

    if (!hasMethodKeys) return headers as Record<string, string>;

    // Merge: common + method-specific + flat
    const result: Record<string, string> = {};
    const common = h.common;
    if (common && typeof common === 'object') {
        Object.assign(result, common);
    }

    const methodH = h[method.toLowerCase()];
    if (methodH && typeof methodH === 'object') {
        Object.assign(result, methodH);
    }

    for (const [k, v] of Object.entries(h)) {
        if (!METHOD_HEADER_KEYS.has(k) && typeof v === 'string') {
            result[k] = v;
        }
    }

    return result;
}
