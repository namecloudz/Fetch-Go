import { describe, it, expect, vi } from 'vitest';
import { InterceptorManager } from '../src/core/InterceptorManager.js';

describe('InterceptorManager', () => {
    it('should add and run interceptors', () => {
        const manager = new InterceptorManager<string>();
        const fn = vi.fn((value: string) => value.toUpperCase());

        manager.use(fn);

        const results: string[] = [];
        manager.forEach((handler) => {
            results.push(handler.fulfilled('hello') as string);
        });

        expect(results).toEqual(['HELLO']);
        expect(fn).toHaveBeenCalledWith('hello');
    });

    it('should eject interceptors', () => {
        const manager = new InterceptorManager<string>();
        const fn1 = vi.fn((v: string) => v);
        const fn2 = vi.fn((v: string) => v);

        const id1 = manager.use(fn1);
        manager.use(fn2);

        manager.eject(id1);

        let count = 0;
        manager.forEach(() => {
            count++;
        });

        expect(count).toBe(1);
    });

    it('should clear all interceptors', () => {
        const manager = new InterceptorManager<string>();
        manager.use((v) => v);
        manager.use((v) => v);
        manager.use((v) => v);

        manager.clear();

        let count = 0;
        manager.forEach(() => {
            count++;
        });

        expect(count).toBe(0);
    });

    it('should support runWhen option', () => {
        const manager = new InterceptorManager<{ method: string }>();

        manager.use(
            (config) => ({ ...config, method: 'MODIFIED' }),
            undefined,
            { runWhen: (config) => config.method === 'GET' }
        );

        const handlers: Array<{ runWhen?: (value: { method: string }) => boolean }> = [];
        manager.forEach((handler) => {
            handlers.push(handler);
        });

        expect(handlers[0].runWhen).toBeDefined();
        expect(handlers[0].runWhen!({ method: 'GET' })).toBe(true);
        expect(handlers[0].runWhen!({ method: 'POST' })).toBe(false);
    });

    it('should support synchronous option', () => {
        const manager = new InterceptorManager<string>();

        manager.use(
            (v) => v,
            undefined,
            { synchronous: true }
        );

        const handlers: Array<{ synchronous?: boolean }> = [];
        manager.forEach((handler) => {
            handlers.push(handler);
        });

        expect(handlers[0].synchronous).toBe(true);
    });

    it('should include rejected handler', () => {
        const manager = new InterceptorManager<string>();
        const onFulfilled = (v: string) => v;
        const onRejected = (err: unknown) => err;

        manager.use(onFulfilled, onRejected);

        const handlers: Array<{ rejected?: (error: unknown) => unknown }> = [];
        manager.forEach((handler) => {
            handlers.push(handler);
        });

        expect(handlers[0].rejected).toBe(onRejected);
    });
});
