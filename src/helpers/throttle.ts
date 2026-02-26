/**
 * Throttle a ReadableStream to a maximum bytes-per-second rate.
 */
export function createThrottledStream(
    stream: ReadableStream<Uint8Array>,
    maxBytesPerSec: number
): ReadableStream<Uint8Array> {
    const reader = stream.getReader();
    let lastTime = Date.now();
    let bytesSinceLastCheck = 0;

    return new ReadableStream<Uint8Array>({
        async pull(controller) {
            const { done, value } = await reader.read();
            if (done) {
                controller.close();
                return;
            }

            bytesSinceLastCheck += value.byteLength;
            const now = Date.now();
            const elapsed = (now - lastTime) / 1000;

            if (elapsed > 0 && bytesSinceLastCheck / elapsed > maxBytesPerSec) {
                // Calculate how long to delay to stay under the rate
                const targetTime = bytesSinceLastCheck / maxBytesPerSec;
                const delayMs = (targetTime - elapsed) * 1000;

                if (delayMs > 0) {
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }

                lastTime = Date.now();
                bytesSinceLastCheck = 0;
            }

            // Reset tracking every second
            if (elapsed >= 1) {
                lastTime = now;
                bytesSinceLastCheck = 0;
            }

            controller.enqueue(value);
        },
        cancel() {
            reader.cancel();
        },
    });
}
