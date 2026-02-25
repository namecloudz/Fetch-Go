import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fetchgo, { FetchGoError, isCancel } from '../../src/index.js';

const mockFetch = vi.fn();

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
    vi.restoreAllMocks();
});

function mockResponse(data: unknown, init?: ResponseInit): Response {
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    const headers = new Headers(init?.headers);
    if (!headers.has('content-type') && typeof data !== 'string') {
        headers.set('content-type', 'application/json');
    }
    return new Response(body, { ...init, headers });
}

describe('Retry', () => {
    it('should retry on server error', async () => {
        // Fail twice, succeed on third
        mockFetch
            .mockResolvedValueOnce(mockResponse({ error: true }, { status: 503 }))
            .mockResolvedValueOnce(mockResponse({ error: true }, { status: 503 }))
            .mockResolvedValueOnce(mockResponse({ data: 'success' }));

        const { data } = await fetchgo.get('/flaky', {
            retry: { retries: 3, delay: 10, backoff: 1 },
        });

        expect(data).toEqual({ data: 'success' });
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should throw after exhausting retries', async () => {
        mockFetch.mockResolvedValue(mockResponse({ error: true }, { status: 500 }));

        await expect(
            fetchgo.get('/always-fail', { retry: { retries: 2, delay: 10, backoff: 1 } })
        ).rejects.toThrow(FetchGoError);

        // 1 initial + 2 retries = 3 total attempts
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on 4xx errors by default', async () => {
        mockFetch.mockResolvedValue(mockResponse({ error: true }, { status: 400 }));

        await expect(
            fetchgo.get('/bad-request', { retry: { retries: 3, delay: 10 } })
        ).rejects.toThrow(FetchGoError);

        // No retries: 400 is not in default retryStatusCodes
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry POST by default', async () => {
        mockFetch.mockResolvedValue(mockResponse({ error: true }, { status: 503 }));

        await expect(
            fetchgo.post('/create', { name: 'test' }, { retry: { retries: 3, delay: 10 } })
        ).rejects.toThrow(FetchGoError);

        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle retry: true as 3 retries', async () => {
        mockFetch.mockResolvedValue(mockResponse({ error: true }, { status: 500 }));

        await expect(fetchgo.get('/fail', { retry: true })).rejects.toThrow();

        // 1 initial + 3 retries = 4 total
        expect(mockFetch).toHaveBeenCalledTimes(4);
    }, 15000);

    it('should handle retry: number', async () => {
        mockFetch.mockResolvedValue(mockResponse({ error: true }, { status: 500 }));

        await expect(fetchgo.get('/fail', { retry: 1 })).rejects.toThrow();

        // 1 initial + 1 retry = 2 total
        expect(mockFetch).toHaveBeenCalledTimes(2);
    }, 10000);
});

describe('Cancel', () => {
    it('should cancel request with AbortController', async () => {
        const controller = new AbortController();

        mockFetch.mockImplementation((_url: string, init: RequestInit) => {
            return new Promise((_resolve, reject) => {
                const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
                if (init.signal?.aborted) {
                    onAbort();
                    return;
                }
                init.signal?.addEventListener('abort', onAbort);
            });
        });

        // Abort immediately
        controller.abort();

        try {
            await fetchgo.get('/slow', { signal: controller.signal });
            expect.fail('Should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(FetchGoError);
            expect(isCancel(error)).toBe(true);
        }
    });
});
