
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

export function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : null;
}

// ── FormData Serializer Options ──────────────────────────────

export interface ObjectToFormDataOptions {
    /** Use dot notation: `parent.child` instead of `parent[child]` */
    dots?: boolean;
    /** Add type meta tokens: `{}` for objects, `[]` for arrays */
    metaTokens?: boolean;
    /** Array index mode: true = `arr[0]`, false = `arr[]`, null/undefined = `arr` */
    indexes?: boolean | null;
}

function buildKey(parentKey: string, key: string, options?: ObjectToFormDataOptions): string {
    if (!parentKey) {
        return options?.metaTokens ? `${key}{}` : key;
    }
    if (options?.dots) {
        return `${parentKey}.${key}`;
    }
    return `${parentKey}[${key}]`;
}

function buildArrayKey(parentKey: string, index: number, options?: ObjectToFormDataOptions): string {
    const base = options?.metaTokens && !parentKey ? `[]` : parentKey;
    const actualKey = base || parentKey;

    if (options?.indexes === true) {
        return `${actualKey}[${index}]`;
    }
    if (options?.indexes === false) {
        return `${actualKey}[]`;
    }
    // indexes === null or undefined → bare key
    return actualKey;
}

export function objectToFormData(
    obj: Record<string, unknown>,
    formData?: FormData,
    parentKey?: string,
    options?: ObjectToFormDataOptions
): FormData {
    const fd = formData || new FormData();

    for (const [key, value] of Object.entries(obj)) {
        const fullKey = parentKey ? buildKey(parentKey, key, options) : key;

        if (value === null || value === undefined) {
            continue;
        } else if (value instanceof File || value instanceof Blob) {
            fd.append(fullKey, value);
        } else if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                const itemKey = buildArrayKey(fullKey, i, options);
                if (isPlainObject(value[i])) {
                    objectToFormData(value[i] as Record<string, unknown>, fd, itemKey, options);
                } else {
                    fd.append(itemKey, String(value[i]));
                }
            }
        } else if (isPlainObject(value)) {
            const nestedKey = options?.metaTokens ? `${fullKey}{}` : fullKey;
            objectToFormData(value as Record<string, unknown>, fd, nestedKey, options);
        } else {
            fd.append(fullKey, String(value));
        }
    }

    return fd;
}

export function objectToURLSearchParams(obj: Record<string, unknown>): URLSearchParams {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) continue;

        if (Array.isArray(value)) {
            for (const v of value) {
                if (v !== null && v !== undefined) {
                    params.append(key, String(v));
                }
            }
        } else {
            params.append(key, String(value));
        }
    }

    return params;
}

export function toFormData(obj: Record<string, unknown>, formData?: FormData, options?: ObjectToFormDataOptions): FormData {
    return objectToFormData(obj, formData, undefined, options);
}

export function formToJSON(formData: FormData): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    formData.forEach((value, key) => {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const existing = obj[key];
            if (Array.isArray(existing)) {
                existing.push(value);
            } else {
                obj[key] = [existing, value];
            }
        } else {
            obj[key] = value;
        }
    });
    return obj;
}
