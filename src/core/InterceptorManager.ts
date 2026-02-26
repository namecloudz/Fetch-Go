import type { InterceptorHandlers, InterceptorManagerInterface, InterceptorOptions } from '../types/index.js';

export class InterceptorManager<V> implements InterceptorManagerInterface<V> {
    private handlers: (InterceptorHandlers<V> | null)[] = [];

    use(
        onFulfilled: (value: V) => V | Promise<V>,
        onRejected?: (error: unknown) => unknown,
        options?: InterceptorOptions<V>
    ): number {
        this.handlers.push({
            fulfilled: onFulfilled,
            rejected: onRejected,
            runWhen: options?.runWhen,
            synchronous: options?.synchronous,
        });
        return this.handlers.length - 1;
    }

    eject(id: number): void {
        if (this.handlers[id]) {
            this.handlers[id] = null;
        }
    }

    clear(): void {
        this.handlers = [];
    }

    forEach(fn: (handler: InterceptorHandlers<V>) => void): void {
        for (const handler of this.handlers) {
            if (handler !== null) {
                fn(handler);
            }
        }
    }
}
