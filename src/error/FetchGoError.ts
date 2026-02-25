import type { FetchGoRequestConfig, FetchGoResponse } from '../types/index.js';

/**
 * Error codes matching Axios conventions for easy migration
 */
export const ERR_CANCELED = 'ERR_CANCELED';
export const ERR_NETWORK = 'ERR_NETWORK';
export const ERR_TIMEOUT = 'ECONNABORTED';
export const ERR_BAD_REQUEST = 'ERR_BAD_REQUEST';
export const ERR_BAD_RESPONSE = 'ERR_BAD_RESPONSE';

/**
 * Custom error class for Fetch-Go.
 * Matches the shape of AxiosError for seamless migration.
 */
export class FetchGoError<T = unknown> extends Error {
    /** Error code (e.g., ERR_NETWORK, ERR_CANCELED, ECONNABORTED) */
    code: string;
    /** The request configuration */
    config: FetchGoRequestConfig;
    /** The response (if received) */
    response?: FetchGoResponse<T>;
    /** HTTP status code (shortcut from response) */
    status?: number;
    /** Whether this is a FetchGoError */
    readonly isFetchGoError = true;

    constructor(
        message: string,
        code: string,
        config: FetchGoRequestConfig,
        response?: FetchGoResponse<T>
    ) {
        super(message);
        this.name = 'FetchGoError';
        this.code = code;
        this.config = config;
        this.response = response;
        this.status = response?.status;

        // Fix prototype chain for instanceof checks
        Object.setPrototypeOf(this, FetchGoError.prototype);
    }

    /** Create error from a failed response */
    static from<T>(
        message: string,
        code: string,
        config: FetchGoRequestConfig,
        response?: FetchGoResponse<T>
    ): FetchGoError<T> {
        return new FetchGoError(message, code, config, response);
    }

    /** Convert to JSON-safe object */
    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            status: this.status,
        };
    }
}

/**
 * Check if a value is a FetchGoError
 */
export function isFetchGoError(error: unknown): error is FetchGoError {
    return (
        error !== null &&
        typeof error === 'object' &&
        (error as FetchGoError).isFetchGoError === true
    );
}

/**
 * Check if an error was caused by a cancellation
 */
export function isCancel(error: unknown): boolean {
    if (error instanceof DOMException && error.name === 'AbortError') return true;
    if (isFetchGoError(error) && error.code === ERR_CANCELED) return true;
    return false;
}
