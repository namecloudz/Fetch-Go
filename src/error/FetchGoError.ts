import type { FetchGoRequestConfig, FetchGoResponse } from '../types/index.js';

export const ERR_CANCELED = 'ERR_CANCELED';
export const ERR_NETWORK = 'ERR_NETWORK';
export const ERR_TIMEOUT = 'ECONNABORTED';
export const ERR_BAD_REQUEST = 'ERR_BAD_REQUEST';
export const ERR_BAD_RESPONSE = 'ERR_BAD_RESPONSE';

export class FetchGoError<T = unknown> extends Error {
    code: string;
    config: FetchGoRequestConfig;
    response?: FetchGoResponse<T>;
    status?: number;
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

        Object.setPrototypeOf(this, FetchGoError.prototype);
    }

    static from<T>(
        message: string,
        code: string,
        config: FetchGoRequestConfig,
        response?: FetchGoResponse<T>
    ): FetchGoError<T> {
        return new FetchGoError(message, code, config, response);
    }

    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            status: this.status,
        };
    }
}

export function isFetchGoError(error: unknown): error is FetchGoError {
    return (
        error !== null &&
        typeof error === 'object' &&
        (error as FetchGoError).isFetchGoError === true
    );
}

export function isCancel(error: unknown): boolean {
    if (error instanceof DOMException && error.name === 'AbortError') return true;
    if (isFetchGoError(error) && error.code === ERR_CANCELED) return true;
    return false;
}
