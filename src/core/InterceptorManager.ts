import type { InterceptorHandlers, InterceptorManagerInterface } from '../types/index.js';

/**
 * Interceptor manager — handles request and response interceptor chains.
 * API matches Axios's interceptor API for easy migration.
 */
export class InterceptorManager<V> implements InterceptorManagerInterface<V> {
    private handlers: (InterceptorHandlers<V> | null)[] = [];

    /**
     * Register a new interceptor.
     * @returns Interceptor ID for use with `.eject()`
     */
    use(
        onFulfilled: (value: V) => V | Promise<V>,
        onRejected?: (error: unknown) => unknown
    ): number {
        this.handlers.push({
            fulfilled: onFulfilled,
            rejected: onRejected,
        });
        return this.handlers.length - 1;
    }

    /**
     * Remove an interceptor by its ID.
     */
    eject(id: number): void {
        if (this.handlers[id]) {
            this.handlers[id] = null;
        }
    }

    /**
     * Remove all interceptors.
     */
    clear(): void {
        this.handlers = [];
    }

    /**
     * Iterate over all registered (non-ejected) interceptors.
     */
    forEach(fn: (handler: InterceptorHandlers<V>) => void): void {
        for (const handler of this.handlers) {
            if (handler !== null) {
                fn(handler);
            }
        }
    }
}
