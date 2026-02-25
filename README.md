# ⚡ Fetch-Go

> Lightweight, Axios-compatible HTTP client built on native `fetch()` with **HTTP/2 support**. **~6KB gzipped.**

[![npm](https://img.shields.io/npm/v/fetch-go)](https://www.npmjs.com/package/fetch-go)
[![Bundle Size](https://img.shields.io/badge/gzip-~6KB-brightgreen)](https://github.com/user/fetch-go)
[![TypeScript](https://img.shields.io/badge/TypeScript-first-blue)](https://github.com/user/fetch-go)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-green)](https://github.com/user/fetch-go)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why Fetch-Go?

| Feature | `fetch()` | Axios | **Fetch-Go** |
|---------|-----------|-------|--------------| 
| Bundle size | 0KB | ~13KB | **~6KB** |
| HTTP/2 support | ❌ | ❌ | ✅ |
| Auto JSON parse | ❌ | ✅ | ✅ |
| Error on 4xx/5xx | ❌ | ✅ | ✅ |
| Timeout | ❌ | ✅ | ✅ (native `AbortSignal`) |
| Interceptors | ❌ | ✅ | ✅ |
| Retry | ❌ | ❌ plugin | ✅ built-in |
| Cancel | Manual | CancelToken (deprecated) | ✅ native `AbortSignal` |
| Form Serialization | ❌ | ✅ | ✅ FormData + URLSearchParams |
| XSRF Protection | ❌ | ✅ | ✅ |
| Basic Auth | ❌ | ✅ | ✅ |
| Proxy (Node.js) | ❌ | ✅ | ✅ |
| Progress Events | ❌ | ✅ | ✅ |
| TypeScript | Manual types | ✅ | ✅ **first-class generics** |
| Based on | — | XMLHttpRequest | **native `fetch()`** |

## Benchmark

Measured with 10,000 iterations on Node.js v22, `globalThis.fetch` mock. [Run it yourself →](benchmarks/benchmark.mjs)

| Metric | Fetch-Go | Axios | |
|--------|----------|-------|-|
| Import time | 2.6ms | 134ms | 51x faster |
| GET throughput | 63,316 req/s | 34,205 req/s | 1.85x |
| POST throughput | 78,901 req/s | 31,322 req/s | 2.5x |
| Instance creation | 6ms | 64ms | 10x |
| Bundle (gzip) | 6.1KB | ~13KB | 2x smaller |

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

## HTTP/2 Support

Fetch-Go is one of the few HTTP clients that supports HTTP/2 natively in Node.js:

```typescript
// HTTP/2 request
await fetchgo.get('https://api.example.com/data', {
  adapter: 'http',
  httpVersion: 2,
});

// HTTP/2 + Basic Auth + progress
await fetchgo.get('https://api.example.com/large-file', {
  adapter: 'http',
  httpVersion: 2,
  auth: { username: 'user', password: 'pass' },
  onDownloadProgress: (e) => console.log(`${Math.round((e.progress || 0) * 100)}%`),
});
```

## Basic Auth

```typescript
await fetchgo.get('/api/protected', {
  auth: {
    username: 'janedoe',
    password: 's00pers3cret'
  }
});

// Automatically sets: Authorization: Basic amFuZWRvZTpzMDBwZXJzM2NyZXQ=
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
  (response) => response,
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
controller.abort();
```

## Progress Events

```typescript
// Upload progress
await fetchgo.post('/upload', largeFile, {
  onUploadProgress: (event) => {
    console.log(`Upload: ${Math.round((event.progress || 0) * 100)}%`);
    console.log(`Rate: ${event.rate} bytes/sec`);
  }
});

// Download progress
await fetchgo.get('/large-file', {
  onDownloadProgress: (event) => {
    console.log(`Download: ${Math.round((event.progress || 0) * 100)}%`);
    console.log(`ETA: ${event.estimated}s`);
  }
});
```

## Form Handling

```typescript
// postForm shorthand — auto multipart/form-data
await fetchgo.postForm('/upload', { name: 'John', avatar: file });
await fetchgo.putForm('/update', { name: 'Jane', avatar: file });
await fetchgo.patchForm('/patch', { avatar: newFile });

// formSerializer option
await fetchgo.post('/upload', { name: 'John', avatar: file }, {
  formSerializer: 'formdata'
});

// URL-encoded
await fetchgo.post('/login', { username: 'john', password: 'secret' }, {
  formSerializer: 'urlencoded'
});

// Utility functions
import { toFormData, formToJSON } from 'fetch-go';

const fd = toFormData({ name: 'John', age: 30 });
const obj = formToJSON(fd); // { name: 'John', age: '30' }
```

## XSRF Protection

```typescript
const api = fetchgo.create({
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
});

// Token is automatically read from cookies and sent as a header
await api.post('/api/transfer', { amount: 100 });
```

## Proxy (Node.js)

```typescript
await fetchgo.get('https://api.example.com/data', {
  adapter: 'http',
  proxy: {
    protocol: 'https',
    host: '127.0.0.1',
    port: 9000,
    auth: {
      username: 'proxyuser',
      password: 'proxypass'
    }
  }
});
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

## Utilities

```typescript
// Build URL without sending a request
const url = fetchgo.getUri({
  baseURL: 'https://api.example.com',
  url: '/users',
  params: { id: 1, active: true }
});
// → "https://api.example.com/users?id=1&active=true"
```

## Migrating from Axios

Fetch-Go is a near drop-in replacement for Axios:

```diff
- import axios from 'axios';
+ import fetchgo from 'fetch-go';

- const api = axios.create({ baseURL: '...' });
+ const api = fetchgo.create({ baseURL: '...' });

// Everything else works the same!
const { data } = await api.get('/users');
```

## API Reference

### Methods

```
fetchgo.request(config)
fetchgo.get(url[, config])
fetchgo.post(url[, data[, config]])
fetchgo.put(url[, data[, config]])
fetchgo.patch(url[, data[, config]])
fetchgo.delete(url[, config])
fetchgo.head(url[, config])
fetchgo.options(url[, config])
fetchgo.postForm(url[, data[, config]])
fetchgo.putForm(url[, data[, config]])
fetchgo.patchForm(url[, data[, config]])
fetchgo.create(config)
fetchgo.getUri(config)
```

### Config Options

```typescript
{
  // URL
  baseURL: 'https://api.example.com',
  url: '/users',
  method: 'GET',
  allowAbsoluteUrls: true,

  // Data
  headers: { 'Content-Type': 'application/json' },
  params: { page: 1, limit: 10 },
  data: { name: 'John' },

  // Auth
  auth: { username: 'user', password: 'pass' },

  // Timing
  timeout: 5000,
  signal: abortController.signal,
  retry: 3,

  // Response
  responseType: 'json', // 'text' | 'blob' | 'arraybuffer' | 'formdata' | 'stream'
  validateStatus: (status) => status < 400,
  responseEncoding: 'utf8',

  // Body
  formSerializer: 'formdata', // 'urlencoded'
  transformRequest: [(data, headers) => data],
  transformResponse: [(data) => data],

  // Security
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',

  // Redirects
  maxRedirects: 5,
  beforeRedirect: (options, { headers }) => {},

  // Limits
  maxContentLength: 10 * 1024 * 1024,
  maxBodyLength: 10 * 1024 * 1024,
  maxRate: [100 * 1024, 100 * 1024], // [upload, download] bytes/sec

  // Progress
  onUploadProgress: (event) => console.log(event.progress),
  onDownloadProgress: (event) => console.log(event.progress),

  // Adapter & Protocol
  adapter: 'fetch', // 'http' | custom function
  httpVersion: 2,   // 1 | 2 (Node.js only)

  // Node.js specific
  proxy: { host: '127.0.0.1', port: 9000, auth: { username: '', password: '' } },
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
  socketPath: '/var/run/docker.sock',
  decompress: true,

  // Fetch pass-through
  mode: 'cors',
  cache: 'no-cache',
  redirect: 'follow',
  referrerPolicy: 'no-referrer',
}
```

## License

MIT © 2025
