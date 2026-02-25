# ⚡ Fetch-Go

> Lightweight, Axios-compatible HTTP client built on native `fetch()`. **~3KB gzipped.**

[![Bundle Size](https://img.shields.io/badge/gzip-~3KB-brightgreen)](https://github.com/user/fetch-go)
[![TypeScript](https://img.shields.io/badge/TypeScript-first-blue)](https://github.com/user/fetch-go)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-green)](https://github.com/user/fetch-go)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why Fetch-Go?

| Feature | `fetch()` | Axios | **Fetch-Go** |
|---------|-----------|-------|--------------|
| Bundle size | 0KB | ~13KB | **~3KB** |
| Auto JSON parse | ❌ | ✅ | ✅ |
| Error on 4xx/5xx | ❌ | ✅ | ✅ |
| Timeout | ❌ | ✅ | ✅ (native `AbortSignal`) |
| Interceptors | ❌ | ✅ | ✅ |
| Retry | ❌ | ❌ plugin | ✅ built-in |
| Cancel | Manual | CancelToken (deprecated) | ✅ native `AbortSignal` |
| TypeScript | Manual types | ✅ | ✅ **first-class generics** |
| Based on | — | XMLHttpRequest | **native `fetch()`** |

## Install

```bash
npm install fetch-go
```

## Quick Start

```typescript
import fetchgo from 'fetch-go';

// GET — auto-parses JSON
const { data } = await fetchgo.get('/api/users');

// POST — auto-serializes body
const { data: user } = await fetchgo.post('/api/users', {
  name: 'John',
  email: 'john@example.com'
});

// Full TypeScript generics
interface User {
  id: number;
  name: string;
}
const { data: users } = await fetchgo.get<User[]>('/api/users');
```

## Create an Instance

```typescript
const api = fetchgo.create({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Authorization': 'Bearer your-token'
  }
});

const { data } = await api.get('/protected/resource');
```

## Interceptors

```typescript
// Request interceptor
api.interceptors.request.use((config) => {
  config.headers = {
    ...config.headers,
    'X-Request-ID': crypto.randomUUID()
  };
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`[${response.status}] ${response.config.url}`);
    return response;
  },
  (error) => {
    if (error.status === 401) {
      window.location.href = '/login';
    }
    throw error;
  }
);

// Eject
const id = api.interceptors.request.use(myInterceptor);
api.interceptors.request.eject(id);
```

## Retry

```typescript
// Simple: retry 3 times
await fetchgo.get('/flaky-endpoint', { retry: 3 });

// Advanced: custom config
await fetchgo.get('/flaky-endpoint', {
  retry: {
    retries: 5,
    delay: 500,           // 500ms initial delay
    backoff: 2,           // exponential: 500, 1000, 2000, 4000, 8000
    retryStatusCodes: [429, 500, 502, 503, 504],
    retryCondition: (error) => !isCancel(error),
  }
});
```

## Timeout & Cancel

```typescript
// Timeout (ms)
await fetchgo.get('/slow', { timeout: 5000 });

// Cancel with AbortController
const controller = new AbortController();
fetchgo.get('/long-request', { signal: controller.signal });

// Cancel it
controller.abort();
```

## Error Handling

```typescript
import { FetchGoError, isCancel } from 'fetch-go';

try {
  await api.get('/might-fail');
} catch (error) {
  if (isCancel(error)) {
    console.log('Request was cancelled');
  } else if (error instanceof FetchGoError) {
    console.log(error.status);        // 404
    console.log(error.response?.data); // { message: "Not Found" }
    console.log(error.code);          // "ERR_BAD_REQUEST"
  }
}
```

## Migrating from Axios

Fetch-Go's API is designed to be a near drop-in replacement:

```diff
- import axios from 'axios';
+ import fetchgo from 'fetch-go';

- const api = axios.create({ baseURL: '...' });
+ const api = fetchgo.create({ baseURL: '...' });

// Everything else works the same!
const { data } = await api.get('/users');
```

### Key Differences

| Axios | Fetch-Go |
|-------|----------|
| `axios.CancelToken` (deprecated) | Use native `AbortController` |
| `onUploadProgress` | Not supported (use `fetch` events) |
| `maxRedirects` | Use `redirect: 'manual'` |
| Node.js `http` adapter | Browser-only (uses `fetch`) |

## API Reference

### `fetchgo.request(config)`
### `fetchgo.get(url[, config])`
### `fetchgo.post(url[, data[, config]])`
### `fetchgo.put(url[, data[, config]])`
### `fetchgo.patch(url[, data[, config]])`
### `fetchgo.delete(url[, config])`
### `fetchgo.head(url[, config])`
### `fetchgo.options(url[, config])`
### `fetchgo.create(config)`

### Config Options

```typescript
{
  baseURL: 'https://api.example.com',
  url: '/users',
  method: 'GET',
  headers: { 'Content-Type': 'application/json' },
  params: { page: 1, limit: 10 },
  data: { name: 'John' },
  timeout: 5000,
  signal: abortController.signal,
  retry: 3, // or { retries, delay, backoff, ... }
  responseType: 'json', // 'text' | 'blob' | 'arraybuffer'
  validateStatus: (status) => status < 400,
  withCredentials: true,
  transformRequest: [(data, headers) => { /* ... */ return data }],
  transformResponse: [(data) => { /* ... */ return data }],
  // Pass-through fetch options
  mode: 'cors',
  cache: 'no-cache',
  redirect: 'follow',
  referrerPolicy: 'no-referrer',
}
```

## License

MIT © 2025
