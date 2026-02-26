import { describe, it, expect } from 'vitest';
import { FetchGo } from '../src/core/FetchGo.js';
import { isCancel } from '../src/error/FetchGoError.js';

describe('Static Helpers', () => {
    it('fetchgo.all() should work like Promise.all', async () => {
        const fetchgo = new FetchGo();
        const results = await fetchgo.all([
            Promise.resolve(1),
            Promise.resolve(2),
            Promise.resolve(3),
        ]);

        expect(results).toEqual([1, 2, 3]);
    });

    it('fetchgo.spread() should spread array arguments', () => {
        const fetchgo = new FetchGo();
        const callback = (a: number, b: number, c: number) => a + b + c;
        const spreadFn = fetchgo.spread(callback);

        expect(spreadFn([1, 2, 3])).toBe(6);
    });

    it('fetchgo.isCancel() should detect cancel errors', () => {
        const fetchgo = new FetchGo();
        const cancelError = new DOMException('Aborted', 'AbortError');

        expect(fetchgo.isCancel(cancelError)).toBe(true);
        expect(fetchgo.isCancel(new Error('normal error'))).toBe(false);
    });

    it('isCancel export should work standalone', () => {
        const cancelError = new DOMException('Aborted', 'AbortError');
        expect(isCancel(cancelError)).toBe(true);
        expect(isCancel(new Error('not cancel'))).toBe(false);
        expect(isCancel(null)).toBe(false);
    });
});
