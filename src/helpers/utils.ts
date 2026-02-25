
export function isPlainObject(val: unknown): val is Record<string, unknown> {
    if (typeof val !== 'object' || val === null) return false;
    const proto = Object.getPrototypeOf(val);
    return proto === null || proto === Object.prototype;
}

export function isFormData(val: unknown): val is FormData {
    return typeof FormData !== 'undefined' && val instanceof FormData;
}

export function isBlob(val: unknown): val is Blob {
    return typeof Blob !== 'undefined' && val instanceof Blob;
}

export function isArrayBuffer(val: unknown): val is ArrayBuffer {
    return typeof ArrayBuffer !== 'undefined' && val instanceof ArrayBuffer;
}

export function isURLSearchParams(val: unknown): val is URLSearchParams {
    return typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams;
}

export function isStream(val: unknown): val is ReadableStream {
    return typeof ReadableStream !== 'undefined' && val instanceof ReadableStream;
}

export function deepMerge<T extends Record<string, unknown>>(
    ...objects: (Partial<T> | undefined)[]
): T {
    const result: Record<string, unknown> = {};

    for (const obj of objects) {
        if (!obj) continue;

        for (const [key, value] of Object.entries(obj)) {
            if (isPlainObject(value) && isPlainObject(result[key])) {
                result[key] = deepMerge(
                    result[key] as Record<string, unknown>,
                    value as Record<string, unknown>
                );
            } else if (value !== undefined) {
                result[key] = value;
            }
        }
    }

    return result as T;
}

export function normalizeHeaders(
    headers?: Record<string, string> | Headers | [string, string][]
): Record<string, string> {
    const result: Record<string, string> = {};

    if (!headers) return result;

    if (headers instanceof Headers) {
        headers.forEach((value, key) => {
            result[key.toLowerCase()] = value;
        });
    } else if (Array.isArray(headers)) {
        for (const [key, value] of headers) {
            result[key.toLowerCase()] = value;
        }
    } else {
        for (const [key, value] of Object.entries(headers)) {
            result[key.toLowerCase()] = value;
        }
    }

    return result;
}
