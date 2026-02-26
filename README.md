# ⚡ Fetch-Go

> Lightweight, Axios-compatible HTTP client built on native `fetch()` with **HTTP/2 support**. **~6KB gzipped.**

[![npm](https://img.shields.io/npm/v/fetch-go)](https://www.npmjs.com/package/fetch-go)
[![Bundle Size](https://img.shields.io/badge/gzip-~6KB-brightgreen)](https://github.com/namecloudz/Fetch-Go)
[![TypeScript](https://img.shields.io/badge/TypeScript-first-blue)](https://github.com/namecloudz/Fetch-Go)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-green)](https://github.com/namecloudz/Fetch-Go)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/namecloudz/Fetch-Go/actions/workflows/ci.yml/badge.svg)](https://github.com/namecloudz/Fetch-Go/actions/workflows/ci.yml)

## Why Fetch-Go?

| Feature | `fetch()` | Axios | **Fetch-Go** |
|---------|-----------|-------|--------------|
| Bundle size | 0KB | ~13KB | **~6KB** |
| HTTP/2 support | ❌ | ❌ | ✅ |
| Auto JSON parse | ❌ | ✅ | ✅ |
| Error on 4xx/5xx | ❌ | ✅ | ✅ |
| Timeout | ❌ | ✅ | ✅ (native `AbortSignal`) |
| Interceptors | ❌ | ✅ | ✅ (with `runWhen` & `synchronous`) |
| Retry | ❌ | ❌ plugin | ✅ built-in |
| Cancel | Manual | CancelToken (deprecated) | ✅ native `AbortSignal` |
| Form Serialization | ❌ | ✅ | ✅ (dots, indexes, metaTokens) |
| XSRF Protection | ❌ | ✅ | ✅ |
| Basic Auth | ❌ | ✅ | ✅ |
| Proxy (Node.js) | ❌ | ✅ | ✅ |
| Progress Events | ❌ | ✅ | ✅ |
| Rate Limiting | ❌ | ✅ | ✅ `maxRate` |
| Per-method Headers | ❌ | ✅ | ✅ |
| Env Auto-detect | ❌ | ✅ | ✅ |
| Transitional Options | ❌ | ✅ | ✅ |
| TypeScript | Manual types | ✅ | ✅ **first-class generics** |
| Based on | — | XMLHttpRequest | **native `fetch()`** |

## Benchmark

> Tested on Node.js v22 with a local HTTP server, 500 requests per metric.

| Metric | Fetch-Go | Axios | |
|--------|----------|-------|-|
| Import time | 4.2ms | 160ms | **37.9x faster** |
| Instance creation (1000×) | 0.8ms | 13.2ms | **16.7x faster** |
| GET throughput | 7,068 req/s | 3,687 req/s | **1.9x faster** |
| POST throughput | 8,760 req/s | 3,692 req/s | **2.4x faster** |
| Bundle (ESM) | 21.2 KB | ~30 KB | **1.4x smaller** |

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

## Per-Method Default Headers

Set different default headers for each HTTP method:

```typescript
const api = fetchgo.create({
  headers: {
    common: {
      'Accept': 'application/json',
    },
    get: {
      'Cache-Control': 'no-cache',
    },
    post: {
      'Content-Type': 'application/json',
    },
  }
});

// GET requests include Accept + Cache-Control
// POST requests include Accept + Content-Type
```

## HTTP/2 Support

Fetch-Go is one of the few HTTP clients that supports HTTP/2 natively in Node.js:

```typescript
// HTTP/2 request
await fetchgo.get('https://api.example.com/data', {
  httpVersion: 2,
});

// HTTP/2 + Basic Auth + progress
await fetchgo.get('https://api.example.com/large-file', {
  httpVersion: 2,
  auth: { username: 'user', password: 'pass' },
  onDownloadProgress: (e) => console.log(`${Math.round((e.progress || 0) * 100)}%`),
});
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

### Conditional Interceptors (`runWhen`)

Only run interceptors when a condition is met:

```typescript
api.interceptors.request.use(
  (config) => {
    config.headers['X-Auth'] = getToken();
    return config;
  },
  undefined,
  {
    // Only attach auth header for requests to /api/
    runWhen: (config) => config.url?.startsWith('/api/') ?? false
  }
);
```

### Synchronous Interceptors

Skip the async micro-task queue for faster interceptor processing:

```typescript
api.interceptors.request.use(
  (config) => {
    config.headers['X-Timestamp'] = Date.now().toString();
    return config;
  },
  undefined,
  { synchronous: true }
);
```

## Environment Auto-Detection

Fetch-Go **automatically selects the best adapter** for your environment:

- **Browser** → native `fetch()` adapter
- **Node.js** → `http`/`https` adapter (full proxy, HTTP/2, socket support)

No manual `adapter: 'http'` needed — it just works.

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

## Rate Limiting (`maxRate`)

Throttle upload and download speed:

```typescript
// Limit both upload and download to 100 KB/s
await fetchgo.get('/large-file', {
  maxRate: 100 * 1024,
});

// Separate upload and download rates
await fetchgo.post('/upload', largeFile, {
  maxRate: [50 * 1024, 200 * 1024], // [upload, download] bytes/sec
});
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

// URL-encoded
await fetchgo.post('/login', { username: 'john', password: 'secret' }, {
  formSerializer: 'urlencoded'
});
```

### Advanced FormData Options

```typescript
import { toFormData, formToJSON } from 'fetch-go';

// Dot notation for nested keys
const fd = toFormData({ user: { name: 'John' } }, undefined, { dots: true });
// → user.name = 'John'  (instead of user[name])

// Array index modes
toFormData({ tags: ['a', 'b'] }, undefined, { indexes: true });   // tags[0]=a, tags[1]=b
toFormData({ tags: ['a', 'b'] }, undefined, { indexes: false });  // tags[]=a, tags[]=b
toFormData({ tags: ['a', 'b'] }, undefined, { indexes: null });   // tags=a, tags=b

// Meta tokens for type hints
toFormData({ users: [{ name: 'a' }] }, undefined, { metaTokens: true });
// → users[]{} keys

// Convert FormData back to JSON
const obj = formToJSON(fd);
```

## Transitional Options

Control backward-compatible behaviors:

```typescript
const api = fetchgo.create({
  transitional: {
    silentJSONParsing: true,    // Don't throw on JSON parse failure (default: true)
    forcedJSONParsing: false,   // Force JSON parse regardless of content-type (default: false)
    clarifyTimeoutError: true,  // Use ETIMEDOUT instead of ECONNABORTED (default: true)
  }
});
```

## Config `env` — Polyfill Injection

Inject custom FormData or Blob implementations:

```typescript
import FormData from 'form-data';

await fetchgo.post('/upload', { file: stream }, {
  env: {
    FormData: FormData,
  },
  formSerializer: 'formdata',
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

## Static Helpers

```typescript
// Parallel requests (like axios.all)
const [users, posts] = await fetchgo.all([
  fetchgo.get('/api/users'),
  fetchgo.get('/api/posts'),
]);

// Spread helper
fetchgo.all([fetchgo.get('/a'), fetchgo.get('/b')])
  .then(fetchgo.spread((resA, resB) => {
    console.log(resA.data, resB.data);
  }));

// Cancel detection
import { isCancel } from 'fetch-go';
if (fetchgo.isCancel(error)) {
  console.log('Cancelled!');
}
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
fetchgo.all(promises)
fetchgo.spread(callback)
fetchgo.isCancel(error)
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
  // Or per-method headers:
  headers: {
    common: { 'Accept': 'application/json' },
    get: { 'Cache-Control': 'no-cache' },
    post: { 'Content-Type': 'application/json' },
  },
  params: { page: 1, limit: 10 },
  data: { name: 'John' },

  // Auth
  auth: { username: 'user', password: 'pass' },

  // Timing
  timeout: 5000,
  signal: abortController.signal,
  retry: 3,

  // Response
  responseType: 'json', // 'text' | 'blob' | 'arraybuffer' | 'formdata' | 'stream' | 'document'
  validateStatus: (status) => status < 400,

  // Body
  formSerializer: 'formdata',                   // 'urlencoded' or options object:
  formSerializer: { dots: true, indexes: true }, // advanced FormData options
  transformRequest: [(data, headers) => data],
  transformResponse: [(data) => data],

  // Security
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',

  // Redirects
  maxRedirects: 5,
  beforeRedirect: (options, { headers }) => {},

  // Limits & Rate
  maxContentLength: 10 * 1024 * 1024,
  maxBodyLength: 10 * 1024 * 1024,
  maxRate: [100 * 1024, 100 * 1024], // [upload, download] bytes/sec

  // Progress
  onUploadProgress: (event) => console.log(event.progress),
  onDownloadProgress: (event) => console.log(event.progress),

  // Adapter & Protocol
  adapter: 'fetch', // 'http' | custom function (auto-detected by default)
  httpVersion: 2,   // 1 | 2 (Node.js only)

  // Transitional
  transitional: {
    silentJSONParsing: true,
    forcedJSONParsing: false,
    clarifyTimeoutError: true,
  },

  // Environment
  env: { FormData: CustomFormData },

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
