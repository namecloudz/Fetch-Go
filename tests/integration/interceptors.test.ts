import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FetchGo } from '../../src/index.js';

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

describe('Request Interceptors', () => {
    it('should modify request config', async () => {
        const api = new FetchGo();
        api.interceptors.request.use((config) => {
            config.headers = {
                ...(config.headers as Record<string, string>),
                'x-custom': 'intercepted',
            };
            return config;
        });

        mockFetch.mockResolvedValueOnce(mockResponse({ ok: true }));
        await api.get('/test');

        const [, init] = mockFetch.mock.calls[0];
        expect(init.headers['x-custom']).toBe('intercepted');
    });

    it('should run multiple request interceptors in LIFO order', async () => {
        const api = new FetchGo();
        const order: number[] = [];

        api.interceptors.request.use((config) => {
            order.push(1);
            return config;
        });

        api.interceptors.request.use((config) => {
            order.push(2);
            return config;
        });

        mockFetch.mockResolvedValueOnce(mockResponse({ ok: true }));
        await api.get('/test');

        // LIFO order: second interceptor runs first (like Axios)
        expect(order).toEqual([2, 1]);
    });

    it('should handle request interceptor errors', async () => {
        const api = new FetchGo();
        api.interceptors.request.use(() => {
            throw new Error('interceptor error');
        });

        await expect(api.get('/test')).rejects.toThrow('interceptor error');
        expect(mockFetch).not.toHaveBeenCalled();
    });
});

describe('Response Interceptors', () => {
    it('should transform response', async () => {
        const api = new FetchGo();
        api.interceptors.response.use((response) => {
            response.data = { ...response.data as Record<string, unknown>, intercepted: true };
            return response;
        });

        mockFetch.mockResolvedValueOnce(mockResponse({ value: 42 }));
        const { data } = await api.get('/test');

        expect(data).toEqual({ value: 42, intercepted: true });
    });

    it('should run response interceptors in FIFO order', async () => {
        const api = new FetchGo();
        const order: number[] = [];

        api.interceptors.response.use((response) => {
            order.push(1);
            return response;
        });

        api.interceptors.response.use((response) => {
            order.push(2);
            return response;
        });

        mockFetch.mockResolvedValueOnce(mockResponse({ ok: true }));
        await api.get('/test');

        expect(order).toEqual([1, 2]);
    });

    it('should handle response error interceptors', async () => {
        const api = new FetchGo();
        const errorHandler = vi.fn((error) => {
            throw error; // re-throw
        });

        api.interceptors.response.use(
            (response) => response,
            errorHandler
        );

        mockFetch.mockResolvedValueOnce(mockResponse({ error: 'fail' }, { status: 500 }));

        await expect(api.get('/fail')).rejects.toThrow();
        expect(errorHandler).toHaveBeenCalled();
    });
});

describe('Eject interceptors', () => {
    it('should eject a request interceptor', async () => {
        const api = new FetchGo();
        const id = api.interceptors.request.use((config) => {
            config.headers = {
                ...(config.headers as Record<string, string>),
                'x-should-not-exist': 'true',
            };
            return config;
        });

        api.interceptors.request.eject(id);

        mockFetch.mockResolvedValueOnce(mockResponse({ ok: true }));
        await api.get('/test');

        const [, init] = mockFetch.mock.calls[0];
        expect(init.headers['x-should-not-exist']).toBeUndefined();
    });

    it('should clear all interceptors', async () => {
        const api = new FetchGo();
        const tracker = vi.fn();

        api.interceptors.request.use((config) => {
            tracker();
            return config;
        });
        api.interceptors.request.use((config) => {
            tracker();
            return config;
        });

        api.interceptors.request.clear();

        mockFetch.mockResolvedValueOnce(mockResponse({ ok: true }));
        await api.get('/test');

        expect(tracker).not.toHaveBeenCalled();
    });
});
