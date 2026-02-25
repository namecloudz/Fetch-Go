/**
 * Type-checking utilities
 */

/** Check if value is a plain object */
export function isPlainObject(val: unknown): val is Record<string, unknown> {
    if (typeof val !== 'object' || val === null) return false;
    const proto = Object.getPrototypeOf(val);
    return proto === null || proto === Object.prototype;
}

/** Check if value is a FormData instance */
export function isFormData(val: unknown): val is FormData {
    return typeof FormData !== 'undefined' && val instanceof FormData;
}

/** Check if value is a Blob */
export function isBlob(val: unknown): val is Blob {
    return typeof Blob !== 'undefined' && val instanceof Blob;
}

/** Check if value is an ArrayBuffer */
export function isArrayBuffer(val: unknown): val is ArrayBuffer {
    return typeof ArrayBuffer !== 'undefined' && val instanceof ArrayBuffer;
}

/** Check if value is a URLSearchParams instance */
export function isURLSearchParams(val: unknown): val is URLSearchParams {
    return typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams;
}

/** Check if value is a ReadableStream */
export function isStream(val: unknown): val is ReadableStream {
    return typeof ReadableStream !== 'undefined' && val instanceof ReadableStream;
}

/**
 * Deep merge objects. Later objects take precedence.
 * Only merges plain objects — arrays / class instances are replaced.
 */
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

/**
 * Normalize headers object to a plain Record<string, string>.
 * Handles Headers instance, plain objects, and array tuples.
 */
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
