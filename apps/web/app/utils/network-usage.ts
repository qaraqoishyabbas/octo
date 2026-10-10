/** Payload estimate only: excludes transport headers, multipart boundaries and compression. */
export function estimatePayloadBytes(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'string') return new TextEncoder().encode(value).byteLength;
  if (value instanceof Blob) return value.size;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (value instanceof URLSearchParams) return estimatePayloadBytes(value.toString());
  if (value instanceof FormData) {
    let bytes = 0;
    for (const entry of value.values()) bytes += estimatePayloadBytes(entry);
    return bytes;
  }
  if (value instanceof ReadableStream) return 0;
  try {
    return estimatePayloadBytes(JSON.stringify(value));
  } catch {
    return 0;
  }
}

export function nonnegativeCounter(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}
