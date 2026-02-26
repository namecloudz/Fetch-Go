import { describe, it, expect } from 'vitest';
import { FetchGoError, isFetchGoError, ERR_CANCELED, ERR_NETWORK, ERR_TIMEOUT, ERR_BAD_REQUEST, ERR_BAD_RESPONSE } from '../src/error/FetchGoError.js';
import { validateConfig } from '../src/helpers/validateConfig.js';

describe('FetchGoError', () => {
    it('should create error with correct properties', () => {
        const error = new FetchGoError('test error', ERR_NETWORK, { url: '/test' });
        expect(error.message).toBe('test error');
        expect(error.code).toBe(ERR_NETWORK);
        expect(error.config.url).toBe('/test');
        expect(error.isFetchGoError).toBe(true);
        expect(error.name).toBe('FetchGoError');
    });

    it('should create error with response', () => {
        const response = { data: null, status: 500, statusText: 'Error', headers: new Headers(), config: {}, request: new Response() };
        const error = new FetchGoError('server error', ERR_BAD_RESPONSE, {}, response);
        expect(error.response).toBe(response);
        expect(error.status).toBe(500);
    });

    it('should have correct error codes', () => {
        expect(ERR_CANCELED).toBe('ERR_CANCELED');
        expect(ERR_NETWORK).toBe('ERR_NETWORK');
        expect(ERR_TIMEOUT).toBe('ECONNABORTED');
        expect(ERR_BAD_REQUEST).toBe('ERR_BAD_REQUEST');
        expect(ERR_BAD_RESPONSE).toBe('ERR_BAD_RESPONSE');
    });

    it('isFetchGoError should detect errors correctly', () => {
        const error = new FetchGoError('test', ERR_NETWORK, {});
        expect(isFetchGoError(error)).toBe(true);
        expect(isFetchGoError(new Error('normal'))).toBe(false);
        expect(isFetchGoError(null)).toBe(false);
        expect(isFetchGoError(undefined)).toBe(false);
        expect(isFetchGoError({ isFetchGoError: true })).toBe(true);
    });

    it('toJSON should return serializable object', () => {
        const error = new FetchGoError('test', ERR_NETWORK, {});
        const json = error.toJSON();
        expect(json.name).toBe('FetchGoError');
        expect(json.message).toBe('test');
        expect(json.code).toBe(ERR_NETWORK);
    });

    it('FetchGoError.from() should create instance', () => {
        const error = FetchGoError.from('test', ERR_NETWORK, {});
        expect(error).toBeInstanceOf(FetchGoError);
        expect(error.message).toBe('test');
    });
});

describe('validateConfig', () => {
    it('should accept valid config', () => {
        expect(() => validateConfig({
            timeout: 5000,
            method: 'GET',
            responseType: 'json',
        })).not.toThrow();
    });

    it('should reject negative timeout', () => {
        expect(() => validateConfig({ timeout: -1 })).toThrow(TypeError);
    });

    it('should reject invalid method', () => {
        expect(() => validateConfig({ method: 'INVALID' as any })).toThrow(TypeError);
    });

    it('should reject invalid responseType', () => {
        expect(() => validateConfig({ responseType: 'invalid' as any })).toThrow(TypeError);
    });

    it('should accept document responseType', () => {
        expect(() => validateConfig({ responseType: 'document' })).not.toThrow();
    });

    it('should reject invalid httpVersion', () => {
        expect(() => validateConfig({ httpVersion: 3 as any })).toThrow(TypeError);
    });

    it('should reject invalid auth', () => {
        expect(() => validateConfig({ auth: { username: 'a' } as any })).toThrow(TypeError);
    });

    it('should reject invalid proxy', () => {
        expect(() => validateConfig({ proxy: { host: 'a' } as any })).toThrow(TypeError);
    });

    it('should reject non-function validateStatus', () => {
        expect(() => validateConfig({ validateStatus: 'true' as any })).toThrow(TypeError);
    });
});
