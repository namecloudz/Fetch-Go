# Changelog

All notable changes to this project will be documented in this file.

## [1.2.2] - 2025-02-26

### Added
- **XHR Adapter** — automatic fallback for upload progress on Safari and browsers without ReadableStream body support
- `adapter: 'xhr'` option for explicit XHR usage
- `supportsRequestStreams()` utility export for feature detection
- Exported `xhrAdapter` for advanced usage

## [1.2.1] - 2025-02-26

### Changed
- **Performance optimization** — 1.9x faster GET, 2.4x faster POST vs Axios
- Eliminated `deepMerge()` in mergeConfig (replaced with shallow spread)
- Removed per-request `validateConfig()` from hot path
- Reduced `normalizeHeaders()` calls from 4x to 1x per request
- Fast-path when no interceptors are registered
- Pre-computed retry configs for common cases
- Bundle reduced from 22.0 KB → 21.2 KB

### Added
- Benchmark section in README with real performance numbers

## [1.2.0] - 2025-02-26

### Added
- **Static Helpers** — `fetchgo.all()`, `fetchgo.spread()`, `fetchgo.isCancel()`
- **Per-Method Default Headers** — `common`, `get`, `post`, `put`, `patch`, `delete`
- **Interceptor Enhancements** — `runWhen` conditional execution, `synchronous` mode
- **Environment Auto-Detection** — auto-selects `httpAdapter` on Node.js
- **Rate Limiting** — `maxRate` for upload/download throttling
- **`responseType: 'document'`** — DOM parser support (browser)
- **Advanced FormData** — `dots`, `metaTokens`, `indexes` serialization options
- **Env Config** — `config.env.FormData` polyfill injection
- **Transitional Options** — `silentJSONParsing`, `forcedJSONParsing`, `clarifyTimeoutError`
- GitHub Actions CI workflow with multi-Node testing
- Comprehensive test suite (49 tests)
- Full documentation page (`demo/docs.html`)

## [1.1.0] - 2025-02-25

### Added
- HTTP/2 support via Node.js `http2` module
- Upload/download progress events
- Retry with exponential backoff
- XSRF cookie protection
- Basic auth support
- Proxy support (Node.js)
- Custom adapters
- `httpAdapter` for Node.js native `http/https`

## [1.0.0] - 2025-02-25

### Added
- Initial release
- Axios-compatible API (`get`, `post`, `put`, `patch`, `delete`, `head`, `options`)
- Instance creation with `fetchgo.create()`
- Request/response interceptors
- Auto JSON parse/stringify
- Timeout via AbortSignal
- Cancellation support
- Query parameter serialization
- TypeScript first-class support
- ESM + CJS dual build
- Zero dependencies
