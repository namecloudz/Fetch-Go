import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fetchgo, { FetchGo, FetchGoError } from '../../src/index.js';

// Mock fetch globally
const mockFetch = vi.fn();

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
    vi.restoreAllMocks();
});

/**
 * Helper: create a mock Response
 */
function mockResponse(data: unknown, init?: ResponseInit): Response {
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    const headers = new Headers(init?.headers);
    if (!headers.has('content-type') && typeof data !== 'string') {
        headers.set('content-type', 'application/json');
    }
    return new Response(body, { ...init, headers });
}

describe('fetchgo default instance', () => {
    it('should be a FetchGo instance', () => {
        expect(fetchgo).toBeInstanceOf(FetchGo);
    });

    it('should have default headers', () => {
        expect(fetchgo.defaults.headers).toBeDefined();
    });
});

describe('GET requests', () => {
    it('should make a GET request and auto-parse JSON', async () => {
        const userData = [{ id: 1, name: 'John' }];
        mockFetch.mockResolvedValueOnce(mockResponse(userData));

        const { data, status } = await fetchgo.get('/api/users');

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(data).toEqual(userData);
        expect(status).toBe(200);

        // Verify fetch was called with correct args
        const [url, init] = mockFetch.mock.calls[0];
        expect(url).toBe('/api/users');
        expect(init.method).toBe('GET');
    });

    it('should send query params', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({ items: [] }));

        await fetchgo.get('/api/users', { params: { page: 1, limit: 10 } });

        const [url] = mockFetch.mock.calls[0];
        expect(url).toBe('/api/users?page=1&limit=10');
    });

    it('should use baseURL from instance', async () => {
        const api = new FetchGo({ baseURL: 'https://api.example.com' });
        mockFetch.mockResolvedValueOnce(mockResponse({ ok: true }));

        await api.get('/users');

        const [url] = mockFetch.mock.calls[0];
        expect(url).toBe('https://api.example.com/users');
    });
});

describe('POST requests', () => {
    it('should send JSON body', async () => {
        const responseData = { id: 1, name: 'John' };
        mockFetch.mockResolvedValueOnce(mockResponse(responseData, { status: 201 }));

        const { data, status } = await fetchgo.post('/api/users', { name: 'John' });

        expect(data).toEqual(responseData);
        expect(status).toBe(201);

        const [, init] = mockFetch.mock.calls[0];
        expect(init.method).toBe('POST');
        expect(init.body).toBe(JSON.stringify({ name: 'John' }));
        expect(init.headers['content-type']).toBe('application/json');
    });

    it('should not add content-type for FormData', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({ ok: true }));

        const formData = new FormData();
        formData.append('file', 'test');

        await fetchgo.post('/upload', formData);

        const [, init] = mockFetch.mock.calls[0];
        // FormData should be passed through, not stringified
        expect(init.body).toBeInstanceOf(FormData);
    });
});

describe('PUT / PATCH / DELETE', () => {
    it('should send PUT request', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({ updated: true }));
        const { data } = await fetchgo.put('/api/users/1', { name: 'Jane' });
        expect(data).toEqual({ updated: true });
        expect(mockFetch.mock.calls[0][1].method).toBe('PUT');
    });

    it('should send PATCH request', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({ patched: true }));
        const { data } = await fetchgo.patch('/api/users/1', { name: 'Jane' });
        expect(data).toEqual({ patched: true });
        expect(mockFetch.mock.calls[0][1].method).toBe('PATCH');
    });

    it('should send DELETE request', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({ deleted: true }));
        const { data } = await fetchgo.delete('/api/users/1');
        expect(data).toEqual({ deleted: true });
        expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
    });
});

describe('Error handling', () => {
    it('should throw FetchGoError on 4xx', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Not Found' }, { status: 404, statusText: 'Not Found' }));

        await expect(fetchgo.get('/not-found')).rejects.toThrow(FetchGoError);

        try {
            await fetchgo.get('/not-found');
        } catch {
            // Already tested above
        }
    });

    it('should include response in error', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({ message: 'Forbidden' }, { status: 403 }));

        try {
            await fetchgo.get('/forbidden');
            expect.fail('Should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(FetchGoError);
            const fetchGoError = error as FetchGoError;
            expect(fetchGoError.status).toBe(403);
            expect(fetchGoError.response?.data).toEqual({ message: 'Forbidden' });
        }
    });

    it('should throw on network error', async () => {
        mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

        try {
            await fetchgo.get('/api/down');
            expect.fail('Should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(FetchGoError);
            expect((error as FetchGoError).code).toBe('ERR_NETWORK');
        }
    });

    it('should support custom validateStatus', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({ accepted: true }, { status: 202 }));

        // Custom validator: only 202 is success
        const { status } = await fetchgo.get('/async-job', {
            validateStatus: (s) => s === 202,
        });
        expect(status).toBe(202);
    });
});

describe('create() instance', () => {
    it('should create an instance with merged defaults', async () => {
        const api = fetchgo.create({
            baseURL: 'https://api.example.com',
            timeout: 5000,
            headers: { 'Authorization': 'Bearer token123' },
        });

        mockFetch.mockResolvedValueOnce(mockResponse({ ok: true }));
        await api.get('/protected');

        const [url, init] = mockFetch.mock.calls[0];
        expect(url).toBe('https://api.example.com/protected');
        expect(init.headers['authorization']).toBe('Bearer token123');
    });
});

describe('Response parsing', () => {
    it('should parse JSON by content-type', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({ key: 'value' }));
        const { data } = await fetchgo.get('/json');
        expect(data).toEqual({ key: 'value' });
    });

    it('should return text for text content-type', async () => {
        const textResponse = new Response('Hello World', {
            headers: { 'content-type': 'text/plain' },
        });
        mockFetch.mockResolvedValueOnce(textResponse);
        const { data } = await fetchgo.get('/text');
        expect(data).toBe('Hello World');
    });

    it('should respect explicit responseType', async () => {
        const textResponse = new Response('raw text', {
            headers: { 'content-type': 'application/json' },
        });
        mockFetch.mockResolvedValueOnce(textResponse);
        const { data } = await fetchgo.get('/raw', { responseType: 'text' });
        expect(data).toBe('raw text');
    });

    it('should return null for 204 No Content', async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
        const { data, status } = await fetchgo.get('/empty');
        expect(status).toBe(204);
        expect(data).toBeNull();
    });
});
