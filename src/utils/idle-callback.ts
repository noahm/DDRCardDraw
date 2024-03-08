/**
 * because iOS has had requestIdleCallback behind a flag since 13.1 and still hasn't shipped in 17...
 */
const hasIdleCallback = typeof window.requestIdleCallback === "function";

export function requestIdleCallback(cb: () => void) {
  if (hasIdleCallback) {
    return requestIdleCallback(cb);
  } else {
    return requestAnimationFrame(cb);
  }
}

export function cancelIdleCallback(handle: number) {
  if (hasIdleCallback) {
    cancelIdleCallback(handle);
  } else {
    cancelAnimationFrame(handle);
  }
}
