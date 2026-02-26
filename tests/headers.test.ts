import { describe, it, expect } from 'vitest';
import { buildURL } from '../src/helpers/buildURL.js';

describe('Headers Merging', () => {
    it('should handle flat headers (backward compat)', async () => {
        // Import FetchGo dynamically to test
        const { FetchGo } = await import('../src/core/FetchGo.js');

        const client = new FetchGo({
            headers: {
                'Content-Type': 'application/json',
                'X-Custom': 'global',
            },
        });

        expect(client.defaults.headers).toBeDefined();
    });

    it('should handle per-method headers structure', async () => {
        const { FetchGo } = await import('../src/core/FetchGo.js');

        const client = new FetchGo({
            headers: {
                common: {
                    'Accept': 'application/json',
                },
                get: {
                    'Cache-Control': 'no-cache',
                },
                post: {
                    'Content-Type': 'application/json',
                },
            } as Record<string, unknown> as import('../src/types/index.js').HeadersInit,
        });

        expect(client.defaults.headers).toBeDefined();
    });
});

describe('buildURL', () => {
    it('should handle base URL + path', () => {
        expect(buildURL('https://api.example.com', '/users')).toBe('https://api.example.com/users');
    });

    it('should handle base URL with trailing slash', () => {
        expect(buildURL('https://api.example.com/', '/users')).toBe('https://api.example.com/users');
    });

    it('should handle absolute URL override', () => {
        expect(buildURL('https://api.example.com', 'https://other.com/users')).toBe('https://other.com/users');
    });

    it('should add query params', () => {
        const result = buildURL('https://api.com', '/users', { page: '1', limit: '10' });
        expect(result).toContain('page=1');
        expect(result).toContain('limit=10');
    });

    it('should skip null params', () => {
        const result = buildURL('https://api.com', '/users', { page: '1', empty: null });
        expect(result).toContain('page=1');
        expect(result).not.toContain('empty');
    });

    it('should handle custom params serializer', () => {
        const result = buildURL(
            'https://api.com',
            '/users',
            { tags: ['a', 'b'] },
            (params) => Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&')
        );
        expect(result).toContain('tags=a,b');
    });
});
