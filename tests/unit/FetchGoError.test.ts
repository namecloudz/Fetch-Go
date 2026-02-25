import { describe, it, expect } from 'vitest';
import { FetchGoError, isFetchGoError, isCancel, ERR_CANCELED, ERR_NETWORK, ERR_TIMEOUT } from '../../src/error/FetchGoError.js';

describe('FetchGoError', () => {
    it('should create error with correct properties', () => {
        const config = { url: '/test', method: 'GET' as const };
        const error = new FetchGoError('Network Error', ERR_NETWORK, config);

        expect(error.message).toBe('Network Error');
        expect(error.code).toBe(ERR_NETWORK);
        expect(error.config).toBe(config);
        expect(error.name).toBe('FetchGoError');
        expect(error.isFetchGoError).toBe(true);
        expect(error.response).toBeUndefined();
        expect(error.status).toBeUndefined();
    });

    it('should include response and status when provided', () => {
        const config = { url: '/test' };
        const response = { data: { error: 'not found' }, status: 404, statusText: 'Not Found', headers: new Headers(), config, request: {} as Response };
        const error = new FetchGoError('Not Found', 'ERR_BAD_REQUEST', config, response);

        expect(error.status).toBe(404);
        expect(error.response).toBe(response);
    });

    it('should be instanceof Error and FetchGoError', () => {
        const error = new FetchGoError('test', ERR_NETWORK, {});
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(FetchGoError);
    });

    it('should serialize to JSON', () => {
        const error = new FetchGoError('Bad Request', 'ERR_BAD_REQUEST', {});
        const json = error.toJSON();
        expect(json).toEqual({
            name: 'FetchGoError',
            message: 'Bad Request',
            code: 'ERR_BAD_REQUEST',
            status: undefined,
        });
    });

    it('static from() should create error', () => {
        const error = FetchGoError.from('test', ERR_NETWORK, {});
        expect(error).toBeInstanceOf(FetchGoError);
        expect(error.message).toBe('test');
    });
});

describe('isFetchGoError', () => {
    it('should return true for FetchGoError instances', () => {
        const error = new FetchGoError('test', ERR_NETWORK, {});
        expect(isFetchGoError(error)).toBe(true);
    });

    it('should return false for regular errors', () => {
        expect(isFetchGoError(new Error('test'))).toBe(false);
    });

    it('should return false for non-errors', () => {
        expect(isFetchGoError(null)).toBe(false);
        expect(isFetchGoError('string')).toBe(false);
        expect(isFetchGoError(42)).toBe(false);
    });
});

describe('isCancel', () => {
    it('should return true for AbortError', () => {
        const error = new DOMException('Aborted', 'AbortError');
        expect(isCancel(error)).toBe(true);
    });

    it('should return true for ERR_CANCELED FetchGoError', () => {
        const error = new FetchGoError('Canceled', ERR_CANCELED, {});
        expect(isCancel(error)).toBe(true);
    });

    it('should return false for other errors', () => {
        expect(isCancel(new Error('test'))).toBe(false);
        const error = new FetchGoError('Timeout', ERR_TIMEOUT, {});
        expect(isCancel(error)).toBe(false);
    });
});
