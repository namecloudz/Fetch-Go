import { describe, it, expect } from 'vitest';
import { buildURL } from '../../src/helpers/buildURL.js';

describe('buildURL', () => {
    it('should return url when no baseURL', () => {
        expect(buildURL(undefined, '/users')).toBe('/users');
    });

    it('should combine baseURL and url', () => {
        expect(buildURL('https://api.example.com', '/users')).toBe('https://api.example.com/users');
    });

    it('should handle baseURL with trailing slash', () => {
        expect(buildURL('https://api.example.com/', '/users')).toBe('https://api.example.com/users');
    });

    it('should handle url without leading slash', () => {
        expect(buildURL('https://api.example.com', 'users')).toBe('https://api.example.com/users');
    });

    it('should ignore baseURL when url is absolute', () => {
        expect(buildURL('https://api.example.com', 'https://other.com/users'))
            .toBe('https://other.com/users');
    });

    it('should append query params', () => {
        expect(buildURL(undefined, '/users', { page: 1, limit: 10 }))
            .toBe('/users?page=1&limit=10');
    });

    it('should handle array params', () => {
        const result = buildURL(undefined, '/users', { id: [1, 2, 3] });
        expect(result).toBe('/users?id=1&id=2&id=3');
    });

    it('should skip null and undefined params', () => {
        expect(buildURL(undefined, '/users', { name: 'john', age: null, city: undefined }))
            .toBe('/users?name=john');
    });

    it('should encode special characters', () => {
        expect(buildURL(undefined, '/search', { q: 'hello world' }))
            .toBe('/search?q=hello%20world');
    });

    it('should append to existing query string', () => {
        expect(buildURL(undefined, '/users?sort=name', { page: 1 }))
            .toBe('/users?sort=name&page=1');
    });

    it('should use custom serializer', () => {
        const serializer = (params: Record<string, unknown>) =>
            Object.entries(params).map(([k, v]) => `${k}:${v}`).join(',');
        expect(buildURL(undefined, '/users', { a: 1, b: 2 }, serializer))
            .toBe('/users?a:1,b:2');
    });

    it('should return empty string when no url or baseURL', () => {
        expect(buildURL()).toBe('');
    });

    it('should return baseURL when no url', () => {
        expect(buildURL('https://api.example.com')).toBe('https://api.example.com');
    });
});
