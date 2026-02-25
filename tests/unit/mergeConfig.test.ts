import { describe, it, expect } from 'vitest';
import { mergeConfig } from '../../src/core/mergeConfig.js';

describe('mergeConfig', () => {
    it('should return defaults when no overrides', () => {
        const defaults = { baseURL: 'https://api.example.com', timeout: 5000 };
        const result = mergeConfig(defaults);
        expect(result.baseURL).toBe('https://api.example.com');
        expect(result.timeout).toBe(5000);
    });

    it('should override scalar values', () => {
        const defaults = { baseURL: 'https://old.com', timeout: 5000 };
        const overrides = { baseURL: 'https://new.com' };
        const result = mergeConfig(defaults, overrides);
        expect(result.baseURL).toBe('https://new.com');
        expect(result.timeout).toBe(5000);
    });

    it('should merge headers', () => {
        const defaults = { headers: { 'content-type': 'application/json', 'accept': '*/*' } };
        const overrides = { headers: { 'authorization': 'Bearer token' } };
        const result = mergeConfig(defaults, overrides);
        expect(result.headers).toEqual({
            'content-type': 'application/json',
            'accept': '*/*',
            'authorization': 'Bearer token',
        });
    });

    it('should let override headers take precedence', () => {
        const defaults = { headers: { 'content-type': 'text/plain' } };
        const overrides = { headers: { 'content-type': 'application/json' } };
        const result = mergeConfig(defaults, overrides);
        expect((result.headers as Record<string, string>)['content-type']).toBe('application/json');
    });

    it('should normalize header keys to lowercase', () => {
        const defaults = { headers: { 'Content-Type': 'text/plain' } };
        const result = mergeConfig(defaults);
        expect((result.headers as Record<string, string>)['content-type']).toBe('text/plain');
    });
});
