import { describe, it, expect } from 'vitest';
import { createThrottledStream } from '../src/helpers/throttle.js';

describe('Throttled Stream', () => {
    it('should pass through all data', async () => {
        const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        const source = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(data);
                controller.close();
            },
        });

        const throttled = createThrottledStream(source, 1024 * 1024); // 1MB/s — no throttle needed
        const reader = throttled.getReader();

        const chunks: Uint8Array[] = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }

        const combined = new Uint8Array(chunks.reduce((sum, c) => sum + c.byteLength, 0));
        let offset = 0;
        for (const chunk of chunks) {
            combined.set(chunk, offset);
            offset += chunk.byteLength;
        }

        expect(combined).toEqual(data);
    });

    it('should handle empty stream', async () => {
        const source = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.close();
            },
        });

        const throttled = createThrottledStream(source, 1024);
        const reader = throttled.getReader();

        const { done } = await reader.read();
        expect(done).toBe(true);
    });

    it('should handle multiple chunks', async () => {
        const chunk1 = new Uint8Array([1, 2, 3]);
        const chunk2 = new Uint8Array([4, 5, 6]);

        const source = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(chunk1);
                controller.enqueue(chunk2);
                controller.close();
            },
        });

        const throttled = createThrottledStream(source, 1024 * 1024);
        const reader = throttled.getReader();

        const results: Uint8Array[] = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            results.push(value);
        }

        expect(results.length).toBe(2);
        expect(results[0]).toEqual(chunk1);
        expect(results[1]).toEqual(chunk2);
    });
});
