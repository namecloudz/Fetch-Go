import { performance } from 'perf_hooks';

// Measure import time
const t0 = performance.now();
const fetchgo = await import('../dist/index.js');
const importTimeFetchGo = performance.now() - t0;

const t1 = performance.now();
let axios;
try {
    axios = await import('axios');
} catch {
    console.log('axios not installed, installing...');
    const { execSync } = await import('child_process');
    execSync('npm install axios --no-save', { stdio: 'inherit' });
    axios = await import('axios');
}
const importTimeAxios = performance.now() - t1;

// Bundle size comparison
import { statSync } from 'fs';
import { gzipSync } from 'zlib';
import { readFileSync } from 'fs';

const fgESM = readFileSync(new URL('../dist/index.js', import.meta.url));
const fgCJS = readFileSync(new URL('../dist/index.cjs', import.meta.url));
const fgGzipESM = gzipSync(fgESM).length;
const fgGzipCJS = gzipSync(fgCJS).length;

// Find axios bundle size
import { dirname, join } from 'path';
const axiosPath = join(dirname(new URL(import.meta.resolve('axios')).pathname), '..', 'dist', 'axios.min.js');
let axiosSize = 0;
let axiosGzip = 0;
try {
    const axiosBundle = readFileSync(axiosPath);
    axiosSize = axiosBundle.length;
    axiosGzip = gzipSync(axiosBundle).length;
} catch {
    // Try alternative path
    try {
        const axiosPath2 = join(dirname(new URL(import.meta.resolve('axios')).pathname), 'axios.js');
        const axiosBundle = readFileSync(axiosPath2);
        axiosSize = axiosBundle.length;
        axiosGzip = gzipSync(axiosBundle).length;
    } catch {
        console.log('Could not find axios bundle for size comparison');
    }
}

// Mock fetch for benchmarks
const mockResponse = new Response(JSON.stringify({ id: 1, name: 'John', email: 'john@test.com' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
});

globalThis.fetch = async () => mockResponse.clone();

// Benchmark: simple GET requests
const ITERATIONS = 10000;

console.log('\n═══════════════════════════════════════════');
console.log('  Fetch-Go vs Axios Performance Benchmark');
console.log('═══════════════════════════════════════════\n');

console.log('📦 Bundle Size');
console.log('──────────────────────────────────────────');
console.log(`  Fetch-Go ESM:  ${(fgESM.length / 1024).toFixed(1)}KB (gzip: ${(fgGzipESM / 1024).toFixed(1)}KB)`);
console.log(`  Fetch-Go CJS:  ${(fgCJS.length / 1024).toFixed(1)}KB (gzip: ${(fgGzipCJS / 1024).toFixed(1)}KB)`);
if (axiosSize > 0) {
    console.log(`  Axios min:     ${(axiosSize / 1024).toFixed(1)}KB (gzip: ${(axiosGzip / 1024).toFixed(1)}KB)`);
    console.log(`  → Fetch-Go is ${(axiosGzip / fgGzipESM).toFixed(1)}x smaller (gzip)`);
}

console.log('\n⏱️  Import Time');
console.log('──────────────────────────────────────────');
console.log(`  Fetch-Go:  ${importTimeFetchGo.toFixed(2)}ms`);
console.log(`  Axios:     ${importTimeAxios.toFixed(2)}ms`);
console.log(`  → Fetch-Go is ${(importTimeAxios / importTimeFetchGo).toFixed(1)}x faster`);

// GET benchmark
console.log(`\n🚀 GET Request (${ITERATIONS.toLocaleString()} iterations)`);
console.log('──────────────────────────────────────────');

const fg = fetchgo.default;

// Use a mock server URL - we'll override fetch globally for both
const BASE = 'http://localhost:9999';

const startFG = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    await fg.get(`${BASE}/users`);
}
const timeFG = performance.now() - startFG;

// Force axios to use fetch adapter for fair comparison
const ax = axios.default.create({ adapter: 'fetch' });
const startAx = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    await ax.get(`${BASE}/users`);
}
const timeAx = performance.now() - startAx;

console.log(`  Fetch-Go:  ${timeFG.toFixed(0)}ms (${(ITERATIONS / timeFG * 1000).toFixed(0)} req/s)`);
console.log(`  Axios:     ${timeAx.toFixed(0)}ms (${(ITERATIONS / timeAx * 1000).toFixed(0)} req/s)`);
console.log(`  → Fetch-Go is ${(timeAx / timeFG).toFixed(2)}x faster`);

// POST benchmark
console.log(`\n📤 POST Request (${ITERATIONS.toLocaleString()} iterations)`);
console.log('──────────────────────────────────────────');

const postData = { name: 'John', email: 'john@test.com', age: 30 };

const startFGPost = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    await fg.post(`${BASE}/users`, postData);
}
const timeFGPost = performance.now() - startFGPost;

const startAxPost = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    await ax.post(`${BASE}/users`, postData);
}
const timeAxPost = performance.now() - startAxPost;

console.log(`  Fetch-Go:  ${timeFGPost.toFixed(0)}ms (${(ITERATIONS / timeFGPost * 1000).toFixed(0)} req/s)`);
console.log(`  Axios:     ${timeAxPost.toFixed(0)}ms (${(ITERATIONS / timeAxPost * 1000).toFixed(0)} req/s)`);
console.log(`  → Fetch-Go is ${(timeAxPost / timeFGPost).toFixed(2)}x faster`);

// Instance creation
console.log(`\n🏗️  Instance Creation (${ITERATIONS.toLocaleString()} iterations)`);
console.log('──────────────────────────────────────────');

const startFGCreate = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    fg.create({ baseURL: 'https://api.test.com', timeout: 5000 });
}
const timeFGCreate = performance.now() - startFGCreate;

const axDefault = axios.default;
const startAxCreate = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    axDefault.create({ baseURL: 'https://api.test.com', timeout: 5000 });
}
const timeAxCreate = performance.now() - startAxCreate;

console.log(`  Fetch-Go:  ${timeFGCreate.toFixed(0)}ms`);
console.log(`  Axios:     ${timeAxCreate.toFixed(0)}ms`);
console.log(`  → Fetch-Go is ${(timeAxCreate / timeFGCreate).toFixed(2)}x faster`);

console.log('\n═══════════════════════════════════════════\n');
