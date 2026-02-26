import { describe, it, expect } from 'vitest';
import { objectToFormData, toFormData, formToJSON } from '../src/helpers/utils.js';

describe('FormData Serialization', () => {
    describe('basic serialization', () => {
        it('should serialize flat object', () => {
            const fd = objectToFormData({ name: 'test', age: '25' });
            expect(fd.get('name')).toBe('test');
            expect(fd.get('age')).toBe('25');
        });

        it('should skip null and undefined', () => {
            const fd = objectToFormData({ name: 'test', empty: null, undef: undefined });
            expect(fd.get('name')).toBe('test');
            expect(fd.has('empty')).toBe(false);
            expect(fd.has('undef')).toBe(false);
        });

        it('should serialize nested objects', () => {
            const fd = objectToFormData({ user: { name: 'test', age: '25' } });
            expect(fd.get('user[name]')).toBe('test');
            expect(fd.get('user[age]')).toBe('25');
        });

        it('should serialize arrays with index', () => {
            const fd = objectToFormData({ items: ['a', 'b', 'c'] }, undefined, undefined, { indexes: true });
            expect(fd.get('items[0]')).toBe('a');
            expect(fd.get('items[1]')).toBe('b');
            expect(fd.get('items[2]')).toBe('c');
        });
    });

    describe('dots notation', () => {
        it('should use dot notation for nested keys', () => {
            const fd = objectToFormData({ user: { name: 'test' } }, undefined, undefined, { dots: true });
            expect(fd.get('user.name')).toBe('test');
        });

        it('should handle deeply nested with dots', () => {
            const fd = objectToFormData(
                { a: { b: { c: 'deep' } } },
                undefined,
                undefined,
                { dots: true }
            );
            expect(fd.get('a.b.c')).toBe('deep');
        });
    });

    describe('indexes option', () => {
        it('indexes=true should produce arr[0], arr[1]', () => {
            const fd = objectToFormData(
                { tags: ['js', 'ts'] },
                undefined,
                undefined,
                { indexes: true }
            );
            expect(fd.get('tags[0]')).toBe('js');
            expect(fd.get('tags[1]')).toBe('ts');
        });

        it('indexes=false should produce arr[]', () => {
            const fd = objectToFormData(
                { tags: ['js', 'ts'] },
                undefined,
                undefined,
                { indexes: false }
            );
            const all = fd.getAll('tags[]');
            expect(all).toEqual(['js', 'ts']);
        });

        it('indexes=null should produce bare key', () => {
            const fd = objectToFormData(
                { tags: ['js', 'ts'] },
                undefined,
                undefined,
                { indexes: null }
            );
            const all = fd.getAll('tags');
            expect(all).toEqual(['js', 'ts']);
        });
    });

    describe('toFormData helper', () => {
        it('should work as alias for objectToFormData', () => {
            const fd = toFormData({ key: 'value' });
            expect(fd.get('key')).toBe('value');
        });

        it('should accept options', () => {
            const fd = toFormData({ nested: { key: 'value' } }, undefined, { dots: true });
            expect(fd.get('nested.key')).toBe('value');
        });
    });

    describe('formToJSON', () => {
        it('should convert FormData to plain object', () => {
            const fd = new FormData();
            fd.append('name', 'test');
            fd.append('age', '25');

            const obj = formToJSON(fd);
            expect(obj).toEqual({ name: 'test', age: '25' });
        });

        it('should handle duplicate keys as arrays', () => {
            const fd = new FormData();
            fd.append('tag', 'js');
            fd.append('tag', 'ts');

            const obj = formToJSON(fd);
            expect(obj.tag).toEqual(['js', 'ts']);
        });
    });
});
