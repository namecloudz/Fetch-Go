import { describe, it, expect } from 'vitest';
import { objectToFormData, objectToURLSearchParams, getCookie } from '../../src/helpers/utils.js';

describe('objectToFormData', () => {
    it('should convert a flat object', () => {
        const fd = objectToFormData({ name: 'John', age: 30 });
        expect(fd.get('name')).toBe('John');
        expect(fd.get('age')).toBe('30');
    });

    it('should handle nested objects', () => {
        const fd = objectToFormData({ user: { name: 'John', email: 'john@test.com' } });
        expect(fd.get('user[name]')).toBe('John');
        expect(fd.get('user[email]')).toBe('john@test.com');
    });

    it('should handle arrays', () => {
        const fd = objectToFormData({ tags: ['a', 'b', 'c'] });
        expect(fd.get('tags[0]')).toBe('a');
        expect(fd.get('tags[1]')).toBe('b');
        expect(fd.get('tags[2]')).toBe('c');
    });

    it('should skip null and undefined values', () => {
        const fd = objectToFormData({ a: 'keep', b: null, c: undefined });
        expect(fd.get('a')).toBe('keep');
        expect(fd.has('b')).toBe(false);
        expect(fd.has('c')).toBe(false);
    });

    it('should handle Blob values', () => {
        const blob = new Blob(['test'], { type: 'text/plain' });
        const fd = objectToFormData({ file: blob });
        expect(fd.get('file')).toBeInstanceOf(Blob);
    });
});

describe('objectToURLSearchParams', () => {
    it('should convert a flat object', () => {
        const params = objectToURLSearchParams({ q: 'hello', page: 1 });
        expect(params.get('q')).toBe('hello');
        expect(params.get('page')).toBe('1');
    });

    it('should handle arrays with repeated keys', () => {
        const params = objectToURLSearchParams({ id: [1, 2, 3] });
        expect(params.getAll('id')).toEqual(['1', '2', '3']);
    });

    it('should skip null and undefined', () => {
        const params = objectToURLSearchParams({ a: 'yes', b: null, c: undefined });
        expect(params.get('a')).toBe('yes');
        expect(params.has('b')).toBe(false);
        expect(params.has('c')).toBe(false);
    });

    it('should produce valid query string', () => {
        const params = objectToURLSearchParams({ name: 'John Doe', age: 30 });
        expect(params.toString()).toBe('name=John+Doe&age=30');
    });
});

describe('getCookie', () => {
    it('should return null when document is not available', () => {
        expect(getCookie('test')).toBe(null);
    });
});
